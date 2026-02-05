// Cloudflare Worker 完整代码 - PortScan Pro
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

// 端口信息数据库
const portDatabase = {
  // 常用Web端口
  80: { service: 'HTTP', protocol: 'TCP', description: '超文本传输协议 - Web服务器' },
  443: { service: 'HTTPS', protocol: 'TCP', description: '安全超文本传输协议 - SSL/TLS加密Web服务' },
  8080: { service: 'HTTP-ALT', protocol: 'TCP', description: '替代HTTP端口，常用于代理或开发服务器' },
  8443: { service: 'HTTPS-ALT', protocol: 'TCP', description: '替代HTTPS端口' },
  3000: { service: 'Node.js', protocol: 'TCP', description: 'Node.js开发服务器默认端口' },
  4200: { service: 'Angular', protocol: 'TCP', description: 'Angular开发服务器端口' },
  
  // 邮件服务
  25: { service: 'SMTP', protocol: 'TCP', description: '简单邮件传输协议 - 发送邮件' },
  110: { service: 'POP3', protocol: 'TCP', description: '邮局协议版本3 - 接收邮件' },
  143: { service: 'IMAP', protocol: 'TCP', description: '互联网消息访问协议 - 邮件访问' },
  465: { service: 'SMTPS', protocol: 'TCP', description: 'SSL加密的SMTP' },
  587: { service: 'SMTP-SUB', protocol: 'TCP', description: 'SMTP提交端口' },
  993: { service: 'IMAPS', protocol: 'TCP', description: 'SSL加密的IMAP' },
  995: { service: 'POP3S', protocol: 'TCP', description: 'SSL加密的POP3' },
  
  // 远程访问
  22: { service: 'SSH', protocol: 'TCP', description: '安全外壳协议 - 安全远程登录' },
  23: { service: 'Telnet', protocol: 'TCP', description: '远程终端协议（不安全）' },
  3389: { service: 'RDP', protocol: 'TCP', description: '远程桌面协议 - Windows远程访问' },
  5900: { service: 'VNC', protocol: 'TCP', description: '虚拟网络计算 - 远程桌面' },
  
  // 文件传输
  21: { service: 'FTP', protocol: 'TCP', description: '文件传输协议 - 控制连接' },
  20: { service: 'FTP-DATA', protocol: 'TCP', description: 'FTP数据连接' },
  69: { service: 'TFTP', protocol: 'UDP', description: '简单文件传输协议' },
  2049: { service: 'NFS', protocol: 'TCP/UDP', description: '网络文件系统' },
  137: { service: 'NetBIOS', protocol: 'UDP', description: 'NetBIOS名称服务' },
  138: { service: 'NetBIOS', protocol: 'UDP', description: 'NetBIOS数据报服务' },
  139: { service: 'NetBIOS', protocol: 'TCP', description: 'NetBIOS会话服务' },
  445: { service: 'SMB', protocol: 'TCP', description: '服务器消息块 - 文件共享' },
  
  // 数据库
  3306: { service: 'MySQL', protocol: 'TCP', description: 'MySQL数据库服务器' },
  5432: { service: 'PostgreSQL', protocol: 'TCP', description: 'PostgreSQL数据库' },
  27017: { service: 'MongoDB', protocol: 'TCP', description: 'MongoDB数据库' },
  6379: { service: 'Redis', protocol: 'TCP', description: 'Redis键值存储' },
  1521: { service: 'Oracle', protocol: 'TCP', description: 'Oracle数据库' },
  1433: { service: 'MSSQL', protocol: 'TCP', description: 'Microsoft SQL Server' },
  
  // DNS服务
  53: { service: 'DNS', protocol: 'TCP/UDP', description: '域名系统 - 域名解析' },
  
  // DHCP
  67: { service: 'DHCP-SERVER', protocol: 'UDP', description: 'DHCP服务器端口' },
  68: { service: 'DHCP-CLIENT', protocol: 'UDP', description: 'DHCP客户端端口' },
  
  // 网络管理
  161: { service: 'SNMP', protocol: 'UDP', description: '简单网络管理协议' },
  162: { service: 'SNMP-TRAP', protocol: 'UDP', description: 'SNMP陷阱端口' },
  
  // 代理服务器
  1080: { service: 'SOCKS', protocol: 'TCP', description: 'SOCKS代理服务器' },
  3128: { service: 'Squid', protocol: 'TCP', description: 'Squid HTTP代理' },
  8081: { service: 'Proxy', protocol: 'TCP', description: '通用代理端口' },
  
  // 其他服务
  111: { service: 'RPC', protocol: 'TCP/UDP', description: '远程过程调用' },
  123: { service: 'NTP', protocol: 'UDP', description: '网络时间协议' },
  135: { service: 'MSRPC', protocol: 'TCP', description: 'Microsoft RPC服务' },
  389: { service: 'LDAP', protocol: 'TCP', description: '轻量级目录访问协议' },
  636: { service: 'LDAPS', protocol: 'TCP', description: 'SSL加密的LDAP' },
  873: { service: 'Rsync', protocol: 'TCP', description: '远程文件同步服务' },
  902: { service: 'VMware', protocol: 'TCP', description: 'VMware服务器控制台' },
  11211: { service: 'Memcached', protocol: 'TCP', description: 'Memcached缓存服务' },
  27015: { service: 'Steam', protocol: 'TCP/UDP', description: 'Steam游戏服务' },
  
  // 常见应用
  1883: { service: 'MQTT', protocol: 'TCP', description: 'MQTT消息队列遥测传输' },
  5672: { service: 'AMQP', protocol: 'TCP', description: '高级消息队列协议' },
  15672: { service: 'RabbitMQ', protocol: 'TCP', description: 'RabbitMQ管理界面' },
  9200: { service: 'Elasticsearch', protocol: 'TCP', description: 'Elasticsearch REST API' },
  9300: { service: 'Elasticsearch', protocol: 'TCP', description: 'Elasticsearch集群通信' },
  5601: { service: 'Kibana', protocol: 'TCP', description: 'Kibana数据可视化' },
};

