const fetch = require('node-fetch');
const nodemailer = require('nodemailer');
const fs = require('fs');

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const TO_EMAIL = process.env.TO_EMAIL || GMAIL_USER;
const HISTORY_FILE = 'history.json';

async function getFundNetValue() {
  try {
    const response = await fetch('http://fundgz.1234567.com.cn/js/012970.js');
    const text = await response.text();
    const jsonStr = text.replace('jsonpgz(', '').replace(');', '');
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('获取净值失败:', error.message);
    return null;
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
    console.log('✅ 邮件已发送');
  } catch (e) { console.error('邮件发送失败:', e.message); }
}

function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
  } catch (e) {}
  return [];
}

function saveHistory(history) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

// 增强版趋势分析
function analyzeTrend(history) {
  if (history.length < 5) return { suggestion: '数据不足，建议继续积累数据', level: 'info' };

  const changes = history.slice(-10).map(h => parseFloat(h.change));
  const last5 = changes.slice(-5);
  const last3 = changes.slice(-3);

  const avg5 = last5.reduce((a, b) => a + b, 0) / last5.length;
  const upDays5 = last5.filter(c => c > 0).length;
  const upDays3 = last3.filter(c => c > 0).length;

  let suggestion = '';
  let level = 'info';

  if (upDays5 >= 4 && avg5 > 0.5) {
    suggestion = '最近5天强势上涨，趋势明确向好，适合定投加仓';
    level = 'good';
  } else if (upDays5 <= 1 && avg5 < -0.5) {
    suggestion = '最近5天偏弱，建议观望或小额定投';
    level = 'warn';
  } else if (upDays3 === 3) {
    suggestion = '短期连续上涨，可考虑加仓';
    level = 'good';
  } else if (upDays3 === 0) {
    suggestion = '短期连续下跌，建议暂停加仓，观望为主';
    level = 'warn';
  } else {
    suggestion = '趋势震荡，建议保持定投节奏';
    level = 'info';
  }

  return { suggestion, level, avg5: avg5.toFixed(2) };
}

async function main() {
  console.log('[' + new Date().toLocaleString('zh-CN') + '] 开始检查...');
  const fundData = await getFundNetValue();
  if (!fundData) return;

  console.log(`基金: ${fundData.name} | 涨跌: ${fundData.gszzl}%`);

  const history = loadHistory();
  history.push({
    date: fundData.jzrq,
    netValue: fundData.dwjz,
    change: fundData.gszzl,
    updateTime: fundData.gztime
  });
  if (history.length > 90) history.shift();
  saveHistory(history);

  const change = parseFloat(fundData.gszzl);
  if (Math.abs(change) >= 2.0) {
    await sendEmailAlert(fundData);
  }

  const trend = analyzeTrend(history);
  console.log('📈 建议: ' + trend.suggestion);
  if (trend.avg5) console.log('近5日平均涨跌: ' + trend.avg5 + '%');

  console.log('检查完成');
}

main();