const fetch = require('node-fetch');

/**
 * 获取 012970 鹏华国证半导体芯片ETF联接C 最新净值
 * 数据来源：EastMoney 公开接口
 */
async function getFundNetValue() {
  try {
    const response = await fetch('http://fundgz.1234567.com.cn/js/012970.js');
    const text = await response.text();
    
    // 解析 JSONP 格式
    const jsonStr = text.replace('jsonpgz(', '').replace(');', '');
    const data = JSON.parse(jsonStr);
    
    console.log('====================================');
    console.log(`基金代码: ${data.fundcode}`);
    console.log(`基金名称: ${data.name}`);
    console.log(`日期: ${data.jzrq}`);
    console.log(`单位净值: ${data.dwjz}`);
    console.log(`估算净值: ${data.gsz}`);
    console.log(`估算涨跌: ${data.gszzl}%`);
    console.log(`更新时间: ${data.gztime}`);
    console.log('====================================');
    
    return data;
  } catch (error) {
    console.error('获取净值失败:', error.message);
    return null;
  }
}

// 主函数
async function main() {
  console.log('[' + new Date().toLocaleString('zh-CN') + '] 开始检查净值...');
  const fundData = await getFundNetValue();
  
  if (fundData) {
    // TODO: 后续添加邮件提醒逻辑
    // TODO: 存储历史数据做回测
    console.log('检查完成');
  }
}

main();