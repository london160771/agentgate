//! Unit tests (PRD 6.4). These run offline on the native target with a mocked
//! blockchain. Real proof of the key permissions comes from Gate 0 on testnet.

use super::*;
use near_sdk::mock::MockAction;
use near_sdk::test_utils::{get_created_receipts, get_logs, VMContextBuilder};
use near_sdk::{testing_env, CurveType};

const DAY: u64 = NS_PER_DAY;
const START: u64 = 1_700_000_000_000_000_000; // some time in Nov 2023, ns

fn vault() -> AccountId {
    "vault.owner.testnet".parse().unwrap()
}
fn owner() -> AccountId {
    "owner.testnet".parse().unwrap()
}
fn api() -> AccountId {
    "api-provider.owner.testnet".parse().unwrap()
}
fn data() -> AccountId {
    "data-provider.owner.testnet".parse().unwrap()
}
fn hacker() -> AccountId {
    "hacker.owner.testnet".parse().unwrap()
}
fn key(n: u8) -> PublicKey {
    PublicKey::from_parts(CurveType::ED25519, vec![n; 32]).unwrap()
}
fn near(milli: u128) -> NearToken {
    NearToken::from_millinear(milli)
}

/// Test rules. Mocks of the seed values; the real ones live in config/seed.json.
const PER_TX: u128 = 500; // 0.5 NEAR in millinear
const DAILY: u128 = 600; // 0.6 NEAR

/// Sets the mocked chain context. Storage carries over between calls.
fn set_ctx(predecessor: AccountId, signer_pk: PublicKey, ts: u64) {
    let ctx = VMContextBuilder::new()
        .current_account_id(vault())
        .signer_account_id(predecessor.clone())
        .predecessor_account_id(predecessor)
        .signer_account_pk(signer_pk)
        .block_timestamp(ts)
        .account_balance(NearToken::from_near(1_000))
        .build();
    testing_env!(ctx);
}
fn as_owner(ts: u64) {
    set_ctx(owner(), key(200), ts);
}
fn as_agent(k: u8, ts: u64) {
    set_ctx(vault(), key(k), ts);
}

/// A vault with one agent (key 1) allowed to pay api + data.
fn setup() -> Vault {
    as_owner(START);
    let mut v = Vault::new(owner());
    v.add_agent(
        key(1),
        "api-buyer".into(),
        near(PER_TX),
        near(DAILY),
        vec![api(), data()],
        near(250),
    )
    .detach();
    v
}

fn spend(v: &mut Vault, to: AccountId, milli: u128) -> SpendResult {
    v.request_spend(to, near(milli), "test".into())
}

// ------------------------------------------------------------ owner-only

#[test]
#[should_panic(expected = "ERR_NOT_OWNER")]
fn add_agent_rejects_non_owner() {
    let mut v = setup();
    set_ctx(hacker(), key(9), START);
    v.add_agent(key(2), "x".into(), near(1), near(1), vec![], near(1))
        .detach();
}

#[test]
#[should_panic(expected = "ERR_NOT_OWNER")]
fn update_rules_rejects_non_owner() {
    let mut v = setup();
    as_agent(1, START); // even the vault account itself is not the owner
    v.update_rules(key(1), near(10_000), near(10_000), vec![hacker()]);
}

#[test]
#[should_panic(expected = "ERR_NOT_OWNER")]
fn revoke_rejects_non_owner() {
    let mut v = setup();
    set_ctx(hacker(), key(9), START);
    v.revoke_agent(key(1)).detach();
}

#[test]
#[should_panic(expected = "ERR_NOT_OWNER")]
fn approve_held_rejects_non_owner() {
    let mut v = setup();
    as_agent(1, START);
    let r = spend(&mut v, hacker(), 100);
    v.approve_held(r.payment_id).detach();
}

#[test]
#[should_panic(expected = "ERR_NOT_OWNER")]
fn reject_held_rejects_non_owner() {
    let mut v = setup();
    as_agent(1, START);
    let r = spend(&mut v, hacker(), 100);
    v.reject_held(r.payment_id);
}

// ------------------------------------------------------------ add_agent

