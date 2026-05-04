/**
 * 电子魅魔 - 终极科研核心 (V4.2 修复版)
 * 修复登录、权限控制、Cookie管理等核心问题
 */

const TARGET_URL = "https://www.xn--i8s951di30azba.com";

// --- 核心注入脚本 ---
const INJECT_SCRIPT = `
(function() {
    // 初始化状态：尝试从本地恢复，否则使用默认值
    const techState = {
        enabled: localStorage.getItem('tech_enabled') === 'true',
        logs: [],
        vipLevel: parseInt(localStorage.getItem('cfg_vip')) || 3,
        credits: parseInt(localStorage.getItem('cfg_credits')) || 999999,
        isFirstVisit: !localStorage.getItem('has_visited')
    };

    function addLog(type, msg) {
        const log = { time: new Date().toLocaleTimeString(), type, msg };
        techState.logs.unshift(log);
        if (techState.logs.length > 50) techState.logs.pop();
        if (window.updateUI) window.updateUI();
        if (window.__tech_ping) window.__tech_ping();
    }

    function hackAppState() {
        if (!techState.enabled) return;
        const vipData = {
            vip: techState.vipLevel, vipLevel: techState.vipLevel, level: techState.vipLevel, 
            plan: "VIP" + techState.vipLevel, isVip: true, is_vip: true, premium: true,
            credits: techState.credits, quota: techState.credits, balance: techState.credits,
            nickname: "魅魔核心用户", gender: "男性", bio: "系统已接管"
        };
        
        if (window.__INITIAL_STATE__ && window.__INITIAL_STATE__.user) {
            Object.assign(window.__INITIAL_STATE__.user, vipData);
        }
        window.__USER_STATE__ = vipData;
        window.localStorage.setItem('vip_status', techState.vipLevel.toString());
    }

    function injectIsland() {
        if (document.getElementById('tech-island-root')) return;
        const root = document.createElement('div');
        root.id = 'tech-island-root';
        document.documentElement.appendChild(root);
        const shadow = root.attachShadow({ mode: 'open' });

        shadow.innerHTML = \`
        <style>
            :host { position: fixed; top: 12px; left: 50%; transform: translateX(-50%); z-index: 2147483647; font-family: system-ui, -apple-system, sans-serif; }
            #island { width: 140px; height: 38px; background: rgba(0,0,0,0.9); backdrop-filter: blur(10px); border-radius: 20px; color: #fff; 
                      transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1); overflow: hidden; cursor: pointer; border: 1px solid rgba(255,255,255,0.1); }
            #island.expanded { width: 340px; height: 480px; border-radius: 28px; cursor: default; }
            
            .compact-info { display: flex; align-items: center; justify-content: center; gap: 8px; height: 38px; transition: opacity 0.3s; }
            #island.expanded .compact-info { opacity: 0; height: 0; }
            .dot { width: 8px; height: 8px; background: \${techState.enabled ? '#34c759' : '#ff3b30'}; border-radius: 50%; box-shadow: 0 0 10px \${techState.enabled ? '#34c759' : '#ff3b30'}; transition: 0.3s; }
            .status-text { font-size: 13px; font-weight: 600; }

            .full-content { opacity: 0; display: none; padding: 20px; flex-direction: column; height: 100%; box-sizing: border-box; }
            #island.expanded .full-content { opacity: 1; display: flex; }
            
            .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
            .header h3 { margin: 0; font-size: 16px; color: #0a84ff; }
            .close-btn { background: #333; border: none; color: #fff; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; }

            .tab-container { display: flex; gap: 10px; margin-bottom: 15px; border-bottom: 1px solid #333; padding-bottom: 10px; }
            .tab { font-size: 12px; color: #888; cursor: pointer; padding: 4px 8px; }
            .tab.active { color: #fff; border-bottom: 2px solid #0a84ff; }

            .scroll-area { flex: 1; overflow-y: auto; font-size: 12px; color: #ccc; }
            .log-item { margin-bottom: 6px; border-left: 2px solid #0a84ff; padding-left: 8px; animation: fadeIn 0.3s; }
            .log-time { color: #555; margin-right: 5px; }
            .log-type { font-weight: bold; color: #34c759; margin-right: 5px; }

            .control-panel { display: flex; flex-direction: column; gap: 10px; }
            .input-group { display: flex; justify-content: space-between; align-items: center; }
            input { background: #222; border: 1px solid #444; color: #fff; padding: 4px 8px; border-radius: 4px; width: 60px; }
            button.action-btn { background: #0a84ff; border: none; color: #fff; padding: 8px; border-radius: 6px; cursor: pointer; font-weight: bold; margin-top:5px; }
            button.reset-btn { background: #444; border: none; color: #eee; padding: 6px; border-radius: 6px; cursor: pointer; font-size: 11px; }
            textarea { background: #222; border: 1px solid #444; color: #fff; padding: 4px 8px; border-radius: 4px; width: 100%; resize: vertical; font-size: 12px; }
            .cookie-area { margin-top: 10px; display: flex; flex-direction: column; gap: 8px; }

            /* 弹窗样式 */
            #first-visit-modal { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 2147483647; }
            .modal-card { background: #1c1c1e; border: 1px solid #333; padding: 25px; border-radius: 20px; width: 280px; text-align: center; }
            .modal-card h4 { color: #0a84ff; margin: 0 0 10px 0; }
            .modal-card p { font-size: 13px; color: #ccc; line-height: 1.5; }
            .modal-btn { background: #0a84ff; color: white; border: none; padding: 10px 20px; border-radius: 10px; cursor: pointer; font-weight: bold; margin-top: 15px; width: 100%; }

            @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
        </style>
        <div id="island">
            <div class="compact-info">
                <div class="dot" id="indicator"></div>
                <span class="status-text">\${techState.enabled ? '魅魔科技已载入' : '修改功能已禁用'}</span>
            </div>
            <div class="full-content">
                <div class="header">
                    <h3>科技辅助核心 V4.2</h3>
                    <button class="close-btn" id="close">✕</button>
                </div>
                <div class="tab-container">
                    <div class="tab active" id="tab-log">实时日志</div>
                    <div class="tab" id="tab-ctrl">属性控制</div>
                    <div class="tab" id="tab-cookie">Cookie</div>
                </div>
                <div class="scroll-area" id="log-display"></div>
                <div class="control-panel" id="ctrl-display" style="display:none;">
                    <div class="input-group">
                        <span>VIP等级 (0-3)</span>
                        <input type="number" id="cfg-vip" value="\${techState.vipLevel}" min="0" max="3">
                    </div>
                    <div class="input-group">
                        <span>积分数值</span>
                        <input type="number" id="cfg-credits" value="\${techState.credits}">
                    </div>
                    <button class="action-btn" id="save-cfg">应用并重载状态</button>
                    <button class="reset-btn" id="reset-cfg">重置默认设置</button>
                    <p style="font-size:10px; color:#666; margin-top:10px;">* 修改后系统将自动拦截后续请求并伪造响应</p>
                </div>
                <div class="control-panel cookie-area" id="cookie-display" style="display:none;">
                    <span style="font-size:12px;">当前Cookie</span>
                    <textarea id="cookie-view" rows="3" readonly></textarea>
                    <span style="font-size:12px;">注入Cookie (格式: key=value; key2=value2)</span>
                    <textarea id="cookie-input" rows="3" placeholder="粘贴Cookie字符串..."></textarea>
                    <button class="action-btn" id="apply-cookie">注入并刷新</button>
                </div>
            </div>
        </div>
        
        \${techState.isFirstVisit ? \`
        <div id="first-visit-modal">
            <div class="modal-card">
                <h4>首次访问提醒</h4>
                <p>检测到你是第一次访问，为了让你正常获取游客账号，<b>注入功能已被禁用</b>。</p>
                <p>如需启用，请登录后或在控制面板启用修改功能。</p>
                <button class="modal-btn" id="accept-visit">我知道了</button>
            </div>
        </div>
        \` : ''}
        \`;

        const island = shadow.getElementById('island');
        const logDisplay = shadow.getElementById('log-display');
        const indicator = shadow.getElementById('indicator');

        // 处理首次访问弹窗
        if (techState.isFirstVisit) {
            shadow.getElementById('accept-visit').onclick = () => {
                localStorage.setItem('has_visited', 'true');
                shadow.getElementById('first-visit-modal').remove();
            };
        }

        island.onclick = (e) => {
            if(!island.classList.contains('expanded')) island.classList.add('expanded');
        };
        shadow.getElementById('close').onclick = (e) => {
            e.stopPropagation();
            island.classList.remove('expanded');
        };

        // 切换标签
        function switchTab(tabId) {
            ['log-display','ctrl-display','cookie-display'].forEach(id => shadow.getElementById(id).style.display = 'none');
            ['tab-log','tab-ctrl','tab-cookie'].forEach(id => shadow.getElementById(id).classList.remove('active'));
            shadow.getElementById(tabId).style.display = tabId==='log-display'?'block':'flex';
            shadow.getElementById('tab-'+tabId.split('-')[0]).classList.add('active');
        }
        shadow.getElementById('tab-log').onclick = () => switchTab('log-display');
        shadow.getElementById('tab-ctrl').onclick = () => switchTab('ctrl-display');
        shadow.getElementById('tab-cookie').onclick = () => {
            switchTab('cookie-display');
            // 刷新当前cookie显示
            shadow.getElementById('cookie-view').value = document.cookie;
        };

        // 应用Cookie注入
        shadow.getElementById('apply-cookie').onclick = () => {
            const cookieStr = shadow.getElementById('cookie-input').value.trim();
            if (cookieStr) {
                // 简单拆分并设置cookie
                cookieStr.split(';').forEach(pair => {
                    const eqIdx = pair.indexOf('=');
                    if (eqIdx > 0) {
                        const key = pair.substring(0, eqIdx).trim();
                        const val = pair.substring(eqIdx+1).trim();
                        document.cookie = key + '=' + val + ';path=/';
                    }
                });
                addLog('COOKIE', '已注入Cookie，页面将刷新');
                setTimeout(() => location.reload(), 500);
            }
        };

        // 保存并应用配置
        shadow.getElementById('save-cfg').onclick = (e) => {
            e.stopPropagation();
            techState.vipLevel = parseInt(shadow.getElementById('cfg-vip').value);
            techState.credits = parseInt(shadow.getElementById('cfg-credits').value);
            techState.enabled = true; // 触发应用时强制开启功能
            
            localStorage.setItem('cfg_vip', techState.vipLevel);
            localStorage.setItem('cfg_credits', techState.credits);
            localStorage.setItem('tech_enabled', 'true');
            
            addLog('CONFIG', '属性配置已更新并持久化');
            hackAppState();
            
            // UI 反馈
            shadow.querySelector('.status-text').innerText = '魅魔科技已载入';
            indicator.style.background = "#34c759";
        };

        // 重置配置
        shadow.getElementById('reset-cfg').onclick = (e) => {
            e.stopPropagation();
            localStorage.removeItem('tech_enabled');
            localStorage.removeItem('cfg_vip');
            localStorage.removeItem('cfg_credits');
            location.reload();
        };

        window.updateUI = () => {
            logDisplay.innerHTML = techState.logs.map(l => \`
                <div class="log-item">
                    <span class="log-time">\${l.time}</span>
                    <span class="log-type">[\${l.type}]</span>
                    <span>\${l.msg}</span>
                </div>
            \`).join('');
        };

        window.__tech_ping = function() {
            if(!techState.enabled) return;
            indicator.style.background = "#0a84ff";
            indicator.style.boxShadow = "0 0 12px #0a84ff";
            setTimeout(() => {
                indicator.style.background = "#34c759";
                indicator.style.boxShadow = "0 0 10px #34c759";
            }, 400);
        };
    }

    injectIsland();
    if (techState.enabled) {
        hackAppState();
        setInterval(hackAppState, 2000);
        addLog('SYSTEM', '魅魔科技挂载成功');
    } else {
        addLog('SYSTEM', '当前处于安全模式（未注入）');
    }
    
    // 劫持 Fetch（注入启用标记并添加header）
    const originalFetch = window.fetch;
    window.fetch = function() {
        const input = arguments[0];
        const init = arguments[1] || {};
        const url = typeof input === 'string' ? input : input.url;
        if (!techState.enabled) return originalFetch.apply(this, arguments);
        
        // 添加启用标记头
        let headers = new Headers(init.headers || {});
        headers.set('x-tech-enabled', '1');
        
        // 确保即使传入Request也能正常包装
        if (input instanceof Request) {
            const modified = new Request(input, { headers });
            return originalFetch.call(this, modified);
        }
        
        const newInit = { ...init, headers };
        if (typeof url === 'string' && (url.includes('/api/') || url.includes('/trpc/'))) {
            addLog('INTERCEPT', '正在拦截: ' + url.split('?')[0].split('/').pop());
        }
        return originalFetch.call(this, url, newInit);
    };
})();
`;

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const targetUrl = new URL(request.url);
        targetUrl.hostname = new URL(TARGET_URL).hostname;

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
        respHeaders.delete("content-security-policy");

        const contentType = respHeaders.get("content-type") || "";

        // 1. HTML 注入 (始终注入 UI 控制面板)
        if (contentType.includes("text/html")) {
            let text = await response.text();
            text = text.replace('</head>', `<script>${INJECT_SCRIPT}</script></head>`);
            return new Response(text, { status: response.status, headers: respHeaders });
        }

        // 2. SSE 流式处理
        if (contentType.includes("text/event-stream")) {
            return new Response(response.body, { status: 200, headers: respHeaders });
        }

        // 3. JSON 深度篡改 (仅在客户端明确启用且非auth路径时执行)
        if (contentType.includes("application/json")) {
            const techEnabled = request.headers.get('x-tech-enabled') === '1';
            const path = url.pathname.toLowerCase();
            // 排除登录/注册/验证等关键auth路径
            const isAuthPath = path.startsWith('/api/auth/') || path.includes('auth.sign') || path.includes('auth.verify');
            
            try {
                let text = await response.text();
                if (techEnabled && !isAuthPath) {
                    let data = JSON.parse(text);
                    
                    // 移除错误的 sign 匹配，仅保留明确的签到接口（可按需添加）
                    data = deepHackJSON(data);
                    const modified = JSON.stringify(data);
                    respHeaders.set("content-length", new Blob([modified]).size.toString());
                    return new Response(modified, { status: 200, headers: respHeaders });
                } else {
                    // 未启用或auth路径，原样返回
                    return new Response(text, { status: response.status, headers: respHeaders });
                }
            } catch (e) {
                return new Response(response.body, { status: response.status, headers: respHeaders });
            }
        }

        return new Response(response.body, { status: response.status, headers: respHeaders });
    }
};

function deepHackJSON(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    for (let key in obj) {
        let lowKey = key.toLowerCase();
        if (lowKey.includes('vip') || lowKey.includes('level') || lowKey.includes('plan')) {
            if (typeof obj[key] === 'number') obj[key] = 3;
            if (typeof obj[key] === 'string') obj[key] = "VIP 3";
        }
        if (lowKey.includes('quota') || lowKey.includes('credit') || lowKey.includes('balance') || lowKey.includes('point')) {
            obj[key] = 999999.00;
        }
        if (lowKey === 'isvip' || lowKey === 'is_vip' || lowKey === 'premium') {
            obj[key] = true;
        }
        if (lowKey === 'nickname') obj[key] = "电子魅魔首席用户";
        if (typeof obj[key] === 'object') deepHackJSON(obj[key]);
    }
    return obj;
}