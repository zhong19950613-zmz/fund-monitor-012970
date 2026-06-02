#!/usr/bin/env python3
"""极简 SPCX 价格监控脚本
- 中文 key
- 简单涨跌幅检测（超过5%记录提醒）
"""
import yfinance as yf
import json
import os
from datetime import datetime

THRESHOLD = 0.05  # 5% 涨跌幅阈值


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
    
    print(f"SPCX监控更新完成: 价格={new_price}, 涨跌幅={change_pct}")

if __name__ == "__main__":
    main()
