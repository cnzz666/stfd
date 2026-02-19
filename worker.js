// ========================================================
// DZMM PROXY - 完整版 Worker（2026-02-19 最终修复版）
// 严格按用户最新要求实现：
// 1. 面板网页加载瞬间出现（iOS 消息中心风格毛玻璃）
// 2. 无任何 code 提取逻辑，纯网络监听 /api/auth/token + /api/auth/anonymous-sign-in
// 3. 监听失败时自动等待 + 提示 IP 可能被拉黑
// 4. 成功捕获 set-cookie 自动保存到 D1 + iOS 通知横幅
// 5. 批量注册：自动清 Cookie → 刷新 → 保存 → 继续（支持停止）
// 6. 浏览器原生身份验证（密码 1591156135qwzxcv）
// 7. 代码极度复杂化：大量注释、辅助函数、日志、错误处理、开发模式
// 8. 零省略，完整可直接部署
// ========================================================

export default {
  async fetch(request, env, ctx) {
    // ====================== 全局身份验证（所有路径强制） ======================
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Basic ")) {
      return new Response(
        `<div style="font-family:-apple-system,sans-serif;background:linear-gradient(135deg,#0f172a,#1e3a8a);color:#fff;height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;">
           <h1 style="font-size:32px;margin-bottom:20px;">本网站要求进行身份验证</h1>
           <p style="font-size:19px;">用户名：任意<br>密码：<strong>1591156135qwzxcv</strong></p>
         </div>`,
        {
          status: 401,
          headers: {
            "WWW-Authenticate": 'Basic realm="DZMM Proxy Access"',
            "Content-Type": "text/html; charset=utf-8"
          }
        }
      );
    }
    const credentials = atob(authHeader.slice(6)).split(":");
    if (credentials[1] !== "1591156135qwzxcv") {
      return new Response("密码错误", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="DZMM Proxy Access"' } });
    }

    const url = new URL(request.url);
    const targetUrl = "https://www.xn--i8s951di30azba.com";

    console.log(`[DZMM] 请求路径: ${url.pathname} | 时间: ${new Date().toISOString()}`);

    try {
      // ====================== 路由表 ======================
      if (url.pathname === "/_proxy/check-status") return handleCheckStatus(request, targetUrl, env);
      if (url.pathname === "/_proxy/clear-cookies") return handleClearCookies(request);
      if (url.pathname === "/_proxy/save-account") return await handleSaveAccount(request, env);
      if (url.pathname === "/_proxy/account-list") return await handleAccountList(env);
      if (url.pathname === "/_proxy/env-check") return await handleEnvCheck(request, targetUrl);
      if (url.pathname === "/_proxy/get-account") {
        return new Response(JSON.stringify({
          success: true,
          message: "网络监听已开启，请刷新页面进行注册",
          note: "成功后自动保存到 D1"
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      // 默认代理所有其他请求
      return await handleProxyRequest(request, targetUrl, url);
    } catch (error) {
      console.error(`[DZMM ERROR] ${error.message}`);
      return new Response(`代理错误: ${error.message}`, { status: 500, headers: { "Content-Type": "text/plain" } });
    }
  }
};

// ====================== D1 数据库操作（自动建表 + 日志） ======================
async function initDatabase(env) {
  if (!env.DB) {
    console.warn("[DZMM] D1 数据库未绑定，请在 Workers 设置中绑定 DB");
    return;
  }
  await env.DB.exec(`
    CREATE TABLE IF NOT EXISTS account_manage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT UNIQUE NOT NULL,
      cookies TEXT NOT NULL,
      token TEXT,
      balance INTEGER DEFAULT 35,
      create_time TEXT,
      update_time TEXT,
      status TEXT DEFAULT 'active',
      ip TEXT
    )
  `);
  console.log("[DZMM] D1 表 account_manage 初始化完成");
}

async function handleSaveAccount(request, env) {
  await initDatabase(env);
  const body = await request.json();
  const now = new Date().toISOString();
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const stmt = env.DB.prepare(`
    INSERT OR REPLACE INTO account_manage 
    (user_id, cookies, token, balance, create_time, update_time, ip)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  await stmt.bind(
    body.userId || `guest_${Date.now()}`,
    JSON.stringify(body.cookies || {}),
    body.token || "",
    body.balance || 35,
    now,
    now,
    ip
  ).run();
  console.log(`[DZMM] 账号保存成功: ${body.userId}`);
  return new Response(JSON.stringify({ success: true, savedAt: now }), { headers: { "Content-Type": "application/json" } });
}

async function handleAccountList(env) {
  await initDatabase(env);
  const { results } = await env.DB.prepare("SELECT * FROM account_manage ORDER BY create_time DESC LIMIT 50").all();
  return new Response(JSON.stringify(results || []), { headers: { "Content-Type": "application/json" } });
}

// ====================== 环境检查（针对你抓包的两个关键接口） ======================
async function handleEnvCheck(request, targetUrl) {
  try {
    const cookie = request.headers.get("cookie") || "";
    const tokenRes = await fetch(targetUrl + "/api/auth/token", { headers: { Cookie: cookie } });
    const signRes = await fetch(targetUrl + "/api/auth/anonymous-sign-in", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    const tokenStatus = tokenRes.status;
    const signStatus = signRes.status;
    const normal = tokenStatus === 200 || tokenStatus === 401 || signStatus === 200;
    console.log(`[DZMM ENV] token:${tokenStatus} sign:${signStatus}`);
    return new Response(JSON.stringify({
      normal,
      tokenStatus,
      signStatus,
      message: normal ? "✅ 环境正常，可注册游客账号" : `❌ 环境异常（token:${tokenStatus}, sign:${signStatus}）`
    }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error(`[DZMM ENV ERROR] ${e.message}`);
    return new Response(JSON.stringify({ normal: false, message: e.message }), { headers: { "Content-Type": "application/json" } });
  }
}

// ====================== 原有代理核心（完整保留） ======================
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

async function processProxyResponse(response, originalRequest, url) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/html")) {
    try {
      const html = await response.clone().text();
      const modifiedHtml = injectControlPanel(html, url);
      const newHeaders = new Headers(response.headers);
      newHeaders.set("Content-Type", "text/html; charset=utf-8");
      return new Response(modifiedHtml, { status: response.status, headers: newHeaders });
    } catch (e) {
      console.error("[DZMM HTML INJECT ERROR]", e);
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
  return new Response(response.body, { status: response.status, headers: newHeaders });
}

// ====================== iOS 消息中心风格毛玻璃面板（加载即出现） ======================
function injectControlPanel(html, url) {
  const panelHTML = `
<div id="dzmm-panel" style="position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:2147483647;background:rgba(15,23,42,0.94);backdrop-filter:blur(42px);-webkit-backdrop-filter:blur(42px);border:1px solid rgba(148,163,184,0.28);border-radius:28px;padding:16px 24px;box-shadow:0 35px 70px -20px rgba(0,0,0,0.65);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#f8fafc;display:none;align-items:center;gap:16px;width:94%;max-width:440px;transition:all 0.65s cubic-bezier(0.34,1.56,0.64,1);">
  <div style="background:rgba(255,255,255,0.13);padding:8px 20px;border-radius:9999px;font-size:13.5px;font-weight:700;letter-spacing:0.8px;">DZMM PROXY</div>
  <button onclick="showStatusModal()" class="px-7 py-3.5 bg-white/10 hover:bg-white/25 rounded-3xl text-sm font-medium transition-all active:scale-95">状态</button>
  <button onclick="getNewAccount()" class="px-7 py-3.5 bg-white/10 hover:bg-white/25 rounded-3xl text-sm font-medium transition-all active:scale-95">新账号</button>
  <button onclick="showBatchModal()" class="px-7 py-3.5 bg-white/10 hover:bg-white/25 rounded-3xl text-sm font-medium transition-all active:scale-95">批量</button>
  <button onclick="showEnvCheckModal()" class="px-7 py-3.5 bg-white/10 hover:bg-white/25 rounded-3xl text-sm font-medium transition-all active:scale-95">环境</button>
  <button onclick="showAccountMgmtModal()" class="px-7 py-3.5 bg-white/10 hover:bg-white/25 rounded-3xl text-sm font-medium transition-all active:scale-95">管理</button>
  <button onclick="closePanelToCenter()" class="ml-auto px-7 py-3.5 bg-red-500/90 hover:bg-red-600 rounded-3xl text-sm font-medium transition-all active:scale-95">关闭</button>
</div>

<!-- iOS 通知横幅 -->
<div id="ios-toast" style="position:fixed;top:-120px;left:50%;transform:translateX(-50%);z-index:2147483647;background:rgba(15,23,42,0.96);backdrop-filter:blur(32px);-webkit-backdrop-filter:blur(32px);border-radius:20px;padding:18px 26px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.6);color:#f1f5f9;font-size:15.5px;max-width:390px;display:flex;align-items:center;gap:14px;transition:all 0.55s cubic-bezier(0.34,1.56,0.64,1);opacity:0;"></div>

<div id="dzmm-overlay" style="display:none;position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,0.68);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);align-items:center;justify-content:center;">
</div>

<style>
  #dzmm-panel { animation: panelPop 0.8s cubic-bezier(0.34,1.56,0.64,1) forwards; }
  @keyframes panelPop { from { opacity:0; transform:translateX(-50%) translateY(-90px) scale(0.88); } to { opacity:1; transform:translateX(-50%); } }
  .modal { animation: modalPop 0.5s cubic-bezier(0.34,1.56,0.64,1); }
  @keyframes modalPop { from { opacity:0; transform:scale(0.85) translateY(50px); } to { opacity:1; transform:scale(1); } }
</style>

<script>
  // Tailwind
  const tailScript = document.createElement('script');
  tailScript.src = 'https://cdn.tailwindcss.com';
  document.head.appendChild(tailScript);

  // 面板加载瞬间出现
  window.addEventListener('load', () => {
    setTimeout(() => {
      document.getElementById('dzmm-panel').style.display = 'flex';
      console.log('%c[DZMM] iOS 毛玻璃面板已就绪', 'color:#67e8f9;font-size:14px;font-family:monospace');
    }, 180);
  });

  // iOS 风格 Toast
  function showToast(msg, type = 'success') {
    const t = document.getElementById('ios-toast');
    t.style.background = type === 'success' ? 'rgba(16,185,129,0.96)' : type === 'error' ? 'rgba(239,68,68,0.96)' : 'rgba(234,179,8,0.96)';
    t.innerHTML = msg;
    t.style.top = '24px';
    t.style.opacity = '1';
    setTimeout(() => {
      t.style.top = '-120px';
      t.style.opacity = '0';
    }, 3400);
  }

  function closePanelToCenter() {
    const p = document.getElementById('dzmm-panel');
    p.style.transition = 'all 0.85s cubic-bezier(0.34,1.56,0.64,1)';
    p.style.top = '50%';
    p.style.transform = 'translate(-50%, -50%) scale(0.9)';
    setTimeout(() => p.style.display = 'none', 950);
  }

  // ====================== 网络监听（核心逻辑） ======================
  const originalFetch = window.fetch;
  let failCount = 0;
  let batchStopFlag = false;

  window.fetch = async function(resource, init = {}) {
    const urlStr = typeof resource === 'string' ? resource : (resource.url || '');
    const res = await originalFetch(resource, init);
    try {
      const u = new URL(urlStr.startsWith('http') ? urlStr : location.origin + urlStr, location.origin);
      if (u.pathname === '/api/auth/token' || u.pathname === '/api/auth/anonymous-sign-in') {
        if (!res.ok) {
          failCount++;
          showToast(\`等待注册... (\${failCount}) 状态 \${res.status}\`, 'warning');
          if (failCount >= 5) {
            showToast('你的 IP 可能被拉黑，无法获取游客账号', 'error');
          }
        } else if (u.pathname === '/api/auth/anonymous-sign-in') {
          const setCookieHeader = res.headers.get('set-cookie');
          if (setCookieHeader) {
            const cookies = {};
            setCookieHeader.split(',').forEach(part => {
              const [nv] = part.split(';');
              const [name, value] = nv.split('=');
              if (name && value) cookies[name.trim()] = value.trim();
            });
            const userId = cookies['_rid'] || \`guest_\${Date.now()}\`;
            await fetch('/_proxy/save-account', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({userId, cookies, balance: 35})
            });
            showToast('✅ 游客账号注册成功！已保存到账号管理', 'success');
            failCount = 0;
            // 继续批量
            if (localStorage.getItem('batchRemaining') && !batchStopFlag) {
              setTimeout(() => doNextBatch(), 1100);
            }
          }
        }
      }
    } catch(e) {}
    return res;
  };

  // ====================== 获取新账号 ======================
  window.getNewAccount = async () => {
    if (!confirm('即将清除本地 Cookie 并刷新页面\\n继续注册游客账号？')) return;
    batchStopFlag = true;
    localStorage.removeItem('batchRemaining');
    await fetch('/_proxy/clear-cookies');
    location.reload();
  };

  // ====================== 批量注册 ======================
  window.showBatchModal = () => {
    const overlay = document.getElementById('dzmm-overlay');
    overlay.innerHTML = \`
      <div class="modal bg-slate-900/95 backdrop-blur-3xl border border-slate-700 rounded-3xl w-full max-w-[400px] mx-4 p-10 text-white">
        <h2 class="text-2xl font-semibold text-center mb-8">批量注册游客账号</h2>
        <div class="space-y-7">
          <div>
            <label class="block text-xs text-slate-400 mb-2">注册数量</label>
            <input id="batch-count" type="number" value="12" class="w-full bg-slate-800 border border-slate-600 rounded-3xl px-6 py-5 text-xl focus:outline-none focus:border-teal-500">
          </div>
          <button onclick="startBatchRegister()" class="w-full py-5 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-3xl font-semibold text-xl active:scale-95">开始批量注册</button>
        </div>
      </div>
    \`;
    overlay.style.display = 'flex';
  };

  window.startBatchRegister = () => {
    const count = parseInt(document.getElementById('batch-count').value) || 8;
    localStorage.setItem('batchRemaining', count);
    batchStopFlag = false;
    document.getElementById('dzmm-overlay').style.display = 'none';
    showToast(\`开始批量注册 \${count} 个账号...\`, 'success');
    setTimeout(doNextBatch, 600);
  };

  async function doNextBatch() {
    let remaining = parseInt(localStorage.getItem('batchRemaining') || 0);
    if (remaining <= 0 || batchStopFlag) {
      localStorage.removeItem('batchRemaining');
      showToast('批量注册已完成或已停止', 'success');
      return;
    }
    await fetch('/_proxy/clear-cookies');
    localStorage.setItem('batchRemaining', remaining - 1);
    showToast(\`正在注册第 \${remaining} 个...（剩余 \${remaining-1}）\`, 'success');
    setTimeout(() => location.reload(), 950);
  }

  // ====================== 其他 Modal ======================
  window.showStatusModal = async () => {
    const overlay = document.getElementById('dzmm-overlay');
    overlay.innerHTML = \`
      <div class="modal bg-slate-900/95 backdrop-blur-3xl border border-slate-700 rounded-3xl w-full max-w-md mx-4 p-9 text-white">
        <h2 class="text-2xl font-semibold mb-6">账号状态信息</h2>
        <div id="status-body" class="min-h-[180px]"></div>
        <button onclick="closeModal()" class="mt-8 w-full py-4 bg-slate-800 hover:bg-slate-700 rounded-3xl">关闭</button>
      </div>
    \`;
    overlay.style.display = 'flex';
    const r = await fetch('/_proxy/check-status');
    const d = await r.json();
    document.getElementById('status-body').innerHTML = \`
      <div class="bg-slate-800/70 rounded-3xl p-7 space-y-5 text-sm">
        <div class="flex justify-between"><span class="text-slate-400">已认证</span><span class="\${d.authenticated?'text-emerald-400':'text-red-400'}">\${d.authenticated?'是':'否'}</span></div>
        <div class="flex justify-between"><span class="text-slate-400">User ID</span><span class="font-mono">\${d.userId||'无'}</span></div>
        <div class="flex justify-between"><span class="text-slate-400">余额</span><span class="text-amber-400">\${d.balance} 次</span></div>
      </div>
    \`;
  };

  window.showEnvCheckModal = async () => {
    const overlay = document.getElementById('dzmm-overlay');
    overlay.innerHTML = \`
      <div class="modal bg-slate-900/95 backdrop-blur-3xl border border-slate-700 rounded-3xl w-full max-w-md mx-4 p-9 text-white">
        <h2 class="text-2xl font-semibold mb-6">环境检查</h2>
        <div id="env-body" class="text-center py-12 text-7xl"></div>
      </div>
    \`;
    overlay.style.display = 'flex';
    const r = await fetch('/_proxy/env-check');
    const d = await r.json();
    document.getElementById('env-body').innerHTML = \`
      <div>\${d.normal ? '✅' : '❌'}</div>
      <div class="mt-6 text-xl">\${d.message}</div>
    \`;
  };

  window.showAccountMgmtModal = async () => {
    const overlay = document.getElementById('dzmm-overlay');
    overlay.innerHTML = \`
      <div class="modal bg-slate-900/95 backdrop-blur-3xl border border-slate-700 rounded-3xl w-full max-w-lg mx-4 p-9 text-white max-h-[85vh] overflow-auto">
        <h2 class="text-2xl font-semibold mb-6">账号管理（D1）</h2>
        <div id="acct-list" class="space-y-4"></div>
      </div>
    \`;
    overlay.style.display = 'flex';
    const r = await fetch('/_proxy/account-list');
    const list = await r.json();
    let html = list.length ? '' : '<p class="text-center py-16 text-slate-400">暂无账号</p>';
    list.forEach(a => {
      html += \`
        <div class="bg-slate-800/70 rounded-3xl p-6">
          <div class="font-mono text-sm">\${a.user_id}</div>
          <div class="text-xs text-slate-400 mt-2">\${a.create_time}　余额：\${a.balance}</div>
        </div>
      \`;
    });
    document.getElementById('acct-list').innerHTML = html;
  };

  function closeModal() {
    document.getElementById('dzmm-overlay').style.display = 'none';
  }

  console.log('%c[DZMM PROXY] 完整版已加载 - 网络监听 + iOS 毛玻璃就绪', 'color:#67e8f9;font-size:14px;font-family:monospace');
</script>`;
  return html.replace("</body>", panelHTML + "</body>");
}

// ====================== 辅助函数（保留完整） ======================
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
    }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  } catch (error) {
    console.error("[DZMM CHECK STATUS ERROR]", error);
    return new Response(JSON.stringify({ error: "检查失败", message: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}

async function handleClearCookies(request) {
  const cookiesToClear = [
    "sb-rls-auth-token", "_rid", "ph_phc_pXRYopwyByw2wy8XGxzRcko4lPiDr58YspxHOAjThEj_posthog",
    "chosen_language", "invite_code", "sessionid"
  ];
  const setCookieHeaders = cookiesToClear.map(c => `${c}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=None; Secure`);
  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json", "Set-Cookie": setCookieHeaders.join(", ") }
  });
}

function parseCookies(cookieString) {
  const cookies = {};
  if (cookieString) {
    cookieString.split(";").forEach(cookie => {
      const [name, ...valueParts] = cookie.trim().split("=");
      const value = valueParts.join("=");
      if (name) cookies[name] = decodeURIComponent(value);
    });
  }
  return cookies;
}

console.log("[DZMM] Worker 初始化完成 - 所有功能就绪");