// Cloudflare Worker代码 - 酒馆AI无限制代理（增强版）
// 目标：https://www.xn--i8s951di30azba.com

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const targetUrl = "https://www.xn--i8s951di30azba.com";

    // 处理预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    try {
      // 自定义接口
      if (url.pathname === '/_proxy/get-account') {
        return handleGetAccount(request, targetUrl);
      }
      if (url.pathname === '/_proxy/check-status') {
        return handleCheckStatus(request);
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
      return new Response(`代理错误: ${error.message}`, { status: 500, headers: { 'Content-Type': 'text/plain' } });
    }
  }
};

async function handleProxyRequest(request, targetUrl, url) {
  // 解析客户端cookie
  const requestCookies = parseCookies(request.headers.get('cookie') || '');

  // 构建目标请求头
  const targetHeaders = new Headers(request.headers);
  targetHeaders.delete('host');
  targetHeaders.delete('origin');
  targetHeaders.delete('referer');

  // 设置正确的来源和引用
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

  // 克隆用于可能的修改
  const cloned = response.clone();

  // 如果是HTML，注入控制面板
  if (contentType.includes('text/html')) {
    try {
      const html = await cloned.text();
      const modifiedHtml = injectControlPanel(html, url);

      const newHeaders = new Headers(response.headers);
      newHeaders.set('Content-Type', 'text/html; charset=utf-8');
      // 移除安全限制
      newHeaders.delete('content-security-policy');
      newHeaders.delete('content-security-policy-report-only');
      // 添加跨域头
      addCorsHeaders(newHeaders);

      return new Response(modifiedHtml, {
        status: response.status,
        headers: newHeaders
      });
    } catch (error) {
      console.error('HTML注入失败:', error);
      return response;
    }
  }

  // 对于非HTML，直接返回，但加上CORS头
  const newHeaders = new Headers(response.headers);
  addCorsHeaders(newHeaders);
  newHeaders.delete('content-security-policy');
  newHeaders.delete('content-security-policy-report-only');

  return new Response(response.body, {
    status: response.status,
    headers: newHeaders
  });
}

function addCorsHeaders(headers) {
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', '*');
  headers.set('Access-Control-Allow-Credentials', 'true');
}

