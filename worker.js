// Cloudflare Worker 代码 - 酒馆AI代理增强版
// jg.ilqx.dpdns.org -> https://www.xn--i8s951di30azba.com

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const targetUrl = "https://www.xn--i8s951di30azba.com";

    try {
      // 处理自定义接口
      if (url.pathname === '/_proxy/anonymous-sign-in') {
        return handleAnonymousSignIn(request, targetUrl);
      }
      if (url.pathname === '/_proxy/balance') {
        return handleBalance(request, targetUrl);
      }
      if (url.pathname === '/_proxy/clear-cookies') {
        return handleClearCookies(request);
      }
      if (url.pathname === '/_proxy/inject-cookie') {
        return handleInjectCookie(request);
      }

      // 普通代理请求
      return await handleProxyRequest(request, targetUrl, url);
    } catch (error) {
      return new Response(`代理错误: ${error.message}`, { status: 500 });
    }
  }
};

async function handleProxyRequest(request, targetUrl, url) {
  const targetHeaders = new Headers(request.headers);
  targetHeaders.delete('host');
  targetHeaders.set('origin', targetUrl);
  targetHeaders.set('referer', targetUrl + url.pathname);

  const targetRequest = new Request(targetUrl + url.pathname + url.search, {
    method: request.method,
    headers: targetHeaders,
    body: request.body,
    redirect: 'manual'
  });

  const response = await fetch(targetRequest);
  return processProxyResponse(response, request, url);
}

async function processProxyResponse(response, originalRequest, url) {
  const contentType = response.headers.get('content-type') || '';
  const newHeaders = new Headers(response.headers);

  // 跨域支持
  newHeaders.set('Access-Control-Allow-Origin', '*');
  newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  newHeaders.set('Access-Control-Allow-Headers', '*');
  newHeaders.set('Access-Control-Allow-Credentials', 'true');
  newHeaders.delete('content-security-policy');
  newHeaders.delete('content-security-policy-report-only');

  if (contentType.includes('text/html')) {
    try {
      const html = await response.text();
      const modifiedHtml = injectControlPanel(html, url);
      return new Response(modifiedHtml, {
        status: response.status,
        headers: newHeaders
      });
    } catch (error) {
      console.error('HTML注入失败:', error);
      return new Response(response.body, { status: response.status, headers: newHeaders });
    }
  }

  return new Response(response.body, { status: response.status, headers: newHeaders });
}