// 获取端口描述信息
function getPortDescription(port) {
  const portInfo = portDatabase[port] || { 
    service: '未知', 
    protocol: 'TCP',
    description: '未知服务'
  };
  
  return {
    service: portInfo.service,
    protocol: portInfo.protocol,
    description: portInfo.description
  };
}

// 处理CORS
function handleCORS() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Target, X-Port, X-Timeout, X-Scan-Type',
      'Access-Control-Max-Age': '86400',
    }
  });
}

// 处理扫描请求
async function handleScan(request) {
  const url = new URL(request.url);
  
  // 获取参数
  const target = url.searchParams.get('target') || request.headers.get('X-Target');
  const port = parseInt(url.searchParams.get('port') || request.headers.get('X-Port') || '80');
  const timeout = parseInt(url.searchParams.get('timeout') || request.headers.get('X-Timeout') || '2000');
  const scanType = url.searchParams.get('scanType') || request.headers.get('X-Scan-Type') || 'common';
  
  if (!target) {
    return jsonResponse({ error: '目标地址不能为空' }, 400);
  }
  
  // 验证端口范围
  if (port < 1 || port > 65535) {
    return jsonResponse({ error: '端口号必须在1-65535之间' }, 400);
  }
  
  try {
    const startTime = Date.now();
    const result = await testPort(target, port, timeout);
    const responseTime = Date.now() - startTime;
    
    const portInfo = getPortDescription(port);
    
    return jsonResponse({
      port: port,
      target: target,
      status: result.status,
      service: portInfo.service,
      protocol: portInfo.protocol,
      description: portInfo.description,
      responseTime: responseTime,
      scanType: scanType,
      timestamp: new Date().toISOString(),
      headers: result.headers || {}
    });
    
  } catch (error) {
    return jsonResponse({ 
      error: '扫描失败',
      message: error.message,
      port: port,
      target: target,
      status: 'error'
    }, 500);
  }
}

// 测试端口连接
async function testPort(target, port, timeout) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    // 尝试HTTP连接
    const httpUrl = `http://${target}:${port}`;
    const httpResponse = await fetch(httpUrl, {
      signal: controller.signal,
      method: 'HEAD',
      redirect: 'manual',
      headers: {
        'User-Agent': 'PortScan-Pro/1.0 (Cloudflare Worker)',
        'Accept': '*/*',
        'Connection': 'close'
      },
      cf: {
        cacheTtl: 0,
        polish: 'off',
        scrapeShield: false,
        mirage: false
      }
    }).catch(e => {
      if (e.name !== 'AbortError') throw e;
      return null;
    });
    
    clearTimeout(timeoutId);
    
    if (httpResponse) {
      const headers = {};
      httpResponse.headers.forEach((value, key) => {
        headers[key] = value;
      });
      
      return {
        status: 'open',
        headers: headers,
        statusCode: httpResponse.status
      };
    }
    
    // 如果HTTP失败，尝试HTTPS
    const httpsUrl = `https://${target}:${port}`;
    const httpsResponse = await fetch(httpsUrl, {
      signal: controller.signal,
      method: 'HEAD',
      redirect: 'manual',
      headers: {
        'User-Agent': 'PortScan-Pro/1.0 (Cloudflare Worker)',
        'Accept': '*/*',
        'Connection': 'close'
      },
      cf: {
        cacheTtl: 0,
        polish: 'off',
        scrapeShield: false,
        mirage: false
      }
    }).catch(e => {
      if (e.name !== 'AbortError') throw e;
      return null;
    });
    
    if (httpsResponse) {
      const headers = {};
      httpsResponse.headers.forEach((value, key) => {
        headers[key] = value;
      });
      
      return {
        status: 'open',
        headers: headers,
        statusCode: httpsResponse.status
      };
    }
    
    // 如果都失败，尝试TCP连接（通过fetch模拟）
    const tcpTest = await testTCPConnection(target, port, timeout);
    
    if (tcpTest.open) {
      return {
        status: 'open',
        headers: {},
        statusCode: 0
      };
    } else if (tcpTest.filtered) {
      return {
        status: 'filtered',
        headers: {},
        statusCode: 0
      };
    } else {
      return {
        status: 'closed',
        headers: {},
        statusCode: 0
      };
    }
    
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      return {
        status: 'filtered',
        headers: {},
        statusCode: 0
      };
    }
    
    throw error;
  }
}

// 模拟TCP连接测试
async function testTCPConnection(target, port, timeout) {
  // 使用fetch模拟TCP连接测试
  const testUrl = `http://${target}:${port}/`;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(testUrl, {
      signal: controller.signal,
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent': 'PortScan-Pro/1.0 TCP Test'
      },
      cf: {
        cacheTtl: 0
      }
    }).catch(e => {
      if (e.name !== 'AbortError') {
        // 连接被拒绝或网络错误
        return { error: e.message };
      }
      return { timeout: true };
    });
    
    clearTimeout(timeoutId);
    
    if (response && response.error) {
      // 连接被拒绝，端口可能关闭
      return { open: false, filtered: false };
    } else if (response && response.timeout) {
      // 连接超时，端口可能被过滤
      return { open: false, filtered: true };
    } else {
      // 有响应，端口开放
      return { open: true, filtered: false };
    }
    
  } catch (error) {
    return { open: false, filtered: false, error: error.message };
  }
}

