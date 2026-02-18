// Cloudflare Worker 完整代码 - 酒馆AI无限制代理
// 绑定域名：jg.ilqx.dpdns.org -> https://www.xn--i8s951di30azba.com

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const targetUrl = "https://www.xn--i8s951di30azba.com";

    try {
      // 处理自定义接口
      if (url.pathname === '/_proxy/get-account') {
        return handleGetAccount(request, targetUrl);
      }
      if (url.pathname === '/_proxy/check-status') {
        return handleCheckStatus(request, targetUrl);
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
      return new Response(`代理错误: ${error.message}`, {
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
  }
};

// ---------- 代理请求处理 ----------
async function handleProxyRequest(request, targetUrl, url) {
  const targetHeaders = new Headers(request.headers);
  targetHeaders.delete('host');
  targetHeaders.delete('origin');
  targetHeaders.delete('referer');
  targetHeaders.set('origin', targetUrl);
  targetHeaders.set('referer', targetUrl + url.pathname);

  const targetRequest = new Request(targetUrl + url.pathname + url.search, {
    method: request.method,
    headers: targetHeaders,
    body: request.body,
    redirect: 'manual'
  });

  const response = await fetch(targetRequest);
  return await processProxyResponse(response, request, url);
}

async function processProxyResponse(response, originalRequest, url) {
  const contentType = response.headers.get('content-type') || '';
  const clonedResponse = response.clone();

  if (contentType.includes('text/html')) {
    try {
      const html = await clonedResponse.text();
      const modifiedHtml = injectControlPanel(html, url);

      const newHeaders = new Headers(response.headers);
      newHeaders.set('Content-Type', 'text/html; charset=utf-8');

      return new Response(modifiedHtml, {
        status: response.status,
        headers: newHeaders
      });
    } catch (error) {
      console.error('HTML注入失败:', error);
      return response;
    }
  }

  const newHeaders = new Headers(response.headers);
  newHeaders.set('Access-Control-Allow-Origin', '*');
  newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  newHeaders.set('Access-Control-Allow-Headers', '*');
  newHeaders.set('Access-Control-Allow-Credentials', 'true');
  newHeaders.delete('content-security-policy');
  newHeaders.delete('content-security-policy-report-only');

  return new Response(response.body, {
    status: response.status,
    headers: newHeaders
  });
}

// ---------- 控制面板注入 ----------
function injectControlPanel(html, url) {
  const panelHTML = `
  <style>
    #jg-proxy-panel-container {
      position: fixed;
      bottom: 10px;
      right: 10px;
      z-index: 10000;
      font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      width: 320px;
      max-width: calc(100vw - 20px);
      transition: transform 0.3s ease, opacity 0.3s ease;
      pointer-events: auto;
    }
    #jg-proxy-panel {
      background: rgba(28, 28, 30, 0.95);
      backdrop-filter: blur(12px);
      color: white;
      border-radius: 16px;
      padding: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.15);
      width: 100%;
      transition: all 0.2s;
    }
    #jg-proxy-panel.minimized {
      transform: scale(0.8);
      opacity: 0.7;
      cursor: pointer;
      width: auto;
      display: inline-block;
      padding: 8px 12px;
    }
    #jg-proxy-panel.minimized .panel-content {
      display: none;
    }
    #jg-proxy-panel.minimized:hover {
      opacity: 1;
      transform: scale(0.85);
    }
    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .panel-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #4CAF50;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .panel-header h3:before {
      content: '🍺';
      font-size: 18px;
    }
    .toggle-btn {
      background: none;
      border: none;
      color: #aaa;
      font-size: 20px;
      cursor: pointer;
      padding: 0 5px;
      transition: color 0.2s;
    }
    .toggle-btn:hover {
      color: white;
    }
    .status-area {
      background: rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      padding: 10px;
      margin-bottom: 12px;
      font-size: 13px;
      line-height: 1.4;
      min-height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
    }
    .btn-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin: 8px 0;
    }
    .jg-btn {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: none;
      color: white;
      padding: 10px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 500;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      cursor: pointer;
      transition: 0.2s;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .jg-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102,126,234,0.4);
    }
    .jg-btn.danger {
      background: linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%);
    }
    .jg-btn.success {
      background: linear-gradient(135deg, #56ab2f 0%, #a8e063 100%);
    }
    .jg-btn.info {
      background: linear-gradient(135deg, #2196F3 0%, #21CBF3 100%);
    }
    .advanced-section {
      margin-top: 10px;
      border-top: 1px solid rgba(255,255,255,0.2);
      padding-top: 10px;
    }
    #jg-cookie-input {
      width: 100%;
      padding: 8px;
      margin: 8px 0;
      background: rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 8px;
      color: white;
      font-size: 12px;
      font-family: monospace;
      resize: vertical;
    }
    .cookie-list {
      max-height: 150px;
      overflow-y: auto;
      background: rgba(0,0,0,0.2);
      border-radius: 8px;
      padding: 5px;
      font-size: 11px;
      margin-top: 5px;
    }
    .cookie-item {
      display: flex;
      justify-content: space-between;
      padding: 4px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      word-break: break-all;
      cursor: pointer;
    }
    .cookie-item:hover {
      background: rgba(255,255,255,0.1);
    }
    .cookie-key {
      color: #4CAF50;
      font-weight: bold;
    }
    .cookie-value {
      color: #BB86FC;
      max-width: 150px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .flex-row {
      display: flex;
      gap: 5px;
    }
    .small-btn {
      padding: 5px 8px;
      font-size: 11px;
      background: rgba(255,255,255,0.15);
      border-radius: 5px;
    }
    @media (max-width: 480px) {
      #jg-proxy-panel-container {
        width: 280px;
      }
      .btn-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
  <div id="jg-proxy-panel-container">
    <div id="jg-proxy-panel">
      <div class="panel-header">
        <h3>酒馆AI代理面板</h3>
        <button class="toggle-btn" id="jg-panel-toggle">🗕</button>
      </div>
      <div class="panel-content">
        <div class="status-area" id="jg-proxy-status">加载中...</div>
        <div class="btn-grid">
          <button class="jg-btn success" onclick="getNewGuestAccount()">
            <span>🆕</span> 新游客账户
          </button>
          <button class="jg-btn info" onclick="checkCurrentStatus()">
            <span>📊</span> 检查状态
          </button>
        </div>
        <div class="btn-grid">
          <button class="jg-btn" onclick="toggleAdvanced()">
            <span>⚙️</span> 高级设置
          </button>
          <button class="jg-btn danger" onclick="clearAllCookiesConfirm()">
            <span>🗑️</span> 清除所有
          </button>
        </div>
        <div id="jg-advanced" style="display: none;" class="advanced-section">
          <textarea id="jg-cookie-input" rows="3" placeholder="粘贴Cookie字符串或JSON..."></textarea>
          <div class="flex-row" style="gap:5px; margin:5px 0;">
            <button class="jg-btn small-btn" onclick="injectCustomCookie()">💉 注入</button>
            <button class="jg-btn small-btn info" onclick="exportCookies()">📋 导出</button>
          </div>
          <div id="jg-current-cookies" class="cookie-list">暂无Cookie</div>
        </div>
      </div>
    </div>
  </div>
  <script>
  (function(){
    let advancedVisible = false;
    let panelMinimized = false;
    const panel = document.getElementById('jg-proxy-panel');
    const toggleBtn = document.getElementById('jg-panel-toggle');

    toggleBtn.addEventListener('click', function(e){
      e.stopPropagation();
      panel.classList.toggle('minimized');
      panelMinimized = panel.classList.contains('minimized');
      toggleBtn.textContent = panelMinimized ? '🗖' : '🗕';
    });

    function updateStatus(message, type = 'info') {
      const statusDiv = document.getElementById('jg-proxy-status');
      const colors = { 'info': '#2196F3', 'success': '#4CAF50', 'error': '#f44336', 'warning': '#ff9800' };
      statusDiv.innerHTML = \`<div style="color: \${colors[type]};">\${message}</div>\`;
    }

    function getAllCookies() {
      const cookies = document.cookie.split(';');
      const result = {};
      cookies.forEach(c => {
        const [n, ...v] = c.trim().split('=');
        if (n) result[n] = decodeURIComponent(v.join('='));
      });
      return result;
    }

    function updateCurrentCookies() {
      const container = document.getElementById('jg-current-cookies');
      const cookies = getAllCookies();
      if (!Object.keys(cookies).length) {
        container.innerHTML = '<div style="text-align:center;opacity:0.7;">暂无Cookie</div>';
        return;
      }
      let html = '';
      Object.entries(cookies).forEach(([key, val]) => {
        html += \`
          <div class="cookie-item" onclick="copyText('\${key}=\${val}')" title="点击复制">
            <span class="cookie-key">\${key}</span>
            <span class="cookie-value">\${val.substring(0,20)}...</span>
          </div>
        \`;
      });
      container.innerHTML = html;
    }

    window.copyText = (text) => {
      navigator.clipboard.writeText(text).then(() => {
        updateStatus('✅ 已复制到剪贴板', 'success');
      });
    };

    async function getNewGuestAccount() {
      updateStatus('正在获取游客账户...', 'info');
      try {
        const resp = await fetch('/_proxy/get-account', { method: 'POST' });
        const result = await resp.json();
        if (result.success && result.cookies) {
          Object.entries(result.cookies).forEach(([n, v]) => {
            const date = new Date(Date.now() + 365*24*60*60*1000).toUTCString();
            document.cookie = \`\${n}=\${encodeURIComponent(v)}; expires=\${date}; path=/; domain=\${location.hostname}; secure; samesite=none\`;
          });
          updateStatus('✅ 游客账户获取成功！正在刷新...', 'success');
          updateCurrentCookies();
          setTimeout(() => location.reload(), 1500);
        } else {
          updateStatus('❌ 失败: ' + (result.message || '未知错误'), 'error');
        }
      } catch(e) {
        updateStatus('❌ 获取失败: ' + e.message, 'error');
      }
    }

    async function checkCurrentStatus() {
      updateStatus('检查中...', 'info');
      try {
        const resp = await fetch('/_proxy/check-status');
        const result = await resp.json();
        if (result.authenticated) {
          updateStatus(\`✅ 已登录<br>账号: \${result.userId.substring(0,8)}...<br>余额: \${result.balance}次\`, 'success');
        } else {
          updateStatus('❌ 未登录，请获取新账户', 'warning');
        }
        updateCurrentCookies();
      } catch(e) {
        updateStatus('❌ 检查失败: ' + e.message, 'error');
      }
    }

    async function clearAllCookiesConfirm() {
      if (!confirm('确定清除所有Cookie？')) return;
      try {
        const resp = await fetch('/_proxy/clear-cookies', { method: 'POST' });
        if (resp.ok) {
          ['sb-rls-auth-token','_rid','ph_phc_pXRYopwyByw2wy8XGxzRcko4lPiDr58YspxHOAjThEj_posthog','chosen_language','invite_code'].forEach(n => {
            document.cookie = \`\${n}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/\`;
          });
          updateStatus('✅ 已清除', 'success');
          updateCurrentCookies();
          setTimeout(() => location.reload(), 2000);
        } else {
          updateStatus('❌ 清除失败', 'error');
        }
      } catch(e) {
        updateStatus('❌ 清除失败: ' + e.message, 'error');
      }
    }

    function injectCustomCookie() {
      const input = document.getElementById('jg-cookie-input').value.trim();
      if (!input) return alert('请输入Cookie');
      try {
        let cookiesToSet = {};
        if (input.startsWith('{')) {
          cookiesToSet = JSON.parse(input);
        } else {
          input.split(';').forEach(part => {
            const [n, ...v] = part.trim().split('=');
            if (n && v.length) cookiesToSet[n] = v.join('=');
          });
        }
        if (!Object.keys(cookiesToSet).length) throw new Error('无有效cookie');
        const date = new Date(Date.now() + 365*24*60*60*1000).toUTCString();
        Object.entries(cookiesToSet).forEach(([n, v]) => {
          document.cookie = \`\${n}=\${encodeURIComponent(v)}; expires=\${date}; path=/; domain=\${location.hostname}; secure; samesite=none\`;
        });
        updateStatus('✅ 已注入 ' + Object.keys(cookiesToSet).length + ' 条', 'success');
        updateCurrentCookies();
        setTimeout(() => location.reload(), 2000);
      } catch(e) {
        alert('注入失败: ' + e.message);
      }
    }

    function exportCookies() {
      const cookies = getAllCookies();
      if (!Object.keys(cookies).length) return alert('无cookie可导出');
      const text = JSON.stringify(cookies, null, 2);
      navigator.clipboard.writeText(text).then(() => {
        updateStatus('✅ 已复制到剪贴板', 'success');
      });
    }

    function toggleAdvanced() {
      const adv = document.getElementById('jg-advanced');
      advancedVisible = !advancedVisible;
      adv.style.display = advancedVisible ? 'block' : 'none';
      if (advancedVisible) updateCurrentCookies();
    }

    window.getNewGuestAccount = getNewGuestAccount;
    window.checkCurrentStatus = checkCurrentStatus;
    window.clearAllCookiesConfirm = clearAllCookiesConfirm;
    window.injectCustomCookie = injectCustomCookie;
    window.exportCookies = exportCookies;
    window.toggleAdvanced = toggleAdvanced;

    setTimeout(() => checkCurrentStatus(), 1000);
  })();
  </script>
  `;
  return html.replace('</body>', panelHTML + '</body>');
}

// ---------- 获取新游客账户 ----------
async function handleGetAccount(request, targetUrl) {
  try {
    // 从客户端请求中获取 Cookie，提取 ph_phc_... (用户指纹)
    const clientCookies = parseCookies(request.headers.get('cookie') || '');
    const phCookie = clientCookies['ph_phc_pXRYopwyByw2wy8XGxzRcko4lPiDr58YspxHOAjThEj_posthog'];

    // 生成随机用户 ID 和邮箱
    const userId = generateUUID();
    const email = `${userId}@anon.com`;

    // 从HAR文件中提取的固定 code（可能无效，仅作尝试）
    const fixedCode = "VUZraitCbnJSZTZBZmJvTEhoY2YrTmt3eWpVamljVGYzY1JIbEEzOEhFRDBUWjk0U2pWYllsSGxhL3EyczVDNndONDMzd3g3K09PaHd5RTcxdmdlRVhoY1BVTEZvUkVvaG5IUUt3RWNJYlhaV0g3Y2VkNEM2YXpQbVlXNmt1VTZ5SEMrOUdvdA==";

    // 构建指纹对象 (与HAR文件一致)
    const fp = {
      data: {
        audio: { sampleHash: 1169.1655874748158, oscillator: "sine", maxChannels: 1, channelCountMode: "max" },
        canvas: { commonImageDataHash: "8965585f0983dad03f7382c986d7aee5" },
        fonts: { Arial: 340.3125, Courier: 435.9375, "Courier New": 435.9375, Helvetica: 340.3125, Tahoma: 340.3125, Verdana: 340.3125 },
        hardware: {
          videocard: { vendor: "WebKit", renderer: "WebKit WebGL", version: "WebGL 1.0 (OpenGL ES 2.0 Chromium)", shadingLanguageVersion: "WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)" },
          architecture: 127, deviceMemory: "4", jsHeapSizeLimit: 1130000000
        },
        locales: { languages: "zh-CN", timezone: "Asia/Shanghai" },
        permissions: {
          accelerometer: "granted", "background-fetch": "denied", "background-sync": "denied",
          camera: "prompt", "clipboard-read": "denied", "clipboard-write": "granted",
          "display-capture": "denied", gyroscope: "granted", geolocation: "prompt",
          magnetometer: "granted", microphone: "prompt", midi: "granted", nfc: "denied",
          notifications: "denied", "payment-handler": "denied", "persistent-storage": "denied",
          "storage-access": "denied", "window-management": "denied"
        },
        plugins: { plugins: [] },
        screen: {
          is_touchscreen: true, maxTouchPoints: 5, colorDepth: 24,
          mediaMatches: [
            "prefers-contrast: no-preference", "any-hover: none", "any-pointer: coarse",
            "pointer: coarse", "hover: none", "update: fast", "prefers-reduced-motion: no-preference",
            "prefers-reduced-transparency: no-preference", "scripting: enabled", "forced-colors: none"
          ]
        },
        system: {
          platform: "Linux aarch64", cookieEnabled: true, productSub: "20030107", product: "Gecko",
          useragent: request.headers.get('user-agent') || "Mozilla/5.0 (Linux; Android 10; PBEM00 Build/QKQ1.190918.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.7681.2 Mobile Safari/537.36",
          hardwareConcurrency: 8,
          browser: { name: "Chrome", version: "147.0" },
          applePayVersion: 0
        },
        webgl: { commonImageHash: "1d62a570a8e39a3cc4458b2efd47b6a2" },
        math: {
          acos: 1.0471975511965979, asin: -9.614302481290016e-17, atan: 4.578239276804769e-17,
          cos: -4.854249971455313e-16, cosh: 1.9468519159297506, e: 2.718281828459045,
          largeCos: 0.7639704044417283, largeSin: -0.6452512852657808, largeTan: -0.8446024630198843,
          log: 6.907755278982137, pi: 3.141592653589793, sin: -1.9461946644816207e-16,
          sinh: -0.6288121810679035, sqrt: 1.4142135623730951, tan: 6.980860926542689e-14,
          tanh: -0.39008295789884684
        }
      },
      hash: "77f81202fa12f86b7f77af693c55bf08"
    };

    const requestBody = {
      code: fixedCode,
      id: userId,
      email: email,
      fp: fp
    };

    // 生成随机 x-dzmm-request-id
    const requestId = Math.random().toString(36).substring(2, 10);

    // 构建请求头
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': request.headers.get('user-agent') || 'Mozilla/5.0 (Linux; Android 10; PBEM00 Build/QKQ1.190918.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.7681.2 Mobile Safari/537.36',
      'Accept': '*/*',
      'Origin': targetUrl,
      'Referer': targetUrl + '/',
      'x-dzmm-request-id': requestId,
      'sec-ch-ua': '"Not.A/Brand";v="8", "Chromium";v="147"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'x-requested-with': 'mark.via'
    };

    if (phCookie) {
      headers['Cookie'] = `ph_phc_pXRYopwyByw2wy8XGxzRcko4lPiDr58YspxHOAjThEj_posthog=${phCookie}`;
    }

    // 调用匿名登录 API
    const response = await fetch(targetUrl + '/api/auth/anonymous-sign-in', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody)
    });

    const responseText = await response.text();
    console.log(`API Response Status: ${response.status}, Body: ${responseText}`);

    if (!response.ok) {
      throw new Error(`API返回 ${response.status}: ${responseText}`);
    }

    // 解析响应体
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      throw new Error('API返回的不是有效JSON');
    }

    // 从响应头中提取 Set-Cookie
    const setCookieHeader = response.headers.get('set-cookie');
    const cookies = parseSetCookies(setCookieHeader);

    // 补充可能缺失的 cookie
    if (!cookies['_rid']) cookies['_rid'] = userId;
    if (!cookies['chosen_language']) cookies['chosen_language'] = 'zh-CN';
    if (!cookies['invite_code']) cookies['invite_code'] = '-';

    return new Response(JSON.stringify({
      success: true,
      message: '游客账户创建成功',
      cookies: cookies,
      userId: cookies['_rid'] || data.id,
      balance: 35,
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      note: '通过真实API注册，拥有35次免费额度。'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': Object.entries(cookies)
          .map(([name, value]) => `${name}=${value}; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=31536000`)
          .join(', ')
      }
    });

  } catch (error) {
    console.error(`Error in handleGetAccount: ${error.message}`);
    return new Response(JSON.stringify({
      success: false,
      message: `创建账户失败: ${error.message}`
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ---------- 检查状态 ----------
async function handleCheckStatus(request, targetUrl) {
  try {
    const clientCookies = parseCookies(request.headers.get('cookie') || '');
    const hasAuth = 'sb-rls-auth-token' in clientCookies;
    let balance = 0;

    if (hasAuth) {
      const meResponse = await fetch(targetUrl + '/api/me', {
        headers: {
          'Cookie': request.headers.get('cookie') || ''
        }
      });
      if (meResponse.ok) {
        const meData = await meResponse.json();
        balance = meData.credit || 0;
      }
    }

    return new Response(JSON.stringify({
      authenticated: hasAuth,
      userId: clientCookies['_rid'] || null,
      cookies: Object.keys(clientCookies),
      balance: balance,
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: '检查失败', message: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ---------- 清除 Cookie ----------
async function handleClearCookies(request) {
  const cookiesToClear = [
    'sb-rls-auth-token', '_rid', 'ph_phc_pXRYopwyByw2wy8XGxzRcko4lPiDr58YspxHOAjThEj_posthog',
    'chosen_language', 'invite_code', 'sessionid'
  ];
  const setCookieHeaders = cookiesToClear.map(cookie =>
    `${cookie}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=None; Secure`
  );
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json', 'Set-Cookie': setCookieHeaders.join(', ') }
  });
}

// ---------- 注入自定义 Cookie ----------
async function handleInjectCookie(request) {
  try {
    const body = await request.json();
    const cookies = body.cookies;
    if (!cookies || typeof cookies !== 'object') throw new Error('无效的Cookie数据');
    const setCookieHeaders = Object.entries(cookies).map(([name, value]) =>
      `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=31536000`
    );
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', 'Set-Cookie': setCookieHeaders.join(', ') }
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, message: e.message }), { status: 400 });
  }
}

// ---------- 工具函数 ----------
function parseCookies(cookieString) {
  const cookies = {};
  if (cookieString) {
    cookieString.split(';').forEach(cookie => {
      const [name, ...valueParts] = cookie.trim().split('=');
      const value = valueParts.join('=');
      if (name) cookies[name] = decodeURIComponent(value);
    });
  }
  return cookies;
}

function parseSetCookies(setCookieHeader) {
  const cookies = {};
  if (!setCookieHeader) return cookies;
  const cookieStrings = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  cookieStrings.forEach(cookieStr => {
    const cookie = cookieStr.split(';')[0];
    const [name, ...valueParts] = cookie.split('=');
    const value = valueParts.join('=');
    if (name && value) cookies[name.trim()] = value.trim();
  });
  return cookies;
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}