function injectControlPanel(html, url) {
  const panelCode = `
  <style>
    #jg-proxy-panel {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: rgba(0,0,0,0.9);
      color: white;
      padding: 15px;
      border-radius: 15px;
      z-index: 10000;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      width: 320px;
      max-width: 90vw;
      box-shadow: 0 8px 30px rgba(0,0,0,0.5);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255,255,255,0.2);
      transition: all 0.3s ease;
    }
    #jg-proxy-panel.minimized {
      width: auto;
      padding: 10px;
      background: rgba(0,0,0,0.7);
      cursor: pointer;
    }
    .jg-panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      font-weight: bold;
      color: #4CAF50;
    }
    .jg-panel-header span { font-size: 16px; }
    .jg-panel-header button {
      background: none;
      border: none;
      color: white;
      font-size: 18px;
      cursor: pointer;
      padding: 0 5px;
    }
    .jg-status {
      background: rgba(255,255,255,0.1);
      padding: 10px;
      border-radius: 10px;
      margin-bottom: 10px;
      text-align: center;
      min-height: 50px;
    }
    .jg-button {
      width: 100%;
      padding: 10px;
      margin: 5px 0;
      border: none;
      border-radius: 8px;
      font-weight: 500;
      cursor: pointer;
      transition: 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .jg-button.primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
    .jg-button.success { background: linear-gradient(135deg, #56ab2f 0%, #a8e063 100%); color: white; }
    .jg-button.danger { background: linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%); color: white; }
    .jg-button.info { background: linear-gradient(135deg, #2196F3 0%, #21CBF3 100%); color: white; }
    .jg-button:hover { transform: translateY(-2px); opacity: 0.9; }
    .jg-button-icon { font-size: 16px; }
    .jg-advanced {
      margin-top: 10px;
      display: none;
    }
    .jg-advanced textarea {
      width: 100%;
      height: 80px;
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.3);
      border-radius: 6px;
      color: white;
      padding: 8px;
      font-family: monospace;
      font-size: 12px;
      margin: 8px 0;
    }
    .jg-flex-row {
      display: flex;
      gap: 8px;
      margin: 8px 0;
    }
    .jg-flex-row button { flex: 1; }
    .jg-cookie-item {
      background: rgba(255,255,255,0.05);
      padding: 5px;
      border-radius: 4px;
      font-size: 11px;
      margin: 3px 0;
      word-break: break-all;
      display: flex;
      justify-content: space-between;
    }
    .jg-cookie-key { color: #4CAF50; font-weight: bold; }
    .jg-cookie-value { color: #BB86FC; max-width: 150px; overflow: hidden; text-overflow: ellipsis; }
    @media (max-width: 600px) {
      #jg-proxy-panel { width: 95vw; right: 2.5vw; bottom: 10px; }
    }
  </style>
  <div id="jg-proxy-panel">
    <div class="jg-panel-header">
      <span>🍺 酒馆AI代理</span>
      <button id="jg-toggle-panel">−</button>
    </div>
    <div id="jg-panel-content">
      <div class="jg-status" id="jg-status">检测中...</div>
      <button class="jg-button success" id="jg-get-account"><span class="jg-button-icon">🆕</span> 获取新游客账户</button>
      <button class="jg-button info" id="jg-check-status"><span class="jg-button-icon">📊</span> 检查账户状态</button>
      <button class="jg-button" id="jg-toggle-advanced"><span class="jg-button-icon">⚙️</span> 高级设置</button>
      <button class="jg-button danger" id="jg-clear-cookies"><span class="jg-button-icon">🗑️</span> 清除所有Cookie</button>
      <div class="jg-advanced" id="jg-advanced">
        <textarea id="jg-cookie-input" placeholder="粘贴Cookie字符串或JSON..."></textarea>
        <div class="jg-flex-row">
          <button class="jg-button info" id="jg-inject-cookie">💉 注入Cookie</button>
          <button class="jg-button info" id="jg-export-cookie">📋 导出Cookie</button>
        </div>
        <div id="jg-current-cookies"></div>
      </div>
    </div>
  </div>
  <script>
  (function() {
    let panel = document.getElementById('jg-proxy-panel');
    let content = document.getElementById('jg-panel-content');
    let toggleBtn = document.getElementById('jg-toggle-panel');
    let advancedDiv = document.getElementById('jg-advanced');
    let advancedVisible = false;

    toggleBtn.onclick = function() {
      if (content.style.display === 'none') {
        content.style.display = 'block';
        toggleBtn.textContent = '−';
        panel.classList.remove('minimized');
      } else {
        content.style.display = 'none';
        toggleBtn.textContent = '+';
        panel.classList.add('minimized');
      }
    };

    document.getElementById('jg-toggle-advanced').onclick = function() {
      advancedVisible = !advancedVisible;
      advancedDiv.style.display = advancedVisible ? 'block' : 'none';
      updateCurrentCookies();
    };

    function updateStatus(message, type = 'info') {
      const statusDiv = document.getElementById('jg-status');
      const colors = { info: '#2196F3', success: '#4CAF50', error: '#f44336', warning: '#ff9800' };
      statusDiv.innerHTML = \`<div style="color: \${colors[type]}">\${message}</div>\`;
    }

    function getAllCookies() {
      return document.cookie.split(';').reduce((cookies, cookie) => {
        const [name, ...val] = cookie.trim().split('=');
        if (name) cookies[name] = decodeURIComponent(val.join('='));
        return cookies;
      }, {});
    }

    function updateCurrentCookies() {
      const container = document.getElementById('jg-current-cookies');
      const cookies = getAllCookies();
      if (Object.keys(cookies).length === 0) {
        container.innerHTML = '<div style="text-align:center; opacity:0.7; padding:5px;">暂无Cookie</div>';
        return;
      }
      let html = '';
      Object.entries(cookies).forEach(([k, v]) => {
        html += \`<div class="jg-cookie-item"><span class="jg-cookie-key">\${k}</span><span class="jg-cookie-value" title="\${v}">\${v.substring(0,30)}...</span></div>\`;
      });
      container.innerHTML = html;
    }

    async function getNewAccount() {
      updateStatus('正在获取新游客账户...', 'info');
      try {
        // 收集简单指纹（可扩展）
        const fp = ${JSON.stringify(getDefaultFingerprint())}; // 从HAR提取的默认指纹
        const response = await fetch('/_proxy/anonymous-sign-in', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fp)
        });
        if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
        const result = await response.json();
        if (result.success) {
          updateStatus('✅ 获取成功！请手动刷新页面', 'success');
          setTimeout(() => { if(confirm('需要刷新页面以应用Cookie吗？')) location.reload(); }, 1000);
        } else {
          updateStatus('❌ 获取失败: ' + (result.message || '未知错误'), 'error');
        }
      } catch (e) {
        updateStatus('❌ 获取失败: ' + e.message, 'error');
      }
    }

    async function checkBalance() {
      updateStatus('查询余额中...', 'info');
      try {
        const r = await fetch('/_proxy/balance');
        const data = await r.json();
        if (data.success) {
          updateStatus(\`✅ 剩余: \${data.balance} 积分 | Turbo: \${data.turboRemaining}/50\`, 'success');
        } else {
          updateStatus('❌ 查询失败', 'error');
        }
      } catch (e) {
        updateStatus('❌ 查询失败: ' + e.message, 'error');
      }
    }

    async function clearCookies() {
      if (!confirm('确定清除所有Cookie吗？')) return;
      updateStatus('清除中...', 'info');
      try {
        const r = await fetch('/_proxy/clear-cookies', { method: 'POST' });
        if (r.ok) {
          // 同时清除js可删除的cookie
          document.cookie.split(';').forEach(c => {
            document.cookie = c.replace(/^ +/, '').replace(/=.*/, '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/');
          });
          updateStatus('✅ 已清除，请手动刷新', 'success');
          updateCurrentCookies();
        } else throw new Error();
      } catch (e) {
        updateStatus('❌ 清除失败', 'error');
      }
    }

    async function injectCookie() {
      const input = document.getElementById('jg-cookie-input').value.trim();
      if (!input) return alert('请输入Cookie内容');
      try {
        let cookies = {};
        if (input.startsWith('{')) cookies = JSON.parse(input);
        else {
          input.split(';').forEach(pair => {
            const [k, ...v] = pair.trim().split('=');
            if (k) cookies[k] = decodeURIComponent(v.join('='));
          });
        }
        const r = await fetch('/_proxy/inject-cookie', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cookies })
        });
        if (!r.ok) throw new Error();
        updateStatus('✅ 注入成功，请手动刷新', 'success');
        updateCurrentCookies();
      } catch (e) {
        updateStatus('❌ 注入失败', 'error');
      }
    }

    function exportCookies() {
      const cookies = getAllCookies();
      if (Object.keys(cookies).length === 0) return alert('无Cookie可导出');
      const text = JSON.stringify(cookies, null, 2);
      navigator.clipboard?.writeText(text).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      });
      alert('已复制到剪贴板');
    }

    document.getElementById('jg-get-account').onclick = getNewAccount;
    document.getElementById('jg-check-status').onclick = checkBalance;
    document.getElementById('jg-clear-cookies').onclick = clearCookies;
    document.getElementById('jg-inject-cookie').onclick = injectCookie;
    document.getElementById('jg-export-cookie').onclick = exportCookies;

    // 初始检查
    setTimeout(() => {
      const cookies = getAllCookies();
      if (cookies['sb-rls-auth-token'] && cookies['_rid']) {
        updateStatus(\`✅ 已登录 (ID: \${cookies['_rid'].substring(0,8)}...)\`, 'success');
      } else {
        updateStatus('🔄 未登录，点击获取新账户', 'warning');
      }
      updateCurrentCookies();
    }, 1000);
  })();
  </script>
  `;
  return html.replace('</body>', panelCode + '</body>');
}

