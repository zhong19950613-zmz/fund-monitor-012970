#!/usr/bin/env python3
"""
Advanced Daily Analysis for fund-monitor
Generates structured analysis + rebalance suggestions + JSON/Markdown report
"""

import yaml
import json
from datetime import datetime
from pathlib import Path


def load_config():
    with open("data/holdings.yaml", "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def calculate_deviation(current: float, target: float, threshold: float = 0.08):
    diff = current - target
    needs_rebalance = abs(diff) >= threshold
    return diff, needs_rebalance


def run_analysis():
    config = load_config()
    holdings = config.get("holdings", [])
    target_alloc = config.get("portfolio", {}).get("target_allocation", {})
    risk = config.get("risk_control", {})
    threshold = risk.get("rebalance_threshold", 0.08)
    max_single = risk.get("max_single_position", 0.30)

    print("\n" + "="*50)
    print("DAILY FUND ANALYSIS")
    print("="*50)
    print(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M')}")

    # Current allocation by type
    current_alloc = {}
    for h in holdings:
        t = h.get("type", "other")
        current_alloc[t] = current_alloc.get(t, 0) + h.get("weight", 0)

    print("\n[Allocation by Type]")
    deviations = []
    for asset, target_w in target_alloc.items():
        curr_w = current_alloc.get(asset, 0.0)
        diff, needs = calculate_deviation(curr_w, target_w, threshold)
        status = "⚠️ REBALANCE" if needs else "✅ OK"
        print(f"  {asset:12} | Curr: {curr_w:5.1%} | Target: {target_w:5.1%} | Diff: {diff:+5.1%} | {status}")
        if needs:
            deviations.append({"type": asset, "current": curr_w, "target": target_w, "diff": diff})

    # Individual position check
    print("\n[Individual Positions]")
    for h in holdings:
        w = h.get("weight", 0)
        tw = h.get("target_weight", w)
        diff, needs = calculate_deviation(w, tw, threshold)
        if needs or w > max_single:
            print(f"  {h['symbol']} {h['name']:20} | {w:5.1%} (target {tw:5.1%}) {'⚠️' if needs else ''}")

    # Rebalance suggestions
    print("\n[Rebalance Suggestions]")
    if deviations:
        for d in deviations:
            action = "减持" if d["diff"] > 0 else "加仓"
            print(f"  → {action} {d['type']} 约 {abs(d['diff']):.1%}")
    else:
        print("  当前组合健康，无需再平衡")

    # Generate report data
    report = {
        "date": datetime.now().strftime("%Y-%m-%d"),
        "timestamp": datetime.now().isoformat(),
        "needs_rebalance": len(deviations) > 0,
        "deviations": deviations,
        "summary": "Rebalance needed" if deviations else "Portfolio healthy"
    }

    # Save JSON
    Path("reports").mkdir(exist_ok=True)
    json_path = f"reports/analysis-{report['date']}.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    # Save simple Markdown
    md_path = f"reports/daily-{report['date']}.md"
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(f"# Daily Fund Report - {report['date']}\n\n")
        f.write(f"**Status**: {report['summary']}\n\n")
        if deviations:
            f.write("## Rebalance Suggestions\n")
            for d in deviations:
                action = "减持" if d["diff"] > 0 else "加仓"
                f.write(f"- {action} **{d['type']}** 约 {abs(d['diff']):.1%}\n")
        else:
            f.write("组合状态良好，无需调整。\n")

    print(f"\nReport saved: {json_path}")
    print(f"Markdown report: {md_path}")
    return report


if __name__ == "__main__":
    run_analysis()