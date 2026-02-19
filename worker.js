var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.js
var worker_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const targetUrl = "https://www.xn--i8s951di30azba.com";

    // Basic Auth for all paths
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Basic ")) {
      return new Response("Unauthorized", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="Secure Area"' }
      });
    }
    const credentials = atob(authHeader.split(" ")[1]).split(":");
    const username = credentials[0];
    const password = credentials[1];
    if (password !== "1591156135qwzxcv") {
      return new Response("Unauthorized", { status: 401 });
    }

    try {
      if (url.pathname === "/_proxy/get-account") {
        return handleGetAccount(request, targetUrl);
      }
      if (url.pathname === "/_proxy/check-status") {
        return handleCheckStatus(request, targetUrl);
      }
      if (url.pathname === "/_proxy/clear-cookies") {
        return handleClearCookies(request);
      }
      if (url.pathname === "/_proxy/inject-cookie") {
        return handleInjectCookie(request);
      }
      if (url.pathname === "/_proxy/upload-account") {
        return handleUploadAccount(request, env.DB);
      }
      if (url.pathname === "/_proxy/list-accounts") {
        return handleListAccounts(request, env.DB);
      }
      if (url.pathname === "/_proxy/check-environment") {
        return handleCheckEnvironment(request, targetUrl);
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

  // Monitor specific paths for non-200 status
  if (url.pathname === "/api/auth/token" || url.pathname === "/api/auth/anonymous-sign-in") {
    if (!response.ok) {
      console.log(`Monitored path ${url.pathname} returned ${response.status}`);
      // We can't directly prompt from worker, but client JS will handle via fetch checks
    }
  }

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

function injectControlPanel(html, url) {
  const panelHTML = `
    <style>
      /* Adapted from user's reference HTML, with iOS-like fur glass effect */
      .floating-panel {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        background-color: rgba(255, 255, 255, 0.3);
        backdrop-filter: blur(10px);
        border-radius: 15px;
        box-shadow: 0 8px 32px rgba(79, 195, 247, 0.3);
        border: 1px solid rgba(79, 195, 247, 0.3);
        padding: 20px;
        width: 300px;
        font-family: 'Roboto', Arial, sans-serif;
        color: #333;
        transition: all 0.3s ease;
        background-image: url('https://www.loliapi.com/acg/');
        background-size: 100px; /* Small pattern */
        background-repeat: repeat;
      }
      .floating-panel.minimized {
        top: 50%;
        right: auto;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 50px;
        height: 50px;
        padding: 0;
        overflow: hidden;
      }
      .floating-panel button {
        background: linear-gradient(45deg, #4fc3f7, #81d4fa);
        border: none;
        color: #333;
        padding: 10px;
        margin: 5px 0;
        border-radius: 25px;
        cursor: pointer;
        width: 100%;
        transition: all 0.3s ease;
      }
      .floating-panel button:hover {
        background: linear-gradient(45deg, #29b6f6, #4fc3f7);
        transform: translateY(-2px);
      }
      .floating-panel .close-btn {
        position: absolute;
        top: 5px;
        right: 5px;
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
      }
      .floating-panel .status-info {
        margin-bottom: 15px;
      }
      .floating-panel input {
        width: 100%;
        padding: 10px;
        margin: 5px 0;
        border-radius: 25px;
        border: 1px solid rgba(79, 195, 247, 0.5);
        background: rgba(255, 255, 255, 0.5);
      }
      .notification {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(255, 255, 255, 0.8);
        backdrop-filter: blur(10px);
        padding: 20px;
        border-radius: 15px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        z-index: 10000;
        text-align: center;
        transition: opacity 0.3s ease;
      }
      .notification button {
        margin: 10px 5px;
      }
    </style>
    <div id="floating-panel" class="floating-panel">
      <button class="close-btn" onclick="minimizePanel()">×</button>
      <div class="status-info" id="status-info"></div>
      <button onclick="checkStatus()">帐号状态信息</button>
      <input type="number" id="batch-count" placeholder="批量注册个数" min="1">
      <input type="number" id="refresh-time" placeholder="刷新时间(秒，可选)">
      <button onclick="startBatchRegister()">批量注册帐号</button>
      <button onclick="checkEnvironment()">环境检查</button>
      <button onclick="listAccounts()">帐号管理</button>
      <button onclick="devModeToggle()">开发模式</button>
    </div>
    <div id="notification" class="notification" style="display:none;"></div>
    <script>
      let devMode = false;
      let backupCookies = null;
      let batchInterval = null;
      let registeredCount = 0;
      let targetCount = 0;
      let refreshTime = 0;

      window.addEventListener('load', () => {
        setTimeout(() => {
          document.getElementById('floating-panel').style.display = 'block';
        }, 3000); // Wait 3s after load
      });

      function minimizePanel() {
        const panel = document.getElementById('floating-panel');
        panel.classList.add('minimized');
        // Click to reopen
        panel.onclick = () => {
          panel.classList.remove('minimized');
          panel.onclick = null;
        };
      }

      async function checkStatus() {
        try {
          const res = await fetch('/_proxy/check-status', { credentials: 'include' });
          const data = await res.json();
          const infoDiv = document.getElementById('status-info');
          if (data.authenticated) {
            infoDiv.innerHTML = \`已登录<br>用户ID: \${data.userId}<br>配额: \${data.balance}<br>Cookies: \${data.cookies.join(', ')}\`;
            // Show upload button
            infoDiv.innerHTML += '<button onclick="uploadCurrentAccount()">上传到帐号管理</button>';
          } else {
            infoDiv.innerHTML = '未登录<br><button onclick="getNewAccount()">获取新帐号</button>';
          }
        } catch (e) {
          showNotification('检查失败: ' + e.message);
        }
      }

      async function getNewAccount() {
        if (!confirm('此操作可能临时删除本机 Cookie，继续？')) return;
        await fetch('/_proxy/clear-cookies');
        location.reload();
        await new Promise(r => setTimeout(r, 4000)); // Wait 4s
        const res = await fetch('/_proxy/get-account');
        if (!res.ok) {
          showNotification('注册失败: ' + await res.text(), true);
          return;
        }
        const data = await res.json();
        if (data.success) {
          const statusRes = await fetch('/_proxy/check-status');
          const statusData = await statusRes.json();
          await uploadToDB(data.userId, data.cookies, statusData.balance);
          await fetch('/_proxy/clear-cookies');
          location.reload();
        } else {
          showNotification('注册失败: ' + data.message, true);
        }
      }

      function startBatchRegister() {
        targetCount = parseInt(document.getElementById('batch-count').value) || 1;
        refreshTime = parseInt(document.getElementById('refresh-time').value) * 1000 || 0;
        if (!confirm('此操作可能临时删除本机 Cookie，继续？')) return;
        backupCookies = document.cookie;
        registeredCount = 0;
        showNotification(\`正在批量注册 \${targetCount} 个帐号 已注册 0 个 <button onclick="cancelBatch()">取消</button>\`, false, true);
        batchLoop();
      }

      async function batchLoop() {
        if (registeredCount >= targetCount) {
          showNotification('批量注册完成');
          return;
        }
        await fetch('/_proxy/clear-cookies');
        location.reload();
        await new Promise(r => setTimeout(r, refreshTime || 4000));
        const res = await fetch('/_proxy/get-account');
        if (!res.ok) {
          const errText = await res.text();
          showNotification('注册失败: ' + errText + '<br><button onclick="retryBatch()">重试</button><button onclick="ignoreError()">忽略</button><button onclick="cancelBatch()">取消</button>', true);
          return;
        }
        const data = await res.json();
        if (data.success) {
          const statusRes = await fetch('/_proxy/check-status');
          const statusData = await statusRes.json();
          await uploadToDB(data.userId, data.cookies, statusData.balance);
          registeredCount++;
          showNotification(\`正在批量注册 \${targetCount} 个帐号 已注册 \${registeredCount} 个 <button onclick="cancelBatch()">取消</button>\`, false, true);
          batchLoop();
        } else {
          showNotification('注册失败: ' + data.message + '<br><button onclick="retryBatch()">重试</button><button onclick="ignoreError()">忽略</button><button onclick="cancelBatch()">取消</button>', true);
        }
      }

      function cancelBatch() {
        if (confirm('是否需要恢复帐号？')) {
          document.cookie = backupCookies;
          location.reload();
        }
        showNotification('批量注册已取消');
      }

      function retryBatch() {
        batchLoop();
      }

      function ignoreError() {
        registeredCount++;
        batchLoop();
      }

      async function uploadCurrentAccount() {
        const statusRes = await fetch('/_proxy/check-status');
        const statusData = await statusRes.json();
        if (statusData.authenticated) {
          const cookies = {};
          statusData.cookies.forEach(name => {
            cookies[name] = getCookie(name);
          });
          await uploadToDB(statusData.userId, cookies, statusData.balance);
        }
      }

      async function uploadToDB(userId, cookies, balance) {
        const token = cookies['sb-rls-auth-token'] || '';
        await fetch('/_proxy/upload-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, cookies: JSON.stringify(cookies), token, balance, status: 'active' })
        });
      }

      async function listAccounts() {
        const res = await fetch('/_proxy/list-accounts');
        const accounts = await res.json();
        let list = '帐号列表:<br>';
        accounts.forEach(acc => {
          list += \`ID: \${acc.user_id}, 配额: \${acc.balance}, 状态: \${acc.status}<br><button onclick="injectAccount('\${acc.user_id}')">登录</button><br>\`;
        });
        showNotification(list, false);
      }

      async function injectAccount(userId) {
        // Fetch account from DB, but for simplicity, assume client fetches list with cookies
        const res = await fetch('/_proxy/list-accounts');
        const accounts = await res.json();
        const acc = accounts.find(a => a.user_id === userId);
        if (acc) {
          await fetch('/_proxy/inject-cookie', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cookies: JSON.parse(acc.cookies) })
          });
          location.reload();
        }
      }

      async function checkEnvironment() {
        showNotification('正在进行环境检查 <button onclick="cancelCheck()">取消</button>', false, true);
        location.reload();
        await new Promise(r => setTimeout(r, 4000));
        const tokenRes = await fetch('/api/auth/token', { method: 'GET', credentials: 'include' });
        const signRes = await fetch('/api/auth/anonymous-sign-in', { method: 'POST', credentials: 'include', body: '{}' }); // Dummy body
        let msg = '';
        if (tokenRes.status === 200 && signRes.status === 200) {
          msg = '环境正常';
        } else {
          msg = \`环境异常<br>/api/auth/token: \${tokenRes.status}<br>/api/auth/anonymous-sign-in: \${signRes.status}\`;
          if (signRes.status === 429) msg += '<br>可能IP被拉黑';
        }
        showNotification(msg);
      }

      function cancelCheck() {
        showNotification('环境检查已取消');
      }

      function devModeToggle() {
        devMode = !devMode;
        showNotification(\`开发模式: \${devMode ? '开启' : '关闭'}\`);
        if (devMode) console.log('Dev mode: More logs enabled');
      }

      function showNotification(message, autoHide = true, persistent = false) {
        const notif = document.getElementById('notification');
        notif.innerHTML = message;
        notif.style.display = 'block';
        if (autoHide) setTimeout(() => notif.style.display = 'none', 5000);
        if (!persistent) notif.onclick = () => notif.style.display = 'none';
      }

      function getCookie(name) {
        const value = \`; \${document.cookie}\`;
        const parts = value.split(\`; \${name}=\`);
        if (parts.length === 2) return parts.pop().split(';').shift();
      }
    </script>
  `;
  return html.replace("</body>", panelHTML + "</body>");
}
__name(injectControlPanel, "injectControlPanel");

async function handleGetAccount(request, targetUrl) {
  try {
    // Removed code extraction as per user instruction "不要获取code"
    // Assume API works without code
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
      message: "游客帐户创建成功",
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
      message: `创建帐户失败: ${error.message}`
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(handleGetAccount, "handleGetAccount");

async function handleCheckStatus(request, targetUrl) {
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
    return new Response(JSON.stringify({
      authenticated: hasAuth,
      userId: clientCookies["_rid"] || null,
      cookies: Object.keys(clientCookies),
      balance,
      timestamp: (new Date()).toISOString()
    }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "检查失败", message: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(handleCheckStatus, "handleCheckStatus");

async function handleClearCookies(request) {
  const cookiesToClear = [
    "sb-rls-auth-token",
    "_rid",
    "ph_phc_pXRYopwyByw2wy8XGxzRcko4lPiDr58YspxHOAjThEj_posthog",
    "chosen_language",
    "invite_code",
    "sessionid",
    // Added more to fix deletion issues, ensure thorough clear
    "_ga_WTNWK4GPZ6",
    "_ga"
  ];
  const setCookieHeaders = cookiesToClear.map(
    (cookie) => `${cookie}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=None; Secure`
  );
  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json", "Set-Cookie": setCookieHeaders.join(", ") }
  });
}
__name(handleClearCookies, "handleClearCookies");

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

async function handleUploadAccount(request, db) {
  await ensureTable(db);
  const body = await request.json();
  const { user_id, cookies, token, balance, status } = body;
  await db.prepare("INSERT OR REPLACE INTO account_manage (user_id, cookies, token, balance, status) VALUES (?, ?, ?, ?, ?)")
    .bind(user_id, cookies, token, balance, status)
    .run();
  return new Response(JSON.stringify({ success: true }), { status: 200 });
}

async function handleListAccounts(request, db) {
  await ensureTable(db);
  const { results } = await db.prepare("SELECT * FROM account_manage").all();
  return new Response(JSON.stringify(results || []), { status: 200 });
}

async function handleCheckEnvironment(request, targetUrl) {
  // Proxy check for the two paths
  const tokenReq = new Request(targetUrl + "/api/auth/token", { method: "GET" });
  const tokenRes = await fetch(tokenReq);
  const signReq = new Request(targetUrl + "/api/auth/anonymous-sign-in", { method: "POST", body: "{}" });
  const signRes = await fetch(signReq);
  const result = {
    tokenStatus: tokenRes.status,
    signStatus: signRes.status,
    normal: tokenRes.status === 200 && signRes.status === 200
  };
  return new Response(JSON.stringify(result), { status: 200 });
}

async function ensureTable(db) {
  const tableExists = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='account_manage'").first();
  if (!tableExists) {
    await db.prepare(`
      CREATE TABLE account_manage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT UNIQUE,
        cookies TEXT,
        token TEXT,
        balance INTEGER,
        create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status TEXT
      )
    `).run();
  }
}

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