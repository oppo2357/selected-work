"""Independent burst experiment. Run with Python 3. No network or credentials."""
import math
import random
from collections import Counter
from statistics import mean

RATE = 5
DEADLINE = 9
BURST_SECONDS = 30
COUNT = RATE * BURST_SECONDS


def p95(values):
    return sorted(values)[math.ceil(0.95 * len(values)) - 1]


def run(seed, wait, budgeted=False, trace=False):
    rng = random.Random(seed)
    accepted = Counter()
    diverted_blocks = set()
    completed = []
    all_latencies = []
    attempts = 0
    cost = 0
    example = None
    for i in range(COUNT):
        arrival = i / RATE
        first, retry = rng.uniform(6, 8), rng.uniform(6, 8)
        elapsed = first
        path = ["A"]
        attempts += 1
        cost += 1  # A bills all starts, including cancelled and timed-out work.
        block = i // 10
        eligible = not budgeted or block not in diverted_blocks
        if first > wait and eligible:
            diverted_blocks.add(block)
            second = math.floor(arrival + wait)
            attempts += 1
            if accepted[second] < 2:
                accepted[second] += 1
                cost += 5
                elapsed = wait + 1
                path.append("B accepted")
            else:
                # Original A cancelled. B's free 429 takes 100 ms. Start fresh A.
                retry_at = arrival + wait + 0.1
                elapsed = wait + 0.1 + (retry if retry_at < BURST_SECONDS else 0.2)
                attempts += 1
                cost += 1
                path.extend(["B 429", "fresh A"])
        if elapsed <= DEADLINE:
            completed.append(elapsed)
        elif example is None:
            example = (i, round(arrival, 2), path, round(elapsed, 3), DEADLINE)
        all_latencies.append(min(DEADLINE, elapsed))
    if trace and example:
        print("first miss: request_id, arrival_s, path, would_return_s_after_arrival, deadline_s", example)
    return (len(completed), p95(completed), p95(all_latencies),
            attempts / len(completed), cost / len(completed))


if __name__ == "__main__":
    print("policy seed successes/150 success_p95_s deadline_penalized_p95_s attempts/success cost/success")
    for label, wait, budgeted in [("8s", 8, False), ("2s", 2, False), ("2s-budget", 2, True)]:
        runs = []
        for seed in range(10):
            row = run(seed, wait, budgeted, trace=(seed == 0))
            print(label, seed, *[round(x, 3) for x in row])
            runs.append(row)
        print(label, "mean across seeds", *[round(mean(col), 3) for col in zip(*runs)])
