#!/usr/bin/env python3
"""
Daily Fund Analysis Script
用于 GitHub Actions 或 本地运行
"""

import yaml
import json
from datetime import datetime
from pathlib import Path


def load_holdings(path: str = "data/holdings.yaml"):
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def analyze_portfolio(holdings_data):
    holdings = holdings_data.get("holdings", [])
    target = holdings_data.get("portfolio", {}).get("target_allocation", {})

    print("=== Daily Portfolio Analysis ===")
    print(f"Time: {datetime.now().isoformat()}")
    print(f"Total holdings: {len(holdings)}")

    # 简单分析示例
    current_weights = {}
    for h in holdings:
        t = h.get("type", "unknown")
        current_weights[t] = current_weights.get(t, 0) + h.get("weight", 0)

    print("\nCurrent allocation by type:")
    for k, v in current_weights.items():
        print(f"  {k}: {v:.1%}")

    print("\nTarget allocation:")
    for k, v in target.items():
        print(f"  {k}: {v:.1%}")

    # TODO: 添加再平衡判断、风险计算等逻辑
    print("\n[Info] Rebalance check placeholder - implement logic here")


if __name__ == "__main__":
    data = load_holdings()
    analyze_portfolio(data)

    # 示例：生成 JSON 摘要
    summary = {
        "date": datetime.now().strftime("%Y-%m-%d"),
        "status": "analyzed"
    }
    Path("reports").mkdir(exist_ok=True)
    with open(f"reports/summary-{summary['date']}.json", "w") as f:
        json.dump(summary, f, indent=2)

    print("\nAnalysis completed. Report saved.")