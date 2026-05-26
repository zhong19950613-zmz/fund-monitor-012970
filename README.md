# fund-monitor-012970

个人基金监控自动化项目

## 🚀 Phase 1 已完成功能

- `holdings/holdings.yaml` ：统一维护所有平台持仓（腾讯 + 蚂蚁）
- 每日自动生成带类别暴露和再平衡提醒的报告
- `portfolio-summary.json` ：供 Dashboard 使用的摘要数据

## 如何使用

1. 修改 `holdings/holdings.yaml` 更新持仓
2. 推送后每日会自动生成报告
3. 打开 GitHub Pages 查看最新 Dashboard

## 文件结构

- `holdings/holdings.yaml` - 持仓数据（主要维护文件）
- `scripts/generate_report.py` - 报告生成脚本
- `.github/workflows/daily-report.yml` - 每日自动化 workflow
- `index.html` - Dashboard 页面
- `reports/` - 历史报告

## 未来计划

- 更好的图表展示
- 自动获取公开基金数据
- 更多智能分析
