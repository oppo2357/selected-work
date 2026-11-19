# The invoice was short one satoshi

An importer receives two fictional invoice lines, `"0.00000029"` and `"0.00000001"` BTC. Their sum is 30 satoshis. Converting each line with `Math.trunc(Number(value) * 100000000)` records 29 in total. The first multiplication produces `28.999999999999996`, which truncation turns into 28.

## Reproduce the discrepancy

Download [check.mjs](./check.mjs) and run both commands with Node.js. The script uses only the standard library and never connects to a wallet or the network.

```sh
node check.mjs before
node check.mjs after
```

The first command exits with status 1 and reports four failing checks. The second exits with status 0 and passes all ten. Both commands use the same inputs and expected values.

| Invoice input | Expected sats | Before | After |
| --- | ---: | ---: | ---: |
| `0.00000029` | 29 | 28 | 29 |
| `0.29` | 29,000,000 | 28,999,999 | 29,000,000 |
| `0.00000029` plus `0.00000001` | 30 | 29 | 30 |

## The fix

Keep the original decimal text at the import boundary. Parse the whole and fractional parts separately, pad the fraction to eight digits, then add the two integer amounts. Keep the result in satoshis when totaling invoice lines.

This sample importer accepts unsigned decimal strings with up to eight digits on either side of the decimal point and rejects unsupported formats before conversion. The tests cover the importer’s input format and arithmetic. They use fictional local data.
