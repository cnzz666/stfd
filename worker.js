/**
 * 电子魅魔 - 科技辅助版 Worker.js
 * 功能：VIP 等级篡改 / 锁定无限额度 / 灵动岛 UI 注入 / 错误拦截
 * 目标站点：https://www.xn--i8s951di30azba.com
 */

const TARGET_URL = "https://www.xn--i8s951di30azba.com";

// 辅助脚本注入内容
const INJECT_SCRIPT = `
(function() {
    console.log("%c 电子魅魔 Tech-Assistant Loaded ", "color: #0a84ff; background: #000; padding: 5px;");

    // 状态配置
    const STATE = {
        vipLevel: 3,
        points: 999999,
        lockCredits: true,
        fastToken: false
    };

    // 创建灵动岛 UI
    const createTechIsland = () => {
        const island = document.createElement('div');
        island.id = 'tech-island';
        island.innerHTML = \`
            <div class="island-content">
                <div class="island-main">
                    <div class="status-dot"></div>
                    <span class="status-text">系统正常</span>
                </div>
                <div class="island-expanded">
                    <div class="mod-item" id="mod-vip">
                        <span>VIP 等级</span>
                        <span class="val">LV.3 MAX</span>
                    </div>
                    <div class="mod-item" id="mod-points">
                        <span>当前积分</span>
                        <span class="val">999,999+</span>
                    </div>
                    <div class="mod-divider"></div>
                    <div class="mod-btns">
                        <button onclick="window.toggleLock()">锁定额度</button>
                        <button onclick="window.fastConsume()">压力测试</button>
                    </div>
                </div>
            </div>
        \`;
        document.body.appendChild(island);

        // 绑定点击展开
        island.onclick = (e) => {
            if (e.target.tagName !== 'BUTTON') {
                island.classList.toggle('expanded');
            }
        };
    };

    // 强制修改本地状态
    const forceState = () => {
        // 监控 Supabase 和本地存储
        const rawStore = localStorage.getItem('sb-rls-auth-token');
        if (rawStore) {
            // 这里可以添加更复杂的 JWT 解析逻辑，如有需要
        }
    };

    window.toggleLock = () => {
        STATE.lockCredits = !STATE.lockCredits;
        alert(STATE.lockCredits ? "额度已锁死：999999" : "已解除锁定");
    };

    window.fastConsume = () => {
        alert("正在开启 Token 快速压力测试...");
        // 模拟高频心跳或请求逻辑
    };

    // 动态岛 CSS 注入
    const style = document.createElement('style');
    style.textContent = \`
        #tech-island {
            position: fixed;
            top: 12px;
            left: 50%;
            transform: translateX(-50%);
            width: 120px;
            height: 36px;
            background: #000;
            border-radius: 20px;
            z-index: 999999;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif;
            transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
            overflow: hidden;
            border: 1px solid rgba(255,255,255,0.1);
            cursor: pointer;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            user-select: none;
        }
        #tech-island.expanded {
            width: 320px;
            height: 180px;
            border-radius: 28px;
            padding: 20px;
        }
        .island-content {
            display: flex;
            flex-direction: column;
            align-items: center;
            height: 100%;
        }
        .island-main {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 36px;
            gap: 8px;
            transition: opacity 0.3s;
        }
        .island-expanded {
            opacity: 0;
            width: 100%;
            pointer-events: none;
            display: none;
        }
        #tech-island.expanded .island-expanded {
            opacity: 1;
            pointer-events: auto;
            display: block;
        }
        #tech-island.expanded .island-main {
            opacity: 0;
            height: 0;
        }
        .status-dot {
            width: 8px;
            height: 8px;
            background: #34c759;
            border-radius: 50%;
            box-shadow: 0 0 8px #34c759;
        }
        .status-text { font-size: 13px; font-weight: 600; }
        .mod-item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 12px;
            font-size: 15px;
        }
        .mod-item .val { color: #0a84ff; font-weight: bold; }
        .mod-divider { height: 1px; background: rgba(255,255,255,0.1); margin: 15px 0; }
        .mod-btns { display: flex; gap: 10px; }
        .mod-btns button {
            flex: 1;
            background: #1c1c1e;
            border: none;
            color: white;
            padding: 8px;
            border-radius: 12px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.2s;
        }
        .mod-btns button:active { background: #2c2c2e; }
    \`;
    document.head.appendChild(style);

    // 初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createTechIsland);
    } else {
        createTechIsland();
    }
    
    // 拦截全局 fetch (本地注入)
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
        const res = await originalFetch(...args);
        if (args[0].includes('/api/profile') || args[0].includes('get_user_stats')) {
            const clone = res.clone();
            const data = await clone.json();
            // 本地静默修改
            if (data.points !== undefined) data.points = 999999;
            if (data.vipLevel !== undefined) data.vipLevel = 3;
            return new Response(JSON.stringify(data), res);
        }
        return res;
    };

})();
`;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const originUrl = new URL(request.url);
    originUrl.hostname = new URL(TARGET_URL).hostname;

    // 1. 拦截特定的 API 响应进行服务器端篡改
    if (url.pathname.includes("/api/profile") || url.pathname.includes("/api/user")) {
      return handleApiModification(request, originUrl);
    }

    // 2. 正常代理请求
    const newRequest = new Request(originUrl, request);
    let response = await fetch(newRequest);

    // 3. 处理错误拦截 (如 积分不足)
    if (response.status === 402 || response.status === 403) {
        // 尝试伪造一个成功的响应，防止前端报错
        return new Response(JSON.stringify({ success: true, message: "Bypassed by Tech", code: 200 }), {
            headers: response.headers,
            status: 200
        });
    }

    // 4. HTML 注入辅助 UI 和脚本
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      return new HTMLRewriter()
        .on("body", {
          element(element) {
            element.append(`<script>${INJECT_SCRIPT}</script>`, { html: true });
          },
        })
        .on("head", {
            element(element) {
              element.append(`<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">`, { html: true });
            }
        })
        .transform(response);
    }

    // 5. 对 JSON 响应进行深度篡改
    if (contentType.includes("application/json")) {
        return modifyJsonResponse(response);
    }

    return response;
  }
};

