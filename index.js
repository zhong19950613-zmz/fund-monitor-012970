const fetch = require('node-fetch');
const nodemailer = require('nodemailer');

// 从 GitHub Secrets 获取邮箱配置
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const TO_EMAIL = process.env.TO_EMAIL || GMAIL_USER;

/**
 * 获取 012970 鹏华国证半导体芯片ETF联接C 最新净值
 */
async function getFundNetValue() {
  try {
    const response = await fetch('http://fundgz.1234567.com.cn/js/012970.js');
    const text = await response.text();
    const jsonStr = text.replace('jsonpgz(', '').replace(');', '');
    const data = JSON.parse(jsonStr);
    return data;
  } catch (error) {
    console.error('获取净值失败:', error.message);
    return null;
  }
}

/**
 * 发送邮件提醒
 */
async function sendEmailAlert(fundData) {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    console.log('邮箱配置未设置，跳过邮件发送');
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD
    }
  });

  const change = parseFloat(fundData.gszzl);
  const subject = `【基金警报】${fundData.name} ${change > 0 ? '上涨' : '下跌'} ${Math.abs(change)}%`;

  const html = `
    <h2>基金警报</h2>
    <p><strong>基金名称:</strong> ${fundData.name}</p>
    <p><strong>日期:</strong> ${fundData.jzrq}</p>
    <p><strong>单位净值:</strong> ${fundData.dwjz}</p>
    <p><strong>估算涨跌:</strong> <span style="color:${change > 0 ? 'green' : 'red'}">${fundData.gszzl}%</span></p>
    <p><strong>更新时间:</strong> ${fundData.gztime}</p>
    <hr>
    <p style="color:#666;font-size:12px">此邮件由自动化监控系统发送</p>
  `;

  try {
    await transporter.sendMail({
      from: GMAIL_USER,
      to: TO_EMAIL,
      subject: subject,
      html: html
    });
    console.log('✅ 邮件发送成功');
  } catch (error) {
    console.error('邮件发送失败:', error.message);
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('[' + new Date().toLocaleString('zh-CN') + '] 开始检查净值...');
  const fundData = await getFundNetValue();

  if (fundData) {
    console.log(`基金: ${fundData.name} | 估算涨跌: ${fundData.gszzl}%`);

    const change = parseFloat(fundData.gszzl);

    // 涨跌幅超过 2% 时发送邮件提醒
    if (Math.abs(change) >= 2.0) {
      console.log(`⚠️ 涨跌幅达到 ${change}%，发送邮件提醒...`);
      await sendEmailAlert(fundData);
    } else {
      console.log('涨跌幅小于 2%，不发送邮件');
    }
  }

  console.log('检查完成');
}

main();