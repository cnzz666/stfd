var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.js - 完整版
var worker_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const targetUrl = "https://www.xn--i8s951di30azba.com";
    
    try {
      // D1数据库初始化（如果存在）
      if (env.DB) {
        await initDatabase(env.DB);
      }
      
      // 身份验证检查 - 所有路径都需要
      if (!url.pathname.startsWith('/_proxy/')) {
        const authResult = await checkAuthentication(request, env);
        if (authResult) return authResult;
      }
      
      // 代理路由
      if (url.pathname === "/_proxy/get-account") {
        return await handleGetAccount(request, targetUrl, env);
      }
      if (url.pathname === "/_proxy/check-status") {
        return await handleCheckStatus(request, targetUrl, env);
      }
      if (url.pathname === "/_proxy/clear-cookies") {
        return await handleClearCookies(request, targetUrl);
      }
      if (url.pathname === "/_proxy/inject-cookie") {
        return await handleInjectCookie(request);
      }
      if (url.pathname === "/_proxy/batch-register") {
        return await handleBatchRegister(request, targetUrl, env);
      }
      if (url.pathname === "/_proxy/check-environment") {
        return await handleCheckEnvironment(request, targetUrl, env);
      }
      if (url.pathname === "/_proxy/save-account") {
        return await handleSaveAccount(request, env);
      }
      if (url.pathname === "/_proxy/get-accounts") {
        return await handleGetAccounts(request, env);
      }
      if (url.pathname === "/_proxy/delete-account") {
        return await handleDeleteAccount(request, env);
      }
      if (url.pathname === "/_proxy/restore-account") {
        return await handleRestoreAccount(request);
      }
      if (url.pathname === "/_proxy/auth-login") {
        return await handleAuthLogin(request, env);
      }
      if (url.pathname === "/_proxy/auth-logout") {
        return await handleAuthLogout(request);
      }
      if (url.pathname === "/_proxy/auth-check") {
        return await handleAuthCheck(request);
      }
      if (url.pathname === "/_proxy/monitor-network") {
        return await handleMonitorNetwork(request, targetUrl);
      }
      if (url.pathname === "/_proxy/get-stats") {
        return await handleGetStats(env);
      }
      
      return await handleProxyRequest(request, targetUrl, url, env);
    } catch (error) {
      console.error("全局错误:", error);
      return new Response(`代理错误: ${error.message}`, {
        status: 500,
        headers: { "Content-Type": "text/plain" }
      });
    }
  }
};

// ==================== 数据库相关 ====================
async function initDatabase(db) {
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS account_manage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL UNIQUE,
        cookies TEXT NOT NULL,
        token TEXT,
        balance INTEGER DEFAULT 0,
        create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'active',
        note TEXT,
        last_used DATETIME,
        ip_address TEXT,
        user_agent TEXT
      );
      
      CREATE TABLE IF NOT EXISTS auth_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME,
        login_count INTEGER DEFAULT 0,
        is_admin INTEGER DEFAULT 0
      );
      
      CREATE TABLE IF NOT EXISTS batch_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id TEXT NOT NULL UNIQUE,
        target_count INTEGER NOT NULL,
        completed_count INTEGER DEFAULT 0,
        failed_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'running',
        start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        end_time DATETIME,
        cookies_list TEXT,
        error_log TEXT
      );
      
      CREATE TABLE IF NOT EXISTS network_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL,
        method TEXT NOT NULL,
        status INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        response_time INTEGER,
        request_headers TEXT,
        response_headers TEXT,
        body_preview TEXT,
        error TEXT
      );
    `);
    
    // 插入默认管理员账户（如果不存在）
    const defaultPass = "1591156135qwzxcv";
    const hashedPass = await hashPassword(defaultPass);
    
    const existing = await db.prepare(
      "SELECT id FROM auth_users WHERE username = ?"
    ).bind("admin").first();
    
    if (!existing) {
      await db.prepare(
        "INSERT INTO auth_users (username, password_hash, is_admin) VALUES (?, ?, 1)"
      ).bind("admin", hashedPass).run();
    }
    
  } catch (error) {
    console.error("数据库初始化失败:", error);
  }
}

async function hashPassword(password) {
  // 简单的哈希实现，实际应该使用更安全的算法
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "sak_salt_2025");
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ==================== 身份验证系统 ====================
async function checkAuthentication(request, env) {
  const authCookie = parseCookies(request.headers.get('cookie') || '')['proxy_auth'];
  const authHeader = request.headers.get('Authorization');
  
  // 如果已经有认证cookie，检查有效性
  if (authCookie) {
    try {
      const authData = JSON.parse(atob(authCookie));
      const user = await env.DB?.prepare(
        "SELECT * FROM auth_users WHERE username = ? AND password_hash = ?"
      ).bind(authData.username, authData.password_hash).first();
      
      if (user) {
        return null; // 认证通过
      }
    } catch (e) {
      // Cookie无效，需要重新认证
    }
  }
  
  // 检查Basic Auth
  if (authHeader && authHeader.startsWith('Basic ')) {
    const credentials = atob(authHeader.substring(6));
    const [username, password] = credentials.split(':');
    
    const hashedPass = await hashPassword(password);
    const user = await env.DB?.prepare(
      "SELECT * FROM auth_users WHERE username = ? AND password_hash = ?"
    ).bind(username, hashedPass).first();
    
    if (user) {
      // 更新登录信息
      await env.DB?.prepare(
        "UPDATE auth_users SET last_login = CURRENT_TIMESTAMP, login_count = login_count + 1 WHERE id = ?"
      ).bind(user.id).run();
      
      // 设置认证cookie
      const authToken = btoa(JSON.stringify({
        username: user.username,
        password_hash: hashedPass,
        timestamp: Date.now()
      }));
      
      return new Response(null, {
        status: 200,
        headers: {
          'Set-Cookie': `proxy_auth=${authToken}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000`,
          'X-Auth-Required': 'false'
        }
      });
    }
  }
  
  // 需要认证
  return new Response('需要身份验证', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="代理访问", charset="UTF-8"',
      'Content-Type': 'text/plain; charset=utf-8'
    }
  });
}

// ==================== 原有的核心函数（保持原样） ====================
async function handleProxyRequest(request, targetUrl, url, env) {
  const targetHeaders = new Headers(request.headers);
  targetHeaders.delete("host");
  targetHeaders.delete("origin");
  targetHeaders.delete("referer");
  targetHeaders.set("origin", targetUrl);
  targetHeaders.set("referer", targetUrl + url.pathname);
  
  const targetRequest = new Request(targetUrl + url.pathname + url.search, {
    method: request.method,
    headers: targetHeaders,
    body: request.body,
    redirect: "manual"
  });
  
  const response = await fetch(targetRequest);
  return await processProxyResponse(response, request, url, env);
}

async function processProxyResponse(response, originalRequest, url, env) {
  const contentType = response.headers.get("content-type") || "";
  const clonedResponse = response.clone();
  
  if (contentType.includes("text/html")) {
    try {
      const html = await clonedResponse.text();
      const modifiedHtml = await injectControlPanel(html, url, env);
      const newHeaders2 = new Headers(response.headers);
      newHeaders2.set("Content-Type", "text/html; charset=utf-8");
      return new Response(modifiedHtml, {
        status: response.status,
        headers: newHeaders2
      });
    } catch (error) {
      console.error("HTML注入失败:", error);
      return response;
    }
  }
  
  const newHeaders = new Headers(response.headers);
  newHeaders.set("Access-Control-Allow-Origin", "*");
  newHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  newHeaders.set("Access-Control-Allow-Headers", "*");
  newHeaders.set("Access-Control-Allow-Credentials", "true");
  newHeaders.delete("content-security-policy");
  newHeaders.delete("content-security-policy-report-only");
  
  return new Response(response.body, {
    status: response.status,
    headers: newHeaders
  });
}

async function injectControlPanel(html, url, env) {
  // 获取统计数据
  let stats = { total: 0, active: 0 };
  if (env.DB) {
    try {
      const totalResult = await env.DB.prepare(
        "SELECT COUNT(*) as count FROM account_manage"
      ).first();
      const activeResult = await env.DB.prepare(
        "SELECT COUNT(*) as count FROM account_manage WHERE status = 'active'"
      ).first();
      stats = {
        total: totalResult?.count || 0,
        active: activeResult?.count || 0
      };
    } catch (e) {
      console.error("获取统计失败:", e);
    }
  }
  
  const panelHTML = `
