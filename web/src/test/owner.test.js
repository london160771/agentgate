// Unit tests for the owner-action helpers (P1-a). No wallet, no network.
import { describe, expect, it } from 'vitest';
import { actionCreators } from '@near-wallet-selector/core';
import { GAS_OWNER } from '../../../scripts/lib/chain.js';
import { OWNER_METHODS, isOwner, outcomeFailure, outcomeHash, ownerAction } from '../lib/owner.js';

describe('ownerAction', () => {
  it('builds a FunctionCall with no deposit and owner gas', () => {
    const a = ownerAction(actionCreators.functionCall, 'approve_held', { payment_id: 3 });
    expect(a.functionCall.methodName).toBe('approve_held');
    expect(JSON.parse(Buffer.from(a.functionCall.args).toString())).toEqual({ payment_id: 3 });
    expect(a.functionCall.deposit).toBe(0n);
    expect(a.functionCall.gas).toBe(GAS_OWNER);
  });
  it('only allows the owner methods the web app uses', () => {
    expect(OWNER_METHODS).toEqual(['approve_held', 'reject_held', 'revoke_agent', 'add_agent']);
    for (const m of ['request_spend', 'update_rules', 'new']) expect(() => ownerAction(actionCreators.functionCall, m, {})).toThrow(/not an owner action/);
  });
});

describe('isOwner', () => {
  it('needs both values and an exact match', () => {
    expect(isOwner('ade.testnet', 'ade.testnet')).toBe(true);
    expect(isOwner('eve.testnet', 'ade.testnet')).toBe(false);
    expect(isOwner(null, 'ade.testnet')).toBe(false);
    expect(isOwner('ade.testnet', null)).toBe(false);
  });
});

describe('outcome helpers (mock outcomes, unit test only)', () => {
  const ok = { status: { SuccessValue: '' }, transaction: { hash: 'TxHash1' }, receipts_outcome: [{ outcome: { status: { SuccessValue: '' } } }] };
  const failed = {
    status: { Failure: { ActionError: { index: 0, kind: { FunctionCallError: { ExecutionError: 'Smart contract panicked: ERR_NOT_OWNER' } } } } },
    transaction: { hash: 'TxHash2' },
    receipts_outcome: [],
  };
  it('reads the tx hash', () => {
    expect(outcomeHash(ok)).toBe('TxHash1');
    expect(outcomeHash({ transaction_outcome: { id: 'TxHash3' } })).toBe('TxHash3');
    expect(outcomeHash(undefined)).toBe('');
  });
  it('finds a failure in the tx or any receipt', () => {
    expect(outcomeFailure(ok)).toBeNull();
    expect(outcomeFailure(failed)).toBe('Smart contract panicked: ERR_NOT_OWNER');
    const receiptFail = { ...ok, receipts_outcome: [{ outcome: { status: { Failure: { ActionError: { kind: 'LackBalanceForState' } } } } }] };
    expect(outcomeFailure(receiptFail)).toMatch(/LackBalanceForState/);
  });
});
