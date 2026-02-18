// Cloudflare Worker代码 - 酒馆AI无限制代理（调试版）
// jg.ilqx.dpdns.org -> https://www.xn--i8s951di30azba.com

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const targetUrl = "https://www.xn--i8s951di30azba.com";

    try {
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
      return await handleProxyRequest(request, targetUrl, url);
    } catch (error) {
      return new Response(`代理错误: ${error.message}`, { status: 500 });
    }
  }
};

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

// ---------- 注入控制面板（与之前相同，略）----------
function injectControlPanel(html, url) {
  const controlPanelScript = `/* 此处省略，保持之前的面板代码，可隐藏、高级设置等 */`;
  return html.replace('</body>', controlPanelScript + '</body>');
}

// ---------- 核心修改：使用固定成功请求数据调用真实API ----------
async function handleGetAccount(request, targetUrl) {
  try {
    // 从客户端请求中提取已有的 posthog cookie（如果有）
    const clientCookies = parseCookies(request.headers.get('cookie') || '');
    const posthogCookie = clientCookies['ph_phc_pXRYopwyByw2wy8XGxzRcko4lPiDr58YspxHOAjThEj_posthog'] || '';

    // 使用从成功请求中复制的固定值（来自第二个HAR文件）
    const fixedRequestBody = {
      "code": "VUZraitCbnJSZTZBZmJvTEhoY2YrTmt3eWpVamljVGYzY1JIbEEzOEhFRDBUWjk0U2pWYllsSGxhL3EyczVDNndONDMzd3g3K09PaHd5RTcxdmdlRVhoY1BVTEZvUkVvaG5IUUt3RWNJYlhaV0g3Y2VkNEM2YXpQbVlXNmt1VTZ5SEMrOUdvdA==",
      "id": "70cc55dc-6a0c-4c2c-a5db-edc1cf847ca4",
      "email": "70cc55dc-6a0c-4c2c-a5db-edc1cf847ca4@anon.com",
      "fp": {
        "data": {
          "audio": { "sampleHash": 1169.1655874748158, "oscillator": "sine", "maxChannels": 1, "channelCountMode": "max" },
          "canvas": { "commonImageDataHash": "8965585f0983dad03f7382c986d7aee5" },
          "fonts": { "Arial": 340.3125, "Courier": 435.9375, "Courier New": 435.9375, "Helvetica": 340.3125, "Tahoma": 340.3125, "Verdana": 340.3125 },
          "hardware": {
            "videocard": { "vendor": "WebKit", "renderer": "WebKit WebGL", "version": "WebGL 1.0 (OpenGL ES 2.0 Chromium)", "shadingLanguageVersion": "WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)" },
            "architecture": 127, "deviceMemory": "4", "jsHeapSizeLimit": 1130000000
          },
          "locales": { "languages": "zh-CN", "timezone": "Asia/Shanghai" },
          "permissions": {
            "accelerometer": "granted", "background-fetch": "denied", "background-sync": "denied",
            "camera": "prompt", "clipboard-read": "denied", "clipboard-write": "granted",
            "display-capture": "denied", "gyroscope": "granted", "geolocation": "prompt",
            "magnetometer": "granted", "microphone": "prompt", "midi": "granted", "nfc": "denied",
            "notifications": "denied", "payment-handler": "denied", "persistent-storage": "denied",
            "storage-access": "denied", "window-management": "denied"
          },
          "plugins": { "plugins": [] },
          "screen": {
            "is_touchscreen": true, "maxTouchPoints": 5, "colorDepth": 24,
            "mediaMatches": [
              "prefers-contrast: no-preference", "any-hover: none", "any-pointer: coarse",
              "pointer: coarse", "hover: none", "update: fast", "prefers-reduced-motion: no-preference",
              "prefers-reduced-transparency: no-preference", "scripting: enabled", "forced-colors: none"
            ]
          },
          "system": {
            "platform": "Linux aarch64", "cookieEnabled": true, "productSub": "20030107", "product": "Gecko",
            "useragent": "Mozilla/5.0 (Linux; Android 10; PBEM00 Build/QKQ1.190918.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.7681.2 Mobile Safari/537.36",
            "hardwareConcurrency": 8,
            "browser": { "name": "Chrome", "version": "147.0" },
            "applePayVersion": 0
          },
          "webgl": { "commonImageHash": "1d62a570a8e39a3cc4458b2efd47b6a2" },
          "math": {
            "acos": 1.0471975511965979, "asin": -9.614302481290016e-17, "atan": 4.578239276804769e-17,
            "cos": -4.854249971455313e-16, "cosh": 1.9468519159297506, "e": 2.718281828459045,
            "largeCos": 0.7639704044417283, "largeSin": -0.6452512852657808, "largeTan": -0.8446024630198843,
            "log": 6.907755278982137, "pi": 3.141592653589793, "sin": -1.9461946644816207e-16,
            "sinh": -0.6288121810679035, "sqrt": 1.4142135623730951, "tan": 6.980860926542689e-14,
            "tanh": -0.39008295789884684
          }
        },
        "hash": "77f81202fa12f86b7f77af693c55bf08"
      }
    };

    // 构建请求头，添加必要的 x-dzmm-request-id 和可能的 posthog cookie
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': request.headers.get('user-agent') || 'Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36',
      'Accept': 'application/json',
      'Origin': targetUrl,
      'Referer': targetUrl + '/',
      'x-dzmm-request-id': Math.random().toString(36).substring(2, 12) // 生成随机8-10位字符串
    };

    // 如果客户端有 posthog cookie，添加到 Cookie 头
    if (posthogCookie) {
      headers['Cookie'] = `ph_phc_pXRYopwyByw2wy8XGxzRcko4lPiDr58YspxHOAjThEj_posthog=${encodeURIComponent(posthogCookie)}`;
    }

    const response = await fetch(targetUrl + '/api/auth/anonymous-sign-in', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(fixedRequestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API返回 ${response.status}: ${errorText}`);
    }

    // 从响应头提取 Set-Cookie
    const setCookieHeader = response.headers.get('set-cookie');
    const cookies = parseSetCookies(setCookieHeader);

    // 确保必要的 cookie 存在
    if (!cookies['_rid']) cookies['_rid'] = fixedRequestBody.id;
    if (!cookies['chosen_language']) cookies['chosen_language'] = 'zh-CN';
    if (!cookies['invite_code']) cookies['invite_code'] = '-';

    // 可选：从响应体中提取更多信息
    const data = await response.json();

    return new Response(JSON.stringify({
      success: true,
      message: '游客账户创建成功',
      cookies: cookies,
      userId: cookies['_rid'] || data.id,
      balance: 35,
      expiresAt: new Date(Date.now() + 3600*1000).toISOString(),
      note: '使用固定code调试，如成功则后续可优化。'
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
    return new Response(JSON.stringify({
      success: false,
      message: `创建账户失败: ${error.message}`
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleCheckStatus(request, targetUrl) {
  const clientCookies = parseCookies(request.headers.get('cookie') || '');
  const hasAuth = 'sb-rls-auth-token' in clientCookies;
  let balance = 0;

  if (hasAuth) {
    const meResponse = await fetch(targetUrl + '/api/me', {
      headers: { 'Cookie': request.headers.get('cookie') || '' }
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
}

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