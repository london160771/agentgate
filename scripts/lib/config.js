// config/seed.json helpers (pure, shared by scripts and web).
// config/seed.json is the single source for accounts, caps and amounts (PRD 5).

import { nearToYocto } from './format.js';

const PLACEHOLDER = /^<.*>$/;
const ACCOUNT_ID = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;

export function isPlaceholder(value) {
  return typeof value !== 'string' || PLACEHOLDER.test(value.trim()) || value.includes('<');
}

export function isAccountId(value) {
  return typeof value === 'string' && value.length >= 2 && value.length <= 64 && ACCOUNT_ID.test(value);
}

/**
 * Replaces "<owner>.testnet" in vault and recipient ids with ownerAccountId,
 * so Adesope only fills ownerAccountId. If the owner is not set yet, the
 * placeholders stay (fine for --dry-run).
 */
export function resolveConfig(raw) {
  const cfg = structuredClone(raw);
  const owner = cfg.ownerAccountId;
  const fill = (id) => (isPlaceholder(owner) ? id : String(id).replace(`<owner>.${cfg.network}`, owner));
  cfg.vaultAccountId = fill(cfg.vaultAccountId);
  cfg.recipients = Object.fromEntries(Object.entries(cfg.recipients || {}).map(([k, v]) => [k, fill(v)]));
  return cfg;
}

/** Rules for one agent from the config, in yocto (strings for JSON args). */
export function agentRules(cfg, agentKey = 'apiBuyer') {
  const a = cfg.agents?.[agentKey];
  if (!a) throw new Error(`Agent "${agentKey}" not in config`);
  // old-bot has no rules of its own; it uses api-buyer's (it is revoked right after seeding).
  const rules = a.perTxCapNear ? a : cfg.agents.apiBuyer;
  return {
    name: a.name,
    perTxCap: nearToYocto(rules.perTxCapNear).toString(),
    dailyCap: nearToYocto(rules.dailyCapNear).toString(),
    allowed: rules.allowed.map((r) => cfg.recipients[r]),
    allowance: nearToYocto(rules.keyAllowanceNear).toString(),
  };
}

/**
 * Returns a list of problems (empty = OK).
 * stage: 'template' (structure only), 'owner' (ownerAccountId must be set),
 *        'seeded' (demo keys must be filled too).
 */
export function validateConfig(raw, stage = 'template') {
  const errors = [];
  const need = (cond, msg) => {
    if (!cond) errors.push(msg);
  };

  need(raw && typeof raw === 'object', 'config must be an object');
  if (!raw || typeof raw !== 'object') return errors;

  need(raw.network === 'testnet', 'network must be "testnet" (PRD: testnet only)');
  need(raw.recipients && typeof raw.recipients === 'object', 'recipients missing');
  for (const r of ['apiProvider', 'dataProvider', 'hacker']) need(raw.recipients?.[r], `recipients.${r} missing`);

  const buyer = raw.agents?.apiBuyer;
  need(buyer, 'agents.apiBuyer missing');
  need(raw.agents?.oldBot?.name, 'agents.oldBot.name missing');
  if (buyer) {
    for (const f of ['perTxCapNear', 'dailyCapNear', 'keyAllowanceNear']) {
      try {
        need(nearToYocto(buyer[f]) > 0n, `agents.apiBuyer.${f} must be > 0`);
      } catch (e) {
        errors.push(`agents.apiBuyer.${f}: ${e.message}`);
      }
    }
    need(Array.isArray(buyer.allowed) && buyer.allowed.length > 0, 'agents.apiBuyer.allowed must be a non-empty list');
    need((buyer.allowed?.length || 0) <= 10, 'agents.apiBuyer.allowed: max 10 recipients');
    for (const r of buyer.allowed || []) need(raw.recipients?.[r], `agents.apiBuyer.allowed: unknown recipient "${r}"`);
    need(!(buyer.allowed || []).includes('hacker'), 'agents.apiBuyer.allowed must not include hacker');
  }
  try {
    need(nearToYocto(raw.vaultFundingNear) > 0n, 'vaultFundingNear must be > 0');
  } catch (e) {
    errors.push(`vaultFundingNear: ${e.message}`);
  }
  need(Number.isInteger(raw.holdQueueMax) && raw.holdQueueMax > 0, 'holdQueueMax must be a positive integer');
  need(Number.isInteger(raw.logMax) && raw.logMax > 0, 'logMax must be a positive integer');

  if (stage === 'owner' || stage === 'seeded') {
    need(!isPlaceholder(raw.ownerAccountId), 'ownerAccountId is not set in config/seed.json');
    if (!isPlaceholder(raw.ownerAccountId)) {
      need(isAccountId(raw.ownerAccountId), `ownerAccountId "${raw.ownerAccountId}" is not a valid account id`);
      need(raw.ownerAccountId.endsWith('.testnet'), 'ownerAccountId must end with .testnet');
      const cfg = resolveConfig(raw);
      for (const [name, id] of [['vaultAccountId', cfg.vaultAccountId], ...Object.entries(cfg.recipients || {})]) {
        need(isAccountId(id), `${name} "${id}" is not a valid account id`);
        need(String(id).endsWith(`.${raw.ownerAccountId}`), `${name} "${id}" must be a sub-account of the owner`);
      }
    }
  }
  if (stage === 'seeded') {
    for (const k of ['apiBuyerPublicKey', 'apiBuyerPrivateKey', 'oldBotPublicKey', 'oldBotPrivateKey']) {
      need(!isPlaceholder(raw.demoKeys?.[k]), `demoKeys.${k} is not filled (run node scripts/seed.js)`);
    }
  }
  return errors;
}

/** Throws with all problems listed. */
export function assertConfig(raw, stage) {
  const errors = validateConfig(raw, stage);
  if (errors.length) throw new Error(`config/seed.json is not ready:\n  - ${errors.join('\n  - ')}`);
}
