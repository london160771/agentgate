// Web-side checks of the shared classifier, using the real near-api-js error
// classes (unit-test instances, not live errors).
import { describe, expect, it } from 'vitest';
import {
  AccessKeyDoesNotExistError,
  AccessKeyMethodNameMismatchActionError,
  AccessKeyRequiresFullAccessActionError,
} from 'near-api-js/rpc-errors';
import { classifyError, classifyResult, label } from '../../../scripts/lib/classify.js';

describe('classifier (shared with scripts)', () => {
  it('maps SpendResult statuses', () => {
    expect(label(classifyResult({ payment_id: 1, status: 'PAID', code: 'OK_PAID' }))).toBe('PAID');
    expect(label(classifyResult({ payment_id: 2, status: 'BLOCKED', code: 'BLOCKED_OVER_DAILY_CAP' }))).toBe('BLOCKED_OVER_DAILY_CAP');
  });

  it('maps the three NEAR refusals seen in Gate 0', () => {
    expect(label(classifyError(new AccessKeyRequiresFullAccessActionError(null, '', '')))).toBe('REFUSED_BY_NEAR: TRANSFER_NOT_ALLOWED');
    expect(label(classifyError(new AccessKeyMethodNameMismatchActionError('update_rules', null, '', '')))).toBe('REFUSED_BY_NEAR: METHOD_NOT_ALLOWED');
    expect(label(classifyError(new AccessKeyDoesNotExistError('ed25519:x', 'b', 1)))).toBe('REFUSED_BY_NEAR: KEY_NOT_FOUND');
  });

  it('still works when a minifier renames the error classes', () => {
    const e = Object.assign(new Error('Access key requires full access'), { name: 'a' });
    expect(classifyError(e).code).toBe('TRANSFER_NOT_ALLOWED');
  });

  it('shows anything else as ERROR with the raw message', () => {
    const c = classifyError(new Error('Failed to fetch'));
    expect(c.kind).toBe('ERROR');
    expect(c.message).toBe('Failed to fetch');
  });
});
