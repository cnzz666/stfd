var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.js - 完整版
var worker_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const targetUrl = "https://www.xn--i8s951di30azba.com";
    
    // 全局身份验证检查（所有路径）
    if (!await authenticateRequest(request, env)) {
      return new Response('需要身份验证', {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="请使用默认密码登录"',
          'Content-Type': 'text/plain; charset=utf-8'
        }
      });
    }
    
    try {
      // D1数据库初始化检查
      if (env.DB) {
        await initDatabase(env.DB);
      }
      
      // 处理代理接口
      if (url.pathname === "/_proxy/get-account") {
        return handleGetAccount(request, targetUrl, env);
      }
      if (url.pathname === "/_proxy/check-status") {
        return handleCheckStatus(request, targetUrl, env);
      }
      if (url.pathname === "/_proxy/clear-cookies") {
        return handleClearCookies(request);
      }
      if (url.pathname === "/_proxy/inject-cookie") {
        return handleInjectCookie(request);
      }
      if (url.pathname === "/_proxy/bulk-register") {
        return handleBulkRegister(request, targetUrl, env);
      }
      if (url.pathname === "/_proxy/env-check") {
        return handleEnvCheck(request, targetUrl);
      }
      if (url.pathname === "/_proxy/account-manage") {
        return handleAccountManage(request, env);
      }
      if (url.pathname === "/_proxy/register-progress") {
        return handleRegisterProgress(request, env);
      }
      
      return await handleProxyRequest(request, targetUrl, url);
    } catch (error) {
      return new Response(`代理错误: ${error.message}`, {
        status: 500,
        headers: { "Content-Type": "text/plain" }
      });
    }
  }
};

// ==================== D1数据库操作 ====================
async function initDatabase(db) {
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS account_manage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL UNIQUE,
        cookies TEXT NOT NULL,
        token TEXT,
        balance INTEGER DEFAULT 35,
        create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'active',
        metadata TEXT DEFAULT '{}'
      );
      
      CREATE TABLE IF NOT EXISTS register_sessions (
        session_id TEXT PRIMARY KEY,
        total_count INTEGER DEFAULT 0,
        completed_count INTEGER DEFAULT 0,
        failed_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'running',
        start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        end_time DATETIME,
        config TEXT DEFAULT '{}'
      );
    `);
  } catch (error) {
    console.error("数据库初始化失败:", error);
  }
}
__name(initDatabase, "initDatabase");

async function saveAccountToDB(db, accountData) {
  try {
    const { userId, cookies, token, balance = 35 } = accountData;
    
    await db.prepare(`
      INSERT OR REPLACE INTO account_manage 
      (user_id, cookies, token, balance, update_time)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).bind(
      userId,
      JSON.stringify(cookies),
      token || '',
      balance
    ).run();
    
    return true;
  } catch (error) {
    console.error("保存账户到数据库失败:", error);
    return false;
  }
}
__name(saveAccountToDB, "saveAccountToDB");

async function getAccountsFromDB(db, limit = 100) {
  try {
    const { results } = await db.prepare(`
      SELECT * FROM account_manage 
      ORDER BY update_time DESC 
      LIMIT ?
    `).bind(limit).all();
    
    return results;
  } catch (error) {
    console.error("获取账户列表失败:", error);
    return [];
  }
}
__name(getAccountsFromDB, "getAccountsFromDB");

// ==================== 身份验证 ====================
async function authenticateRequest(request, env) {
  // 检查是否有有效的认证Cookie
  const authCookie = parseCookies(request.headers.get("cookie") || "")["proxy_auth"];
  if (authCookie === "authenticated") {
    return true;
  }
  
  // 检查Basic Auth
  const authHeader = request.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Basic ")) {
    const base64Credentials = authHeader.substring(6);
    const credentials = atob(base64Credentials);
    const [username, password] = credentials.split(":");
    
    // 使用默认密码验证
    if (password === "1591156135qwzxcv") {
      // 设置认证Cookie
      const response = new Response(null, {
        status: 307,
        headers: {
          'Location': request.url,
          'Set-Cookie': 'proxy_auth=authenticated; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400'
        }
      });
      return response;
    }
  }
  
  return false;
}
__name(authenticateRequest, "authenticateRequest");

