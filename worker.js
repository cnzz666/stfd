var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.js
var worker_default = {
  async fetch(request, env, ctx) {
    await ensureTable(env); // 确保D1表存在

    const url = new URL(request.url);
    const targetUrl = "https://www.xn--i8s951di30azba.com";

    // Basic Auth 身份验证（浏览器原生弹窗），适用于所有路径，除特定_proxy路径和OPTIONS
    const authHeader = request.headers.get('Authorization');
    if (!authHeader && !url.pathname.startsWith('/_proxy/') && request.method !== 'OPTIONS') {
      return new Response('Unauthorized', {
        status: 401,
        headers: { 'WWW-Authenticate': 'Basic realm="Secure Area"' }
      });
    }
    if (authHeader) {
      const [scheme, encoded] = authHeader.split(' ');
      if (scheme === 'Basic') {
        const decoded = atob(encoded);
        const [user, pass] = decoded.split(':');
        if (pass !== '1591156135qwzxcv') {
          return new Response('Unauthorized', { status: 401 });
        }
      } else {
        return new Response('Unauthorized', { status: 401 });
      }
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
        return handleUploadAccount(request, env);
      }
      if (url.pathname === "/_proxy/list-accounts") {
        return handleListAccounts(env);
      }
      if (url.pathname === "/_proxy/get-cookies") {
        return handleGetCookies(request);
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

async function ensureTable(env) {
  const { results } = await env.DB.prepare("PRAGMA table_info(account_manage)").all();
  if (results.length === 0) {
    await env.DB.exec(`
      CREATE TABLE account_manage (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        cookies JSON,
        token TEXT,
        balance INTEGER,
        create_time TIMESTAMP,
        update_time TIMESTAMP,
        status TEXT
      );
    `);
  }
}

async function handleUploadAccount(request, env) {
  try {
    const body = await request.json();
    const id = generateUUID();
    const now = new Date().toISOString();
    const stmt = env.DB.prepare(`
      INSERT INTO account_manage (id, user_id, cookies, token, balance, create_time, update_time, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    await stmt.bind(id, body.userId, JSON.stringify(body.cookies), body.token || '', body.balance || 35, now, now, 'active').run();
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, message: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}

async function handleListAccounts(env) {
  const { results } = await env.DB.prepare("SELECT * FROM account_manage").all();
  return new Response(JSON.stringify(results), { headers: { "Content-Type": "application/json" } });
}

async function handleGetCookies(request) {
  const clientCookies = parseCookies(request.headers.get("cookie") || "");
  return new Response(JSON.stringify(clientCookies), { headers: { "Content-Type": "application/json" } });
}

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

function injectControlPanel(html, url) {
  const panelHTML = `
    <style>
      /* 适配用户提供的毛玻璃iOS风格 */
      html, body {
        height: 100%;
        margin: 0;
        overflow: auto;
        background-color: #e0f7fa; /* 备用浅蓝色背景，作为基础色调 */
      }
      #control-panel, #floating-window, #toast-message, #min-icon {
        font-family: 'Roboto', Arial, sans-serif;
      }
      #control-panel {
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10000;
        background-color: rgba(255, 255, 255, 0.3);
        border-radius: 15px;
        box-shadow: 0 8px 32px rgba(79, 195, 247, 0.3), 0 0 10px rgba(176, 196, 222, 0.2);
        backdrop-filter: blur(5px);
        border: 1px solid rgba(79, 195, 247, 0.3);
        padding: 10px;
        display: flex;
        gap: 10px;
      }
      #floating-window {
        display: none;
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 10001;
        text-align: center;
        max-width: 80%;
        padding: 30px;
        background-color: rgba(255, 255, 255, 0.3);
        border-radius: 15px;
        box-shadow: 0 8px 32px rgba(79, 195, 247, 0.3), 0 0 10px rgba(176, 196, 222, 0.2);
        backdrop-filter: blur(5px);
        border: 1px solid rgba(79, 195, 247, 0.3);
        color: #333333;
        background-image: url('https://www.loliapi.com/acg/');
        background-size: 50% auto; /* 缩小壁纸 */
        background-position: center;
        background-repeat: no-repeat;
      }
      #floating-window::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-image: inherit;
        background-size: cover;
        background-position: center;
        filter: blur(8px);
        z-index: -2;
      }
      #floating-window::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(45deg, rgba(79, 195, 247, 0.2), rgba(176, 196, 222, 0.2));
        z-index: -1;
      }
      #floating-window.loaded {
        transform: translate(-50%, -50%) scale(1);
        opacity: 1;
        filter: blur(0);
      }
      #toast-message {
        display: none;
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10002;
        padding: 10px 20px;
        background-color: rgba(255, 255, 255, 0.8);
        border-radius: 20px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        color: #333;
        font-size: 14px;
        animation: fadeInOut 3s ease-in-out;
      }
      @keyframes fadeInOut {
        0% { opacity: 0; transform: translate(-50%, -20px); }
        10% { opacity: 1; transform: translate(-50%, 0); }
        90% { opacity: 1; transform: translate(-50%, 0); }
        100% { opacity: 0; transform: translate(-50%, -20px); }
      }
      button {
        margin: 10px;
        padding: 12px 20px;
        font-size: 16px;
        border-radius: 25px;
        outline: none;
        background: linear-gradient(45deg, #4fc3f7, #81d4fa);
        border: none;
        color: #333333;
        cursor: pointer;
        font-weight: bold;
        transition: all 0.3s ease;
      }
      button:hover {
        background: linear-gradient(45deg, #29b6f6, #4fc3f7);
        transform: translateY(-2px);
        box-shadow: 0 5px 15px rgba(79, 195, 247, 0.4);
      }
      input {
        margin: 10px;
        padding: 12px;
        border-radius: 25px;
        background-color: rgba(255, 255, 255, 0.5);
        border: 1px solid rgba(79, 195, 247, 0.5);
        color: #333;
      }
      #min-icon {
        display: none;
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 50px;
        height: 50px;
        background: linear-gradient(45deg, #4fc3f7, #81d4fa);
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(79, 195, 247, 0.3);
      }
      @media (max-width: 768px) {
        #floating-window {
          max-width: 90%;
          padding: 20px;
        }
        button, input {
          width: 90%;
          font-size: 14px;
        }
      }
    </style>
    <div id="control-panel">
      <button id="status-btn" disabled>状态信息</button>
      <button id="batch-reg-btn">批量注册</button>
      <button id="env-check-btn">环境检查</button>
      <button id="account-manage-btn">帐号管理</button>
      <button id="close-panel">关闭</button>
    </div>
    <div id="floating-window">
      <div id="window-content"></div>
      <button id="close-window">关闭</button>
    </div>
    <div id="toast-message"></div>
    <div id="min-icon"></div>
    <script>
      // 立即显示面板（网页加载前就开始出现效果，通过注入在<head>后立即执行）
      document.addEventListener('DOMContentLoaded', () => {
        const floatingWindow = document.getElementById('floating-window');
        floatingWindow.classList.add('loaded');
        setTimeout(() => {
          document.getElementById('status-btn').disabled = false;
        }, 3500); // 3-4s后启用状态按钮

        // 网络监听：覆盖fetch监听两个关键接口
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
          const response = await originalFetch(...args);
          const fetchUrl = new URL(args[0], location.origin);
          if (fetchUrl.pathname === '/api/auth/token' || fetchUrl.pathname === '/api/auth/anonymous-sign-in') {
            if (!response.ok) {
              const errorText = await response.text().catch(() => '未知错误');
              showToast(\`请求 \${fetchUrl.pathname} 失败，状态: \${response.status}，错误: \${errorText}\`);
              if (response.status === 429 || response.status === 401) {
                showFloatingWindow('你的IP可能被拉黑，无法获取游客账号。');
              }
            }
          }
          return response;
        };

        // 显示iOS风格toast消息
        function showToast(message) {
          const toast = document.getElementById('toast-message');
          toast.textContent = message;
          toast.style.display = 'block';
          setTimeout(() => { toast.style.display = 'none'; }, 3000);
        }

        // 显示悬浮窗
        function showFloatingWindow(content, extraHTML = '') {
          document.getElementById('window-content').innerHTML = content + extraHTML;
          document.getElementById('floating-window').style.display = 'block';
        }

        // 隐藏悬浮窗
        document.getElementById('close-window').addEventListener('click', () => {
          document.getElementById('floating-window').style.display = 'none';
        });

        // 关闭面板：移动到窗口正中间作为最小化图标
        document.getElementById('close-panel').addEventListener('click', () => {
          document.getElementById('control-panel').style.display = 'none';
          document.getElementById('min-icon').style.display = 'block';
        });

        // 点击最小化图标恢复面板
        document.getElementById('min-icon').addEventListener('click', () => {
          document.getElementById('control-panel').style.display = 'flex';
          document.getElementById('min-icon').style.display = 'none';
        });

        // 状态信息
        document.getElementById('status-btn').addEventListener('click', async () => {
          const res = await fetch('/_proxy/check-status');
          const data = await res.json();
          let content = \`认证: \${data.authenticated ? '是' : '否'}<br>用户ID: \${data.userId || '无'}<br>余额: \${data.balance}<br>时间戳: \${data.timestamp}\`;
          if (data.authenticated) {
            content += '<br><button id="upload-btn">上传到帐号管理</button>';
            showFloatingWindow(content);
            document.getElementById('upload-btn').addEventListener('click', async () => {
              const cookiesRes = await fetch('/_proxy/get-cookies');
              const cookies = await cookiesRes.json();
              const uploadBody = { userId: data.userId, cookies, balance: data.balance };
              const uploadRes = await fetch('/_proxy/upload-account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(uploadBody) });
              const uploadData = await uploadRes.json();
              showToast(uploadData.success ? '上传成功' : '上传失败: ' + uploadData.message);
            });
          } else {
            content += '<br><button id="get-new-account">获取新帐号</button>';
            showFloatingWindow(content);
            document.getElementById('get-new-account').addEventListener('click', handleSingleRegister);
          }
        });

        // 单帐号注册
        async function handleSingleRegister() {
          if (!confirm('此操作可能临时删除本机Cookie，继续？')) return;
          const backupRes = await fetch('/_proxy/get-cookies');
          const backupCookies = await backupRes.json();
          await fetch('/_proxy/clear-cookies');
          const res = await fetch('/_proxy/get-account');
          const data = await res.json();
          if (data.success) {
            showFloatingWindow(\`注册成功！用户ID: \${data.userId}<br>余额: \${data.balance}<br><button id="upload-single">上传</button>\`);
            document.getElementById('upload-single').addEventListener('click', async () => {
              const uploadBody = { userId: data.userId, cookies: data.cookies, balance: data.balance };
              await fetch('/_proxy/upload-account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(uploadBody) });
              showToast('上传成功');
              await fetch('/_proxy/clear-cookies');
              location.reload(); // 刷新
            });
          } else {
            if (data.message.includes('无法从首页提取 code')) {
              showFloatingWindow('无法从首页提取 code，尝试暗地操作...');
              // 尝试无code注册（修改为无code POST）
              const noCodeRes = await fetch('/api/auth/anonymous-sign-in', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: generateUUID(), email: \`\${generateUUID()}@anon.com\`, fp: {} }) }); // 简化fp
              if (noCodeRes.ok) {
                showToast('暗地操作成功');
              } else {
                showToast('暗地操作失败，你的IP可能被拉黑');
              }
            } else {
              showFloatingWindow('注册失败: ' + data.message);
            }
            if (confirm('是否恢复帐号？')) {
              await fetch('/_proxy/inject-cookie', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cookies: backupCookies }) });
              location.reload();
            }
          }
        }

        // 批量注册
        document.getElementById('batch-reg-btn').addEventListener('click', () => {
          const extra = \`
            <input id="batch-num" type="number" placeholder="注册个数" value="5">
            <input id="refresh-time" type="number" placeholder="刷新时间(秒，0为立即)" value="0">
            <button id="start-batch">开始</button>\`;
          showFloatingWindow('批量注册配置', extra);
          document.getElementById('start-batch').addEventListener('click', handleBatchRegister);
        });

        let batchCanceled = false;
        async function handleBatchRegister() {
          const num = parseInt(document.getElementById('batch-num').value);
          const refreshTime = parseInt(document.getElementById('refresh-time').value);
          if (!confirm('此操作可能临时删除本机Cookie，继续？')) return;
          const backupRes = await fetch('/_proxy/get-cookies');
          const backupCookies = await backupRes.json();
          batchCanceled = false;
          let count = 0;
          showFloatingWindow(\`正在批量注册 \${num} 个帐号 已注册: 0 <br><button id="cancel-batch">取消</button>\`);
          document.getElementById('cancel-batch').addEventListener('click', () => {
            batchCanceled = true;
            if (confirm('是否恢复帐号？')) {
              fetch('/_proxy/inject-cookie', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cookies: backupCookies }) });
              location.reload();
            }
          });
          for (let i = 0; i < num; i++) {
            if (batchCanceled) break;
            await fetch('/_proxy/clear-cookies');
            const res = await fetch('/_proxy/get-account');
            const data = await res.json();
            if (data.success) {
              count++;
              const uploadBody = { userId: data.userId, cookies: data.cookies, balance: data.balance };
              await fetch('/_proxy/upload-account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(uploadBody) });
              showFloatingWindow(\`正在批量注册 \${num} 个帐号 已注册: \${count} <br><button id="cancel-batch">取消</button>\`);
              if (refreshTime > 0) {
                await new Promise(resolve => setTimeout(resolve, refreshTime * 1000));
              } else {
                location.reload(); // 立即刷新
              }
            } else {
              showFloatingWindow('注册失败: ' + data.message + '<br><button id="retry-batch">重试</button> <button id="ignore-batch">忽略</button> <button id="cancel-batch">取消</button>');
              // 等待用户选择
              await new Promise(resolve => {
                document.getElementById('retry-batch').addEventListener('click', () => { i--; resolve(); });
                document.getElementById('ignore-batch').addEventListener('click', resolve);
                document.getElementById('cancel-batch').addEventListener('click', () => { batchCanceled = true; resolve(); });
              });
            }
          }
          if (!batchCanceled) showToast('批量注册完成');
        }

        // 环境检查
        document.getElementById('env-check-btn').addEventListener('click', async () => {
          showFloatingWindow('正在进行环境检查 <br><button id="cancel-env">取消</button>');
          // 检查 /api/auth/token
          const tokenRes = await fetch('/api/auth/token');
          const signRes = await fetch('/api/auth/anonymous-sign-in', { method: 'POST', body: '{}' }); // 简化检查
          let content = '';
          if (tokenRes.ok && signRes.ok) {
            content = '环境正常';
          } else {
            content = \`环境异常<br>Token状态: \${tokenRes.status}<br>Sign-in状态: \${signRes.status}\`;
          }
          showFloatingWindow(content);
        });

        // 帐号管理
        document.getElementById('account-manage-btn').addEventListener('click', async () => {
          const res = await fetch('/_proxy/list-accounts');
          const accounts = await res.json();
          let content = '帐号列表:';
          accounts.forEach(acc => {
            content += \`<br>ID: \${acc.user_id}, 余额: \${acc.balance}, 状态: \${acc.status}\`;
          });
          showFloatingWindow(content);
        });

        // 客户端UUID生成（与服务器一致）
        function generateUUID() {
          return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            return (c === "x" ? r : r & 3 | 8).toString(16);
          });
        }
      });
    </script>
  `;
  return html.replace("</body>", panelHTML + "</body>");
}
__name(injectControlPanel, "injectControlPanel");

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
    let code;
    if (!codeMatch) {
      // 按要求，提取失败时尝试暗地操作（这里设为空或固定，假设API允许）
      code = ""; // 尝试无code
    } else {
      code = codeMatch[1];
    }
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
      message: `创建账户失败: ${error.message}`
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
    "sessionid"
  ];
  // 修复删除逻辑：确保彻底清除，包括Max-Age=0和Expires过去时间
  const setCookieHeaders = cookiesToClear.map(
    (cookie) => `${cookie}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=None; Secure; Max-Age=0`
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