#!/usr/bin/env python3
"""极简 SPCX 价格监控脚本
运行后更新 reports/spcx_latest.json
"""
import yfinance as yf
import json
import os
from datetime import datetime

def main():
    os.makedirs("reports", exist_ok=True)
    
    ticker = yf.Ticker("SPCX")
    hist = ticker.history(period="1d")
    
    if not hist.empty:
        price = float(hist["Close"].iloc[-1])
    else:
        price = None
    
    record = {
        "date": str(datetime.now().date()),
        "price": price,
        "note": "SPCX price tracking started post-IPO. Add news keywords or deviation alerts later if needed."
    }
    
    with open("reports/spcx_latest.json", "w", encoding="utf-8") as f:
        json.dump(record, f, ensure_ascii=False, indent=2)
    
    print(f"SPCX latest price updated: {price}")

if __name__ == "__main__":
    main()