// ==================== 批量注册处理 ====================
async function handleBulkRegister(request, targetUrl, env) {
  try {
    const body = await request.json();
    const { count = 1, autoRefresh = true, refreshDelay = 3000 } = body;
    
    // 创建注册会话
    const sessionId = `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    if (env.DB) {
      await env.DB.prepare(`
        INSERT INTO register_sessions 
        (session_id, total_count, status, config)
        VALUES (?, ?, 'running', ?)
      `).bind(
        sessionId,
        count,
        JSON.stringify({ autoRefresh, refreshDelay })
      ).run();
    }
    
    // 异步执行批量注册
    ctx.waitUntil(executeBulkRegistration(sessionId, count, targetUrl, env, {
      autoRefresh,
      refreshDelay
    }));
    
    return new Response(JSON.stringify({
      success: true,
      sessionId,
      message: `已开始批量注册 ${count} 个账号`,
      progressUrl: `/_proxy/register-progress?session=${sessionId}`
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      message: `批量注册启动失败: ${error.message}`
    }), { status: 500 });
  }
}
__name(handleBulkRegister, "handleBulkRegister");

async function executeBulkRegistration(sessionId, count, targetUrl, env, config) {
  let completed = 0;
  let failed = 0;
  
  for (let i = 0; i < count; i++) {
    try {
      // 创建单个账号
      const accountResult = await createSingleAccount(targetUrl, env);
      
      if (accountResult.success) {
        completed++;
        
        // 保存到数据库
        if (env.DB && accountResult.cookies && accountResult.userId) {
          await saveAccountToDB(env.DB, {
            userId: accountResult.userId,
            cookies: accountResult.cookies,
            token: accountResult.token,
            balance: accountResult.balance || 35
          });
        }
        
        // 删除本地Cookie（通过设置过期）
        if (config.autoRefresh && i < count - 1) {
          await new Promise(resolve => setTimeout(resolve, config.refreshDelay));
        }
      } else {
        failed++;
      }
      
      // 更新进度
      if (env.DB) {
        await env.DB.prepare(`
          UPDATE register_sessions 
          SET completed_count = ?, failed_count = ?
          WHERE session_id = ?
        `).bind(completed, failed, sessionId).run();
      }
      
    } catch (error) {
      failed++;
      console.error(`第 ${i + 1} 个账号注册失败:`, error);
    }
  }
  
  // 完成会话
  if (env.DB) {
    await env.DB.prepare(`
      UPDATE register_sessions 
      SET status = 'completed', end_time = datetime('now')
      WHERE session_id = ?
    `).bind(sessionId).run();
  }
}
__name(executeBulkRegistration, "executeBulkRegistration");

async function handleRegisterProgress(request, env) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session");
  
  if (!sessionId || !env.DB) {
    return new Response(JSON.stringify({ error: "参数错误" }), { status: 400 });
  }
  
  try {
    const session = await env.DB.prepare(`
      SELECT * FROM register_sessions WHERE session_id = ?
    `).bind(sessionId).first();
    
    if (!session) {
      return new Response(JSON.stringify({ error: "会话不存在" }), { status: 404 });
    }
    
    return new Response(JSON.stringify(session), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
__name(handleRegisterProgress, "handleRegisterProgress");

// ==================== 环境检查 ====================
async function handleEnvCheck(request, targetUrl) {
  try {
    const results = [];
    
    // 检查 /api/auth/token
    const tokenResp = await fetch(targetUrl + "/api/auth/token", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    
    results.push({
      endpoint: "/api/auth/token",
      status: tokenResp.status,
      ok: tokenResp.ok,
      message: tokenResp.ok ? "正常" : `异常: ${tokenResp.status} ${tokenResp.statusText}`
    });
    
    // 检查 /api/auth/anonymous-sign-in
    const signinResp = await fetch(targetUrl + "/api/auth/anonymous-sign-in", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      },
      body: JSON.stringify({ test: "check" })
    });
    
    results.push({
      endpoint: "/api/auth/anonymous-sign-in",
      status: signinResp.status,
      ok: signinResp.ok,
      message: signinResp.ok ? "正常" : `异常: ${signinResp.status} ${tokenResp.statusText}`
    });
    
    const allOk = results.every(r => r.ok);
    
    return new Response(JSON.stringify({
      success: true,
      environment: allOk ? "正常" : "异常",
      timestamp: new Date().toISOString(),
      results
    }), {
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      environment: "检查失败",
      error: error.message
    }), { status: 500 });
  }
}
__name(handleEnvCheck, "handleEnvCheck");

// ==================== 账号管理 ====================
async function handleAccountManage(request, env) {
  if (!env.DB) {
    return new Response(JSON.stringify({ error: "数据库未配置" }), { status: 500 });
  }
  
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action") || "list";
    
    if (action === "list") {
      const accounts = await getAccountsFromDB(env.DB);
      return new Response(JSON.stringify({
        success: true,
        count: accounts.length,
        accounts
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    
    if (action === "delete") {
      const userId = url.searchParams.get("user_id");
      if (!userId) {
        return new Response(JSON.stringify({ error: "需要user_id参数" }), { status: 400 });
      }
      
      await env.DB.prepare(`
        DELETE FROM account_manage WHERE user_id = ?
      `).bind(userId).run();
      
      return new Response(JSON.stringify({
        success: true,
        message: "账号已删除"
      }));
    }
    
    return new Response(JSON.stringify({ error: "未知操作" }), { status: 400 });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
__name(handleAccountManage, "handleAccountManage");

// ==================== 创建单个账号（修改版） ====================
async function createSingleAccount(targetUrl, env) {
  try {
    // 监听关键API端点状态
    const endpoints = [
      { path: "/api/auth/token", expectedStatus: 200 },
      { path: "/api/auth/anonymous-sign-in", expectedStatus: 200 }
    ];
    
    // 检查端点状态
    for (const endpoint of endpoints) {
      const checkResp = await fetch(targetUrl + endpoint.path, {
        method: endpoint.path.includes("sign-in") ? "POST" : "GET",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        },
        body: endpoint.path.includes("sign-in") ? JSON.stringify({}) : undefined
      });
      
      if (!checkResp.ok && checkResp.status !== 429) {
        throw new Error(`端点 ${endpoint.path} 状态异常: ${checkResp.status}`);
      }
    }
    
    // 使用原有逻辑创建账号（但跳过首页code提取）
    const userId = generateUUID();
    const email = `${userId}@anon.com`;
    
    // 构建指纹数据
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
          useragent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          hardwareConcurrency: 8,
          browser: { name: "Chrome", version: "120.0" },
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
      code: "direct_access", // 不使用首页提取的code
      id: userId,
      email,
      fp
    };
    
    const requestId = Math.random().toString(36).substring(2, 10);
    const headers = {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "*/*",
      "Origin": targetUrl,
      "Referer": targetUrl + "/",
      "x-dzmm-request-id": requestId,
      "sec-ch-ua": '"Not.A/Brand";v="8", "Chromium";v="120"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"'
    };
    
    let response;
    let retries = 3;
    
    while (retries-- > 0) {
      response = await fetch(targetUrl + "/api/auth/anonymous-sign-in", {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody)
      });
      
      if (response.status !== 429) break;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    
    if (!response || !response.ok) {
      const errorText = response ? await response.text() : "无响应";
      throw new Error(`API返回 ${response?.status || "未知"}: ${errorText}`);
    }
    
    const responseText = await response.text();
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
    
    // 尝试提取token
    let token = "";
    if (cookies["sb-rls-auth-token"]) {
      token = cookies["sb-rls-auth-token"];
    }
    
    return {
      success: true,
      userId: cookies["_rid"] || userId,
      cookies,
      token,
      balance: 35,
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString()
    };
    
  } catch (error) {
    console.error("创建账号失败:", error);
    return {
      success: false,
      error: error.message
    };
  }
}
__name(createSingleAccount, "createSingleAccount");

// ==================== 修改原有函数以支持env参数 ====================
async function handleGetAccount(request, targetUrl, env) {
  try {
    const accountResult = await createSingleAccount(targetUrl, env);
    
    if (!accountResult.success) {
      throw new Error(accountResult.error || "创建账号失败");
    }
    
    // 保存到数据库
    if (env.DB) {
      await saveAccountToDB(env.DB, {
        userId: accountResult.userId,
        cookies: accountResult.cookies,
        token: accountResult.token,
        balance: accountResult.balance
      });
    }
    
    return new Response(JSON.stringify({
      success: true,
      message: "游客账户创建成功",
      ...accountResult
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": Object.entries(accountResult.cookies).map(([name, value]) => 
          `${name}=${value}; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=31536000`
        ).join(", ")
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

async function handleCheckStatus(request, targetUrl, env) {
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
    
    // 获取数据库中的账号数量
    let dbAccountCount = 0;
    if (env.DB) {
      const { results } = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM account_manage
      `).first();
      dbAccountCount = results ? results.count : 0;
    }
    
    return new Response(JSON.stringify({
      authenticated: hasAuth,
      userId: clientCookies["_rid"] || null,
      cookies: Object.keys(clientCookies),
      balance,
      dbAccountCount,
      timestamp: new Date().toISOString()
    }), {
      headers: { 
        "Content-Type": "application/json", 
        "Access-Control-Allow-Origin": "*" 
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: "检查失败", 
      message: error.message 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// ==================== 修复Cookie删除逻辑 ====================
async function handleClearCookies(request) {
  const cookiesToClear = [
    "sb-rls-auth-token",
    "_rid",
    "ph_phc_pXRYopwyByw2wy8XGxzRcko4lPiDr58YspxHOAjThEj_posthog",
    "chosen_language",
    "invite_code",
    "sessionid",
    "_ga",
    "_ga_WTNWK4GPZ6",
    "_gid"
  ];
  
  const setCookieHeaders = cookiesToClear.map(
    (cookie) => `${cookie}=deleted; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=None; Secure`
  );
  
  return new Response(JSON.stringify({ 
    success: true,
    message: "Cookie已清除",
    clearedCookies: cookiesToClear
  }), {
    headers: { 
      "Content-Type": "application/json", 
      "Set-Cookie": setCookieHeaders.join(", ") 
    }
  });
}

// ==================== 代理请求处理（保持不变） ====================
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

// ==================== 注入控制面板（iOS毛玻璃效果） ====================
function injectControlPanel(html, url) {
  const panelHTML = `
    <!-- iOS毛玻璃效果控制面板 -->
    <div id="proxy-control-panel" style="
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: none;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    ">
      <div id="panel-main" style="
        background: rgba(255, 255, 255, 0.25);
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
        border-radius: 20px;
        border: 1px solid rgba(255, 255, 255, 0.3);
        box-shadow: 
          0 8px 32px rgba(0, 0, 0, 0.1),
          0 1px 3px rgba(0, 0, 0, 0.05),
          inset 0 1px 0 rgba(255, 255, 255, 0.1);
        padding: 16px;
        min-width: 300px;
        max-width: 90vw;
        color: #1d1d1f;
      ">
        <!-- 标题栏 -->
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.1);
        ">
          <h3 style="
            margin: 0;
            font-size: 17px;
            font-weight: 600;
            background: linear-gradient(135deg, #007AFF, #5856D6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          ">账号管理面板</h3>
          <button onclick="togglePanel()" style="
            background: none;
            border: none;
            width: 30px;
            height: 30px;
            border-radius: 15px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s;
            color: #8E8E93;
            font-size: 20px;
          ">×</button>
        </div>
        
        <!-- 状态信息 -->
        <div id="status-info" style="margin-bottom: 16px;">
          <div style="
            background: rgba(120, 120, 128, 0.12);
            border-radius: 12px;
            padding: 12px;
            margin-bottom: 8px;
          ">
            <div style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 15px;
            ">
              <span style="color: #8E8E93;">账号状态</span>
              <span id="auth-status" style="
                color: #FF3B30;
                font-weight: 500;
              ">未登录</span>
            </div>
            <div id="account-details" style="
              margin-top: 8px;
              font-size: 13px;
              color: #8E8E93;
              display: none;
            "></div>
          </div>
        </div>
        
        <!-- 操作按钮 -->
        <div style="
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 12px;
        ">
          <button onclick="checkStatus()" style="
            background: rgba(120, 120, 128, 0.12);
            border: none;
            border-radius: 12px;
            padding: 12px;
            font-size: 15px;
            font-weight: 500;
            color: #007AFF;
            cursor: pointer;
            transition: all 0.2s;
          ">状态信息</button>
          <button onclick="showBulkRegister()" style="
            background: rgba(120, 120, 128, 0.12);
            border: none;
            border-radius: 12px;
            padding: 12px;
            font-size: 15px;
            font-weight: 500;
            color: #34C759;
            cursor: pointer;
            transition: all 0.2s;
          ">批量注册</button>
          <button onclick="envCheck()" style="
            background: rgba(120, 120, 128, 0.12);
            border: none;
            border-radius: 12px;
            padding: 12px;
            font-size: 15px;
            font-weight: 500;
            color: #FF9500;
            cursor: pointer;
            transition: all 0.2s;
          ">环境检查</button>
          <button onclick="showAccountManage()" style="
            background: rgba(120, 120, 128, 0.12);
            border: none;
            border-radius: 12px;
            padding: 12px;
            font-size: 15px;
            font-weight: 500;
            color: #AF52DE;
            cursor: pointer;
            transition: all 0.2s;
          ">账号管理</button>
        </div>
        
        <!-- 批量注册表单 -->
        <div id="bulk-register-form" style="
          background: rgba(120, 120, 128, 0.08);
          border-radius: 12px;
          padding: 12px;
          margin-bottom: 12px;
          display: none;
        ">
          <div style="margin-bottom: 12px;">
            <label style="
              display: block;
              font-size: 13px;
              color: #8E8E93;
              margin-bottom: 4px;
            ">注册数量</label>
            <input type="number" id="register-count" value="5" min="1" max="100" style="
              width: 100%;
              padding: 8px 12px;
              border-radius: 8px;
              border: 1px solid rgba(120, 120, 128, 0.2);
              background: rgba(255, 255, 255, 0.5);
              font-size: 15px;
              box-sizing: border-box;
            ">
          </div>
          <div style="margin-bottom: 12px;">
            <label style="
              display: block;
              font-size: 13px;
              color: #8E8E93;
              margin-bottom: 4px;
            ">刷新延迟 (ms)</label>
            <input type="number" id="refresh-delay" value="3000" min="1000" max="10000" style="
              width: 100%;
              padding: 8px 12px;
              border-radius: 8px;
              border: 1px solid rgba(120, 120, 128, 0.2);
              background: rgba(255, 255, 255, 0.5);
              font-size: 15px;
              box-sizing: border-box;
            ">
          </div>
          <div style="display: flex; gap: 8px;">
            <button onclick="startBulkRegister()" style="
              flex: 1;
              background: linear-gradient(135deg, #34C759, #30D158);
              border: none;
              border-radius: 12px;
              padding: 12px;
              font-size: 15px;
              font-weight: 600;
              color: white;
              cursor: pointer;
              transition: all 0.2s;
            ">开始注册</button>
            <button onclick="hideBulkRegister()" style="
              background: rgba(120, 120, 128, 0.12);
              border: none;
              border-radius: 12px;
              padding: 12px;
              font-size: 15px;
              font-weight: 500;
              color: #8E8E93;
              cursor: pointer;
              transition: all 0.2s;
            ">取消</button>
          </div>
        </div>
        
        <!-- 进度显示 -->
        <div id="progress-container" style="
          background: rgba(120, 120, 128, 0.08);
          border-radius: 12px;
          padding: 12px;
          margin-bottom: 12px;
          display: none;
        ">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="font-size: 15px; font-weight: 500;">批量注册进度</span>
            <span id="progress-text" style="font-size: 13px; color: #8E8E93;">0/0</span>
          </div>
          <div style="
            height: 4px;
            background: rgba(120, 120, 128, 0.12);
            border-radius: 2px;
            overflow: hidden;
          ">
            <div id="progress-bar" style="
              height: 100%;
              background: linear-gradient(135deg, #34C759, #30D158);
              width: 0%;
              transition: width 0.3s;
            "></div>
          </div>
          <div style="margin-top: 8px;">
            <button onclick="cancelBulkRegister()" style="
              background: rgba(255, 59, 48, 0.12);
              border: none;
              border-radius: 12px;
              padding: 8px 12px;
              font-size: 14px;
              color: #FF3B30;
              cursor: pointer;
              transition: all 0.2s;
            ">取消注册</button>
          </div>
        </div>
        
        <!-- 消息提示 -->
        <div id="message-container" style="
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(28, 28, 30, 0.9);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-radius: 20px;
          padding: 20px;
          min-width: 280px;
          max-width: 80vw;
          color: white;
          display: none;
          z-index: 1000000;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
        ">
          <div id="message-content" style="text-align: center;"></div>
          <div style="
            display: flex;
            justify-content: center;
            gap: 12px;
            margin-top: 20px;
          ">
            <button id="message-confirm" style="
              background: #007AFF;
              border: none;
              border-radius: 12px;
              padding: 10px 20px;
              color: white;
              font-weight: 600;
              cursor: pointer;
            ">确认</button>
            <button id="message-cancel" style="
              background: rgba(255, 255, 255, 0.1);
              border: none;
              border-radius: 12px;
              padding: 10px 20px;
              color: white;
              font-weight: 600;
              cursor: pointer;
            ">取消</button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 触发按钮 -->
    <div id="panel-trigger" style="
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 999998;
      opacity: 0;
      transition: opacity 0.3s;
    ">
      <button onclick="showPanel()" style="
        background: rgba(255, 255, 255, 0.25);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        width: 50px;
        height: 50px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        transition: all 0.2s;
        color: #007AFF;
        font-size: 20px;
      ">⚙️</button>
    </div>
    
    <script>
      let currentSessionId = null;
      let progressInterval = null;
      
      // 页面加载完成后显示面板
      document.addEventListener('DOMContentLoaded', function() {
        setTimeout(() => {
          document.getElementById('panel-trigger').style.opacity = '1';
          checkInitialStatus();
        }, 3000); // 3秒后显示
      });
      
      // 面板显示/隐藏
      function showPanel() {
        const panel = document.getElementById('proxy-control-panel');
        panel.style.display = 'block';
        setTimeout(() => {
          panel.style.transform = 'translateX(-50%) scale(1)';
          panel.style.opacity = '1';
        }, 10);
      }
      
      function togglePanel() {
        const panel = document.getElementById('proxy-control-panel');
        if (panel.style.transform.includes('scale(0)')) {
          panel.style.transform = 'translateX(-50%) scale(1)';
          panel.style.opacity = '1';
        } else {
          panel.style.transform = 'translateX(-50%) scale(0)';
          panel.style.opacity = '0';
        }
      }
      
      // 检查初始状态
      async function checkInitialStatus() {
        try {
          const response = await fetch('/_proxy/check-status');
          const data = await response.json();
          
          const authStatus = document.getElementById('auth-status');
          const accountDetails = document.getElementById('account-details');
          
          if (data.authenticated) {
            authStatus.textContent = '已登录';
            authStatus.style.color = '#34C759';
            
            accountDetails.style.display = 'block';
            accountDetails.innerHTML = \`
              <div>用户ID: \${data.userId || '未知'}</div>
              <div>余额: \${data.balance}次</div>
              <div>数据库账号: \${data.dbAccountCount || 0}个</div>
            \`;
          } else {
            authStatus.textContent = '未登录';
            authStatus.style.color = '#FF3B30';
          }
        } catch (error) {
          console.error('状态检查失败:', error);
        }
      }
      
      // 状态检查
      async function checkStatus() {
        try {
          const response = await fetch('/_proxy/check-status');
          const data = await response.json();
          
          showMessage(
            \`账号状态检查结果：
            • 登录状态: \${data.authenticated ? '✅ 已登录' : '❌ 未登录'}
            • 用户ID: \${data.userId || '无'}
            • 当前余额: \${data.balance}次
            • Cookie数量: \${data.cookies?.length || 0}个
            • 数据库账号: \${data.dbAccountCount || 0}个\`,
            '确认'
          );
        } catch (error) {
          showMessage(\`状态检查失败: \${error.message}\`, '确认');
        }
      }
      
      // 批量注册
      function showBulkRegister() {
        document.getElementById('bulk-register-form').style.display = 'block';
      }
      
      function hideBulkRegister() {
        document.getElementById('bulk-register-form').style.display = 'none';
      }
      
      async function startBulkRegister() {
        const count = parseInt(document.getElementById('register-count').value) || 5;
        const delay = parseInt(document.getElementById('refresh-delay').value) || 3000;
        
        showMessage(
          \`即将开始批量注册 \${count} 个账号
          注意：此操作会清除当前Cookie并刷新页面
          是否继续？\`,
          '开始注册',
          '取消'
        ).then(confirmed => {
          if (confirmed) {
            executeBulkRegister(count, delay);
          }
        });
      }
      
      async function executeBulkRegister(count, delay) {
        try {
          // 先清除Cookie
          await fetch('/_proxy/clear-cookies');
          
          // 开始批量注册
          const response = await fetch('/_proxy/bulk-register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              count: count,
              autoRefresh: true,
              refreshDelay: delay
            })
          });
          
          const data = await response.json();
          
          if (data.success) {
            currentSessionId = data.sessionId;
            showProgress(data.sessionId);
            hideBulkRegister();
          } else {
            showMessage(\`批量注册启动失败: \${data.message}\`, '确认');
          }
        } catch (error) {
          showMessage(\`批量注册启动失败: \${error.message}\`, '确认');
        }
      }
      
      async function showProgress(sessionId) {
        const progressContainer = document.getElementById('progress-container');
        progressContainer.style.display = 'block';
        
        // 开始轮询进度
        progressInterval = setInterval(async () => {
          try {
            const response = await fetch(\`/_proxy/register-progress?session=\${sessionId}\`);
            const data = await response.json();
            
            const progressText = document.getElementById('progress-text');
            const progressBar = document.getElementById('progress-bar');
            
            if (data.status === 'completed' || data.status === 'failed') {
              clearInterval(progressInterval);
              progressText.textContent = \`完成: \${data.completed_count} / \${data.total_count}\`;
              progressBar.style.width = '100%';
              
              setTimeout(() => {
                progressContainer.style.display = 'none';
                showMessage(
                  \`批量注册完成！
                  成功: \${data.completed_count} 个
                  失败: \${data.failed_count} 个\`,
                  '确认'
                );
                
                // 刷新页面
                location.reload();
              }, 1000);
            } else {
              const progress = (data.completed_count / data.total_count) * 100;
              progressText.textContent = \`\${data.completed_count} / \${data.total_count}\`;
              progressBar.style.width = \`\${progress}%\`;
            }
          } catch (error) {
            console.error('获取进度失败:', error);
          }
        }, 1000);
      }
      
      function cancelBulkRegister() {
        if (progressInterval) {
          clearInterval(progressInterval);
        }
        
        showMessage(
          '是否确认取消批量注册？已注册的账号将保存到数据库。',
          '确认取消',
          '继续注册'
        ).then(confirmed => {
          if (confirmed) {
            document.getElementById('progress-container').style.display = 'none';
            currentSessionId = null;
            showMessage('批量注册已取消', '确认');
          }
        });
      }
      
      // 环境检查
      async function envCheck() {
        try {
          showMessage('正在进行环境检查...', false);
          
          const response = await fetch('/_proxy/env-check');
          const data = await response.json();
          
          let message = \`环境检查结果：
          整体状态: \${data.environment}\n\n\`;
          
          data.results?.forEach(result => {
            message += \`• \${result.endpoint}: \${result.message}\\n\`;
          });
          
          showMessage(message, '确认');
        } catch (error) {
          showMessage(\`环境检查失败: \${error.message}\`, '确认');
        }
      }
      
      // 账号管理
      async function showAccountManage() {
        try {
          const response = await fetch('/_proxy/account-manage?action=list');
          const data = await response.json();
          
          if (data.success) {
            let message = \`账号管理 (共 \${data.count} 个账号)\\n\\n\`;
            
            data.accounts?.slice(0, 5).forEach(account => {
              message += \`• \${account.user_id} - \${account.balance}次 (更新: \${new Date(account.update_time).toLocaleDateString()})\\n\`;
            });
            
            if (data.count > 5) {
              message += \`\\n... 还有 \${data.count - 5} 个账号未显示\`;
            }
            
            showMessage(message, '确认');
          } else {
            showMessage(\`获取账号列表失败: \${data.error}\`, '确认');
          }
        } catch (error) {
          showMessage(\`账号管理失败: \${error.message}\`, '确认');
        }
      }
      
      // 消息提示系统
      function showMessage(content, confirmText = '确认', cancelText = null) {
        return new Promise((resolve) => {
          const container = document.getElementById('message-container');
          const messageContent = document.getElementById('message-content');
          const confirmBtn = document.getElementById('message-confirm');
          const cancelBtn = document.getElementById('message-cancel');
          
          messageContent.textContent = content;
          confirmBtn.textContent = confirmText;
          
          if (cancelText) {
            cancelBtn.textContent = cancelText;
            cancelBtn.style.display = 'block';
          } else {
            cancelBtn.style.display = 'none';
          }
          
          container.style.display = 'block';
          
          const handleConfirm = () => {
            container.style.display = 'none';
            resolve(true);
            cleanup();
          };
          
          const handleCancel = () => {
            container.style.display = 'none';
            resolve(false);
            cleanup();
          };
          
          const cleanup = () => {
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
          };
          
          confirmBtn.addEventListener('click', handleConfirm);
          cancelBtn.addEventListener('click', handleCancel);
        });
      }
      
      // 网络请求监控
      const originalFetch = window.fetch;
      window.fetch = async function(...args) {
        const url = typeof args[0] === 'string' ? args[0] : args[0].url;
        
        // 监控关键API端点
        if (url.includes('/api/auth/token') || url.includes('/api/auth/anonymous-sign-in')) {
          console.log('监控到关键API请求:', url);
          
          const response = await originalFetch.apply(this, args);
          
          if (!response.ok && response.status !== 429) {
            console.warn(\`API端点异常: \${url} - \${response.status}\`);
            
            if (currentSessionId && response.status === 401) {
              showMessage(
                \`检测到IP可能被拉黑，无法获取游客账号
                状态码: \${response.status}
                建议暂停批量注册\`,
                '确认'
              );
            }
          }
          
          return response;
        }
        
        return originalFetch.apply(this, args);
      };
    </script>
    
    <style>
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      
      @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
      }
      
      #proxy-control-panel {
        animation: fadeIn 0.3s ease-out;
      }
      
      #panel-trigger button:hover {
        animation: pulse 1s infinite;
        background: rgba(255, 255, 255, 0.3);
      }
      
      button:hover {
        opacity: 0.9;
        transform: translateY(-1px);
      }
      
      button:active {
        transform: translateY(0);
        opacity: 0.8;
      }
      
      @media (max-width: 768px) {
        #proxy-control-panel {
          top: 10px;
          left: 10px;
          right: 10px;
          transform: none !important;
          width: calc(100vw - 20px);
        }
        
        #panel-trigger {
          top: 10px;
          right: 10px;
        }
      }
    </style>
  `;
  
  return html.replace("</body>", panelHTML + "</body>");
}
__name(injectControlPanel, "injectControlPanel");

// ==================== 原有辅助函数（保持不变） ====================
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
//# sourceMappingURL=worker.js.map