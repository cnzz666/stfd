/**
 * 核心逻辑：Hook 监听 + 状态机批量注册 + D1 存储 + iOS 玻璃 UI
 * 验证密码：1591156135qwzxcv
 */

const CONFIG = {
  targetUrl: "https://www.xn--i8s951di30azba.com",
  adminPass: "1591156135qwzxcv",
  dbBinding: "DB" // 确保 D1 绑定名为 DB
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
    try {
      const authBase64 = authHeader.split(" ")[1];
      const [user, pass] = atob(authBase64).split(":");
      if (pass !== CONFIG.adminPass) return new Response("Forbidden", { status: 403 });
    } catch (e) {
      return new Response("Unauthorized", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="System Login"' } });
    }

    // 2. D1 数据库初始化
    if (env[CONFIG.dbBinding]) {
      await initDatabase(env[CONFIG.dbBinding]);
    }

    // 3. 内部 API 路由
    if (url.pathname === "/_proxy/save-to-db") {
      return handleSaveToDb(request, env[CONFIG.dbBinding]);
    }
    if (url.pathname === "/_proxy/clear-cookies") {
      return handleClearCookies();
    }
    if (url.pathname === "/_proxy/get-db-list") {
      return handleGetDbList(env[CONFIG.dbBinding]);
    }

    // 4. 正常代理并注入 UI 脚本
    return await handleProxyRequest(request, CONFIG.targetUrl, url);
  }
};

// --- D1 数据库 ---
async function initDatabase(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      cookies TEXT,
      info TEXT,
      time DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}

async function handleSaveToDb(request, db) {
  const data = await request.json();
  await db.prepare("INSERT OR REPLACE INTO accounts (id, cookies, info) VALUES (?, ?, ?)")
          .bind(data.id, data.cookies, data.info).run();
  return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
}

async function handleGetDbList(db) {
  const { results } = await db.prepare("SELECT * FROM accounts ORDER BY time DESC").all();
  return new Response(JSON.stringify(results), { headers: { "Content-Type": "application/json" } });
}

async function handleClearCookies() {
  const cookies = ["sb-rls-auth-token", "_rid", "ph_phc_pXRYopwyByw2wy8XGxzRcko4lPiDr58YspxHOAjThEj_posthog", "chosen_language", "invite_code"];
  const headers = cookies.map(c => `${c}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=None; Secure`);
  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json", "Set-Cookie": headers.join(", ") }
  });
}

// --- 代理与注入 ---
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
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("text/html")) {
    let html = await response.text();
    // 在 <head> 最前面注入 Hook 脚本，确保比网站 JS 先运行
    const injectedJs = getInjectedJs();
    html = html.replace("<head>", `<head>${injectedJs}`);
    
    const newHeaders = new Headers(response.headers);
    newHeaders.set("Content-Type", "text/html; charset=utf-8");
    newHeaders.delete("content-security-policy");
    return new Response(html, { status: response.status, headers: newHeaders });
  }

  return response;
}

