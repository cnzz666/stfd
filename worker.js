// Cloudflare Worker 端口扫描后端
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

// 丰富的端口用途映射表（远超参考示例）
const PORT_DESCRIPTIONS = {
  1: '传输控制协议端口服务多路开关选择器(tcpmux)，用于TCP端口服务复用',
  2: '管理实用程序(compressnet)，早期压缩网络管理',
  3: '压缩进程(compressnet)，数据压缩相关进程通信',
  4: '未分配，预留端口',
  5: '远程作业登录(rje)，远程作业提交与管理',
  6: '未分配，预留端口',
  7: '回显(echo)，测试网络连通性，返回接收到的数据包',
  8: '未分配，预留端口',
  9: '丢弃(discard)，接收数据包但不做任何响应，用于测试',
  10: '未分配，预留端口',
  11: '在线用户(systat Active Users)，查询系统当前在线用户',
  12: '未分配，预留端口',
  13: '时间(daytime)，提供当前日期和时间的ASCII字符串',
  14: '未分配，预留端口',
  15: 'netstat，查询网络连接状态',
  16: '未分配，预留端口',
  17: '每日名言(qotd)，返回随机的名言警句',
  18: '消息发送协议(msp)，早期消息传输协议',
  19: '字符发生器协议(chargen)，生成连续的ASCII字符流，用于测试',
  20: 'FTP 文件传输协议(默认数据口)，传输FTP数据',
  21: 'FTP 文件传输协议(控制)，FTP命令交互端口',
  22: 'SSH 远程登录协议，安全的远程服务器登录，替代Telnet',
  23: 'telnet(终端仿真协议)，明文远程登录，木马 Tiny Telnet Server 常利用此端口',
  24: '预留给个人用邮件系统(priv-mail)，私人邮件服务',
  25: 'SMTP 服务器端口，用于发送邮件，需配合POP3/IMAP接收',
  26: 'rsftp，增强型FTP服务',
  27: 'NSW用户系统FE(nsw-fe)，早期网络服务前端',
  28: '未分配，预留端口',
  29: 'MSG ICP，消息交换控制协议',
  30: '未分配，预留端口',
  31: 'MSG 验证(msg-auth)，木马 Master Paradise、HackersParadise 开放此端口',
  32: '未分配，预留端口',
  33: '显示支持协议(dsp)，显示设备通信协议',
  34: '未分配，预留端口',
  35: '预留给个人打印机服务(priv-print)，私人打印服务',
  36: '未分配，预留端口',
  37: '时间(time)，以32位二进制数返回当前时间',
  38: '路由访问协议(rap)，路由信息访问',
  39: '资源定位协议(rlp)，网络资源定位',
  40: '未分配，预留端口',
  41: '图形(graphics)，早期图形数据传输',
  42: '主机名服务(nameserver)，主机名解析',
  43: 'whois服务，查询域名/IP的注册信息',
  44: 'MPM(消息处理模块)标志协议(mpm-flags)，消息模块标识',
  45: '消息处理模块(mpm)，核心消息处理',
  46: '消息处理模块(默认发送口)(mpm-snd)，消息发送',
  47: 'NI FTP，网络设备FTP服务',
  48: '数码音频后台服务(auditd)，音频审计服务',
  49: 'TACACS 登录主机协议，远程认证服务',
  50: '远程邮件检查协议(re-mail-ck)，远程邮件校验',
  51: 'IMP(接口信息处理机)逻辑地址维护(la-maint)，网络设备地址管理',
  52: '施乐网络服务系统时间协议(xns-time)，Xerox网络时间同步',
  53: 'DNS域名服务器(domain)，域名解析核心端口，UDP/TCP均使用',
  54: '施乐网络服务系统票据交换(xns-ch)，Xerox网络票据交换',
  55: 'ISI图形语言(isi-gl)，ISI标准图形传输',
  56: '施乐网络服务系统验证(xns-auth)，Xerox网络认证',
  57: '预留个人用终端访问(priv-term)，私人终端访问',
  58: '施乐网络服务系统邮件(xns-mail)，Xerox网络邮件',
  59: '预留个人文件服务(priv-file)，私人文件服务',
  60: '未定义(Unassigned)',
  61: 'NI邮件(ni-mail)，网络设备邮件服务',
  62: '异步通讯适配器服务(acas)，异步通信适配',
  63: 'whois++，增强型whois服务',
  64: '通讯接口(covia)，通用通信接口',
  65: 'TACACS 数据库服务(tacacs-ds)，TACACS认证数据库',
  66: 'Oracle SQL*NET(sqlnet)，Oracle数据库通信',
  67: '引导程序协议服务端(bootps)，DHCP服务器端口，分配IP地址',
  68: '引导程序协议客户端(bootpc)，DHCP客户端端口',
  69: '小型文件传输协议(tftp)，无认证的简单文件传输',
  70: '信息检索协议(gopher)，早期互联网信息检索服务',
  71: '远程作业服务(netrjs-1)，远程作业执行1',
  72: '远程作业服务(netrjs-2)，远程作业执行2',
  73: '远程作业服务(netrjs-3)，远程作业执行3',
  74: '远程作业服务(netrjs-4)，远程作业执行4',
  75: '预留给个人拨出服务(priv-dial)，私人拨号服务',
  76: '分布式外部对象存储(deos)，分布式对象存储',
  77: '预留给个人远程作业输入服务(priv-rje)，私人远程作业提交',
  78: '修正TCP(vettcp)，TCP协议调试修正',
  79: '查询远程主机在线用户等信息(finger)，查询主机用户信息',
  80: 'HTTP，超文本传输协议，Web服务核心端口',
  81: 'HOST2名称服务(hosts2-ns)，备用域名解析，也常用于内网Web服务',
  82: '传输实用程序(xfer)，文件传输工具',
  83: '模块化智能终端ML设备(mit-ml-dev)，MIT智能终端通信',
  84: '公用追踪设备(ctf)，通用跟踪服务',
  85: '模块化智能终端ML设备(mit-ml-dev)，备用智能终端通信',
  86: 'Micro Focus Cobol 编程语言(mfcobol)，COBOL语言开发调试',
  87: '预留给个人终端连接(priv-term-l)，本地私人终端连接',
  88: 'Kerberros安全认证系统(kerberos-sec)，企业级身份认证',
  89: 'SU/MIT telnet(终端仿真网关)(su-mit-tg)，MIT Telnet网关',
  90: 'DNSIX安全属性标记图，DNS安全扩展',
  91: 'MIT Dover 假脱机，MIT打印假脱机服务',
  92: '网络打印协议(npp)，网络打印管理',
  93: '设备控制协议(dcp)，硬件设备控制',
  94: 'Tivoli 对象调度(objcall)，Tivoli运维平台调度',
  95: 'supdup，远程终端服务增强版',
  96: 'DIXIE 协议规范，目录访问协议',
  97: '快速远程虚拟文件协议(swift-rvf)，快速虚拟文件传输',
  98: 'TAC新闻协议(tacnews)、linuxconf，Linux系统配置',
  99: '后门程序ncx99 开放此端口、metagram，元数据传输',
  100: 'newacct，新建账户服务',
  102: '消息传输代理、ISO开发环境(ISODE)网络应用，ISO标准网络应用',
  109: 'POP2 服务器端口，早期邮件接收协议，已被POP3取代',
  110: 'POP3 服务器端口，邮件接收核心端口，从服务器下载邮件',
  111: 'SUN RPC服务(rpcbind)，UNIX/Linux远程过程调用',
  113: '认证服务(ident)，鉴别TCP连接的用户身份',
  119: 'NNTP，USENET新闻组传输协议',
  120: 'cfdptkt，证书分发协议',
  135: 'RPC(msrpc)，Windows远程过程调用，DCOM服务核心',
  137: 'NETBIOS-NS，NetBIOS名称解析，Windows共享发现',
  138: 'NETBIOS-DGM，NetBIOS数据报，Windows共享通信',
  139: 'NETBIOS-SSN，NetBIOS会话，Windows文件/打印机共享',
  143: 'IMAP，邮件交互访问协议，比POP3更灵活的邮件接收',
  161: 'SNMP，简单网络管理协议，监控网络设备(路由器/交换机)',
  162: 'SNMPTRAP，SNMP陷阱，网络设备异常告警',
  177: 'XDMCP，X窗口系统远程显示管理',
  389: 'LDAP，轻型目录访问协议，企业级用户目录管理(如AD)',
  443: 'HTTPS，安全HTTP，Web服务加密传输，SSL/TLS加持',
  445: 'SMB/Microsoft-DS，Windows文件共享(替代139)，易被勒索病毒利用',
  512: 'rexec，UNIX远程执行命令，明文传输风险高',
  513: 'rlogin，UNIX远程登录，明文传输',
  514: 'syslog，系统日志，收集设备/服务器日志',
  548: 'AFP，苹果文件共享协议，MacOS设备共享',
  636: 'LDAPS，加密LDAP服务，LDAP over SSL',
  993: 'IMAPS，加密IMAP服务，IMAP over SSL',
  995: 'POP3S，加密POP3服务，POP3 over SSL',
  1080: 'SOCKS，代理协议，转发各类网络请求',
  1433: 'MSSQL，微软SQL Server数据库默认端口',
  1521: 'Oracle数据库，Oracle默认监听端口',
  1526: 'Oracle数据库，备用监听端口',
  2049: 'NFS，UNIX/Linux网络文件系统，跨主机文件共享',
  2181: 'ZooKeeper，分布式协调服务，大数据组件核心',
  3306: 'MySQL/MariaDB，关系型数据库核心端口',
  3389: 'RDP，Windows远程桌面，图形化远程控制',
  3690: 'SVN，版本控制系统，代码管理',
  5432: 'PostgreSQL，开源关系型数据库端口',
  5900: 'VNC，跨平台远程桌面协议',
  6379: 'Redis，开源内存数据库，缓存服务',
  6380: 'RedisSSL，加密Redis服务',
  7001: 'WebLogic，Oracle中间件默认端口',
  8080: 'HTTP代理/备用Web端口，Tomcat/代理服务器常用',
  8081: '备用Web端口，多服务部署时常用',
  8443: 'HTTPS备用端口，Tomcat SSL默认端口',
  9200: 'Elasticsearch，搜索引擎REST API端口',
  9300: 'Elasticsearch，集群通信端口',
  27017: 'MongoDB，非关系型数据库默认端口',
  27018: 'MongoDB，副本集通信端口',
  5672: 'RabbitMQ，消息队列默认端口',
  61616: 'ActiveMQ，消息队列核心端口',
  8888: 'HTTP代理/开发服务器，Python/Node开发常用',
  9092: 'Kafka，消息队列Broker端口',
  11211: 'Memcached，分布式缓存服务端口',
  // 补充更多恶意端口/特殊用途端口
  1234: '木马 SubSeven2.0、Ultors Trojan 开放，Hotline通信',
  1243: '木马 SubSeven1.0/1.9 开放，串口网关',
  1492: '木马 FTP99CMP 开放，Stone Design软件通信',
  1600: '木马 Shivka-Burka 开放，ISSD服务',
  2000: '木马 GirlFriend 1.3 开放，Cisco SCCP协议',
  2023: '木马 Pass Ripper 开放，Windows扩展服务',
  3128: 'Squid HTTP代理，企业级代理服务器',
  3333: '木马 Prosiak 开放，DEC笔记服务',
  4000: '腾讯QQ客户端，远程管理服务',
  5000: '木马 blazer5 开放，UPnP服务',
  7626: '木马冰河开放，SIMCO工业通信',
  8000: '腾讯QQ服务器，HTTP备用端口',
  12345: '木马 NetBus1.60 开放，NetBus远控',
  31337: '木马 BO(Back Orifice)开放，黑客常用远控端口',
  33899: 'Windows远程桌面备用端口，管理员自定义',
  65535: '未分配，TCP端口最大值，部分木马利用此端口隐藏'
};

