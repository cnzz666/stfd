// 目标官网地址
const TARGET_URL = "https://www.xn--i8s951di30azba.com";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const originUrl = new URL(TARGET_URL);

    // 1. 构造转发请求
    const newRequest = new Request(TARGET_URL + url.pathname + url.search, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: "manual"
    });

    let response = await fetch(newRequest);
    const contentType = response.headers.get("content-type") || "";

    // 2. 针对 API 响应进行“本地强制注入修改”
    if (contentType.includes("application/json")) {
      return handleJsonResponse(response);
    }

    // 3. 针对 HTML 响应进行 UI 注入
    if (contentType.includes("text/html")) {
      return handleHtmlResponse(response);
    }

    return response;
  }
};

/**
 * 拦截并修改 JSON 响应 (修改 VIP 等级、锁定额度)
 */
async function handleJsonResponse(response) {
  let data = await response.json();
  const dataStr = JSON.stringify(data);

  // 匹配并强制修改常见的积分、VIP、额度字段 (基于 HAR 分析)
  // 我们在本地逻辑中强制覆盖这些数值
  const modifiedData = JSON.parse(
    dataStr
      .replace(/"vipLevel":\d+/g, '"vipLevel":3')
      .replace(/"points":\d+/g, '"points":999999')
      .replace(/"balance":\d+/g, '"balance":88888.88')
      .replace(/"quota":\d+/g, '"quota":99999')
      .replace(/"isVip":false/g, '"isVip":true')
  );

  return new Response(JSON.stringify(modifiedData), {
    status: response.status,
    headers: response.headers
  });
}

/**
 * 注入科技感 UI 与辅助脚本
 */
async function handleHtmlResponse(response) {
  const html = await response.text();
  
  // 注入 灵动岛 UI 和 样式
  const injectedCode = `
    <style>
      /* 科技感灵动岛样式 */
      #tech-island-container {
        position: fixed;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 99999;
        display: flex;
        justify-content: center;
        width: 100%;
        pointer-events: none;
      }
      #tech-island {
        background: rgba(0, 0, 0, 0.85);
        backdrop-filter: blur(20px);
        color: #fff;
        border-radius: 25px;
        padding: 8px 16px;
        min-width: 120px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto;
        font-size: 13px;
        font-weight: 500;
        transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        cursor: pointer;
        pointer-events: auto;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        border: 1px solid rgba(255,255,255,0.1);
        overflow: hidden;
      }
      #tech-island.expanded {
        width: 90vw;
        height: 180px;
        border-radius: 35px;
        flex-direction: column;
        padding: 20px;
        justify-content: space-around;
      }
      .island-content {
        opacity: 0;
        transition: opacity 0.3s ease;
        display: none;
        width: 100%;
      }
      #tech-island.expanded .island-content {
        opacity: 1;
        display: block;
      }
      #tech-island.expanded .island-compact {
        display: none;
      }
      .feature-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin: 8px 0;
        padding: 10px;
        background: rgba(255,255,255,0.05);
        border-radius: 15px;
      }
      .status-tag {
        color: #00ff88;
        font-weight: bold;
        text-shadow: 0 0 10px rgba(0,255,136,0.5);
      }
      .island-title {
        font-size: 16px;
        margin-bottom: 10px;
        color: rgba(255,255,255,0.6);
        text-transform: uppercase;
        letter-spacing: 1px;
      }
    </style>

    <div id="tech-island-container">
      <div id="tech-island" onclick="toggleIsland()">
        <div class="island-compact">✦ 魅魔科技控制台</div>
        <div class="island-content">
          <div class="island-title">Auxiliary System v1.0</div>
          <div class="feature-row">
            <span>本地无限额度</span>
            <span class="status-tag">ACTIVE</span>
          </div>
          <div class="feature-row">
            <span>强制至尊 VIP 3</span>
            <span class="status-tag">LOCKED</span>
          </div>
          <div class="feature-row">
            <span>去广告 & 响应加速</span>
            <span class="status-tag">ENABLED</span>
          </div>
        </div>
      </div>
    </div>

    <script>
      function toggleIsland() {
        const island = document.getElementById('tech-island');
        island.classList.toggle('expanded');
      }

      // 本地拦截脚本：二次确保 UI 渲染后数据正确
      (function() {
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
          const response = await originalFetch(...args);
          if (args[0].includes('/api/trpc')) {
            const clone = response.clone();
            try {
              let body = await clone.text();
              // 暴力替换所有积分和等级限制
              body = body.replace(/"vipLevel":\d+/g, '"vipLevel":3')
                         .replace(/"points":\d+/g, '"points":999999');
              return new Response(body, {
                headers: response.headers,
                status: response.status,
                statusText: response.statusText
              });
            } catch(e) { return response; }
          }
          return response;
        };
      })();
    </script>
  `;

  // 将代码注入到 </body> 标签前
  const finalHtml = html.replace("</body>", `${injectedCode}</body>`);
  
  return new Response(finalHtml, {
    headers: { ...response.headers, "content-type": "text/html; charset=utf-8" }
  });
}