const fetch = require('node-fetch');
const nodemailer = require('nodemailer');
const fs = require('fs');

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const TO_EMAIL = process.env.TO_EMAIL || GMAIL_USER;
const SERVERCHAN_KEY = process.env.SERVERCHAN_KEY;

const FUNDS = [
  { code: '012970', name: '鹏华国证半导体芯片ETF联接C' },
  { code: '510300', name: '沪深300ETF' }
];

const THRESHOLD = 2.0;

// 带重试和超时的 fetch
async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      console.log(`尝试 ${i + 1}/${retries} 失败: ${e.message}`);
      if (i === retries - 1) throw e;
      await new Promise(r => setTimeout(r, 1500));
    }
  }
}

async function getFundNetValue(code) {
  try {
    const text = await fetchWithRetry(`http://fundgz.1234567.com.cn/js/${code}.js`);
    const jsonStr = text.replace('jsonpgz(', '').replace(');', '');
    const data = JSON.parse(jsonStr);
    return {
      fundcode: code,
      name: data.name,
      dwjz: data.dwjz,
      gsz: data.gsz || data.dwjz,
      gszzl: data.gszzl || '0',
      jzrq: data.jzrq,
      gztime: data.gztime
    };
  } catch (e) {
    console.error(`${code} 获取失败:`, e.message);
    return null;
  }
}

// Server酱 微信推送
async function sendWechatPush(fundData) {
  if (!SERVERCHAN_KEY) {
    console.log('SERVERCHAN_KEY 未设置');
    return;
  }
  const change = parseFloat(fundData.gszzl);
  const title = `【基金警报】${fundData.name} ${change > 0 ? '上涨' : '下跌'} ${Math.abs(change)}%`;
  const desp = `基金: ${fundData.name}\n净值: ${fundData.dwjz}\n涨跌: ${fundData.gszzl}%\n时间: ${fundData.gztime}`;

  try {
    const res = await fetch(`https://sctapi.ftqq.com/${SERVERCHAN_KEY}.send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `title=${encodeURIComponent(title)}&desp=${encodeURIComponent(desp)}`
    });
    const result = await res.json();
    if (result.errno === 0) {
      console.log('✅ 微信推送成功 (Server酱):', fundData.name);
    } else {
      console.error('微信推送失败:', result.errmsg);
    }
  } catch (e) {
    console.error('微信推送异常:', e.message);
  }
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
      html: `<h3>${fundData.name}</h3><p>净值: ${fundData.dwjz} | 涨跌: <b style="color:${change > 0 ? 'green' : 'red'}">${fundData.gszzl}%</b></p>`
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
