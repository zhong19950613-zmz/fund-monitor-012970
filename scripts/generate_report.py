import yaml
import json
import os
import requests
from datetime import datetime
from collections import defaultdict
import yfinance as yf

def get_market_perf():
    """获取三大指数昨天表现"""
    tickers = {
        "沪深300": "000300.SS",
        "半导体": "512480.SS",
        "纳斯达克100": "QQQ"
    }
    perf = {}
    for name, tk in tickers.items():
        try:
            hist = yf.Ticker(tk).history(period="2d", auto_adjust=True)
            if len(hist) >= 2:
                chg = (hist['Close'].iloc[-1] - hist['Close'].iloc[-2]) / hist['Close'].iloc[-2] * 100
                perf[name] = round(chg, 2)
            else:
                perf[name] = 0.0
        except:
            perf[name] = 0.0
    return perf

def main():
    today = datetime.now().strftime("%Y-%m-%d")
    print(f"=== 每日基金监测报告 {today} ===")

    # 读取 holdings
    with open("holdings/holdings.yaml", "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    all_holdings = []
    for platform in ["tencent", "alipay"]:
        for h in data.get(platform, {}).get("holdings", []):
            all_holdings.append({
                "name": h.get("name", ""),
                "amount": float(h.get("amount", 0)),
                "category": h.get("category", "其他")
            })

    # 类别汇总
    category_sum = defaultdict(float)
    for h in all_holdings:
        category_sum[h["category"]] += h["amount"]

    total = sum(category_sum.values()) or 1
    current_allocation = {k: v / total for k, v in category_sum.items()}
    target = data.get("target_allocation", {})

    # 偏差检测
    alerts = []
    max_dev = 0.0
    for cat, target_pct in target.items():
        curr_pct = current_allocation.get(cat, 0)
        diff = curr_pct - target_pct
        max_dev = max(max_dev, abs(diff))
        if abs(diff) > 0.08:
            direction = "减持" if diff > 0 else "加仓"
            alerts.append({
                "category": cat,
                "current_pct": round(curr_pct * 100, 1),
                "target_pct": round(target_pct * 100),
                "suggestion": direction,
                "diff": round(abs(diff) * 100, 1)
            })

    market_perf = get_market_perf()

    # 生成报告
    report = f"""# 📊 每日基金监测报告 - {today}

**检查时间**：{datetime.now().strftime("%Y-%m-%d %H:%M")}（北京时间）  
**组合总资产**：¥{total:,.2f}  
**数据来源**：holdings.yaml（腾讯理财通 + 蚂蚁财富）

---

## 一、类别配置偏差分析

| 类别 | 当前金额 | 当前占比 | 目标占比 | 偏差 | 状态 | 建议 |
|------|----------|----------|----------|------|------|------|
"""

    for cat in ["宽基", "半导体", "卫星", "防御", "其他成长"]:
        if cat in target:
            curr_amt = category_sum.get(cat, 0)
            curr_pct = current_allocation.get(cat, 0) * 100
            tgt_pct = target[cat] * 100
            diff = curr_pct - tgt_pct
            status = "✅ 均衡" if abs(diff) <= 8 else ("⚠️ 偏高" if diff > 0 else "🟡 偏低")
            suggestion = ""
            if abs(diff) > 8:
                suggestion = "减持" if diff > 0 else "加仓"
            report += f"| {cat} | ¥{curr_amt:,.2f} | {curr_pct:.1f}% | {tgt_pct:.0f}% | {diff:+.1f}% | {status} | {suggestion} |\n"

    # 健康度
    if max_dev > 0.08:
        health = "⚠️ **需要再平衡**（最大偏差超过8%）"
    elif max_dev > 0.05:
        health = "🟡 **关注中**（偏差5-8%）"
    else:
        health = "✅ **配置健康**（偏差控制良好）"

    report += f"\n**组合健康度**：{health}\n"

    # 再平衡建议
    report += "\n## 二、再平衡建议\n"
    if alerts:
        for a in alerts:
            report += f"- **{a['category']}** 当前 {a['current_pct']}%（目标 {a['target_pct']}%），建议 **{a['suggestion']}**（偏离 {a['diff']}%）\n"
        report += "\n> 建议在 1-3 个交易日内逐步执行。\n"
    else:
        report += "当前配置较为均衡，暂无明显再平衡需求。\n"

    # 市场影响
    report += f"""
## 三、市场指数影响（昨天）

| 指数 | 涨跌幅 | 影响方向 |
|------|--------|----------|
| 沪深300 | {market_perf.get('沪深300', 0):+.2f}% | {"正面 📈" if market_perf.get('沪深300', 0) > 0 else "负面 📉"} |
| 半导体 | {market_perf.get('半导体', 0):+.2f}% | {"正面 📈" if market_perf.get('半导体', 0) > 0 else "负面 📉"} |
| 纳斯达克100 | {market_perf.get('纳斯达克100', 0):+.2f}% | {"正面 📈" if market_perf.get('纳斯达克100', 0) > 0 else "负面 📉"} |

> 若您重仓半导体或宽基，上述涨跌幅会直接影响组合净值。

## 四、昨天表现总结
- 组合总资产：¥{total:,.2f}
- 市场环境：沪深300 {market_perf.get('沪深300', 0):+.2f}%，半导体 {market_perf.get('半导体', 0):+.2f}%
- 详细每日盈亏请结合实际交易记录查看。

---
**下次自动更新**：明日北京时间 09:00  
**报告生成**：GitHub Actions
"""

    # 保存报告
    os.makedirs("reports", exist_ok=True)
    with open(f"reports/daily-report-{today}.md", "w", encoding="utf-8") as f:
        f.write(report)

    # 更新 portfolio-summary.json
    summary = {
        "date": today,
        "total_assets": round(total, 2),
        "current_allocation": {k: round(v * 100, 1) for k, v in current_allocation.items()},
        "target_allocation": {k: round(v * 100) for k, v in target.items()},
        "alerts": alerts,
        "market_perf": market_perf,
        "max_deviation_pct": round(max_dev * 100, 1),
        "updated_at": datetime.now().isoformat()
    }
    with open("portfolio-summary.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    print("✅ 报告已生成并更新 portfolio-summary.json")

    # 微信推送（可选）
    sckey = os.getenv("SCKEY", "").strip()
    if sckey:
        try:
            url = f"https://sctapi.ftqq.com/{sckey}.send"
            title = f"📊 基金监测报告 {today}"
            desp = f"总资产 ¥{total:,.2f} | 最大偏差 {max_dev*100:.1f}% | {'需再平衡' if max_dev>0.08 else '健康'}\n\n完整报告见 repo reports/ 目录"
            requests.post(url, data={"title": title, "desp": desp}, timeout=10)
            print("✅ 微信推送成功")
        except Exception as e:
            print(f"⚠️ 推送失败: {e}")

if __name__ == "__main__":
    main()
