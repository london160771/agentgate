//! Data types stored by the vault and returned by its methods (PRD 6.1 and 6.3).

use near_sdk::{near, AccountId, NearToken, PublicKey};

/// One AI agent and its spending rules. Keyed by the agent's public key.
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct Agent {
    pub name: String,
    pub public_key: PublicKey,
    pub per_tx_cap: NearToken,
    pub daily_cap: NearToken,
    pub allowed: Vec<AccountId>,
    /// UTC day of the last spend counted in `paid_today`
    /// (`block_timestamp_ns / 86_400_000_000_000`).
    pub day_index: u64,
    pub paid_today: NearToken,
    pub active: bool,
    pub created_at: u64,
}

/// Result of one decision. Serialized in JSON as "PAID", "HELD", ...
#[near(serializers = [borsh, json])]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PaymentStatus {
    Paid,
    Held,
    Blocked,
    Approved,
    Rejected,
}

impl PaymentStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            PaymentStatus::Paid => "PAID",
            PaymentStatus::Held => "HELD",
            PaymentStatus::Blocked => "BLOCKED",
            PaymentStatus::Approved => "APPROVED",
            PaymentStatus::Rejected => "REJECTED",
        }
    }
}

/// One spend attempt, as written to the log.
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct Payment {
    pub id: u64,
    pub agent_key: PublicKey,
    pub agent_name: String,
    pub to: AccountId,
    pub amount: NearToken,
    pub reason: String,
    pub status: PaymentStatus,
    pub code: String,
    pub at: u64,
}

/// What `request_spend` returns to the agent (PRD 6.3).
#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq)]
pub struct SpendResult {
    pub payment_id: u64,
    pub status: String,
    pub code: String,
    pub retryable: bool,
    pub next_action: String,
}

/// Returned by `get_stats`. Counts are for every decision since deploy,
/// not only the entries still in the 100-entry log.
#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq)]
pub struct Stats {
    pub paid: u64,
    pub held: u64,
    pub blocked: u64,
    pub approved: u64,
    pub rejected: u64,
    /// Held requests still waiting for the owner.
    pub held_pending: u32,
    /// Sum of all PAID amounts (agent payments inside the rules).
    pub total_paid: NearToken,
    /// Sum of all APPROVED amounts (owner-approved held payments).
    pub total_approved: NearToken,
    pub vault_balance: NearToken,
    /// Number of payments ever recorded (= next payment id).
    pub total_requests: u64,
}

/// Running counters kept in state for `get_stats`.
#[near(serializers = [borsh])]
#[derive(Clone, Debug, Default)]
pub struct Counters {
    pub paid: u64,
    pub held: u64,
    pub blocked: u64,
    pub approved: u64,
    pub rejected: u64,
    pub total_paid: u128,
    pub total_approved: u128,
}

/// Reason codes (PRD 6.3). Do not change these strings without Adesope.
pub mod codes {
    pub const OK_PAID: &str = "OK_PAID";
    pub const HELD_RECIPIENT_NOT_APPROVED: &str = "HELD_RECIPIENT_NOT_APPROVED";
    pub const BLOCKED_HOLD_QUEUE_FULL: &str = "BLOCKED_HOLD_QUEUE_FULL";
    pub const BLOCKED_OVER_TX_CAP: &str = "BLOCKED_OVER_TX_CAP";
    pub const BLOCKED_OVER_DAILY_CAP: &str = "BLOCKED_OVER_DAILY_CAP";
    pub const BLOCKED_INSUFFICIENT_FUNDS: &str = "BLOCKED_INSUFFICIENT_FUNDS";
    pub const BLOCKED_AGENT_INACTIVE: &str = "BLOCKED_AGENT_INACTIVE";
    pub const BLOCKED_ZERO_AMOUNT: &str = "BLOCKED_ZERO_AMOUNT";
    pub const APPROVED_BY_OWNER: &str = "APPROVED_BY_OWNER";
    pub const REJECTED_BY_OWNER: &str = "REJECTED_BY_OWNER";

    /// (retryable, next_action) for each `request_spend` code, from the PRD table.
    pub fn hint(code: &str) -> (bool, &'static str) {
        match code {
            OK_PAID => (false, "none"),
            HELD_RECIPIENT_NOT_APPROVED => (false, "owner must approve_held or reject_held"),
            BLOCKED_HOLD_QUEUE_FULL => (true, "owner must clear held queue"),
            BLOCKED_OVER_TX_CAP => (false, "split is not allowed; ask owner to raise per_tx_cap"),
            BLOCKED_OVER_DAILY_CAP => (true, "retry after 00:00 UTC"),
            BLOCKED_INSUFFICIENT_FUNDS => (true, "owner must top up vault"),
            BLOCKED_AGENT_INACTIVE => (false, "agent revoked"),
            BLOCKED_ZERO_AMOUNT => (false, "send amount > 0"),
            _ => (false, "none"),
        }
    }
}
