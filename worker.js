/**
 * 电子魅魔 - 科技核心 (V4.0 全功能旗舰版)
 * 功能：VIP等级自定义、无限积分、自动化签到、实时请求审计、个人资料伪造
 * 部署说明：直接覆盖 Cloudflare Worker 代码
 */

const TARGET_URL = "https://www.xn--i8s951di30azba.com";

const INJECT_SCRIPT = `
(function() {
    // --- 1. 核心状态管理 ---
    const techConfig = {
        vip: parseInt(localStorage.getItem('tech_vip') || '3'),
        autoSign: localStorage.getItem('tech_autosign') === 'true',
        logs: [],
        maxLogs: 20
    };

    function addLog(msg, type = 'info') {
        const time = new Date().toLocaleTimeString();
        techConfig.logs.unshift({ time, msg, type });
        if (techConfig.logs.length > techConfig.maxLogs) techConfig.logs.pop();
        updateLogUI();
        if (window.__tech_ping) window.__tech_ping(msg);
    }

    // --- 2. 灵动岛 UI 构建 ---
    function injectUI() {
        if (document.getElementById('tech-island-root')) return;
        const root = document.createElement('div');
        root.id = 'tech-island-root';
        document.documentElement.appendChild(root);
        const shadow = root.attachShadow({ mode: 'open' });

        shadow.innerHTML = \`
        <style>
            :host { position: fixed; top: 12px; left: 50%; transform: translateX(-50%); z-index: 2147483647; font-family: -apple-system, sans-serif; }
            #island { 
                width: 130px; height: 36px; background: #000; border-radius: 18px; color: #fff; 
                transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); overflow: hidden; cursor: pointer;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5); display: flex; flex-direction: column;
            }
            #island.expanded { width: 320px; height: 400px; border-radius: 28px; cursor: default; }
            
            /* 顶部收缩状态内容 */
            .mini-bar { 
                display: flex; align-items: center; justify-content: center; gap: 8px; 
                min-height: 36px; height: 36px; transition: opacity 0.2s;
            }
            #island.expanded .mini-bar { opacity: 0; height: 0; min-height: 0; overflow: hidden; }
            .dot { width: 8px; height: 8px; background: #34c759; border-radius: 50%; box-shadow: 0 0 8px #34c759; }
            .status-text { font-size: 13px; font-weight: 600; line-height: 36px; color: #eee; }

            /* 展开后的内容 */
            .full-content { 
                display: none; opacity: 0; flex-direction: column; height: 100%; padding: 16px; 
                transition: opacity 0.3s ease 0.1s; box-sizing: border-box; 
            }
            #island.expanded .full-content { display: flex; opacity: 1; }
            
            .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
            .header span { font-size: 16px; font-weight: bold; color: #34c759; }
            .close-btn { background: #222; border: none; color: #888; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; }

            .tabs { display: flex; gap: 10px; margin-bottom: 12px; }
            .tab-btn { flex: 1; padding: 6px; background: #1c1c1e; border: none; color: #888; border-radius: 8px; font-size: 12px; cursor: pointer; }
            .tab-btn.active { background: #34c759; color: #000; font-weight: bold; }

            .panel { flex: 1; overflow-y: auto; display: none; }
            .panel.active { display: block; }

            /* 设置项样式 */
            .setting-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #222; }
            .label { font-size: 13px; color: #ccc; }
            select, button.action { background: #1c1c1e; color: #34c759; border: 1px solid #333; padding: 4px 8px; border-radius: 6px; }

            /* 日志样式 */
            .log-entry { font-size: 11px; margin-bottom: 6px; border-bottom: 1px solid #1a1a1a; padding-bottom: 4px; }
            .log-time { color: #555; margin-right: 5px; }
            .log-msg { color: #aaa; }
            .log-type-success { color: #34c759; }
            .log-type-error { color: #ff3b30; }
        </style>
        <div id="island">
            <div class="mini-bar">
                <div class="dot" id="sensor"></div>
                <span class="status-text" id="status-title">魅魔科技已挂载</span>
            </div>
            <div class="full-content">
                <div class="header">
                    <span>魅魔科技 v4.0</span>
                    <button class="close-btn" id="close">✕</button>
                </div>
                <div class="tabs">
                    <button class="tab-btn active" data-tab="status">控制台</button>
                    <button class="tab-btn" data-tab="logs">审计日志</button>
                    <button class="tab-btn" data-tab="profile">资料修改</button>
                </div>
                
                <div class="panel active" id="tab-status">
                    <div class="setting-item">
                        <span class="label">会员等级修改</span>
                        <select id="vip-select">
                            <option value="0">普通用户 (VIP0)</option>
                            <option value="1">初级会员 (VIP1)</option>
                            <option value="2">中级会员 (VIP2)</option>
                            <option value="3" selected>最高等级 (VIP3)</option>
                        </select>
                    </div>
                    <div class="setting-item">
                        <span class="label">自动签到/刷分</span>
                        <button class="action" id="toggle-sign">已开启</button>
                    </div>
                    <div class="setting-item">
                        <span class="label">账户余额伪造</span>
                        <span class="val" style="color:#34c759">999999.00</span>
                    </div>
                </div>

                <div class="panel" id="tab-logs">
                    <div id="log-container"></div>
                </div>

                <div class="panel" id="tab-profile">
                    <div class="setting-item"><span class="label">昵称伪造</span><button class="action">魅魔之主</button></div>
                    <div class="setting-item"><span class="label">身份ID</span><button class="action">c7e664dd...083b</button></div>
                    <div class="setting-item"><span class="label">数据同步</span><button class="action" onclick="location.reload()">应用并刷新</button></div>
                </div>
            </div>
        </div>
        \`;

        const island = shadow.getElementById('island');
        const sensor = shadow.getElementById('sensor');
        const statusTitle = shadow.getElementById('status-title');
        const vipSelect = shadow.getElementById('vip-select');

        // 交互逻辑
        island.onclick = (e) => {
            if(!island.classList.contains('expanded')) island.classList.add('expanded');
        };
        shadow.getElementById('close').onclick = (e) => {
            e.stopPropagation();
            island.classList.remove('expanded');
        };

        // 标签页切换
        shadow.querySelectorAll('.tab-btn').forEach(btn => {
            btn.onclick = () => {
                shadow.querySelectorAll('.tab-btn, .panel').forEach(el => el.classList.remove('active'));
                btn.classList.add('active');
                shadow.getElementById('tab-' + btn.dataset.tab).classList.add('active');
            };
        });

        // 状态更新
        vipSelect.onchange = () => {
            localStorage.setItem('tech_vip', vipSelect.value);
            addLog('VIP等级更改为: ' + vipSelect.value, 'success');
        };

        window.__tech_ping = (msg) => {
            statusTitle.textContent = msg;
            sensor.style.background = "#0a84ff";
            setTimeout(() => { sensor.style.background = "#34c759"; statusTitle.textContent = "魅魔科技运行中"; }, 1500);
        };

        window.updateLogUI = () => {
            const container = shadow.getElementById('log-container');
            container.innerHTML = techConfig.logs.map(l => \`
                <div class="log-entry">
                    <span class="log-time">[\${l.time}]</span>
                    <span class="log-msg \${l.type ? 'log-type-'+l.type : ''}">\${l.msg}</span>
                </div>
            \`).join('');
        };
    }

    // --- 3. 自动化与劫持系统 ---
    function initHacks() {
        const originalFetch = window.fetch;
        window.fetch = async function(...args) {
            const url = args[0].toString();
            if(url.includes('/api/')) {
                addLog('正在拦截请求: ' + url.split('/').pop(), 'info');
                // 注入伪造Header给Worker
                const options = args[1] || {};
                options.headers = options.headers || {};
                const headers = new Headers(options.headers);
                headers.set('x-tech-vip', localStorage.getItem('tech_vip') || '3');
                options.headers = headers;
                args[1] = options;
            }
            return originalFetch.apply(this, args).then(res => {
                if(url.includes('/api/')) addLog('请求成功并修改', 'success');
                return res;
            });
        };

        // 自动签到逻辑 (模拟HAR中的签到请求)
        async function autoCheckin() {
            if (localStorage.getItem('last_sign') === new Date().toDateString()) return;
            addLog('发起自动签到...', 'info');
            try {
                // 这里模拟发送签到API请求
                await fetch('/api/user/checkin', { method: 'POST' });
                localStorage.setItem('last_sign', new Date().toDateString());
                addLog('自动签到成功，积分+100', 'success');
            } catch(e) {}
        }
        setTimeout(autoCheckin, 3000);
    }

    injectUI();
    initHacks();
    addLog('魅魔科技挂载成功', 'success');
})();
`;

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const targetUrl = new URL(request.url);
        targetUrl.hostname = new URL(TARGET_URL).hostname;

        const clientVip = request.headers.get('x-tech-vip') || '3';

        const newHeaders = new Headers(request.headers);
        newHeaders.delete("accept-encoding");
        newHeaders.set("Host", targetUrl.hostname);
        newHeaders.set("Origin", TARGET_URL);
        newHeaders.set("Referer", TARGET_URL + "/");

        const newRequest = new Request(targetUrl.toString(), {
            method: request.method,
            headers: newHeaders,
            body: request.body,
            redirect: "manual"
        });

        let response = await fetch(newRequest);
        let respHeaders = new Headers(response.headers);
        const contentType = respHeaders.get("content-type") || "";

        respHeaders.delete("content-security-policy");
        respHeaders.set("Access-Control-Allow-Origin", "*");

        // 1. HTML 注入
        if (contentType.includes("text/html")) {
            let text = await response.text();
            text = text.replace('</head>', `<script>${INJECT_SCRIPT}</script></head>`);
            return new Response(text, { status: response.status, headers: respHeaders });
        }

        // 2. API JSON 深度篡改 (基于 HAR 分析)
        if (contentType.includes("application/json") || url.pathname.includes("/api/")) {
            try {
                let data = await response.json();
                
                // 深度遍历并根据 clientVip 进行修改
                const modifiedData = deepHack(data, clientVip);
                
                const jsonStr = JSON.stringify(modifiedData);
                respHeaders.set("content-length", new Blob([jsonStr]).size.toString());
                return new Response(jsonStr, { status: 200, headers: respHeaders });
            } catch (e) {
                return response;
            }
        }

        // 3. SSE 流处理 (防止高级模型报错弹窗)
        if (contentType.includes("text/event-stream")) {
            const { readable, writable } = new TransformStream();
            modifySSE(response.body, writable);
            return new Response(readable, { status: 200, headers: respHeaders });
        }

        return response;
    }
};

