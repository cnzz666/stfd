var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ==================== D1 数据库初始化与操作 ====================
async function initDatabase(env) {
  try {
    const tableCheck = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='account_manage'"
    ).first();
    
    if (!tableCheck) {
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS account_manage (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL UNIQUE,
          cookies TEXT NOT NULL,
          token TEXT,
          balance INTEGER DEFAULT 35,
          create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          status TEXT DEFAULT 'active',
          ip_address TEXT,
          user_agent TEXT,
          last_used TIMESTAMP
        )
      `).run();
      
      await env.DB.prepare(`
        CREATE INDEX IF NOT EXISTS idx_user_id ON account_manage(user_id)
      `).run();
      
      console.log("D1 数据库表 'account_manage' 创建成功");
    }
  } catch (error) {
    console.error("D1 数据库初始化失败:", error);
  }
}
__name(initDatabase, "initDatabase");

async function saveAccountToDB(env, accountData) {
  try {
    const { userId, cookies, token, balance = 35, ipAddress, userAgent } = accountData;
    
    const existing = await env.DB.prepare(
      "SELECT id FROM account_manage WHERE user_id = ?"
    ).bind(userId).first();
    
    if (existing) {
      await env.DB.prepare(`
        UPDATE account_manage 
        SET cookies = ?, token = ?, balance = ?, update_time = CURRENT_TIMESTAMP, 
            last_used = CURRENT_TIMESTAMP, ip_address = ?, user_agent = ?
        WHERE user_id = ?
      `).bind(
        JSON.stringify(cookies),
        token || '',
        balance,
        ipAddress || '',
        userAgent || '',
        userId
      ).run();
      console.log(`帐号 ${userId} 已更新到数据库`);
    } else {
      await env.DB.prepare(`
        INSERT INTO account_manage (user_id, cookies, token, balance, ip_address, user_agent)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        userId,
        JSON.stringify(cookies),
        token || '',
        balance,
        ipAddress || '',
        userAgent || ''
      ).run();
      console.log(`新帐号 ${userId} 已保存到数据库`);
    }
    
    return { success: true };
  } catch (error) {
    console.error("保存帐号到数据库失败:", error);
    return { success: false, error: error.message };
  }
}
__name(saveAccountToDB, "saveAccountToDB");

async function getAccountsFromDB(env, limit = 100) {
  try {
    const { results } = await env.DB.prepare(
      "SELECT * FROM account_manage ORDER BY update_time DESC LIMIT ?"
    ).bind(limit).all();
    
    return { success: true, accounts: results || [] };
  } catch (error) {
    console.error("从数据库获取帐号失败:", error);
    return { success: false, error: error.message, accounts: [] };
  }
}
__name(getAccountsFromDB, "getAccountsFromDB");

async function deleteAccountFromDB(env, userId) {
  try {
    await env.DB.prepare(
      "DELETE FROM account_manage WHERE user_id = ?"
    ).bind(userId).run();
    
    return { success: true };
  } catch (error) {
    console.error("从数据库删除帐号失败:", error);
    return { success: false, error: error.message };
  }
}
__name(deleteAccountFromDB, "deleteAccountFromDB");

// ==================== Cookie 操作增强 ====================
const COOKIES_TO_CLEAR = [
  "sb-rls-auth-token",
  "_rid",
  "ph_phc_pXRYopwyByw2wy8XGxzRcko4lPiDr58YspxHOAjThEj_posthog",
  "chosen_language",
  "invite_code",
  "sessionid",
  "_ga",
  "_ga_WTNWK4GPZ6",
  "_gid",
  "__cf_bm",
  "__cflb",
  "__cfruid"
];

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

