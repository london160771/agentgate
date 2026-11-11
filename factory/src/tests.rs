//! Factory unit tests. They run offline with a mocked chain; the real create flow
//! (account + deploy + init in one batch) is checked on testnet by the owner.

use super::*;
use near_sdk::mock::MockAction;
use near_sdk::test_utils::{get_created_receipts, get_logs, VMContextBuilder};
use near_sdk::{testing_env, PromiseResult, RuntimeFeesConfig};

fn factory() -> AccountId {
    "factory.agentgate.testnet".parse().unwrap()
}
fn alice() -> AccountId {
    "alice.testnet".parse().unwrap()
}

fn ctx(predecessor: AccountId, deposit: NearToken) {
    let c = VMContextBuilder::new()
        .current_account_id(factory())
        .predecessor_account_id(predecessor.clone())
        .signer_account_id(predecessor)
        .attached_deposit(deposit)
        .build();
    testing_env!(c);
}

/// Context for the callback, with one mocked promise result.
fn callback_ctx(result: PromiseResult) {
    let c = VMContextBuilder::new()
        .current_account_id(factory())
        .predecessor_account_id(factory())
        .build();
    testing_env!(
        c,
        near_sdk::test_vm_config(),
        RuntimeFeesConfig::test(),
        Default::default(),
        vec![result]
    );
}

#[test]
fn names() {
    for good in ["alice", "my-vault", "a1", "team_42", "x-y_z"] {
        assert!(valid_name(good), "{good} should be valid");
    }
    for bad in [
        "",
        "a",
        "Alice",
        "my.vault",
        "-alice",
        "alice-",
        "a--b",
        "a_-b",
        "has space",
        &"a".repeat(33),
    ] {
        assert!(!valid_name(bad), "{bad} should be invalid");
    }
}

#[test]
fn min_deposit_covers_code_storage_and_reserve() {
    ctx(alice(), NearToken::from_near(0));
    let code_storage = env::storage_byte_cost().saturating_mul(VAULT_CODE.len() as u128);
    assert_eq!(min_deposit(), code_storage.saturating_add(VAULT_RESERVE));
    assert!(min_deposit() > VAULT_RESERVE);
    let info = Factory::new().get_info();
    assert_eq!(info.code_bytes, VAULT_CODE.len() as u64);
    assert_eq!(info.min_deposit, min_deposit());
    assert!(!info.code_hash.is_empty());
}

#[test]
fn create_vault_builds_one_batch_without_keys() {
    ctx(alice(), NearToken::from_near(0));
    let deposit = min_deposit().saturating_add(NearToken::from_near(1));
    ctx(alice(), deposit);
    let mut f = Factory::new();
    let _ = f.create_vault("alice".into());

    let receipts = get_created_receipts();
    let vault: AccountId = "alice.factory.agentgate.testnet".parse().unwrap();
    let batch = receipts
        .iter()
        .find(|r| r.receiver_id == vault)
        .expect("batch to the new vault");
    let kinds: Vec<&str> = batch
        .actions
        .iter()
        .map(|a| match a {
            MockAction::CreateAccount { .. } => "create",
            MockAction::Transfer { .. } => "transfer",
            MockAction::DeployContract { .. } => "deploy",
            MockAction::FunctionCallWeight { .. } => "call",
            MockAction::AddKeyWithFullAccess { .. } | MockAction::AddKeyWithFunctionCall { .. } => {
                "add_key"
            }
            _ => "other",
        })
        .collect();
    assert_eq!(
        kinds,
        ["create", "transfer", "deploy", "call"],
        "no add_key: the vault is locked from birth"
    );
    let sent = batch.actions.iter().find_map(|a| match a {
        MockAction::Transfer { deposit, .. } => Some(*deposit),
        _ => None,
    });
    assert_eq!(sent, Some(deposit), "the whole deposit goes to the vault");
    let init = batch.actions.iter().find_map(|a| match a {
        MockAction::FunctionCallWeight {
            method_name, args, ..
        } => Some((
            String::from_utf8(method_name.clone()).unwrap(),
            String::from_utf8(args.clone()).unwrap(),
        )),
        _ => None,
    });
    assert_eq!(
        init,
        Some(("new".into(), r#"{"owner":"alice.testnet"}"#.into())),
        "the caller becomes the owner"
    );
    assert!(
        receipts.iter().any(|r| r.receiver_id == factory()),
        "callback to the factory"
    );
}

#[test]
#[should_panic(expected = "ERR_DEPOSIT_TOO_SMALL")]
fn create_vault_needs_min_deposit() {
    ctx(alice(), NearToken::from_near(0));
    let short = min_deposit().saturating_sub(NearToken::from_yoctonear(1));
    ctx(alice(), short);
    let _ = Factory::new().create_vault("alice".into());
}

#[test]
#[should_panic(expected = "ERR_BAD_NAME")]
fn create_vault_rejects_bad_name() {
    ctx(alice(), NearToken::from_near(0));
    ctx(alice(), min_deposit());
    let _ = Factory::new().create_vault("evil.sub".into());
}

#[test]
fn callback_success_records_the_vault() {
    ctx(alice(), NearToken::from_near(0));
    let mut f = Factory::new();
    let vault: AccountId = "alice.factory.agentgate.testnet".parse().unwrap();
    callback_ctx(PromiseResult::Successful(vec![]));
    assert!(f.on_vault_created(vault.clone(), alice(), min_deposit()));
    assert_eq!(f.get_vaults(alice()), vec![vault]);
    assert_eq!(f.get_info().vaults_created, 1);
    assert!(get_logs()[0].contains("vault_created"));
    assert!(get_created_receipts().is_empty(), "no refund on success");
}

#[test]
fn callback_failure_refunds_the_owner() {
    ctx(alice(), NearToken::from_near(0));
    let mut f = Factory::new();
    let vault: AccountId = "alice.factory.agentgate.testnet".parse().unwrap();
    callback_ctx(PromiseResult::Failed);
    let deposit = min_deposit();
    assert!(!f.on_vault_created(vault, alice(), deposit));
    assert!(f.get_vaults(alice()).is_empty());
    assert_eq!(f.get_info().vaults_created, 0);
    let refund = get_created_receipts()
        .into_iter()
        .find(|r| r.receiver_id == alice())
        .and_then(|r| {
            r.actions.into_iter().find_map(|a| match a {
                MockAction::Transfer { deposit, .. } => Some(deposit),
                _ => None,
            })
        });
    assert_eq!(refund, Some(deposit));
}

#[test]
fn owner_vault_limit() {
    ctx(alice(), NearToken::from_near(0));
    let mut f = Factory::new();
    for i in 0..MAX_VAULTS_PER_OWNER {
        callback_ctx(PromiseResult::Successful(vec![]));
        f.on_vault_created(
            format!("v{i}.factory.agentgate.testnet").parse().unwrap(),
            alice(),
            min_deposit(),
        );
    }
    ctx(alice(), min_deposit());
    let r = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let _ = f.create_vault("one-more".into());
    }));
    assert!(r.is_err(), "21st vault is refused");
}
