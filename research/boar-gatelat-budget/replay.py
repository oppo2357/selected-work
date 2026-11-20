"""Recheck the GATELAT V2 time budget against the published Pixel 8a traces."""
import hashlib
import json
import statistics
from urllib.request import urlopen


RESEARCH = "6b7caca9bd932d69859d0cc10f97fd9aecff4ce9"
TRACES = "f96e277cf8584b38c35c01106c1fe77457dfaa81"
TRACE_DIR = (
    f"https://huggingface.co/datasets/r4topunk/boar-traces/resolve/{TRACES}/"
    "rnd/research/coordinator/arms/device-final/out"
)
GATE_FILE = (
    f"https://raw.githubusercontent.com/r4topunk/boar-research/{RESEARCH}/"
    "rnd/research/coordinator/arms/gate-latency/analysis.json"
)
TRACE_HASHES = {
    42: "97fbbb4d8079302e7312f8e63652d2f86ad49356abe9bdeacf2e45d0107ec0df",
    43: "a9ffb0013b1edb6e6763bc52da9e4d98b8fb62e68c1974d616aa3bc7f74ee311",
}
GATE_HASH = "4c15039b7e5ebf9cf5d6bf085d684d3b959b560dde6d612bab15ffade0e1ab76"


def download(url, expected):
    with urlopen(url, timeout=30) as response:
        data = response.read()
    if hashlib.sha256(data).hexdigest() != expected:
        raise ValueError(f"Source digest mismatch: {url}")
    return data


def summarize(rows, target_tokens, budget):
    rates = [1000 * r["promptTokens"] / r["promptMs"] for r in rows]
    # Apply the original linear projection separately to each measured rate.
    # Report the median of those calculations, including for even-sized sets.
    scaled = [target_tokens / r for r in rates]
    budget_hits = sum(t <= budget for t in scaled)
    return {
        "turns": len(rows),
        "median_observed_prefill_tps": round(statistics.median(rates), 3),
        "median_measured_prompt_tokens": statistics.median(r["promptTokens"] for r in rows),
        "median_measured_prompt_seconds": round(statistics.median(r["promptMs"] for r in rows) / 1000, 3),
        "measured_prompt_times_at_or_below_budget": sum(r["promptMs"] <= 1000 * budget for r in rows),
        "median_seconds_if_target_tokens": round(statistics.median(scaled), 3),
        "rates_sufficient_for_target_within_budget": budget_hits,
        "median_token_capacity_at_budget": round(statistics.median(rates) * budget, 1),
    }


def main():
    gate = json.loads(download(GATE_FILE, GATE_HASH))
    target = gate["variants"]["V2"]["noncached_p50_unw"]
    budget = 4
    result = {
        "target_noncached_tokens": target,
        "budget_seconds": budget,
        "required_prefill_tps": target / budget,
        "original_assumed_prefill_tps": gate["rate_tok_s"],
        "published_projected_median_s": gate["variants"]["V2"]["pixel_s_p50_unw"],
        "source_analysis": GATE_FILE,
        "seeds": {},
    }
    all_ids = []
    for seed, digest in TRACE_HASHES.items():
        url = f"{TRACE_DIR}/df-m1-v04-s{seed}.jsonl"
        data = [json.loads(line) for line in download(url, digest).splitlines()]
        model = [
            r for r in data if not (r["healthFixed"] or r["calculated"] or r["exposureComputed"])
        ]
        if len(data) != 88 or len(model) != 82:
            raise ValueError("Unexpected number of turn rows")
        if any(r["modelId"] != "qwen3-1.7b-q4km" or r["timedOut"] or r["promptMs"] <= 0
               or r["promptTokens"] <= 0 for r in model):
            raise ValueError("Unexpected model, timing, or timed-out model turn")
        ids = {r["queryId"] for r in model}
        if len(ids) != len(model):
            raise ValueError("Repeated turn ID")
        all_ids.append(ids)
        clean = [r for r in model if r["cachedTokens"] > 0 and r["historyTurns"] == 0]
        # Windows are descriptive sensitivity checks. Raw prompt durations below never
        # assume gate performance or rescale a measured duration.
        windows = {}
        for fraction in (0.10, 0.25):
            nearby = [r for r in model if abs(r["promptTokens"] - target) <= target * fraction]
            windows[f"within_{int(fraction * 100)}pct_tokens"] = summarize(nearby, target, budget)
        result["seeds"][seed] = {
            "source": url,
            "sha256": digest,
            "all_model_turns": summarize(model, target, budget),
            "cache_warm_first_turns": summarize(clean, target, budget),
            **windows,
        }
    if all_ids[0] != all_ids[1]:
        raise ValueError("Seed turn IDs differ")
    result["matched_model_turn_ids"] = len(all_ids[0])
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
