import yaml
from datetime import datetime
from collections import defaultdict

def load_holdings():
    with open("holdings/holdings.yaml", "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

def generate_report():
    data = load_holdings()
    today = datetime.now().strftime("%Y-%m-%d")

    # 合并两个平台持仓
    all_holdings = []
    for platform in ["tencent", "alipay"]:
        for h in data[platform]["holdings"]:
            all_holdings.append(h)

    # 按类别汇总
    category_sum = defaultdict(float)
    for h in all_holdings:
        category_sum[h["category"]] += h["amount"]

    total = sum(category_sum.values())

    # 计算当前占比
    current_allocation = {k: round(v/total, 4) for k, v in category_sum.items()}
    target = data["target_allocation"]

    # 再平衡提示
    alerts = []
    for cat, target_pct in target.items():
        current_pct = current_allocation.get(cat, 0)
        diff = current_pct - target_pct
        if abs(diff) > 0.08:
            direction = "减持" if diff > 0 else "加仓"
            alerts.append(f"**{cat}** 当前 {current_pct*100:.1f}%uff08目标 {target_pct*100:.0f}%uff09，建议**{direction}**")

    # 生成 Markdown 报告
    report = f"""# 📊 基金监控日报 - {today}

## 一、组合概览
- **腾讯理财通总资产**: {data['tencent']['total_assets']} 元
- **蚂蚁财富总资产**: {data['alipay']['total_assets']} 元
- **合计总资产**: {total:.2f} 元

## 二、类别暴露（当前 vs 目标）

| 类别     | 当前金额 | 当前占比 | 目标占比 | 偏离情况     |
|----------|----------|----------|----------|--------------|
"""

    for cat in target.keys():
        curr = current_allocation.get(cat, 0)
        curr_amt = category_sum.get(cat, 0)
        tgt = target[cat]
        diff = curr - tgt
        status = "✅" if abs(diff) <= 0.08 else ("🔴 偏高" if diff > 0 else "🟡 偏低")
        report += f"| {cat} | {curr_amt:.2f} | {curr*100:.1f}% | {tgt*100:.0f}% | {status} |\n"

    report += "\n## 三、再平衡提醒\n"
    if alerts:
        for alert in alerts:
            report += f"- {alert}\n"
    else:
        report += "✅ 当前配置较为均衡，无需立即再平衡。\n"

    report += f"""
## 四、重点赛道观察
- **半导体** ：当前占比 {current_allocation.get('半导体', 0)*100:.1f}%
- **卫星/商业航天** ：当前占比 {current_allocation.get('卫星', 0)*100:.1f}%

---
*报告生成时间: {datetime.now().strftime("%Y-%m-%d %H:%M")}*
*数据来源: 手动维护 holdings.yaml*
"""

    # 保存报告
    import os
    os.makedirs("reports", exist_ok=True)
    with open(f"reports/daily-report-{today}.md", "w", encoding="utf-8") as f:
        f.write(report)

    print("报告已生成")

if __name__ == "__main__":
    generate_report()
