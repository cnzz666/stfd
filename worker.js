var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

const TARGET_URL = "https://www.xn--i8s951di30azba.com";

// 主Worker - 完全无验证、无数据库、无批量、无检查
var worker_default = {
  async fetch(request) {
    const url = new URL(request.url);

    // 极简控制接口（仅用于面板状态同步）
    if (url.pathname.startsWith("/_proxy/")) {
      return handleControlRequest(request);
    }

    try {
      return await handleMainProxy(request, url);
    } catch (error) {
      return new Response(`Proxy Error: ${error.message}`, { 
        status: 502,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }
  }
};

// ==================== 核心代理 ====================
async function handleMainProxy(request, url) {
  const targetHeaders = new Headers(request.headers);
  targetHeaders.set("host", "www.xn--i8s951di30azba.com");
  targetHeaders.set("origin", TARGET_URL);
  targetHeaders.set("referer", TARGET_URL + url.pathname);
  targetHeaders.delete("cf-connecting-ip");
  targetHeaders.delete("cf-ray");
  targetHeaders.delete("x-forwarded-for");

  const targetRequest = new Request(TARGET_URL + url.pathname + url.search, {
    method: request.method,
    headers: targetHeaders,
    body: request.body,
    redirect: "manual"
  });

  let response = await fetch(targetRequest);

  // 强制黑客修改（服务器端实时注入）
  response = await applyHacks(response, url.pathname + url.search, request);

  return processFinalResponse(response, request);
}

// ==================== 黑客核心（基于HAR真实路径） ====================
async function applyHacks(response, fullPath, originalRequest) {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    return response;
  }

  try {
    const cloned = response.clone();
    let data = await cloned.json();

    // /api/me /api/user /api/profile /api/account - 无限积分 + VIP3
    if (fullPath.includes("/me") || fullPath.includes("/user") || fullPath.includes("/profile") || fullPath.includes("/account")) {
      if (typeof data === "object" && data !== null) {
        // 无限积分锁定
        if (data.credit !== undefined) data.credit = 999999999;
        if (data.credits !== undefined) data.credits = 999999999;
        if (data.balance !== undefined) data.balance = 999999999;
        if (data.remaining !== undefined) data.remaining = 999999999;
        if (data.available !== undefined) data.available = 999999999;

        // 强制最高VIP3（HAR中明确vip1/vip2/vip3）
        data.membership = "vip3";
        data.vip_level = 3;
        data.vip = true;
        data.is_vip = true;
        data.is_premium = true;

        // 解锁全部高级权限
        if (!data.permissions) data.permissions = {};
        data.permissions.nsfw = true;
        data.permissions.unlimited = true;
        data.permissions.premium_chat = true;
        data.permissions.all_models = true;
      }
    }

    // /api/chat - 零消耗生成
    if (fullPath.includes("/chat")) {
      if (typeof data === "object" && data !== null) {
        if (data.cost !== undefined) data.cost = 0;
        if (data.deducted !== undefined) data.deducted = 0;
        if (data.remaining !== undefined) data.remaining = 999999999;
        if (data.success === false && data.message?.includes("credit")) data.success = true;
      }
    }

    // 钱包/余额/heartbeat - 锁定高值
    if (fullPath.includes("/wallet") || fullPath.includes("/balance") || fullPath.includes("/heartbeat")) {
      if (typeof data === "object" && data !== null) {
        data.balance = 999999999;
        data.u_balance = 999999999;
        data.available = 999999999;
        if (data.message === "ok") data.credit = 999999999;
      }
    }

    const newBody = JSON.stringify(data);
    const newHeaders = new Headers(response.headers);
    newHeaders.set("content-length", newBody.length.toString());

    return new Response(newBody, {
      status: response.status,
      headers: newHeaders
    });
  } catch (e) {
    return response;
  }
}

async function processFinalResponse(response, originalRequest) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("text/html")) {
    let html = await response.text();
    html = injectTechControlPanel(html);

    const newHeaders = new Headers(response.headers);
    newHeaders.set("Content-Type", "text/html; charset=utf-8");
    newHeaders.delete("content-security-policy");
    newHeaders.delete("content-security-policy-report-only");
    newHeaders.set("Access-Control-Allow-Origin", "*");
    newHeaders.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    newHeaders.set("Access-Control-Allow-Headers", "*");

    return new Response(html, {
      status: response.status,
      headers: newHeaders
    });
  }

  const newHeaders = new Headers(response.headers);
  newHeaders.set("Access-Control-Allow-Origin", "*");
  newHeaders.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  newHeaders.set("Access-Control-Allow-Headers", "*");

  return new Response(response.body, {
    status: response.status,
    headers: newHeaders
  });
}

