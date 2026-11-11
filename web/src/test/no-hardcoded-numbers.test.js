// PRD Phase 3 check: no seed numbers (caps, allowance, funding) hardcoded in the web app.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import seed from '../../../config/seed.json';

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return d.name === 'test' ? [] : files(p);
    return /\.(jsx?|css)$/.test(d.name) ? [p] : [];
  });

describe('web/src has no hardcoded seed numbers', () => {
  const a = seed.agents.apiBuyer;
  const numbers = [a.perTxCapNear, a.dailyCapNear, a.keyAllowanceNear, seed.vaultFundingNear].map(String);
  const accounts = [seed.ownerAccountId];
  for (const file of files(SRC)) {
    it(path.relative(SRC, file), () => {
      const text = fs.readFileSync(file, 'utf8');
      for (const n of numbers) expect(text, `"${n} NEAR" in ${file}`).not.toMatch(new RegExp(`\\b${n.replace('.', '\\.')}\\s*NEAR`, 'i'));
      for (const acct of accounts) expect(text).not.toContain(acct);
      expect(text).not.toContain(seed.demoKeys.apiBuyerPrivateKey);
    });
  }
});
