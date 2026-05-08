const fetch = require('node-fetch');
const nodemailer = require('nodemailer');
const fs = require('fs');

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const TO_EMAIL = process.env.TO_EMAIL || GMAIL_USER;
const HISTORY_FILE = 'history.json';

// 获取基金净值
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

// 发送邮件
async function sendEmailAlert(fundData) {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) return;
  const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD } });
  const change = parseFloat(fundData.gszzl);
  const subject = `【基金警报】${fundData.name} ${change > 0 ? '上涨' : '下跌'} ${Math.abs(change)}%`;
  const html = `<h2>基金警报</h2><p><strong>基金:</strong> ${fundData.name}</p><p><strong>净值:</strong> ${fundData.dwjz}</p><p><strong>涨跌:</strong> <span style="color:${change > 0 ? 'green' : 'red'}">${fundData.gszzl}%</span></p><p><strong>时间:</strong> ${fundData.gztime}</p>`;
  try {
    await transporter.sendMail({ from: GMAIL_USER, to: TO_EMAIL, subject, html });
    console.log('✅ 邮件已发送');
  } catch (e) { console.error('邮件发送失败:', e.message); }
}

// 读取历史数据
function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    }
  } catch (e) {}
  return [];
}

// 保存历史数据
function saveHistory(history) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

// 简单趋势分析
function analyzeTrend(history) {
  if (history.length < 3) return '数据不足，无法判断趋势';
  const last3 = history.slice(-3).map(h => parseFloat(h.change));
  const upDays = last3.filter(c => c > 0).length;
  if (upDays === 3) return '最近3天持续上涨，趋势向好，可考虑定投加仓';
  if (upDays === 0) return '最近3天持续下跌，建议观望';
  return '趋势震荡，建议继续观察';
}

// 主函数
async function main() {
  console.log('[' + new Date().toLocaleString('zh-CN') + '] 开始检查...');
  const fundData = await getFundNetValue();
  if (!fundData) return;

  console.log(`基金: ${fundData.name} | 涨跌: ${fundData.gszzl}%`);

  // 保存历史
  const history = loadHistory();
  history.push({
    date: fundData.jzrq,
    netValue: fundData.dwjz,
    change: fundData.gszzl,
    updateTime: fundData.gztime
  });
  // 只保留最近90天
  if (history.length > 90) history.shift();
  saveHistory(history);

  // 邮件提醒
  const change = parseFloat(fundData.gszzl);
  if (Math.abs(change) >= 2.0) {
    await sendEmailAlert(fundData);
  }

  // 趋势判断
  const trend = analyzeTrend(history);
  console.log('📈 趋势判断: ' + trend);

  console.log('检查完成');
}

main();