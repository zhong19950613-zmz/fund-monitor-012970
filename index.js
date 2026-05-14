const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const SERVERCHAN_KEY = process.env.SERVERCHAN_KEY || '';
const GMAIL_USER = process.env.GMAIL_USER || '';
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || '';
const TO_EMAIL = process.env.TO_EMAIL || '';

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'funds-to-monitor.json'), 'utf8'));
const funds = config.funds;

console.log(`[${new Date().toISOString()}] 开始基金监控 + 风控分析...\n`);

async function getFundData(code) {
  if (!code) return null;
  try {
    const res = await fetch(`https://fundgz.1234567.com.cn/js/${code}.js`);
    const text = await res.text();
    const jsonStr = text.match(/jsonpgz\((.*)\)/)?.[1];
    return jsonStr ? JSON.parse(jsonStr) : null;
  } catch (e) {
    return null;
  }
}

async function sendWechat(title, content) {
  if (!SERVERCHAN_KEY) return;
  try {
    await fetch(`https://sctapi.ftqq.com/${SERVERCHAN_KEY}.send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, desp: content })
    });
  } catch (e) {}
}

async function sendEmail(subject, htmlContent) {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD || !TO_EMAIL) return;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD
    }
  });

  await transporter.sendMail({
    from: GMAIL_USER,
    to: TO_EMAIL,
    subject,
    html: htmlContent
  });
}

async function monitorFunds() {
  let highRiskFunds = [];
  let allResults = [];

  for (const fund of funds.sort((a, b) => a.priority - b.priority)) {
    const data = await getFundData(fund.code);
    
    console.log(`=== ${fund.name} ===`);

    if (!data) {
      console.log('获取数据失败\n');
      continue;
    }

    const gsz = data.gsz || data.dwjz;
    const gszzl = parseFloat(data.gszzl) || 0;

    console.log(`净值: ${gsz} | 涨跌: ${gszzl}%`);

    let riskLevel = '低风险';
    let suggestion = '继续持有';

    if (gszzl <= -3.5) {
      riskLevel = '高风险';
      suggestion = '建议观望或减仓';
      highRiskFunds.push(fund.name);
    } else if (gszzl <= -2) {
      riskLevel = '中风险';
      suggestion = '建议观望';
    }

    console.log(`风险等级: ${riskLevel} | 建议: ${suggestion}\n`);

    allResults.push({
      name: fund.name,
      change: gszzl,
      risk: riskLevel,
      suggestion
    });
  }

  // 生成总结文本
  const summaryText = allResults.map(item => 
    `${item.name}: ${item.change}% | ${item.risk} | ${item.suggestion}`
  ).join('\n');

  console.log('========== 今日监控总结 ==========');
  console.log(summaryText);

  // 每天发送微信总结（无论是否有高风险）
  if (SERVERCHAN_KEY) {
    const title = highRiskFunds.length > 0 
      ? `基金监控日报 - ${highRiskFunds.length}只高风险` 
      : `基金监控日报 - ${new Date().toLocaleDateString('zh-CN')}`;
    
    await sendWechat(title, summaryText);
    console.log('已发送微信每日总结');
  }

  // 每天发送邮件总结
  if (GMAIL_USER && GMAIL_APP_PASSWORD && TO_EMAIL) {
    const emailHtml = `
      <h2>张先生 每日基金监控报告</h2>
      <p><strong>监控时间：</strong>${new Date().toLocaleString('zh-CN')}</p>
      <h3>监控结果：</h3>
      <pre style="background:#f4f4f4;padding:12px;border-radius:6px;">${summaryText}</pre>
      <p><strong>高风险基金数量：</strong>${highRiskFunds.length}</p>
    `;
    await sendEmail('每日基金监控报告', emailHtml);
    console.log('已发送邮件总结');
  }
}

monitorFunds();
