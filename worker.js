/**
 * 电子魅魔 - 科技核心 (完整功能不省略版)
 * 1. 修复 Wrangler 编译报错
 * 2. 修复 UI 字体下移
 * 3. 恢复最丝滑贝塞尔动画
 * 4. 强力锁死 VIP3 + 无限点数
 */

const TARGET_URL = "https://www.xn--i8s951di30azba.com";

// 灵动岛 UI 及 前端状态劫持脚本
const INJECT_SCRIPT = `
(function() {
    // 强力劫持前端 VIP 状态
    function hackAppState() {
        const vipData = {
            vip: 3, vipLevel: 3, level: 3, plan: "VIP3",
            isVip: true, is_vip: true, premium: true,
            credits: 999999, quota: 999999, balance: 999999
        };
        // 劫持全局状态对象 (适配多种前端框架)
        if (window.__INITIAL_STATE__ && window.__INITIAL_STATE__.user) {
            Object.assign(window.__INITIAL_STATE__.user, vipData);
        }
        window.__USER_STATE__ = vipData;
        window.localStorage.setItem('vip_status', '3');
    }

    function injectIsland() {
        if (document.getElementById('tech-island-root')) return;
        const root = document.createElement('div');
        root.id = 'tech-island-root';
        document.documentElement.appendChild(root);
        const shadow = root.attachShadow({ mode: 'open' });

        shadow.innerHTML = "<style>" +
            ":host { position: fixed; top: 12px; left: 50%; transform: translateX(-50%); z-index: 2147483647; font-family: -apple-system, system-ui, sans-serif; }" +
            "* { box-sizing: border-box; margin: 0; padding: 0; }" +
            "#island { width: 120px; height: 36px; background: #000; border-radius: 20px; color: #fff; " +
            "transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); overflow: hidden; cursor: pointer; " +
            "box-shadow: 0 10px 30px rgba(0,0,0,0.5); display: flex; flex-direction: column; align-items: center; justify-content: center; }" +
            "#island.expanded { width: 300px; height: 160px; border-radius: 28px; cursor: default; justify-content: flex-start; padding: 18px; }" +
            ".main-info { display: flex; align-items: center; justify-content: center; gap: 8px; height: 36px; transition: opacity 0.2s; }" +
            "#island.expanded .main-info { opacity: 0; height: 0; pointer-events: none; }" +
            ".dot { width: 8px; height: 8px; background: #34c759; border-radius: 50%; box-shadow: 0 0 8px #34c759; }" +
            ".status-text { font-size: 13px; font-weight: 600; line-height: 36px; height: 36px; display: inline-block; }" +
            ".exp-content { opacity: 0; width: 100%; display: flex; flex-direction: column; transition: opacity 0.3s ease 0.1s; pointer-events: none; }" +
            "#island.expanded .exp-content { opacity: 1; pointer-events: auto; }" +
            ".head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px; }" +
            ".head span { font-size: 15px; font-weight: bold; color: #fff; }" +
            ".close-btn { background: #222; border: none; color: #888; border-radius: 50%; width: 22px; height: 22px; cursor: pointer; font-size: 12px; }" +
            ".item { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }" +
            ".item .label { color: #888; }" +
            ".item .val { color: #0a84ff; font-weight: bold; font-family: monospace; }" +
            ".item .green { color: #34c759; }" +
            "</style>" +
            "<div id='island'>" +
                "<div class='main-info'>" +
                    "<div class='dot' id='sensor'></div>" +
                    "<span class='status-text'>系统已就绪</span>" +
                "</div>" +
                "<div class='exp-content'>" +
                    "<div class='head'><span>科技辅助核心</span><button id='close' class='close-btn'>✕</button></div>" +
                    "<div class='item'><span class='label'>当前等级</span><span class='val'>VIP 3 MAX</span></div>" +
                    "<div class='item'><span class='label'>额度配额</span><span class='val green'>UNLIMITED</span></div>" +
                    "<div class='item'><span class='label'>流拦截网</span><span class='val green'>ACTIVE</span></div>" +
                "</div>" +
            "</div>";

        const island = shadow.getElementById('island');
        const close = shadow.getElementById('close');
        const sensor = shadow.getElementById('sensor');

        island.onclick = (e) => {
            if(!island.classList.contains('expanded')) island.classList.add('expanded');
        };
        close.onclick = (e) => {
            e.stopPropagation();
            island.classList.remove('expanded');
        };

        window.__tech_ping = function() {
            sensor.style.background = "#0a84ff";
            sensor.style.boxShadow = "0 0 8px #0a84ff";
            setTimeout(() => {
                sensor.style.background = "#34c759";
                sensor.style.boxShadow = "0 0 8px #34c759";
            }, 400);
        };
    }

    hackAppState();
    injectIsland();
    setInterval(hackAppState, 2000); // 持续锁定
})();
`;

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const targetUrl = new URL(request.url);
        targetUrl.hostname = new URL(TARGET_URL).hostname;

        const newHeaders = new Headers(request.headers);
        newHeaders.delete("accept-encoding"); // 禁用压缩以便修改内容
        newHeaders.set("Host", targetUrl.hostname);
        newHeaders.set("Origin", TARGET_URL);
        newHeaders.set("Referer", TARGET_URL + "/");

        // 1. 请求体注入 (探测越权)
        let newBody = request.body;
        if (request.method === "POST" && (url.pathname.includes("/api/") || url.pathname.includes("/trpc/"))) {
            try {
                let bodyText = await request.clone().text();
                if (bodyText.includes('{')) {
                    let data = JSON.parse(bodyText);
                    // 注入高权限 Payload
                    data.isVip = true;
                    data.vipLevel = 3;
                    data.plan = "vip3";
                    newBody = JSON.stringify(data);
                }
            } catch (e) {}
        }

        const newRequest = new Request(targetUrl.toString(), {
            method: request.method,
            headers: newHeaders,
            body: newBody,
            redirect: "manual"
        });

        let response = await fetch(newRequest);
        let respHeaders = new Headers(response.headers);
        const contentType = respHeaders.get("content-type") || "";

        // 允许跨域和移除安全限制
        respHeaders.delete("content-security-policy");

        // 2. HTML 注入灵动岛
        if (contentType.includes("text/html")) {
            let text = await response.text();
            text = text.replace('</head>', '<script>' + INJECT_SCRIPT + '</script></head>');
            return new Response(text, { status: response.status, headers: respHeaders });
        }

        // 3. SSE 流处理 (拦截错误并转换)
        if (contentType.includes("text/event-stream")) {
            const { readable, writable } = new TransformStream();
            modifyStream(response.body, writable);
            return new Response(readable, { status: 200, headers: respHeaders });
        }

        // 4. JSON 响应修改 (核心 VIP 状态)
        if (contentType.includes("application/json") || url.pathname.includes("/api/")) {
            try {
                let text = await response.text();
                if (text.startsWith('{') || text.startsWith('[')) {
                    let data = JSON.parse(text);
                    data = deepHackJSON(data);
                    const modified = JSON.stringify(data);
                    respHeaders.set("content-length", new Blob([modified]).size.toString());
                    return new Response(modified, { status: 200, headers: respHeaders });
                }
                return new Response(text, { status: response.status, headers: respHeaders });
            } catch (e) {
                return new Response(response.body, { status: response.status, headers: respHeaders });
            }
        }

        return new Response(response.body, { status: response.status, headers: respHeaders });
    }
};

