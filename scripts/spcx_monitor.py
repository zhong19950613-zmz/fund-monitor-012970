#!/usr/bin/env python3
"""极简 SPCX 价格监控脚本
- 中文 key
- 每天自动推送简报
- 涨跌幅 ≥ 3% 时发送风险提醒
- 包含 SpaceX 上市前后观察要点
"""
import yfinance as yf
import json
import os
import requests
from datetime import datetime

THRESHOLD = 0.03  # 3%


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
            alert = f"单日{direction}幅超过3%，请注意风险"
    
    record = {
        "日期": str(datetime.now().date()),
        "价格": new_price,
        "涨跌幅": round(change_pct, 4) if change_pct is not None else None,
        "提醒": alert,
        "笔记": "SPCX监控已启动。每天自动推送上市观察要点。"
    }
    
    with open("reports/spcx_latest.json", "w", encoding="utf-8") as f:
        json.dump(record, f, ensure_ascii=False, indent=2)
    
    sckey = os.environ.get("SCKEY")
    if sckey:
        change_str = f"{round(change_pct * 100, 2)}%" if change_pct else "N/A"
        
        if alert:
            title = "⚠️ SPCX 风险提醒 + 上市观察"
            desp = f"""**{alert}**

**SPCX价格**
- 日期：{record['日期']}
- 当前价格：{new_price}
- 涨跌幅：{change_str}

**SpaceX上市观察要点**
- 距离预计上市日（6月12日）越来越近
- 建议关注南方纳斯达克100 QDII表现
- 建议继续观察剩余半导体持仓

请及时关注市场动态。"""
        else:
            title = "SPCX 日常简报 + 上市观察"
            desp = f"""**{record['日期']} SPCX 日常简报**

**SPCX价格**
- 当前价格：{new_price}
- 涨跌幅：{change_str}

**SpaceX上市观察要点**
- 距离预计上市日（6月12日）越来越近
- 建议关注南方纳斯达克100 QDII表现
- 建议继续观察剩余半导体持仓

无明显波动，持续观察中。"""
        
        send_wechat(title, desp, sckey)
        print("微信日报已推送")
    
    print(f"SPCX监控更新完成: 价格={new_price}, 涨跌幅={change_pct}")

if __name__ == "__main__":
    main()
