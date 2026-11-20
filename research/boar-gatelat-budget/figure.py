"""Plot actual answer-model timings close to GATELAT's target prompt length."""

import json
from pathlib import Path
from statistics import median

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from replay import TRACE_DIR, TRACE_HASHES, download


def main():
    paper, ink = "#fcfaf4", "#1d3132"
    fig = plt.figure(figsize=(10.2, 6.6), facecolor=paper)
    fig.text(.09, .92, "What fits in four seconds on a Pixel 8a?", fontsize=24, family="DejaVu Serif", color=ink)
    fig.text(.091, .848, "GATELAT projected 3.91 seconds for 332 uncached tokens. These 22 answer-model turns\n"
             "on the final phone build processed a similar number of tokens.", fontsize=12.2, color=ink, linespacing=1.4)
    ax = fig.add_axes([.11,.23,.855,.49],facecolor=paper)
    ax.axhline(4,color="#7c473c",lw=1.5,ls=(0,(3,3)))
    ax.text(299.6,4.19,"4 s target",color="#784234",size=10)
    markers = [("o", "#246979"), ("^", "#9b4c30")]
    for (seed, digest), (marker, color) in zip(TRACE_HASHES.items(), markers):
        rows = [json.loads(line) for line in download(f"{TRACE_DIR}/df-m1-v04-s{seed}.jsonl", digest).splitlines()]
        rows = [r for r in rows if not (r["healthFixed"] or r["calculated"] or r["exposureComputed"]) and abs(r["promptTokens"]-332) <= 33.2]
        timing = [r["promptMs"]/1000 for r in rows]
        assert len(rows) == 11 and min(timing) > 4
        ax.scatter([r["promptTokens"] for r in rows], timing, marker=marker,
                   facecolors="none" if marker=="o" else color, edgecolors=color, linewidths=1.6, s=58,
                   label=f"Seed {seed}   ·   median {median(timing):.2f} s", zorder=4)
    ax.legend(loc="upper left",bbox_to_anchor=(-.01,1.19),ncol=2,frameon=False,fontsize=11)
    ax.set(xlim=(298,367), ylim=(2.9,11.25), xlabel="Uncached prompt tokens", ylabel="Measured prefill time (s)")
    ax.grid(axis="y", color="#dadbd3", lw=.6);ax.set_axisbelow(True)
    for side in ("top","right"): ax.spines[side].set_visible(False)
    fig.text(.09,.09,"Observed prefill in the final 1.7B answer model. The proposed LoRA gate itself was never timed here.\n"
             "Source  ·  r4to’s BOAR DEVICE-FINAL traces, seeds 42 and 43, model turns within 10% of 332 tokens.",
             fontsize=10.3,color="#365354",linespacing=1.45)
    fig.savefig(Path(__file__).with_name("pixel-prefill.png"),dpi=150)
    plt.close(fig)


if __name__ == "__main__":
    main()
