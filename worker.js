// Cloudflare Worker 完整代码 - 酒馆AI无限制代理（纯动态版）
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

      // 普通代理请求（自动携带客户端 Cookie）
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
  // 复制客户端请求头，修改必要字段
  const targetHeaders = new Headers(request.headers);
  targetHeaders.delete('host');
  targetHeaders.delete('origin');
  targetHeaders.delete('referer');
  targetHeaders.set('origin', targetUrl);
  targetHeaders.set('referer', targetUrl + url.pathname);

  // 转发请求
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

  // 如果是 HTML，注入控制面板
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

  // 处理 API 响应，添加跨域头
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

// ---------- 注入控制面板（保持不变，但包含在最终代码中）----------
function injectControlPanel(html, url) {
  const panelHTML = `...`; // 此处省略，实际部署时请保留您之前的面板代码（包括CSS和JS）
  return html.replace('</body>', panelHTML + '</body>');
}

// ---------- 获取新游客账户（纯动态，无模拟数据）----------
async function handleGetAccount(request, targetUrl) {
  try {
    // 1. 先请求首页，获取最新 code 和可能的初始化数据
    const homeHeaders = {
      'User-Agent': request.headers.get('user-agent') || 'Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    };

    const homeResp = await fetch(targetUrl, {
      headers: homeHeaders
    });

    if (!homeResp.ok) {
      throw new Error(`首页请求失败: ${homeResp.status}`);
    }

    const html = await homeResp.text();

    // 从 HTML 中提取 code
    const codeMatch = html.match(/"code":"([^"]+)"/);
    if (!codeMatch) {
      throw new Error('无法从首页提取 code');
    }
    const code = codeMatch[1];
    console.log('Extracted code:', code);

    // 2. 生成随机的用户 ID 和邮箱（格式符合要求）
    const userId = generateUUID();
    const email = `${userId}@anon.com`;

    // 3. 动态生成指纹对象（模仿 HAR 文件中的结构，但值可随机或固定）
    //    为了最大程度通过校验，我们保留主要结构，但将部分数值设为随机
    const fp = {
      data: {
        audio: {
          sampleHash: Math.random() * 2000,
          oscillator: "sine",
          maxChannels: 1,
          channelCountMode: "max"
        },
        canvas: {
          commonImageDataHash: "8965585f0983dad03f7382c986d7aee5" // 可固定
        },
        fonts: {
          Arial: 340.3125, Courier: 435.9375, "Courier New": 435.9375,
          Helvetica: 340.3125, Tahoma: 340.3125, Verdana: 340.3125
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
          jsHeapSizeLimit: 1130000000
        },
        locales: {
          languages: "zh-CN",
          timezone: "Asia/Shanghai"
        },
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
          is_touchscreen: true,
          maxTouchPoints: 5,
          colorDepth: 24,
          mediaMatches: [
            "prefers-contrast: no-preference", "any-hover: none", "any-pointer: coarse",
            "pointer: coarse", "hover: none", "update: fast", "prefers-reduced-motion: no-preference",
            "prefers-reduced-transparency: no-preference", "scripting: enabled", "forced-colors: none"
          ]
        },
        system: {
          platform: "Linux aarch64",
          cookieEnabled: true,
          productSub: "20030107",
          product: "Gecko",
          useragent: request.headers.get('user-agent') || "Mozilla/5.0 (Linux; Android 10; PBEM00 Build/QKQ1.190918.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.7681.2 Mobile Safari/537.36",
          hardwareConcurrency: 8,
          browser: { name: "Chrome", version: "147.0" },
          applePayVersion: 0
        },
        webgl: {
          commonImageHash: "1d62a570a8e39a3cc4458b2efd47b6a2"
        },
        math: {
          acos: 1.0471975511965979, asin: -9.614302481290016e-17, atan: 4.578239276804769e-17,
          cos: -4.854249971455313e-16, cosh: 1.9468519159297506, e: 2.718281828459045,
          largeCos: 0.7639704044417283, largeSin: -0.6452512852657808, largeTan: -0.8446024630198843,
          log: 6.907755278982137, pi: 3.141592653589793, sin: -1.9461946644816207e-16,
          sinh: -0.6288121810679035, sqrt: 1.4142135623730951, tan: 6.980860926542689e-14,
          tanh: -0.39008295789884684
        }
      },
      hash: "77f81202fa12f86b7f77af693c55bf08" // 可固定
    };

    const requestBody = {
      code: code,
      id: userId,
      email: email,
      fp: fp
    };

    // 4. 生成必要的请求头
    const requestId = Math.random().toString(36).substring(2, 10);

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

    // 5. 如果客户端已经有 ph_phc_... Cookie，可以带上（但不是必须）
    const clientCookies = parseCookies(request.headers.get('cookie') || '');
    const phCookie = clientCookies['ph_phc_pXRYopwyByw2wy8XGxzRcko4lPiDr58YspxHOAjThEj_posthog'];
    if (phCookie) {
      headers['Cookie'] = `ph_phc_pXRYopwyByw2wy8XGxzRcko4lPiDr58YspxHOAjThEj_posthog=${phCookie}`;
    }

    // 6. 调用匿名登录接口（注意重试机制，避免429）
    let response;
    let retries = 3;
    while (retries-- > 0) {
      response = await fetch(targetUrl + '/api/auth/anonymous-sign-in', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody)
      });

      if (response.status !== 429) break; // 非限流则跳出循环
      // 如果限流，等待1秒后重试
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (!response || !response.ok) {
      const errorText = response ? await response.text() : '无响应';
      throw new Error(`API返回 ${response?.status || '未知'}: ${errorText}`);
    }

    const responseText = await response.text();
    console.log(`API Response Status: ${response.status}, Body: ${responseText}`);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      throw new Error('API返回的不是有效JSON');
    }

    // 7. 从响应头中提取 Set-Cookie
    const setCookieHeader = response.headers.get('set-cookie');
    const cookies = parseSetCookies(setCookieHeader);

    // 补充可能缺失的 cookie
    if (!cookies['_rid']) cookies['_rid'] = data.id || userId;
    if (!cookies['chosen_language']) cookies['chosen_language'] = 'zh-CN';
    if (!cookies['invite_code']) cookies['invite_code'] = '-';

    // 8. 生成并返回成功响应
    return new Response(JSON.stringify({
      success: true,
      message: '游客账户创建成功',
      cookies: cookies,
      userId: cookies['_rid'] || data.id,
      balance: 35, // 新用户默认35，实际可通过后续请求获取
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      note: '通过纯动态流程注册，拥有35次免费额度。'
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

// ---------- 检查状态（请求 /api/me 获取真实余额）----------
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