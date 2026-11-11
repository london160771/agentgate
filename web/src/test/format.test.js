import { describe, expect, it } from 'vitest';
import { formatNear, nearToYocto, yoctoToNear } from '../../../scripts/lib/format.js';
import { accessKeysLink, nsToDate } from '../lib/links.js';

describe('formatters', () => {
  it('formats yocto as NEAR', () => {
    expect(formatNear(nearToYocto('0.53'))).toBe('0.53 NEAR');
    expect(yoctoToNear('600000000000000000000000')).toBe('0.6');
  });
  it('turns a block timestamp (ns) into UTC text', () => {
    expect(nsToDate('1762865258000000000')).toBe('2025-11-11 12:47:38 UTC');
  });
  it('links the vault access keys on NearBlocks', () => {
    expect(accessKeysLink('vault.a.testnet')).toBe('https://testnet.nearblocks.io/address/vault.a.testnet?tab=accesskeys');
  });
});