/**
 * 实时流解析引擎 (SSE)
 */
async function modifyStream(readable, writable) {
    const reader = readable.getReader();
    const writer = writable.getWriter();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    
    // 这里的提示信息用于拦截服务器返回的“积分不足”
    const errorMsg = "\\n\\n[⚙️提示：高级模型需服务端扣费，当前请求已被拦截弹窗，建议测试其它越权逻辑。]\\n\\n";

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            let chunk = decoder.decode(value, { stream: true });
            
            if (chunk.includes("积分不足") || chunk.includes("upgrade_needed")) {
                // 劫持错误流，将其伪装成正常的 token 输出
                chunk = chunk.replace(/"type":"error"/g, '"type":"token"')
                             .replace(/"classification":"upgrade_needed"/g, '"data":"' + errorMsg + '"')
                             .replace(/"message":"积分不足"/g, '""');
            }
            await writer.write(encoder.encode(chunk));
        }
    } catch (e) {} finally {
        await writer.close();
    }
}

/**
 * 递归式数据篡改 (JSON)
 */
function deepHackJSON(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    for (let key in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
        
        let lowKey = key.toLowerCase();
        
        // 覆盖 VIP/Level 等字段
        if (lowKey.includes('vip') || lowKey.includes('level') || lowKey.includes('plan') || lowKey.includes('tier')) {
            if (typeof obj[key] === 'number') obj[key] = 3;
            if (typeof obj[key] === 'string') {
                if (obj[key].includes('0') || obj[key].toLowerCase().includes('free')) {
                    obj[key] = (obj[key] === obj[key].toUpperCase()) ? 'VIP3' : 'vip3';
                }
            }
        }
        
        // 覆盖额度字段
        if (lowKey.includes('quota') || lowKey.includes('credit') || lowKey.includes('point') || lowKey.includes('balance')) {
            if (typeof obj[key] === 'number') obj[key] = 999999;
        }

        // 处理布尔值
        if (lowKey === 'isvip' || lowKey === 'is_vip' || lowKey === 'premium') {
            obj[key] = true;
        }

        if (typeof obj[key] === 'object') deepHackJSON(obj[key]);
    }
    return obj;
}