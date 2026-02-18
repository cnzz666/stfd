var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ==================== 配置 ====================
const TARGET_URL = "https://www.xn--i8s951di30azba.com";
const AUTH_USERNAME = "admin";
const AUTH_PASSWORD = "1591156135qwzxcv";
const AUTH_COOKIE_NAME = "auth_token";
const AUTH_COOKIE_VALUE = "authenticated";

// ==================== D1 初始化 ====================
async function ensureTable(env) {
  if (!env.DB) return;
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS account_manage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      cookies TEXT NOT NULL,
      token TEXT,
      balance INTEGER DEFAULT 0,
      create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'active'
    )`
  ).run();
}
__name(ensureTable, "ensureTable");

// ==================== 身份验证中间件 ====================
async function authenticate(request, env) {
  const url = new URL(request.url);
  // 放行内部 API 端点（不需要认证）
  if (url.pathname.startsWith("/_proxy/")) {
    return null; // 继续处理
  }

  // 检查认证 Cookie
  const cookies = parseCookies(request.headers.get("Cookie") || "");
  if (cookies[AUTH_COOKIE_NAME] === AUTH_COOKIE_VALUE) {
    return null; // 已认证
  }

  // 检查 Authorization 头
  const authHeader = request.headers.get("Authorization");
  if (authHeader) {
    const [scheme, encoded] = authHeader.split(" ");
    if (scheme === "Basic" && encoded) {
      const decoded = atob(encoded);
      const [user, pass] = decoded.split(":");
      if (user === AUTH_USERNAME && pass === AUTH_PASSWORD) {
        // 认证成功，设置 Cookie（通过响应头）
        const response = await fetch(request); // 先正常处理，稍后附加 Cookie
        const newHeaders = new Headers(response.headers);
        newHeaders.append("Set-Cookie", `${AUTH_COOKIE_NAME}=${AUTH_COOKIE_VALUE}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
        return new Response(response.body, {
          status: response.status,
          headers: newHeaders
        });
      }
    }
  }

  // 未认证，返回 401 弹出浏览器登录框
  return new Response("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Proxy Access", charset="UTF-8"'
    }
  });
}
__name(authenticate, "authenticate");

// ==================== 原 Worker 代码（保留） ====================
var worker_default = {
  async fetch(request, env, ctx) {
    // 先进行身份验证
    const authResponse = await authenticate(request, env);
    if (authResponse) return authResponse;

    const url = new URL(request.url);
    try {
      // 确保 D1 表存在（异步，不阻塞）
      ctx.waitUntil(ensureTable(env));

      // 内部 API 路由
      if (url.pathname === "/_proxy/get-account") {
        return handleGetAccount(request, TARGET_URL);
      }
      if (url.pathname === "/_proxy/check-status") {
        return handleCheckStatus(request, TARGET_URL);
      }
      if (url.pathname === "/_proxy/clear-cookies") {
        return handleClearCookies(request);
      }
      if (url.pathname === "/_proxy/clear-cookies-fixed") {
        return handleClearCookiesFixed(request);
      }
      if (url.pathname === "/_proxy/inject-cookie") {
        return handleInjectCookie(request);
      }
      if (url.pathname === "/_proxy/save-account") {
        return handleSaveAccount(request, env);
      }
      if (url.pathname === "/_proxy/get-accounts") {
        return handleGetAccounts(env);
      }
      // 代理请求
      return await handleProxyRequest(request, TARGET_URL, url);
    } catch (error) {
      return new Response(`代理错误: ${error.message}`, {
        status: 500,
        headers: { "Content-Type": "text/plain" }
      });
    }
  }
};

// ---------- 原函数（未修改，仅添加详细错误信息）----------
async function handleProxyRequest(request, targetUrl, url) {
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
  return await processProxyResponse(response, request, url);
}
__name(handleProxyRequest, "handleProxyRequest");

