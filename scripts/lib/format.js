// Amount formatting shared by scripts and web. Pure string/BigInt math, no floats,
// so "0.1" NEAR is exactly 100000000000000000000000 yocto.

const YOCTO_DIGITS = 24;
const YOCTO_PER_NEAR = 10n ** 24n;

/** "1.5" -> 1500000000000000000000000n. Throws on bad input or more than 24 decimals. */
export function nearToYocto(near) {
  const s = String(near).trim();
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error(`Invalid NEAR amount: "${near}"`);
  const [whole, frac = ''] = s.split('.');
  if (frac.length > YOCTO_DIGITS) throw new Error(`Too many decimals in NEAR amount: "${near}"`);
  return BigInt(whole) * YOCTO_PER_NEAR + BigInt(frac.padEnd(YOCTO_DIGITS, '0'));
}

/** Yocto (string | bigint) -> NEAR string with trailing zeros trimmed, e.g. "0.5". */
export function yoctoToNear(yocto, maxDecimals = YOCTO_DIGITS) {
  let v = BigInt(yocto);
  const neg = v < 0n;
  if (neg) v = -v;
  const whole = v / YOCTO_PER_NEAR;
  let frac = (v % YOCTO_PER_NEAR).toString().padStart(YOCTO_DIGITS, '0').slice(0, maxDecimals);
  frac = frac.replace(/0+$/, '');
  return `${neg ? '-' : ''}${whole}${frac ? '.' + frac : ''}`;
}

/** Yocto -> "0.5 NEAR" for display (max 4 decimals, cut not rounded). */
export function formatNear(yocto, maxDecimals = 4) {
  return `${yoctoToNear(yocto, maxDecimals)} NEAR`;
}

/** Short form of a public key for tables: "ed25519:AbCd…WxYz". */
export function shortKey(publicKey, keep = 6) {
  const s = String(publicKey);
  const [curve, data] = s.includes(':') ? s.split(':') : ['', s];
  if (data.length <= keep * 2 + 1) return s;
  return `${curve ? curve + ':' : ''}${data.slice(0, keep)}…${data.slice(-keep)}`;
}

/** Testnet explorer links (NearBlocks). */
export const EXPLORER = {
  testnet: 'https://testnet.nearblocks.io',
};

export function txLink(txHash, network = 'testnet') {
  return `${EXPLORER[network]}/txns/${txHash}`;
}

export function accountLink(accountId, network = 'testnet') {
  return `${EXPLORER[network]}/address/${accountId}`;
}
