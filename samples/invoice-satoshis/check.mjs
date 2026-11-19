import assert from 'node:assert/strict';

// Reproduce one decimal conversion bug in an offline invoice importer.
const satsPerBtc = 100_000_000n;
const mode = process.argv[2] ?? 'after';
if (!['before', 'after'].includes(mode)) {
  throw new Error('Usage: node check.mjs before|after');
}

function invoiceSats(value) {
  if (typeof value !== 'string' || !/^(?:0|[1-9][0-9]{0,7})(?:\.[0-9]{1,8})?$/.test(value)) {
    throw new RangeError('Expected unsigned decimal BTC text with up to eight decimal places');
  }

  if (mode === 'before') {
    return BigInt(Math.trunc(Number(value) * Number(satsPerBtc)));
  }
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * satsPerBtc + BigInt(fraction.padEnd(8, '0'));
}

const checks = [
  ['one satoshi', () => assert.equal(invoiceSats('0.00000001'), 1n)],
  ['29 satoshis', () => assert.equal(invoiceSats('0.00000029'), 29n)],
  ['0.29 BTC', () => assert.equal(invoiceSats('0.29'), 29_000_000n)],
  ['whole BTC', () => assert.equal(invoiceSats('2'), 200_000_000n)],
  ['explicit trailing zeroes', () => assert.equal(invoiceSats('0.29000000'), 29_000_000n)],
  ['empty invoice amount', () => assert.throws(() => invoiceSats(''), RangeError)],
  ['fraction of a satoshi', () => assert.throws(() => invoiceSats('0.000000001'), RangeError)],
  ['scientific notation outside the input contract', () => assert.throws(() => invoiceSats('1e-8'), RangeError)],
  ['numeric input that already lost its original text', () => assert.throws(() => invoiceSats(0.29), RangeError)],
  ['two-line invoice totals 30 satoshis', () => {
    const lines = ['0.00000029', '0.00000001'];
    const total = lines.reduce((sum, value) => sum + invoiceSats(value), 0n);
    assert.equal(total, 30n);
  }],
];

let failed = 0;
for (const [name, run] of checks) {
  try {
    run();
    console.log(`PASS  ${name}`);
  } catch (error) {
    console.log(`FAIL  ${name}: ${error.message}`);
    failed++;
  }
}
console.log(`${mode}: ${checks.length - failed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
