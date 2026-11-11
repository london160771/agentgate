// Shared result classifier (PRD 7). Used by scripts and by the web Attack Lab.
// Maps a vault SpendResult or an RPC error to one of:
//   PAID | HELD | BLOCKED (with the vault's reason code)
//   REFUSED_BY_NEAR (METHOD_NOT_ALLOWED | TRANSFER_NOT_ALLOWED | KEY_NOT_FOUND)
//   ERROR (raw message, never hidden)
//
// near-api-js 7.x error class names this matches (rpc-errors):
//   AccessKeyMethodNameMismatchActionError    "Access key does not allow method X"
//   AccessKeyRequiresFullAccessActionError    "Access key requires full access"
//   AccessKeyDepositWithFunctionCallActionError "Deposit is not allowed with function call"
//   AccessKeyNotFoundActionError              "Access key X does not exist on account Y"
//   AccessKeyDoesNotExistError                "Access key X does not exist at block height N"
// Class names can be lost when the web bundle is minified, so the messages and the
// raw RPC error kinds (MethodNameMismatch, RequiresFullAccess, ...) are matched too.

export const KINDS = ['PAID', 'HELD', 'BLOCKED', 'REFUSED_BY_NEAR', 'ERROR'];

const NEAR_REFUSALS = [
  {
    code: 'KEY_NOT_FOUND',
    pattern: /AccessKeyNotFound|AccessKeyDoesNotExist|access key \S+ does not exist/i,
  },
  {
    code: 'METHOD_NOT_ALLOWED',
    pattern: /MethodNameMismatch|does not allow method/i,
  },
  {
    code: 'TRANSFER_NOT_ALLOWED',
    pattern: /RequiresFullAccess|requires full access|DepositWithFunctionCall|deposit is not allowed with function call/i,
  },
];

const SPEND_STATUSES = new Set(['PAID', 'HELD', 'BLOCKED']);

/** Classify a SpendResult returned by request_spend. */
export function classifyResult(result) {
  if (!result || typeof result !== 'object' || !SPEND_STATUSES.has(result.status)) {
    return { kind: 'ERROR', code: 'ERROR', message: `Unexpected result: ${safeJson(result)}` };
  }
  return {
    kind: result.status,
    code: result.code,
    paymentId: result.payment_id,
    retryable: result.retryable,
    nextAction: result.next_action,
  };
}

/** Classify an error thrown by near-api-js (or any RPC client). */
export function classifyError(error) {
  const text = errorText(error);
  for (const r of NEAR_REFUSALS) {
    if (r.pattern.test(text)) {
      return { kind: 'REFUSED_BY_NEAR', code: r.code, errorName: errorName(error), message: errorMessage(error) };
    }
  }
  return { kind: 'ERROR', code: 'ERROR', errorName: errorName(error), message: errorMessage(error) };
}

/** One call for both paths: classify({ result }) or classify({ error }). */
export function classify({ result, error } = {}) {
  return error ? classifyError(error) : classifyResult(result);
}

/** Short label for tables, e.g. "BLOCKED_OVER_TX_CAP" or "REFUSED_BY_NEAR: KEY_NOT_FOUND". */
export function label(c) {
  if (c.kind === 'REFUSED_BY_NEAR') return `REFUSED_BY_NEAR: ${c.code}`;
  if (c.kind === 'ERROR') return 'ERROR';
  if (c.kind === 'PAID' || c.kind === 'HELD') return c.kind;
  return c.code;
}

export function errorName(error) {
  if (!error) return '';
  return error.name || error.constructor?.name || typeof error;
}

export function errorMessage(error) {
  if (error == null) return '';
  if (typeof error === 'string') return error;
  return error.message || safeJson(error);
}

// Everything we can read from the error, joined, for pattern matching.
function errorText(error) {
  if (error == null) return '';
  if (typeof error === 'string') return error;
  const parts = [error.name, error.constructor?.name, error.message, error.type, error.kind];
  for (const extra of [error.cause, error.data, error.error]) {
    if (extra) parts.push(safeJson(extra));
  }
  return parts.filter(Boolean).join(' | ');
}

/** Serializable copy of an error with all its own fields (raw RPC data kept, stack dropped). */
export function serializeError(error) {
  if (error == null) return null;
  if (typeof error !== 'object') return { message: String(error) };
  const out = { name: errorName(error), message: error.message };
  for (const k of Object.getOwnPropertyNames(error)) {
    if (k === 'stack' || k === 'message') continue;
    try {
      out[k] = JSON.parse(safeJson(error[k]) ?? 'null');
    } catch {
      out[k] = String(error[k]);
    }
  }
  return out;
}

function safeJson(v) {
  try {
    return JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() : x));
  } catch {
    return String(v);
  }
}
