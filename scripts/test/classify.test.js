// Classifier unit tests. The error objects below are MOCKS built from the
// error classes near-api-js 7.5.2 really exports (rpc-errors). Gate 0 checks
// them against real testnet errors.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AccessKeyDepositWithFunctionCallActionError,
  AccessKeyDoesNotExistError,
  AccessKeyMethodNameMismatchActionError,
  AccessKeyNotEnoughAllowanceActionError,
  AccessKeyNotFoundActionError,
  AccessKeyRequiresFullAccessActionError,
  HostGuestPanicError,
} from 'near-api-js/rpc-errors';
import { classify, classifyError, classifyResult, label, serializeError } from '../lib/classify.js';

const spendResult = (status, code) => ({ payment_id: 7, status, code, retryable: false, next_action: 'none' });

test('SpendResult maps to PAID / HELD / BLOCKED with its code', () => {
  const paid = classifyResult(spendResult('PAID', 'OK_PAID'));
  assert.deepEqual([paid.kind, paid.code, paid.paymentId], ['PAID', 'OK_PAID', 7]);
  assert.equal(classifyResult(spendResult('HELD', 'HELD_RECIPIENT_NOT_APPROVED')).kind, 'HELD');
  const blocked = classifyResult(spendResult('BLOCKED', 'BLOCKED_OVER_TX_CAP'));
  assert.deepEqual([blocked.kind, blocked.code], ['BLOCKED', 'BLOCKED_OVER_TX_CAP']);
  assert.equal(label(blocked), 'BLOCKED_OVER_TX_CAP');
  assert.equal(label(paid), 'PAID');
});

test('unexpected result is ERROR, not hidden', () => {
  const c = classifyResult({ status: 'WHAT' });
  assert.equal(c.kind, 'ERROR');
  assert.match(c.message, /WHAT/);
  assert.equal(classifyResult(null).kind, 'ERROR');
});

test('method mismatch → REFUSED_BY_NEAR: METHOD_NOT_ALLOWED', () => {
  const c = classifyError(new AccessKeyMethodNameMismatchActionError('update_rules', 0, 'txhash', 'blockhash'));
  assert.deepEqual([c.kind, c.code], ['REFUSED_BY_NEAR', 'METHOD_NOT_ALLOWED']);
  assert.equal(label(c), 'REFUSED_BY_NEAR: METHOD_NOT_ALLOWED');
  assert.equal(c.errorName, 'AccessKeyMethodNameMismatchActionError');
});

test('transfer with a function-call key → TRANSFER_NOT_ALLOWED', () => {
  assert.equal(classifyError(new AccessKeyRequiresFullAccessActionError(0, 'tx', 'b')).code, 'TRANSFER_NOT_ALLOWED');
  assert.equal(classifyError(new AccessKeyDepositWithFunctionCallActionError(0, 'tx', 'b')).code, 'TRANSFER_NOT_ALLOWED');
});

test('missing / revoked key → KEY_NOT_FOUND', () => {
  const pk = 'ed25519:6E8sCci9badyRkXb3JoRpBj5p8C6Tw41ELDZoiihKEtp';
  assert.equal(classifyError(new AccessKeyNotFoundActionError('vault.x.testnet', pk, 0, 'tx', 'b')).code, 'KEY_NOT_FOUND');
  assert.equal(classifyError(new AccessKeyDoesNotExistError(pk, 'b', 1)).code, 'KEY_NOT_FOUND');
});

test('minified class names: message and raw RPC kinds still match', () => {
  const minified = (message) => Object.assign(new Error(message), { name: 'e' });
  assert.equal(classifyError(minified('Access key does not allow method update_rules')).code, 'METHOD_NOT_ALLOWED');
  assert.equal(classifyError(minified('Access key requires full access')).code, 'TRANSFER_NOT_ALLOWED');
  assert.equal(classifyError(minified('Access key ed25519:abc does not exist at block height 5')).code, 'KEY_NOT_FOUND');
  // raw JSON-RPC error body
  const raw = { name: 'Error', message: 'Server error', data: { TxExecutionError: { InvalidTxError: { InvalidAccessKeyError: { MethodNameMismatch: { method_name: 'update_rules' } } } } } };
  assert.equal(classifyError(raw).code, 'METHOD_NOT_ALLOWED');
  assert.equal(classifyError('InvalidAccessKeyError: RequiresFullAccess').code, 'TRANSFER_NOT_ALLOWED');
});

test('FailoverRpcError is unwrapped to the real NEAR error', () => {
  const inner = new AccessKeyMethodNameMismatchActionError('update_rules', 0, '', '');
  const wrapped = Object.assign(new Error('Exceeded 2 providers to execute request'), { name: 'FailoverRpcError', errors: [inner, inner] });
  assert.equal(classifyError(wrapped).code, 'METHOD_NOT_ALLOWED');
});

test('not enough allowance is not mistaken for a permission refusal', () => {
  const e = new AccessKeyNotEnoughAllowanceActionError('vault.x.testnet', 1n, 2n, 'ed25519:abc', null, '', '');
  assert.equal(classifyError(e).kind, 'ERROR');
});

test('anything else → ERROR with the raw message', () => {
  const c = classifyError(new HostGuestPanicError('Smart contract panicked: ERR_NOT_VAULT_KEY'));
  assert.equal(c.kind, 'ERROR');
  assert.match(c.message, /ERR_NOT_VAULT_KEY/);
  assert.equal(classifyError(new Error('fetch failed')).message, 'fetch failed');
  assert.equal(label(c), 'ERROR');
});

test('classify() picks the error path when there is an error', () => {
  assert.equal(classify({ result: spendResult('PAID', 'OK_PAID') }).kind, 'PAID');
  assert.equal(classify({ error: new AccessKeyRequiresFullAccessActionError(0) }).kind, 'REFUSED_BY_NEAR');
});

test('serializeError keeps raw fields and drops the stack', () => {
  const s = serializeError(new AccessKeyMethodNameMismatchActionError('update_rules', 0, 'txhash', 'bh'));
  assert.equal(s.name, 'AccessKeyMethodNameMismatchActionError');
  assert.equal(s.methodName, 'update_rules');
  assert.equal(s.txHash, 'txhash');
  assert.equal(s.stack, undefined);
  assert.doesNotThrow(() => JSON.stringify(s));
});