// ------------------ 控制面板注入 ------------------
function injectControlPanel(html, url) {
  const panelStyle = `
  <style>
    #jg-proxy-panel {
      position: fixed;
      bottom: 16px;
      right: 16px;
      background: rgba(28, 28, 32, 0.9);
      backdrop-filter: blur(12px);
      color: #e0e0e0;
      padding: 12px;
      border-radius: 20px;
      z-index: 10000;
      font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 13px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      width: 300px;
      max-width: calc(100vw - 32px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      transition: all 0.3s ease;
      user-select: none;
      touch-action: none; /* 允许拖拽时不滚动页面 */
    }
    #jg-proxy-panel.collapsed {
      width: 56px;
      height: 56px;
      padding: 0;
      border-radius: 28px;
      overflow: hidden;
      background: rgba(28, 28, 32, 0.95);
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #jg-proxy-panel.collapsed .panel-content {
      display: none;
    }
    #jg-proxy-panel.collapsed .panel-header {
      display: none;
    }
    #jg-proxy-panel.collapsed::after {
      content: "🍺";
      font-size: 28px;
      line-height: 1;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
    }
    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      font-weight: 600;
      color: #fff;
      cursor: grab;
    }
    .panel-header h3 {
      margin: 0;
      font-size: 15px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .panel-header h3::before {
      content: "🍺";
      font-size: 18px;
    }
    .panel-header .controls {
      display: flex;
      gap: 8px;
    }
    .panel-header button {
      background: rgba(255,255,255,0.1);
      border: none;
      color: white;
      width: 28px;
      height: 28px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 16px;
      transition: background 0.2s;
    }
    .panel-header button:hover {
      background: rgba(255,255,255,0.2);
    }
    .panel-content {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    #jg-status {
      background: rgba(0,0,0,0.3);
      padding: 10px 12px;
      border-radius: 14px;
      font-size: 12px;
      line-height: 1.5;
      border-left: 4px solid #4caf50;
      word-break: break-word;
    }
    .button-group {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .jg-btn {
      flex: 1 1 auto;
      min-width: 80px;
      padding: 10px 0;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.05);
      border-radius: 30px;
      color: #fff;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .jg-btn.primary {
      background: linear-gradient(145deg, #667eea, #764ba2);
      border: none;
      box-shadow: 0 4px 12px rgba(102,126,234,0.3);
    }
    .jg-btn.danger {
      background: linear-gradient(145deg, #ff416c, #ff4b2b);
      border: none;
    }
    .jg-btn.success {
      background: linear-gradient(145deg, #56ab2f, #a8e063);
      border: none;
    }
    .jg-btn.info {
      background: linear-gradient(145deg, #2196F3, #21CBF3);
      border: none;
    }
    .jg-btn.small {
      padding: 6px 12px;
      font-size: 12px;
      min-width: auto;
    }
    .advanced-section {
      margin-top: 8px;
      border-top: 1px solid rgba(255,255,255,0.1);
      padding-top: 12px;
    }
    #jg-cookie-input {
      width: 100%;
      padding: 12px;
      background: rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 16px;
      color: #fff;
      font-size: 12px;
      font-family: 'Menlo', monospace;
      resize: vertical;
      margin-bottom: 8px;
      outline: none;
    }
    #jg-cookie-input:focus {
      border-color: #667eea;
    }
    #jg-current-cookies {
      background: rgba(0,0,0,0.2);
      border-radius: 12px;
      padding: 8px;
      max-height: 150px;
      overflow-y: auto;
      font-size: 11px;
    }
    .cookie-item {
      display: flex;
      justify-content: space-between;
      padding: 4px 6px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .cookie-key {
      color: #8bc34a;
      font-weight: 600;
    }
    .cookie-value {
      color: #bb86fc;
      max-width: 150px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    /* 移动端优化 */
    @media (max-width: 480px) {
      #jg-proxy-panel:not(.collapsed) {
        bottom: 10px;
        right: 10px;
        width: calc(100vw - 20px);
        max-width: 100%;
      }
      .button-group .jg-btn {
        flex: 1 1 calc(50% - 4px);
      }
    }
  </style>
  `;

  const panelScript = `
  <script>
    (function() {
      // 状态
      let isCollapsed = localStorage.getItem('jg_panel_collapsed') === 'true';
      let isAdvanced = false;

      const panelId = 'jg-proxy-panel';
      let panel = document.getElementById(panelId);
      if (!panel) {
        panel = document.createElement('div');
        panel.id = panelId;
        panel.className = isCollapsed ? 'collapsed' : '';
        document.body.appendChild(panel);
      }

      function renderPanel() {
        const statusHtml = '<div id="jg-status">加载中...</div>';
        const advancedHtml = isAdvanced ? \`
          <div class="advanced-section">
            <textarea id="jg-cookie-input" placeholder="粘贴Cookie字符串 (格式: key=value; key2=value2)"></textarea>
            <div class="button-group">
              <button class="jg-btn small" onclick="injectCookie()">💉 注入</button>
              <button class="jg-btn small" onclick="exportCookies()">📋 导出</button>
              <button class="jg-btn small" onclick="fetch('/_proxy/clear-cookies',{method:'POST'}).then(()=>location.reload())">🗑️ 清空</button>
            </div>
            <div id="jg-current-cookies"></div>
          </div>
        \` : '';

        panel.innerHTML = \`
          <div class="panel-header">
            <h3>酒馆AI代理</h3>
            <div class="controls">
              <button onclick="toggleCollapse()">\${isCollapsed ? '⬆️' : '⬇️'}</button>
              <button onclick="toggleAdvanced()">⚙️</button>
            </div>
          </div>
          <div class="panel-content">
            <div id="jg-status">\${statusHtml}</div>
            <div class="button-group">
              <button class="jg-btn primary" onclick="getNewGuestAccount()">🆕 新游客</button>
              <button class="jg-btn info" onclick="checkStatus()">📊 状态</button>
            </div>
            \${advancedHtml}
          </div>
        \`;
        updateCookieDisplay();
        checkStatus(true); // 静默更新
      }

      window.toggleCollapse = function() {
        isCollapsed = !isCollapsed;
        localStorage.setItem('jg_panel_collapsed', isCollapsed);
        panel.className = isCollapsed ? 'collapsed' : '';
        if (!isCollapsed) renderPanel();
        else panel.innerHTML = ''; // 折叠时清空内部，由css显示emoji
      };

      window.toggleAdvanced = function() {
        isAdvanced = !isAdvanced;
        renderPanel();
      };

      window.getNewGuestAccount = async function() {
        setStatus('正在获取新游客账户...', 'info');
        try {
          // 尝试调用匿名登录接口，由浏览器生成指纹
          const id = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => (Math.random()*16|0).toString(16));
          const email = id + '@anon.com';

          // 构造请求体，包含浏览器指纹（简单版）
          const fpData = {
            data: {
              audio: { sampleHash: Math.random() * 2000, oscillator: 'sine', maxChannels: 1, channelCountMode: 'max' },
              canvas: { commonImageDataHash: Math.random().toString(36) },
              fonts: { Arial: 340.3125, Courier: 435.9375 },
              hardware: { videocard: { vendor: 'WebKit', renderer: 'WebKit WebGL' } },
              locales: { languages: navigator.language, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
              screen: { is_touchscreen: 'maxTouchPoints' in navigator && navigator.maxTouchPoints > 0, maxTouchPoints: navigator.maxTouchPoints || 5 },
              system: { platform: navigator.platform, useragent: navigator.userAgent, hardwareConcurrency: navigator.hardwareConcurrency || 4 }
            },
            hash: Math.random().toString(36).substring(2)
          };

          const resp = await fetch('/api/auth/anonymous-sign-in', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: id,
              email: email,
              code: 'dummy', // 可能需要有效的code，这里用dummy
              fp: fpData
            })
          });

          if (resp.ok) {
            setStatus('✅ 账户获取成功！余额35次', 'success');
            setTimeout(() => location.reload(), 1500);
          } else {
            const text = await resp.text();
            setStatus('❌ 获取失败: ' + (text.slice(0,50) || resp.status), 'error');
          }
        } catch (e) {
          setStatus('❌ 请求失败: ' + e.message, 'error');
        }
      };

      window.checkStatus = async function(silent = false) {
        if (!silent) setStatus('检查中...', 'info');
        try {
          const resp = await fetch('/_proxy/check-status');
          const data = await resp.json();
          const cookies = getAllCookies();
          if (cookies['_rid']) {
            const shortId = cookies['_rid'].substring(0,8) + '...';
            const balance = data.balance !== undefined ? data.balance : '35次';
            setStatus(\`✅ 已登录\\n账号: \${shortId}\\n余额: \${balance}\`, 'success');
          } else {
            setStatus('❌ 未登录，请注入Cookie或获取新账户', 'warning');
          }
          updateCookieDisplay();
        } catch (e) {
          setStatus('❌ 检查失败', 'error');
        }
      };

      window.injectCookie = function() {
        const input = document.getElementById('jg-cookie-input').value.trim();
        if (!input) return alert('请输入Cookie');
        // 发送到worker注入
        fetch('/_proxy/inject-cookie', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cookieString: input })
        }).then(resp => resp.json()).then(data => {
          if (data.success) {
            setStatus('✅ 注入成功，即将刷新', 'success');
            setTimeout(() => location.reload(), 1000);
          } else {
            setStatus('❌ 注入失败: ' + data.message, 'error');
          }
        }).catch(e => setStatus('❌ 请求失败', 'error'));
      };

      window.exportCookies = function() {
        const cookies = getAllCookies();
        if (Object.keys(cookies).length === 0) return alert('无Cookie');
        const str = Object.entries(cookies).map(([k,v]) => \`\${k}=\${v}\`).join('; ');
        navigator.clipboard?.writeText(str).then(() => alert('已复制到剪贴板')).catch(() => alert('复制失败，请手动复制'));
      };

      function getAllCookies() {
        return document.cookie.split(';').reduce((acc, c) => {
          const [k, v] = c.trim().split('=');
          if (k) acc[k] = decodeURIComponent(v || '');
          return acc;
        }, {});
      }

      function updateCookieDisplay() {
        const container = document.getElementById('jg-current-cookies');
        if (!container) return;
        const cookies = getAllCookies();
        if (Object.keys(cookies).length === 0) {
          container.innerHTML = '<div style="text-align:center;opacity:0.6;">暂无Cookie</div>';
          return;
        }
        container.innerHTML = Object.entries(cookies).map(([k,v]) => \`
          <div class="cookie-item">
            <span class="cookie-key">\${k}</span>
            <span class="cookie-value" title="\${v}">\${v.substring(0,20)}...</span>
          </div>
        \`).join('');
      }

      function setStatus(msg, type = 'info') {
        const statusDiv = document.getElementById('jg-status');
        if (!statusDiv) return;
        const colors = { info: '#2196F3', success: '#4CAF50', error: '#f44336', warning: '#ff9800' };
        statusDiv.innerHTML = \`<div style="border-left-color: \${colors[type]};">\${msg.replace(/\\n/g, '<br>')}</div>\`;
      }

      // 拖拽功能
      let isDragging = false, offsetX, offsetY;
      panel.addEventListener('mousedown', (e) => {
        if (!e.target.closest('.panel-header')) return;
        e.preventDefault();
        isDragging = true;
        offsetX = e.clientX - panel.offsetLeft;
        offsetY = e.clientY - panel.offsetTop;
        panel.style.transition = 'none';
      });
      document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        panel.style.left = (e.clientX - offsetX) + 'px';
        panel.style.top = (e.clientY - offsetY) + 'px';
        panel.style.bottom = 'auto';
        panel.style.right = 'auto';
      });
      document.addEventListener('mouseup', () => {
        isDragging = false;
        panel.style.transition = '';
      });

      // 触摸支持
      panel.addEventListener('touchstart', (e) => {
        if (!e.target.closest('.panel-header')) return;
        e.preventDefault();
        const touch = e.touches[0];
        isDragging = true;
        offsetX = touch.clientX - panel.offsetLeft;
        offsetY = touch.clientY - panel.offsetTop;
        panel.style.transition = 'none';
      });
      document.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const touch = e.touches[0];
        panel.style.left = (touch.clientX - offsetX) + 'px';
        panel.style.top = (touch.clientY - offsetY) + 'px';
        panel.style.bottom = 'auto';
        panel.style.right = 'auto';
      });
      document.addEventListener('touchend', () => {
        isDragging = false;
        panel.style.transition = '';
      });

      // 初始化
      renderPanel();
    })();
  </script>
  `;

  // 在</body>前插入
  const injectHtml = panelStyle + panelScript;
  return html.replace('</body>', injectHtml + '</body>');
}

