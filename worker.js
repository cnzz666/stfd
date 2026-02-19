var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ==================== 完整 Cloudflare Worker（全新注册逻辑，无任何 code 提取） ====================
var worker_default = {
  async fetch(request, env, ctx) {
    // === 全局浏览器原生身份验证（所有路径生效）===
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Basic ")) {
      return new Response(
        `<h1 style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;text-align:center;padding:80px 20px;color:#fff;background:linear-gradient(135deg,#0f172a,#1e40af);margin:0;font-size:28px;">本网站要求进行身份验证</h1><p style="text-align:center;color:#e0f2fe;font-size:19px;margin-top:30px;line-height:1.6;">用户名：任意<br>密码：<strong style="font-size:22px;">1591156135qwzxcv</strong></p>`,
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

    try {
      if (url.pathname === "/_proxy/check-status") return handleCheckStatus(request, targetUrl);
      if (url.pathname === "/_proxy/clear-cookies") return handleClearCookies(request);
      if (url.pathname === "/_proxy/save-account") return await handleSaveAccount(request, env);
      if (url.pathname === "/_proxy/account-list") return await handleAccountList(env);
      if (url.pathname === "/_proxy/env-check") return await handleEnvCheck(request, targetUrl);

      // 全新注册逻辑：get-account 仅返回提示（实际注册由前端刷新 + 网络监听完成）
      if (url.pathname === "/_proxy/get-account") {
        return new Response(JSON.stringify({
          success: true,
          message: "请刷新页面，站点将自动注册游客账号",
          note: "网络监听已开启，成功后自动保存"
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      return await handleProxyRequest(request, targetUrl, url);
    } catch (error) {
      return new Response(`代理错误: ${error.message}`, { status: 500, headers: { "Content-Type": "text/plain" } });
    }
  }
};

// ==================== D1 数据库（自动建表） ====================
async function initDatabase(env) {
  if (!env.DB) return;
  await env.DB.exec(`
    CREATE TABLE IF NOT EXISTS account_manage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT UNIQUE NOT NULL,
      cookies TEXT,
      token TEXT,
      balance INTEGER DEFAULT 35,
      create_time TEXT,
      update_time TEXT,
      status TEXT DEFAULT 'active'
    )
  `);
}

async function handleSaveAccount(request, env) {
  await initDatabase(env);
  const body = await request.json();
  const now = new Date().toISOString();
  await env.DB.prepare(`
    INSERT OR REPLACE INTO account_manage 
    (user_id, cookies, token, balance, create_time, update_time)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    body.userId || "guest_" + Date.now(),
    JSON.stringify(body.cookies || {}),
    body.token || "",
    body.balance || 35,
    now,
    now
  ).run();
  return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
}

async function handleAccountList(env) {
  await initDatabase(env);
  const { results } = await env.DB.prepare("SELECT * FROM account_manage ORDER BY create_time DESC").all();
  return new Response(JSON.stringify(results || []), { headers: { "Content-Type": "application/json" } });
}

async function handleEnvCheck(request, targetUrl) {
  try {
    const cookie = request.headers.get("cookie") || "";
    const tokenRes = await fetch(targetUrl + "/api/auth/token", { headers: { Cookie: cookie } });
    const signRes = await fetch(targetUrl + "/api/auth/anonymous-sign-in", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: "{}"
    });
    const tokenStatus = tokenRes.status;
    const signStatus = signRes.status;
    const normal = tokenStatus === 200 || tokenStatus === 401 || signStatus === 200;
    let message = normal ? "✅ 环境正常（可注册游客账号）" : `❌ 环境异常 token:${tokenStatus} sign-in:${signStatus}`;
    return new Response(JSON.stringify({ normal, tokenStatus, signStatus, message }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ normal: false, message: e.message }), { headers: { "Content-Type": "application/json" } });
  }
}

// ==================== 原有代理核心（完全保留） ====================
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
  if (contentType.includes("text/html")) {
    try {
      const html = await response.clone().text();
      const modifiedHtml = injectControlPanel(html, url);
      const newHeaders = new Headers(response.headers);
      newHeaders.set("Content-Type", "text/html; charset=utf-8");
      return new Response(modifiedHtml, { status: response.status, headers: newHeaders });
    } catch (e) {
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
__name(processProxyResponse, "processProxyResponse");

// ==================== iOS 消息风格毛玻璃面板（网页加载即出现 + 网络监听） ====================
function injectControlPanel(html, url) {
  const panelHTML = `
<div id="dzmm-panel" style="position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:2147483647;background:rgba(15,23,42,0.92);backdrop-filter:blur(40px);-webkit-backdrop-filter:blur(40px);border:1px solid rgba(148,163,184,0.25);border-radius:26px;padding:14px 22px;box-shadow:0 30px 60px -15px rgba(0,0,0,0.6);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#f1f5f9;display:none;align-items:center;gap:14px;width:92%;max-width:420px;transition:all 0.6s cubic-bezier(0.32,0.72,0,1);">
  <div style="background:rgba(255,255,255,0.12);padding:7px 18px;border-radius:9999px;font-size:13px;font-weight:600;letter-spacing:0.6px;white-space:nowrap;">DZMM PROXY</div>
  <button onclick="showStatusModal()" class="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-3xl text-sm font-medium transition-all active:scale-[0.96]">状态信息</button>
  <button onclick="getNewAccount()" class="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-3xl text-sm font-medium transition-all active:scale-[0.96]">获取新账号</button>
  <button onclick="showBatchModal()" class="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-3xl text-sm font-medium transition-all active:scale-[0.96]">批量注册</button>
  <button onclick="showEnvCheckModal()" class="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-3xl text-sm font-medium transition-all active:scale-[0.96]">环境检查</button>
  <button onclick="showAccountMgmtModal()" class="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-3xl text-sm font-medium transition-all active:scale-[0.96]">账号管理</button>
  <button onclick="closePanelToCenter()" class="ml-auto px-6 py-3 bg-red-500/90 hover:bg-red-600 rounded-3xl text-sm font-medium transition-all active:scale-[0.96]">关闭</button>
</div>

<!-- iOS 风格通知横幅 -->
<div id="ios-toast" style="position:fixed;top:-100px;left:50%;transform:translateX(-50%);z-index:2147483647;background:rgba(15,23,42,0.95);backdrop-filter:blur(30px);-webkit-backdrop-filter:blur(30px);border-radius:18px;padding:16px 24px;box-shadow:0 20px 40px -10px rgba(0,0,0,0.5);color:#f1f5f9;font-size:15px;max-width:380px;transition:all 0.5s cubic-bezier(0.32,0.72,0,1);display:flex;align-items:center;gap:12px;opacity:0;"></div>

<div id="dzmm-overlay" style="display:none;position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,0.65);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);align-items:center;justify-content:center;">
</div>

<style>
  #dzmm-panel { animation: panelPop 0.7s cubic-bezier(0.32,0.72,0,1) forwards; }
  @keyframes panelPop { from { opacity:0; transform:translateX(-50%) translateY(-80px) scale(0.92); } to { opacity:1; transform:translateX(-50%); } }
  .modal-card { animation: modalPop 0.45s cubic-bezier(0.32,0.72,0,1); }
  @keyframes modalPop { from { opacity:0; transform:scale(0.88) translateY(40px); } to { opacity:1; transform:scale(1); } }
  button { transition: transform 0.2s cubic-bezier(0.32,0.72,0,1); }
</style>

<script>
  // Tailwind + iOS 风格
  const tail = document.createElement('script');
  tail.src = 'https://cdn.tailwindcss.com';
  document.head.appendChild(tail);

  // 面板加载即出现（比原 3.5s 更快）
  window.addEventListener('load', () => {
    setTimeout(() => {
      document.getElementById('dzmm-panel').style.display = 'flex';
    }, 420);
  });

  // iOS 风格通知
  function showToast(msg, type = 'success') {
    const toast = document.getElementById('ios-toast');
    toast.style.background = type === 'success' ? 'rgba(16,185,129,0.95)' : type === 'error' ? 'rgba(239,68,68,0.95)' : 'rgba(234,179,8,0.95)';
    toast.innerHTML = \`<span>\${msg}</span>\`;
    toast.style.top = '22px';
    toast.style.opacity = '1';
    setTimeout(() => {
      toast.style.top = '-100px';
      toast.style.opacity = '0';
    }, 3200);
  }

  function closePanelToCenter() {
    const p = document.getElementById('dzmm-panel');
    p.style.transition = 'all 0.75s cubic-bezier(0.32,0.72,0,1)';
    p.style.top = '50%';
    p.style.transform = 'translate(-50%, -50%) scale(0.92)';
    setTimeout(() => p.style.display = 'none', 900);
  }

  // ==================== 网络监听（核心：捕获注册 Cookie） ====================
  const originalFetch = window.fetch;
  let failCount = 0;
  window.fetch = async function(resource, init = {}) {
    const urlStr = typeof resource === 'string' ? resource : (resource.url || '');
    const res = await originalFetch(resource, init);
    try {
      const u = new URL(urlStr.startsWith('http') ? urlStr : location.origin + urlStr, location.origin);
      if (u.pathname === '/api/auth/token' || u.pathname === '/api/auth/anonymous-sign-in') {
        if (!res.ok) {
          failCount++;
          showToast(\`等待注册... (\${failCount}) 状态 \${res.status}\`, 'warning');
          if (failCount >= 4) {
            showToast('你的 IP 可能被拉黑，无法获取游客账号', 'error');
          }
        } else if (u.pathname === '/api/auth/anonymous-sign-in') {
          const setCookieStr = res.headers.get('set-cookie');
          if (setCookieStr) {
            const cookiesObj = {};
            setCookieStr.split(',').forEach(str => {
              const [part] = str.split(';');
              const [name, value] = part.split('=');
              if (name && value) cookiesObj[name.trim()] = value.trim();
            });
            const userId = cookiesObj['_rid'] || 'guest_' + Date.now();
            await fetch('/_proxy/save-account', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId, cookies: cookiesObj, balance: 35 })
            });
            showToast('✅ 游客账号注册成功！已自动保存', 'success');
            failCount = 0;
            // 批量模式自动继续
            if (localStorage.getItem('batchRemaining')) {
              setTimeout(doNextBatch, 1200);
            }
          }
        }
      }
    } catch(e) {}
    return res;
  };

  // ==================== 获取新账号（清 Cookie + 刷新） ====================
  window.getNewAccount = async () => {
    if (!confirm('即将清除本地 Cookie 并刷新页面进行游客账号注册\\n\\n继续吗？')) return;
    await fetch('/_proxy/clear-cookies');
    localStorage.removeItem('batchRemaining');
    location.reload();
  };

  // ==================== 批量注册（iOS 风格） ====================
  window.showBatchModal = () => {
    const overlay = document.getElementById('dzmm-overlay');
    overlay.innerHTML = \`
      <div class="modal-card bg-slate-900/95 backdrop-blur-3xl border border-slate-700 rounded-3xl w-full max-w-[380px] mx-4 p-8 text-white shadow-2xl">
        <h2 class="text-2xl font-semibold mb-8 text-center">批量注册游客账号</h2>
        <div class="space-y-6">
          <div>
            <label class="text-xs text-slate-400 block mb-2">注册数量</label>
            <input id="batch-count" type="number" value="8" class="w-full bg-slate-800 border border-slate-600 rounded-2xl px-6 py-4 text-lg focus:outline-none focus:border-emerald-500">
          </div>
          <button onclick="startBatch()" class="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-3xl font-semibold text-lg active:scale-95">开始批量注册</button>
        </div>
        <div id="batch-info" class="hidden mt-6 text-center text-sm text-slate-400"></div>
      </div>
    \`;
    overlay.style.display = 'flex';
  };

  window.startBatch = () => {
    const count = parseInt(document.getElementById('batch-count').value) || 5;
    localStorage.setItem('batchRemaining', count);
    document.getElementById('dzmm-overlay').style.display = 'none';
    showToast(\`开始批量注册 \${count} 个账号...\`, 'success');
    setTimeout(doNextBatch, 800);
  };

  async function doNextBatch() {
    let remaining = parseInt(localStorage.getItem('batchRemaining') || 0);
    if (remaining <= 0) {
      localStorage.removeItem('batchRemaining');
      showToast('批量注册全部完成！', 'success');
      return;
    }
    await fetch('/_proxy/clear-cookies');
    localStorage.setItem('batchRemaining', remaining - 1);
    showToast(\`正在注册第 \${remaining} 个...（剩余 \${remaining-1}）\`, 'success');
    setTimeout(() => location.reload(), 900);
  }

  // ==================== 其他 Modal（iOS 卡片风格） ====================
  window.showStatusModal = async () => {
    const overlay = document.getElementById('dzmm-overlay');
    overlay.innerHTML = \`
      <div class="modal-card bg-slate-900/95 backdrop-blur-3xl border border-slate-700 rounded-3xl w-full max-w-md mx-4 p-8 text-white">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-2xl font-semibold">账号状态</h2>
          <button onclick="closeModal()" class="text-4xl leading-none text-slate-400">×</button>
        </div>
        <div id="status-body" class="min-h-[160px]"></div>
      </div>
    \`;
    overlay.style.display = 'flex';
    const r = await fetch('/_proxy/check-status');
    const d = await r.json();
    document.getElementById('status-body').innerHTML = \`
      <div class="bg-slate-800/80 rounded-3xl p-6 space-y-4 text-sm">
        <div class="flex justify-between"><span class="text-slate-400">已认证</span><span class="\${d.authenticated ? 'text-emerald-400' : 'text-rose-400'}">\${d.authenticated ? '是' : '否'}</span></div>
        <div class="flex justify-between"><span class="text-slate-400">UserID</span><span class="font-mono">\${d.userId || '无'}</span></div>
        <div class="flex justify-between"><span class="text-slate-400">余额</span><span class="text-amber-400 font-semibold">\${d.balance} 次</span></div>
      </div>
    \`;
  };

  window.showEnvCheckModal = async () => {
    const overlay = document.getElementById('dzmm-overlay');
    overlay.innerHTML = \`
      <div class="modal-card bg-slate-900/95 backdrop-blur-3xl border border-slate-700 rounded-3xl w-full max-w-md mx-4 p-8 text-white">
        <h2 class="text-2xl font-semibold mb-6">环境检查</h2>
        <div id="env-body" class="text-center py-10 text-6xl"></div>
      </div>
    \`;
    overlay.style.display = 'flex';
    const r = await fetch('/_proxy/env-check');
    const d = await r.json();
    document.getElementById('env-body').innerHTML = \`
      <div>\${d.normal ? '✅' : '❌'}</div>
      <div class="text-xl mt-4">\${d.message}</div>
    \`;
  };

  window.showAccountMgmtModal = async () => {
    const overlay = document.getElementById('dzmm-overlay');
    overlay.innerHTML = \`
      <div class="modal-card bg-slate-900/95 backdrop-blur-3xl border border-slate-700 rounded-3xl w-full max-w-lg mx-4 p-8 text-white max-h-[82vh] overflow-auto">
        <h2 class="text-2xl font-semibold mb-6 sticky top-0 bg-slate-900/95 py-3">账号管理（D1）</h2>
        <div id="acct-list" class="space-y-4"></div>
      </div>
    \`;
    overlay.style.display = 'flex';
    const r = await fetch('/_proxy/account-list');
    const list = await r.json();
    let html = list.length ? '' : '<p class="text-center py-12 text-slate-400">暂无保存的账号</p>';
    list.forEach(a => {
      html += \`
        <div class="bg-slate-800/70 rounded-3xl p-5">
          <div class="font-mono text-sm break-all">\${a.user_id}</div>
          <div class="text-xs text-slate-400 mt-1">\${new Date(a.create_time).toLocaleString()}　余额：\${a.balance}</div>
        </div>
      \`;
    });
    document.getElementById('acct-list').innerHTML = html;
  };

  function closeModal() {
    document.getElementById('dzmm-overlay').style.display = 'none';
  }

  console.log('%cDZMM PROXY iOS 消息风格面板已就绪 - 网络监听开启', 'color:#67e8f9;font-family:monospace;font-size:13px');
</script>`;
  return html.replace("</body>", panelHTML + "</body>");
}
__name(injectControlPanel, "injectControlPanel");

// ==================== 其余原函数（保留） ====================
async function handleCheckStatus(request, targetUrl) {
  try {
    const clientCookies = parseCookies(request.headers.get("cookie") || "");
    const hasAuth = "sb-rls-auth-token" in clientCookies;
    let balance = 0;
    if (hasAuth) {
      const meResponse = await fetch(targetUrl + "/api/me", { headers: { "Cookie": request.headers.get("cookie") || "" } });
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
    return new Response(JSON.stringify({ error: "检查失败", message: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
__name(handleCheckStatus, "handleCheckStatus");

async function handleClearCookies(request) {
  const cookiesToClear = ["sb-rls-auth-token", "_rid", "ph_phc_pXRYopwyByw2wy8XGxzRcko4lPiDr58YspxHOAjThEj_posthog", "chosen_language", "invite_code", "sessionid"];
  const setCookieHeaders = cookiesToClear.map(c => `${c}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=None; Secure`);
  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json", "Set-Cookie": setCookieHeaders.join(", ") }
  });
}
__name(handleClearCookies, "handleClearCookies");

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
__name(parseCookies, "parseCookies");
