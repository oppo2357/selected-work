# BOAR's public scorer accepts judgments from a different run

I replayed the README scoring command on the published 1.5B closed-book and 4B phone runs. They answer the same 51 questions, and all 51 answer texts differ. Pairing the closed-book answers with the phone judgments changes the closed-book score from 0.2567 to 0.4473. Both commands exit successfully. The reverse pairing gives the phone the closed-book score.

## Results

[Scoring table screenshot](score-table.png) · [Full numerical output](result.json)

| Answer trace | Judgment file | Judged items | Conflicting run IDs | Floor-adjusted U | 95% CI | Scorer verdict |
|---|---|---:|---:|---:|---|---|
| 1.5B closed-book | 1.5B closed-book | 46 | 0 | 0.2567 | 0.1802–0.3364 | Below |
| 1.5B closed-book | 4B phone | 47 | 47 | 0.4473 | 0.3696–0.5281 | Inconclusive |
| 4B phone | 1.5B closed-book | 46 | 46 | 0.2567 | 0.1802–0.3364 | Below |
| 4B phone | 4B phone | 47 | 0 | 0.4473 | 0.3696–0.5281 | Inconclusive |

The two matching rows are controls. I intentionally exchanged the judgment files for the other two rows. This experiment establishes a failure in the public reporting command. It does not establish that the researchers mixed up their files or that either published headline number needs correcting.

## Why the command accepts the files

The Python entry point passes the judgment file and the benchmark's question IDs to its Node bridge. The bridge joins two successful grading orders by question ID. The resulting report records separate file digests, but neither component compares the judged run ID to that question's input trace. Both public files supply the necessary field. A report can consequently use one model's answers for its trace-dependent sections and another model's judgments for its quality section. [Scorer entry point](https://github.com/r4topunk/boar-bench/blob/b41a25acfabf89f1d015103ca1329554f985a257/scorers/score.py#L273) · [Judge bridge](https://github.com/r4topunk/boar-bench/blob/b41a25acfabf89f1d015103ca1329554f985a257/scorers/bridge.mjs#L21)

The project's October 13 patch already checks hashes when resuming judgment generation. This replay uses the separate, documented command for scoring existing judgments. The October 2 iOS report also describes a converter change that altered trace-file hashes while preserving questions and answers. A blanket hash-equality rule would unnecessarily reject that case. [Judgment generation](https://github.com/r4topunk/boar-bench/blob/b41a25acfabf89f1d015103ca1329554f985a257/harness/judge.mjs#L109) · [iOS conversion note](https://github.com/r4topunk/boar-bench/blob/b41a25acfabf89f1d015103ca1329554f985a257/reports/devices-2026-10-02/ios-q15.md#L72)

I would reject a score when a selected judgment has an explicit run ID that conflicts with the selected trace for that question. For rows missing an ID, report them as unverified. An additional digest of the exact question and answer presented to the judge would also detect edits made under a reused run ID, while tolerating changes to unrelated device metadata.

## Reproduce

With Python 3.10 or newer, Node.js and Git installed, run the following from the directory containing this report. The script downloads four published files, verifies each SHA-256 digest, runs the upstream scorer four times, and counts run-ID conflicts among the items the scorer actually used. No model download, GPU, paid judge or API key is needed.

```sh
git clone https://github.com/r4topunk/boar-bench.git
git -C boar-bench checkout --detach b41a25acfabf89f1d015103ca1329554f985a257
python replay.py boar-bench boar-inputs
```

The complete numerical output and reproduction script accompany this report. The downloaded traces and judgments are from r4to's CC BY-SA 4.0 research dataset and are kept in the local download cache. [Pinned source dataset](https://huggingface.co/datasets/r4topunk/boar-traces/tree/f96e277cf8584b38c35c01106c1fe77457dfaa81/rnd/research/coordinator/ruler) · [Upstream scoring instructions](https://github.com/r4topunk/boar-bench/blob/b41a25acfabf89f1d015103ca1329554f985a257/README.md#L57)
