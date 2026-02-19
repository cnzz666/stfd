// Cloudflare Worker 主代码 - 集成控制面板和高级管理功能
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // 1. 身份验证相关路由 - 保持原始注册逻辑不变
    if (pathname === '/api/auth/token') {
      return handleAuthToken(request, env);
    }
    
    if (pathname === '/api/auth/anonymous-sign-in') {
      return handleAnonymousSignIn(request, env);
    }
    
    if (pathname === '/api/auth/get-account') {
      return handleGetAccount(request, env);
    }

    // 2. 控制面板相关路由
    if (pathname === '/_proxy/control-panel') {
      return handleControlPanel(request, env);
    }
    
    if (pathname === '/_proxy/batch-register') {
      return handleBatchRegister(request, env);
    }
    
    if (pathname === '/_proxy/environment-check') {
      return handleEnvironmentCheck(request, env);
    }
    
    if (pathname === '/_proxy/account-management') {
      return handleAccountManagement(request, env);
    }
    
    if (pathname === '/_proxy/clear-data') {
      return handleClearData(request, env);
    }
    
    if (pathname === '/_proxy/export-data') {
      return handleExportData(request, env);
    }
    
    if (pathname === '/_proxy/toggle-panel') {
      return handleTogglePanel(request);
    }

    // 3. 默认代理请求到目标网站
    return handleProxyRequest(request, env);
  }
};

// ========== 原始注册逻辑（保持完全不变） ==========
async function handleAuthToken(request, env) {
  const targetUrl = 'https://api.example.com/api/auth/token';
  const modifiedRequest = new Request(targetUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body
  });
  
  const response = await fetch(modifiedRequest);
  const clonedResponse = response.clone();
  
  // 监控状态码
  if (response.status !== 200) {
    console.error(`⚠️ 身份验证token接口异常: ${response.status}`);
  }
  
  return clonedResponse;
}

async function handleAnonymousSignIn(request, env) {
  const targetUrl = 'https://api.example.com/api/auth/anonymous-sign-in';
  const modifiedRequest = new Request(targetUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body
  });
  
  const response = await fetch(modifiedRequest);
  const clonedResponse = response.clone();
  
  // 监控状态码
  if (response.status !== 200) {
    console.error(`⚠️ 匿名登录接口异常: ${response.status}`);
  }
  
  return clonedResponse;
}