// 返回默认指纹（从HAR文件中提取）
function getDefaultFingerprint() {
  return {
    "data": {
      "audio": {
        "sampleHash": 1169.1655874748158,
        "oscillator": "sine",
        "maxChannels": 1,
        "channelCountMode": "max"
      },
      "canvas": {
        "commonImageDataHash": "8965585f0983dad03f7382c986d7aee5"
      },
      "fonts": {
        "Arial": 340.3125,
        "Courier": 435.9375,
        "Courier New": 435.9375,
        "Helvetica": 340.3125,
        "Tahoma": 340.3125,
        "Verdana": 340.3125
      },
      "hardware": {
        "videocard": {
          "vendor": "WebKit",
          "renderer": "WebKit WebGL",
          "version": "WebGL 1.0 (OpenGL ES 2.0 Chromium)",
          "shadingLanguageVersion": "WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)"
        },
        "architecture": 127,
        "deviceMemory": "4",
        "jsHeapSizeLimit": 1130000000
      },
      "locales": {
        "languages": "zh-CN",
        "timezone": "Asia/Shanghai"
      },
      "permissions": {
        "accelerometer": "granted",
        "background-fetch": "denied",
        "background-sync": "denied",
        "camera": "prompt",
        "clipboard-read": "denied",
        "clipboard-write": "granted",
        "display-capture": "denied",
        "gyroscope": "granted",
        "geolocation": "prompt",
        "magnetometer": "granted",
        "microphone": "prompt",
        "midi": "granted",
        "nfc": "denied",
        "notifications": "denied",
        "payment-handler": "denied",
        "persistent-storage": "denied",
        "storage-access": "denied",
        "window-management": "denied"
      },
      "plugins": { "plugins": [] },
      "screen": {
        "is_touchscreen": true,
        "maxTouchPoints": 5,
        "colorDepth": 24,
        "mediaMatches": [
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
      "system": {
        "platform": "Linux aarch64",
        "cookieEnabled": true,
        "productSub": "20030107",
        "product": "Gecko",
        "useragent": "Mozilla/5.0 (Linux; Android 10; PBEM00 Build/QKQ1.190918.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.7681.2 Mobile Safari/537.36",
        "hardwareConcurrency": 8,
        "browser": { "name": "Chrome", "version": "147.0" },
        "applePayVersion": 0
      },
      "webgl": {
        "commonImageHash": "1d62a570a8e39a3cc4458b2efd47b6a2"
      },
      "math": {
        "acos": 1.0471975511965979,
        "asin": -9.614302481290016e-17,
        "atan": 4.578239276804769e-17,
        "cos": -4.854249971455313e-16,
        "cosh": 1.9468519159297506,
        "e": 2.718281828459045,
        "largeCos": 0.7639704044417283,
        "largeSin": -0.6452512852657808,
        "largeTan": -0.8446024630198843,
        "log": 6.907755278982137,
        "pi": 3.141592653589793,
        "sin": -1.9461946644816207e-16,
        "sinh": -0.6288121810679035,
        "sqrt": 1.4142135623730951,
        "tan": 6.980860926542689e-14,
        "tanh": -0.39008295789884684
      }
    },
    "hash": "77f81202fa12f86b7f77af693c55bf08"
  };
}

async function handleAnonymousSignIn(request, targetUrl) {
  try {
    const body = await request.json().catch(() => getDefaultFingerprint());
    const response = await fetch(targetUrl + '/api/auth/anonymous-sign-in', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': request.headers.get('User-Agent') || 'Mozilla/5.0',
        'Origin': targetUrl,
        'Referer': targetUrl
      },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    const newHeaders = new Headers({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true',
      'Content-Type': 'application/json'
    });
    // 转发 Set-Cookie
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) newHeaders.set('Set-Cookie', setCookie);
    return new Response(JSON.stringify({ success: true, data }), { status: 200, headers: newHeaders });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, message: error.message }), { status: 500 });
  }
}