// ==================== 新增路由处理函数 ====================
async function handleAuthCheck(request, env) {
  try {
    const authHeader = request.headers.get("Authorization");
    const clientCookies = parseCookies(request.headers.get("cookie") || "");
    
    const isAuthenticated = "auth_token" in clientCookies || 
                           (authHeader && authHeader.startsWith("Basic "));
    
    if (!isAuthenticated) {
      return new Response("需要身份验证", {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Basic realm="电子魅魔代理面板", charset="UTF-8"',
          "Content-Type": "text/plain; charset=utf-8"
        }
      });
    }
    
    if (authHeader) {
      const base64Credentials = authHeader.split(" ")[1];
      const credentials = atob(base64Credentials);
      const [username, password] = credentials.split(":");
      
      if (password !== "1591156135qwzxcv") {
        return new Response("密码错误", { status: 401 });
      }
      
      const authToken = btoa(`${username}:${Date.now()}`);
      const setCookieHeader = `auth_token=${authToken}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000`;
      
      return new Response(JSON.stringify({ 
        authenticated: true, 
        username: username,
        message: "身份验证成功" 
      }), {
        headers: { 
          "Content-Type": "application/json",
          "Set-Cookie": setCookieHeader
        }
      });
    }
    
    return new Response(JSON.stringify({ 
      authenticated: true,
      message: "已通过身份验证" 
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: "身份验证失败", 
      message: error.message 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(handleAuthCheck, "handleAuthCheck");

async function handleBatchRegister(request, targetUrl, env) {
  try {
    const body = await request.json();
    const { count = 1, autoRefresh = true, refreshDelay = 3000 } = body;
    const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";
    const userAgent = request.headers.get("user-agent") || "";
    
    const results = [];
    const errors = [];
    let registeredCount = 0;
    
    for (let i = 0; i < count; i++) {
      try {
        console.log(`开始注册第 ${i + 1}/${count} 个帐号`);
        
        const clearResponse = await fetch(new URL("/_proxy/clear-cookies", request.url), {
          method: "POST",
          headers: request.headers
        });
        
        if (!clearResponse.ok) {
          errors.push({ index: i, error: "清除 Cookie 失败" });
          continue;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const registerResponse = await fetch(new URL("/_proxy/get-account", request.url), {
          method: "POST",
          headers: request.headers
        });
        
        if (!registerResponse.ok) {
          const errorText = await registerResponse.text();
          errors.push({ 
            index: i, 
            error: `注册失败: ${registerResponse.status}`,
            details: errorText
          });
          continue;
        }
        
        const registerData = await registerResponse.json();
        
        if (!registerData.success) {
          errors.push({ 
            index: i, 
            error: "注册失败",
            details: registerData.message 
          });
          continue;
        }
        
        const saveResult = await saveAccountToDB(env, {
          userId: registerData.userId,
          cookies: registerData.cookies,
          token: registerData.cookies["sb-rls-auth-token"] || "",
          balance: registerData.balance || 35,
          ipAddress: clientIP,
          userAgent: userAgent
        });
        
        if (saveResult.success) {
          registeredCount++;
          results.push({
            index: i,
            userId: registerData.userId,
            balance: registerData.balance,
            cookies: Object.keys(registerData.cookies),
            timestamp: new Date().toISOString()
          });
          
          console.log(`第 ${i + 1} 个帐号注册成功: ${registerData.userId}`);
        } else {
          errors.push({ 
            index: i, 
            error: "保存到数据库失败",
            details: saveResult.error 
          });
        }
        
        if (autoRefresh && i < count - 1) {
          await new Promise(resolve => setTimeout(resolve, refreshDelay));
        }
        
      } catch (error) {
        errors.push({ 
          index: i, 
          error: "注册过程中异常",
          details: error.message 
        });
        console.error(`第 ${i + 1} 个帐号注册异常:`, error);
      }
    }
    
    return new Response(JSON.stringify({
      success: true,
      message: `批量注册完成，成功 ${registeredCount}/${count}`,
      total: count,
      registered: registeredCount,
      failed: errors.length,
      results: results,
      errors: errors,
      timestamp: new Date().toISOString()
    }), {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      message: "批量注册请求处理失败",
      error: error.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(handleBatchRegister, "handleBatchRegister");

async function handleEnvironmentCheck(request, targetUrl) {
  try {
    const checkResults = [];
    
    try {
      const tokenResponse = await fetch(`${targetUrl}/api/auth/token`, {
        method: "GET",
        headers: {
          "User-Agent": request.headers.get("user-agent") || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "*/*",
          "Referer": targetUrl
        }
      });
      
      checkResults.push({
        endpoint: "/api/auth/token",
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        ok: tokenResponse.ok,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      checkResults.push({
        endpoint: "/api/auth/token",
        status: 0,
        statusText: "请求失败",
        ok: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    
    try {
      const signinResponse = await fetch(`${targetUrl}/api/auth/anonymous-sign-in`, {
        method: "POST",
        headers: {
          "User-Agent": request.headers.get("user-agent") || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "*/*",
          "Content-Type": "application/json",
          "Referer": targetUrl,
          "Origin": targetUrl
        },
        body: JSON.stringify({
          code: "test_environment_check",
          id: "test-" + Date.now(),
          email: `test-${Date.now()}@anon.com`,
          fp: { data: {}, hash: "test" }
        })
      });
      
      checkResults.push({
        endpoint: "/api/auth/anonymous-sign-in",
        status: signinResponse.status,
        statusText: signinResponse.statusText,
        ok: signinResponse.ok,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      checkResults.push({
        endpoint: "/api/auth/anonymous-sign-in",
        status: 0,
        statusText: "请求失败",
        ok: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    
    const allOk = checkResults.every(r => r.ok);
    const has401 = checkResults.some(r => r.status === 401);
    const has429 = checkResults.some(r => r.status === 429);
    
    let status = "normal";
    let message = "环境正常";
    
    if (has429) {
      status = "rate_limited";
      message = "环境异常：接口限流 (429 Too Many Requests)";
    } else if (has401) {
      status = "auth_required";
      message = "环境正常：需要身份验证 (401 Unauthorized)";
    } else if (!allOk) {
      status = "abnormal";
      message = "环境异常：部分接口不可用";
    }
    
    return new Response(JSON.stringify({
      success: true,
      status: status,
      message: message,
      environment: "检测完成",
      results: checkResults,
      timestamp: new Date().toISOString(),
      note: "基于您提供的抓包记录检测：401为正常认证要求，429为限流，其他非200状态可能表示环境异常"
    }), {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      status: "error",
      message: "环境检查失败",
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(handleEnvironmentCheck, "handleEnvironmentCheck");

async function handleAccountManagement(request, env) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action") || "list";
    
    switch (action) {
      case "list": {
        const limit = parseInt(url.searchParams.get("limit") || "100");
        const result = await getAccountsFromDB(env, limit);
        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json" }
        });
      }
      
      case "delete": {
        const userId = url.searchParams.get("user_id");
        if (!userId) {
          return new Response(JSON.stringify({
            success: false,
            message: "缺少 user_id 参数"
          }), { status: 400 });
        }
        
        const result = await deleteAccountFromDB(env, userId);
        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json" }
        });
      }
      
      case "upload": {
        const clientCookies = parseCookies(request.headers.get("cookie") || "");
        const userId = clientCookies["_rid"] || `upload-${Date.now()}`;
        
        if (Object.keys(clientCookies).length === 0) {
          return new Response(JSON.stringify({
            success: false,
            message: "没有可上传的 Cookie"
          }), { status: 400 });
        }
        
        const result = await saveAccountToDB(env, {
          userId: userId,
          cookies: clientCookies,
          token: clientCookies["sb-rls-auth-token"] || "",
          balance: 35,
          ipAddress: request.headers.get("CF-Connecting-IP") || "unknown",
          userAgent: request.headers.get("user-agent") || ""
        });
        
        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json" }
        });
      }
      
      default:
        return new Response(JSON.stringify({
          success: false,
          message: "未知的操作类型",
          available_actions: ["list", "delete", "upload"]
        }), { status: 400 });
    }
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      message: "帐号管理操作失败",
      error: error.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(handleAccountManagement, "handleAccountManagement");

async function handleClearCookies(request) {
  try {
    const setCookieHeaders = COOKIES_TO_CLEAR.map((cookie) => {
      return `${cookie}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=None; Secure; Max-Age=0`;
    });
    
    const additionalCookies = COOKIES_TO_CLEAR.map((cookie) => {
      return `${cookie}=; Path=/; Domain=.xn--i8s951di30azba.com; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=None; Secure; Max-Age=0`;
    });
    
    const allHeaders = [...setCookieHeaders, ...additionalCookies];
    
    return new Response(JSON.stringify({ 
      success: true,
      message: `已清除 ${COOKIES_TO_CLEAR.length} 个 Cookie`,
      clearedCookies: COOKIES_TO_CLEAR
    }), {
      headers: { 
        "Content-Type": "application/json", 
        "Set-Cookie": allHeaders.join(", ") 
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      message: "清除 Cookie 失败",
      error: error.message 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(handleClearCookies, "handleClearCookies");

async function handleCheckStatus(request, targetUrl) {
  try {
    const clientCookies = parseCookies(request.headers.get("cookie") || "");
    const hasAuth = "sb-rls-auth-token" in clientCookies;
    
    let balance = 0;
    let userInfo = null;
    let quotaInfo = null;
    
    if (hasAuth) {
      try {
        const meResponse = await fetch(targetUrl + "/api/me", {
          headers: {
            "Cookie": request.headers.get("cookie") || ""
          }
        });
        
        if (meResponse.ok) {
          const meData = await meResponse.json();
          balance = meData.credit || 0;
          userInfo = {
            id: meData.id,
            email: meData.email,
            createdAt: meData.created_at
          };
        }
        
        const quotaResponse = await fetch(targetUrl + "/api/quota", {
          headers: {
            "Cookie": request.headers.get("cookie") || ""
          }
        });
        
        if (quotaResponse.ok) {
          quotaInfo = await quotaResponse.json();
        }
      } catch (error) {
        console.warn("获取用户信息失败:", error);
      }
    }
    
    const interfaceStatus = {
      token: { checked: false, status: null, message: "" },
      signin: { checked: false, status: null, message: "" }
    };
    
    try {
      const tokenCheck = await fetch(targetUrl + "/api/auth/token", {
        method: "HEAD"
      });
      interfaceStatus.token = {
        checked: true,
        status: tokenCheck.status,
        ok: tokenCheck.ok,
        message: tokenCheck.statusText
      };
    } catch (error) {
      interfaceStatus.token.message = error.message;
    }
    
    return new Response(JSON.stringify({
      authenticated: hasAuth,
      userId: clientCookies["_rid"] || null,
      cookies: Object.keys(clientCookies),
      balance: balance,
      userInfo: userInfo,
      quotaInfo: quotaInfo,
      interfaceStatus: interfaceStatus,
      timestamp: new Date().toISOString(),
      recommendations: !hasAuth ? [
        "当前未检测到有效 Cookie",
        "点击「获取新帐号」按钮创建游客帐号",
        "或手动注入有效 Cookie"
      ] : [
        `当前余额: ${balance} 次免费额度`,
        "Cookie 有效，可以正常使用聊天功能"
      ]
    }), {
      headers: { 
        "Content-Type": "application/json", 
        "Access-Control-Allow-Origin": "*" 
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: "状态检查失败", 
      message: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(handleCheckStatus, "handleCheckStatus");

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

async function handleGetAccount(request, targetUrl) {
  try {
    const homeHeaders = {
      "User-Agent": request.headers.get("user-agent") || "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
      "Accept-Encoding": "gzip, deflate, br",
      "Connection": "keep-alive",
      "Upgrade-Insecure-Requests": "1"
    };
    const homeResp = await fetch(targetUrl, {
      headers: homeHeaders
    });
    if (!homeResp.ok) {
      throw new Error(`首页请求失败: ${homeResp.status}`);
    }
    const html = await homeResp.text();
    const codeMatch = html.match(/"code":"([^"]+)"/);
    if (!codeMatch) {
      throw new Error("无法从首页提取 code");
    }
    const code = codeMatch[1];
    console.log("Extracted code:", code);
    const userId = generateUUID();
    const email = `${userId}@anon.com`;
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
          useragent: request.headers.get("user-agent") || "Mozilla/5.0 (Linux; Android 10; PBEM00 Build/QKQ1.190918.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.7681.2 Mobile Safari/537.36",
          hardwareConcurrency: 8,
          browser: { name: "Chrome", version: "147.0" },
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
      code,
      id: userId,
      email,
      fp
    };
    const requestId = Math.random().toString(36).substring(2, 10);
    const headers = {
      "Content-Type": "application/json",
      "User-Agent": request.headers.get("user-agent") || "Mozilla/5.0 (Linux; Android 10; PBEM00 Build/QKQ1.190918.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.7681.2 Mobile Safari/537.36",
      "Accept": "*/*",
      "Origin": targetUrl,
      "Referer": targetUrl + "/",
      "x-dzmm-request-id": requestId,
      "sec-ch-ua": '"Not.A/Brand";v="8", "Chromium";v="147"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "x-requested-with": "mark.via"
    };
    const clientCookies = parseCookies(request.headers.get("cookie") || "");
    const phCookie = clientCookies["ph_phc_pXRYopwyByw2wy8XGxzRcko4lPiDr58YspxHOAjThEj_posthog"];
    if (phCookie) {
      headers["Cookie"] = `ph_phc_pXRYopwyByw2wy8XGxzRcko4lPiDr58YspxHOAjThEj_posthog=${phCookie}`;
    }
    let response;
    let retries = 3;
    while (retries-- > 0) {
      response = await fetch(targetUrl + "/api/auth/anonymous-sign-in", {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody)
      });
      if (response.status !== 429) break;
      await new Promise((resolve) => setTimeout(resolve, 1e3));
    }
    if (!response || !response.ok) {
      const errorText = response ? await response.text() : "无响应";
      throw new Error(`API返回 ${response?.status || "未知"}: ${errorText}`);
    }
    const responseText = await response.text();
    console.log(`API Response Status: ${response.status}, Body: ${responseText}`);
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
    return new Response(JSON.stringify({
      success: true,
      message: "游客账户创建成功",
      cookies,
      userId: cookies["_rid"] || data.id,
      balance: 35,
      expiresAt: new Date(Date.now() + 3600 * 1e3).toISOString(),
      note: "通过纯动态流程注册，拥有35次免费额度。"
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": Object.entries(cookies).map(([name, value]) => `${name}=${value}; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=31536000`).join(", ")
      }
    });
  } catch (error) {
    console.error(`Error in handleGetAccount: ${error.message}`);
    return new Response(JSON.stringify({
      success: false,
      message: `创建账户失败: ${error.message}`,
      suggestion: "无法从页面提取code，尝试暗地操作"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(handleGetAccount, "handleGetAccount");

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

function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === "x" ? r : r & 3 | 8).toString(16);
  });
}
__name(generateUUID, "generateUUID");

// ==================== iOS毛玻璃控制面板注入（修复按钮显示延迟）====================
function injectControlPanel(html, url) {
  const panelHTML = `
<!-- iOS毛玻璃控制面板 -->
<div id="xc-panel-wrapper" style="
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 2147483647;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
">
  <!-- 中上角功能按钮 - 修复过渡延迟，改为0.5s直接淡入 -->
  <div id="xc-toggle-btn" style="
    position: fixed;
    top: 15px;
    left: 50%;
    transform: translateX(-50%);
    pointer-events: auto;
    z-index: 10000;
    opacity: 0;
    transition: opacity 0.5s ease;
  ">
    <button onclick="toggleControlPanel()" style="
      background: rgba(255, 255, 255, 0.25);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 20px;
      padding: 10px 20px;
      color: white;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      transition: all 0.3s ease;
    ">
      🎛️ 控制中心
    </button>
  </div>
  
  <!-- 主控制面板 -->
  <div id="xc-main-panel" style="
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) scale(0.9);
    width: 90%;
    max-width: 400px;
    max-height: 80vh;
    overflow-y: auto;
    background: rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(30px) saturate(180%);
    -webkit-backdrop-filter: blur(30px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 24px;
    padding: 24px;
    box-shadow: 
      0 20px 60px rgba(0, 0, 0, 0.3),
      0 0 0 1px rgba(255, 255, 255, 0.1) inset;
    pointer-events: auto;
    opacity: 0;
    visibility: hidden;
    transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    z-index: 9999;
  ">
    <!-- 关闭按钮 -->
    <div style="text-align: right; margin-bottom: 20px;">
      <button onclick="closeControlPanel()" style="
        background: rgba(255, 255, 255, 0.2);
        border: none;
        border-radius: 50%;
        width: 36px;
        height: 36px;
        color: white;
        font-size: 18px;
        cursor: pointer;
        transition: all 0.2s ease;
      ">×</button>
    </div>
    
    <!-- 面板标题 -->
    <h2 style="
      color: white;
      margin: 0 0 20px 0;
      font-size: 24px;
      font-weight: 700;
      text-align: center;
      text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
    ">🎮 电子魅魔控制中心</h2>
    
    <!-- 环境状态信息 -->
    <div id="xc-env-status" style="
      background: rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 16px;
      margin-bottom: 16px;
    ">
      <h3 style="color: white; margin: 0 0 12px 0; font-size: 16px;">🌍 环境状态</h3>
      <div id="xc-env-content" style="color: rgba(255, 255, 255, 0.9); font-size: 14px;">
        🕐 检测中...
      </div>
    </div>
    
    <!-- 帐号状态信息 -->
    <div id="xc-acc-status" style="
      background: rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 16px;
      margin-bottom: 16px;
    ">
      <h3 style="color: white; margin: 0 0 12px 0; font-size: 16px;">📊 帐号状态</h3>
      <div id="xc-acc-content" style="color: rgba(255, 255, 255, 0.9); font-size: 14px;">
        ⏳ 检测中...
      </div>
    </div>
    
    <!-- 功能按钮组 -->
    <div style="display: grid; gap: 12px; margin-bottom: 20px;">
      <button onclick="checkStatus()" style="
        background: linear-gradient(135deg, rgba(10, 132, 255, 0.8), rgba(0, 122, 255, 0.8));
        border: none;
        border-radius: 14px;
        padding: 16px;
        color: white;
        font-weight: 600;
        font-size: 16px;
        cursor: pointer;
        transition: all 0.3s ease;
      ">🔍 检查状态</button>
      
      <button onclick="getNewAccount()" style="
        background: linear-gradient(135deg, rgba(52, 199, 89, 0.8), rgba(48, 209, 88, 0.8));
        border: none;
        border-radius: 14px;
        padding: 16px;
        color: white;
        font-weight: 600;
        font-size: 16px;
        cursor: pointer;
        transition: all 0.3s ease;
      ">🆕 获取新帐号</button>
      
      <button onclick="showBatchRegister()" style="
        background: linear-gradient(135deg, rgba(255, 159, 10, 0.8), rgba(255, 149, 0, 0.8));
        border: none;
        border-radius: 14px;
        padding: 16px;
        color: white;
        font-weight: 600;
        font-size: 16px;
        cursor: pointer;
        transition: all 0.3s ease;
      ">🔄 批量注册</button>
      
      <button onclick="checkEnvironment()" style="
        background: linear-gradient(135deg, rgba(175, 82, 222, 0.8), rgba(191, 90, 242, 0.8));
        border: none;
        border-radius: 14px;
        padding: 16px;
        color: white;
        font-weight: 600;
        font-size: 16px;
        cursor: pointer;
        transition: all 0.3s ease;
      ">🔧 环境检查</button>
      
      <button onclick="manageAccounts()" style="
        background: linear-gradient(135deg, rgba(255, 69, 58, 0.8), rgba(255, 59, 48, 0.8));
        border: none;
        border-radius: 14px;
        padding: 16px;
        color: white;
        font-weight: 600;
        font-size: 16px;
        cursor: pointer;
        transition: all 0.3s ease;
      ">📋 帐号管理</button>
    </div>
    
    <!-- 高级功能 -->
    <details style="
      background: rgba(255, 255, 255, 0.05);
      border-radius: 14px;
      padding: 12px;
      margin-bottom: 16px;
    ">
      <summary style="color: white; font-weight: 600; cursor: pointer;">⚙️ 高级功能</summary>
      <div style="margin-top: 12px; display: grid; gap: 8px;">
        <button onclick="injectCookie()" style="
          background: rgba(255, 255, 255, 0.15);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 10px;
          padding: 10px;
          color: white;
          font-size: 14px;
          cursor: pointer;
        ">🍪 注入Cookie</button>
        
        <button onclick="clearCookies()" style="
          background: rgba(255, 255, 255, 0.15);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 10px;
          padding: 10px;
          color: white;
          font-size: 14px;
          cursor: pointer;
        ">🗑️ 清除Cookie</button>
        
        <button onclick="uploadCurrentCookie()" style="
          background: rgba(255, 255, 255, 0.15);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 10px;
          padding: 10px;
          color: white;
          font-size: 14px;
          cursor: pointer;
        ">📤 上传当前Cookie</button>
        
        <button onclick="showInterfaceMonitor()" style="
          background: rgba(255, 255, 255, 0.15);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 10px;
          padding: 10px;
          color: white;
          font-size: 14px;
          cursor: pointer;
        ">📡 接口监控</button>
      </div>
    </details>
    
    <!-- 底部信息 -->
    <div style="
      text-align: center;
      color: rgba(255, 255, 255, 0.6);
      font-size: 12px;
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    ">
      <div>🎯 默认密码: 1591156135qwzxcv</div>
      <div>💎 新用户额度: 35元/次</div>
      <div>🕐 面板将在 3 秒后显示</div>
    </div>
  </div>
  
  <!-- iOS灵动岛通知 -->
  <div id="xc-notification" style="
    position: fixed;
    top: 20px;
    right: 20px;
    max-width: 300px;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-radius: 18px;
    padding: 14px 18px;
    color: white;
    font-size: 14px;
    pointer-events: auto;
    transform: translateY(-100px);
    opacity: 0;
    transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
    z-index: 10001;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    display: none;
  ">
    <div style="display: flex; align-items: center; gap: 10px;">
      <div id="xc-notification-icon" style="font-size: 18px;">💡</div>
      <div style="flex: 1;">
        <div id="xc-notification-title" style="font-weight: 600; margin-bottom: 4px;">通知标题</div>
        <div id="xc-notification-message" style="opacity: 0.9;">通知内容</div>
      </div>
      <button onclick="closeNotification()" style="
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.7);
        font-size: 20px;
        cursor: pointer;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">×</button>
    </div>
  </div>
  
  <!-- 批量注册悬浮窗 -->
  <div id="xc-batch-modal" style="
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 90%;
    max-width: 350px;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(30px);
    -webkit-backdrop-filter: blur(30px);
    border-radius: 24px;
    padding: 24px;
    color: white;
    pointer-events: auto;
    z-index: 10002;
    display: none;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.15);
  ">
    <h3 style="margin: 0 0 20px 0; text-align: center;">🔄 批量注册设置</h3>
    
    <div style="margin-bottom: 16px;">
      <label style="display: block; margin-bottom: 8px; opacity: 0.9;">注册数量</label>
      <input type="number" id="xc-batch-count" value="5" min="1" max="100" style="
        width: 100%;
        padding: 12px;
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        background: rgba(255, 255, 255, 0.1);
        color: white;
        font-size: 16px;
        box-sizing: border-box;
      ">
    </div>
    
    <div style="margin-bottom: 16px;">
      <label style="display: block; margin-bottom: 8px; opacity: 0.9;">刷新延迟 (毫秒)</label>
      <input type="number" id="xc-refresh-delay" value="3000" min="1000" max="10000" style="
        width: 100%;
        padding: 12px;
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        background: rgba(255, 255, 255, 0.1);
        color: white;
        font-size: 16px;
        box-sizing: border-box;
      ">
    </div>
    
    <div style="display: flex; gap: 12px; margin-top: 24px;">
      <button onclick="startBatchRegister()" style="
        flex: 1;
        background: linear-gradient(135deg, #34c759, #30d158);
        border: none;
        border-radius: 12px;
        padding: 14px;
        color: white;
        font-weight: 600;
        cursor: pointer;
      ">开始注册</button>
      
      <button onclick="closeBatchModal()" style="
        flex: 1;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 12px;
        padding: 14px;
        color: white;
        font-weight: 600;
        cursor: pointer;
      ">取消</button>
    </div>
    
    <div id="xc-batch-progress" style="
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      display: none;
    ">
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span>进度</span>
        <span id="xc-batch-progress-text">0/0</span>
      </div>
      <div style="
        height: 6px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 3px;
        overflow: hidden;
      ">
        <div id="xc-batch-progress-bar" style="
          height: 100%;
          width: 0%;
          background: linear-gradient(90deg, #34c759, #30d158);
          transition: width 0.3s ease;
        "></div>
      </div>
      <div style="text-align: center; margin-top: 12px;">
        <button onclick="cancelBatchRegister()" style="
          background: rgba(255, 59, 48, 0.8);
          border: none;
          border-radius: 10px;
          padding: 8px 16px;
          color: white;
          font-size: 14px;
          cursor: pointer;
        ">取消注册</button>
      </div>
    </div>
  </div>
  
  <!-- 接口监控面板 -->
  <div id="xc-interface-monitor" style="
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 90%;
    max-width: 400px;
    background: rgba(0, 0, 0, 0.9);
    backdrop-filter: blur(30px);
    -webkit-backdrop-filter: blur(30px);
    border-radius: 24px;
    padding: 24px;
    color: white;
    pointer-events: auto;
    z-index: 10003;
    display: none;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.2);
  ">
    <h3 style="margin: 0 0 20px 0; text-align: center;">📡 接口监控</h3>
    
    <div style="margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
        <span>接口</span>
        <span>状态</span>
      </div>
      <div id="xc-interface-list" style="
        background: rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        padding: 12px;
        max-height: 200px;
        overflow-y: auto;
      ">
        <div style="color: rgba(255, 255, 255, 0.7); text-align: center; padding: 20px;">
          等待监控数据...
        </div>
      </div>
    </div>
    
    <div style="text-align: center;">
      <button onclick="closeInterfaceMonitor()" style="
        background: linear-gradient(135deg, #ff3b30, #ff453a);
        border: none;
        border-radius: 12px;
        padding: 12px 24px;
        color: white;
        font-weight: 600;
        cursor: pointer;
      ">关闭</button>
    </div>
  </div>
</div>

<script>
// 全局变量
let currentBatchProcess = null;
let notificationTimeout = null;
let interfaceMonitorData = {
  '/api/auth/token': { lastStatus: null, lastTime: null, count: 0 },
  '/api/auth/anonymous-sign-in': { lastStatus: null, lastTime: null, count: 0 }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
  // 延迟3秒后显示控制面板按钮
  setTimeout(() => {
    const btn = document.getElementById('xc-toggle-btn');
    btn.style.opacity = '1';
    
    // 显示欢迎通知
    showNotification('🎉 控制面板已就绪', '页面加载完成，点击顶部按钮打开控制面板', 'info');
    
    // 自动检查环境状态
    autoCheckEnvironment();
    
    // 自动检查帐号状态
    setTimeout(checkStatus, 1000);
  }, 3000);
  
  // 监听网络请求（监控关键接口）
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = typeof args[0] === 'string' ? args[0] : args[0].url;
    
    // 监控关键接口
    if (url && (url.includes('/api/auth/token') || url.includes('/api/auth/anonymous-sign-in'))) {
      const startTime = Date.now();
      const endpoint = url.includes('/api/auth/token') ? '/api/auth/token' : '/api/auth/anonymous-sign-in';
      
      return originalFetch.apply(this, args).then(response => {
        // 记录接口状态
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        if (!interfaceMonitorData[endpoint]) {
          interfaceMonitorData[endpoint] = { lastStatus: null, lastTime: null, count: 0 };
        }
        
        interfaceMonitorData[endpoint].lastStatus = response.status;
        interfaceMonitorData[endpoint].lastTime = new Date().toLocaleTimeString();
        interfaceMonitorData[endpoint].count++;
        
        // 更新环境状态显示（如果面板已打开）
        updateEnvironmentStatus();
        
        if (!response.ok) {
          showNotification('⚠️ 接口异常', \`\${endpoint} 返回 \${response.status}\`, 'warning');
        }
        
        return response;
      }).catch(error => {
        const endPoint = url.includes('/api/auth/token') ? '/api/auth/token' : '/api/auth/anonymous-sign-in';
        if (!interfaceMonitorData[endPoint]) {
          interfaceMonitorData[endPoint] = { lastStatus: null, lastTime: null, count: 0 };
        }
        interfaceMonitorData[endPoint].lastStatus = 'error';
        interfaceMonitorData[endPoint].lastTime = new Date().toLocaleTimeString();
        interfaceMonitorData[endPoint].count++;
        updateEnvironmentStatus();
        return Promise.reject(error);
      });
    }
    
    return originalFetch.apply(this, args);
  };
});

// 显示iOS风格通知
function showNotification(title, message, type = 'info') {
  const notification = document.getElementById('xc-notification');
  const iconMap = {
    info: '💡',
    success: '✅',
    warning: '⚠️',
    error: '❌',
    loading: '⏳'
  };
  
  document.getElementById('xc-notification-icon').textContent = iconMap[type] || '💡';
  document.getElementById('xc-notification-title').textContent = title;
  document.getElementById('xc-notification-message').textContent = message;
  
  notification.style.display = 'block';
  setTimeout(() => {
    notification.style.transform = 'translateY(0)';
    notification.style.opacity = '1';
  }, 10);
  
  // 自动关闭通知
  if (notificationTimeout) clearTimeout(notificationTimeout);
  notificationTimeout = setTimeout(closeNotification, 5000);
}

function closeNotification() {
  const notification = document.getElementById('xc-notification');
  notification.style.transform = 'translateY(-100px)';
  notification.style.opacity = '0';
  setTimeout(() => {
    notification.style.display = 'none';
  }, 500);
}

// 控制面板显示/隐藏
function toggleControlPanel() {
  const panel = document.getElementById('xc-main-panel');
  const isVisible = panel.style.visibility === 'visible';
  
  if (isVisible) {
    closeControlPanel();
  } else {
    panel.style.visibility = 'visible';
    panel.style.opacity = '1';
    panel.style.transform = 'translate(-50%, -50%) scale(1)';
    showNotification('📱 控制面板', '面板已打开', 'info');
  }
}

function closeControlPanel() {
  const panel = document.getElementById('xc-main-panel');
  panel.style.opacity = '0';
  panel.style.transform = 'translate(-50%, -50%) scale(0.9)';
  setTimeout(() => {
    panel.style.visibility = 'hidden';
  }, 400);
}

// 自动检查环境状态
function autoCheckEnvironment() {
  fetch('/_proxy/environment-check')
    .then(response => response.json())
    .then(data => {
      let statusText = '';
      let statusColor = '#34c759';
      
      if (data.status === 'normal' || data.status === 'auth_required') {
        statusText = \`🌍 环境正常 (\${data.status === 'auth_required' ? '需认证' : '正常'})\`;
        statusColor = '#34c759';
      } else if (data.status === 'rate_limited') {
        statusText = '⚠️ 环境限流 (429)';
        statusColor = '#ff9500';
      } else {
        statusText = '❌ 环境异常';
        statusColor = '#ff3b30';
      }
      
      // 显示状态码信息
      let details = '';
      if (data.results && data.results.length > 0) {
        data.results.forEach(result => {
          const statusEmoji = result.ok ? '✅' : (result.status === 429 ? '⚠️' : '❌');
          details += \`<div style="margin-top: 4px; font-size: 12px;">\${statusEmoji} \${result.endpoint}: \${result.status} \${result.statusText}</div>\`;
        });
      }
      
      document.getElementById('xc-env-content').innerHTML = \`
        <div style="color: \${statusColor}; font-weight: 600;">\${statusText}</div>
        \${details}
        <div style="margin-top: 8px; font-size: 12px; opacity: 0.8;">🕒 \${new Date().toLocaleTimeString()}</div>
      \`;
      
      // 如果不是正常状态，显示通知
      if (data.status !== 'normal' && data.status !== 'auth_required') {
        showNotification('🌍 环境状态', data.message, data.status === 'rate_limited' ? 'warning' : 'error');
      }
    })
    .catch(error => {
      document.getElementById('xc-env-content').innerHTML = \`
        <div style="color: #ff3b30;">❌ 环境检查失败</div>
        <div style="font-size: 12px;">\${error.message}</div>
      \`;
    });
}

// 更新环境状态显示
function updateEnvironmentStatus() {
  let envStatus = '🌍 环境正常';
  let envColor = '#34c759';
  let details = '';
  
  for (const [endpoint, data] of Object.entries(interfaceMonitorData)) {
    if (data.lastStatus) {
      const statusEmoji = data.lastStatus === 200 ? '✅' : 
                         data.lastStatus === 401 ? '🔒' : 
                         data.lastStatus === 429 ? '⚠️' : '❌';
      details += \`<div style="margin-top: 4px; font-size: 12px;">\${statusEmoji} \${endpoint}: \${data.lastStatus} (\${data.lastTime})</div>\`;
      
      if (data.lastStatus !== 200 && data.lastStatus !== 401 && data.lastStatus !== 'error') {
        envStatus = '⚠️ 环境异常';
        envColor = '#ff9500';
      }
      if (data.lastStatus === 429) {
        envStatus = '🚫 环境限流';
        envColor = '#ff3b30';
      }
    }
  }
  
  if (details) {
    document.getElementById('xc-env-content').innerHTML = \`
      <div style="color: \${envColor}; font-weight: 600;">\${envStatus}</div>
      \${details}
      <div style="margin-top: 8px; font-size: 12px; opacity: 0.8;">🔄 实时监控中</div>
    \`;
  }
}

// 检查状态
function checkStatus() {
  showNotification('⏳ 状态检查', '正在检查帐号状态...', 'loading');
  
  fetch('/_proxy/check-status')
    .then(response => response.json())
    .then(data => {
      let statusHtml = '';
      
      if (data.authenticated) {
        statusHtml = \`
          <div style="color: #34c759; font-weight: 600;">✅ 已登录</div>
          <div>👤 用户ID: \${data.userId || '未知'}</div>
          <div>💰 余额: \${data.balance} 次</div>
          <div>🍪 Cookie数量: \${data.cookies.length}</div>
          <div>\${data.recommendations?.join('<br>') || ''}</div>
        \`;
        showNotification('✅ 状态正常', \`已登录，余额: \${data.balance}次\`, 'success');
      } else {
        statusHtml = \`
          <div style="color: #ff3b30; font-weight: 600;">❌ 未登录</div>
          <div>未检测到有效Cookie</div>
          <div>\${data.recommendations?.join('<br>') || ''}</div>
        \`;
        showNotification('⚠️ 未登录', '点击"获取新帐号"按钮创建游客帐号', 'warning');
      }
      
      document.getElementById('xc-acc-content').innerHTML = statusHtml;
    })
    .catch(error => {
      document.getElementById('xc-acc-content').innerHTML = \`
        <div style="color: #ff3b30;">❌ 检查失败</div>
        <div>\${error.message}</div>
      \`;
      showNotification('❌ 检查失败', error.message, 'error');
    });
}

// 获取新帐号
function getNewAccount() {
  if (!confirm('⚠️ 此操作将清除当前Cookie并创建新帐号，继续吗？')) return;
  
  showNotification('⏳ 注册中', '正在创建新帐号...', 'loading');
  
  fetch('/_proxy/clear-cookies', { method: 'POST' })
    .then(() => {
      return fetch('/_proxy/get-account', { method: 'POST' });
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        showNotification('✅ 注册成功', \`新帐号创建成功，ID: \${data.userId}\`, 'success');
        
        // 自动上传到数据库
        uploadCurrentCookie();
        
        // 刷新页面
        setTimeout(() => {
          location.reload();
        }, 2000);
      } else {
        showNotification('❌ 注册失败', data.message, 'error');
      }
    })
    .catch(error => {
      showNotification('❌ 注册失败', error.message, 'error');
    });
}

// 批量注册
function showBatchRegister() {
  document.getElementById('xc-batch-modal').style.display = 'block';
}

function closeBatchModal() {
  document.getElementById('xc-batch-modal').style.display = 'none';
  document.getElementById('xc-batch-progress').style.display = 'none';
}

function startBatchRegister() {
  const count = parseInt(document.getElementById('xc-batch-count').value) || 5;
  const delay = parseInt(document.getElementById('xc-refresh-delay').value) || 3000;
  
  if (count < 1 || count > 100) {
    showNotification('❌ 参数错误', '注册数量需在1-100之间', 'error');
    return;
  }
  
  if (!confirm(\`⚠️ 即将批量注册 \${count} 个帐号，这会清除Cookie并刷新页面，继续吗？\`)) return;
  
  // 显示进度条
  document.getElementById('xc-batch-progress').style.display = 'block';
  document.getElementById('xc-batch-progress-text').textContent = \`0/\${count}\`;
  document.getElementById('xc-batch-progress-bar').style.width = '0%';
  
  showNotification('🔄 批量注册', \`开始注册 \${count} 个帐号...\`, 'loading');
  
  // 开始批量注册
  let registered = 0;
  let cancelled = false;
  
  currentBatchProcess = {
    cancel: function() {
      cancelled = true;
      showNotification('⏹️ 已取消', '批量注册已被取消', 'warning');
    }
  };
  
  function registerNext() {
    if (cancelled || registered >= count) {
      if (registered >= count) {
        showNotification('✅ 批量完成', \`成功注册 \${registered} 个帐号\`, 'success');
        setTimeout(() => location.reload(), 2000);
      }
      return;
    }
    
    fetch('/_proxy/clear-cookies', { method: 'POST' })
      .then(() => {
        return fetch('/_proxy/get-account', { method: 'POST' });
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          registered++;
          
          // 更新进度
          const progress = (registered / count) * 100;
          document.getElementById('xc-batch-progress-text').textContent = \`\${registered}/\${count}\`;
          document.getElementById('xc-batch-progress-bar').style.width = \`\${progress}%\`;
          
          // 上传到数据库
          fetch('/_proxy/account-manage?action=upload', { method: 'POST' });
          
          if (registered < count) {
            setTimeout(registerNext, delay);
          } else {
            showNotification('✅ 批量完成', \`成功注册 \${registered} 个帐号\`, 'success');
            setTimeout(() => location.reload(), 2000);
          }
        } else {
          showNotification('❌ 注册失败', \`第 \${registered + 1} 个帐号注册失败\`, 'error');
          if (registered < count) {
            setTimeout(registerNext, delay);
          }
        }
      })
      .catch(error => {
        showNotification('❌ 注册失败', \`第 \${registered + 1} 个帐号注册异常\`, 'error');
        if (registered < count) {
          setTimeout(registerNext, delay);
        }
      });
  }
  
  registerNext();
}

function cancelBatchRegister() {
  if (currentBatchProcess) {
    currentBatchProcess.cancel();
    currentBatchProcess = null;
  }
  closeBatchModal();
}

// 环境检查
function checkEnvironment() {
  showNotification('🔧 环境检查', '正在检查环境状态...', 'loading');
  
  fetch('/_proxy/environment-check')
    .then(response => response.json())
    .then(data => {
      let message = data.message;
      let type = 'info';
      
      if (data.status === 'normal' || data.status === 'auth_required') {
        type = 'success';
      } else if (data.status === 'rate_limited') {
        type = 'warning';
      } else {
        type = 'error';
      }
      
      showNotification('🔧 环境状态', message, type);
      
      // 更新环境状态显示
      let statusText = '';
      let statusColor = '#34c759';
      
      if (data.status === 'normal' || data.status === 'auth_required') {
        statusText = \`🌍 环境正常 (\${data.status === 'auth_required' ? '需认证' : '正常'})\`;
        statusColor = '#34c759';
      } else if (data.status === 'rate_limited') {
        statusText = '⚠️ 环境限流 (429)';
        statusColor = '#ff9500';
      } else {
        statusText = '❌ 环境异常';
        statusColor = '#ff3b30';
      }
      
      let details = '';
      if (data.results && data.results.length > 0) {
        data.results.forEach(result => {
          const statusEmoji = result.ok ? '✅' : (result.status === 429 ? '⚠️' : '❌');
          details += \`<div style="margin-top: 4px; font-size: 12px;">\${statusEmoji} \${result.endpoint}: \${result.status} \${result.statusText}</div>\`;
        });
      }
      
      document.getElementById('xc-env-content').innerHTML = \`
        <div style="color: \${statusColor}; font-weight: 600;">\${statusText}</div>
        \${details}
        <div style="margin-top: 8px; font-size: 12px; opacity: 0.8;">🕒 \${new Date().toLocaleTimeString()}</div>
      \`;
    })
    .catch(error => {
      showNotification('❌ 检查失败', error.message, 'error');
    });
}

// 帐号管理
function manageAccounts() {
  showNotification('📋 帐号管理', '正在加载帐号列表...', 'loading');
  
  fetch('/_proxy/account-manage?action=list')
    .then(response => response.json())
    .then(data => {
      if (data.success && data.accounts.length > 0) {
        let accountList = '📋 帐号列表:\\n\\n';
        data.accounts.forEach((acc, index) => {
          accountList += \`\${index + 1}. 👤 ID: \${acc.user_id} (💰 余额: \${acc.balance})\\n\`;
        });
        
        accountList += \`\\n📊 共 \${data.accounts.length} 个帐号\\n\\n是否打开详细管理页面？\`;
        
        if (confirm(accountList)) {
          // 这里可以打开详细管理页面
          showNotification('📋 帐号管理', \`加载了 \${data.accounts.length} 个帐号\`, 'success');
        }
      } else {
        showNotification('📋 帐号管理', '数据库中没有帐号记录', 'info');
      }
    })
    .catch(error => {
      showNotification('❌ 加载失败', error.message, 'error');
    });
}

// Cookie操作
function injectCookie() {
  const cookieStr = prompt('请输入要注入的Cookie字符串（格式: name=value; name2=value2）:');
  if (!cookieStr) return;
  
  const cookies = {};
  cookieStr.split(';').forEach(pair => {
    const [name, value] = pair.trim().split('=');
    if (name && value) cookies[name] = value;
  });
  
  fetch('/_proxy/inject-cookie', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cookies })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      showNotification('✅ Cookie注入', 'Cookie注入成功，即将刷新页面', 'success');
      setTimeout(() => location.reload(), 1000);
    } else {
      showNotification('❌ 注入失败', data.message, 'error');
    }
  })
  .catch(error => {
    showNotification('❌ 注入失败', error.message, 'error');
  });
}

function clearCookies() {
  if (!confirm('⚠️ 即将清除所有Cookie，这会导致退出登录，继续吗？')) return;
  
  fetch('/_proxy/clear-cookies', { method: 'POST' })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        showNotification('✅ Cookie清除', 'Cookie已清除，即将刷新页面', 'success');
        setTimeout(() => location.reload(), 1000);
      } else {
        showNotification('❌ 清除失败', data.message, 'error');
      }
    })
    .catch(error => {
      showNotification('❌ 清除失败', error.message, 'error');
    });
}

function uploadCurrentCookie() {
  showNotification('📤 上传中', '正在上传当前Cookie到数据库...', 'loading');
  
  fetch('/_proxy/account-manage?action=upload', { method: 'POST' })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        showNotification('✅ 上传成功', '当前Cookie已保存到数据库', 'success');
      } else {
        showNotification('❌ 上传失败', data.message, 'error');
      }
    })
    .catch(error => {
      showNotification('❌ 上传失败', error.message, 'error');
    });
}

// 接口监控
function showInterfaceMonitor() {
  // 更新监控数据
  let interfaceHtml = '';
  
  for (const [endpoint, data] of Object.entries(interfaceMonitorData)) {
    if (data.lastStatus) {
      const statusEmoji = data.lastStatus === 200 ? '✅' : 
                         data.lastStatus === 401 ? '🔒' : 
                         data.lastStatus === 429 ? '⚠️' : '❌';
      const statusText = data.lastStatus === 200 ? '正常' : 
                        data.lastStatus === 401 ? '需认证' : 
                        data.lastStatus === 429 ? '限流' : '异常';
      const statusColor = data.lastStatus === 200 ? '#34c759' : 
                         data.lastStatus === 401 ? '#007aff' : 
                         data.lastStatus === 429 ? '#ff9500' : '#ff3b30';
      
      interfaceHtml += \`
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        ">
          <div style="flex: 1;">
            <div style="font-weight: 500;">\${endpoint}</div>
            <div style="font-size: 11px; opacity: 0.7;">🕒 \${data.lastTime || '未请求'}</div>
          </div>
          <div style="text-align: right;">
            <div style="color: \${statusColor}; font-weight: 600;">\${statusEmoji} \${data.lastStatus} (\${statusText})</div>
            <div style="font-size: 11px; opacity: 0.7;">📊 \${data.count} 次</div>
          </div>
        </div>
      \`;
    } else {
      interfaceHtml += \`
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        ">
          <div style="flex: 1;">
            <div style="font-weight: 500;">\${endpoint}</div>
          </div>
          <div style="text-align: right;">
            <div style="color: rgba(255, 255, 255, 0.5);">⏳ 等待请求</div>
          </div>
        </div>
      \`;
    }
  }
  
  document.getElementById('xc-interface-list').innerHTML = interfaceHtml || 
    '<div style="color: rgba(255, 255, 255, 0.7); text-align: center; padding: 20px;">等待监控数据...</div>';
  
  document.getElementById('xc-interface-monitor').style.display = 'block';
}

function closeInterfaceMonitor() {
  document.getElementById('xc-interface-monitor').style.display = 'none';
}

// 身份验证
function requireAuth() {
  const username = prompt('请输入用户名:');
  if (!username) return;
  
  const password = prompt('请输入密码:');
  if (!password) return;
  
  const authHeader = 'Basic ' + btoa(\`\${username}:\${password}\`);
  
  fetch('/_proxy/auth-check', {
    headers: { 'Authorization': authHeader }
  })
  .then(response => {
    if (response.ok) {
      showNotification('✅ 身份验证', '身份验证成功', 'success');
      return response.json();
    } else {
      throw new Error('身份验证失败');
    }
  })
  .then(data => {
    showNotification('✅ 欢迎回来', \`用户: \${data.username}\`, 'success');
  })
  .catch(error => {
    showNotification('❌ 验证失败', '用户名或密码错误', 'error');
  });
}

// 自动检查是否需要身份验证
setTimeout(() => {
  fetch('/_proxy/auth-check')
    .then(response => {
      if (response.status === 401) {
        showNotification('🔒 需要登录', '本网站要求进行身份验证', 'info');
        setTimeout(requireAuth, 1000);
      }
    })
    .catch(() => {});
}, 2000);
</script>
`;
  
  // 替换原页面背景为毛玻璃效果
  const backgroundStyle = `
    <style>
      body {
        position: relative;
        min-height: 100vh;
      }
      body::before {
        content: '';
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-image: url('https://www.loliapi.com/acg/');
        background-size: cover;
        background-position: center;
        filter: blur(15px) brightness(0.7);
        z-index: -1;
      }
      body::after {
        content: '';
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(45deg, 
          rgba(79, 195, 247, 0.15), 
          rgba(176, 196, 222, 0.15),
          rgba(255, 107, 107, 0.1)
        );
        z-index: -1;
      }
    </style>
  `;
  
  // 注入背景样式和控制面板
  let modifiedHtml = html.replace('<head>', `<head>${backgroundStyle}`);
  return modifiedHtml.replace('</body>', panelHTML + '</body>');
}
__name(injectControlPanel, "injectControlPanel");

// ==================== 新增：认证辅助函数（修复登录逻辑）====================
async function authenticateRequest(request, env) {
  const authHeader = request.headers.get("Authorization");
  const clientCookies = parseCookies(request.headers.get("cookie") || "");
  
  // 检查 auth_token cookie
  if (clientCookies["auth_token"]) {
    return { authenticated: true };
  }
  
  // 检查 Basic 认证
  if (authHeader && authHeader.startsWith("Basic ")) {
    try {
      const base64Credentials = authHeader.split(" ")[1];
      const credentials = atob(base64Credentials);
      const [username, password] = credentials.split(":");
      
      if (password === "1591156135qwzxcv") {
        // 生成新的 auth_token 以便后续使用
        const authToken = btoa(`${username}:${Date.now()}`);
        return { authenticated: true, authToken };
      }
    } catch (e) {}
  }
  
  return { authenticated: false };
}
__name(authenticateRequest, "authenticateRequest");

// ==================== 主Worker入口（修复认证拦截）====================
var worker_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const targetUrl = "https://www.xn--i8s951di30azba.com";
    
    if (env.DB) {
      await initDatabase(env);
    }
    
    // 处理身份验证专用端点
    if (url.pathname === '/_proxy/auth-check') {
      return handleAuthCheck(request, env);
    }
    
    // 对其他路径执行认证检查
    const authResult = await authenticateRequest(request, env);
    if (!authResult.authenticated) {
      return new Response("需要身份验证", {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Basic realm="电子魅魔代理面板", charset="UTF-8"',
          "Content-Type": "text/plain; charset=utf-8"
        }
      });
    }
    
    // 用于记录是否需要添加认证 Cookie
    let authTokenToSet = authResult.authToken;
    
    try {
      let response;
      
      if (url.pathname === "/_proxy/get-account") {
        response = await handleGetAccount(request, targetUrl);
      } else if (url.pathname === "/_proxy/check-status") {
        response = await handleCheckStatus(request, targetUrl);
      } else if (url.pathname === "/_proxy/clear-cookies") {
        response = await handleClearCookies(request);
      } else if (url.pathname === "/_proxy/inject-cookie") {
        response = await handleInjectCookie(request);
      } else if (url.pathname === "/_proxy/batch-register") {
        response = await handleBatchRegister(request, targetUrl, env);
      } else if (url.pathname === "/_proxy/environment-check") {
        response = await handleEnvironmentCheck(request, targetUrl);
      } else if (url.pathname === "/_proxy/account-manage") {
        response = await handleAccountManagement(request, env);
      } else {
        response = await handleProxyRequest(request, targetUrl, url);
      }
      
      // 如果需要设置新的认证 Cookie，则添加到响应头
      if (authTokenToSet) {
        const newHeaders = new Headers(response.headers);
        newHeaders.append('Set-Cookie', `auth_token=${authTokenToSet}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000`);
        response = new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders
        });
      }
      
      return response;
    } catch (error) {
      return new Response(`代理错误: ${error.message}`, {
        status: 500,
        headers: { "Content-Type": "text/plain" }
      });
    }
  }
};

export {
  worker_default as default
};