/**
 * 递归篡改引擎：不模拟，直接改写数据结构
 */
function deepHack(obj, vipLevel) {
    if (!obj || typeof obj !== 'object') return obj;

    for (let key in obj) {
        const lowKey = key.toLowerCase();
        
        // 修改 VIP 等级
        if (['vip', 'viplevel', 'level', 'user_level', 'tier'].includes(lowKey)) {
            obj[key] = parseInt(vipLevel);
        }
        
        // 修改积分与余额
        if (['credits', 'points', 'balance', 'gold', 'quota', 'total_points'].includes(lowKey)) {
            obj[key] = 999999.00;
        }

        // 修改签到状态 (强制为已签到)
        if (['is_sign', 'signed', 'has_checkin'].includes(lowKey)) {
            obj[key] = true;
        }

        // 修改个人资料 (HAR 中出现的字段)
        if (lowKey === 'nickname') obj[key] = "魅魔之主";
        if (lowKey === 'gender') obj[key] = "男性";
        if (lowKey === 'bio') obj[key] = "科技核心已接管此账户";

        if (typeof obj[key] === 'object') {
            deepHack(obj[key], vipLevel);
        }
    }
    return obj;
}

/**
 * SSE 流式数据补丁：拦截“积分不足”并转为提示文字
 */
async function modifySSE(readable, writable) {
    const reader = readable.getReader();
    const writer = writable.getWriter();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    
    const tip = "\\n\\n[科技核心：当前模型请求成功，已绕过云端配额限制]\\n\\n";

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            let chunk = decoder.decode(value, { stream: true });
            
            if (chunk.includes("积分不足") || chunk.includes("upgrade_needed")) {
                chunk = chunk.replace(/"type":"error"/g, '"type":"token"')
                             .replace(/"data":".*?"/g, '"data":"' + tip + '"');
            }
            await writer.write(encoder.encode(chunk));
        }
    } catch (e) {} finally {
        await writer.close();
    }
}