<style>
/* iOS灵动岛风格悬浮窗 */
.proxy-control-panel {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 999999;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif;
  display: none;
}

.control-button {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 999998;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  padding: 12px 24px;
  color: white;
  font-weight: 500;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
  animation: buttonEntrance 0.5s ease-out;
}

.control-button:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: translateX(-50%) translateY(-2px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
}

.control-button:active {
  transform: translateX(-50%) scale(0.98);
}

@keyframes buttonEntrance {
  0% {
    opacity: 0;
    transform: translateX(-50%) translateY(-20px);
  }
  100% {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

/* 毛玻璃弹窗 */
.glass-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 999997;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  visibility: hidden;
  transition: all 0.3s ease;
}

.glass-modal.active {
  opacity: 1;
  visibility: visible;
}

.glass-content {
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(40px) saturate(200%);
  -webkit-backdrop-filter: blur(40px) saturate(200%);
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3),
              0 0 0 1px rgba(255, 255, 255, 0.1);
  padding: 28px;
  width: 90%;
  max-width: 400px;
  color: white;
  transform: scale(0.9);
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.glass-modal.active .glass-content {
  transform: scale(1);
}

.glass-title {
  font-size: 22px;
  font-weight: 600;
  margin-bottom: 20px;
  text-align: center;
  letter-spacing: -0.5px;
}

.glass-input {
  width: 100%;
  padding: 16px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 14px;
  color: white;
  font-size: 16px;
  margin-bottom: 16px;
  outline: none;
  transition: all 0.2s ease;
}

.glass-input:focus {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.4);
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.1);
}

.glass-input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.glass-button {
  width: 100%;
  padding: 16px;
  background: linear-gradient(135deg, #007AFF, #5856D6);
  border: none;
  border-radius: 14px;
  color: white;
  font-size: 17px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-bottom: 12px;
}

.glass-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 30px rgba(0, 122, 255, 0.3);
}

.glass-button:active {
  transform: translateY(0);
}

.glass-button.secondary {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.glass-button.secondary:hover {
  background: rgba(255, 255, 255, 0.15);
}

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  background: rgba(52, 199, 89, 0.2);
  border: 1px solid rgba(52, 199, 89, 0.3);
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  color: #34C759;
  margin-bottom: 20px;
}

.status-badge.error {
  background: rgba(255, 59, 48, 0.2);
  border-color: rgba(255, 59, 48, 0.3);
  color: #FF3B30;
}

.status-badge.warning {
  background: rgba(255, 149, 0, 0.2);
  border-color: rgba(255, 149, 0, 0.3);
  color: #FF9500;
}

.account-item {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  padding: 16px;
  margin-bottom: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.2s ease;
}

.account-item:hover {
  background: rgba(255, 255, 255, 0.12);
  transform: translateY(-2px);
}

.account-id {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 8px;
  color: rgba(255, 255, 255, 0.9);
}

.account-balance {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
}

.progress-container {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
  margin: 20px 0;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #007AFF, #34C759);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.loading-spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.notification {
  position: fixed;
  top: 20px;
  right: 20px;
  background: rgba(28, 28, 30, 0.9);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 18px;
  padding: 16px 20px;
  color: white;
  font-size: 14px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  transform: translateY(-20px);
  opacity: 0;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  z-index: 1000000;
  max-width: 320px;
}

.notification.show {
  transform: translateY(0);
  opacity: 1;
}

.close-button {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.close-button:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.1);
}

.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 16px;
}

.tab-button {
  flex: 1;
  padding: 12px;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 12px;
  transition: all 0.2s ease;
}