async function handleBalance(request, targetUrl) {
  try {
    // 调用 /api/me 获取积分
    const cookie = request.headers.get('cookie') || '';
    const meRes = await fetch(targetUrl + '/api/me', { headers: { 'Cookie': cookie } });
    const meData = await meRes.json();
    // 调用配额接口获取剩余次数
    const quotaRes = await fetch(targetUrl + '/api/trpc/chat.getQuotas?input=%7B%22json%22%3Anull%2C%22meta%22%3A%7B%22values%22%3A%5B%22undefined%22%5D%2C%22v%22%3A1%7D%7D', { headers: { 'Cookie': cookie } });
    const quotaData = await quotaRes.json();
    const turboRemaining = quotaData?.result?.data?.json?.quotas?.turbo?.remaining || 0;
    return new Response(JSON.stringify({
      success: true,
      balance: meData.credit || 0,
      turboRemaining
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, message: error.message }), { status: 500 });
  }
}

async function handleClearCookies(request) {
  const cookiesToClear = ['sb-rls-auth-token', '_rid', 'ph_phc_pXRYopwyByw2wy8XGxzRcko4lPiDr58YspxHOAjThEj_posthog', 'chosen_language', 'invite_code'];
  const setCookie = cookiesToClear.map(name => `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; HttpOnly; SameSite=None`).join(', ');
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json', 'Set-Cookie': setCookie }
  });
}

async function handleInjectCookie(request) {
  try {
    const { cookies } = await request.json();
    if (!cookies || typeof cookies !== 'object') throw new Error('Invalid cookie object');
    const setCookie = Object.entries(cookies).map(([name, value]) =>
      `${name}=${encodeURIComponent(value)}; Path=/; Secure; HttpOnly; SameSite=None; Max-Age=31536000`
    ).join(', ');
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', 'Set-Cookie': setCookie }
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, message: error.message }), { status: 400 });
  }
}