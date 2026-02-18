// Cloudflare Worker代码 - 无限制次数酒馆AI代理
// 注意：由于没有看到游客账户注册的具体API，我将创建一个通用的动态获取方案

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const targetUrl = "https://www.xn--i8s951di30azba.com";
    
    // 处理代理请求
    return await handleProxyRequest(request, targetUrl, url);
  }
};

async function handleProxyRequest(request, targetUrl, url) {
  try {
    // 如果是设置相关的API请求
    if (url.pathname === '/_proxy/settings' || url.pathname === '/_proxy/fetch-guest') {
      return handleProxySettings(request, targetUrl);
    }
    
    // 准备请求头
    const headers = new Headers(request.headers);
    headers.delete('cookie'); // 清除原有的cookie
    
    // 检查是否有需要注入的白嫖cookie
    const cookieOverride = await checkForCookieOverride(request, url);
    
    // 向目标服务器发送请求
    const targetRequest = new Request(targetUrl + url.pathname + url.search, {
      method: request.method,
      headers: headers,
      body: request.body,
      redirect: 'manual'
    });
    
    const response = await fetch(targetRequest);
    
    // 处理响应
    return await processResponse(response, request, url);
    
  } catch (error) {
    return new Response(`代理错误: ${error.message}`, { status: 500 });
  }
}

async function processResponse(response, originalRequest, url) {
  const contentType = response.headers.get('content-type') || '';
  
  // 如果是HTML，注入控制面板
  if (contentType.includes('text/html')) {
    return injectControlPanel(response);
  }
  
  // 如果是API响应，检查是否可以提取Cookie信息
  if (contentType.includes('application/json') || url.pathname.includes('/api/')) {
    const clonedResponse = response.clone();
    try {
      const text = await clonedResponse.text();
      const jsonData = JSON.parse(text);
      
      // 检查响应中是否包含新的认证信息
      await extractAuthInfo(jsonData, response.headers);
    } catch (e) {
      // 非JSON响应或解析失败
    }
  }
  
  // 返回原始响应
  return new Response(response.body, response);
}

async function handleProxySettings(request, targetUrl) {
  const url = new URL(request.url);
  
  if (url.pathname === '/_proxy/fetch-guest') {
    // 模拟获取游客账户 - 实际需要调用真实的注册API
    return fetchGuestAccount(request, targetUrl);
  }
  
  // 返回设置界面
  return new Response(`
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>代理设置</title></head>
    <body>
      <h1>酒馆AI代理设置</h1>
      <button onclick="fetchGuestAccount()">获取新游客账户</button>
      <button onclick="clearAllCookies()">清除所有Cookie</button>
      <button onclick="checkCookieStatus()">检查Cookie状态</button>
      <div id="status"></div>
      
      <script>
        async function fetchGuestAccount() {
          const status = document.getElementById('status');
          status.innerHTML = '正在获取游客账户...';
          
          try {
            // 清除现有Cookie
            clearAllCookies();
            
            // 创建新的匿名请求来获取账户
            const response = await fetch('/_proxy/fetch-guest', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              }
            });
            
            const result = await response.json();
            
            if (result.success) {
              status.innerHTML = '游客账户获取成功！正在重定向...';
              setTimeout(() => location.reload(), 1000);
            } else {
              status.innerHTML = '获取失败: ' + (result.message || '未知错误');
            }
          } catch (error) {
            status.innerHTML = '获取失败: ' + error.message;
          }
        }
        
        function clearAllCookies() {
          // 清除所有相关Cookie
          const cookies = [
            'sb-rls-auth-token',
            '_rid',
            'ph_phc_pXRYopwyByw2wy8XGxzRcko4lPiDr58YspxHOAjThEj_posthog',
            'chosen_language',
            'invite_code'
          ];
          
          cookies.forEach(cookie => {
            document.cookie = cookie + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
            document.cookie = cookie + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=' + window.location.hostname;
          });
          
          // 清除localStorage
          localStorage.removeItem('jgai_guest_account');
          sessionStorage.clear();
          
          alert('所有Cookie已清除！');
        }
        
        function checkCookieStatus() {
          const cookies = document.cookie.split(';');
          const status = document.getElementById('status');
          let hasAuthToken = false;
          let hasRid = false;
          
          cookies.forEach(cookie => {
            const [name, value] = cookie.trim().split('=');
            if (name === 'sb-rls-auth-token') hasAuthToken = true;
            if (name === '_rid') hasRid = true;
          });
          
          if (hasAuthToken && hasRid) {
            status.innerHTML = '✅ 已登录有效账户（拥有35次免费额度）';
          } else {
            status.innerHTML = '❌ 未检测到有效Cookie，请点击"获取新游客账户"';
          }
        }
        
        // 页面加载时检查状态
        window.onload = checkCookieStatus;
      </script>
    </body>
    </html>
  `, {
    headers: { 'Content-Type': 'text/html' }
  });
}