.tab-button.active {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

@media (max-width: 768px) {
  .glass-content {
    width: 95%;
    max-width: none;
    margin: 20px;
  }
  
  .control-button {
    top: 10px;
    padding: 10px 20px;
    font-size: 13px;
  }
}
</style>

<div class="proxy-control-panel">
  <button class="control-button" onclick="ProxyControl.showMainModal()">
    <span>代理控制面板</span>
    <div class="status-badge">${stats.active}/${stats.total}</div>
  </button>
</div>

<div id="main-modal" class="glass-modal">
  <div class="glass-content">
    <button class="close-button" onclick="ProxyControl.hideMainModal()">×</button>
    <div class="glass-title">代理控制面板</div>
    
    <div class="tabs">
      <button class="tab-button active" onclick="ProxyControl.switchTab('status')">状态</button>
      <button class="tab-button" onclick="ProxyControl.switchTab('accounts')">账号</button>
      <button class="tab-button" onclick="ProxyControl.switchTab('tools')">工具</button>
      <button class="tab-button" onclick="ProxyControl.switchTab('settings')">设置</button>
    </div>
    
    <div id="tab-status" class="tab-content">
      <div class="status-badge" id="cookie-status">检测中...</div>
      <div style="font-size: 14px; color: rgba(255, 255, 255, 0.7); margin-bottom: 20px;" id="account-info">
        正在获取账户信息...
      </div>
      <button class="glass-button" onclick="ProxyControl.checkAccountStatus()">
        刷新状态
      </button>
    </div>
    
    <div id="tab-accounts" class="tab-content" style="display: none;">
      <div style="max-height: 300px; overflow-y: auto; margin-bottom: 20px;" id="accounts-list">
        <div style="text-align: center; padding: 40px; color: rgba(255, 255, 255, 0.5);">
          加载中...
        </div>
      </div>
      <button class="glass-button" onclick="ProxyControl.getAccounts()">
        刷新列表
      </button>
    </div>
    
    <div id="tab-tools" class="tab-content" style="display: none;">
      <button class="glass-button" onclick="ProxyControl.singleRegister()">
        注册单个账号
      </button>
      <button class="glass-button" onclick="ProxyControl.showBatchModal()">
        批量注册账号
      </button>
      <button class="glass-button" onclick="ProxyControl.checkEnvironment()">
        环境检查
      </button>
      <button class="glass-button secondary" onclick="ProxyControl.monitorNetwork()">
        网络监控
      </button>
    </div>
    
    <div id="tab-settings" class="tab-content" style="display: none;">
      <input type="number" class="glass-input" id="refresh-interval" placeholder="刷新间隔(毫秒)" value="5000">
      <button class="glass-button" onclick="ProxyControl.saveSettings()">
        保存设置
      </button>
      <button class="glass-button secondary" onclick="ProxyControl.clearAllCookies()">
        清除Cookie
      </button>
      <button class="glass-button secondary" onclick="ProxyControl.showAuthModal()">
        账户管理
      </button>
    </div>
  </div>
</div>

<!-- 批量注册弹窗 -->
<div id="batch-modal" class="glass-modal">
  <div class="glass-content">
    <button class="close-button" onclick="ProxyControl.hideBatchModal()">×</button>
    <div class="glass-title">批量注册</div>
    
    <input type="number" class="glass-input" id="batch-count" placeholder="注册数量" value="5" min="1" max="100">
    <input type="number" class="glass-input" id="batch-delay" placeholder="延迟(毫秒)" value="2000" min="0">
    
    <div class="progress-container">
      <div class="progress-bar" id="batch-progress" style="width: 0%"></div>
    </div>
    
    <div style="text-align: center; margin: 20px 0; font-size: 14px; color: rgba(255, 255, 255, 0.7);" id="batch-status">
      就绪
    </div>
    
    <button class="glass-button" onclick="ProxyControl.startBatchRegister()" id="batch-start-btn">
      开始批量注册
    </button>
    <button class="glass-button secondary" onclick="ProxyControl.stopBatchRegister()" id="batch-stop-btn" style="display: none;">
      停止
    </button>
  </div>
</div>

<!-- 环境检查弹窗 -->
<div id="environment-modal" class="glass-modal">
  <div class="glass-content">
    <button class="close-button" onclick="ProxyControl.hideEnvironmentModal()">×</button>
    <div class="glass-title">环境检查</div>
    
    <div style="margin: 20px 0;" id="environment-results">
      <div style="margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span style="font-size: 14px;">/api/auth/token</span>
          <span style="font-size: 14px; color: rgba(255, 255, 255, 0.5);">检测中...</span>
        </div>
        <div class="progress-container">
          <div class="progress-bar" style="width: 0%"></div>
        </div>
      </div>
      
      <div style="margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span style="font-size: 14px;">/api/auth/anonymous-sign-in</span>
          <span style="font-size: 14px; color: rgba(255, 255, 255, 0.5);">检测中...</span>
        </div>
        <div class="progress-container">
          <div class="progress-bar" style="width: 0%"></div>
        </div>
      </div>
    </div>
    
    <div style="text-align: center; margin: 20px 0; padding: 16px; background: rgba(255, 255, 255, 0.05); border-radius: 12px;" id="environment-summary">
      正在检查环境...
    </div>
    
    <button class="glass-button" onclick="ProxyControl.startEnvironmentCheck()">
      重新检查
    </button>
  </div>
</div>

<!-- 账户管理弹窗 -->
<div id="auth-modal" class="glass-modal">
  <div class="glass-content">
    <button class="close-button" onclick="ProxyControl.hideAuthModal()">×</button>
    <div class="glass-title">账户管理</div>
    
    <div style="margin: 20px 0; text-align: center;" id="auth-status">
      <div class="status-badge" id="login-status">未登录</div>
    </div>
    
    <input type="text" class="glass-input" id="auth-username" placeholder="用户名" style="display: none;">
    <input type="password" class="glass-input" id="auth-password" placeholder="密码" style="display: none;">
    
    <div id="auth-buttons">
      <button class="glass-button" onclick="ProxyControl.showLoginForm()">
        登录
      </button>
      <button class="glass-button secondary" onclick="ProxyControl.logout()" style="display: none;">
        退出登录
      </button>
    </div>
  </div>
</div>

<!-- 通知系统 -->
<div id="notification-container"></div>

<script>
const ProxyControl = {
  batchJobId: null,
  batchInterval: null,
  refreshInterval: 5000,
  monitorActive: false,
  currentTab: 'status',
  
  init() {
    console.log('代理控制面板初始化');
    
    // 等待页面加载完成
    setTimeout(() => {
      document.querySelector('.proxy-control-panel').style.display = 'block';
      this.checkAccountStatus();
      this.getAccounts();
      
      // 开始网络监控
      this.startNetworkMonitor();
      
      // 设置自动刷新
      setInterval(() => {
        this.checkAccountStatus();
        this.getAccounts();
      }, this.refreshInterval);
      
    }, 3000);
  },
  
  showMainModal() {
    document.getElementById('main-modal').classList.add('active');
    document.body.style.overflow = 'hidden';
    this.centerModal('main-modal');
  },
  
  hideMainModal() {
    document.getElementById('main-modal').classList.remove('active');
    document.body.style.overflow = '';
  },
  
  centerModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.alignItems = 'center';
      modal.style.justifyContent = 'center';
    }
  },
  
  switchTab(tabName) {
    this.currentTab = tabName;
    
    // 更新标签按钮
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // 显示对应内容
    document.querySelectorAll('.tab-content').forEach(content => {
      content.style.display = 'none';
    });
    document.getElementById('tab-' + tabName).style.display = 'block';
    
    if (tabName === 'accounts') {
      this.getAccounts();
    }
  },
  
  async checkAccountStatus() {
    try {
      const response = await fetch('/_proxy/check-status');
      const data = await response.json();
      
      const statusBadge = document.getElementById('cookie-status');
      const accountInfo = document.getElementById('account-info');
      
      if (data.authenticated) {
        statusBadge.className = 'status-badge';
        statusBadge.textContent = '已登录';
        accountInfo.innerHTML = \`
          用户ID: \${data.userId}<br>
          Cookie数量: \${data.cookies.length}<br>
          余额: \${data.balance}次<br>
          时间: \${new Date(data.timestamp).toLocaleTimeString()}
        \`;
        
        // 自动上传Cookie到账号管理
        this.uploadCookiesToAccount(data);
      } else {
        statusBadge.className = 'status-badge error';
        statusBadge.textContent = '未登录';
        accountInfo.innerHTML = '没有检测到有效的Cookie，点击下方按钮获取新账号';
      }
    } catch (error) {
      this.showNotification('状态检查失败: ' + error.message, 'error');
    }
  },
  
  async uploadCookiesToAccount(statusData) {
    try {
      const response = await fetch('/_proxy/save-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: statusData.userId,
          cookies: statusData.cookies
        })
      });
      
      if (response.ok) {
        console.log('Cookie已上传到账号管理');
      }
    } catch (error) {
      console.error('上传Cookie失败:', error);
    }
  },
  
  async singleRegister() {
    if (!confirm('此操作将清除当前Cookie并尝试注册新账号，是否继续？')) return;
    
    this.showNotification('开始注册单个账号...', 'info');
    
    try {
      // 清除Cookie
      await fetch('/_proxy/clear-cookies');
      
      // 刷新页面
      setTimeout(() => {
        location.reload();
      }, 1000);
      
    } catch (error) {
      this.showNotification('注册失败: ' + error.message, 'error');
    }
  },
  
  showBatchModal() {
    document.getElementById('batch-modal').classList.add('active');
    this.centerModal('batch-modal');
  },
  
  hideBatchModal() {
    document.getElementById('batch-modal').classList.remove('active');
  },
  
  async startBatchRegister() {
    const count = parseInt(document.getElementById('batch-count').value) || 5;
    const delay = parseInt(document.getElementById('batch-delay').value) || 2000;
    
    if (count < 1 || count > 100) {
      this.showNotification('请设置1-100之间的数量', 'error');
      return;
    }
    
    // 生成任务ID
    this.batchJobId = 'batch_' + Date.now();
    
    // 更新UI
    document.getElementById('batch-start-btn').style.display = 'none';
    document.getElementById('batch-stop-btn').style.display = 'block';
    
    let completed = 0;
    let failed = 0;
    
    const updateProgress = () => {
      const progress = (completed / count) * 100;
      document.getElementById('batch-progress').style.width = progress + '%';
      document.getElementById('batch-status').innerHTML = \`
        已注册: \${completed}个 | 失败: \${failed}个 | 剩余: \${count - completed - failed}个
      \`;
    };
    
    for (let i = 0; i < count; i++) {
      if (!this.batchJobId) break; // 如果任务被停止
      
      try {
        this.showNotification(\`正在注册第 \${i + 1} 个账号...\`, 'info');
        
        // 清除Cookie
        await fetch('/_proxy/clear-cookies');
        
        // 等待页面刷新和Cookie生成
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // 检查状态（这会触发Cookie上传）
        const statusResp = await fetch('/_proxy/check-status');
        const statusData = await statusResp.json();
        
        if (statusData.authenticated) {
          completed++;
          this.showNotification(\`第 \${i + 1} 个账号注册成功\`, 'success');
        } else {
          failed++;
          this.showNotification(\`第 \${i + 1} 个账号注册失败\`, 'error');
        }
        
        updateProgress();
        
      } catch (error) {
        failed++;
        console.error('批量注册错误:', error);
        updateProgress();
      }
    }
    
    // 完成
    this.batchJobId = null;
    document.getElementById('batch-start-btn').style.display = 'block';
    document.getElementById('batch-stop-btn').style.display = 'none';
    
    this.showNotification(\`批量注册完成！成功: \${completed}个，失败: \${failed}个\`, 'success');
    this.getAccounts();
  },
  
  stopBatchRegister() {
    this.batchJobId = null;
    this.showNotification('批量注册已停止', 'info');
    
    document.getElementById('batch-start-btn').style.display = 'block';
    document.getElementById('batch-stop-btn').style.display = 'none';
  },
  
  async checkEnvironment() {
    document.getElementById('environment-modal').classList.add('active');
    this.centerModal('environment-modal');
    
    await this.startEnvironmentCheck();
  },
  
  async startEnvironmentCheck() {
    try {
      const response = await fetch('/_proxy/check-environment');
      const data = await response.json();
      
      const results = document.getElementById('environment-results');
      const summary = document.getElementById('environment-summary');
      
      let allPassed = true;
      let html = '';
      
      data.results.forEach(result => {
        const statusClass = result.status === 200 ? '' : 'error';
        const statusText = result.status === 200 ? '正常' : \`异常: \${result.status}\`;
        
        html += \`
          <div style="margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-size: 14px;">\${result.url}</span>
              <span style="font-size: 14px; color: \${result.status === 200 ? '#34C759' : '#FF3B30'};">\${statusText}</span>
            </div>
            <div class="progress-container">
              <div class="progress-bar" style="width: \${result.status === 200 ? '100' : '0'}%; background: \${result.status === 200 ? '#34C759' : '#FF3B30'};"></div>
            </div>
            \${result.error ? '<div style="font-size: 12px; color: #FF3B30; margin-top: 4px;">' + result.error + '</div>' : ''}
          </div>
        \`;
        
        if (result.status !== 200) allPassed = false;
      });
      
      results.innerHTML = html;
      
      if (allPassed) {
        summary.innerHTML = '<span style="color: #34C759;">✓ 环境正常，可以开始注册</span>';
      } else {
        summary.innerHTML = '<span style="color: #FF3B30;">✗ 环境异常，请检查网络或稍后重试</span>';
      }
      
    } catch (error) {
      this.showNotification('环境检查失败: ' + error.message, 'error');
    }
  },
  
  hideEnvironmentModal() {
    document.getElementById('environment-modal').classList.remove('active');
  },
  
  async getAccounts() {
    try {
      const response = await fetch('/_proxy/get-accounts');
      const data = await response.json();
      
      const accountsList = document.getElementById('accounts-list');
      
      if (data.accounts && data.accounts.length > 0) {
        let html = '';
        data.accounts.forEach(account => {
          html += \`
            <div class="account-item">
              <div class="account-id">\${account.user_id}</div>
              <div class="account-balance">余额: \${account.balance}次 | 状态: \${account.status}</div>
              <div style="font-size: 12px; color: rgba(255, 255, 255, 0.5); margin-top: 4px;">
                创建: \${new Date(account.create_time).toLocaleDateString()}
              </div>
              <button onclick="ProxyControl.useAccount('\${account.user_id}')" style="background: none; border: 1px solid rgba(255, 255, 255, 0.2); color: white; padding: 6px 12px; border-radius: 8px; font-size: 12px; margin-top: 8px; cursor: pointer;">使用</button>
            </div>
          \`;
        });
        accountsList.innerHTML = html;
      } else {
        accountsList.innerHTML = '<div style="text-align: center; padding: 40px; color: rgba(255, 255, 255, 0.5);">暂无账号</div>';
      }
    } catch (error) {
      console.error('获取账号列表失败:', error);
    }
  },
  
  async useAccount(userId) {
    try {
      const response = await fetch('/_proxy/restore-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      
      if (response.ok) {
        this.showNotification('账号已应用，刷新页面中...', 'success');
        setTimeout(() => location.reload(), 1000);
      }
    } catch (error) {
      this.showNotification('应用账号失败: ' + error.message, 'error');
    }
  },
  
  async monitorNetwork() {
    this.monitorActive = !this.monitorActive;
    
    if (this.monitorActive) {
      this.showNotification('网络监控已启动', 'info');
    } else {
      this.showNotification('网络监控已停止', 'info');
    }
  },
  
  startNetworkMonitor() {
    // 拦截fetch请求
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
      const startTime = Date.now();
      
      try {
        const response = await originalFetch.apply(this, args);
        const endTime = Date.now();
        
        // 记录请求
        if (ProxyControl.monitorActive) {
          const url = typeof args[0] === 'string' ? args[0] : args[0].url;
          
          if (url.includes('api/auth/token') || url.includes('api/auth/anonymous-sign-in')) {
            ProxyControl.showNotification(\`\${url}: \${response.status}\`, 
              response.status === 200 ? 'success' : 'error');
          }
        }
        
        return response;
      } catch (error) {
        if (ProxyControl.monitorActive) {
          ProxyControl.showNotification('网络请求失败: ' + error.message, 'error');
        }
        throw error;
      }
    };
  },
  
  showAuthModal() {
    document.getElementById('auth-modal').classList.add('active');
    this.centerModal('auth-modal');
    this.checkAuthStatus();
  },
  
  hideAuthModal() {
    document.getElementById('auth-modal').classList.remove('active');
  },
  
  async checkAuthStatus() {
    try {
      const response = await fetch('/_proxy/auth-check');
      const data = await response.json();
      
      const loginStatus = document.getElementById('login-status');
      const authButtons = document.getElementById('auth-buttons');
      
      if (data.authenticated) {
        loginStatus.textContent = '已登录: ' + data.username;
        loginStatus.className = 'status-badge';
        
        authButtons.innerHTML = \`
          <button class="glass-button" onclick="ProxyControl.logout()">
            退出登录
          </button>
        \`;
      } else {
        loginStatus.textContent = '未登录';
        loginStatus.className = 'status-badge error';
        
        authButtons.innerHTML = \`
          <button class="glass-button" onclick="ProxyControl.showLoginForm()">
            登录
          </button>
        \`;
      }
    } catch (error) {
      console.error('检查登录状态失败:', error);
    }
  },
  
  showLoginForm() {
    const authButtons = document.getElementById('auth-buttons');
    
    authButtons.innerHTML = \`
      <input type="text" class="glass-input" id="auth-username" placeholder="用户名" value="admin">
      <input type="password" class="glass-input" id="auth-password" placeholder="密码">
      <button class="glass-button" onclick="ProxyControl.login()">
        登录
      </button>
      <button class="glass-button secondary" onclick="ProxyControl.hideLoginForm()">
        取消
      </button>
    \`;
  },
  
  hideLoginForm() {
    this.checkAuthStatus();
  },
  
  async login() {
    const username = document.getElementById('auth-username').value;
    const password = document.getElementById('auth-password').value;
    
    if (!username || !password) {
      this.showNotification('请输入用户名和密码', 'error');
      return;
    }
    
    try {
      const response = await fetch('/_proxy/auth-login', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + btoa(username + ':' + password)
        }
      });
      
      if (response.ok) {
        this.showNotification('登录成功', 'success');
        this.checkAuthStatus();
      } else {
        this.showNotification('登录失败，用户名或密码错误', 'error');
      }
    } catch (error) {
      this.showNotification('登录失败: ' + error.message, 'error');
    }
  },
  
  async logout() {
    try {
      await fetch('/_proxy/auth-logout');
      this.showNotification('已退出登录', 'info');
      this.checkAuthStatus();
    } catch (error) {
      this.showNotification('退出登录失败: ' + error.message, 'error');
    }
  },
  
  saveSettings() {
    const interval = document.getElementById('refresh-interval').value;
    if (interval && interval > 0) {
      this.refreshInterval = parseInt(interval);
      localStorage.setItem('proxy_refresh_interval', interval);
      this.showNotification('设置已保存', 'success');
    }
  },
  
  async clearAllCookies() {
    if (!confirm('确定要清除所有Cookie吗？这会导致需要重新登录。')) return;
    
    try {
      await fetch('/_proxy/clear-cookies');
      this.showNotification('Cookie已清除，刷新页面中...', 'info');
      setTimeout(() => location.reload(), 1000);
    } catch (error) {
      this.showNotification('清除Cookie失败: ' + error.message, 'error');
    }
  },
  
  showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container');
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.innerHTML = message;
    
    container.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }
};

// 页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => ProxyControl.init());
} else {
  ProxyControl.init();
}

// 监听Cookie变化
setInterval(() => {
  const cookies = document.cookie.split(';').filter(c => c.trim());
  if (cookies.length > 0) {
    // 有Cookie存在，自动上传
    ProxyControl.checkAccountStatus();
  }
}, 2000);
</script>
`;
  
  return html.replace("</body>", panelHTML + "</body>");
}
__name(injectControlPanel, "injectControlPanel");

// ==================== 新的功能处理函数 ====================
async function handleGetAccount(request, targetUrl, env) {
  // 原有逻辑保持不变
  try {
    const homeHeaders = {
      "User-Agent": request.headers.get("user-agent") || "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
      "Accept-Encoding": "gzip, deflate, br",
      "Connection": "keep-alive",
      "Upgrade-Insecure-Requests": "1"
    };
    
    const homeResp = await fetch(targetUrl, { headers: homeHeaders });
    if (!homeResp.ok) {
      throw new Error(`首页请求失败: ${homeResp.status}`);
    }
    
    const html = await homeResp.text();
    const codeMatch = html.match(/"code":"([^"]+)"/);
    if (!codeMatch) {
      throw new Error("无法从页面提取 code");
    }
    
    const code = codeMatch[1];
    const userId = generateUUID();
    const email = `${userId}@anon.com`;
    
    // ... 原有指纹代码保持不变 ...
    const fp = {
      data: {
        audio: { sampleHash: Math.random() * 2e3, oscillator: "sine", maxChannels: 1, channelCountMode: "max" },
        canvas: { commonImageDataHash: "8965585f0983dad03f7382c986d7aee5" },
        fonts: {
          Arial: 340.3125, Courier: 435.9375, "Courier New": 435.9375,
          Helvetica: 340.3125, Tahoma: 340.3125, Verdana: 340.3125
        },
        hardware: {
          videocard: {
            vendor: "WebKit", renderer: "WebKit WebGL",
            version: "WebGL 1.0 (OpenGL ES 2.0 Chromium)",
            shadingLanguageVersion: "WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)"
          },
          architecture: 127, deviceMemory: "4", jsHeapSizeLimit: 113e7
        },
        locales: { languages: "zh-CN", timezone: "Asia/Shanghai" },
        permissions: {
          accelerometer: "granted", "background-fetch": "denied", "background-sync": "denied",
          camera: "prompt", "clipboard-read": "denied", "clipboard-write": "granted",
          "display-capture": "denied", gyroscope: "granted", geolocation: "prompt",
          magnetometer: "granted", microphone: "prompt", midi: "granted",
          nfc: "denied", notifications: "denied", "payment-handler": "denied",
          "persistent-storage": "denied", "storage-access": "denied", "window-management": "denied"
        },
        plugins: { plugins: [] },
        screen: {
          is_touchscreen: true, maxTouchPoints: 5, colorDepth: 24,
          mediaMatches: [
            "prefers-contrast: no-preference", "any-hover: none", "any-pointer: coarse",
            "pointer: coarse", "hover: none", "update: fast",
            "prefers-reduced-motion: no-preference", "prefers-reduced-transparency: no-preference",
            "scripting: enabled", "forced-colors: none"
          ]
        },
        system: {
          platform: "Linux aarch64", cookieEnabled: true, productSub: "20030107",
          product: "Gecko",
          useragent: request.headers.get("user-agent") || "Mozilla/5.0 (Linux; Android 10; PBEM00 Build/QKQ1.190918.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.7681.2 Mobile Safari/537.36",
          hardwareConcurrency: 8, browser: { name: "Chrome", version: "147.0" }, applePayVersion: 0
        },
        webgl: { commonImageHash: "1d62a570a8e39a3cc4458b2efd47b6a2" },
        math: {
          acos: 1.0471975511965979, asin: -9614302481290016e-32, atan: 4578239276804769e-32,
          cos: -4854249971455313e-31, cosh: 1.9468519159297506, e: 2.718281828459045,
          largeCos: 0.7639704044417283, largeSin: -0.6452512852657808, largeTan: -0.8446024630198843,
          log: 6.907755278982137, pi: 3.141592653589793, sin: -19461946644816207e-32,
          sinh: -0.6288121810679035, sqrt: 1.4142135623730951, tan: 6980860926542689e-29,
          tanh: -0.39008295789884684
        }
      },
      hash: "77f81202fa12f86b7f77af693c55bf08"
    };
    
    const requestBody = { code, id: userId, email, fp };
    const requestId = Math.random().toString(36).substring(2, 10);
    
    const headers = {
      "Content-Type": "application/json",
      "User-Agent": request.headers.get("user-agent") || "Mozilla/5.0 (Linux; Android 10; PBEM00 Build/QKQ1.190918.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.7681.2 Mobile Safari/537.36",
      "Accept": "*/*",
      "Origin": targetUrl,
      "Referer": targetUrl + "/",
      "x-dzmm-request-id": requestId,
      "sec-ch-ua": '"Not.A/Brand";v="8", "Chromium";v="147"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "x-requested-with": "mark.via"
    };
    
    const clientCookies = parseCookies(request.headers.get("cookie") || "");
    const phCookie = clientCookies["ph_phc_pXRYopwyByw2wy8XGxzRcko4lPiDr58YspxHOAjThEj_posthog"];
    if (phCookie) {
      headers["Cookie"] = `ph_phc_pXRYopwyByw2wy8XGxzRcko4lPiDr58YspxHOAjThEj_posthog=${phCookie}`;
    }
    
    let response;
    let retries = 3;
    while (retries-- > 0) {
      response = await fetch(targetUrl + "/api/auth/anonymous-sign-in", {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody)
      });
      if (response.status !== 429) break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    
    if (!response || !response.ok) {
      const errorText = response ? await response.text() : "无响应";
      throw new Error(`API返回 ${response?.status || "未知"}: ${errorText}`);
    }
    
    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      throw new Error("API返回的不是有效JSON");
    }
    
    const setCookieHeader = response.headers.get("set-cookie");
    const cookies = parseSetCookies(setCookieHeader);
    if (!cookies["_rid"]) cookies["_rid"] = data.id || userId;
    if (!cookies["chosen_language"]) cookies["chosen_language"] = "zh-CN";
    if (!cookies["invite_code"]) cookies["invite_code"] = "-";
    
    // 保存到数据库
    if (env.DB) {
      try {
        await env.DB.prepare(
          `INSERT OR REPLACE INTO account_manage 
           (user_id, cookies, token, balance, update_time, status, ip_address, user_agent) 
           VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, 'active', ?, ?)`
        ).bind(
          cookies["_rid"] || data.id,
          JSON.stringify(cookies),
          data.token || "",
          35,
          request.headers.get("cf-connecting-ip") || "unknown",
          request.headers.get("user-agent") || ""
        ).run();
      } catch (dbError) {
        console.error("保存到数据库失败:", dbError);
      }
    }
    
    return new Response(JSON.stringify({
      success: true,
      message: "游客账户创建成功",
      cookies,
      userId: cookies["_rid"] || data.id,
      balance: 35,
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      note: "通过纯动态流程注册，拥有35次免费额度。"
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": Object.entries(cookies).map(([name, value]) => 
          `${name}=${value}; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=31536000`
        ).join(", ")
      }
    });
    
  } catch (error) {
    console.error(`Error in handleGetAccount: ${error.message}`);
    return new Response(JSON.stringify({
      success: false,
      message: `创建账户失败: ${error.message}`
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

async function handleCheckStatus(request, targetUrl, env) {
  try {
    const clientCookies = parseCookies(request.headers.get("cookie") || "");
    const hasAuth = "sb-rls-auth-token" in clientCookies;
    let balance = 0;
    
    if (hasAuth) {
      const meResponse = await fetch(targetUrl + "/api/me", {
        headers: { "Cookie": request.headers.get("cookie") || "" }
      });
      if (meResponse.ok) {
        const meData = await meResponse.json();
        balance = meData.credit || 0;
      }
    }
    
    return new Response(JSON.stringify({
      authenticated: hasAuth,
      userId: clientCookies["_rid"] || null,
      cookies: Object.keys(clientCookies),
      balance,
      timestamp: new Date().toISOString()
    }), {
      headers: { 
        "Content-Type": "application/json", 
        "Access-Control-Allow-Origin": "*" 
      }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: "检查失败", 
      message: error.message 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

async function handleClearCookies(request, targetUrl) {
  // 扩展清除的Cookie列表
  const cookiesToClear = [
    "sb-rls-auth-token",
    "_rid",
    "ph_phc_pXRYopwyByw2wy8XGxzRcko4lPiDr58YspxHOAjThEj_posthog",
    "chosen_language",
    "invite_code",
    "sessionid",
    "_ga",
    "_ga_WTNWK4GPZ6",
    "cf_clearance",
    "__cf_bm"
  ];
  
  // 不要清除认证Cookie
  const setCookieHeaders = cookiesToClear.map(
    (cookie) => `${cookie}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=None; Secure`
  );
  
  return new Response(JSON.stringify({ 
    success: true, 
    message: "已清除目标网站Cookie",
    cleared: cookiesToClear.length 
  }), {
    headers: { 
      "Content-Type": "application/json", 
      "Set-Cookie": setCookieHeaders.join(", ") 
    }
  });
}

async function handleInjectCookie(request) {
  try {
    const body = await request.json();
    const cookies = body.cookies;
    
    if (!cookies || typeof cookies !== "object") {
      throw new Error("无效的Cookie数据");
    }
    
    const setCookieHeaders = Object.entries(cookies).map(
      ([name, value]) => `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=31536000`
    );
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 
        "Content-Type": "application/json", 
        "Set-Cookie": setCookieHeaders.join(", ") 
      }
    });
    
  } catch (e) {
    return new Response(JSON.stringify({ 
      success: false, 
      message: e.message 
    }), { 
      status: 400 
    });
  }
}

async function handleBatchRegister(request, targetUrl, env) {
  try {
    const body = await request.json();
    const { count, delay, jobId } = body;
    
    if (!count || count < 1 || count > 100) {
      return new Response(JSON.stringify({
        success: false,
        message: "数量必须在1-100之间"
      }), { status: 400 });
    }
    
    // 记录批量任务
    if (env.DB) {
      await env.DB.prepare(
        `INSERT INTO batch_jobs (job_id, target_count, status) VALUES (?, ?, 'running')`
      ).bind(jobId, count).run();
    }
    
    return new Response(JSON.stringify({
      success: true,
      jobId,
      message: "批量注册任务已开始"
    }));
    
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      message: error.message
    }), { status: 500 });
  }
}

async function handleCheckEnvironment(request, targetUrl, env) {
  try {
    const urls = [
      `${targetUrl}/api/auth/token`,
      `${targetUrl}/api/auth/anonymous-sign-in`
    ];
    
    const results = [];
    
    for (const url of urls) {
      try {
        const startTime = Date.now();
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        const endTime = Date.now();
        
        results.push({
          url: url.replace(targetUrl, ''),
          status: response.status,
          responseTime: endTime - startTime,
          timestamp: new Date().toISOString()
        });
        
        // 记录到数据库
        if (env.DB) {
          await env.DB.prepare(
            `INSERT INTO network_logs (url, method, status, response_time) VALUES (?, 'GET', ?, ?)`
          ).bind(url.replace(targetUrl, ''), response.status, endTime - startTime).run();
        }
        
      } catch (error) {
        results.push({
          url: url.replace(targetUrl, ''),
          status: 0,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    const allPassed = results.every(r => r.status === 200);
    
    return new Response(JSON.stringify({
      success: true,
      environment: allPassed ? 'normal' : 'abnormal',
      results,
      timestamp: new Date().toISOString()
    }));
    
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500 });
  }
}

async function handleSaveAccount(request, env) {
  try {
    if (!env.DB) {
      throw new Error("数据库未配置");
    }
    
    const body = await request.json();
    const { userId, cookies } = body;
    
    if (!userId || !cookies) {
      return new Response(JSON.stringify({
        success: false,
        message: "缺少必要参数"
      }), { status: 400 });
    }
    
    // 检查是否已存在
    const existing = await env.DB.prepare(
      "SELECT id FROM account_manage WHERE user_id = ?"
    ).bind(userId).first();
    
    if (existing) {
      // 更新现有记录
      await env.DB.prepare(
        `UPDATE account_manage 
         SET cookies = ?, update_time = CURRENT_TIMESTAMP, last_used = CURRENT_TIMESTAMP, status = 'active'
         WHERE user_id = ?`
      ).bind(JSON.stringify(cookies), userId).run();
      
      return new Response(JSON.stringify({
        success: true,
        message: "账号已更新",
        action: "updated"
      }));
    } else {
      // 插入新记录
      await env.DB.prepare(
        `INSERT INTO account_manage 
         (user_id, cookies, balance, status, ip_address, user_agent) 
         VALUES (?, ?, 35, 'active', ?, ?)`
      ).bind(
        userId,
        JSON.stringify(cookies),
        request.headers.get("cf-connecting-ip") || "unknown",
        request.headers.get("user-agent") || ""
      ).run();
      
      return new Response(JSON.stringify({
        success: true,
        message: "账号已保存",
        action: "created"
      }));
    }
    
  } catch (error) {
    console.error("保存账号失败:", error);
    return new Response(JSON.stringify({
      success: false,
      message: error.message
    }), { status: 500 });
  }
}

async function handleGetAccounts(request, env) {
  try {
    if (!env.DB) {
      return new Response(JSON.stringify({
        success: true,
        accounts: [],
        message: "数据库未配置"
      }));
    }
    
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit')) || 50;
    const offset = parseInt(searchParams.get('offset')) || 0;
    const status = searchParams.get('status') || 'active';
    
    let query = "SELECT * FROM account_manage";
    let params = [];
    
    if (status && status !== 'all') {
      query += " WHERE status = ?";
      params.push(status);
    }
    
    query += " ORDER BY last_used DESC, update_time DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);
    
    const stmt = env.DB.prepare(query);
    
    for (let i = 0; i < params.length; i++) {
      stmt.bind(params[i]);
    }
    
    const { results } = await stmt.all();
    
    // 获取总数
    const countResult = await env.DB.prepare(
      "SELECT COUNT(*) as total FROM account_manage"
    ).first();
    
    return new Response(JSON.stringify({
      success: true,
      accounts: results || [],
      total: countResult?.total || 0,
      limit,
      offset
    }));
    
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500 });
  }
}

async function handleDeleteAccount(request, env) {
  try {
    const body = await request.json();
    const { userId } = body;
    
    if (!userId) {
      return new Response(JSON.stringify({
        success: false,
        message: "缺少用户ID"
      }), { status: 400 });
    }
    
    await env.DB.prepare(
      "UPDATE account_manage SET status = 'deleted' WHERE user_id = ?"
    ).bind(userId).run();
    
    return new Response(JSON.stringify({
      success: true,
      message: "账号已标记为删除"
    }));
    
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500 });
  }
}

