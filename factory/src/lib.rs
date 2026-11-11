//! AgentGate factory: one vault per user, each on its own account.
//!
//! `create_vault("alice")` creates `alice.<factory>`, sends it the attached NEAR,
//! deploys the AgentGate vault code and calls `new(owner = caller)`. All of that is
//! one batch: if any step fails, nothing is created and the deposit goes back.
//!
//! The new vault account gets **no access key at all**, so it is locked from birth:
//! nobody (not even the owner or the factory) can sign a transfer from it. Money
//! only leaves through the vault's own rules. The vault code is exactly the
//! contract in `contract/`, built into `res/agentgate_vault.wasm` by `build-vault.sh`.

use near_sdk::serde_json::json;
use near_sdk::store::LookupMap;
use near_sdk::{env, near, require, AccountId, Gas, NearToken, PanicOnDefault, Promise};

#[cfg(test)]
mod tests;

/// The vault contract every user gets (built from `contract/`).
pub const VAULT_CODE: &[u8] = include_bytes!("../res/agentgate_vault.wasm");
/// NEAR kept on top of the code's storage: the vault's own 0.5 NEAR safety buffer
/// (`STORAGE_BUFFER` in the vault) plus room for its first agents and log entries.
pub const VAULT_RESERVE: NearToken = NearToken::from_millinear(700);
/// Gas for the vault's `new` call inside the create batch.
pub const GAS_VAULT_INIT: Gas = Gas::from_tgas(20);
/// Gas reserved for `on_vault_created`.
pub const GAS_CALLBACK: Gas = Gas::from_tgas(15);
/// Max vaults one account can create (keeps the owner list small).
pub const MAX_VAULTS_PER_OWNER: usize = 20;
/// Vault name length limits (the part before `.<factory>`).
pub const NAME_MIN: usize = 2;
pub const NAME_MAX: usize = 32;

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Factory {
    /// Owner → the vault accounts they created through this factory.
    vaults: LookupMap<AccountId, Vec<AccountId>>,
    count: u64,
}

/// What the dashboard needs to show before a user creates a vault.
#[near(serializers = [json])]
pub struct FactoryInfo {
    /// Minimum deposit for `create_vault`. Anything above it becomes spendable vault balance.
    pub min_deposit: NearToken,
    /// Size of the vault code in bytes.
    pub code_bytes: u64,
    /// sha256 of the vault code, base58 (compare with the vault account's `code_hash`).
    pub code_hash: String,
    pub vaults_created: u64,
}

#[near]
impl Factory {
    #[init]
    pub fn new() -> Self {
        Self {
            vaults: LookupMap::new(b"v"),
            count: 0,
        }
    }

    /// Creates `<name>.<factory>` with the caller as owner. Attach at least `min_deposit`.
    #[payable]
    pub fn create_vault(&mut self, name: String) -> Promise {
        let owner = env::predecessor_account_id();
        let deposit = env::attached_deposit();
        require!(deposit >= min_deposit(), "ERR_DEPOSIT_TOO_SMALL");
        require!(valid_name(&name), "ERR_BAD_NAME");
        let mine = self.vaults.get(&owner).map_or(0, Vec::len);
        require!(mine < MAX_VAULTS_PER_OWNER, "ERR_TOO_MANY_VAULTS");
        let vault_id: AccountId = format!("{name}.{}", env::current_account_id())
            .parse()
            .unwrap_or_else(|_| env::panic_str("ERR_BAD_NAME"));

        // One batch on the new account: create, fund, deploy, init. No add_key, so the
        // vault never has a full-access key.
        Promise::new(vault_id.clone())
            .create_account()
            .transfer(deposit)
            .deploy_contract(VAULT_CODE.to_vec())
            .function_call(
                "new".to_string(),
                json!({ "owner": owner }).to_string().into_bytes(),
                NearToken::from_yoctonear(0),
                GAS_VAULT_INIT,
            )
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_CALLBACK)
                    .on_vault_created(vault_id, owner, deposit),
            )
    }

    /// Records the vault if the batch worked. If it failed (name taken, out of gas),
    /// NEAR refunds the deposit to the factory and the factory sends it back to the owner.
    #[private]
    pub fn on_vault_created(
        &mut self,
        vault_id: AccountId,
        owner: AccountId,
        deposit: NearToken,
    ) -> bool {
        if near_sdk::is_promise_success() {
            let mut list = self.vaults.get(&owner).cloned().unwrap_or_default();
            list.push(vault_id.clone());
            self.vaults.insert(owner.clone(), list);
            self.count += 1;
            env::log_str(&json!({ "standard": "agentgate", "event": "vault_created", "data": { "vault": vault_id, "owner": owner } }).to_string());
            true
        } else {
            Promise::new(owner).transfer(deposit).detach();
            false
        }
    }

    // ---------------------------------------------------------------- views

    pub fn get_vaults(&self, owner: AccountId) -> Vec<AccountId> {
        self.vaults.get(&owner).cloned().unwrap_or_default()
    }

    pub fn get_info(&self) -> FactoryInfo {
        FactoryInfo {
            min_deposit: min_deposit(),
            code_bytes: VAULT_CODE.len() as u64,
            code_hash: near_sdk::bs58::encode(env::sha256(VAULT_CODE)).into_string(),
            vaults_created: self.count,
        }
    }
}

/// Storage for the vault code plus the reserve.
pub fn min_deposit() -> NearToken {
    env::storage_byte_cost()
        .saturating_mul(VAULT_CODE.len() as u128)
        .saturating_add(VAULT_RESERVE)
}

/// Lowercase letters, digits, `-` and `_`; starts and ends with a letter or digit;
/// no two separators in a row; 2 to 32 characters. No dots, so a user can only
/// create a direct sub-account of the factory.
pub fn valid_name(name: &str) -> bool {
    let b = name.as_bytes();
    let ok_len = (NAME_MIN..=NAME_MAX).contains(&b.len());
    let alnum = |c: u8| c.is_ascii_lowercase() || c.is_ascii_digit();
    let sep = |c: u8| c == b'-' || c == b'_';
    ok_len
        && alnum(b[0])
        && alnum(b[b.len() - 1])
        && b.iter().all(|&c| alnum(c) || sep(c))
        && !b.windows(2).any(|w| sep(w[0]) && sep(w[1]))
}
