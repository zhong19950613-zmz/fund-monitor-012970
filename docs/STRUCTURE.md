# Project Structure

```
fund-monitor-012970/
├── data/
│   └── holdings.yaml          # 核心持仓配置（建议使用此文件）
├── scripts/
│   ├── analyze.py             # 主分析脚本（推荐）
│   └── daily_analysis.py      # 旧版本（可忽略）
├── reports/                   # 自动生成的报告（JSON + Markdown）
├── .github/
│   ├── workflows/
│   │   ├── daily-analysis.yml   # 每日自动化流程
│   │   └── daily-fund-report.yml  # 旧版本
│   └── ISSUE_TEMPLATE/
│       ├── bug_report.md
│       └── feature_request.md
├── docs/                      # 文档
├── CONTRIBUTING.md
└── README.md
```

## Key Files

- `data/holdings.yaml`: Main configuration. Edit this to change your portfolio.
- `scripts/analyze.py`: Core analysis engine with rebalance logic.
- `.github/workflows/daily-analysis.yml`: Runs every day at 9:00 Beijing time.

## Reports

Reports are automatically generated in the `reports/` folder after each run.