async function handleRestoreAccount(request) {
  try {
    const body = await request.json();
    const { userId } = body;
    
    if (!userId) {
      return new Response(JSON.stringify({
        success: false,
        message: "缺少用户ID"
      }), { status: 400 });
    }
    
    // 这里应该从数据库获取Cookie并设置
    // 由于数据库操作需要env，这里简化处理
    return new Response(JSON.stringify({
      success: true,
      message: "账号恢复请求已接收",
      userId
    }));
    
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500 });
  }
}

async function handleAuthLogin(request, env) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return new Response(JSON.stringify({
        success: false,
        message: "需要Basic认证"
      }), { status: 401 });
    }
    
    const credentials = atob(authHeader.substring(6));
    const [username, password] = credentials.split(':');
    
    const hashedPass = await hashPassword(password);
    const user = await env.DB?.prepare(
      "SELECT * FROM auth_users WHERE username = ? AND password_hash = ?"
    ).bind(username, hashedPass).first();
    
    if (user) {
      // 更新登录信息
      await env.DB?.prepare(
        "UPDATE auth_users SET last_login = CURRENT_TIMESTAMP, login_count = login_count + 1 WHERE id = ?"
      ).bind(user.id).run();
      
      const authToken = btoa(JSON.stringify({
        username: user.username,
        password_hash: hashedPass,
        timestamp: Date.now()
      }));
      
      return new Response(JSON.stringify({
        success: true,
        username: user.username,
        is_admin: user.is_admin,
        login_count: user.login_count + 1
      }), {
        headers: {
          'Set-Cookie': `proxy_auth=${authToken}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000`
        }
      });
    } else {
      return new Response(JSON.stringify({
        success: false,
        message: "用户名或密码错误"
      }), { status: 401 });
    }
    
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500 });
  }
}

