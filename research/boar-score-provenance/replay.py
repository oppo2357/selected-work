"""Replay the four BOAR scorer pairings and check per-item run identity.

Usage: python replay.py PATH_TO_BOAR_BENCH DOWNLOAD_CACHE
Requires Python 3.10+, Node.js and Git. Reads only public files.
"""

import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
from urllib.request import urlopen


BENCH_REV = "b41a25acfabf89f1d015103ca1329554f985a257"
DATA_REV = "f96e277cf8584b38c35c01106c1fe77457dfaa81"
SOURCE = f"https://huggingface.co/datasets/r4topunk/boar-traces/resolve/{DATA_REV}/rnd/research/coordinator/ruler"
FILES = {
    "L0_15B_closedbook.traces.jsonl": "b8b4922baee30b30af8bb979d7dbe1beb2cf1c5381243c3aa587348784fe0c2c",
    "L0_15B_closedbook.judgments.jsonl": "aeb0063b6504d2a44a8f7a36313fdcb1a752747147fc206fcc6c551cb3a5b302",
    "L3_4B_phone_cut7.traces.jsonl": "d6349c9392e072620a5fa4f6efd2b8b2492642b2b1927af3e30e47e71da2083b",
    "L3_4B_phone_cut7.judgments.jsonl": "f90121b99a0024060a0a89eadc3ea032536b234e392580f523786907411b7926",
}
ARMS = ("L0_15B_closedbook", "L3_4B_phone_cut7")


def inputs(cache):
    cache.mkdir(parents=True, exist_ok=True)
    documents = {}
    for name, expected in FILES.items():
        path = cache / name
        if path.exists():
            data = path.read_bytes()
        else:
            folder = "codex-ladder/in/traces" if ".traces." in name else "cv5-ladder/out"
            with urlopen(f"{SOURCE}/{folder}/{name}", timeout=40) as response:
                data = response.read()
        if hashlib.sha256(data).hexdigest() != expected:
            raise ValueError(f"Unexpected public file contents: {name}")
        if not path.exists():
            path.write_bytes(data)
        documents[name] = [json.loads(line) for line in data.splitlines() if line.strip()]
    return documents


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("repo", type=Path)
    parser.add_argument("cache", type=Path)
    args = parser.parse_args()
    repo, cache = args.repo.resolve(), args.cache.resolve()
    revision = subprocess.check_output(["git", "-C", str(repo), "rev-parse", "HEAD"], text=True).strip()
    if revision != BENCH_REV:
        raise SystemExit(f"Check out boar-bench {BENCH_REV} first.")
    docs = inputs(cache)
    traces = {arm: {t["itemId"]: t for t in docs[f"{arm}.traces.jsonl"]} for arm in ARMS}
    left, right = (traces[arm] for arm in ARMS)
    common = left.keys() & right.keys()
    result = {
        "benchRevision": revision, "dataRevision": DATA_REV,
        "sharedTraceItems": len(common),
        "differentAnswers": sum(left[k]["answer"]["text"] != right[k]["answer"]["text"] for k in common),
        "runs": [],
    }
    for trace_arm in ARMS:
        for judge_arm in ARMS:
            trace_file = f"{trace_arm}.traces.jsonl"
            judge_file = f"{judge_arm}.judgments.jsonl"
            cmd = [sys.executable, "-X", "utf8", str(repo / "scorers/score.py"),
                   "--bench", str(repo / "bench/v0.1"), "--traces", str(cache / trace_file),
                   "--judgments", str(cache / judge_file)]
            run = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", check=True,
                                 env={**os.environ, "PYTHONUTF8": "1", "PYTHONDONTWRITEBYTECODE": "1"})
            report = json.loads(run.stdout)
            scored = set(report["pairs"])
            rows = [j for j in docs[judge_file] if j["ok"] and j["queryId"] in scored]
            mismatch = {j["queryId"] for j in rows if j["runId"] != traces[trace_arm][j["queryId"]]["runId"]}
            q = report["quality"]
            result["runs"].append({"traces": trace_arm, "judgments": judge_arm, "exit": run.returncode,
                                   "judgedItems": q["n_judged"], "itemsWithConflictingRunId": len(mismatch),
                                   "floorAdjustedU": q["floor_adjusted_u"], "ci95": q["floor_adjusted_u_ci95"],
                                   "bar": q["bounty_bar"]["verdict"]})
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
