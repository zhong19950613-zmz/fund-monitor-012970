# 📊 个人基金监控自动化系统 (fund-monitor-012970)

个人基金持仓统一管理 + 每日自动报告 + Dashboard 系统。

## 核心功能

- 统一维护腾讯理财通 + 蚂蚁财富持仓（`holdings/holdings.yaml`）
- 每日自动生成专业 Markdown 报告（含类别偏差、再平衡建议、市场影响）
- 自动更新 `portfolio-summary.json` 供 Dashboard 使用
- 支持微信推送（Server酱）
- 静态 GitHub Pages Dashboard

## 快速开始

### 1. 配置持仓数据

编辑 `holdings/holdings.yaml`，更新以下内容：

```yaml
last_updated: "2026-06-01"
tencent:
  total_assets: 12345.67
  holdings:
    - name: "华泰柏瑞沪深300ETF联接C"
      amount: 3500.00
      category: "宽基"
    # ... 其他持仓
alipay:
  total_assets: 8765.43
  holdings: [...]
target_allocation:
  宽基: 0.38
  半导体: 0.15
  卫星: 0.10
  防御: 0.20
  其他成长: 0.17
```

### 2. 配置微信推送（可选但推荐）

1. 去 [Server酱](https://sct.ftqq.com/) 获取 SCKEY
2. 在仓库 **Settings → Secrets and variables → Actions** 新建 Secret：
   - Name: `SCKEY`
   - Value: 你的 SCKEY

### 3. 启用 GitHub Pages

1. 仓库 Settings → Pages
2. Source 选择 `Deploy from a branch` → `main` 分支 → `/ (root)`
3. 保存后访问 `https://你的用户名.github.io/fund-monitor-012970` 查看 Dashboard

## 日常使用

- 修改 `holdings/holdings.yaml` 后推送，系统会在**次日北京时间 09:00** 自动生成报告
- 也可手动触发：Actions → `Daily Fund Report` → `Run workflow`

## 本地运行

```bash
git clone https://github.com/zhong19950613-zmz/fund-monitor-012970.git
cd fund-monitor-012970

python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

pip install -r requirements.txt

# 本地生成一次报告（不会推送微信）
python scripts/generate_report.py
```

## 文件结构

```
fund-monitor-012970/
├── holdings/
│   └── holdings.yaml          # 唯一需要手动维护的文件
├── scripts/
│   └── generate_report.py     # 报告生成核心脚本
├── reports/                   # 历史报告（自动生成）
├── portfolio-summary.json     # Dashboard 数据源（自动生成）
├── index.html                 # 静态 Dashboard
├── requirements.txt
├── .github/workflows/
│   └── daily-report.yml       # 唯一保留的定时 workflow
└── README.md
```

## 注意事项

- 目前持仓金额为**手动维护**（`amount` 字段）
- 如需自动获取实时净值，可在 holdings.yaml 中为每只基金增加 `ticker` 和 `shares` 字段后联系我升级脚本
- 多个旧 workflow 已清理，只保留 `daily-report.yml`

## 未来计划

- 支持 holdings.yaml 增加 ticker 后自动拉取实时价格
- Dashboard 增加简单图表（Chart.js）
- 增加定投执行记录模块

---

**维护者**：张铭忠  
**最后更新**：2026-06-01
