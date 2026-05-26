import yaml
from datetime import datetime
from collections import defaultdict
import json
import os

def load_holdings():
    with open("holdings/holdings.yaml", "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

def generate_report():
    data = load_holdings()
    today = datetime.now().strftime("%Y-%m-%d")

    # 合并所有持仓
    all_holdings = []
    for platform in ["tencent", "alipay"]:
        for h in data.get(platform, {}).get("holdings", []):
            all_holdings.append({
                "name": h.get("name", ""),
                "amount": float(h.get("amount", 0)),
                "category": h.get("category", "其他")
            })

    # 按类别汇总
    category_sum = defaultdict(float)
    for h in all_holdings:
        category_sum[h["category"]] += h["amount"]

    total = sum(category_sum.values()) or 1
    current_allocation = {k: round(v / total, 4) for k, v in category_sum.items()}
    target = data.get("target_allocation", {})

    # 生成再平衡提醒
    alerts = []
    for cat, target_pct in target.items():
        curr_pct = current_allocation.get(cat, 0)
        diff = curr_pct - target_pct
        if abs(diff) > 0.08:
            direction = "减持" if diff > 0 else "加仓"
            alerts.append({
                "category": cat,
                "current_pct": round(curr_pct * 100, 1),
                "target_pct": round(target_pct * 100),
                "suggestion": direction,
                "diff": round(abs(diff) * 100, 1)
            })

    # 生成专业 Markdown 报告
    report = f"""# 📊 基金监控日报 - {today}

## 一、组合概览
- **合计总资产**：¥{total:.2f}
- **跟踪平台**：腾讯理财通 + 蚂蚁财富
- **数据日期**：{today}

## 二、类别配置分析（当前 vs 目标）

| 类别       | 当前金额   | 当前占比 | 目标占比 | 状态         | 偏离程度 |
|------------|------------|----------|----------|--------------|----------|
"""

    for cat in ["宽基", "半导体", "卫星", "防御", "其他成长"]:
        if cat in target:
            curr_amt = category_sum.get(cat, 0)
            curr_pct = current_allocation.get(cat, 0) * 100
            tgt_pct = target[cat] * 100
            diff = curr_pct - tgt_pct
            
            if abs(diff) <= 8:
                status = "✅ 均衡"
            elif diff > 0:
                status = "🔴 偏高"
            else:
                status = "🟡 偏低"
            
            report += f"| {cat} | ¥{curr_amt:.2f} | {curr_pct:.1f}% | {tgt_pct:.0f}% | {status} | {abs(diff):.1f}% |\n"

    # 再平衡建议
    report += "\n## 三、今日再平衡建议\n"
    
    if alerts:
        for a in alerts:
            report += f"- **{a['category']}** 当前占比 {a['current_pct']}%（目标 {a['target_pct']}%），建议 **{a['suggestion']}**（偏离 {a['diff']}%）\n"
        report += "\n> 建议在接下来 1-3 个交易日内逐步执行，避免一次性大额操作。\n"
    else:
        report += "✅ 当前配置较为均衡，暂无明显再平衡需求。\n"

    # 重点赛道观察
    report += f"""
## 四、重点赛道观察

- **半导体**：当前占比 {current_allocation.get('半导体', 0)*100:.1f}%
- **卫星/商业航天**：当前占比 {current_allocation.get('卫星', 0)*100:.1f}%

> 该赛道波动较大，建议持续关注政策与发射进度。

---
**报告生成时间**：{datetime.now().strftime("%Y-%m-%d %H:%M:%S")}  
**数据来源**：holdings.yaml（手动维护）+ EastMoney  
**下次更新**：明日 09:00 自动生成
"""

    # 保存报告
    os.makedirs("reports", exist_ok=True)
    with open(f"reports/daily-report-{today}.md", "w", encoding="utf-8") as f:
        f.write(report)

    # 生成 Dashboard 使用的 JSON
    summary = {
        "date": today,
        "total_assets": round(total, 2),
        "current_allocation": {k: round(v * 100, 1) for k, v in current_allocation.items()},
        "target_allocation": {k: round(v * 100) for k, v in target.items()},
        "alerts": alerts,
        "updated_at": datetime.now().isoformat()
    }

    with open("portfolio-summary.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    print(f"✅ 专业报告已生成: reports/daily-report-{today}.md")
    print("✅ portfolio-summary.json 已更新")

if __name__ == "__main__":
    generate_report()
