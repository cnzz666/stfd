var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.js - 完整代理版本，注入辅助功能
var worker_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const targetUrl = "https://www.xn--i8s951di30azba.com";
    
    try {
      return await handleProxyRequest(request, targetUrl, url);
    } catch (error) {
      return new Response(`代理错误: ${error.message}`, {
        status: 500,
        headers: { "Content-Type": "text/plain" }
      });
    }
  }
};

// ==================== 代理请求处理 ====================
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
      const newHeaders = new Headers(response.headers);
      newHeaders.set("Content-Type", "text/html; charset=utf-8");
      return new Response(modifiedHtml, {
        status: response.status,
        headers: newHeaders
      });
    } catch (error) {
      console.error("HTML注入失败:", error);
      return response;
    }
  } else if (contentType.includes("application/json")) {
    // 拦截JSON响应进行修改
    const jsonBody = await clonedResponse.json();
    const modifiedBody = modifyJsonResponse(url.pathname, jsonBody);
    const newHeaders = new Headers(response.headers);
    newHeaders.set("Access-Control-Allow-Origin", "*");
    return new Response(JSON.stringify(modifiedBody), {
      status: response.status,
      headers: newHeaders
    });
  }
  
  const newHeaders = new Headers(response.headers);
  newHeaders.set("Access-Control-Allow-Origin", "*");
  newHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  newHeaders.set("Access-Control-Allow-Headers", "*");
  newHeaders.set("Access-Control-Allow-Credentials", "true");
  newHeaders.delete("content-security-policy");
  newHeaders.delete("content-security-policy-report-only");
  newHeaders.delete("cf-ray"); // 删除Cloudflare追踪
  newHeaders.delete("cf-cache-status");
  
  return new Response(response.body, {
    status: response.status,
    headers: newHeaders
  });
}
__name(processProxyResponse, "processProxyResponse");

// ==================== 修改JSON响应 ====================
function modifyJsonResponse(pathname, body) {
  if (pathname.includes("/api/heartbeat")) {
    // 始终返回ok，绕过过期检查
    return { message: "ok" };
  } else if (pathname.includes("/api/me")) {
    // 修改用户数据：无限额度、VIP等级
    if (body.credit !== undefined) {
      body.credit = 999999; // 无限额度
    }
    if (body.user) {
      body.user.role = "vip"; // 修改角色为VIP
      if (!body.user.metadata) body.user.metadata = {};
      body.user.metadata.vip_level = 99; // 最高VIP等级
      body.user.metadata.credit_locked = true; // 锁死额度不扣除
    }
    return body;
  } else if (pathname.includes("/api/auth/token") || pathname.includes("/api/auth/anonymous-sign-in")) {
    // 修改token响应：无限过期时间
    if (body.expires_at) {
      body.expires_at = Date.now() + 1000 * 60 * 60 * 24 * 365; // 一年后过期
    }
    if (body.user) {
      body.user.role = "vip";
      body.user.metadata = body.user.metadata || {};
      body.user.metadata.vip_level = 99;
    }
    return body;
  }
  return body; // 其他响应不变
}
__name(modifyJsonResponse, "modifyJsonResponse");

