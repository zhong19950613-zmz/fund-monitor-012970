const fetch = require('node-fetch');
const nodemailer = require('nodemailer');
const fs = require('fs');

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const TO_EMAIL = process.env.TO_EMAIL || GMAIL_USER;
const PUSHPLUS_TOKEN = process.env.PUSHPLUS_TOKEN;

const FUNDS = [
  { code: '012970', name: '鹏华国证半导体芯片ETF联接C' },
  { code: '510300', name: '沪深300ETF' }
];

const THRESHOLD = 2.0;

// 新浪财经接口（更稳定）
async function getFundNetValue(code) {
  try {
    const res = await fetch(`https://hq.sinajs.cn/list=fund${code}`, {
      headers: { 'Referer': 'https://finance.sina.com.cn' }
    });
    const text = await res.text();
    const match = text.match(/="(.+)"/);
    if (!match) throw new Error('解析失败');
    const arr = match[1].split(',');
    return {
      fundcode: code,
      name: arr[0],
      dwjz: arr[1],
      gsz: arr[2] || arr[1],
      gszzl: arr[3] || '0',
      jzrq: arr[4],
      gztime: arr[5] || arr[4]
    };
  } catch (e) {
    console.error(`${code} 获取失败:`, e.message);
    return null;
  }
}

async function sendWechatPush(fundData) {
  if (!PUSHPLUS_TOKEN) return;
  const change = parseFloat(fundData.gszzl);
  try {
    await fetch('https://www.pushplus.plus/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: PUSHPLUS_TOKEN,
        title: `【基金警报】${fundData.name} ${change > 0 ? '上涨' : '下跌'} ${Math.abs(change)}%`,
        content: `基金: ${fundData.name}\n净值: ${fundData.dwjz}\n涨跌: ${fundData.gszzl}%\n时间: ${fundData.gztime}`,
        template: 'txt'
      })
    });
    console.log('✅ 微信推送成功:', fundData.name);
  } catch (e) { console.error('微信推送失败'); }
}

async function sendEmailAlert(fundData) {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) return;
  const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD } });
  const change = parseFloat(fundData.gszzl);
  try {
    await transporter.sendMail({
      from: GMAIL_USER,
      to: TO_EMAIL,
      subject: `【基金警报】${fundData.name} ${change > 0 ? '上涨' : '下跌'} ${Math.abs(change)}%`,
      html: `<h3>${fundData.name}</h3><p>净值: ${fundData.dwjz} | 涨跌: <b style=\"color:${change > 0 ? 'green' : 'red'}\">${fundData.gszzl}%</b></p>`
    });
    console.log('✅ 邮件已发送:', fundData.name);
  } catch (e) { console.error('邮件发送失败'); }
}

function loadHistory(code) {
  try { return JSON.parse(fs.readFileSync(`history-${code}.json`, 'utf8')); } catch { return []; }
}

function saveHistory(code, history) {
  fs.writeFileSync(`history-${code}.json`, JSON.stringify(history, null, 2));
}

function analyzeTrend(history) {
  if (history.length < 5) return '数据不足';
  const last5 = history.slice(-5).map(h => parseFloat(h.change));
  const up = last5.filter(c => c > 0).length;
  if (up >= 4) return '最近5天强势，适合加仓';
  if (up <= 1) return '最近5天偏弱，建议观望';
  return '趋势震荡，保持定投';
}

async function processFund(fund) {
  console.log(`\n检查: ${fund.name} (${fund.code})`);
  const data = await getFundNetValue(fund.code);
  if (!data) return;
  console.log(`净值: ${data.dwjz} | 涨跌: ${data.gszzl}%`);

  const history = loadHistory(fund.code);
  history.push({ date: data.jzrq, netValue: data.dwjz, change: data.gszzl, updateTime: data.gztime });
  if (history.length > 90) history.shift();
  saveHistory(fund.code, history);

  const change = parseFloat(data.gszzl);
  if (Math.abs(change) >= THRESHOLD) {
    await sendWechatPush(data);
    await sendEmailAlert(data);
  }
  console.log('建议:', analyzeTrend(history));
}

async function main() {
  console.log('[' + new Date().toLocaleString('zh-CN') + '] 开始多基金监控...');
  for (const fund of FUNDS) {
    await processFund(fund);
  }
  console.log('完成');
}

main();