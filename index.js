const fetch = require('node-fetch');
const nodemailer = require('nodemailer');
const fs = require('fs');

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const TO_EMAIL = process.env.TO_EMAIL || GMAIL_USER;
const SERVERCHAN_KEY = process.env.SERVERCHAN_KEY;

const FUNDS = [
  { code: '012970', name: '鹏华国证半导体芯片ETF联接C' },
  { code: '159915', name: '易方达创业板ETF联接C' },
  { code: '510300', name: '沪深300ETF' }
];

const THRESHOLD = 2.0;

// ==================== 技术指标计算 ====================

function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  let rs = avgGain / avgLoss;
  let rsi = 100 - (100 / (1 + rs));
  return parseFloat(rsi.toFixed(2));
}

function calculateMACD(prices, fast = 12, slow = 26, signal = 9) {
  if (prices.length < slow) return null;
  const emaFast = calculateEMA(prices, fast);
  const emaSlow = calculateEMA(prices, slow);
  const macdLine = emaFast - emaSlow;
  return parseFloat(macdLine.toFixed(4));
}

function calculateEMA(prices, period) {
  let ema = prices[0];
  const k = 2 / (period + 1);
  for (let i = 1; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}

// ==================== 智能投资建议 ====================

function getSmartSuggestion(history) {
  if (history.length < 20) {
    return { score: 5, suggestion: '数据不足，建议继续定投', reason: '至少需要20天数据才能准确判断' };
  }

  const prices = history.map(h => parseFloat(h.netValue));
  const changes = history.map(h => parseFloat(h.change));

  const rsi = calculateRSI(prices);
  const macd = calculateMACD(prices);
  const last5Up = changes.slice(-5).filter(c => c > 0).length;
  const avg5 = changes.slice(-5).reduce((a, b) => a + b, 0) / 5;

  let score = 5;
  let reasons = [];

  if (rsi < 30) { score += 2; reasons.push('RSI超卖'); }
  else if (rsi > 70) { score -= 1.5; reasons.push('RSI超买'); }
  else { score += 0.5; }

  if (macd > 0) { score += 1.5; reasons.push('MACD金叉趋势向上'); }
  else { score -= 1; reasons.push('MACD死叉趋势向下'); }

  if (last5Up >= 4 && avg5 > 0.8) { score += 2; reasons.push('短期强势上涨'); }
  else if (last5Up <= 1 && avg5 < -0.8) { score -= 1.5; reasons.push('短期偏弱'); }

  let suggestion = '';
  if (score >= 8) suggestion = '强烈建议加仓 80-120元';
  else if (score >= 6.5) suggestion = '建议加仓 50-80元';
  else if (score >= 5) suggestion = '建议继续定投 30-50元';
  else if (score >= 3.5) suggestion = '建议观望，等待更好时机';
  else suggestion = '建议暂时减仓观望';

  return {
    score: parseFloat(score.toFixed(1)),
    suggestion,
    reason: reasons.join(' + '),
    rsi: rsi ? rsi.toFixed(1) : '-',
    macd: macd ? macd.toFixed(4) : '-'
  };
}

// ==================== 主流程 ====================

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

async function sendWechatPush(fundData, suggestion = '') {
  if (!SERVERCHAN_KEY) return;
  const change = parseFloat(fundData.gszzl);
  const title = `【基金警报】${fundData.name} ${change > 0 ? '上涨' : '下跌'} ${Math.abs(change)}%`;
  const desp = `基金: ${fundData.name}\n净值: ${fundData.dwjz}\n涨跌: ${fundData.gszzl}%\n\n【智能建议】${suggestion}`;

  try {
    await fetch(`https://sctapi.ftqq.com/${SERVERCHAN_KEY}.send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `title=${encodeURIComponent(title)}&desp=${encodeURIComponent(desp)}`
    });
    console.log('✅ 微信推送成功:', fundData.name);
  } catch (e) { console.error('微信推送失败'); }
}

async function sendEmailAlert(fundData, suggestion = '') {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) return;
  const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD } });
  const change = parseFloat(fundData.gszzl);
  try {
    await transporter.sendMail({
      from: GMAIL_USER,
      to: TO_EMAIL,
      subject: `【基金警报】${fundData.name} ${change > 0 ? '上涨' : '下跌'} ${Math.abs(change)}%`,
      html: `<h3>${fundData.name}</h3><p>净值: ${fundData.dwjz} | 涨跌: <b style=\"color:${change > 0 ? 'green' : 'red'}\">${fundData.gszzl}%</b></p><p><b>智能建议:</b> ${suggestion}</p>`
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

async function processFund(fund) {
  console.log(`\n=== 检查: ${fund.name} (${fund.code}) ===`);
  const data = await getFundNetValue(fund.code);
  if (!data) return;
  console.log(`净值: ${data.dwjz} | 涨跌: ${data.gszzl}%`);

  const history = loadHistory(fund.code);
  history.push({ date: data.jzrq, netValue: data.dwjz, change: data.gszzl, updateTime: data.gztime });
  if (history.length > 90) history.shift();
  saveHistory(fund.code, history);

  const smart = getSmartSuggestion(history);
  console.log(`📊 RSI: ${smart.rsi} | MACD: ${smart.macd} | 评分: ${smart.score}/10`);
  console.log(`💡 建议: ${smart.suggestion}`);
  console.log(`理由: ${smart.reason}`);

  // 每天都推送智能建议到微信
  await sendWechatPush(data, smart.suggestion);

  const change = parseFloat(data.gszzl);
  if (Math.abs(change) >= THRESHOLD) {
    await sendEmailAlert(data, smart.suggestion);
  }
}

async function main() {
  console.log('[' + new Date().toLocaleString('zh-CN') + '] 开始智能监控...');
  for (const fund of FUNDS) {
    await processFund(fund);
  }
  console.log('完成');
}

main();