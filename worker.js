// --- 核心定义 ---
var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

const CONFIG = {
  targetUrl: "https://www.xn--i8s951di30azba.com",
  adminPass: "1591156135qwzxcv", // 默认系统验证密码
  dbBinding: "DB" 
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. 浏览器原生身份验证 (Basic Auth)
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return new Response("Unauthorized", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="System Login"' }
      });
    }
    const authBase64 = authHeader.split(" ")[1];
    try {
      const decodedAuth = atob(authBase64);
      const [user, pass] = decodedAuth.split(":");
      if (pass !== CONFIG.adminPass) {
        return new Response("Forbidden", { status: 403 });
      }
    } catch (e) {
      return new Response("Unauthorized", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="System Login"' } });
    }

    // 2. 数据库初始化
    if (env[CONFIG.dbBinding]) {
      await initDatabase(env[CONFIG.dbBinding]);
    }

    // 3. 内部 API 路由
    if (url.pathname === "/_proxy/save-account") {
      return handleSaveAccount(request, env[CONFIG.dbBinding]);
    }
    if (url.pathname === "/_proxy/db-list") {
      return handleDbList(env[CONFIG.dbBinding]);
    }
    if (url.pathname === "/_proxy/clear-cookies") {
      return handleClearCookies();
    }

    // 4. 代理并注入
    return await handleProxyRequest(request, CONFIG.targetUrl, url);
  }
};

