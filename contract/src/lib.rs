//! AgentGate vault contract (PRD section 6).
//!
//! The owner funds this vault and the vault mints its own agent keys. Each agent
//! key is a Function Call Key on the vault account that can only call
//! `request_spend`. The vault decides: PAID, HELD or BLOCKED.

use near_sdk::store::{IterableMap, LookupMap};
use near_sdk::{
    env, near, require, AccountId, Allowance, NearToken, PanicOnDefault, Promise, PublicKey,
};

mod types;
pub use types::*;

#[cfg(test)]
mod tests;

/// Payment log size. Mirrors `logMax` in config/seed.json (a script test checks they match).
pub const LOG_MAX: u64 = 100;
/// Max held payments waiting for the owner. Mirrors `holdQueueMax` in config/seed.json.
pub const HOLD_QUEUE_MAX: u32 = 20;
/// Max approved recipients per agent.
pub const MAX_ALLOWED: usize = 10;
/// Max reason length; longer reasons are cut.
pub const MAX_REASON_CHARS: usize = 140;
/// Extra NEAR kept on top of storage cost so the vault never spends its storage stake.
pub const STORAGE_BUFFER: NearToken = NearToken::from_millinear(500);
/// Nanoseconds in one UTC day.
pub const NS_PER_DAY: u64 = 86_400_000_000_000;
/// The only method an agent key may call.
pub const SPEND_METHOD: &str = "request_spend";

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Vault {
    owner: AccountId,
    agents: IterableMap<PublicKey, Agent>,
    /// Ring buffer: slot = payment id % LOG_MAX.
    payments: LookupMap<u64, Payment>,
    held: IterableMap<u64, Payment>,
    next_id: u64,
    counters: Counters,
}

#[near]
impl Vault {
    #[init]
    pub fn new(owner: AccountId) -> Self {
        Self {
            owner,
            agents: IterableMap::new(b"a"),
            payments: LookupMap::new(b"p"),
            held: IterableMap::new(b"h"),
            next_id: 0,
            counters: Counters::default(),
        }
    }

    // ---------------------------------------------------------------- owner

    /// Saves the agent, then the vault adds a Function Call Key to itself that
    /// can only call `request_spend` on this vault.
    pub fn add_agent(
        &mut self,
        public_key: PublicKey,
        name: String,
        per_tx_cap: NearToken,
        daily_cap: NearToken,
        allowed: Vec<AccountId>,
        allowance: NearToken,
    ) -> Promise {
        self.assert_owner();
        require!(!self.agents.contains_key(&public_key), "ERR_AGENT_EXISTS");
        require!(allowed.len() <= MAX_ALLOWED, "ERR_TOO_MANY_RECIPIENTS");
        let key_allowance =
            Allowance::limited(allowance).unwrap_or_else(|| env::panic_str("ERR_ZERO_ALLOWANCE"));

        let agent = Agent {
            name,
            public_key: public_key.clone(),
            per_tx_cap,
            daily_cap,
            allowed,
            day_index: today(),
            paid_today: NearToken::from_yoctonear(0),
            active: true,
            created_at: env::block_timestamp(),
        };
        self.agents.insert(public_key.clone(), agent);

        let vault = env::current_account_id();
        // The key's receiver is the vault itself, so every call it signs has
        // predecessor == current_account (see request_spend check 1).
        Promise::new(vault.clone()).add_access_key_allowance(
            public_key,
            key_allowance,
            vault,
            SPEND_METHOD,
        )
    }

    /// Changes an agent's rules. Agent keys can't reach this: the protocol only
    /// lets them call `request_spend`.
    pub fn update_rules(
        &mut self,
        public_key: PublicKey,
        per_tx_cap: NearToken,
        daily_cap: NearToken,
        allowed: Vec<AccountId>,
    ) {
        self.assert_owner();
        require!(allowed.len() <= MAX_ALLOWED, "ERR_TOO_MANY_RECIPIENTS");
        let agent = self
            .agents
            .get_mut(&public_key)
            .unwrap_or_else(|| env::panic_str("ERR_UNKNOWN_AGENT_KEY"));
        agent.per_tx_cap = per_tx_cap;
        agent.daily_cap = daily_cap;
        agent.allowed = allowed;
    }

    /// Marks the agent inactive and deletes its key from the vault account.
    pub fn revoke_agent(&mut self, public_key: PublicKey) -> Promise {
        self.assert_owner();
        let agent = self
            .agents
            .get_mut(&public_key)
            .unwrap_or_else(|| env::panic_str("ERR_UNKNOWN_AGENT_KEY"));
        require!(agent.active, "ERR_ALREADY_REVOKED");
        agent.active = false;
        Promise::new(env::current_account_id()).delete_key(public_key)
    }