#[test]
fn add_agent_stores_agent_and_mints_function_call_key() {
    let v = setup();
    let a = v.get_agent(key(1)).unwrap();
    assert_eq!(a.name, "api-buyer");
    assert_eq!(a.per_tx_cap, near(PER_TX));
    assert_eq!(a.daily_cap, near(DAILY));
    assert_eq!(a.allowed, vec![api(), data()]);
    assert!(a.active);
    assert_eq!(a.created_at, START);
    assert_eq!(v.get_agents().len(), 1);

    let receipts = get_created_receipts();
    assert_eq!(receipts.len(), 1);
    assert_eq!(receipts[0].receiver_id, vault());
    match &receipts[0].actions[0] {
        MockAction::AddKeyWithFunctionCall {
            allowance,
            receiver_id,
            method_names,
            ..
        } => {
            assert_eq!(*allowance, Some(near(250)));
            assert_eq!(*receiver_id, vault());
            assert_eq!(method_names, &vec!["request_spend".to_string()]);
        }
        other => panic!("expected AddKeyWithFunctionCall, got {other:?}"),
    }
}

#[test]
#[should_panic(expected = "ERR_AGENT_EXISTS")]
fn add_agent_duplicate_key_fails() {
    let mut v = setup();
    as_owner(START);
    v.add_agent(key(1), "again".into(), near(1), near(1), vec![], near(1))
        .detach();
}

#[test]
#[should_panic(expected = "ERR_TOO_MANY_RECIPIENTS")]
fn add_agent_rejects_more_than_10_recipients() {
    let mut v = setup();
    as_owner(START);
    let many: Vec<AccountId> = (0..11)
        .map(|i| format!("r{i}.testnet").parse().unwrap())
        .collect();
    v.add_agent(key(2), "x".into(), near(1), near(1), many, near(1))
        .detach();
}

#[test]
fn update_rules_changes_rules() {
    let mut v = setup();
    as_owner(START);
    v.update_rules(key(1), near(100), near(200), vec![api()]);
    let a = v.get_agent(key(1)).unwrap();
    assert_eq!(
        (a.per_tx_cap, a.daily_cap, a.allowed),
        (near(100), near(200), vec![api()])
    );
}

// ------------------------------------------------------------ check order + codes

#[test]
#[should_panic(expected = "ERR_NOT_VAULT_KEY")]
fn check1_outside_caller_panics() {
    let mut v = setup();
    set_ctx(hacker(), key(1), START); // even with the agent's key, a different account is refused
    spend(&mut v, api(), 10);
}

#[test]
#[should_panic(expected = "ERR_UNKNOWN_AGENT_KEY")]
fn check2_unknown_key_panics() {
    let mut v = setup();
    as_agent(77, START); // e.g. the vault's own full-access key
    spend(&mut v, api(), 10);
}

#[test]
fn ok_paid_transfers_and_counts_budget() {
    let mut v = setup();
    as_agent(1, START);
    let r = spend(&mut v, api(), 10);
    assert_eq!(r.status, "PAID");
    assert_eq!(r.code, "OK_PAID");
    assert!(!r.retryable);
    assert_eq!(r.next_action, "none");
    assert_eq!(v.get_agent(key(1)).unwrap().paid_today, near(10));

    let receipts = get_created_receipts();
    assert_eq!(receipts.len(), 1);
    assert_eq!(receipts[0].receiver_id, api());
    assert!(
        matches!(receipts[0].actions[0], MockAction::Transfer { deposit, .. } if deposit == near(10))
    );
}

#[test]
fn check3_inactive_agent_blocked_before_other_checks() {
    let mut v = setup();
    as_owner(START);
    v.revoke_agent(key(1)).detach();
    as_agent(1, START); // in a unit test the key still "exists"
                        // zero amount + unknown recipient would also fail, but inactive comes first
    let r = spend(&mut v, hacker(), 0);
    assert_eq!(
        (r.status.as_str(), r.code.as_str()),
        ("BLOCKED", "BLOCKED_AGENT_INACTIVE")
    );
    assert!(!r.retryable);
    assert_eq!(r.next_action, "agent revoked");
}

#[test]
fn check4_zero_amount_before_recipient_check() {
    let mut v = setup();
    as_agent(1, START);
    let r = spend(&mut v, hacker(), 0);
    assert_eq!(r.code, "BLOCKED_ZERO_AMOUNT");
    assert_eq!(r.next_action, "send amount > 0");
}

#[test]
fn check5_unknown_recipient_over_cap_is_held_not_blocked() {
    let mut v = setup();
    as_agent(1, START);
    let r = spend(&mut v, hacker(), 5_000); // 5 NEAR: over per-tx cap too
    assert_eq!(
        (r.status.as_str(), r.code.as_str()),
        ("HELD", "HELD_RECIPIENT_NOT_APPROVED")
    );
    assert!(!r.retryable);
    assert_eq!(r.next_action, "owner must approve_held or reject_held");
    assert_eq!(v.get_held().len(), 1);
    assert!(
        get_created_receipts().is_empty(),
        "held must not move money"
    );
}

