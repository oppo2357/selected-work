# Who still needs a callback?

A service office receives eight call updates. A repeated delivery, a late notification and a finished callback all look like fresh leads if the office filters for missed calls too early. This n8n workflow rebuilds a callback list from the complete export. It uses seven built-in nodes and fictional records. It runs without credentials or a phone connection.

## Try it

Import `callback-queue.json` into n8n, choose **Execute workflow**, then open the output of **Owner callback list**.

| Call ID | Customer | Reason |
| --- | --- | --- |
| JOB-31 | site A | boiler visit |
| JOB-48 | site A | second property visit |

These are separate requests from the same customer. JOB-31 appeared twice in the feed. JOB-34 was answered, JOB-57 had no callback request, and JOB-63 already received its callback.

Four runs in n8n 2.48.6 checked the returned call IDs. Feeding in the same eight events in reverse order or replaying all eight twice produced the same two jobs. Appending a newer callback-completed update for JOB-31 left JOB-48 as the only open request.

## How the list is built

The workflow sorts each update by its source revision, retains the latest state for each call ID, and then selects the calls that still need attention. Filtering first would resurrect JOB-34 from an old missed-call event. Grouping by caller identity would discard one of site A's two jobs.

The input contract uses a stable call ID and increasing revision numbers per call. Repeated deliveries of one revision carry the same state. The demo processes a complete export in one run. For a live integration that receives one event at a time, keep the latest revision per call in persistent storage, skip older revisions, and upsert by call ID before notifying staff.