    /// Pays a held request. A human decided, so the caps are skipped on purpose
    /// (and `paid_today` is not touched), but the balance is still checked.
    pub fn approve_held(&mut self, payment_id: u64) -> Promise {
        self.assert_owner();
        let mut payment = self
            .held
            .remove(&payment_id)
            .unwrap_or_else(|| env::panic_str("ERR_NOT_HELD"));
        require!(
            payment.amount <= spendable_balance(),
            "ERR_INSUFFICIENT_FUNDS"
        );

        payment.status = PaymentStatus::Approved;
        payment.code = codes::APPROVED_BY_OWNER.to_string();
        self.counters.approved += 1;
        self.counters.total_approved += payment.amount.as_yoctonear();
        self.update_logged(&payment);
        log_event("approve", &payment);
        Promise::new(payment.to).transfer(payment.amount)
    }

    /// Rejects a held request and removes it from the queue. No money moves.
    pub fn reject_held(&mut self, payment_id: u64) {
        self.assert_owner();
        let mut payment = self
            .held
            .remove(&payment_id)
            .unwrap_or_else(|| env::panic_str("ERR_NOT_HELD"));
        payment.status = PaymentStatus::Rejected;
        payment.code = codes::REJECTED_BY_OWNER.to_string();
        self.counters.rejected += 1;
        self.update_logged(&payment);
        log_event("reject", &payment);
    }

    // ---------------------------------------------------------------- agent

    /// The only method an agent key can call. Checks run in the exact PRD 6.3 order.
    /// Rule failures return a result (never panic) so the attempt stays in the log.
    pub fn request_spend(
        &mut self,
        to: AccountId,
        amount: NearToken,
        reason: String,
    ) -> SpendResult {
        // 1. Agent keys live on the vault account, so their calls come from the vault itself.
        require!(
            env::predecessor_account_id() == env::current_account_id(),
            "ERR_NOT_VAULT_KEY"
        );

        // 2. Identify the agent by the key that signed the transaction.
        let key = env::signer_account_pk();
        let mut agent = self
            .agents
            .get(&key)
            .cloned()
            .unwrap_or_else(|| env::panic_str("ERR_UNKNOWN_AGENT_KEY"));

        let (status, code) = self.decide(&mut agent, &to, amount);
        if status == PaymentStatus::Paid {
            self.agents.insert(key.clone(), agent.clone());
            // Known behaviour (PRD 6.3, documented, not fixed): if `to` is a named account
            // that doesn't exist, the transfer fails and NEAR refunds the vault, but
            // `paid_today` stays counted. That's the safe direction.
            Promise::new(to.clone()).transfer(amount).detach();
        }

        let payment = Payment {
            id: self.next_id,
            agent_key: key,
            agent_name: agent.name,
            to,
            amount,
            reason: cut_reason(reason),
            status,
            code: code.to_string(),
            at: env::block_timestamp(),
        };
        self.record(payment)
    }

    // ---------------------------------------------------------------- views

    pub fn get_owner(&self) -> AccountId {
        self.owner.clone()
    }

    /// All agents. `paid_today` shows 0 if the stored day is not today (the
    /// stored value resets on the next spend).
    pub fn get_agents(&self) -> Vec<Agent> {
        self.agents.values().map(view_agent).collect()
    }

    pub fn get_agent(&self, public_key: PublicKey) -> Option<Agent> {
        self.agents.get(&public_key).map(view_agent)
    }

    /// Payments still in the log, oldest first. `from_index` 0 is the oldest kept entry.
    pub fn get_payments(&self, from_index: Option<u64>, limit: Option<u64>) -> Vec<Payment> {
        let first_id = self.next_id.saturating_sub(LOG_MAX);
        let start = first_id.saturating_add(from_index.unwrap_or(0));
        let end = start
            .saturating_add(limit.unwrap_or(LOG_MAX))
            .min(self.next_id);
        (start..end)
            .filter_map(|id| self.logged(id).cloned())
            .collect()
    }

    pub fn get_held(&self) -> Vec<Payment> {
        self.held.values().cloned().collect()
    }

    pub fn get_stats(&self) -> Stats {
        let c = &self.counters;
        Stats {
            paid: c.paid,
            held: c.held,
            blocked: c.blocked,
            approved: c.approved,
            rejected: c.rejected,
            held_pending: self.held.len(),
            total_paid: NearToken::from_yoctonear(c.total_paid),
            total_approved: NearToken::from_yoctonear(c.total_approved),
            vault_balance: env::account_balance(),
            total_requests: self.next_id,
        }
    }
}