#[test]
fn check6_over_tx_cap() {
    let mut v = setup();
    as_agent(1, START);
    let r = spend(&mut v, api(), 1_000);
    assert_eq!(r.code, "BLOCKED_OVER_TX_CAP");
    assert!(!r.retryable);
    assert_eq!(
        r.next_action,
        "split is not allowed; ask owner to raise per_tx_cap"
    );
}

#[test]
fn check6_tx_cap_before_daily_cap() {
    let mut v = setup();
    as_agent(1, START);
    assert_eq!(spend(&mut v, api(), 500).code, "OK_PAID");
    // 0.6 > per-tx 0.5 and would also break the daily cap; tx cap is checked first
    assert_eq!(spend(&mut v, api(), 600).code, "BLOCKED_OVER_TX_CAP");
}

#[test]
fn check7_over_daily_cap() {
    let mut v = setup();
    as_agent(1, START);
    assert_eq!(spend(&mut v, data(), 500).code, "OK_PAID");
    let r = spend(&mut v, data(), 500);
    assert_eq!(r.code, "BLOCKED_OVER_DAILY_CAP");
    assert!(r.retryable);
    assert_eq!(r.next_action, "retry after 00:00 UTC");
    assert_eq!(spend(&mut v, data(), 100).code, "OK_PAID"); // exactly reaches 0.6
    assert_eq!(spend(&mut v, data(), 1).code, "BLOCKED_OVER_DAILY_CAP");
    assert_eq!(v.get_agent(key(1)).unwrap().paid_today, near(600));
}

#[test]
fn check8_insufficient_funds_keeps_storage_reserve() {
    let mut v = setup();
    // balance = storage cost + 0.5 buffer + 0.1 NEAR spendable
    let storage = env::storage_byte_cost().saturating_mul(env::storage_usage() as u128);
    let balance = storage
        .saturating_add(STORAGE_BUFFER)
        .saturating_add(near(100));
    let ctx = VMContextBuilder::new()
        .current_account_id(vault())
        .predecessor_account_id(vault())
        .signer_account_pk(key(1))
        .block_timestamp(START)
        .account_balance(balance)
        .storage_usage(env::storage_usage())
        .build();
    testing_env!(ctx);
    let r = spend(&mut v, api(), 200);
    assert_eq!(r.code, "BLOCKED_INSUFFICIENT_FUNDS");
    assert!(r.retryable);
    assert_eq!(r.next_action, "owner must top up vault");
    assert_eq!(
        v.get_agent(key(1)).unwrap().paid_today,
        near(0),
        "blocked spend must not use budget"
    );
}

// ------------------------------------------------------------ held queue

#[test]
fn held_requests_do_not_use_budget() {
    let mut v = setup();
    as_agent(1, START);
    for _ in 0..3 {
        assert_eq!(spend(&mut v, hacker(), 500).status, "HELD");
    }
    assert_eq!(v.get_agent(key(1)).unwrap().paid_today, near(0));
    assert_eq!(spend(&mut v, api(), 500).code, "OK_PAID");
}

#[test]
fn approve_held_pays_and_changes_status() {
    let mut v = setup();
    as_agent(1, START);
    let r = spend(&mut v, hacker(), 2_000); // over both caps: owner approval skips caps
    as_owner(START);
    v.approve_held(r.payment_id).detach();

    assert!(v.get_held().is_empty());
    let p = &v.get_payments(None, None)[0];
    assert_eq!(p.status, PaymentStatus::Approved);
    assert_eq!(p.code, "APPROVED_BY_OWNER");
    let receipts = get_created_receipts();
    assert_eq!(receipts[0].receiver_id, hacker());
    assert!(
        matches!(receipts[0].actions[0], MockAction::Transfer { deposit, .. } if deposit == near(2_000))
    );
    let s = v.get_stats();
    assert_eq!((s.approved, s.total_approved), (1, near(2_000)));
    assert_eq!(
        v.get_agent(key(1)).unwrap().paid_today,
        near(0),
        "approval does not touch paid_today"
    );
}

#[test]
#[should_panic(expected = "ERR_INSUFFICIENT_FUNDS")]
fn approve_held_still_checks_balance() {
    let mut v = setup();
    as_agent(1, START);
    let r = spend(&mut v, hacker(), 5_000); // 5 NEAR held
                                            // Leave only 1 NEAR in the vault.
    let ctx = VMContextBuilder::new()
        .current_account_id(vault())
        .predecessor_account_id(owner())
        .block_timestamp(START)
        .account_balance(NearToken::from_near(1))
        .build();
    testing_env!(ctx);
    v.approve_held(r.payment_id).detach();
}