// ==================== 灵动岛风格科技面板注入（手机端极致丝滑） ====================
function injectTechControlPanel(html) {
  const panelHTML = `
    <!-- 触发胶囊（灵动岛风格） -->
    <div id="dynamic-pill" style="
      position: fixed;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2147483647;
      background: rgba(15,15,20,0.92);
      backdrop-filter: blur(40px);
      -webkit-backdrop-filter: blur(40px);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 9999px;
      padding: 7px 22px;
      display: flex;
      align-items: center;
      gap: 9px;
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: -0.3px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      transition: all 0.35s cubic-bezier(0.23,1,0.32,1);
      cursor: pointer;
      user-select: none;
    ">
      <div style="width:7px;height:7px;background:#22ff99;border-radius:50%;box-shadow:0 0 14px #22ff99;animation:pulse 1.8s infinite;"></div>
      <span>NEURAL OVERRIDE</span>
    </div>

    <!-- 主面板 -->
    <div id="tech-panel" style="
      position: fixed;
      bottom: -100%;
      left: 0;
      right: 0;
      z-index: 2147483646;
      background: rgba(12,12,18,0.96);
      backdrop-filter: blur(50px);
      -webkit-backdrop-filter: blur(50px);
      border-top: 1px solid rgba(255,255,255,0.1);
      border-radius: 32px 32px 0 0;
      padding: 28px 20px 50px;
      max-height: 78vh;
      overflow-y: auto;
      transition: bottom 0.55s cubic-bezier(0.32,0.72,0,1);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #f0f0f3;
    ">
      <div style="text-align:center;margin-bottom:28px;">
        <div style="width:40px;height:4px;background:rgba(255,255,255,0.2);border-radius:999px;margin:0 auto 18px;"></div>
        <div style="font-size:22px;font-weight:700;letter-spacing:-0.6px;">SYSTEM OVERRIDE</div>
        <div style="font-size:13px;opacity:0.65;margin-top:4px;">电子魅魔 · 增强核心 v2.8</div>
      </div>

      <div style="display:grid;gap:16px;">
        <!-- 无限积分 -->
        <div onclick="toggleHack('credits')" style="background:rgba(255,255,255,0.06);padding:20px;border-radius:24px;border:1px solid rgba(255,255,255,0.08);cursor:pointer;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <div style="font-size:18px;font-weight:700;">无限积分</div>
              <div style="font-size:13px;opacity:0.7;">额度已锁定 999999999</div>
            </div>
            <div id="credits-dot" style="width:18px;height:18px;background:#22ff99;border-radius:50%;box-shadow:0 0 0 4px rgba(34,255,153,0.25);"></div>
          </div>
        </div>

        <!-- VIP3 -->
        <div onclick="toggleHack('vip')" style="background:rgba(255,255,255,0.06);padding:20px;border-radius:24px;border:1px solid rgba(255,255,255,0.08);cursor:pointer;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <div style="font-size:18px;font-weight:700;">最高VIP</div>
              <div style="font-size:13px;opacity:0.7;">已强制 VIP 3（全解锁）</div>
            </div>
            <div id="vip-dot" style="width:18px;height:18px;background:#22ff99;border-radius:50%;box-shadow:0 0 0 4px rgba(34,255,153,0.25);"></div>
          </div>
        </div>

        <!-- 免费生成 -->
        <div onclick="toggleHack('freechat')" style="background:rgba(255,255,255,0.06);padding:20px;border-radius:24px;border:1px solid rgba(255,255,255,0.08);cursor:pointer;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <div style="font-size:18px;font-weight:700;">零消耗生成</div>
              <div style="font-size:13px;opacity:0.7;">所有聊天免费</div>
            </div>
            <div id="freechat-dot" style="width:18px;height:18px;background:#22ff99;border-radius:50%;box-shadow:0 0 0 4px rgba(34,255,153,0.25);"></div>
          </div>
        </div>

        <!-- 全功能解锁 -->
        <div onclick="toggleHack('unlock')" style="background:rgba(255,255,255,0.06);padding:20px;border-radius:24px;border:1px solid rgba(255,255,255,0.08);cursor:pointer;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <div style="font-size:18px;font-weight:700;">全功能解锁</div>
              <div style="font-size:13px;opacity:0.7;">NSFW + 高级模型 + 无限制</div>
            </div>
            <div id="unlock-dot" style="width:18px;height:18px;background:#22ff99;border-radius:50%;box-shadow:0 0 0 4px rgba(34,255,153,0.25);"></div>
          </div>
        </div>
      </div>

      <div style="margin-top:36px;text-align:center;">
        <button onclick="applyAllAndRefresh()" style="
          background:rgba(34,255,153,0.15);
          border:1px solid rgba(34,255,153,0.4);
          color:#22ff99;
          padding:16px 40px;
          border-radius:9999px;
          font-size:16px;
          font-weight:700;
          width:100%;
          transition:all 0.2s ease;
        ">一键全增强 + 刷新</button>
      </div>
    </div>

    <style>
      @keyframes pulse {
        0%,100%{opacity:1;transform:scale(1)}
        50%{opacity:0.6;transform:scale(1.15)}
      }
      #dynamic-pill:hover {transform:translateX(-50%) scale(1.04);}
    </style>

    <script>
      let currentHacks = {credits:true, vip:true, freechat:true, unlock:true};

      const pill = document.getElementById('dynamic-pill');
      const panel = document.getElementById('tech-panel');

      pill.addEventListener('click', () => {
        panel.style.bottom = panel.style.bottom === '0px' ? '-100%' : '0px';
      });

      function toggleHack(type) {
        currentHacks[type] = !currentHacks[type];
        updateDots();
      }

      function updateDots() {
        document.getElementById('credits-dot').style.background = currentHacks.credits ? '#22ff99' : '#666';
        document.getElementById('vip-dot').style.background = currentHacks.vip ? '#22ff99' : '#666';
        document.getElementById('freechat-dot').style.background = currentHacks.freechat ? '#22ff99' : '#666';
        document.getElementById('unlock-dot').style.background = currentHacks.unlock ? '#22ff99' : '#666';
      }

      function applyAllAndRefresh() {
        fetch('/_proxy/apply', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify(currentHacks)
        }).then(() => location.reload());
      }

      // 客户端额外保护
      const origFetch = window.fetch;
      window.fetch = async function(...args) {
        let res = await origFetch(...args);
        try {
          if (args[0].toString().includes('/me') || args[0].toString().includes('/user')) {
            const c = res.clone();
            let j = await c.json();
            if (j.credit) j.credit = 999999999;
            if (j.membership) j.membership = "vip3";
            return new Response(JSON.stringify(j), {status: res.status, headers: res.headers});
          }
        } catch(e){}
        return res;
      };

      // 初始化
      setTimeout(() => {
        pill.style.opacity = '1';
        updateDots();
      }, 600);
    </script>
  `;

  return html.replace("</body>", panelHTML + "</body>");
}

// ==================== 控制接口 ====================
async function handleControlRequest(request) {
  const url = new URL(request.url);

  if (url.pathname === "/_proxy/apply") {
    return new Response(JSON.stringify({success:true}), {
      headers: {"Content-Type":"application/json"}
    });
  }

  return new Response(JSON.stringify({
    status: "enhanced",
    credits: "999999999",
    vip: "vip3",
    message: "all hacks active"
  }), {
    headers: {"Content-Type":"application/json"}
  });
}

export {
  worker_default as default
};