# How to Configure

## 1. Edit your portfolio

Open `data/holdings.yaml` and modify:

- `portfolio.target_allocation`: Your target asset allocation
- `holdings`: List of your actual holdings with current weights
- `risk_control.rebalance_threshold`: When to trigger rebalance suggestions

## 2. Run analysis locally

```bash
python scripts/analyze.py
```

## 3. Automation

The workflow `.github/workflows/daily-analysis.yml` runs every day at 09:00 Beijing time.

You can also manually trigger it from the Actions tab in GitHub.

## 4. Reports

Reports are saved in `reports/` folder after each run.