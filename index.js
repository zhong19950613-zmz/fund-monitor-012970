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

// ==================== 精准交易信号 ====================

function getSmartSuggestion(history) {
  if (history.length < 20) {
    return { score: 5, action: '观望', amount: 30, target: null, stopLoss: null, reason: '数据不足' };
  }

  const prices = history.map(h => parseFloat(h.netValue));
  const changes = history.map(h => parseFloat(h.change));
  const latestPrice = prices[prices.length - 1];

  const rsi = calculateRSI(prices);
  const macd = calculateMACD(prices);
  const last5Up = changes.slice(-5).filter(c => c > 0).length;
  const avg5 = changes.slice(-5).reduce((a, b) => a + b, 0) / 5;

  let score = 5;
  let reasons = [];

  if (rsi < 30) { score += 2; reasons.push('RSI超卖'); }
  else if (rsi > 70) { score -= 1.5; reasons.push('RSI超买'); }
  else { score += 0.5; }

  if (macd > 0) { score += 1.5; reasons.push('MACD金叉'); }
  else { score -= 1; reasons.push('MACD死叉'); }

  if (last5Up >= 4 && avg5 > 0.8) { score += 2; reasons.push('短期强势'); }
  else if (last5Up <= 1 && avg5 < -0.8) { score -= 1.5; reasons.push('短期偏弱'); }

  let action = '观望';
  let amount = 30;
  let target = null;
  let stopLoss = null;

  if (score >= 8) {
    action = '买入';
    amount = 80;
    target = (latestPrice * 1.045).toFixed(2);
    stopLoss = (latestPrice * 0.977).toFixed(2);
  } else if (score >= 6.5) {
    action = '加仓';
    amount = 50;
    target = (latestPrice * 1.035).toFixed(2);
    stopLoss = (latestPrice * 0.98).toFixed(2);
  } else if (score >= 5) {
    action = '定投';
    amount = 30;
  } else if (score >= 3.5) {
    action = '观望';
  } else {
    action = '减仓';
    amount = 30;
  }

  return {
    score: parseFloat(score.toFixed(1)),
    action,
    amount,
    target,
    stopLoss,
    reason: reasons.join(' + '),
    rsi: rsi ? rsi.toFixed(1) : '-',
    macd: macd ? macd.toFixed(4) : '-'
  };
}

// ==================== 风险控制模块 ====================

function calculateMaxDrawdown(history) {
  if (history.length < 2) return 0;
  let maxDrawdown = 0;
  let peak = parseFloat(history[0].netValue);

  for (let i = 1; i < history.length; i++) {
    const price = parseFloat(history[i].netValue);
    if (price > peak) peak = price;
    const drawdown = ((peak - price) / peak) * 100;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }
  return parseFloat(maxDrawdown.toFixed(1));
}

function getRiskControl(history, fundName) {
  if (history.length < 10) {
    return { maxDrawdown: 0, riskScore: 5, warning: '数据不足' };
  }

  const maxDrawdown = calculateMaxDrawdown(history);
  const latestChange = parseFloat(history[history.length - 1].change);

  let riskScore = 5;
  let warning = '';

  if (maxDrawdown > 15) { riskScore += 2; warning = '最大回撤过大'; }
  if (latestChange < -5) { riskScore += 2; warning = '单日大跌警告'; }
  if (maxDrawdown > 10 && latestChange < -3) { riskScore += 1; warning = '高风险状态'; }

  return {
    maxDrawdown,
    riskScore: Math.min(riskScore, 10),
    warning: warning || '风险可控'
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

async function sendWechatPush(fundData, smart, risk = null) {
  if (!SERVERCHAN_KEY) return;
  const change = parseFloat(fundData.gszzl);
  let title = `【今日信号】${fundData.name} ${change > 0 ? '上涨' : '下跌'} ${Math.abs(change)}%`;
  let desp = `基金: ${fundData.name}\n净值: ${fundData.dwjz}\n涨跌: ${fundData.gszzl}%\n\n【智能建议】\n操作: ${smart.action} ${smart.amount}元\n`;

  if (smart.target) desp += `目标价: ${smart.target}\n`;
  if (smart.stopLoss) desp += `止损价: ${smart.stopLoss}\n`;
  desp += `评分: ${smart.score}/10\n理由: ${smart.reason}\n`;

  if (risk) {
    desp += `\n【风险控制】\n最大回撤: ${risk.maxDrawdown}%\n风险评分: ${risk.riskScore}/10\n状态: ${risk.warning}`;
  }

  try {
    await fetch(`https://sctapi.ftqq.com/${SERVERCHAN_KEY}.send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `title=${encodeURIComponent(title)}&desp=${encodeURIComponent(desp)}`
    });
    console.log('✅ 微信推送成功:', fundData.name);
  } catch (e) { console.error('微信推送失败'); }
}

async function sendEmailAlert(fundData, smart, risk = null) {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) return;
  const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD } });
  const change = parseFloat(fundData.gszzl);
  let html = `<h3>${fundData.name}</h3><p>净值: ${fundData.dwjz} | 涨跌: <b style=\"color:${change > 0 ? 'green' : 'red'}\">${fundData.gszzl}%</b></p>`;
  html += `<p><b>操作:</b> ${smart.action} ${smart.amount}元</p>`;
  if (smart.target) html += `<p><b>目标价:</b> ${smart.target}</p>`;
  if (smart.stopLoss) html += `<p><b>止损价:</b> ${smart.stopLoss}</p>`;
  html += `<p><b>评分:</b> ${smart.score}/10 | <b>理由:</b> ${smart.reason}</p>`;

  if (risk) {
    html += `<p><b>风险控制:</b> 最大回撤 ${risk.maxDrawdown}% | 风险评分 ${risk.riskScore}/10 | ${risk.warning}</p>`;
  }

  try {
    await transporter.sendMail({
      from: GMAIL_USER,
      to: TO_EMAIL,
      subject: `【今日信号】${fundData.name} ${change > 0 ? '上涨' : '下跌'} ${Math.abs(change)}%`,
      html: html
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
  const risk = getRiskControl(history, fund.name);

  console.log(`📊 RSI: ${smart.rsi} | MACD: ${smart.macd} | 评分: ${smart.score}/10`);
  console.log(`💡 操作: ${smart.action} ${smart.amount}元 | 目标: ${smart.target || '-'} | 止损: ${smart.stopLoss || '-'}`);
  console.log(`⚠️ 风险: 最大回撤 ${risk.maxDrawdown}% | 风险评分 ${risk.riskScore}/10 | ${risk.warning}`);

  await sendWechatPush(data, smart, risk);

  const change = parseFloat(data.gszzl);
  if (Math.abs(change) >= THRESHOLD) {
    await sendEmailAlert(data, smart, risk);
  }
}

async function main() {
  console.log('[' + new Date().toLocaleString('zh-CN') + '] 开始精准交易信号 + 风险控制...');

  const today = new Date().getDay();

  if (today === 0) {
    const weeklyReport = generateWeeklyReport();
    if (SERVERCHAN_KEY) {
      await fetch(`https://sctapi.ftqq.com/${SERVERCHAN_KEY}.send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `title=【每周基金总结】&desp=${encodeURIComponent(weeklyReport)}`
      });
      console.log('✅ 每周总结报告已发送');
    }
  }

  for (const fund of FUNDS) {
    await processFund(fund);
  }
  console.log('完成');
}

main();