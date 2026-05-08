const fetch = require('node-fetch');
const nodemailer = require('nodemailer');
const fs = require('fs');

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const TO_EMAIL = process.env.TO_EMAIL || GMAIL_USER;
const PUSHPLUS_TOKEN = process.env.PUSHPLUS_TOKEN;

// 监控的基金列表
const FUNDS = [
  { code: '012970', name: '鹏华国证半导体芯片ETF联接C' },
  { code: '510300', name: '沪深300ETF' }
];

const THRESHOLD = 2.0;

async function getFundNetValue(code) {
  try {
    const response = await fetch(`http://fundgz.1234567.com.cn/js/${code}.js`);
    const text = await response.text();
    const jsonStr = text.replace('jsonpgz(', '').replace(');', '');
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error(`获取 ${code} 净值失败:`, error.message);
    return null;
  }
}

// 微信推送 (PushPlus)
async function sendWechatPush(fundData) {
  if (!PUSHPLUS_TOKEN) {
    console.log('PUSHPLUS_TOKEN 未设置，跳过微信推送');
    return;
  }
  const change = parseFloat(fundData.gszzl);
  const title = `【基金警报】${fundData.name} ${change > 0 ? '上涨' : '下跌'} ${Math.abs(change)}%`;
  const content = `基金: ${fundData.name}\n净值: ${fundData.dwjz}\n涨跌: ${fundData.gszzl}%\n时间: ${fundData.gztime}`;

  try {
    const res = await fetch('https://www.pushplus.plus/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: PUSHPLUS_TOKEN,
        title: title,
        content: content,
        template: 'txt'
      })
    });
    const result = await res.json();
    if (result.code === 200) {
      console.log(`✅ 微信推送成功: ${fundData.name}`);
    } else {
      console.error('微信推送失败:', result.msg);
    }
  } catch (e) {
    console.error('微信推送异常:', e.message);
  }
}

async function sendEmailAlert(fundData) {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) return;
  const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD } });
  const change = parseFloat(fundData.gszzl);
  const subject = `【基金警报】${fundData.name} ${change > 0 ? '上涨' : '下跌'} ${Math.abs(change)}%`;
  const html = `<h2>基金警报</h2><p><strong>基金:</strong> ${fundData.name}</p><p><strong>净值:</strong> ${fundData.dwjz}</p><p><strong>涨跌:</strong> <span style=\"color:${change > 0 ? 'green' : 'red'}\">${fundData.gszzl}%</span></p><p><strong>时间:</strong> ${fundData.gztime}</p>`;
  try {
    await transporter.sendMail({ from: GMAIL_USER, to: TO_EMAIL, subject, html });
    console.log(`✅ 邮件已发送: ${fundData.name}`);
  } catch (e) { console.error('邮件发送失败:', e.message); }
}

function loadHistory(code) {
  const file = `history-${code}.json`;
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {}
  return [];
}

function saveHistory(code, history) {
  const file = `history-${code}.json`;
  fs.writeFileSync(file, JSON.stringify(history, null, 2));
}

function analyzeTrend(history) {
  if (history.length < 5) return { suggestion: '数据不足，建议继续积累数据', level: 'info' };
  const last5 = history.slice(-5).map(h => parseFloat(h.change));
  const avg5 = (last5.reduce((a, b) => a + b, 0) / last5.length).toFixed(2);
  const upDays = last5.filter(c => c > 0).length;

  if (upDays >= 4 && parseFloat(avg5) > 0.5) return { suggestion: '最近5天强势上涨，适合定投加仓', level: 'good' };
  if (upDays <= 1 && parseFloat(avg5) < -0.5) return { suggestion: '最近5天偏弱，建议观望或小额定投', level: 'warn' };
  return { suggestion: '趋势震荡，建议保持定投节奏', level: 'info' };
}

async function processFund(fund) {
  console.log(`\n=== 正在检查: ${fund.name} (${fund.code}) ===`);
  const data = await getFundNetValue(fund.code);
  if (!data) return;

  console.log(`净值: ${data.dwjz} | 涨跌: ${data.gszzl}%`);

  const history = loadHistory(fund.code);
  history.push({ date: data.jzrq, netValue: data.dwjz, change: data.gszzl, updateTime: data.gztime });
  if (history.length > 90) history.shift();
  saveHistory(fund.code, history);

  const change = parseFloat(data.gszzl);
  if (Math.abs(change) >= THRESHOLD) {
    await sendWechatPush({ ...data, name: fund.name });
    await sendEmailAlert({ ...data, name: fund.name });
  }

  const trend = analyzeTrend(history);
  console.log(`📈 建议: ${trend.suggestion}`);
}

async function main() {
  console.log('[' + new Date().toLocaleString('zh-CN') + '] 开始多基金监控...');
  for (const fund of FUNDS) {
    await processFund(fund);
  }
  console.log('\n所有基金检查完成');
}

main();