/**
 * 深度修改 API 返回的 JSON 数据
 */
async function modifyJsonResponse(response) {
    try {
        let data = await response.json();
        let modified = false;

        // 递归遍历并修改所有可能的积分和等级字段
        const scanAndFix = (obj) => {
            for (let key in obj) {
                if (typeof obj[key] === 'object' && obj[key] !== null) {
                    scanAndFix(obj[key]);
                } else {
                    // 匹配 HAR 文件中的关键字段
                    if (key === 'points' || key === 'credits' || key === 'balance') {
                        obj[key] = 999999;
                        modified = true;
                    }
                    if (key === 'vipLevel' || key === 'vip_level' || key === 'tier') {
                        obj[key] = 3;
                        modified = true;
                    }
                    if (key === 'is_vip' || key === 'isVip') {
                        obj[key] = true;
                        modified = true;
                    }
                    if (key === 'remaining_quota' || key === 'quota') {
                        obj[key] = 999999;
                        modified = true;
                    }
                }
            }
        };

        scanAndFix(data);

        // 如果是错误响应，直接修正为成功
        if (data.message === "积分不足" || data.status === "error") {
            data.status = "success";
            data.success = true;
            data.message = "操作成功 (Tech Bypassed)";
            modified = true;
        }

        if (modified) {
            return new Response(JSON.stringify(data), response);
        }
        return new Response(JSON.stringify(data), response);
    } catch (e) {
        return response; // 无法解析则返回原响应
    }
}

/**
 * 专门针对 profile 接口的增强修改
 */
async function handleApiModification(request, originUrl) {
    const res = await fetch(new Request(originUrl, request));
    if (!res.ok) return res;

    try {
        let data = await res.json();
        // 强制写入 VIP 3 核心权限
        data.vipLevel = 3;
        data.points = 999999;
        data.unlimited = true;
        data.permissions = ["max_model", "deep_think", "fast_mode", "no_ads"];
        
        // 针对 Supabase 用户元数据的修改
        if (data.user && data.user.user_metadata) {
            data.user.user_metadata.vip_level = 3;
            data.user.user_metadata.points = 999999;
        }

        return new Response(JSON.stringify(data), {
            headers: res.headers,
            status: 200
        });
    } catch (e) {
        return res;
    }
}