// --- D1 数据库初始化 ---
async function initDatabase(db) {
  const sql = `
    CREATE TABLE IF NOT EXISTS account_manage (
      id TEXT PRIMARY KEY,
      cookies TEXT,
      balance INTEGER,
      create_time DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;
  await db.prepare(sql).run();
}

// --- 存储账号 API ---
async function handleSaveAccount(request, db) {
  if (!db) return new Response("DB Not Found", { status: 500 });
  const data = await request.json();
  await db.prepare("INSERT OR REPLACE INTO account_manage (id, cookies, balance) VALUES (?, ?, ?)")
          .bind(data.id, JSON.stringify(data.cookies), data.balance || 35).run();
  return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
}

async function handleDbList(db) {
  const { results } = await db.prepare("SELECT * FROM account_manage ORDER BY create_time DESC").all();
  return new Response(JSON.stringify(results), { headers: { "Content-Type": "application/json" } });
}

async function handleClearCookies() {
  const list = ["sb-rls-auth-token", "_rid", "ph_phc_pXRYopwyByw2wy8XGxzRcko4lPiDr58YspxHOAjThEj_posthog", "chosen_language", "invite_code"];
  const headers = list.map(c => `\${c}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=None; Secure`);
  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json", "Set-Cookie": headers.join(", ") }
  });
}

// --- 代理核心 ---
async function handleProxyRequest(request, targetUrl, url) {
  const targetHeaders = new Headers(request.headers);
  targetHeaders.delete("host");
  targetHeaders.set("origin", targetUrl);
  targetHeaders.set("referer", targetUrl + "/");

  const targetRequest = new Request(targetUrl + url.pathname + url.search, {
    method: request.method,
    headers: targetHeaders,
    body: request.body,
    redirect: "manual"
  });

  const response = await fetch(targetRequest);
  
  // 拦截特定 API 的响应状态以便前端 UI 捕获
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/html")) {
    let html = await response.text();
    html = injectIosUI(html);
    const newHeaders = new Headers(response.headers);
    newHeaders.set("Content-Type", "text/html; charset=utf-8");
    newHeaders.delete("content-security-policy");
    return new Response(html, { status: response.status, headers: newHeaders });
  }

  return response;
}

// --- 注入 iOS 毛玻璃 UI (消息弹窗风格) ---
function injectIosUI(html) {
  const uiHTML = `
  <!-- iOS 风格 UI 注入 -->
  <style>
    #ios-notice-container {
      position: fixed; top: -100px; left: 50%; transform: translateX(-50%);
      width: 90%; max-width: 380px; z-index: 2147483647;
      transition: all 0.6s cubic-bezier(0.23, 1, 0.32, 1);
    }
    #ios-notice-container.show { top: 20px; }
    
    .ios-pill {
      background: rgba(255, 255, 255, 0.6);
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      border-radius: 25px; border: 1px solid rgba(255, 255, 255, 0.4);
      padding: 15px 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.12);
      display: flex; flex-direction: column; gap: 8px;
    }

    .ios-header { display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #666; }
    .ios-content { font-size: 15px; color: #000; font-weight: 500; line-height: 1.4; }
    .ios-footer { display: flex; gap: 10px; margin-top: 5px; }
    
    .ios-btn {
      flex: 1; padding: 8px; border-radius: 12px; border: none;
      background: rgba(0, 122, 255, 0.15); color: #007AFF;
      font-weight: 600; cursor: pointer; font-size: 13px; transition: 0.2s;
    }
    .ios-btn:active { background: rgba(0, 122, 255, 0.3); }
    .ios-btn.danger { color: #FF3B30; background: rgba(255, 59, 48, 0.1); }

    #ios-mini-island {
      position: fixed; top: 15px; left: 50%; transform: translateX(-50%);
      height: 5px; width: 40px; background: #000; border-radius: 10px;
      z-index: 2147483646; cursor: pointer; transition: 0.3s;
    }
    #ios-mini-island:hover { width: 100px; height: 20px; opacity: 0.8; }
  </style>

  <div id="ios-mini-island" onclick="showIosNotice()"></div>
  
  <div id="ios-notice-container">
    <div class="ios-pill">
      <div class="ios-header">
        <span>系统通知</span>
        <span id="ios-time">刚刚</span>
      </div>
      <div id="ios-msg-body" class="ios-content">
        正在检查账号状态...
      </div>
      <div class="ios-footer" id="ios-actions">
        <button class="ios-btn" onclick="startBatch()">批量注册</button>
        <button class="ios-btn" onclick="checkEnv()">环境检查</button>
        <button class="ios-btn danger" onclick="hideIosNotice()">关闭</button>
      </div>
    </div>
  </div>

  <script>
    // 立即执行：检查批量注册状态
    (function() {
      const batchCount = localStorage.getItem('sak_batch_count');
      const isRunning = localStorage.getItem('sak_batch_running');
      
      if (isRunning === 'true' && batchCount > 0) {
        window.addEventListener('load', async () => {
          showIosNotice("正在批量注册中，剩余: " + batchCount);
          
          // 检查是否已经获取到 Cookie
          const hasCookie = document.cookie.includes('sb-rls-auth-token');
          if (hasCookie) {
            const rid = document.cookie.match(/_rid=([^;]+)/)?.[1];
            // 存库
            await fetch('/_proxy/save-account', {
              method: 'POST',
              body: JSON.stringify({ id: rid || Date.now(), cookies: document.cookie })
            });
            
            // 减少计数并重置环境
            localStorage.setItem('sak_batch_count', batchCount - 1);
            await fetch('/_proxy/clear-cookies');
            location.reload();
          } else {
            // 如果没获取到，监控网络请求
            monitorNetwork();
          }
        });
      }
    })();

    function showIosNotice(msg) {
      const container = document.getElementById('ios-notice-container');
      if(msg) document.getElementById('ios-msg-body').innerHTML = msg;
      container.classList.add('show');
    }

    function hideIosNotice() {
      document.getElementById('ios-notice-container').classList.remove('show');
    }

    async function checkEnv() {
      showIosNotice("正在深度扫描 API 环境...");
      const res = await fetch(location.origin + '/api/auth/anonymous-sign-in', { method: 'POST' });
      if (res.status === 429) {
        showIosNotice("⚠️ 警告：检测到 429 错误。<br>你的 IP 可能已被拉黑，无法创建游客账号。");
      } else {
        showIosNotice("✅ 环境正常。<br>可以进行账号创建。");
      }
    }

    function startBatch() {
      const num = prompt("请输入要批量注册的数量:", "5");
      if(!num) return;
      if(!confirm("批量注册将临时删除本机账号，确认？")) return;
      
      localStorage.setItem('sak_batch_count', num);
      localStorage.setItem('sak_batch_running', 'true');
      
      fetch('/_proxy/clear-cookies').then(() => location.reload());
    }

    function monitorNetwork() {
      // 监听接口
      const originalFetch = window.fetch;
      window.fetch = async (...args) => {
        const response = await originalFetch(...args);
        if (args[0].includes('/api/auth/anonymous-sign-in')) {
          if (response.status === 429) {
            showIosNotice("❌ 注册失败: IP 被限制 (429)");
            localStorage.setItem('sak_batch_running', 'false');
          }
          if (response.status === 200) {
            showIosNotice("✅ 抓取成功，正在存库...");
          }
        }
        return response;
      };
    }

    // 自动显示面板逻辑
    setTimeout(() => {
      const hasCookie = document.cookie.includes('sb-rls-auth-token');
      if (!hasCookie && localStorage.getItem('sak_batch_running') !== 'true') {
        showIosNotice("未检测到游客账号。<br>点击下方按钮开始批量获取。");
      } else {
        showIosNotice("账号已就绪。<br>可以在账号管理中查看详情。");
      }
    }, 2000);
  </script>
  `;
  
  // 在 body 最前端注入，确保优先加载
  return html.replace("<body>", "<body>" + uiHTML);
}

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

export { worker_default as default };