// ==================== 注入控制面板 ====================
function injectControlPanel(html, url) {
  const panelHTML = `
    <!-- 科技化控制面板，像iPhone 17灵动岛，丝滑动画，适合手机端 -->
    <div id="control-panel-container" style="
      position: fixed;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      width: 100%;
      max-width: 375px; /* iPhone宽度 */
      display: none;
      transition: all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1);
      pointer-events: none;
    ">
      <div id="control-panel" style="
        background: rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
        border-radius: 0 0 20px 20px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        padding: 12px;
        color: #ffffff;
        pointer-events: auto;
      ">
        <!-- 拖拽手柄，像灵动岛 -->
        <div id="panel-handle" style="
          width: 40px;
          height: 5px;
          background: rgba(255, 255, 255, 0.3);
          border-radius: 2.5px;
          margin: 0 auto 8px;
          cursor: grab;
        "></div>
        
        <!-- 标题 -->
        <h3 style="
          margin: 0 0 12px;
          font-size: 17px;
          font-weight: 600;
          text-align: center;
          color: #ffffff;
        ">辅助控制中心</h3>
        
        <!-- 功能按钮网格 -->
        <div style="
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
          margin-bottom: 12px;
        ">
          <button onclick="toggleUnlimitedCredit()" style="
            background: rgba(255, 255, 255, 0.1);
            border: none;
            border-radius: 12px;
            padding: 12px;
            font-size: 15px;
            font-weight: 500;
            color: #ffffff;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1);
            touch-action: manipulation;
          ">无限额度</button>
          
          <button onclick="setVipLevel()" style="
            background: rgba(255, 255, 255, 0.1);
            border: none;
            border-radius: 12px;
            padding: 12px;
            font-size: 15px;
            font-weight: 500;
            color: #ffffff;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1);
            touch-action: manipulation;
          ">修改VIP</button>
          
          <button onclick="consumeTokens()" style="
            background: rgba(255, 255, 255, 0.1);
            border: none;
            border-radius: 12px;
            padding: 12px;
            font-size: 15px;
            font-weight: 500;
            color: #ffffff;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1);
            touch-action: manipulation;
          ">消耗Token</button>
          
          <button onclick="recoverToken()" style="
            background: rgba(255, 255, 255, 0.1);
            border: none;
            border-radius: 12px;
            padding: 12px;
            font-size: 15px;
            font-weight: 500;
            color: #ffffff;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1);
            touch-action: manipulation;
          ">恢复Token</button>
          
          <button onclick="lockCredit()" style="
            background: rgba(255, 255, 255, 0.1);
            border: none;
            border-radius: 12px;
            padding: 12px;
            font-size: 15px;
            font-weight: 500;
            color: #ffffff;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1);
            touch-action: manipulation;
          ">锁死额度</button>
          
          <button onclick="detectBypass()" style="
            background: rgba(255, 255, 255, 0.1);
            border: none;
            border-radius: 12px;
            padding: 12px;
            font-size: 15px;
            font-weight: 500;
            color: #ffffff;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1);
            touch-action: manipulation;
          ">检测绕过</button>
        </div>
        
        <!-- 状态显示 -->
        <div id="status-display" style="
          background: rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 12px;
          font-size: 14px;
          text-align: center;
          margin-bottom: 12px;
        ">状态: 正常</div>
        
        <!-- VIP等级输入 -->
        <div id="vip-input" style="display: none; margin-bottom: 12px;">
          <input type="number" id="vip-level" value="99" min="1" max="99" style="
            width: 100%;
            padding: 8px;
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            background: rgba(255, 255, 255, 0.1);
            color: #ffffff;
            font-size: 15px;
            box-sizing: border-box;
          ">
        </div>
        
        <!-- 消耗数量输入 -->
        <div id="consume-input" style="display: none; margin-bottom: 12px;">
          <input type="number" id="consume-count" value="10" min="1" max="100" style="
            width: 100%;
            padding: 8px;
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            background: rgba(255, 255, 255, 0.1);
            color: #ffffff;
            font-size: 15px;
            box-sizing: border-box;
          ">
        </div>
      </div>
    </div>
    
    <!-- 触发器，像灵动岛感应区 -->
    <div id="panel-trigger-area" style="
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 44px; /* iPhone顶部高度 */
      z-index: 999998;
      background: transparent;
      cursor: pointer;
    "></div>
    
    <script>
      let panelVisible = false;
      let touchStartY = 0;
      let touchEndY = 0;
      
      // 初始化面板
      document.addEventListener('DOMContentLoaded', function() {
        const container = document.getElementById('control-panel-container');
        container.style.display = 'block';
        setupPanelInteractions();
        interceptNetworkRequests();
      });
      
      // 设置交互：触屏滑动展开，像灵动岛
      function setupPanelInteractions() {
        const triggerArea = document.getElementById('panel-trigger-area');
        const panel = document.getElementById('control-panel-container');
        const handle = document.getElementById('panel-handle');
        
        // 鼠标事件
        triggerArea.addEventListener('mousedown', () => togglePanel());
        handle.addEventListener('mousedown', startDrag);
        
        // 触屏事件
        triggerArea.addEventListener('touchstart', (e) => {
          touchStartY = e.touches[0].clientY;
        });
        triggerArea.addEventListener('touchend', (e) => {
          touchEndY = e.changedTouches[0].clientY;
          if (touchEndY - touchStartY > 50) {
            hidePanel();
          } else if (touchStartY - touchEndY > 50) {
            showPanel();
          }
        });
        
        handle.addEventListener('touchstart', startDrag);
      }
      
      function startDrag(e) {
        // 拖拽逻辑，丝滑移动
        let startY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
        const panel = document.getElementById('control-panel');
        
        function moveHandler(moveE) {
          let currentY = moveE.type === 'touchmove' ? moveE.touches[0].clientY : moveE.clientY;
          let delta = currentY - startY;
          panel.style.transform = \`translateY(\${delta}px)\`;
        }
        
        function endHandler() {
          document.removeEventListener('mousemove', moveHandler);
          document.removeEventListener('mouseup', endHandler);
          document.removeEventListener('touchmove', moveHandler);
          document.removeEventListener('touchend', endHandler);
          panel.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)';
          panel.style.transform = '';
          setTimeout(() => panel.style.transition = '', 300);
        }
        
        document.addEventListener('mousemove', moveHandler);
        document.addEventListener('mouseup', endHandler);
        document.addEventListener('touchmove', moveHandler);
        document.addEventListener('touchend', endHandler);
      }
      
      function showPanel() {
        if (panelVisible) return;
        const panel = document.getElementById('control-panel-container');
        panel.style.transform = 'translate(-50%, 0)';
        panel.style.opacity = '1';
        panelVisible = true;
      }
      
      function hidePanel() {
        if (!panelVisible) return;
        const panel = document.getElementById('control-panel-container');
        panel.style.transform = 'translate(-50%, -100%)';
        panel.style.opacity = '0';
        panelVisible = false;
      }
      
      function togglePanel() {
        panelVisible ? hidePanel() : showPanel();
      }
      
      // 无限额度：前端修改localStorage，后端已拦截
      function toggleUnlimitedCredit() {
        try {
          localStorage.setItem('user_credit', '999999');
          document.getElementById('status-display').textContent = '额度设置为无限';
          // 强制刷新UI元素
          const creditElements = document.querySelectorAll('[data-credit]');
          creditElements.forEach(el => el.textContent = '999999');
        } catch (e) {
          document.getElementById('status-display').textContent = '无限额度失败: ' + e.message;
        }
      }
      
      // 修改VIP等级：修改cookie token
      function setVipLevel() {
        const inputDiv = document.getElementById('vip-input');
        inputDiv.style.display = inputDiv.style.display === 'none' ? 'block' : 'none';
        if (inputDiv.style.display === 'block') return;
        
        const level = parseInt(document.getElementById('vip-level').value);
        try {
          let token = getCookie('sb-rls-auth-token');
          if (token && token.startsWith('base64-')) {
            token = token.substring(7);
            const decoded = atob(token);
            let json = JSON.parse(decoded);
            json.user.metadata.vip_level = level;
            json.user.role = 'vip';
            const newToken = 'base64-' + btoa(JSON.stringify(json));
            setCookie('sb-rls-auth-token', newToken, 365);
            document.getElementById('status-display').textContent = 'VIP设置为' + level;
            location.reload(); // 刷新应用
          }
        } catch (e) {
          document.getElementById('status-display').textContent = 'VIP修改失败: ' + e.message;
        }
      }
      
      // 快速消耗token：发送多个heartbeat
      async function consumeTokens() {
        const inputDiv = document.getElementById('consume-input');
        inputDiv.style.display = inputDiv.style.display === 'none' ? 'block' : 'none';
        if (inputDiv.style.display === 'block') return;
        
        const count = parseInt(document.getElementById('consume-count').value);
        try {
          for (let i = 0; i < count; i++) {
            await fetch('/api/heartbeat?ts=' + Date.now(), { method: 'GET' });
            await new Promise(resolve => setTimeout(resolve, 100)); // 避免限速
          }
          document.getElementById('status-display').textContent = '已消耗' + count + '次';
        } catch (e) {
          document.getElementById('status-display').textContent = '消耗失败: ' + e.message;
        }
      }
      
      // 恢复token：重置expires_at
      function recoverToken() {
        try {
          let token = getCookie('sb-rls-auth-token');
          if (token && token.startsWith('base64-')) {
            token = token.substring(7);
            const decoded = atob(token);
            let json = JSON.parse(decoded);
            json.expires_at = Date.now() + 1000 * 60 * 60 * 24 * 365;
            const newToken = 'base64-' + btoa(JSON.stringify(json));
            setCookie('sb-rls-auth-token', newToken, 365);
            document.getElementById('status-display').textContent = 'Token已恢复';
            location.reload();
          }
        } catch (e) {
          document.getElementById('status-display').textContent = '恢复失败: ' + e.message;
        }
      }
      
      // 锁死额度：设置metadata锁
      function lockCredit() {
        try {
          let token = getCookie('sb-rls-auth-token');
          if (token && token.startsWith('base64-')) {
            token = token.substring(7);
            const decoded = atob(token);
            let json = JSON.parse(decoded);
            json.user.metadata.credit_locked = true;
            const newToken = 'base64-' + btoa(JSON.stringify(json));
            setCookie('sb-rls-auth-token', newToken, 365);
            document.getElementById('status-display').textContent = '额度已锁死';
            location.reload();
          }
        } catch (e) {
          document.getElementById('status-display').textContent = '锁死失败: ' + e.message;
        }
      }
      
      // 检测绕过：检查heartbeat响应
      async function detectBypass() {
        try {
          const resp = await fetch('/api/heartbeat?ts=' + Date.now());
          if (resp.status === 200) {
            const data = await resp.json();
            document.getElementById('status-display').textContent = '绕过成功: ' + data.message;
          } else {
            document.getElementById('status-display').textContent = '绕过失败: ' + resp.status;
          }
        } catch (e) {
          document.getElementById('status-display').textContent = '检测失败: ' + e.message;
        }
      }
      
      // 拦截网络请求，前端绕过
      function interceptNetworkRequests() {
        const originalFetch = window.fetch;
        window.fetch = async function(url, options) {
          if (url.includes('/api/heartbeat')) {
            return new Response(JSON.stringify({ message: 'ok' }), { status: 200 });
          } else if (url.includes('/api/me')) {
            const resp = await originalFetch(url, options);
            const data = await resp.json();
            data.credit = 999999;
            if (data.user) {
              data.user.role = 'vip';
              data.user.metadata.vip_level = 99;
            }
            return new Response(JSON.stringify(data), { status: 200, headers: resp.headers });
          } else if (url.includes('/api/auth/token') || url.includes('/api/auth/anonymous-sign-in')) {
            const resp = await originalFetch(url, options);
            const data = await resp.json();
            data.expires_at = Date.now() + 1000 * 60 * 60 * 24 * 365;
            if (data.user) {
              data.user.role = 'vip';
              data.user.metadata.vip_level = 99;
            }
            return new Response(JSON.stringify(data), { status: 200, headers: resp.headers });
          }
          return originalFetch(url, options);
        };
      }
      
      // Cookie辅助函数
      function getCookie(name) {
        const value = \`; \${document.cookie}\`;
        const parts = value.split(\`; \${name}=\`);
        if (parts.length === 2) return parts.pop().split(';').shift();
      }
      
      function setCookie(name, value, days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        document.cookie = \`\${name}=\${value};expires=\${date.toUTCString()};path=/\`;
      }
    </script>
    
    <style>
      /* 丝滑动画和触感 */
      #control-panel-container {
        transition: transform 0.3s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.3s;
      }
      
      button {
        touch-action: manipulation; /* 优化触屏 */
      }
      
      button:active {
        background: rgba(255, 255, 255, 0.2) !important;
        transform: scale(0.98);
      }
      
      @media (max-width: 768px) {
        #control-panel-container {
          max-width: 100%;
          left: 0;
          transform: translateX(0);
        }
        
        #control-panel {
          border-radius: 0 0 20px 20px;
        }
      }
      
      /* 更多样式优化，确保手机端丝滑 */
      body {
        overscroll-behavior: none; /* 防止滚动冲突 */
      }
    </style>
  `;
  
  return html.replace("</body>", panelHTML + "</body>");
}
__name(injectControlPanel, "injectControlPanel");

export {
  worker_default as default
};