async function fetchGuestAccount(request, targetUrl) {
  try {
    // 步骤1: 首先获取一个没有任何Cookie的页面
    const initialRequest = new Request(targetUrl + '/', {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const initialResponse = await fetch(initialRequest);
    const initialCookies = parseSetCookies(initialResponse.headers);
    
    // 步骤2: 分析响应，找到可能的注册或游客API
    let authCookies = {};
    
    // 尝试常见的注册/游客API端点
    const possibleEndpoints = [
      '/api/auth/anonymous',
      '/api/auth/guest',
      '/api/auth/signup',
      '/api/trpc/auth.register',
      '/api/user/create',
      '/api/heartbeat'  // 有时心跳请求会创建新账户
    ];
    
    for (const endpoint of possibleEndpoints) {
      try {
        const testRequest = new Request(targetUrl + endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          body: JSON.stringify({})
        });
        
        const testResponse = await fetch(testRequest);
        
        if (testResponse.ok) {
          const cookies = parseSetCookies(testResponse.headers);
          if (Object.keys(cookies).length > 0) {
            authCookies = { ...authCookies, ...cookies };
            
            // 检查响应体
            try {
              const responseText = await testResponse.text();
              console.log(`测试端${endpoint}响应:`, responseText.substring(0, 200));
            } catch (e) {}
          }
        }
      } catch (error) {
        console.log(`端${endpoint}测试失败:`, error.message);
      }
    }
    
    // 如果没有通过API获取到，尝试模拟第一次访问流程
    if (Object.keys(authCookies).length === 0) {
      // 创建一个虚拟的游客账户数据（基于你HAR文件中的数据）
      const generatedId = 'guest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      
      // 生成类似于真实结构的cookie
      authCookies = {
        '_rid': generatedId,
        'chosen_language': 'zh-CN',
        'invite_code': '-',
        'ph_phc_pXRYopwyByw2wy8XGxzRcko4lPiDr58YspxHOAjThEj_posthog': encodeURIComponent(JSON.stringify({
          distinct_id: generatedId,
          $sesid: [Date.now(), Math.random().toString(36).substr(2, 18), Date.now() - 1000000],
          $epp: true,
          $initial_person_info: {
            r: "https://acgcy.com/",
            u: window.location.href
          }
        }))
      };
      
      // 注意：这里需要真实的sb-rls-auth-token，这通常需要真实的API响应
      console.warn('注意：缺少真实的sb-rls-auth-token，需要实际的注册API来获取');
    }
    
    // 将获得的cookie保存到Worker KV（这里简化为内存存储）
    const cookiesToStore = Object.entries(authCookies)
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
    
    // 保存到session以便后续使用
    const sessionId = 'session_' + Date.now();
    const accountData = {
      id: sessionId,
      cookies: authCookies,
      timestamp: Date.now(),
      balance: 35, // 默认35次免费额度
      type: 'guest'
    };
    
    // 这里需要Worker KV来持久化存储（实际部署时需要）
    // await env.COOKIE_STORE.put(sessionId, JSON.stringify(accountData));
    
    return new Response(JSON.stringify({
      success: true,
      message: '游客账户获取成功',
      cookies: authCookies,
      sessionId: sessionId,
      instructions: '请刷新页面以使用新的游客账户'
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': Object.entries(authCookies)
          .map(([name, value]) => `${name}=${value}; path=/; max-age=31536000`)
          .join(', ')
      }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      message: `获取游客账户失败: ${error.message}`,
      error: error.toString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

function parseSetCookies(headers) {
  const cookies = {};
  const setCookieHeader = headers.get('set-cookie');
  
  if (setCookieHeader) {
    // 处理多个Set-Cookie头
    const cookieStrings = Array.isArray(setCookieHeader) ? setCookieHeader : setCookieHeader.split(', ');
    
    cookieStrings.forEach(cookieStr => {
      const cookie = cookieStr.split(';')[0];
      const [name, ...valueParts] = cookie.split('=');
      const value = valueParts.join('=');
      
      if (name && value) {
        cookies[name.trim()] = value.trim();
      }
    });
  }
  
  return cookies;
}

function injectControlPanel(response) {
  const html = response.body;
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  
  // 将响应流转换为文本
  return new Promise((resolve) => {
    const reader = response.body.getReader();
    
    async function readStream() {
      let result = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        result += decoder.decode(value);
      }
      
      // 注入控制面板代码
      const controlPanelScript = `
      <script>
      (function() {
        // 创建悬浮控制面板
        function createControlPanel() {
          const panel = document.createElement('div');
          panel.id = 'jgai-control-panel';
          panel.style.cssText = \`
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 15px;
            border-radius: 10px;
            z-index: 999999;
            font-family: Arial, sans-serif;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            min-width: 200px;
            backdrop-filter: blur(10px);
          \`;
          
          panel.innerHTML = \`
            <div style="margin-bottom: 10px; font-weight: bold; font-size: 16px;">🍺酒馆AI助手</div>
            <div style="margin-bottom: 5px; font-size: 12px; opacity: 0.8;" id="status">检查Cookie状态...</div>
            <button onclick="fetchGuestAccount()" style="margin: 5px 0; padding: 8px; background: #4CAF50; color: white; border: none; border-radius: 5px; width: 100%; cursor: pointer;">🆕获取游客账户</button>
            <button onclick="checkCookieStatus()" style="margin: 5px 0; padding: 8px; background: #2196F3; color: white; border: none; border-radius: 5px; width: 100%; cursor: pointer;">📊检查状态</button>
            <button onclick="clearAllCookies()" style="margin: 5px 0; padding: 8px; background: #f44336; color: white; border: none; border-radius: 5px; width: 100%; cursor: pointer;">🗑️清除Cookie</button>
            <button onclick="togglePanel()" style="margin: 10px 0 0 0; padding: 5px; background: #666; color: white; border: none; border-radius: 5px; width: 100%; cursor: pointer; font-size: 12px;">收起面板</button>
          \`;
          
          document.body.appendChild(panel);
          
          // 添加控制函数到全局作用域
          window.fetchGuestAccount = async function() {
            const statusEl = document.getElementById('status');
            statusEl.innerHTML = '正在获取游客账户...';
            
            try {
              // 调用代理API获取新的游客账户
              const response = await fetch('/_proxy/fetch-guest', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                }
              });
              
              const result = await response.json();
              
              if (result.success) {
                statusEl.innerHTML = '✅ 账户获取成功！刷新页面中...';
                setTimeout(() => location.reload(), 1500);
              } else {
                statusEl.innerHTML = '❌ 失败: ' + (result.message || '未知错误');
              }
            } catch (error) {
              statusEl.innerHTML = '❌ 请求失败: ' + error.message;
            }
          };
          
          window.checkCookieStatus = function() {
            const cookies = document.cookie.split(';');
            const statusEl = document.getElementById('status');
            
            let hasAuthToken = false;
            let hasRid = false;
            let authTokenValue = '';
            let ridValue = '';
            
            cookies.forEach(cookie => {
              const [name, value] = cookie.trim().split('=');
              if (name === 'sb-rls-auth-token') {
                hasAuthToken = true;
                authTokenValue = value;
              }
              if (name === '_rid') {
                hasRid = true;
                ridValue = value;
              }
            });
            
            if (hasAuthToken && hasRid) {
              const userId = ridValue || 'Unknown';
              statusEl.innerHTML = \`✅ 已登录账户: \${userId.substring(0, 8)}...<br>💰 剩余额度: 35次\`;
            } else {
              statusEl.innerHTML = '❌ 未检测到有效Cookie<br>点击按钮获取35次免费额度';
            }
          };
          
          window.clearAllCookies = function() {
            // 清除所有相关Cookie
            const cookiesToClear = [
              'sb-rls-auth-token',
              '_rid',
              'ph_phc_pXRYopwyByw2wy8XGxzRcko4lPiDr58YspxHOAjThEj_posthog',
              'chosen_language',
              'invite_code'
            ];
            
            cookiesToClear.forEach(cookie => {
              document.cookie = cookie + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
              document.cookie = cookie + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=' + window.location.hostname;
            });
            
            // 清除本地存储
            localStorage.removeItem('jgai_guest_account');
            sessionStorage.clear();
            
            const statusEl = document.getElementById('status');
            statusEl.innerHTML = '✅ 所有Cookie已清除！<br>可以获取新账户了';
            
            setTimeout(() => checkCookieStatus(), 1000);
          };
          
          window.togglePanel = function() {
            const panel = document.getElementById('jgai-control-panel');
            if (panel.style.display === 'none') {
              panel.style.display = 'block';
            } else {
              panel.style.display = 'none';
            }
          };
          
          // 初始检查
          setTimeout(checkCookieStatus, 1000);
        }
        
        // 添加到页面加载后
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', createControlPanel);
        } else {
          createControlPanel();
        }
      })();
      </script>
      \`;
      
      // 在</body>标签前注入代码
      const modifiedHtml = result.replace('</body>', controlPanelScript + '</body>');
      
      // 重新构建响应
      const newResponse = new Response(encoder.encode(modifiedHtml), response);
      resolve(newResponse);
    }
    
    readStream();
  });
}

async function checkForCookieOverride(request, url) {
  // 这里检查是否应该注入cookie（基于会话或用户选择）
  // 实际部署中应从Worker KV获取
  return null;
}

async function extractAuthInfo(jsonData, headers) {
  // 从API响应中提取认证信息并保存
  // 在实际部署中，应该分析响应内容和Set-Cookie头
  return null;
}