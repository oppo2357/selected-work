# One Airtable row per Gumroad sale

A buyer purchases a $19 guide and a $29 notebook using the same email. The store needs two rows so the owner can follow up on each purchase. This sample matches records by Gumroad sale ID and updates only the fields owned by the sync.

## What happens if the import stops?

| Run | What happened | Rows in the sample table |
| --- | --- | ---: |
| Initial import | Page one was saved. Page two timed out. | 2 |
| Restart | The import read both pages and recovered the missing sale. | 3 |
| Refund update | The guide was refunded and the notebook was partially refunded. The owner's note stayed on the notebook row. | 3 |
| Repeat | The same pages were replayed. Every field matched the previous result. | 3 |

## What the owner sees

| Sale | Customer | Product | Original price | Refund flag | Owner's note |
| --- | --- | --- | ---: | --- | --- |
| demo-701 | reader@example.org | field-guide | $19.00 | Full | |
| demo-702 | reader@example.org | field-notes | $29.00 | Partial | Requested an invoice |
| demo-703 | sam@example.org | field-guide | $19.00 | | |

The original price stays on each row after a refund. The source fixture uses USD. The script also keeps the sale timestamp in UTC.

## Reproduce it

Run `python replay.py` with Python 3.11 or newer. The three output lines are the final rows. The script also checks that an incomplete destination response fails the import. The example runs entirely on fictional records in memory.

In a store, Gumroad supplies a page key for the next set of sales. Airtable's PATCH upsert can match an existing row on its sale ID and preserve fields omitted from the update, such as the owner's follow-up note. A live handoff can be checked against a merchant-controlled test sale, a second sync and the actual Airtable records. [Gumroad Sales API](https://gumroad.com/api#sales) · [Airtable update and upsert](https://airtable.com/developers/web/api/update-multiple-records)