// ------------------ API 处理 ------------------
async function handleGetAccount(request, targetUrl) {
  // 尝试直接代理到匿名登录接口，让浏览器生成指纹
  const url = new URL(request.url);
  const body = await request.json().catch(() => null);
  if (!body) {
    return new Response(JSON.stringify({ success: false, message: '需要请求体' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const target = targetUrl + '/api/auth/anonymous-sign-in';
  const proxyResp = await fetch(target, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': request.headers.get('User-Agent') || 'Mozilla/5.0',
    },
    body: JSON.stringify(body)
  });

  const responseBody = await proxyResp.text();
  const responseHeaders = new Headers(proxyResp.headers);
  addCorsHeaders(responseHeaders);

  return new Response(responseBody, {
    status: proxyResp.status,
    headers: responseHeaders
  });
}

async function handleCheckStatus(request) {
  // 从请求cookie中获取信息
  const cookies = parseCookies(request.headers.get('cookie') || '');
  const userId = cookies['_rid'] || null;

  // 尝试从目标获取余额信息（通过 /api/me 和 /api/trpc/chat.getQuotas）
  let balance = '未知';
  try {
    // 由于worker无法直接携带cookie访问目标，这里我们简单返回cookie状态
    // 真实余额需要前端发起请求
  } catch (e) {}

  return new Response(JSON.stringify({
    authenticated: !!(cookies['sb-rls-auth-token'] && cookies['_rid']),
    userId: userId,
    cookies: Object.keys(cookies),
    balance: 35, // 默认显示35次
    timestamp: new Date().toISOString()
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() }
  });
}

async function handleClearCookies(request) {
  const cookiesToClear = ['sb-rls-auth-token', '_rid', 'ph_phc_pXRYopwyByw2wy8XGxzRcko4lPiDr58YspxHOAjThEj_posthog', 'chosen_language', 'invite_code'];
  const setCookieHeaders = cookiesToClear.map(name =>
    `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax; Secure`
  );

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': setCookieHeaders.join(', '),
      ...corsHeaders()
    }
  });
}