async function processProxyResponse(response, originalRequest, url) {
  const contentType = response.headers.get("content-type") || "";
  const clonedResponse = response.clone();
  if (contentType.includes("text/html")) {
    try {
      const html = await clonedResponse.text();
      const modifiedHtml = injectControlPanel(html, url);
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
__name(processProxyResponse, "processProxyResponse");

// ==================== 注入的前端控制面板 ====================
function injectControlPanel(html, url) {
  const panelHTML = `
  <div id="proxy-control-panel" style="all: initial; display: block; position: fixed; top: 20px; left: 50%; transform: translateX(-50%); z-index: 2147483647; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;">
    <style>
      .proxy-glass {
        background: rgba(255, 255, 255, 0.25);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 40px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        color: #1e1e1e;
        transition: all 0.2s ease;
      }
      .proxy-btn {
        background: rgba(255, 255, 255, 0.3);
        backdrop-filter: blur(8px);
        border: 1px solid rgba(255, 255, 255, 0.4);
        border-radius: 30px;
        padding: 10px 20px;
        font-size: 14px;
        font-weight: 500;
        color: #1e1e1e;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        transition: all 0.2s;
      }
      .proxy-btn:hover {
        background: rgba(255, 255, 255, 0.5);
        transform: scale(1.02);
        box-shadow: 0 8px 20px rgba(0,0,0,0.15);
      }
      .proxy-menu {
        position: absolute;
        top: 60px;
        left: 50%;
        transform: translateX(-50%);
        min-width: 300px;
        padding: 16px;
        border-radius: 24px;
        background: rgba(255, 255, 255, 0.3);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.4);
        box-shadow: 0 20px 40px rgba(0,0,0,0.2);
        color: #000;
        display: none;
      }
      .proxy-menu.show { display: block; }
      .proxy-menu-item {
        padding: 12px 16px;
        margin: 4px 0;
        border-radius: 30px;
        background: rgba(255,255,255,0.2);
        cursor: pointer;
        transition: background 0.2s;
      }
      .proxy-menu-item:hover { background: rgba(255,255,255,0.4); }
      .proxy-card {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        min-width: 320px;
        max-width: 90vw;
        max-height: 80vh;
        overflow-y: auto;
        padding: 24px;
        border-radius: 32px;
        background: rgba(255, 255, 255, 0.3);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.4);
        box-shadow: 0 30px 60px rgba(0,0,0,0.3);
        z-index: 2147483646;
        display: none;
      }
      .proxy-card.show { display: block; }
      .proxy-close {
        position: absolute;
        top: 16px;
        right: 16px;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: rgba(0,0,0,0.1);
        border: none;
        font-size: 20px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #333;
      }
      .proxy-close:hover { background: rgba(0,0,0,0.2); }
      .proxy-badge {
        background: rgba(255,255,255,0.5);
        padding: 4px 12px;
        border-radius: 40px;
        font-size: 12px;
        margin-left: 8px;
      }
      .proxy-progress {
        width: 100%;
        height: 8px;
        background: rgba(255,255,255,0.3);
        border-radius: 4px;
        overflow: hidden;
        margin: 12px 0;
      }
      .proxy-progress-bar {
        height: 100%;
        background: #4fc3f7;
        width: 0%;
        transition: width 0.2s;
      }
      .proxy-input {
        background: rgba(255,255,255,0.4);
        border: 1px solid rgba(255,255,255,0.6);
        border-radius: 30px;
        padding: 10px 16px;
        width: 100%;
        margin: 8px 0;
        font-size: 14px;
      }
      .proxy-table {
        width: 100%;
        border-collapse: collapse;
      }
      .proxy-table th, .proxy-table td {
        padding: 8px;
        text-align: left;
        border-bottom: 1px solid rgba(255,255,255,0.2);
      }
    </style>

    <!-- 主悬浮按钮 -->
    <div id="proxy-main-btn" class="proxy-glass" style="width: 56px; height: 56px; border-radius: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 24px; box-shadow: 0 6px 20px rgba(0,0,0,0.2);">
      🛠️
    </div>

    <!-- 功能菜单 -->
    <div id="proxy-menu" class="proxy-menu">
      <div class="proxy-menu-item" data-action="status">📊 状态信息</div>
      <div class="proxy-menu-item" data-action="env">🌐 环境检查</div>
      <div class="proxy-menu-item" data-action="batch">📦 批量注册</div>
      <div class="proxy-menu-item" data-action="accounts">📋 账号管理</div>
    </div>

    <!-- 状态卡片 -->
    <div id="proxy-status-card" class="proxy-card">
      <button class="proxy-close" data-close="status">✕</button>
      <h3 style="margin-top: 0;">📊 当前状态</h3>
      <div id="status-content">加载中...</div>
      <div style="display: flex; gap: 10px; margin-top: 20px;">
        <button class="proxy-btn" id="get-new-account">🔄 获取新账号</button>
        <button class="proxy-btn" id="refresh-status">↻ 刷新</button>
      </div>
    </div>

    <!-- 环境检查卡片 -->
    <div id="proxy-env-card" class="proxy-card">
      <button class="proxy-close" data-close="env">✕</button>
      <h3 style="margin-top: 0;">🌐 环境检查</h3>
      <div id="env-content">检查中...</div>
      <button class="proxy-btn" id="run-env-check" style="margin-top: 20px;">运行检查</button>
    </div>

    <!-- 批量注册卡片 -->
    <div id="proxy-batch-card" class="proxy-card">
      <button class="proxy-close" data-close="batch">✕</button>
      <h3 style="margin-top: 0;">📦 批量注册</h3>
      <div>
        <label>数量</label>
        <input type="number" id="batch-count" class="proxy-input" value="5" min="1" max="50">
        <label>刷新间隔（秒，0=立即刷新）</label>
        <input type="number" id="batch-interval" class="proxy-input" value="0" min="0" step="0.5">
        <div class="proxy-progress">
          <div id="batch-progress-bar" class="proxy-progress-bar" style="width: 0%;"></div>
        </div>
        <div id="batch-log" style="max-height: 200px; overflow-y: auto; margin: 10px 0; font-size: 12px; background: rgba(0,0,0,0.05); padding: 8px; border-radius: 16px;"></div>
        <div style="display: flex; gap: 10px;">
          <button class="proxy-btn" id="start-batch">开始</button>
          <button class="proxy-btn" id="stop-batch" disabled>停止</button>
        </div>
      </div>
    </div>

    <!-- 账号管理卡片 -->
    <div id="proxy-accounts-card" class="proxy-card">
      <button class="proxy-close" data-close="accounts">✕</button>
      <h3 style="margin-top: 0;">📋 账号管理</h3>
      <div id="accounts-content">加载中...</div>
      <button class="proxy-btn" id="refresh-accounts" style="margin-top: 20px;">刷新列表</button>
    </div>

    <!-- 通用提示 Toast -->
    <div id="proxy-toast" style="position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.7); color: white; padding: 12px 24px; border-radius: 40px; font-size: 14px; backdrop-filter: blur(10px); display: none; z-index: 2147483647;"></div>
  </div>

  <script>
    (function() {
      // 延迟3秒后才允许交互
      let interactive = false;
      setTimeout(() => { interactive = true; }, 3000);

      // DOM 元素
      const mainBtn = document.getElementById('proxy-main-btn');
      const menu = document.getElementById('proxy-menu');
      const cards = {
        status: document.getElementById('proxy-status-card'),
        env: document.getElementById('proxy-env-card'),
        batch: document.getElementById('proxy-batch-card'),
        accounts: document.getElementById('proxy-accounts-card')
      };
      const toast = document.getElementById('proxy-toast');

      // 显示提示
      function showToast(msg, duration = 3000) {
        toast.textContent = msg;
        toast.style.display = 'block';
        setTimeout(() => { toast.style.display = 'none'; }, duration);
      }

      // 关闭所有卡片
      function closeAllCards() {
        Object.values(cards).forEach(c => c.classList.remove('show'));
      }

      // 主按钮点击切换菜单
      mainBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!interactive) {
          showToast('请稍候，界面加载中...');
          return;
        }
        menu.classList.toggle('show');
      });

      // 点击菜单项
      document.querySelectorAll('.proxy-menu-item').forEach(item => {
        item.addEventListener('click', () => {
          const action = item.dataset.action;
          menu.classList.remove('show');
          closeAllCards();
          if (cards[action]) {
            cards[action].classList.add('show');
            if (action === 'status') loadStatus();
            else if (action === 'env') loadEnvStatus();
            else if (action === 'accounts') loadAccounts();
          }
        });
      });

      // 关闭按钮
      document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const card = btn.dataset.close;
          if (cards[card]) cards[card].classList.remove('show');
        });
      });

      // 点击外部关闭菜单
      document.addEventListener('click', (e) => {
        if (!menu.contains(e.target) && !mainBtn.contains(e.target)) {
          menu.classList.remove('show');
        }
      });

      // ========== API 调用 ==========
      async function apiFetch(path, options = {}) {
        const res = await fetch(path, options);
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      }

      // 加载状态
      async function loadStatus() {
        const el = document.getElementById('status-content');
        el.innerHTML = '加载中...';
        try {
          const data = await apiFetch('/_proxy/check-status');
          const hasAuth = data.authenticated;
          el.innerHTML = \`
            <p>认证状态: \${hasAuth ? '✅ 已登录' : '❌ 未登录'}</p>
            <p>用户ID: \${data.userId || '无'}</p>
            <p>余额: \${data.balance || 0}</p>
            <p>Cookies: \${data.cookies?.join(', ') || '无'}</p>
          \`;
          document.getElementById('get-new-account').style.display = hasAuth ? 'none' : 'inline-block';
        } catch (e) {
          el.innerHTML = '加载失败: ' + e.message;
        }
      }

      document.getElementById('refresh-status').addEventListener('click', loadStatus);

      // 获取新账号（单次注册）
      document.getElementById('get-new-account').addEventListener('click', async () => {
        if (!confirm('此操作可能会临时删除本机 Cookie，是否继续？')) return;
        try {
          showToast('正在清除 Cookie...');
          await apiFetch('/_proxy/clear-cookies-fixed', { method: 'POST' });
          // 刷新页面，让页面重新加载，然后自动触发注册？但我们需要在刷新后自动注册，这里可以设计为：清除后跳转到首页，并在 URL 加参数通知自动注册
          // 简单起见，我们直接调用注册接口，不刷新页面（但原逻辑依赖刷新后的首页提取 code？）
          // 原 handleGetAccount 会请求首页提取 code，所以我们需要先请求首页获取 code，但这里已经通过 API 封装了，直接调用 /_proxy/get-account 即可，它内部会请求首页。
          showToast('正在注册新账号...');
          const result = await apiFetch('/_proxy/get-account', { method: 'POST' });
          if (result.success) {
            // 保存到数据库
            await apiFetch('/_proxy/save-account', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                user_id: result.userId,
                cookies: result.cookies,
                balance: result.balance
              })
            });
            showToast('注册成功，Cookie 已保存');
            loadStatus();
          } else {
            throw new Error(result.message);
          }
        } catch (e) {
          showToast('注册失败: ' + e.message, 5000);
          // 提供重试选项
          if (confirm('注册失败，是否重试？')) {
            document.getElementById('get-new-account').click();
          }
        }
      });

      // 环境检查
      async function loadEnvStatus() {
        const el = document.getElementById('env-content');
        el.innerHTML = '检查中...';
        try {
          // 这里可以调用内部检测接口，简单返回状态
          const data = await apiFetch('/_proxy/check-status');
          const tokenCheck = await fetch(TARGET_URL + '/api/auth/token', { method: 'HEAD' }).then(r => r.status).catch(() => '无法连接');
          const signCheck = await fetch(TARGET_URL + '/api/auth/anonymous-sign-in', { method: 'HEAD' }).then(r => r.status).catch(() => '无法连接');
          el.innerHTML = \`
            <p>✅ 代理运行正常</p>
            <p>/api/auth/token: \${tokenCheck}</p>
            <p>/api/auth/anonymous-sign-in: \${signCheck}</p>
            <p>当前时间: \${new Date().toLocaleString()}</p>
          \`;
        } catch (e) {
          el.innerHTML = '环境异常: ' + e.message;
        }
      }
      document.getElementById('run-env-check').addEventListener('click', loadEnvStatus);

      // 批量注册逻辑
      let batchActive = false;
      let batchCount = 0;
      let batchInterval = 0;
      let batchCurrent = 0;
      let batchSuccess = 0;
      const batchLog = document.getElementById('batch-log');
      const batchProgress = document.getElementById('batch-progress-bar');
      const startBtn = document.getElementById('start-batch');
      const stopBtn = document.getElementById('stop-batch');

      function logBatch(msg) {
        batchLog.innerHTML += '<div>' + msg + '</div>';
        batchLog.scrollTop = batchLog.scrollHeight;
      }

      async function runBatch() {
        batchActive = true;
        startBtn.disabled = true;
        stopBtn.disabled = false;
        batchCurrent = 0;
        batchSuccess = 0;
        batchLog.innerHTML = '';
        logBatch('开始批量注册...');

        for (let i = 1; i <= batchCount && batchActive; i++) {
          logBatch(\`[\${i}/\${batchCount}] 正在注册...\`);
          try {
            // 先清除 Cookie
            await apiFetch('/_proxy/clear-cookies-fixed', { method: 'POST' });
            // 注册
            const result = await apiFetch('/_proxy/get-account', { method: 'POST' });
            if (result.success) {
              await apiFetch('/_proxy/save-account', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  user_id: result.userId,
                  cookies: result.cookies,
                  balance: result.balance
                })
              });
              batchSuccess++;
              logBatch(\`✅ 第\${i}个成功，余额 \${result.balance}\`);
            } else {
              throw new Error(result.message);
            }
          } catch (e) {
            logBatch(\`❌ 第\${i}个失败: \${e.message}\`);
            if (!batchActive) break;
            // 询问是否继续
            if (!confirm('注册失败，是否继续下一个？')) {
              batchActive = false;
              break;
            }
          }
          batchCurrent = i;
          batchProgress.style.width = (i / batchCount * 100) + '%';

          if (batchInterval > 0 && i < batchCount && batchActive) {
            await new Promise(r => setTimeout(r, batchInterval * 1000));
          }
        }

        logBatch(\`批量注册结束，成功 \${batchSuccess} 个\`);
        batchActive = false;
        startBtn.disabled = false;
        stopBtn.disabled = true;
        batchProgress.style.width = '0%';
      }

      startBtn.addEventListener('click', () => {
        batchCount = parseInt(document.getElementById('batch-count').value) || 5;
        batchInterval = parseFloat(document.getElementById('batch-interval').value) || 0;
        if (batchCount > 50) batchCount = 50;
        runBatch();
      });

      stopBtn.addEventListener('click', () => {
        batchActive = false;
        stopBtn.disabled = true;
        logBatch('用户取消批量注册');
        if (confirm('是否恢复已注册的账号？（保留已存入数据库的）')) {
          // 什么都不做，已保存的保留
        } else {
          // 删除本次注册的账号？这里不实现删除，仅提示
          alert('如需删除请手动在账号管理中操作。');
        }
      });

      // 账号管理
      async function loadAccounts() {
        const el = document.getElementById('accounts-content');
        el.innerHTML = '加载中...';
        try {
          const accounts = await apiFetch('/_proxy/get-accounts');
          if (!accounts.length) {
            el.innerHTML = '<p>暂无账号</p>';
            return;
          }
          let html = '<table class="proxy-table"><tr><th>ID</th><th>User ID</th><th>Cookies</th><th>余额</th><th>时间</th></tr>';
          accounts.forEach(acc => {
            html += \`<tr>
              <td>\${acc.id}</td>
              <td>\${acc.user_id}</td>
              <td>\${Object.keys(JSON.parse(acc.cookies)).join(', ')}</td>
              <td>\${acc.balance}</td>
              <td>\${new Date(acc.create_time).toLocaleString()}</td>
            </tr>\`;
          });
          html += '</table>';
          el.innerHTML = html;
        } catch (e) {
          el.innerHTML = '加载失败: ' + e.message;
        }
      }
      document.getElementById('refresh-accounts').addEventListener('click', loadAccounts);
    })();
  </script>
  `;
  return html.replace("</body>", panelHTML + "</body>");
}
__name(injectControlPanel, "injectControlPanel");

// ---------- 原 handleGetAccount（已增强错误信息） ----------
async function handleGetAccount(request, targetUrl) {
  try {
    const homeHeaders = {
      "User-Agent": request.headers.get("user-agent") || "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
      "Accept-Encoding": "gzip, deflate, br",
      "Connection": "keep-alive",
      "Upgrade-Insecure-Requests": "1"
    };
    const homeResp = await fetch(targetUrl, {
      headers: homeHeaders
    });
    if (!homeResp.ok) {
      throw new Error(`首页请求失败: ${homeResp.status} - ${await homeResp.text()}`);
    }
    const html = await homeResp.text();
    const codeMatch = html.match(/"code":"([^"]+)"/);
    if (!codeMatch) {
      throw new Error("无法从首页提取 code，尝试暗地操作失败");
    }
    const code = codeMatch[1];
    console.log("Extracted code:", code);
    const userId = generateUUID();
    const email = `${userId}@anon.com`;
    const fp = {
      data: {
        audio: {
          sampleHash: Math.random() * 2e3,
          oscillator: "sine",
          maxChannels: 1,
          channelCountMode: "max"
        },
        canvas: {
          commonImageDataHash: "8965585f0983dad03f7382c986d7aee5"
        },
        fonts: {
          Arial: 340.3125,
          Courier: 435.9375,
          "Courier New": 435.9375,
          Helvetica: 340.3125,
          Tahoma: 340.3125,
          Verdana: 340.3125
        },
        hardware: {
          videocard: {
            vendor: "WebKit",
            renderer: "WebKit WebGL",
            version: "WebGL 1.0 (OpenGL ES 2.0 Chromium)",
            shadingLanguageVersion: "WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)"
          },
          architecture: 127,
          deviceMemory: "4",
          jsHeapSizeLimit: 113e7
        },
        locales: {
          languages: "zh-CN",
          timezone: "Asia/Shanghai"
        },
        permissions: {
          accelerometer: "granted",
          "background-fetch": "denied",
          "background-sync": "denied",
          camera: "prompt",
          "clipboard-read": "denied",
          "clipboard-write": "granted",
          "display-capture": "denied",
          gyroscope: "granted",
          geolocation: "prompt",
          magnetometer: "granted",
          microphone: "prompt",
          midi: "granted",
          nfc: "denied",
          notifications: "denied",
          "payment-handler": "denied",
          "persistent-storage": "denied",
          "storage-access": "denied",
          "window-management": "denied"
        },
        plugins: { plugins: [] },
        screen: {
          is_touchscreen: true,
          maxTouchPoints: 5,
          colorDepth: 24,
          mediaMatches: [
            "prefers-contrast: no-preference",
            "any-hover: none",
            "any-pointer: coarse",
            "pointer: coarse",
            "hover: none",
            "update: fast",
            "prefers-reduced-motion: no-preference",
            "prefers-reduced-transparency: no-preference",
            "scripting: enabled",
            "forced-colors: none"
          ]
        },
        system: {
          platform: "Linux aarch64",
          cookieEnabled: true,
          productSub: "20030107",
          product: "Gecko",
          useragent: request.headers.get("user-agent") || "Mozilla/5.0 (Linux; Android 10; PBEM00 Build/QKQ1.190918.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.7681.2 Mobile Safari/537.36",
          hardwareConcurrency: 8,
          browser: { name: "Chrome", version: "147.0" },
          applePayVersion: 0
        },
        webgl: {
          commonImageHash: "1d62a570a8e39a3cc4458b2efd47b6a2"
        },
        math: {
          acos: 1.0471975511965979,
          asin: -9614302481290016e-32,
          atan: 4578239276804769e-32,
          cos: -4854249971455313e-31,
          cosh: 1.9468519159297506,
          e: 2.718281828459045,
          largeCos: 0.7639704044417283,
          largeSin: -0.6452512852657808,
          largeTan: -0.8446024630198843,
          log: 6.907755278982137,
          pi: 3.141592653589793,
          sin: -19461946644816207e-32,
          sinh: -0.6288121810679035,
          sqrt: 1.4142135623730951,
          tan: 6980860926542689e-29,
          tanh: -0.39008295789884684
        }
      },
      hash: "77f81202fa12f86b7f77af693c55bf08"
    };
    const requestBody = {
      code,
      id: userId,
      email,
      fp
    };
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
      await new Promise((resolve) => setTimeout(resolve, 1e3));
    }
    if (!response || !response.ok) {
      const errorText = response ? await response.text() : "无响应";
      throw new Error(`API返回 ${response?.status || "未知"}: ${errorText}`);
    }
    const responseText = await response.text();
    console.log(`API Response Status: ${response.status}, Body: ${responseText}`);
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
    return new Response(JSON.stringify({
      success: true,
      message: "游客账户创建成功",
      cookies,
      userId: cookies["_rid"] || data.id,
      balance: 35,
      expiresAt: new Date(Date.now() + 3600 * 1e3).toISOString(),
      note: "通过纯动态流程注册，拥有35次免费额度。"
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": Object.entries(cookies).map(([name, value]) => `${name}=${value}; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=31536000`).join(", ")
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
__name(handleGetAccount, "handleGetAccount");

// ---------- 原 handleCheckStatus ----------
async function handleCheckStatus(request, targetUrl) {
  try {
    const clientCookies = parseCookies(request.headers.get("cookie") || "");
    const hasAuth = "sb-rls-auth-token" in clientCookies;
    let balance = 0;
    if (hasAuth) {
      const meResponse = await fetch(targetUrl + "/api/me", {
        headers: {
          "Cookie": request.headers.get("cookie") || ""
        }
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
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "检查失败", message: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(handleCheckStatus, "handleCheckStatus");

// ---------- 原 handleClearCookies ----------
async function handleClearCookies(request) {
  const cookiesToClear = [
    "sb-rls-auth-token",
    "_rid",
    "ph_phc_pXRYopwyByw2wy8XGxzRcko4lPiDr58YspxHOAjThEj_posthog",
    "chosen_language",
    "invite_code",
    "sessionid"
  ];
  const setCookieHeaders = cookiesToClear.map(
    (cookie) => `${cookie}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=None; Secure`
  );
  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json", "Set-Cookie": setCookieHeaders.join(", ") }
  });
}
__name(handleClearCookies, "handleClearCookies");

// ---------- 修复版清除 Cookie ----------
async function handleClearCookiesFixed(request) {
  const cookiesToClear = [
    "sb-rls-auth-token",
    "_rid",
    "ph_phc_pXRYopwyByw2wy8XGxzRcko4lPiDr58YspxHOAjThEj_posthog",
    "chosen_language",
    "invite_code",
    "sessionid",
    AUTH_COOKIE_NAME
  ];
  const domain = ".xn--i8s951di30azba.com";
  const setCookieHeaders = cookiesToClear.map(
    (cookie) => `${cookie}=; Domain=${domain}; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=None; Secure`
  );
  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json", "Set-Cookie": setCookieHeaders.join(", ") }
  });
}
__name(handleClearCookiesFixed, "handleClearCookiesFixed");

// ---------- 原 handleInjectCookie ----------
async function handleInjectCookie(request) {
  try {
    const body = await request.json();
    const cookies = body.cookies;
    if (!cookies || typeof cookies !== "object") throw new Error("无效的Cookie数据");
    const setCookieHeaders = Object.entries(cookies).map(
      ([name, value]) => `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=31536000`
    );
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json", "Set-Cookie": setCookieHeaders.join(", ") }
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, message: e.message }), { status: 400 });
  }
}
__name(handleInjectCookie, "handleInjectCookie");

// ---------- 保存账号到 D1 ----------
async function handleSaveAccount(request, env) {
  try {
    const { user_id, cookies, balance = 0 } = await request.json();
    if (!user_id || !cookies) throw new Error("缺少必要字段");
    await ensureTable(env);
    await env.DB.prepare(
      "INSERT INTO account_manage (user_id, cookies, balance) VALUES (?, ?, ?)"
    ).bind(user_id, JSON.stringify(cookies), balance).run();
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, message: e.message }), { status: 500 });
  }
}
__name(handleSaveAccount, "handleSaveAccount");

// ---------- 获取所有账号 ----------
async function handleGetAccounts(env) {
  try {
    await ensureTable(env);
    const { results } = await env.DB.prepare(
      "SELECT * FROM account_manage ORDER BY create_time DESC"
    ).all();
    return new Response(JSON.stringify(results), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
__name(handleGetAccounts, "handleGetAccounts");

// ---------- 工具函数 ----------
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