// --- 核心注入脚本 (Hook + UI) ---
function getInjectedJs() {
  return `
  <style>
    #ios-notice-wrap {
      position: fixed; top: -150px; left: 50%; transform: translateX(-50%);
      width: 90%; max-width: 420px; z-index: 2147483647;
      transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
    }
    #ios-notice-wrap.active { top: 20px; }
    .ios-pill {
      background: rgba(255, 255, 255, 0.45); backdrop-filter: blur(25px) saturate(180%);
      -webkit-backdrop-filter: blur(25px) saturate(180%);
      border-radius: 30px; border: 1px solid rgba(255, 255, 255, 0.3);
      padding: 20px; box-shadow: 0 15px 40px rgba(0,0,0,0.15);
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
    }
    .ios-title { display: flex; justify-content: space-between; font-size: 13px; color: rgba(0,0,0,0.5); margin-bottom: 8px; }
    .ios-msg { font-size: 16px; color: #000; font-weight: 600; line-height: 1.4; }
    .ios-actions { display: flex; gap: 10px; margin-top: 15px; }
    .ios-btn {
      flex: 1; padding: 12px; border-radius: 15px; border: none;
      background: rgba(0, 122, 255, 0.12); color: #007AFF;
      font-weight: 700; cursor: pointer; font-size: 14px; transition: 0.2s;
    }
    .ios-btn.danger { background: rgba(255, 59, 48, 0.12); color: #FF3B30; }
    .ios-btn:active { transform: scale(0.95); opacity: 0.7; }
    
    #ios-island {
      position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
      width: 40px; height: 6px; background: #000; border-radius: 10px;
      z-index: 2147483646; cursor: pointer; transition: 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }
    #ios-island:hover { width: 100px; height: 24px; opacity: 0.9; }
  </style>

  <div id="ios-island" onclick="sakShowNotice()"></div>
  <div id="ios-notice-wrap">
    <div class="ios-pill">
      <div class="ios-title"><span>系统通知</span><span id="sak-time">刚刚</span></div>
      <div id="sak-msg" class="ios-msg">正在监控网络环境...</div>
      <div class="ios-actions">
        <button class="ios-btn" onclick="sakStartBatch()">批量创建</button>
        <button class="ios-btn" onclick="sakShowManager()">账号管理</button>
        <button class="ios-btn danger" onclick="sakHideNotice()">关闭</button>
      </div>
    </div>
  </div>

  <script>
    // 1. Hook 网络请求 (在网页任何 JS 运行前)
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      const url = args[0].toString();
      
      if (url.includes('/api/auth/anonymous-sign-in')) {
        if (response.status === 429) {
          sakShowNotice("⚠️ 注册失败: IP 被拉黑 (429)<br>请更换节点后再试。");
          localStorage.removeItem('sak_batch_count');
        } else if (response.status === 200) {
          // 注册成功，等待 Cookie 写入
          setTimeout(() => sakHandleSuccess(), 1500);
        }
      }
      return response;
    };

    // 2. 状态机逻辑
    async function sakHandleSuccess() {
      const batchCount = localStorage.getItem('sak_batch_count');
      if (batchCount && parseInt(batchCount) > 0) {
        const rid = document.cookie.match(/_rid=([^;]+)/)?.[1] || Date.now();
        // 上传数据库
        await originalFetch('/_proxy/save-to-db', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ id: rid, cookies: document.cookie, info: '自动注册' })
        });

        const nextCount = parseInt(batchCount) - 1;
        if (nextCount > 0) {
          localStorage.setItem('sak_batch_count', nextCount);
          sakShowNotice("✅ 注册成功！正在准备下一个... (剩余: " + nextCount + ")");
          await originalFetch('/_proxy/clear-cookies');
          setTimeout(() => location.reload(), 1000);
        } else {
          localStorage.removeItem('sak_batch_count');
          sakShowNotice("🎉 批量注册任务已完成！");
        }
      }
    }

    // 3. UI 交互
    function sakShowNotice(msg) {
      if(msg) document.getElementById('sak-msg').innerHTML = msg;
      document.getElementById('ios-notice-wrap').classList.add('active');
    }
    function sakHideNotice() {
      document.getElementById('ios-notice-wrap').classList.remove('active');
    }

    function sakStartBatch() {
      const n = prompt("请输入要批量创建的数量:", "5");
      if(!n) return;
      localStorage.setItem('sak_batch_count', n);
      originalFetch('/_proxy/clear-cookies').then(() => location.reload());
    }

    async function sakShowManager() {
      const res = await originalFetch('/_proxy/get-db-list');
      const list = await res.json();
      sakShowNotice("数据库中共有 " + list.length + " 个账号。<br>详情已输出到控制台(F12)。");
      console.table(list);
    }

    // 初始化检测
    window.addEventListener('load', () => {
      const count = localStorage.getItem('sak_batch_count');
      if (count && parseInt(count) > 0) {
        sakShowNotice("🚀 批量任务进行中...<br>当前进度: 剩余 " + count + " 个");
      } else {
        setTimeout(() => {
          if(!document.cookie.includes('sb-rls-auth-token')) {
            sakShowNotice("未检测到有效账号。<br>点击下方按钮开始批量获取。");
          }
        }, 2000);
      }
    });
  </script>
  `;
}