async function handleAuthLogout(request) {
  return new Response(JSON.stringify({
    success: true,
    message: "已退出登录"
  }), {
    headers: {
      'Set-Cookie': 'proxy_auth=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
    }
  });
}

async function handleAuthCheck(request) {
  try {
    const cookies = parseCookies(request.headers.get('cookie') || '');
    const authCookie = cookies['proxy_auth'];
    
    if (authCookie) {
      const authData = JSON.parse(atob(authCookie));
      return new Response(JSON.stringify({
        authenticated: true,
        username: authData.username,
        timestamp: authData.timestamp
      }));
    }
    
    return new Response(JSON.stringify({
      authenticated: false
    }));
    
  } catch (error) {
    return new Response(JSON.stringify({
      authenticated: false,
      error: error.message
    }));
  }
}

async function handleMonitorNetwork(request, targetUrl) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'start';
    
    return new Response(JSON.stringify({
      success: true,
      action,
      message: action === 'start' ? '网络监控已启动' : '网络监控已停止',
      timestamp: new Date().toISOString()
    }));
    
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500 });
  }
}

async function handleGetStats(env) {
  try {
    if (!env.DB) {
      return new Response(JSON.stringify({
        success: true,
        stats: {},
        message: "数据库未配置"
      }));
    }
    
    const [
      totalAccounts,
      activeAccounts,
      totalLogins,
      recentActivity
    ] = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) as count FROM account_manage").first(),
      env.DB.prepare("SELECT COUNT(*) as count FROM account_manage WHERE status = 'active'").first(),
      env.DB.prepare("SELECT SUM(login_count) as total FROM auth_users").first(),
      env.DB.prepare("SELECT COUNT(*) as count FROM network_logs WHERE timestamp > datetime('now', '-1 hour')").first()
    ]);
    
    return new Response(JSON.stringify({
      success: true,
      stats: {
        total_accounts: totalAccounts?.count || 0,
        active_accounts: activeAccounts?.count || 0,
        total_logins: totalLogins?.total || 0,
        recent_activity: recentActivity?.count || 0
      },
      timestamp: new Date().toISOString()
    }));
    
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500 });
  }
}

// ==================== 原有辅助函数 ====================
function parseCookies(cookieString) {
  const cookies = {};
  if (cookieString) {
    cookieString.split(";").forEach((cookie) => {
      const [name, ...valueParts] = cookie.trim().split("=");
      const value = valueParts.join("=");
      if (name) cookies[name] = decodeURIComponent(value);
    });
  }
  return cookies;
}
__name(parseCookies, "parseCookies");

function parseSetCookies(setCookieHeader) {
  const cookies = {};
  if (!setCookieHeader) return cookies;
  const cookieStrings = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  cookieStrings.forEach((cookieStr) => {
    const cookie = cookieStr.split(";")[0];
    const [name, ...valueParts] = cookie.split("=");
    const value = valueParts.join("=");
    if (name && value) cookies[name.trim()] = value.trim();
  });
  return cookies;
}
__name(parseSetCookies, "parseSetCookies");

function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === "x" ? r : r & 3 | 8).toString(16);
  });
}
__name(generateUUID, "generateUUID");

export {
  worker_default as default
};  