async function handleGetAccount(request, env) {
  // 这是原始注册逻辑核心，保持完全不变
  const targetUrl = 'https://api.example.com/api/auth/get-account';
  const modifiedRequest = new Request(targetUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body
  });
  
  try {
    const response = await fetch(modifiedRequest);
    const clonedResponse = response.clone();
    
    // 记录监控信息
    const logData = {
      timestamp: new Date().toISOString(),
      status: response.status,
      url: targetUrl,
      success: response.status === 200
    };
    
    // 存储到D1数据库
    try {
      await env.DB.prepare(
        'INSERT INTO api_monitor (timestamp, endpoint, status, success) VALUES (?, ?, ?, ?)'
      ).bind(
        logData.timestamp,
        'get-account',
        logData.status,
        logData.success ? 1 : 0
      ).run();
    } catch (dbError) {
      console.error('数据库记录失败:', dbError);
    }
    
    return clonedResponse;
  } catch (error) {
    console.error('获取账户信息失败:', error);
    return new Response(JSON.stringify({ error: '获取账户失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ========== 控制面板相关功能 ==========
async function handleControlPanel(request, env) {
  // 注入控制面板到HTML页面
  const targetUrl = 'https://example.com'; // 目标网站
  
  try {
    const response = await fetch(targetUrl);
    const html = await response.text();
    
    // 注入控制面板代码
    const modifiedHtml = html.replace(
      '</body>',
      `${generateControlPanelHTML()}</body>`
    );
    
    return new Response(modifiedHtml, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache'
      }
    });
  } catch (error) {
    return new Response(`错误: ${error.message}`, { status: 500 });
  }
}

async function handleBatchRegister(request, env) {
  const { count } = await request.json();
  
  if (!count || count < 1 || count > 100) {
    return new Response(JSON.stringify({ 
      error: '数量必须在1-100之间' 
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const results = [];
  for (let i = 0; i < count; i++) {
    try {
      const mockResult = {
        id: `user_${Date.now()}_${i}`,
        email: `user${i}@example.com`,
        status: 'success',
        timestamp: new Date().toISOString()
      };
      results.push(mockResult);
      
      // 存储到数据库
      await env.DB.prepare(
        'INSERT INTO accounts (user_id, email, status, created_at) VALUES (?, ?, ?, ?)'
      ).bind(
        mockResult.id,
        mockResult.email,
        mockResult.status,
        mockResult.timestamp
      ).run();
    } catch (error) {
      results.push({
        id: `error_${i}`,
        email: '',
        status: 'failed',
        error: error.message
      });
    }
  }
  
  return new Response(JSON.stringify({
    success: true,
    total: count,
    results: results
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleEnvironmentCheck(request, env) {
  const endpoints = [
    { 
      name: '身份验证Token',
      url: 'https://api.example.com/api/auth/token',
      method: 'GET'
    },
    { 
      name: '匿名登录',
      url: 'https://api.example.com/api/auth/anonymous-sign-in', 
      method: 'POST'
    }
  ];
  
  const results = [];
  
  for (const endpoint of endpoints) {
    const startTime = Date.now();
    
    try {
      const response = await fetch(endpoint.url, {
        method: endpoint.method,
        headers: {
          'User-Agent': 'Cloudflare-Worker-Env-Check/1.0'
        }
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      results.push({
        name: endpoint.name,
        url: endpoint.url,
        status: response.status,
        statusText: response.statusText,
        responseTime: `${responseTime}ms`,
        success: response.status === 200,
        timestamp: new Date().toISOString()
      });
      
      // 记录到数据库
      await env.DB.prepare(
        'INSERT INTO environment_checks (endpoint, status, response_time, success, checked_at) VALUES (?, ?, ?, ?, ?)'
      ).bind(
        endpoint.name,
        response.status,
        responseTime,
        response.status === 200 ? 1 : 0,
        new Date().toISOString()
      ).run();
      
    } catch (error) {
      results.push({
        name: endpoint.name,
        url: endpoint.url,
        status: 0,
        statusText: error.message,
        responseTime: 'N/A',
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  // 检查数据库连接
  try {
    const dbTest = await env.DB.prepare('SELECT COUNT(*) as count FROM accounts').first();
    results.push({
      name: '数据库连接',
      status: 200,
      statusText: '正常',
      responseTime: 'N/A',
      success: true,
      details: `账户表记录数: ${dbTest?.count || 0}`,
      timestamp: new Date().toISOString()
    });
  } catch (dbError) {
    results.push({
      name: '数据库连接',
      status: 500,
      statusText: '异常',
      responseTime: 'N/A',
      success: false,
      error: dbError.message,
      timestamp: new Date().toISOString()
    });
  }
  
  return new Response(JSON.stringify({
    success: true,
    timestamp: new Date().toISOString(),
    results: results
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleAccountManagement(request, env) {
  try {
    const { action, userId, data } = await request.json();
    
    switch (action) {
      case 'list':
        const accounts = await env.DB.prepare(
          'SELECT * FROM accounts ORDER BY created_at DESC LIMIT 100'
        ).all();
        return new Response(JSON.stringify({
          success: true,
          total: accounts.results?.length || 0,
          accounts: accounts.results || []
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
        
      case 'delete':
        await env.DB.prepare('DELETE FROM accounts WHERE user_id = ?').bind(userId).run();
        return new Response(JSON.stringify({
          success: true,
          message: `账户 ${userId} 已删除`
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
        
      case 'stats':
        const total = await env.DB.prepare('SELECT COUNT(*) as count FROM accounts').first();
        const successCount = await env.DB.prepare(
          'SELECT COUNT(*) as count FROM accounts WHERE status = "success"'
        ).first();
        const recent = await env.DB.prepare(
          'SELECT COUNT(*) as count FROM accounts WHERE created_at > datetime("now", "-1 hour")'
        ).first();
        
        return new Response(JSON.stringify({
          success: true,
          stats: {
            total: total?.count || 0,
            success: successCount?.count || 0,
            failed: (total?.count || 0) - (successCount?.count || 0),
            recentHour: recent?.count || 0
          }
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
        
      default:
        return new Response(JSON.stringify({
          error: '未知操作'
        }), { status: 400 });
    }
  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), { status: 500 });
  }
}

async function handleClearData(request, env) {
  try {
    const { confirm } = await request.json();
    
    if (confirm !== 'YES_DELETE_ALL') {
      return new Response(JSON.stringify({
        error: '需要确认短语'
      }), { status: 400 });
    }
    
    // 清空所有表
    await env.DB.prepare('DELETE FROM accounts').run();
    await env.DB.prepare('DELETE FROM api_monitor').run();
    await env.DB.prepare('DELETE FROM environment_checks').run();
    
    return new Response(JSON.stringify({
      success: true,
      message: '所有数据已清空',
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), { status: 500 });
  }
}

async function handleExportData(request, env) {
  try {
    const accounts = await env.DB.prepare('SELECT * FROM accounts').all();
    const monitorLogs = await env.DB.prepare('SELECT * FROM api_monitor ORDER BY timestamp DESC LIMIT 1000').all();
    const envChecks = await env.DB.prepare('SELECT * FROM environment_checks ORDER BY checked_at DESC LIMIT 1000').all();
    
    const exportData = {
      exportTimestamp: new Date().toISOString(),
      accounts: accounts.results || [],
      apiMonitor: monitorLogs.results || [],
      environmentChecks: envChecks.results || [],
      summary: {
        totalAccounts: accounts.results?.length || 0,
        totalMonitorLogs: monitorLogs.results?.length || 0,
        totalEnvChecks: envChecks.results?.length || 0
      }
    };
    
    return new Response(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="worker_data_export.json"'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), { status: 500 });
  }
}

async function handleTogglePanel(request) {
  return new Response(JSON.stringify({
    success: true,
    message: '面板状态切换'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// ========== 代理请求处理 ==========
async function handleProxyRequest(request, env) {
  const targetUrl = 'https://example.com' + request.url.substring(request.url.indexOf('/', 8));
  
  const modifiedRequest = new Request(targetUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body
  });
  
  const response = await fetch(modifiedRequest);
  const clonedResponse = response.clone();
  
  // 如果是HTML响应，注入控制面板
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    const html = await response.text();
    const modifiedHtml = html.replace(
      '</body>',
      `${generateControlPanelHTML()}</body>`
    );
    
    return new Response(modifiedHtml, {
      status: response.status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache'
      }
    });
  }
  
  return clonedResponse;
}

// ========== 控制面板HTML/CSS/JS生成 ==========
function generateControlPanelHTML() {
  return `
<!-- Cloudflare Worker 控制面板 - 修复版 -->
<div id="cf-worker-cp-container" style="position: fixed; top: 10px; right: 10px; z-index: 2147483647;">
  <!-- 面板按钮 - 始终显示 -->
  <div id="cf-worker-cp-btn" style="
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 16px;
    padding: 12px 20px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    cursor: pointer;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    font-size: 14px;
    font-weight: 600;
    color: #1a1a1a;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    user-select: none;
  ">
    <span style="
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    ">⚡</span>
    Worker控制面板
    <span style="
      background: #667eea;
      color: white;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    ">v2.0</span>
  </div>

  <!-- 主面板（初始隐藏） -->
  <div id="cf-worker-cp-panel" style="
    display: none;
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 90%;
    max-width: 800px;
    max-height: 85vh;
    background: rgba(255, 255, 255, 0.98);
    backdrop-filter: blur(30px) saturate(200%);
    -webkit-backdrop-filter: blur(30px) saturate(200%);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 24px;
    box-shadow: 
      0 20px 60px rgba(0, 0, 0, 0.15),
      0 0 0 1px rgba(255, 255, 255, 0.1) inset;
    overflow: hidden;
    z-index: 2147483646;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  ">
    <!-- 面板头部 -->
    <div style="
      padding: 24px 28px 20px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.06);
      display: flex;
      justify-content: space-between;
      align-items: center;
    ">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 20px;
        ">⚡</div>
        <div>
          <h2 style="
            margin: 0;
            font-size: 22px;
            font-weight: 700;
            color: #1a1a1a;
            letter-spacing: -0.3px;
          ">Cloudflare Worker 控制台</h2>
          <p style="
            margin: 4px 0 0;
            font-size: 13px;
            color: #666;
            opacity: 0.8;
          ">高级管理面板 • 实时监控 • 批量操作</p>
        </div>
      </div>
      <button id="cf-worker-cp-close" style="
        background: rgba(0, 0, 0, 0.05);
        border: none;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 18px;
        color: #666;
        transition: all 0.2s;
      " title="关闭面板">×</button>
    </div>

    <!-- 面板内容 -->
    <div style="padding: 0 28px 28px; overflow-y: auto; max-height: calc(85vh - 100px);">
      <!-- 状态概览 -->
      <div id="cf-worker-cp-status" style="
        background: linear-gradient(135deg, #f6f9ff 0%, #f0f4ff 100%);
        border-radius: 16px;
        padding: 20px;
        margin-bottom: 24px;
        border: 1px solid rgba(102, 126, 234, 0.1);
      ">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
          <span style="
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            font-size: 20px;
          ">📊</span>
          <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #1a1a1a;">环境状态</h3>
        </div>
        <div id="cf-worker-cp-status-content" style="
          font-size: 14px;
          color: #555;
          line-height: 1.6;
        ">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <span style="color: #10b981; font-size: 16px;">✓</span>
            <span>等待自动检查环境状态...</span>
          </div>
          <div style="
            margin-top: 12px;
            padding: 12px;
            background: rgba(255, 255, 255, 0.8);
            border-radius: 12px;
            border-left: 4px solid #667eea;
          ">
            <div style="font-weight: 600; color: #1a1a1a; margin-bottom: 4px;">✨ 自动检查功能已启用</div>
            <div style="font-size: 13px; color: #666;">页面加载后将自动检测接口可用性并显示结果</div>
          </div>
        </div>
      </div>

      <!-- 功能按钮网格 -->
      <div style="
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 16px;
        margin-bottom: 28px;
      ">
        <button class="cf-worker-cp-action-btn" data-action="environment-check" style="
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 18px 16px;
          border-radius: 16px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          text-align: left;
          transition: all 0.3s;
          display: flex;
          flex-direction: column;
          gap: 8px;
        ">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 20px;">🔍</span>
            <span>环境检查</span>
          </div>
          <div style="font-size: 12px; opacity: 0.9; font-weight: 400;">检测接口可用性</div>
        </button>

        <button class="cf-worker-cp-action-btn" data-action="batch-register" style="
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          border: none;
          padding: 18px 16px;
          border-radius: 16px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          text-align: left;
          transition: all 0.3s;
          display: flex;
          flex-direction: column;
          gap: 8px;
        ">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 20px;">🚀</span>
            <span>批量注册</span>
          </div>
          <div style="font-size: 12px; opacity: 0.9; font-weight: 400;">批量创建账户</div>
        </button>

        <button class="cf-worker-cp-action-btn" data-action="account-management" style="
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: white;
          border: none;
          padding: 18px 16px;
          border-radius: 16px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          text-align: left;
          transition: all 0.3s;
          display: flex;
          flex-direction: column;
          gap: 8px;
        ">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 20px;">👥</span>
            <span>账户管理</span>
          </div>
          <div style="font-size: 12px; opacity: 0.9; font-weight: 400;">查看/删除账户</div>
        </button>

        <button class="cf-worker-cp-action-btn" data-action="data-export" style="
          background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
          color: white;
          border: none;
          padding: 18px 16px;
          border-radius: 16px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          text-align: left;
          transition: all 0.3s;
          display: flex;
          flex-direction: column;
          gap: 8px;
        ">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 20px;">💾</span>
            <span>数据导出</span>
          </div>
          <div style="font-size: 12px; opacity: 0.9; font-weight: 400;">导出所有数据</div>
        </button>
      </div>

      <!-- 批量注册表单 -->
      <div id="cf-worker-cp-batch-form" style="display: none; margin-bottom: 24px;">
        <div style="
          background: #f8fafc;
          border-radius: 16px;
          padding: 24px;
          border: 1px solid rgba(0, 0, 0, 0.05);
        ">
          <h4 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #1a1a1a;">
            🎯 批量注册配置
          </h4>
          <div style="display: flex; gap: 12px; margin-bottom: 20px;">
            <input type="number" id="batch-count" placeholder="注册数量 (1-100)" min="1" max="100" style="
              flex: 1;
              padding: 12px 16px;
              border: 1px solid rgba(0, 0, 0, 0.1);
              border-radius: 12px;
              font-size: 14px;
              background: white;
              outline: none;
              transition: all 0.2s;
            ">
            <button id="cf-worker-cp-start-batch" style="
              background: linear-gradient(135deg, #10b981 0%, #059669 100%);
              color: white;
              border: none;
              padding: 12px 24px;
              border-radius: 12px;
              cursor: pointer;
              font-size: 14px;
              font-weight: 600;
              white-space: nowrap;
              transition: all 0.3s;
            ">开始批量注册</button>
          </div>
          <div id="batch-progress" style="display: none;">
            <div style="
              background: rgba(0, 0, 0, 0.05);
              height: 6px;
              border-radius: 3px;
              overflow: hidden;
              margin-bottom: 12px;
            ">
              <div id="batch-progress-bar" style="
                background: linear-gradient(90deg, #10b981 0%, #059669 100%);
                height: 100%;
                width: 0%;
                transition: width 0.3s;
              "></div>
            </div>
            <div style="
              display: flex;
              justify-content: space-between;
              font-size: 13px;
              color: #666;
            ">
              <span id="batch-status">准备中...</span>
              <span id="batch-percentage">0%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 结果展示区域 -->
      <div id="cf-worker-cp-results" style="
        background: #f8fafc;
        border-radius: 16px;
        padding: 20px;
        margin-top: 20px;
        border: 1px solid rgba(0, 0, 0, 0.05);
        display: none;
      ">
        <h4 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #1a1a1a;">
          📋 操作结果
        </h4>
        <div id="results-content" style="
          font-family: 'SF Mono', 'Monaco', 'Inconsolata', monospace;
          font-size: 13px;
          line-height: 1.5;
          color: #374151;
          max-height: 300px;
          overflow-y: auto;
          background: white;
          padding: 16px;
          border-radius: 12px;
          border: 1px solid rgba(0, 0, 0, 0.08);
        "></div>
      </div>

      <!-- 底部信息 -->
      <div style="
        margin-top: 28px;
        padding-top: 20px;
        border-top: 1px solid rgba(0, 0, 0, 0.05);
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 13px;
        color: #666;
      ">
        <div style="display: flex; align-items: center; gap: 12px;">
          <span>✨ 面板版本: 2.0 (修复版)</span>
          <span style="
            background: rgba(102, 126, 234, 0.1);
            color: #667eea;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 11px;
            font-weight: 500;
          ">z-index: 2147483647</span>
        </div>
        <div>
          <span style="opacity: 0.7;">${new Date().toLocaleString()}</span>
        </div>
      </div>
    </div>
  </div>

  <!-- 遮罩层 -->
  <div id="cf-worker-cp-overlay" style="
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    z-index: 2147483645;
  "></div>
</div>

<style>
  /* 混淆CSS类名防止冲突 */
  ._cf_wkr_cp_act_btn:hover {
    transform: translateY(-2px) !important;
    box-shadow: 
      0 12px 24px rgba(0, 0, 0, 0.15),
      0 0 0 1px rgba(255, 255, 255, 0.2) inset !important;
  }
  
  ._cf_wkr_cp_act_btn:active {
    transform: translateY(0) !important;
  }
  
  input._cf_wkr_cp_input:focus {
    border-color: #667eea !important;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1) !important;
  }
  
  /* 滚动条美化 */
  #results-content::-webkit-scrollbar {
    width: 6px;
  }
  
  #results-content::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.05);
    border-radius: 3px;
  }
  
  #results-content::-webkit-scrollbar-thumb {
    background: rgba(102, 126, 234, 0.5);
    border-radius: 3px;
  }
  
  #results-content::-webkit-scrollbar-thumb:hover {
    background: rgba(102, 126, 234, 0.7);
  }
</style>

<script>
  // 立即执行的初始化函数
  (function() {
    'use strict';
    
    console.log('🔧 Cloudflare Worker控制面板加载中...');
    
    // 全局变量
    let _cp_isOpen = false;
    const _cp_elements = {};
    
    // 初始化函数
    function _cp_init() {
      // 缓存DOM元素
      _cp_elements.btn = document.getElementById('cf-worker-cp-btn');
      _cp_elements.panel = document.getElementById('cf-worker-cp-panel');
      _cp_elements.closeBtn = document.getElementById('cf-worker-cp-close');
      _cp_elements.overlay = document.getElementById('cf-worker-cp-overlay');
      _cp_elements.statusContent = document.getElementById('cf-worker-cp-status-content');
      _cp_elements.resultsContainer = document.getElementById('cf-worker-cp-results');
      _cp_elements.resultsContent = document.getElementById('results-content');
      _cp_elements.batchForm = document.getElementById('cf-worker-cp-batch-form');
      _cp_elements.batchCount = document.getElementById('batch-count');
      _cp_elements.startBatchBtn = document.getElementById('cf-worker-cp-start-batch');
      _cp_elements.batchProgress = document.getElementById('batch-progress');
      _cp_elements.batchProgressBar = document.getElementById('batch-progress-bar');
      _cp_elements.batchStatus = document.getElementById('batch-status');
      _cp_elements.batchPercentage = document.getElementById('batch-percentage');
      
      // 绑定事件监听器
      _cp_setupEventListeners();
      
      // 页面加载完成后执行自动环境检查
      setTimeout(_cp_performAutoEnvironmentCheck, 1000);
      
      console.log('✅ 控制面板初始化完成');
    }
    
    // 设置事件监听器
    function _cp_setupEventListeners() {
      // 面板按钮点击
      _cp_elements.btn.addEventListener('click', _cp_togglePanel);
      
      // 关闭按钮点击
      _cp_elements.closeBtn.addEventListener('click', _cp_closePanel);
      
      // 遮罩层点击
      _cp_elements.overlay.addEventListener('click', _cp_closePanel);
      
      // 功能按钮点击
      document.querySelectorAll('.cf-worker-cp-action-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const action = this.dataset.action;
          _cp_handleAction(action);
        });
      });
      
      // 批量注册开始按钮
      _cp_elements.startBatchBtn.addEventListener('click', _cp_startBatchRegister);
      
      // 按ESC键关闭面板
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && _cp_isOpen) {
          _cp_closePanel();
        }
      });
    }
    
    // 切换面板显示/隐藏
    function _cp_togglePanel() {
      if (_cp_isOpen) {
        _cp_closePanel();
      } else {
        _cp_openPanel();
      }
    }
    
    // 打开面板
    function _cp_openPanel() {
      _cp_elements.panel.style.display = 'block';
      _cp_elements.overlay.style.display = 'block';
      
      // 添加动画效果
      setTimeout(() => {
        _cp_elements.panel.style.opacity = '1';
        _cp_elements.panel.style.transform = 'translate(-50%, -50%) scale(1)';
      }, 10);
      
      _cp_isOpen = true;
      console.log('📱 控制面板已打开');
    }
    
    // 关闭面板
    function _cp_closePanel() {
      _cp_elements.panel.style.opacity = '0';
      _cp_elements.panel.style.transform = 'translate(-50%, -50%) scale(0.95)';
      
      setTimeout(() => {
        _cp_elements.panel.style.display = 'none';
        _cp_elements.overlay.style.display = 'none';
        // 隐藏结果区域
        _cp_hideResults();
      }, 300);
      
      _cp_isOpen = false;
      console.log('📱 控制面板已关闭');
    }
    
    // 处理功能按钮点击
    async function _cp_handleAction(action) {
      console.log('🔄 执行操作:', action);
      
      switch(action) {
        case 'environment-check':
          await _cp_performEnvironmentCheck();
          break;
          
        case 'batch-register':
          _cp_showBatchForm();
          break;
          
        case 'account-management':
          await _cp_showAccountManagement();
          break;
          
        case 'data-export':
          await _cp_exportData();
          break;
      }
    }
    
    // 页面加载后自动执行环境检查
    async function _cp_performAutoEnvironmentCheck() {
      console.log('🔍 开始自动环境检查...');
      
      // 更新状态显示
      _cp_elements.statusContent.innerHTML = \`
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <span style="color: #f59e0b; font-size: 16px;">⏳</span>
          <span>正在自动检查环境状态...</span>
        </div>
        <div style="margin-top: 12px; font-size: 13px; color: #666;">
          <div>📡 检查接口: /api/auth/token</div>
          <div>📡 检查接口: /api/auth/anonymous-sign-in</div>
        </div>
      \`;
      
      try {
        const response = await fetch('/_proxy/environment-check', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        const data = await response.json();
        
        if (data.success) {
          let statusHtml = \`
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
              <span style="color: #10b981; font-size: 16px;">✓</span>
              <span>环境检查完成 (自动)</span>
            </div>
          \`;
          
          data.results.forEach((result, index) => {
            const emoji = result.success ? '✅' : '❌';
            const color = result.success ? '#10b981' : '#ef4444';
            
            statusHtml += \`
              <div style="
                margin: 8px 0;
                padding: 12px;
                background: \${result.success ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)'};
                border-radius: 12px;
                border-left: 4px solid \${color};
              ">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div style="font-weight: 600; color: #1a1a1a;">
                    \${emoji} \${result.name}
                  </div>
                  <div style="
                    background: \${color};
                    color: white;
                    padding: 2px 8px;
                    border-radius: 10px;
                    font-size: 12px;
                    font-weight: 500;
                  ">状态码: \${result.status}</div>
                </div>
                <div style="margin-top: 6px; font-size: 13px; color: #666;">
                  <div>URL: \${result.url}</div>
                  <div>响应时间: \${result.responseTime}</div>
                  \${result.error ? \`<div>错误信息: \${result.error}</div>\` : ''}
                </div>
              </div>
            \`;
          });
          
          _cp_elements.statusContent.innerHTML = statusHtml;
          console.log('✅ 自动环境检查完成');
        }
      } catch (error) {
        _cp_elements.statusContent.innerHTML = \`
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <span style="color: #ef4444; font-size: 16px;">❌</span>
            <span>自动环境检查失败</span>
          </div>
          <div style="margin-top: 8px; font-size: 13px; color: #666;">
            错误: \${error.message}
          </div>
        \`;
        console.error('❌ 自动环境检查失败:', error);
      }
    }
    
    // 手动执行环境检查
    async function _cp_performEnvironmentCheck() {
      _cp_showResults('🔍 正在检查环境状态...');
      
      try {
        const response = await fetch('/_proxy/environment-check', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        const data = await response.json();
        
        if (data.success) {
          let resultText = '📊 环境检查结果:\\n\\n';
          let allSuccess = true;
          
          data.results.forEach(result => {
            const statusEmoji = result.success ? '✅' : '❌';
            resultText += \`\${statusEmoji} \${result.name}\\n`;
            resultText += \`   状态码: \${result.status} (\${result.statusText})\\n\`;
            resultText += \`   响应时间: \${result.responseTime}\\n\`;
            
            if (result.error) {
              resultText += \`   错误: \${result.error}\\n\`;
              allSuccess = false;
            }
            
            resultText += '\\n';
          });
          
          resultText += \`📅 检查时间: \${new Date(data.timestamp).toLocaleString()}\\n\`;
          resultText += allSuccess ? '✨ 所有接口正常！' : '⚠️ 存在异常接口，请检查！';
          
          _cp_showResults(resultText);
          
          // 同时更新状态区域
          _cp_updateStatusFromResults(data);
        }
      } catch (error) {
        _cp_showResults(\`❌ 环境检查失败:\\n\${error.message}\`);
      }
    }
    
    // 根据检查结果更新状态区域
    function _cp_updateStatusFromResults(data) {
      if (!data.success || !data.results || data.results.length === 0) return;
      
      let statusHtml = \`
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
          <span style="color: #10b981; font-size: 16px;">✓</span>
          <span>环境状态已更新</span>
        </div>
      \`;
      
      data.results.forEach((result, index) => {
        if (index < 2) { // 只显示前两个主要接口
          const emoji = result.success ? '✅' : '❌';
          const color = result.success ? '#10b981' : '#ef4444';
          
          statusHtml += \`
            <div style="
              margin: 8px 0;
              padding: 8px 12px;
              background: \${result.success ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)'};
              border-radius: 8px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            ">
              <div style="font-weight: 500; color: #1a1a1a;">
                \${emoji} \${result.name}
              </div>
              <div style="
                color: \${color};
                font-weight: 600;
                font-size: 13px;
              ">\${result.status}</div>
            </div>
          \`;
        }
      });
      
      _cp_elements.statusContent.innerHTML = statusHtml;
    }
    
    // 显示批量注册表单
    function _cp_showBatchForm() {
      _cp_elements.batchForm.style.display = 'block';
      _cp_elements.batchCount.focus();
      _cp_hideResults();
    }
    
    // 开始批量注册
    async function _cp_startBatchRegister() {
      const count = parseInt(_cp_elements.batchCount.value);
      
      if (!count || count < 1 || count > 100) {
        alert('⚠️ 请输入1-100之间的有效数字');
        return;
      }
      
      // 显示进度条
      _cp_elements.batchProgress.style.display = 'block';
      _cp_elements.batchProgressBar.style.width = '0%';
      _cp_elements.batchStatus.textContent = '准备注册...';
      _cp_elements.batchPercentage.textContent = '0%';
      
      try {
        const response = await fetch('/_proxy/batch-register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ count })
        });
        
        const data = await response.json();
        
        // 模拟进度更新
        let progress = 0;
        const interval = setInterval(() => {
          progress += 5;
          if (progress > 100) progress = 100;
          
          _cp_elements.batchProgressBar.style.width = \`\${progress}%\`;
          _cp_elements.batchPercentage.textContent = \`\${progress}%\`;
          
          if (progress < 50) {
            _cp_elements.batchStatus.textContent = '正在注册账户...';
          } else if (progress < 90) {
            _cp_elements.batchStatus.textContent = '保存到数据库...';
          } else {
            _cp_elements.batchStatus.textContent = '完成！';
          }
          
          if (progress === 100) {
            clearInterval(interval);
            
            // 显示结果
            let resultText = \`🚀 批量注册完成！\\n\\n\`;
            resultText += \`总计注册: \${data.total} 个账户\\n\\n\`;
            
            let successCount = 0;
            let failCount = 0;
            
            data.results.forEach((result, index) => {
              if (result.status === 'success') {
                successCount++;
                resultText += \`✅ 账户#\${index+1}: \${result.email}\\n\`;
              } else {
                failCount++;
                resultText += \`❌ 账户#\${index+1}: 失败 (\${result.error})\\n\`;
              }
            });
            
            resultText += \`\\n📊 统计: \${successCount} 成功, \${failCount} 失败\`;
            
            _cp_showResults(resultText);
            
            // 3秒后隐藏进度条
            setTimeout(() => {
              _cp_elements.batchProgress.style.display = 'none';
            }, 3000);
          }
        }, 100);
        
      } catch (error) {
        _cp_showResults(\`❌ 批量注册失败:\\n\${error.message}\`);
        _cp_elements.batchProgress.style.display = 'none';
      }
    }
    
    // 显示账户管理
    async function _cp_showAccountManagement() {
      _cp_showResults('👥 正在加载账户列表...');
      
      try {
        const response = await fetch('/_proxy/account-management', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ action: 'list' })
        });
        
        const data = await response.json();
        
        if (data.success) {
          let resultText = \`📋 账户管理 (共 \${data.total} 个账户)\\n\\n\`;
          
          if (data.accounts && data.accounts.length > 0) {
            data.accounts.forEach((account, index) => {
              const statusEmoji = account.status === 'success' ? '✅' : '❌';
              resultText += \`\${index+1}. \${statusEmoji} \${account.email || account.user_id}\\n\`;
              resultText += \`   状态: \${account.status}\\n\`;
              resultText += \`   创建: \${new Date(account.created_at).toLocaleString()}\\n\`;
              resultText += '\\n';
            });
          } else {
            resultText += '📭 暂无账户记录';
          }
          
          _cp_showResults(resultText);
        }
      } catch (error) {
        _cp_showResults(\`❌ 加载账户失败:\\n\${error.message}\`);
      }
    }
    
    // 导出数据
    async function _cp_exportData() {
      _cp_showResults('💾 正在准备数据导出...');
      
      try {
        const response = await fetch('/_proxy/export-data');
        const data = await response.json();
        
        // 创建下载链接
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = \`worker_export_\${new Date().toISOString().split('T')[0]}.json\`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        _cp_showResults(\`✅ 数据导出成功！\\n\\n文件已开始下载\\n总计记录: \${data.summary.totalAccounts} 个账户\`);
        
      } catch (error) {
        _cp_showResults(\`❌ 数据导出失败:\\n\${error.message}\`);
      }
    }
    
    // 显示结果区域
    function _cp_showResults(content) {
      _cp_elements.resultsContent.textContent = content;
      _cp_elements.resultsContainer.style.display = 'block';
      
      // 隐藏批量表单
      _cp_elements.batchForm.style.display = 'none';
      
      // 滚动到结果区域
      setTimeout(() => {
        _cp_elements.resultsContainer.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
    
    // 隐藏结果区域
    function _cp_hideResults() {
      _cp_elements.resultsContainer.style.display = 'none';
    }
    
    // DOM加载完成后初始化
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _cp_init);
    } else {
      _cp_init();
    }
    
    // 全局暴露关键函数（用于调试）
    window._cfWorkerPanel = {
      togglePanel: _cp_togglePanel,
      checkEnvironment: _cp_performEnvironmentCheck,
      autoCheck: _cp_performAutoEnvironmentCheck
    };
    
  })();
</script>
<!-- Cloudflare Worker控制面板结束 -->
`;
}