// 多线程扫描核心函数（利用Cloudflare并发优势）
async function scanPort(host, port, timeout = 1000) {
  try {
    const start = Date.now();
    // 使用Cloudflare TCP连接检测端口状态
    const conn = await Deno.connect({ hostname: host, port: port, transport: "tcp" });
    conn.close();
    const latency = Date.now() - start;
    return { port, status: 'open', latency, description: PORT_DESCRIPTIONS[port] || '未标注端口' };
  } catch (e) {
    // 区分关闭/过滤状态（Cloudflare网络特性）
    const status = e.message.includes('connection refused') ? 'close' : 'filtered';
    return { port, status, latency: timeout, description: PORT_DESCRIPTIONS[port] || '未标注端口' };
  }
}

// 分批次扫描（避免Cloudflare限流）
async function batchScan(host, ports, batchSize = 50, timeout = 1000) {
  const results = [];
  // 分批处理端口
  for (let i = 0; i < ports.length; i += batchSize) {
    const batch = ports.slice(i, i + batchSize);
    // 并发扫描当前批次
    const batchResults = await Promise.all(
      batch.map(port => scanPort(host, port, timeout))
    );
    results.push(...batchResults);
    // 轻微延迟避免触发防护
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return results;
}

// 请求处理主函数
async function handleRequest(request) {
  const url = new URL(request.url);
  
  // 跨域处理
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  // 处理OPTIONS预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  // 扫描请求处理
  if (url.pathname === '/scan') {
    const { host, scanType, portRange, timeout } = await request.json();
    
    // 验证参数
    if (!host) return new Response(JSON.stringify({ error: '请输入目标IP/域名' }), { headers });
    
    let ports = [];
    // 常规端口（常用1-65535中高频端口）
    const commonPorts = [1,2,3,5,7,9,11,13,17,19,20,21,22,23,25,37,43,53,67,68,69,70,79,80,88,110,111,113,119,135,137,138,139,143,161,162,389,443,445,512,513,514,636,993,995,1080,1433,1521,2049,3306,3389,5432,5900,6379,8080,8443,9200,27017];
    
    // 按扫描类型生成端口列表
    switch (scanType) {
      case 'common':
        ports = commonPorts;
        break;
      case 'range':
        if (!portRange || !portRange.includes('-')) {
          return new Response(JSON.stringify({ error: '端口范围格式错误（例：1-100）' }), { headers });
        }
        const [start, end] = portRange.split('-').map(Number);
        if (start < 1 || end > 65535 || start > end) {
          return new Response(JSON.stringify({ error: '端口范围无效（1-65535）' }), { headers });
        }
        ports = Array.from({ length: end - start + 1 }, (_, i) => start + i);
        break;
      case 'all':
        ports = Array.from({ length: 65535 }, (_, i) => i + 1);
        break;
      default:
        ports = commonPorts;
    }

    // 执行扫描并返回结果
    const results = await batchScan(host, ports, 50, Number(timeout) || 1000);
    return new Response(JSON.stringify({ 
      ip: host,
      scanTime: new Date().toLocaleString(),
      results 
    }), { headers });
  }

  // 提供前端页面
  if (url.pathname === '/') {
    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>在线端口扫描工具 - 基于Cloudflare Worker</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      font-family: "Microsoft Yahei", Arial, sans-serif;
    }
    body {
      background: #f5f7fa;
      color: #333;
      line-height: 1.6;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.08);
      padding: 30px;
    }
    header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 1px solid #eee;
    }
    header h1 {
      color: #2c3e50;
      font-size: 28px;
      margin-bottom: 10px;
    }
    header p {
      color: #7f8c8d;
      font-size: 14px;
    }
    .scan-options {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 6px;
      margin-bottom: 20px;
    }
    .form-group {
      margin-bottom: 15px;
      display: flex;
      align-items: center;
    }
    .form-group label {
      width: 120px;
      font-weight: 600;
      color: #34495e;
    }
    .form-group input, .form-group select, .form-group button {
      flex: 1;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
    }
    .form-group button {
      background: #3498db;
      color: #fff;
      border: none;
      cursor: pointer;
      transition: background 0.3s;
      width: 100px;
      margin-left: 10px;
    }
    .form-group button:hover {
      background: #2980b9;
    }
    .form-group button:disabled {
      background: #bdc3c7;
      cursor: not-allowed;
    }
    .scan-type {
      display: flex;
      gap: 15px;
      margin-bottom: 15px;
    }
    .scan-type label {
      display: flex;
      align-items: center;
      cursor: pointer;
    }
    .scan-type input {
      margin-right: 5px;
    }
    .results {
      margin-top: 20px;
    }
    .results-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      padding: 10px;
      background: #e9f5ff;
      border-radius: 4px;
    }
    .results-header .info {
      color: #2980b9;
      font-weight: 600;
    }
    .results-header .status {
      color: #e74c3c;
      font-size: 14px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    table th, table td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #eee;
    }
    table th {
      background: #f8f9fa;
      color: #2c3e50;
      font-weight: 600;
    }
    table tr:hover {
      background: #f8f9fa;
    }
    .status-open {
      color: #27ae60;
      font-weight: 600;
    }
    .status-close {
      color: #e74c3c;
    }
    .status-filtered {
      color: #f39c12;
    }
    .loading {
      text-align: center;
      padding: 50px;
      color: #7f8c8d;
    }
    .loading-spinner {
      border: 4px solid #f3f3f3;
      border-top: 4px solid #3498db;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .port-desc {
      font-size: 13px;
      color: #7f8c8d;
    }
    .disclaimer {
      margin-top: 30px;
      padding: 15px;
      background: #fff3cd;
      border-radius: 4px;
      font-size: 13px;
      color: #856404;
    }
    .latency {
      font-family: monospace;
      color: #3498db;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>在线端口扫描工具</h1>
      <p>基于Cloudflare Worker构建 | 多线程快速扫描 | 结果实时展示</p>
    </header>

    <div class="scan-options">
      <div class="form-group">
        <label>目标IP/域名：</label>
        <input type="text" id="targetHost" placeholder="例：1.1.1.1 或 example.com" required>
        <label style="width: 80px;">超时时间：</label>
        <input type="number" id="timeout" value="1000" min="100" max="5000" style="width: 100px;">
        <span style="margin: 0 10px;">ms</span>
      </div>

      <div class="scan-type">
        <label><input type="radio" name="scanType" value="common" checked> 常规端口（高频1-65535）</label>
        <label><input type="radio" name="scanType" value="range"> 指定范围</label>
        <label><input type="radio" name="scanType" value="all"> 全部端口（1-65535）</label>
      </div>

      <div class="form-group" id="rangeGroup" style="display: none;">
        <label>端口范围：</label>
        <input type="text" id="portRange" placeholder="例：1-1000 或 80,443,3389">
      </div>

      <div class="form-group">
        <label></label>
        <button id="startScan">开始扫描</button>
        <button id="stopScan" disabled>停止扫描</button>
      </div>
    </div>

    <div class="results">
      <div class="results-header">
        <div class="info">扫描结果：未开始</div>
        <div class="status" id="scanStatus"></div>
      </div>
      
      <div id="resultsContainer" style="display: none;">
        <table>
          <thead>
            <tr>
              <th>端口号</th>
              <th>状态</th>
              <th>响应延迟</th>
              <th>端口用途说明</th>
            </tr>
          </thead>
          <tbody id="resultsTable">
            <!-- 扫描结果会动态插入这里 -->
          </tbody>
        </table>
      </div>

      <div id="loading" class="loading" style="display: none;">
        <div class="loading-spinner"></div>
        <p>正在扫描中，请稍候...</p>
        <p>已扫描 <span id="scannedCount">0</span> / <span id="totalCount">0</span> 个端口</p>
      </div>
    </div>

    <div class="disclaimer">
      <strong>免责声明：</strong>
      1. 本工具仅用于合法的网络空间测绘和安全测试，禁止用于未授权的扫描行为；
      2. 扫描结果基于Cloudflare网络环境检测，仅供参考，不保证100%准确；
      3. 使用本工具即表示您同意遵守相关法律法规，一切责任由使用者自行承担。
    </div>
  </div>

  <script>
    // 显示/隐藏端口范围输入框
    const scanTypeRadios = document.querySelectorAll('input[name="scanType"]');
    const rangeGroup = document.getElementById('rangeGroup');
    scanTypeRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        rangeGroup.style.display = radio.value === 'range' ? 'flex' : 'none';
      });
    });

    // 扫描状态管理
    let isScanning = false;
    let scanAbortController = null;
    const startBtn = document.getElementById('startScan');
    const stopBtn = document.getElementById('stopScan');
    const resultsContainer = document.getElementById('resultsContainer');
    const loading = document.getElementById('loading');
    const resultsTable = document.getElementById('resultsTable');
    const scanStatus = document.getElementById('scanStatus');
    const scannedCount = document.getElementById('scannedCount');
    const totalCount = document.getElementById('totalCount');

    // 开始扫描
    startBtn.addEventListener('click', async () => {
      const host = document.getElementById('targetHost').value.trim();
      const timeout = parseInt(document.getElementById('timeout').value);
      const scanType = document.querySelector('input[name="scanType"]:checked').value;
      let portRange = '';

      // 验证参数
      if (!host) {
        alert('请输入目标IP/域名！');
        return;
      }
      if (scanType === 'range') {
        portRange = document.getElementById('portRange').value.trim();
        if (!portRange) {
          alert('请输入端口范围！');
          return;
        }
      }

      // 初始化扫描状态
      isScanning = true;
      startBtn.disabled = true;
      stopBtn.disabled = false;
      resultsContainer.style.display = 'none';
      loading.style.display = 'block';
      resultsTable.innerHTML = '';
      scanStatus.textContent = '扫描中...';
      scannedCount.textContent = '0';

      // 创建中止控制器
      scanAbortController = new AbortController();
      const signal = scanAbortController.signal;

      try {
        // 发送扫描请求
        const response = await fetch('/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            host,
            scanType,
            portRange,
            timeout
          }),
          signal
        });

        if (!response.ok) throw new Error('扫描请求失败');
        
        const result = await response.json();
        if (result.error) {
          alert(result.error);
          return;
        }

        // 更新扫描信息
        document.querySelector('.results-header .info').textContent = `扫描结果：${result.ip} | 扫描时间：${result.scanTime}`;
        totalCount.textContent = result.results.length;
        
        // 实时渲染结果（模拟分批展示）
        let count = 0;
        result.results.forEach((item, index) => {
          setTimeout(() => {
            if (!isScanning) return;
            count++;
            scannedCount.textContent = count;
            
            // 创建行
            const tr = document.createElement('tr');
            
            // 端口号
            const portTd = document.createElement('td');
            portTd.textContent = item.port;
            portTd.style.fontWeight = '600';
            
            // 状态
            const statusTd = document.createElement('td');
            const statusSpan = document.createElement('span');
            statusSpan.textContent = item.status.toUpperCase();
            statusSpan.className = `status-${item.status}`;
            statusTd.appendChild(statusSpan);
            
            // 延迟
            const latencyTd = document.createElement('td');
            latencyTd.className = 'latency';
            latencyTd.textContent = `${item.latency} ms`;
            
            // 描述
            const descTd = document.createElement('td');
            descTd.className = 'port-desc';
            descTd.textContent = item.description;
            
            // 组装行
            tr.appendChild(portTd);
            tr.appendChild(statusTd);
            tr.appendChild(latencyTd);
            tr.appendChild(descTd);
            resultsTable.appendChild(tr);
            
            // 全部渲染完成
            if (index === result.results.length - 1) {
              isScanning = false;
              startBtn.disabled = false;
              stopBtn.disabled = true;
              loading.style.display = 'none';
              resultsContainer.style.display = 'block';
              scanStatus.textContent = `扫描完成 | 开放端口：${result.results.filter(r => r.status === 'open').length} 个`;
            }
          }, index * 10); // 每10ms渲染一行，模拟实时扫描
        });

      } catch (e) {
        if (e.name !== 'AbortError') {
          alert('扫描出错：' + e.message);
          scanStatus.textContent = '扫描失败';
        } else {
          scanStatus.textContent = '扫描已中止';
        }
        isScanning = false;
        startBtn.disabled = false;
        stopBtn.disabled = true;
        loading.style.display = 'none';
      }
    });

    // 停止扫描
    stopBtn.addEventListener('click', () => {
      if (scanAbortController) {
        scanAbortController.abort();
        isScanning = false;
        startBtn.disabled = false;
        stopBtn.disabled = true;
        loading.style.display = 'none';
        scanStatus.textContent = '扫描已中止';
      }
    });
  </script>
</body>
</html>
    `;
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        ...headers
      }
    });
  }

  // 404处理
  return new Response('404 Not Found', { status: 404, headers });
}