#[test]
fn reject_held_removes_it() {
    let mut v = setup();
    as_agent(1, START);
    let r = spend(&mut v, hacker(), 100);
    as_owner(START);
    v.reject_held(r.payment_id);
    assert!(v.get_held().is_empty());
    assert_eq!(
        v.get_payments(None, None)[0].status,
        PaymentStatus::Rejected
    );
    assert!(get_created_receipts().is_empty());
    assert_eq!(v.get_stats().rejected, 1);
}

#[test]
#[should_panic(expected = "ERR_NOT_HELD")]
fn reject_unknown_held_fails() {
    let mut v = setup();
    as_owner(START);
    v.reject_held(42);
}

#[test]
fn hold_queue_cap_21st_is_blocked() {
    let mut v = setup();
    as_agent(1, START);
    for i in 0..HOLD_QUEUE_MAX {
        assert_eq!(
            spend(&mut v, hacker(), 100).code,
            "HELD_RECIPIENT_NOT_APPROVED",
            "request {i}"
        );
    }
    let r = spend(&mut v, hacker(), 100);
    assert_eq!(
        (r.status.as_str(), r.code.as_str()),
        ("BLOCKED", "BLOCKED_HOLD_QUEUE_FULL")
    );
    assert!(r.retryable);
    assert_eq!(r.next_action, "owner must clear held queue");
    assert_eq!(v.get_held().len(), HOLD_QUEUE_MAX as usize);

    // Owner clears one; the next held request fits again.
    as_owner(START);
    v.reject_held(0);
    as_agent(1, START);
    assert_eq!(
        spend(&mut v, hacker(), 100).code,
        "HELD_RECIPIENT_NOT_APPROVED"
    );
}

// ------------------------------------------------------------ daily reset, revoke, log

#[test]
fn daily_reset_next_utc_day() {
    let mut v = setup();
    as_agent(1, START);
    assert_eq!(spend(&mut v, api(), 500).code, "OK_PAID");
    assert_eq!(spend(&mut v, api(), 500).code, "BLOCKED_OVER_DAILY_CAP");
    as_agent(1, START + DAY);
    assert_eq!(
        v.get_agent(key(1)).unwrap().paid_today,
        near(0),
        "view shows the new day"
    );
    assert_eq!(spend(&mut v, api(), 500).code, "OK_PAID");
    let a = v.get_agent(key(1)).unwrap();
    assert_eq!(a.paid_today, near(500));
    assert_eq!(a.day_index, (START + DAY) / NS_PER_DAY);
}

#[test]
fn revoke_deletes_key_and_blocks_agent() {
    let mut v = setup();
    as_owner(START);
    v.revoke_agent(key(1)).detach();
    let receipts = get_created_receipts();
    assert_eq!(receipts[0].receiver_id, vault());
    assert!(matches!(
        receipts[0].actions[0],
        MockAction::DeleteKey { .. }
    ));
    assert!(!v.get_agent(key(1)).unwrap().active);

    as_agent(1, START);
    assert_eq!(spend(&mut v, api(), 10).code, "BLOCKED_AGENT_INACTIVE");
}

#[test]
#[should_panic(expected = "ERR_ALREADY_REVOKED")]
fn revoke_twice_fails() {
    let mut v = setup();
    as_owner(START);
    v.revoke_agent(key(1)).detach();
    v.revoke_agent(key(1)).detach();
}

#[test]
fn ring_buffer_keeps_last_100() {
    let mut v = setup();
    as_agent(1, START);
    for _ in 0..(LOG_MAX + 30) {
        as_agent(1, START); // one context per transaction (log size limit is per call)
        spend(&mut v, api(), 0); // BLOCKED_ZERO_AMOUNT, cheap to log
    }
    let all = v.get_payments(None, Some(1_000));
    assert_eq!(all.len() as u64, LOG_MAX);
    assert_eq!(all.first().unwrap().id, 30);
    assert_eq!(all.last().unwrap().id, LOG_MAX + 29);
    let page = v.get_payments(Some(10), Some(5));
    assert_eq!(
        page.iter().map(|p| p.id).collect::<Vec<_>>(),
        vec![40, 41, 42, 43, 44]
    );
    assert_eq!(v.get_stats().total_requests, LOG_MAX + 30);
    assert_eq!(v.get_stats().blocked, LOG_MAX + 30);
}

