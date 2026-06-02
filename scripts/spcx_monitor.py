#!/usr/bin/env python3
"""极简 SPCX 价格监控脚本
- 中文 key
- 每天都推送简报（无论是否涨跌）
- 涨跌幅 ≥ 3% 时显示风险提醒
"""
import yfinance as yf
import json
import os
import requests
from datetime import datetime

THRESHOLD = 0.03  # 修改为 3%


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
        pass


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
        "笔记": "SPCX价格追踪工作已启动。每天自动推送简报。"
    }
    
    with open("reports/spcx_latest.json", "w", encoding="utf-8") as f:
        json.dump(record, f, ensure_ascii=False, indent=2)
    
    # 每天都推送简报
    sckey = os.environ.get("SCKEY")
    if sckey:
        if alert:
            title = "⚠️ SPCX 价格风险提醒"
            desp = f"""**{alert}**

- 日期：{record['日期']}
- 当前价格：{new_price}
- 涨跌幅：{round(change_pct * 100, 2)}%

请及时关注市场动态。"""
        else:
            title = "SPCX 日常简报"
            desp = f"""**{record['日期']} SPCX 日常简报**

- 当前价格：{new_price}
- 涨跌幅：{round(change_pct * 100, 2) if change_pct else 'N/A'}%

无明显波动，持续观察中。"""
        send_wechat(title, desp, sckey)
        print("微信日报已推送")
    
    print(f"SPCX监控更新完成: 价格={new_price}, 涨跌幅={change_pct}")

if __name__ == "__main__":
    main()