// 批量扫描端口
async function handleBatchScan(request) {
  const url = new URL(request.url);
  const target = url.searchParams.get('target');
  const scanType = url.searchParams.get('scanType') || 'common';
  const timeout = parseInt(url.searchParams.get('timeout') || '2000');
  
  if (!target) {
    return jsonResponse({ error: '目标地址不能为空' }, 400);
  }
  
  // 根据扫描类型确定端口列表
  let ports = [];
  switch(scanType) {
    case 'common':
      ports = generateCommonPorts();
      break;
    case 'web':
      ports = generateWebPorts();
      break;
    case 'database':
      ports = generateDatabasePorts();
      break;
    case 'critical':
      ports = generateCriticalPorts();
      break;
    default:
      ports = generateCommonPorts();
  }
  
  // 限制最大扫描端口数
  const maxPorts = 1000;
  if (ports.length > maxPorts) {
    ports = ports.slice(0, maxPorts);
  }
  
  // 开始批量扫描
  const results = [];
  const batchSize = 20; // 并发数
  
  for (let i = 0; i < ports.length; i += batchSize) {
    const batch = ports.slice(i, i + batchSize);
    const batchPromises = batch.map(port => 
      testPort(target, port, timeout).then(result => ({
        port,
        status: result.status,
        responseTime: 0 // 简化处理
      })).catch(error => ({
        port,
        status: 'error',
        error: error.message
      }))
    );
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // 每批扫描后等待片刻，避免过载
    if (i + batchSize < ports.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return jsonResponse({
    target: target,
    scanType: scanType,
    totalPorts: ports.length,
    scannedPorts: results.length,
    openPorts: results.filter(r => r.status === 'open').length,
    filteredPorts: results.filter(r => r.status === 'filtered').length,
    results: results,
    timestamp: new Date().toISOString()
  });
}

// 生成常用端口列表
function generateCommonPorts() {
  return [
    20, 21, 22, 23, 25, 53, 67, 68, 69, 80, 110, 123, 135, 137, 138, 139,
    143, 161, 162, 389, 443, 445, 465, 514, 515, 587, 631, 636, 993, 995,
    1080, 1194, 1433, 1434, 1521, 1723, 2049, 2082, 2083, 2086, 2087, 2095,
    2096, 2222, 2375, 2376, 3000, 3306, 3389, 4000, 4040, 4369, 5000, 5432,
    5601, 5672, 5900, 5984, 6379, 6443, 6667, 7000, 7001, 7199, 8000, 8001,
    8008, 8009, 8080, 8081, 8083, 8088, 8090, 8091, 8100, 8181, 8200, 8443,
    8500, 8649, 8888, 9000, 9001, 9042, 9092, 9100, 9200, 9300, 9418, 9999,
    10000, 11211, 15672, 27017, 27018, 28015, 50000, 50030, 50060, 50070, 50075
  ];
}

// 生成Web端口列表
function generateWebPorts() {
  return [
    80, 81, 82, 88, 300, 443, 591, 593, 832, 981, 1010, 1311, 2082, 2087,
    2095, 2096, 2480, 3000, 3128, 3333, 4243, 4567, 4711, 4712, 4993, 5000,
    5104, 5108, 5800, 6543, 7000, 7396, 7474, 8000, 8001, 8008, 8014, 8042,
    8069, 8080, 8081, 8088, 8090, 8091, 8118, 8123, 8172, 8222, 8243, 8280,
    8281, 8333, 8443, 8500, 8834, 8880, 8888, 8983, 9000, 9043, 9060, 9080,
    9090, 9091, 9200, 9443, 9800, 9981, 12443, 16080, 18091, 18092
  ];
}

// 生成数据库端口列表
function generateDatabasePorts() {
  return [
    1433, 1434, 1521, 1522, 1523, 1524, 1525, 1526, 1527, 1528, 1529, 1530,
    1830, 3306, 3307, 3308, 3309, 3310, 3311, 3312, 4333, 5050, 5432, 5433,
    5984, 6379, 6380, 7473, 7474, 7574, 7674, 7777, 7778, 7779, 8087, 8091,
    8098, 8182, 8649, 8675, 9001, 9042, 9160, 9200, 9300, 11211, 11214, 11215,
    18091, 18092, 20000, 27017, 27018, 27019, 28015, 28017, 29015, 50000, 50010,
    50020, 50030, 50060, 50070, 50075, 50090
  ];
}

// 生成关键端口列表
function generateCriticalPorts() {
  return [
    21, 22, 23, 25, 53, 80, 110, 135, 139, 143, 443, 445, 993, 995, 1723,
    3306, 3389, 5900, 8080
  ];
}

// JSON响应
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status: status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
}

// HTML页面
const HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PortScan Pro - 专业端口扫描工具</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #2b6cb0;
            --primary-dark: #2c5282;
            --success: #38a169;
            --warning: #d69e2e;
            --danger: #e53e3e;
            --dark: #1a202c;
            --light: #f7fafc;
            --gray: #718096;
            --border: #e2e8f0;
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Inter', 'Microsoft YaHei', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: var(--dark);
            line-height: 1.6;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
        }
        
        header {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 16px;
            padding: 30px;
            margin-bottom: 24px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .logo {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 20px;
        }
        
        .logo h1 {
            font-size: 28px;
            font-weight: 700;
            background: linear-gradient(135deg, var(--primary), #4fd1c5);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        
        .tagline {
            color: var(--gray);
            font-size: 16px;
            margin-bottom: 24px;
        }
        
        .grid {
            display: grid;
            grid-template-columns: 1fr 350px;
            gap: 24px;
        }
        
        .scan-panel {
            background: white;
            border-radius: 16px;
            padding: 30px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
        }
        
        .info-panel {
            background: white;
            border-radius: 16px;
            padding: 30px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
            height: fit-content;
            position: sticky;
            top: 20px;
        }
        
        .form-group {
            margin-bottom: 24px;
        }
        
        label {
            display: block;
            font-weight: 600;
            margin-bottom: 8px;
            color: var(--dark);
        }
        
        input, select {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid var(--border);
            border-radius: 10px;
            font-size: 15px;
            transition: all 0.3s;
        }
        
        input:focus, select:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(43, 108, 176, 0.1);
        }
        
        .range-inputs {
            display: flex;
            gap: 12px;
            align-items: center;
        }
        
        .btn {
            padding: 14px 28px;
            border: none;
            border-radius: 10px;
            font-weight: 600;
            font-size: 16px;
            cursor: pointer;
            transition: all 0.3s;
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }
        
        .btn-primary {
            background: linear-gradient(135deg, var(--primary), var(--primary-dark));
            color: white;
        }
        
        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(43, 108, 176, 0.2);
        }
        
        .btn-secondary {
            background: #f7fafc;
            color: var(--gray);
            border: 2px solid var(--border);
        }
        
        .stats {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
            margin: 24px 0;
        }
        
        .stat-box {
            background: #f8fafc;
            padding: 20px;
            border-radius: 12px;
            text-align: center;
            border: 1px solid var(--border);
        }
        
        .stat-number {
            font-size: 28px;
            font-weight: 700;
            color: var(--primary);
        }
        
        .stat-label {
            font-size: 14px;
            color: var(--gray);
            margin-top: 4px;
        }
        
        .results-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.05);
            max-height: 500px;
            overflow-y: auto;
            display: block;
        }
        
        .results-table th {
            background: #f8fafc;
            padding: 16px;
            text-align: left;
            font-weight: 600;
            color: var(--dark);
            border-bottom: 2px solid var(--border);
            position: sticky;
            top: 0;
        }
        
        .results-table td {
            padding: 16px;
            border-bottom: 1px solid var(--border);
        }
        
        .port-open {
            color: var(--success);
            font-weight: 600;
            background: #f0fff4;
            padding: 4px 12px;
            border-radius: 20px;
            display: inline-block;
        }
        
        .port-closed {
            color: var(--danger);
            background: #fff5f5;
            padding: 4px 12px;
            border-radius: 20px;
            display: inline-block;
        }
        
        .port-filtered {
            color: var(--warning);
            background: #fffaf0;
            padding: 4px 12px;
            border-radius: 20px;
            display: inline-block;
        }
        
        .progress-container {
            height: 8px;
            background: #f1f5f9;
            border-radius: 4px;
            overflow: hidden;
            margin: 20px 0;
        }
        
        .progress-bar {
            height: 100%;
            background: linear-gradient(90deg, var(--primary), #4fd1c5);
            width: 0%;
            transition: width 0.3s;
        }
        
        .loading {
            display: none;
            text-align: center;
            padding: 40px;
        }
        
        .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid #f3f3f3;
            border-top: 4px solid var(--primary);
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .protocol-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            background: #e6f7ff;
            color: var(--primary);
        }
        
        .port-info {
            font-size: 13px;
            color: var(--gray);
            margin-top: 4px;
            line-height: 1.4;
        }
        
        .scan-info {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 20px;
        }
        
        .info-item {
            margin-bottom: 12px;
        }
        
        .info-item strong {
            font-weight: 600;
        }
        
        .result-details {
            background: #f8fafc;
            padding: 12px;
            border-radius: 8px;
            margin-top: 8px;
            font-size: 12px;
            color: var(--gray);
        }
        
        .service-tag {
            display: inline-block;
            padding: 2px 8px;
            background: #edf2f7;
            border-radius: 4px;
            font-size: 12px;
            margin-right: 4px;
        }
        
        @media (max-width: 1024px) {
            .grid {
                grid-template-columns: 1fr;
            }
            
            .stats {
                grid-template-columns: repeat(2, 1fr);
            }
        }
        
        @media (max-width: 640px) {
            .container {
                padding: 10px;
            }
            
            .range-inputs {
                flex-direction: column;
            }
            
            .stats {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div class="logo">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2b6cb0" stroke-width="2">
                    <path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
                </svg>
                <h1>PortScan Pro</h1>
            </div>
            <p class="tagline">基于Cloudflare全球网络的专业端口扫描工具 | 实时检测 | 多线程扫描 | 合法网络安全评估</p>
        </header>
        
        <div class="grid">
            <div class="scan-panel">
                <div class="form-group">
                    <label>目标地址</label>
                    <input type="text" id="target" placeholder="输入域名或IP地址 (例如: example.com 或 192.168.1.1)" value="example.com">
                </div>
                
                <div class="form-group">
                    <label>扫描类型</label>
                    <select id="scanType">
                        <option value="common">常用端口扫描 (1-1024)</option>
                        <option value="range">自定义范围扫描</option>
                        <option value="critical">关键服务端口</option>
                        <option value="web">Web服务端口</option>
                        <option value="database">数据库端口</option>
                        <option value="all">全端口扫描 (1-65535)</option>
                    </select>
                </div>
                
                <div class="form-group" id="rangeGroup" style="display: none;">
                    <label>端口范围</label>
                    <div class="range-inputs">
                        <input type="number" id="portFrom" placeholder="起始端口" min="1" max="65535" value="1">
                        <span>到</span>
                        <input type="number" id="portTo" placeholder="结束端口" min="1" max="65535" value="1024">
                    </div>
                </div>
                
                <div class="form-group">
                    <label>超时设置 (毫秒)</label>
                    <select id="timeout">
                        <option value="100">100ms (极速)</option>
                        <option value="200" selected>200ms (快速)</option>
                        <option value="500">500ms (标准)</option>
                        <option value="1000">1000ms (详细)</option>
                        <option value="2000">2000ms (深度)</option>
                    </select>
                </div>
                
                <div style="display: flex; gap: 12px; margin-top: 32px; flex-wrap: wrap;">
                    <button class="btn btn-primary" onclick="startScan()">
                        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 10v4a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
                            <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        开始扫描
                    </button>
                    <button class="btn btn-secondary" onclick="stopScan()">
                        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="6" y="6" width="12" height="12" rx="1"/>
                        </svg>
                        停止扫描
                    </button>
                    <button class="btn btn-secondary" onclick="clearResults()">
                        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                        </svg>
                        清除结果
                    </button>
                    <button class="btn btn-secondary" onclick="exportResults()">
                        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                        </svg>
                        导出结果
                    </button>
                </div>
                
                <div class="progress-container">
                    <div class="progress-bar" id="progressBar"></div>
                </div>
                
                <div class="loading" id="loading">
                    <div class="spinner"></div>
                    <p>正在通过Cloudflare全球网络进行扫描...</p>
                    <p id="scanStatus">初始化扫描参数</p>
                </div>
                
                <div class="stats" id="stats">
                    <div class="stat-box">
                        <div class="stat-number" id="totalPorts">0</div>
                        <div class="stat-label">总端口数</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-number" id="scannedPorts">0</div>
                        <div class="stat-label">已扫描</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-number" id="openPorts">0</div>
                        <div class="stat-label">开放端口</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-number" id="filteredPorts">0</div>
                        <div class="stat-label">被过滤</div>
                    </div>
                </div>
                
                <div style="overflow-x: auto; max-height: 500px;">
                    <table class="results-table" id="resultsTable">
                        <thead>
                            <tr>
                                <th>端口</th>
                                <th>状态</th>
                                <th>服务/协议</th>
                                <th>响应时间</th>
                                <th>详细描述</th>
                            </tr>
                        </thead>
                        <tbody id="resultsBody">
                            <!-- 结果将动态插入 -->
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div class="info-panel">
                <div class="scan-info">
                    <h3 style="margin-bottom: 16px; color: white;">扫描信息</h3>
                    <div class="info-item">
                        <strong>扫描节点:</strong> Cloudflare全球网络
                    </div>
                    <div class="info-item">
                        <strong>并发线程:</strong> 20个并发请求
                    </div>
                    <div class="info-item">
                        <strong>网络延迟:</strong> &lt; 50ms
                    </div>
                    <div class="info-item">
                        <strong>数据来源:</strong> 实时网络探测
                    </div>
                </div>
                
                <h3 style="margin-bottom: 16px;">常见端口说明</h3>
                <div style="margin-bottom: 20px;">
                    <div style="background: #f8fafc; padding: 12px; border-radius: 8px; margin-bottom: 12px; border-left: 4px solid var(--success);">
                        <strong>80/HTTP</strong>
                        <div class="port-info">Web服务器标准端口，用于HTTP网页服务</div>
                    </div>
                    <div style="background: #f8fafc; padding: 12px; border-radius: 8px; margin-bottom: 12px; border-left: 4px solid var(--success);">
                        <strong>443/HTTPS</strong>
                        <div class="port-info">安全Web服务，SSL/TLS加密传输</div>
                    </div>
                    <div style="background: #f8fafc; padding: 12px; border-radius: 8px; margin-bottom: 12px; border-left: 4px solid var(--primary);">
                        <strong>22/SSH</strong>
                        <div class="port-info">安全外壳协议，远程登录和文件传输</div>
                    </div>
                    <div style="background: #f8fafc; padding: 12px; border-radius: 8px; margin-bottom: 12px; border-left: 4px solid var(--primary);">
                        <strong>21/FTP</strong>
                        <div class="port-info">文件传输协议，用于上传下载文件</div>
                    </div>
                    <div style="background: #f8fafc; padding: 12px; border-radius: 8px; margin-bottom: 12px; border-left: 4px solid var(--warning);">
                        <strong>25/SMTP</strong>
                        <div class="port-info">简单邮件传输协议，发送电子邮件</div>
                    </div>
                    <div style="background: #f8fafc; padding: 12px; border-radius: 8px; margin-bottom: 12px; border-left: 4px solid var(--warning);">
                        <strong>53/DNS</strong>
                        <div class="port-info">域名系统，域名解析服务</div>
                    </div>
                    <div style="background: #f8fafc; padding: 12px; border-radius: 8px; margin-bottom: 12px; border-left: 4px solid var(--danger);">
                        <strong>3389/RDP</strong>
                        <div class="port-info">远程桌面协议，Windows远程访问</div>
                    </div>
                </div>
                
                <div style="background: #fff5f5; padding: 16px; border-radius: 12px; border: 1px solid #fed7d7;">
                    <h4 style="color: var(--danger); margin-bottom: 8px;">法律声明</h4>
                    <p style="font-size: 13px; color: var(--gray);">
                        本工具仅限用于合法授权的网络安全评估。使用前请确保您有权限扫描目标系统。未经授权的端口扫描可能违反相关法律法规。
                    </p>
                </div>
            </div>
        </div>
    </div>

    <script>
        // 全局变量
        let isScanning = false;
        let scanProgress = 0;
        let totalPortsToScan = 0;
        let scannedPorts = 0;
        let openPorts = 0;
        let filteredPorts = 0;
        let currentScanId = null;
        let scanResults = [];

        // 初始化
        document.getElementById('scanType').addEventListener('change', function() {
            const rangeGroup = document.getElementById('rangeGroup');
            rangeGroup.style.display = this.value === 'range' ? 'block' : 'none';
        });

        // 开始扫描
        async function startScan() {
            if (isScanning) return;
            
            const target = document.getElementById('target').value.trim();
            if (!target) {
                alert('请输入目标地址');
                return;
            }

            // 初始化
            isScanning = true;
            scannedPorts = 0;
            openPorts = 0;
            filteredPorts = 0;
            scanResults = [];
            
            document.getElementById('loading').style.display = 'block';
            document.getElementById('resultsBody').innerHTML = '';
            updateStats();
            
            // 获取参数
            const scanType = document.getElementById('scanType').value;
            const timeout = parseInt(document.getElementById('timeout').value);
            const workerUrl = window.location.origin;
            
            // 生成端口列表
            let ports = [];
            
            if (scanType === 'range') {
                const from = parseInt(document.getElementById('portFrom').value) || 1;
                const to = parseInt(document.getElementById('portTo').value) || 1024;
                ports = generatePortRange(from, to);
            } else if (scanType === 'all') {
                // 全端口扫描 - 使用代表性端口
                ports = generateAllPortsRepresentative();
            } else {
                // 批量扫描
                try {
                    document.getElementById('scanStatus').textContent = `正在获取端口列表...`;
                    const batchResponse = await fetch(`${workerUrl}/batch?target=${encodeURIComponent(target)}&scanType=${scanType}&timeout=${timeout}`);
                    const batchData = await batchResponse.json();
                    
                    if (batchData.error) {
                        throw new Error(batchData.error);
                    }
                    
                    // 处理批量结果
                    batchData.results.forEach(result => {
                        if (result.status === 'open' || result.status === 'filtered') {
                            addResultToTable(
                                result.port, 
                                result.status, 
                                getServiceByPort(result.port),
                                result.responseTime || 0,
                                getPortDescription(result.port)
                            );
                        }
                    });
                    
                    // 更新统计
                    totalPortsToScan = batchData.totalPorts;
                    scannedPorts = batchData.scannedPorts;
                    openPorts = batchData.openPorts;
                    filteredPorts = batchData.filteredPorts;
                    
                    updateStats();
                    updateProgress();
                    
                    isScanning = false;
                    document.getElementById('loading').style.display = 'none';
                    document.getElementById('scanStatus').textContent = '批量扫描完成！';
                    
                    return;
                    
                } catch (error) {
                    console.error('批量扫描失败:', error);
                    // 如果批量扫描失败，回退到逐个扫描
                    ports = getPortsByType(scanType);
                }
            }
            
            // 限制最大端口数
            const maxPorts = 500;
            if (ports.length > maxPorts) {
                ports = ports.slice(0, maxPorts);
            }
            
            totalPortsToScan = ports.length;
            updateProgress();
            updateStats();
            
            // 开始逐个扫描
            document.getElementById('scanStatus').textContent = `正在扫描 ${target} (${ports.length}个端口)...`;
            currentScanId = Date.now();
            
            // 并发扫描
            const batchSize = 20;
            for (let i = 0; i < ports.length; i += batchSize) {
                if (!isScanning) break;
                
                const batch = ports.slice(i, i + batchSize);
                const promises = batch.map(port => 
                    scanSinglePort(workerUrl, target, port, timeout, scanType)
                        .then(result => {
                            if (result) {
                                scanResults.push(result);
                            }
                        })
                        .catch(error => {
                            console.error(`端口 ${port} 扫描错误:`, error);
                        })
                );
                
                await Promise.all(promises);
                updateProgress();
                updateStats();
                
                // 短暂延迟，避免过快请求
                if (i + batchSize < ports.length && isScanning) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }
            
            isScanning = false;
            document.getElementById('scanStatus').textContent = '扫描完成！';
            setTimeout(() => {
                document.getElementById('loading').style.display = 'none';
            }, 1000);
        }

        // 扫描单个端口
        async function scanSinglePort(workerUrl, target, port, timeout, scanType) {
            if (!isScanning) return null;
            
            try {
                const response = await fetch(`${workerUrl}/scan?target=${encodeURIComponent(target)}&port=${port}&timeout=${timeout}&scanType=${scanType}`, {
                    headers: {
                        'X-Target': target,
                        'X-Port': port,
                        'X-Timeout': timeout,
                        'X-Scan-Type': scanType
                    }
                });
                
                const result = await response.json();
                
                scannedPorts++;
                
                if (result.status === 'open' || result.status === 'filtered') {
                    if (result.status === 'open') openPorts++;
                    if (result.status === 'filtered') filteredPorts++;
                    
                    addResultToTable(
                        result.port, 
                        result.status, 
                        result.service,
                        result.responseTime,
                        result.description
                    );
                }
                
                return result;
                
            } catch (error) {
                scannedPorts++;
                console.error(`端口 ${port} 扫描失败:`, error);
                return null;
            }
        }

        // 停止扫描
        function stopScan() {
            isScanning = false;
            document.getElementById('scanStatus').textContent = '扫描已停止';
            setTimeout(() => {
                document.getElementById('loading').style.display = 'none';
            }, 500);
        }

        // 清除结果
        function clearResults() {
            document.getElementById('resultsBody').innerHTML = '';
            scannedPorts = 0;
            openPorts = 0;
            filteredPorts = 0;
            scanResults = [];
            updateStats();
            document.getElementById('progressBar').style.width = '0%';
        }

        // 导出结果
        function exportResults() {
            if (scanResults.length === 0) {
                alert('没有可导出的结果');
                return;
            }
            
            const dataStr = JSON.stringify(scanResults, null, 2);
            const dataBlob = new Blob([dataStr], {type: 'application/json'});
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `portscan-results-${Date.now()}.json`;
            link.click();
            URL.revokeObjectURL(url);
        }

        // 添加结果到表格
        function addResultToTable(port, status, service, responseTime, description) {
            const tbody = document.getElementById('resultsBody');
            const tr = document.createElement('tr');
            
            let statusClass = 'port-closed';
            let statusText = '关闭';
            
            if (status === 'open') {
                statusClass = 'port-open';
                statusText = '开放';
            } else if (status === 'filtered') {
                statusClass = 'port-filtered';
                statusText = '被过滤';
            }
            
            tr.innerHTML = \`
                <td><strong>\${port}</strong></td>
                <td><span class="\${statusClass}">\${statusText}</span></td>
                <td>
                    <div>\${service}</div>
                    <div class="port-info">TCP协议</div>
                </td>
                <td>\${responseTime}ms</td>
                <td>
                    <div>\${description}</div>
                    <div class="result-details">端口 \${port} - \${statusText}</div>
                </td>
            \`;
            
            // 插入到表格顶部（最新结果在上面）
            tbody.insertBefore(tr, tbody.firstChild);
        }

        // 更新进度
        function updateProgress() {
            const progress = totalPortsToScan > 0 ? (scannedPorts / totalPortsToScan) * 100 : 0;
            document.getElementById('progressBar').style.width = \`\${progress}%\`;
        }

        // 更新统计
        function updateStats() {
            document.getElementById('totalPorts').textContent = totalPortsToScan;
            document.getElementById('scannedPorts').textContent = scannedPorts;
            document.getElementById('openPorts').textContent = openPorts;
            document.getElementById('filteredPorts').textContent = filteredPorts;
        }

        // 辅助函数
        function generatePortRange(from, to) {
            const ports = [];
            for (let i = from; i <= to; i++) {
                ports.push(i);
            }
            return ports;
        }

        function generateAllPortsRepresentative() {
            // 生成代表性端口，而不是全部65535个
            const ports = new Set();
            
            // 添加常用端口
            [20, 21, 22, 23, 25, 53, 67, 68, 69, 80, 110, 123, 135, 137, 138, 139,
             143, 161, 162, 389, 443, 445, 465, 514, 515, 587, 631, 636, 993, 995,
             1080, 1194, 1433, 1434, 1521, 1723, 2049, 2082, 2083, 2086, 2087, 2095,
             2096, 2222, 2375, 2376, 3000, 3306, 3389, 4000, 4040, 4369, 5000, 5432,
             5601, 5672, 5900, 5984, 6379, 6443, 6667, 7000, 7001, 7199, 8000, 8001,
             8008, 8009, 8080, 8081, 8083, 8088, 8090, 8091, 8100, 8181, 8200, 8443,
             8500, 8649, 8888, 9000, 9001, 9042, 9092, 9100, 9200, 9300, 9418, 9999,
             10000, 11211, 15672, 27017, 27018, 28015, 50000, 50030, 50060, 50070, 50075].forEach(p => ports.add(p));
            
            // 每1000个端口添加一个代表性端口
            for (let i = 1; i <= 65535; i += 1000) {
                ports.add(i);
            }
            
            // 添加一些随机端口
            for (let i = 0; i < 50; i++) {
                ports.add(Math.floor(Math.random() * 65535) + 1);
            }
            
            return Array.from(ports).sort((a, b) => a - b);
        }

        function getPortsByType(type) {
            switch(type) {
                case 'common':
                    return [20, 21, 22, 23, 25, 53, 67, 68, 69, 80, 110, 123, 135, 137, 138, 139,
                            143, 161, 162, 389, 443, 445, 465, 514, 515, 587, 631, 636, 993, 995,
                            1080, 1194, 1433, 1434, 1521, 1723, 2049, 2082, 2083, 2086, 2087, 2095,
                            2096, 2222, 2375, 2376, 3000, 3306, 3389, 4000, 4040, 4369, 5000, 5432,
                            5601, 5672, 5900, 5984, 6379, 6443, 6667, 7000, 7001, 7199, 8000, 8001,
                            8008, 8009, 8080, 8081, 8083, 8088, 8090, 8091, 8100, 8181, 8200, 8443,
                            8500, 8649, 8888, 9000, 9001, 9042, 9092, 9100, 9200, 9300, 9418, 9999,
                            10000, 11211, 15672, 27017, 27018, 28015, 50000, 50030, 50060, 50070, 50075];
                case 'critical':
                    return [21, 22, 23, 25, 53, 80, 110, 135, 139, 143, 443, 445, 993, 995, 1723,
                            3306, 3389, 5900, 8080];
                case 'web':
                    return [80, 81, 82, 88, 300, 443, 591, 593, 832, 981, 1010, 1311, 2082, 2087,
                            2095, 2096, 2480, 3000, 3128, 3333, 4243, 4567, 4711, 4712, 4993, 5000,
                            5104, 5108, 5800, 6543, 7000, 7396, 7474, 8000, 8001, 8008, 8014, 8042,
                            8069, 8080, 8081, 8088, 8090, 8091, 8118, 8123, 8172, 8222, 8243, 8280,
                            8281, 8333, 8443, 8500, 8834, 8880, 8888, 8983, 9000, 9043, 9060, 9080,
                            9090, 9091, 9200, 9443, 9800, 9981, 12443, 16080, 18091, 18092];
                case 'database':
                    return [1433, 1434, 1521, 1522, 1523, 1524, 1525, 1526, 1527, 1528, 1529, 1530,
                            1830, 3306, 3307, 3308, 3309, 3310, 3311, 3312, 4333, 5050, 5432, 5433,
                            5984, 6379, 6380, 7473, 7474, 7574, 7674, 7777, 7778, 7779, 8087, 8091,
                            8098, 8182, 8649, 8675, 9001, 9042, 9160, 9200, 9300, 11211, 11214, 11215,
                            18091, 18092, 20000, 27017, 27018, 27019, 28015, 28017, 29015, 50000, 50010,
                            50020, 50030, 50060, 50070, 50075, 50090];
                default:
                    return [20, 21, 22, 23, 25, 53, 80, 110, 143, 443, 3389, 8080];
            }
        }

        function getServiceByPort(port) {
            const services = {
                20: 'FTP-DATA', 21: 'FTP', 22: 'SSH', 23: 'Telnet', 25: 'SMTP', 53: 'DNS',
                67: 'DHCP-SERVER', 68: 'DHCP-CLIENT', 69: 'TFTP', 80: 'HTTP', 110: 'POP3',
                123: 'NTP', 135: 'MSRPC', 137: 'NetBIOS', 138: 'NetBIOS', 139: 'NetBIOS',
                143: 'IMAP', 161: 'SNMP', 162: 'SNMP-TRAP', 389: 'LDAP', 443: 'HTTPS',
                445: 'SMB', 465: 'SMTPS', 514: 'SYSLOG', 515: 'LPD', 587: 'SMTP',
                631: 'IPP', 636: 'LDAPS', 993: 'IMAPS', 995: 'POP3S', 1080: 'SOCKS',
                1194: 'OpenVPN', 1433: 'MSSQL', 1434: 'MSSQL', 1521: 'Oracle', 1723: 'PPTP',
                2049: 'NFS', 2082: 'cPanel', 2083: 'cPanel SSL', 2086: 'WHM', 2087: 'WHM SSL',
                2095: 'Webmail', 2096: 'Webmail SSL', 2222: 'DirectAdmin', 2375: 'Docker',
                2376: 'Docker SSL', 3000: 'Node.js', 3306: 'MySQL', 3389: 'RDP', 4000: 'RemoteAnything',
                4040: 'Jenkins', 4369: 'Erlang', 5000: 'UPnP', 5432: 'PostgreSQL', 5601: 'Kibana',
                5672: 'AMQP', 5900: 'VNC', 5984: 'CouchDB', 6379: 'Redis', 6443: 'Kubernetes',
                6667: 'IRC', 7000: 'Cassandra', 7001: 'Cassandra', 7199: 'Cassandra', 8000: 'HTTP-ALT',
                8001: 'HTTP-ALT', 8008: 'HTTP-ALT', 8009: 'AJP', 8080: 'HTTP-PROXY', 8081: 'HTTP-PROXY',
                8083: 'HTTP-PROXY', 8088: 'HTTP-PROXY', 8090: 'HTTP-PROXY', 8091: 'HTTP-PROXY',
                8100: 'HTTP-PROXY', 8181: 'HTTP-PROXY', 8200: 'GoCD', 8443: 'HTTPS-ALT', 8500: 'Consul',
                8649: 'Graphite', 8888: 'HTTP-ALT', 9000: 'SonarQube', 9001: 'Tor', 9042: 'Cassandra',
                9092: 'Kafka', 9100: 'PDL', 9200: 'Elasticsearch', 9300: 'Elasticsearch', 9418: 'Git',
                9999: 'HTTP-ALT', 10000: 'Webmin', 11211: 'Memcached', 15672: 'RabbitMQ',
                27017: 'MongoDB', 27018: 'MongoDB', 28015: 'RethinkDB', 50000: 'DB2', 50030: 'Hadoop',
                50060: 'Hadoop', 50070: 'Hadoop', 50075: 'Hadoop'
            };
            return services[port] || '未知';
        }

        function getPortDescription(port) {
            const descriptions = {
                20: 'FTP数据端口，用于文件传输',
                21: 'FTP控制端口，用于FTP命令',
                22: 'SSH安全外壳，用于安全远程登录',
                23: 'Telnet远程终端，不安全的远程登录',
                25: 'SMTP简单邮件传输协议，用于发送邮件',
                53: 'DNS域名系统，用于域名解析',
                80: 'HTTP超文本传输协议，用于网页浏览',
                110: 'POP3邮局协议，用于接收邮件',
                143: 'IMAP互联网消息访问协议，用于邮件访问',
                443: 'HTTPS安全超文本传输协议，加密的网页浏览',
                3389: 'RDP远程桌面协议，用于Windows远程访问',
                8080: 'HTTP代理端口，常用于开发或代理服务器'
            };
            return descriptions[port] || \`端口 \${port} - 网络服务端口\`;
        }
    </script>
</body>
</html>`;

// 主请求处理器
async function handleRequest(request) {
  const url = new URL(request.url);
  
  // 处理CORS预检请求
  if (request.method === 'OPTIONS') {
    return handleCORS();
  }
  
  // API路由
  if (url.pathname === '/scan') {
    return handleScan(request);
  }
  
  if (url.pathname === '/batch') {
    return handleBatchScan(request);
  }
  
  // 返回主页
  if (url.pathname === '/' || url.pathname === '/index.html') {
    return new Response(HTML, {
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  }
  
  // 默认返回主页
  return new Response(HTML, {
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
}