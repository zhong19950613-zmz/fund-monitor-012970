#!/usr/bin/env python3
"""极简 SPCX 价格监控脚本
- 中文 key
- 简单涨跌幅检测（超过5%）
- 有风险提醒时自动微信推送（Server酷 SCKEY）
"""
import yfinance as yf
import json
import os
import requests
from datetime import datetime

THRESHOLD = 0.05  # 5% 阈值


def load_previous_price():
    path = "reports/spcx_latest.json"
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return data.get("价格")
        except:
            return None
    return None


def send_wechat(title, desp, sckey):
    if not sckey:
        return
    url = f"https://sctapi.ftqq.com/{sckey}.send"
    data = {"title": title, "desp": desp}
    try:
        requests.post(url, data=data, timeout=10)
    except Exception:
        pass  # 推送失败不影响主流程


def main():
    os.makedirs("reports", exist_ok=True)
    
    ticker = yf.Ticker("SPCX")
    hist = ticker.history(period="1d")
    
    if not hist.empty:
        new_price = float(hist["Close"].iloc[-1])
    else:
        new_price = None
    
    old_price = load_previous_price()
    
    change_pct = None
    alert = None
    
    if new_price is not None and old_price is not None and old_price != 0:
        change_pct = (new_price - old_price) / old_price
        if abs(change_pct) >= THRESHOLD:
            direction = "涨" if change_pct > 0 else "跌"
            alert = f"单日{direction}幅超过{int(THRESHOLD*100)}%，请注意风险"
    
    record = {
        "日期": str(datetime.now().date()),
        "价格": new_price,
        "涨跌幅": round(change_pct, 4) if change_pct is not None else None,
        "提醒": alert,
        "笔记": "SPCX价格追踪工作已启动。如需要可继续添加新闻关键词或更精细风险提醒。"
    }
    
    with open("reports/spcx_latest.json", "w", encoding="utf-8") as f:
        json.dump(record, f, ensure_ascii=False, indent=2)
    
    # 如果有风险提醒，则发送微信
    sckey = os.environ.get("SCKEY")
    if alert and sckey:
        title = "SPCX 价格风险提醒"
        desp = f"""**{alert}**

- 日期：{record['日期']}
- 当前价格：{new_price}
- 涨跌幅：{round(change_pct*100, 2)}%

请及时关注市场动态。"""
        send_wechat(title, desp, sckey)
        print("微信推送已发送")
    
    print(f"SPCX监控更新完成: 价格={new_price}, 涨跌幅={change_pct}")

if __name__ == "__main__":
    main()