async function handleInjectCookie(request) {
  try {
    const { cookieString } = await request.json();
    if (!cookieString || typeof cookieString !== 'string') {
      throw new Error('无效的cookie字符串');
    }

    // 解析字符串，格式如 "key=value; key2=value2"
    const cookiePairs = cookieString.split(';').map(p => p.trim()).filter(p => p.includes('='));
    const cookies = {};
    for (const pair of cookiePairs) {
      const [name, ...valueParts] = pair.split('=');
      const value = valueParts.join('=');
      if (name && value) {
        cookies[name.trim()] = decodeURIComponent(value.trim());
      }
    }

    if (Object.keys(cookies).length === 0) {
      throw new Error('未解析到任何cookie');
    }

    // 生成Set-Cookie头
    const setCookieHeaders = Object.entries(cookies).map(([name, value]) => {
      return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax; Secure`;
    });

    return new Response(JSON.stringify({ success: true, count: setCookieHeaders.length }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': setCookieHeaders.join(', '),
        ...corsHeaders()
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, message: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() }
    });
  }
}

// ------------------ 工具函数 ------------------
function parseCookies(cookieString) {
  const cookies = {};
  if (!cookieString) return cookies;
  cookieString.split(';').forEach(cookie => {
    const [name, ...valueParts] = cookie.trim().split('=');
    const value = valueParts.join('=');
    if (name) cookies[name] = decodeURIComponent(value);
  });
  return cookies;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Credentials': 'true',
  };
}