impl Vault {
    fn assert_owner(&self) {
        require!(env::predecessor_account_id() == self.owner, "ERR_NOT_OWNER");
    }

    /// Checks 3 to 9 of PRD 6.3, in order. Updates `agent.paid_today` only when PAID.
    fn decide(
        &self,
        agent: &mut Agent,
        to: &AccountId,
        amount: NearToken,
    ) -> (PaymentStatus, &'static str) {
        use PaymentStatus::*;
        // 3.
        if !agent.active {
            return (Blocked, codes::BLOCKED_AGENT_INACTIVE);
        }
        // 4.
        if amount.is_zero() {
            return (Blocked, codes::BLOCKED_ZERO_AMOUNT);
        }
        // 5. Unknown recipient: hold for the owner. Held requests don't use budget.
        if !agent.allowed.contains(to) {
            if self.held.len() >= HOLD_QUEUE_MAX {
                return (Blocked, codes::BLOCKED_HOLD_QUEUE_FULL);
            }
            return (Held, codes::HELD_RECIPIENT_NOT_APPROVED);
        }
        // 6.
        if amount > agent.per_tx_cap {
            return (Blocked, codes::BLOCKED_OVER_TX_CAP);
        }
        // 7. Reset the daily counter when the UTC day changed.
        let day = today();
        if agent.day_index != day {
            agent.day_index = day;
            agent.paid_today = NearToken::from_yoctonear(0);
        }
        let new_total = agent.paid_today.saturating_add(amount);
        if new_total > agent.daily_cap {
            return (Blocked, codes::BLOCKED_OVER_DAILY_CAP);
        }
        // 8.
        if amount > spendable_balance() {
            return (Blocked, codes::BLOCKED_INSUFFICIENT_FUNDS);
        }
        // 9.
        agent.paid_today = new_total;
        (Paid, codes::OK_PAID)
    }

    /// Writes the payment to the log (and held queue), updates counters, emits the event.
    fn record(&mut self, payment: Payment) -> SpendResult {
        match payment.status {
            PaymentStatus::Paid => {
                self.counters.paid += 1;
                self.counters.total_paid += payment.amount.as_yoctonear();
            }
            PaymentStatus::Held => {
                self.counters.held += 1;
                self.held.insert(payment.id, payment.clone());
            }
            _ => self.counters.blocked += 1,
        }
        log_event("spend", &payment);

        let (retryable, next_action) = codes::hint(&payment.code);
        let result = SpendResult {
            payment_id: payment.id,
            status: payment.status.as_str().to_string(),
            code: payment.code.clone(),
            retryable,
            next_action: next_action.to_string(),
        };
        self.payments.insert(payment.id % LOG_MAX, payment);
        self.next_id += 1;
        result
    }

    fn logged(&self, id: u64) -> Option<&Payment> {
        self.payments.get(&(id % LOG_MAX)).filter(|p| p.id == id)
    }

    /// Updates a log entry's status if it's still in the ring buffer.
    fn update_logged(&mut self, payment: &Payment) {
        if self.logged(payment.id).is_some() {
            self.payments.insert(payment.id % LOG_MAX, payment.clone());
        }
    }
}

/// Current UTC day index.
fn today() -> u64 {
    env::block_timestamp() / NS_PER_DAY
}

/// Balance the vault may spend: balance - (storage used × byte cost + 0.5 NEAR buffer).
fn spendable_balance() -> NearToken {
    let storage_cost = env::storage_byte_cost().saturating_mul(env::storage_usage() as u128);
    let reserve = storage_cost.saturating_add(STORAGE_BUFFER);
    env::account_balance().saturating_sub(reserve)
}

fn view_agent(agent: &Agent) -> Agent {
    let mut a = agent.clone();
    if a.day_index != today() {
        a.paid_today = NearToken::from_yoctonear(0);
    }
    a
}

/// Cuts the reason to MAX_REASON_CHARS characters (char-safe).
fn cut_reason(reason: String) -> String {
    if reason.chars().count() <= MAX_REASON_CHARS {
        reason
    } else {
        reason.chars().take(MAX_REASON_CHARS).collect()
    }
}

/// `{"standard":"agentgate","event":"<event>","data":{...}}` (PRD 6.3).
fn log_event(event: &str, payment: &Payment) {
    let line = near_sdk::serde_json::json!({
        "standard": "agentgate",
        "event": event,
        "data": payment,
    });
    env::log_str(&line.to_string());
}
