#!/usr/bin/env python3
"""
Daily Fund Report Generator
- 读取 holdings/holdings.yaml
- 计算类别配置偏差
- 生成专业 Markdown 报告 + portfolio-summary.json
- 支持微信推送 (通过 SCKEY)
"""
import yaml
import json
import os
import sys
from datetime import datetime
from collections import defaultdict
import yfinance as yf
import requests

def get_market_performance():
    """获取三大指数昨天表现"""
    tickers = {
        "沪深300": "000300.SS",
        "半导体": "512480.SS",
        "纳斯达克100": "QQQ"
    }
    perf = {}
    for name, symbol in tickers.items():
        try:
            hist = yf.Ticker(symbol).history(period="2d", auto_adjust=True)
            if len(hist) >= 2:
                change = (hist['Close'].iloc[-1] - hist['Close'].iloc[-2]) / hist['Close'].iloc[-2] * 100
                perf[name] = round(change, 2)
            else:
                perf[name] = 0.0
        except Exception as e:
            print(f"Warning: 获取 {name} 数据失败 - {e}")
            perf[name] = 0.0
    return perf

def main():
    today = datetime.now().strftime("%Y-%m-%d")
    print(f"=== 开始生成每日基金监测报告 {today} ===")

    holdings_path = "holdings/holdings.yaml"
    if not os.path.exists(holdings_path):
        print(f"错误: {holdings_path} 不存在")
        sys.exit(1)

    with open(holdings_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    # 合并所有平台持仓
    all_holdings = []
    for platform in ["tencent", "alipay"]:
        for h in data.get(platform, {}).get("holdings", []):
            all_holdings.append({
                "name": h.get("name", "未知"),
                "amount": float(h.get("amount", 0)),
                "category": h.get("category", "其他")
            })

    # 按类别汇总
    category_sum = defaultdict(float)
    for h in all_holdings:
        category_sum[h["category"]] += h["amount"]

    total = sum(category_sum.values()) or 1.0
    current_allocation = {k: v / total for k, v in category_sum.items()}
    target = data.get("target_allocation", {})

    # 计算偏差和再平衡建议
    alerts = []
    max_deviation = 0.0
    for cat, target_pct in target.items():
        curr_pct = current_allocation.get(cat, 0.0)
        diff = curr_pct - target_pct
        max_deviation = max(max_deviation, abs(diff))
        if abs(diff) > 0.08:
            direction = "减持" if diff > 0 else "加仓"
            alerts.append({
                "category": cat,
                "current_pct": round(curr_pct * 100, 1),
                "target_pct": round(target_pct * 100),
                "suggestion": direction,
                "diff_pct": round(abs(diff) * 100, 1)
            })

    market_perf = get_market_performance()

    # 生成 Markdown 报告
    report_lines = [
        f"# 📊 每日基金监测报告 - {today}",
        "",
        f"**检查时间**：{datetime.now().strftime('%Y-%m-%d %H:%M')}（北京时间）",
        f"**组合总资产**：¥{total:,.2f}",
        f"**数据来源**：holdings.yaml（腾讯理财通 + 蚂蚁财富）",
        "",
        "## 一、类别配置偏差分析",
        "",
        "| 类别 | 当前金额 | 当前占比 | 目标占比 | 偏差 | 状态 | 建议 |",
        "|------|----------|----------|----------|------|------|------|",
    ]

    category_order = ["宽基", "半导体", "卫星", "防御", "其他成长"]
    for cat in category_order:
        if cat in target:
            curr_amt = category_sum.get(cat, 0)
            curr_pct = current_allocation.get(cat, 0) * 100
            tgt_pct = target[cat] * 100
            diff = curr_pct - tgt_pct
            if abs(diff) <= 8:
                status = "✅ 均衡"
            elif diff > 0:
                status = "⚠️ 偏高"
            else:
                status = "🟡 偏低"
            suggestion = ""
            if abs(diff) > 8:
                suggestion = "减持" if diff > 0 else "加仓"
            report_lines.append(
                f"| {cat} | ¥{curr_amt:,.2f} | {curr_pct:.1f}% | {tgt_pct:.0f}% | {diff:+.1f}% | {status} | {suggestion} |"
            )

    # 健康度判断
    if max_deviation > 0.08:
        health_status = "⚠️ **需要再平衡**（最大偏差超过 8%）"
    elif max_deviation > 0.05:
        health_status = "🟡 **关注中**（偏差 5-8%）"
    else:
        health_status = "✅ **配置健康**（偏差控制良好）"

    report_lines.extend([
        "",
        f"**组合健康度**：{health_status}",
        "",
        "## 二、再平衡建议",
        "",
    ])

    if alerts:
        for a in alerts:
            report_lines.append(
                f"- **{a['category']}** 当前 {a['current_pct']}%（目标 {a['target_pct']}%），建议 **{a['suggestion']}**（偏离 {a['diff_pct']}%）"
            )
        report_lines.append("\n> 建议在接下来 1-3 个交易日内逐步执行，避免一次性大额操作。")
    else:
        report_lines.append("当前配置较为均衡，暂无明显再平衡需求。")

    # 市场影响
    report_lines.extend([
        "",
        "## 三、市场指数影响（昨天）",
        "",
        "| 指数 | 涨跌幅 | 影响方向 |",
        "|------|--------|----------|",
        f"| 沪深300 | {market_perf.get('沪深300', 0):+.2f}% | {'正面 📈' if market_perf.get('沪深300', 0) > 0 else '负面 📉'} |",
        f"| 半导体 | {market_perf.get('半导体', 0):+.2f}% | {'正面 📈' if market_perf.get('半导体', 0) > 0 else '负面 📉'} |",
        f"| 纳斯达克100 | {market_perf.get('纳斯达克100', 0):+.2f}% | {'正面 📈' if market_perf.get('纳斯达克100', 0) > 0 else '负面 📉'} |",
        "",
        "> 若组合重仓半导体或宽基，上述涨跌幅会直接影响总资产。",
        "",
        "## 四、昨天表现总结",
        "",
        f"- 组合总资产：¥{total:,.2f}",
        f"- 市场环境：沪深300 {market_perf.get('沪深300', 0):+.2f}%，半导体 {market_perf.get('半导体', 0):+.2f}%",
        "- 详细每日盈亏请结合实际交易记录查看。",
        "",
        "---",
        "**下次自动更新**：明日北京时间 09:00",
        "**报告生成**：GitHub Actions",
    ])

    report_content = "\n".join(report_lines)

    # 保存报告
    os.makedirs("reports", exist_ok=True)
    with open(f"reports/daily-report-{today}.md", "w", encoding="utf-8") as f:
        f.write(report_content)

    with open("reports/latest-report.md", "w", encoding="utf-8") as f:
        f.write(report_content)

    # 更新 portfolio-summary.json
    summary = {
        "date": today,
        "total_assets": round(total, 2),
        "current_allocation": {k: round(v * 100, 1) for k, v in current_allocation.items()},
        "target_allocation": {k: round(v * 100) for k, v in target.items()},
        "alerts": alerts,
        "market_perf": market_perf,
        "max_deviation_pct": round(max_deviation * 100, 1),
        "health_status": health_status,
        "updated_at": datetime.now().isoformat()
    }
    with open("portfolio-summary.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    print("✅ Markdown 报告已生成")
    print("✅ portfolio-summary.json 已更新")

    # 微信推送（可选）
    sckey = os.getenv("SCKEY", "").strip()
    if sckey:
        try:
            url = f"https://sctapi.ftqq.com/{sckey}.send"
            title = f"📊 基金监测报告 {today}"
            desp = (
                f"总资产：¥{total:,.2f}\n"
                f"最大偏差：{max_deviation*100:.1f}%\n"
                f"健康状态：{health_status}\n\n"
                f"完整报告见仓库 reports/ 目录"
            )
            resp = requests.post(url, data={"title": title, "desp": desp}, timeout=10)
            if resp.status_code == 200:
                print("✅ 微信推送成功")
            else:
                print(f"⚠️ 微信推送失败: {resp.text}")
        except Exception as e:
            print(f"⚠️ 微信推送异常: {e}")
    else:
        print("ℹ️ 未配置 SCKEY，跳过微信推送")

    print("=== 报告生成完成 ===")

if __name__ == "__main__":
    main()
