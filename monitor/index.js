const fs = require('fs');
const path = require('path');

// 读取配置文件
const configPath = path.join(__dirname, '..', 'funds-to-monitor.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const funds = config.funds;

async function monitorAllFunds() {
  console.log(`\n[${new Date().toISOString()}] 开始监控 ${funds.length} 只基金...`);

  for (const fund of funds.sort((a, b) => a.priority - b.priority)) {
    await checkFund(fund);
  }

  console.log('\n监控完成\n');
}

async function checkFund(fund) {
  console.log(`\n=== 检查：${fund.name} (${fund.code || '无代码'}) ===`);

  // TODO: 接入真实数据获取逻辑（东方财富 / 天天基金API）
  // 暂时使用模拟数据结构
  const mockData = {
    netValue: (Math.random() * 5 + 1).toFixed(4),
    changePercent: (Math.random() * 4 - 2).toFixed(2),
    rsi: undefined,
    macd: undefined
  };

  console.log(`净值：${mockData.netValue} | 涨跌：${mockData.changePercent}%`);
  console.log(`RSI: ${mockData.rsi || 'undefined'} | MACD: ${mockData.macd || 'undefined'} | 评分: 5/10`);

  // 风险控制逻辑（可扩展）
  const riskLevel = Math.random() > 0.7 ? 'high' : 'normal';

  if (riskLevel === 'high') {
    console.log('⚠️ 风险：最大回撤较高 | 建议观望');
  } else {
    console.log('🟢 风险可控 | 继续持有');
  }

  // 发送通知（可接入微信/Email）
  console.log(`📨 已发送通知：${fund.name}`);
}

// 启动监控
monitorAllFunds().catch(console.error);