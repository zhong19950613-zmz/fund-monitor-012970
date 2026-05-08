# fund-monitor-012970

自动化监控鹏华国证半导体芯片ETF联接C (012970)

## 功能
- 每日自动获取最新净值
- 计算日涨跌幅
- 大幅涨跌时发送邮件提醒

## 技术栈
- Node.js
- GitHub Actions 每日自动运行
- EastMoney 公开接口

## 快速开始

```bash
git clone https://github.com/zhong19950613-zmz/fund-monitor-012970.git
cd fund-monitor-012970
```

## 运行

```bash
node index.js
```

## 自动化
已配置 GitHub Actions，每日 18:00 北京时间自动运行。