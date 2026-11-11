# Setup accounts (Adesope, local machine)

Docs only. These steps create the testnet accounts AgentGate uses. Every key is
saved to the **legacy keychain** (`~/.near-credentials/testnet/`), which is where
`scripts/deploy.sh` and the Node scripts look for the owner's and the vault's
full-access keys. Those keys never go into the repo.

Below, replace `OWNER` with your owner account name, e.g. `agentgate-ade` (so the
owner is `agentgate-ade.testnet`).

## 0. Install the tools

```bash
# near-cli-rs (the `near` command)
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/near/near-cli-rs/releases/latest/download/near-cli-rs-installer.sh | sh
# cargo-near (builds the contract)
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/near/cargo-near/releases/latest/download/cargo-near-installer.sh | sh
# Rust wasm target
rustup target add wasm32-unknown-unknown
# Node 22.22+ (near-api-js 7 needs it), then:
cd scripts && npm install && cd ..
```

If you prefer `cargo install --locked cargo-near`: on Linux it needs `libudev-dev`
and `pkg-config` first (`sudo apt install libudev-dev pkg-config`).

## 1. Create the owner (faucet-sponsored)

```bash
near account create-account sponsor-by-faucet-service OWNER.testnet \
  autogenerate-new-keypair save-to-legacy-keychain network-config testnet create
```

Check the balance:

```bash
near account view-account-summary OWNER.testnet network-config testnet now
```

You need about **9 NEAR** in total: 3 for the vault account (contract storage),
0.3 for the three recipients, 5 that `seed.js` sends to the vault
(`vaultFundingNear` in `config/seed.json`), plus gas. If the faucet gave less,
top up at https://near-faucet.io before step 4 of the Manual Stop.

## 2. Create the four sub-accounts

The vault holds the contract, so it needs NEAR for storage:

```bash
near account create-account fund-myself vault.OWNER.testnet '3 NEAR' \
  autogenerate-new-keypair save-to-legacy-keychain \
  sign-as OWNER.testnet network-config testnet sign-with-legacy-keychain send
```

The three recipients only receive payments (all are your own accounts, including `hacker`):

```bash
for NAME in api-provider data-provider hacker; do
  near account create-account fund-myself $NAME.OWNER.testnet '0.1 NEAR' \
    autogenerate-new-keypair save-to-legacy-keychain \
    sign-as OWNER.testnet network-config testnet sign-with-legacy-keychain send
done
```

## 3. Fill the config

In `config/seed.json` set only:

```json
"ownerAccountId": "OWNER.testnet"
```

The scripts turn `vault.<owner>.testnet` and the recipient ids into
`vault.OWNER.testnet` etc. Check with:

```bash
node scripts/seed.js --dry-run
```

## 4. Check the keys are where the scripts look

```bash
ls ~/.near-credentials/testnet/
# expect OWNER.testnet.json and vault.OWNER.testnet.json (or folders with those names)
```

Never `git add` anything from `~/.near-credentials`.

Next: `bash scripts/deploy.sh` (see the Manual Stop A checklist in PROJECT_STATE.md).