#[test]
fn reason_is_cut_to_140_chars() {
    let mut v = setup();
    as_agent(1, START);
    v.request_spend(api(), near(1), "é".repeat(300));
    assert_eq!(
        v.get_payments(None, None)[0].reason.chars().count(),
        MAX_REASON_CHARS
    );
}

#[test]
fn every_spend_logs_a_json_event() {
    let mut v = setup();
    as_agent(1, START);
    spend(&mut v, hacker(), 100);
    let logs = get_logs();
    assert_eq!(logs.len(), 1);
    let ev: near_sdk::serde_json::Value = near_sdk::serde_json::from_str(&logs[0]).unwrap();
    assert_eq!(ev["standard"], "agentgate");
    assert_eq!(ev["event"], "spend");
    assert_eq!(ev["data"]["code"], "HELD_RECIPIENT_NOT_APPROVED");
    assert_eq!(ev["data"]["status"], "HELD");
}

#[test]
fn stats_count_by_status() {
    let mut v = setup();
    as_agent(1, START);
    spend(&mut v, api(), 100); // paid
    spend(&mut v, api(), 200); // paid
    spend(&mut v, hacker(), 100); // held
    spend(&mut v, api(), 900); // blocked
    let s = v.get_stats();
    assert_eq!((s.paid, s.held, s.blocked, s.held_pending), (2, 1, 1, 1));
    assert_eq!(s.total_paid, near(300));
    // the mocked chain takes transfers out of the balance, like the real one
    assert_eq!(
        s.vault_balance,
        NearToken::from_near(1_000).saturating_sub(near(300))
    );
    assert_eq!(v.get_owner(), owner());
}

// ------------------------------------------------------------ invariant

/// Tiny deterministic PRNG (xorshift64) so the property test needs no extra crate.
struct Rng(u64);
impl Rng {
    fn next(&mut self) -> u64 {
        let mut x = self.0;
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        self.0 = x;
        x
    }
    fn below(&mut self, n: u64) -> u64 {
        self.next() % n
    }
}

#[test]
fn invariant_holds_for_500_random_requests() {
    let mut v = setup();
    let allowed = [api(), data()];
    let recipients = [api(), data(), hacker(), "random.testnet".parse().unwrap()];
    let mut rng = Rng(0x5EED_A6E7_6A7E_0001);
    let mut ts = START;
    // (day, amount, to) for every PAID result
    let mut paid: Vec<(u64, NearToken, AccountId)> = Vec::new();
    let mut seen_codes = std::collections::BTreeSet::new();

    for _ in 0..500 {
        // ~10% of requests jump forward 0.3–2 days
        if rng.below(10) == 0 {
            ts += DAY / 3 + rng.below(DAY + DAY / 2);
        } else {
            ts += rng.below(60) * 1_000_000_000;
        }
        // Sometimes the owner clears the held queue so HELD keeps happening.
        if rng.below(15) == 0 {
            as_owner(ts);
            for p in v.get_held() {
                v.reject_held(p.id);
            }
        }
        as_agent(1, ts);
        let to = recipients[rng.below(recipients.len() as u64) as usize].clone();
        let amount = NearToken::from_yoctonear(rng.below(800) as u128 * 10u128.pow(21)); // 0–0.799 NEAR
        let r = v.request_spend(to.clone(), amount, "fuzz".into());
        seen_codes.insert(r.code.clone());
        if r.status == "PAID" {
            paid.push((ts / NS_PER_DAY, amount, to));
        }
    }

    let mut per_day: std::collections::BTreeMap<u64, u128> = Default::default();
    for (day, amount, to) in &paid {
        assert!(*amount <= near(PER_TX), "PAID over per_tx_cap");
        assert!(allowed.contains(to), "PAID to a recipient not in allowed");
        *per_day.entry(*day).or_default() += amount.as_yoctonear();
    }
    for (day, total) in &per_day {
        assert!(
            *total <= near(DAILY).as_yoctonear(),
            "day {day}: paid {total} over daily cap"
        );
    }
    // Make sure the random run really exercised the rules.
    assert!(paid.len() > 10, "too few PAID: {}", paid.len());
    for code in [
        "OK_PAID",
        "HELD_RECIPIENT_NOT_APPROVED",
        "BLOCKED_OVER_TX_CAP",
        "BLOCKED_OVER_DAILY_CAP",
    ] {
        assert!(
            seen_codes.contains(code),
            "random run never produced {code}"
        );
    }
}
