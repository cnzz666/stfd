addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  thisProxyServerUrlHttps = `${url.protocol}//${url.hostname}/`;
  thisProxyServerUrl_hostOnly = url.host;
  event.respondWith(handleRequest(event.request));
})

const TARGET_BASE_URL = "https://ti.qq.com/qqlevel/index";
const BYPASS_URLS = [
  "https://ui.ptlogin2.qq.com/cgi-bin/ssl/check",
  "https://ui.ptlogin2.qq.com/"
];

var thisProxyServerUrlHttps;
var thisProxyServerUrl_hostOnly;

// nginx欢迎页面
const nginxWelcomePage = `<!DOCTYPE html>
<html>
<head>
<title>Welcome to nginx!</title>
<style>
body {
width: 35em;
margin: 0 auto;
font-family: Tahoma, Verdana, Arial, sans-serif;
}
</style>
</head>
<body>
<h1>Welcome to nginx!</h1>
<p>If you see this page, the nginx web server is successfully installed and
working. Further configuration is required.</p>
<p>For online documentation and support please refer to
<a href="http://nginx.org/">nginx.org</a>.<br/>
Commercial support is available at
<a href="http://nginx.com/">nginx.com</a>.</p>
<p><em>Thank you for using nginx.</em></p>
</body>
</html>`;

async function handleRequest(request) {
  const url = new URL(request.url);
  
  // 根路径显示nginx页面
  if (url.pathname === "/" || url.pathname === "") {
    return new Response(nginxWelcomePage, {
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }

  // 移除路径开头的斜杠
  let targetPath = url.pathname;
  if (targetPath.startsWith("/")) {
    targetPath = targetPath.substring(1);
  }

  // 构建目标URL：将路径直接附加到目标基础URL后面
  let targetUrl;
  try {
    // 如果是完整的URL（以http://或https://开头），直接使用
    if (targetPath.startsWith("http://") || targetPath.startsWith("https://")) {
      targetUrl = new URL(targetPath);
    } else {
      // 否则将路径附加到目标基础URL
      const baseUrl = new URL(TARGET_BASE_URL);
      // 处理路径拼接
      if (baseUrl.pathname.endsWith("/") && targetPath.startsWith("/")) {
        targetUrl = new URL(baseUrl.pathname + targetPath.substring(1), baseUrl.origin);
      } else if (!baseUrl.pathname.endsWith("/") && !targetPath.startsWith("/")) {
        targetUrl = new URL(baseUrl.pathname + "/" + targetPath, baseUrl.origin);
      } else {
        targetUrl = new URL(baseUrl.pathname + targetPath, baseUrl.origin);
      }
      targetUrl.search = url.search;
      targetUrl.hash = url.hash;
    }
  } catch (error) {
    return new Response(`Error constructing target URL: ${error.message}`, {
      status: 400,
      headers: { "Content-Type": "text/plain" }
    });
  }

  // 检查是否需要绕过代理
  const targetUrlString = targetUrl.toString();
  for (const bypassUrl of BYPASS_URLS) {
    if (targetUrlString.startsWith(bypassUrl)) {
      // 直接访问，不代理
      const directRequest = new Request(targetUrl, {
        headers: request.headers,
        method: request.method,
        body: request.body,
        redirect: "manual"
      });
      return fetch(directRequest);
    }
  }

  try {
    // 创建代理请求
    const proxyRequest = new Request(targetUrl, {
      headers: request.headers,
      method: request.method,
      body: request.body,
      redirect: "manual"
    });

    // 获取响应
    const response = await fetch(proxyRequest);

    // 处理重定向
    if (response.status >= 300 && response.status < 400 && response.headers.has("Location")) {
      const location = response.headers.get("Location");
      try {
        const redirectUrl = new URL(location, targetUrl);
        return Response.redirect(thisProxyServerUrlHttps + redirectUrl.pathname + redirectUrl.search + redirectUrl.hash, response.status);
      } catch (e) {
        // 如果重定向URL解析失败，直接返回原重定向
        return Response.redirect(location, response.status);
      }
    }

    // 处理响应
    const contentType = response.headers.get("Content-Type") || "";
    let modifiedResponse;

    if (contentType.includes("text/html") || contentType.includes("text/")) {
      let text = await response.text();
      
      // 简单的URL替换
      const replacements = [
        // 替换相对路径为代理路径
        { pattern: /(href|src|action)=(["'])(?!\/\/)(?![a-zA-Z][a-zA-Z0-9+.-]*:)([^"']*)\2/gi, 
          replacer: (match, attr, quote, path) => {
            if (path.startsWith("#") || path.startsWith("javascript:") || path.startsWith("data:") || path.startsWith("mailto:")) {
              return match;
            }
            if (path.startsWith("//")) {
              return `${attr}=${quote}${thisProxyServerUrlHttps}${path.substring(2)}${quote}`;
            }
            if (path.startsWith("/")) {
              return `${attr}=${quote}${thisProxyServerUrlHttps}${path.substring(1)}${quote}`;
            }
            // 相对路径
            const currentPath = url.pathname.substring(1);
            const pathParts = currentPath.split("/");
            pathParts.pop(); // 移除当前文件名
            const basePath = pathParts.join("/");
            return `${attr}=${quote}${thisProxyServerUrlHttps}${basePath ? basePath + "/" : ""}${path}${quote}`;
          }
        },
        // 替换完整URL为代理URL
        { pattern: /(href|src|action)=(["'])(https?:\/\/[^"']*)\2/gi,
          replacer: (match, attr, quote, fullUrl) => {
            // 检查是否是绕过URL
            for (const bypassUrl of BYPASS_URLS) {
              if (fullUrl.startsWith(bypassUrl)) {
                return match;
              }
            }
            return `${attr}=${quote}${thisProxyServerUrlHttps}${fullUrl}${quote}`;
          }
        },
        // 替换CSS中的URL
        { pattern: /url\((['"]?)(?!\/\/)(?![a-zA-Z][a-zA-Z0-9+.-]*:)([^)'"]+)\1\)/gi,
          replacer: (match, quote, path) => {
            if (path.startsWith("data:")) return match;
            if (path.startsWith("//")) {
              return `url(${quote}${thisProxyServerUrlHttps}${path.substring(2)}${quote})`;
            }
            if (path.startsWith("/")) {
              return `url(${quote}${thisProxyServerUrlHttps}${path.substring(1)}${quote})`;
            }
            const currentPath = url.pathname.substring(1);
            const pathParts = currentPath.split("/");
            pathParts.pop();
            const basePath = pathParts.join("/");
            return `url(${quote}${thisProxyServerUrlHttps}${basePath ? basePath + "/" : ""}${path}${quote})`;
          }
        },
        // 替换CSS中的完整URL
        { pattern: /url\((['"]?)(https?:\/\/[^)'"]+)\1\)/gi,
          replacer: (match, quote, fullUrl) => {
            for (const bypassUrl of BYPASS_URLS) {
              if (fullUrl.startsWith(bypassUrl)) {
                return match;
              }
            }
            return `url(${quote}${thisProxyServerUrlHttps}${fullUrl}${quote})`;
          }
        },
        // 替换JavaScript中的location和document.location
        { pattern: /(window\.|document\.)?location(\.[a-zA-Z]+)?/g,
          replacer: (match) => {
            if (match.includes("__location__yproxy__")) return match;
            return match.replace("location", "__location__yproxy__");
          }
        }
      ];

      // 应用所有替换
      for (const { pattern, replacer } of replacements) {
        text = text.replace(pattern, replacer);
      }

      // 注入代理脚本
      const injectScript = `
      <script>
      // 创建代理的location对象
      const proxyLocation = {
        href: "${targetUrl}",
        protocol: "${targetUrl.protocol}",
        host: "${targetUrl.host}",
        hostname: "${targetUrl.hostname}",
        port: "${targetUrl.port || ''}",
        pathname: "${targetUrl.pathname}",
        search: "${targetUrl.search}",
        hash: "${targetUrl.hash}",
        origin: "${targetUrl.origin}",
        reload: function() { window.location.reload(); },
        replace: function(url) { 
          if (url.startsWith('http://') || url.startsWith('https://')) {
            window.location.href = '${thisProxyServerUrlHttps}' + url;
          } else if (url.startsWith('/')) {
            window.location.href = '${thisProxyServerUrlHttps}' + url.substring(1);
          } else {
            window.location.href = '${thisProxyServerUrlHttps}' + url;
          }
        },
        assign: function(url) { 
          if (url.startsWith('http://') || url.startsWith('https://')) {
            window.location.href = '${thisProxyServerUrlHttps}' + url;
          } else if (url.startsWith('/')) {
            window.location.href = '${thisProxyServerUrlHttps}' + url.substring(1);
          } else {
            window.location.href = '${thisProxyServerUrlHttps}' + url;
          }
        }
      };

      // 重写window.location和document.location
      Object.defineProperty(window, '__location__yproxy__', {
        get: function() { return proxyLocation; },
        set: function(url) { 
          if (url.startsWith('http://') || url.startsWith('https://')) {
            window.location.href = '${thisProxyServerUrlHttps}' + url;
          } else if (url.startsWith('/')) {
            window.location.href = '${thisProxyServerUrlHttps}' + url.substring(1);
          } else {
            window.location.href = '${thisProxyServerUrlHttps}' + url;
          }
        }
      });

      Object.defineProperty(document, '__location__yproxy__', {
        get: function() { return proxyLocation; },
        set: function(url) { 
          if (url.startsWith('http://') || url.startsWith('https://')) {
            window.location.href = '${thisProxyServerUrlHttps}' + url;
          } else if (url.startsWith('/')) {
            window.location.href = '${thisProxyServerUrlHttps}' + url.substring(1);
          } else {
            window.location.href = '${thisProxyServerUrlHttps}' + url;
          }
        }
      });

      // 重写fetch
      const originalFetch = window.fetch;
      window.fetch = function(input, init) {
        let url;
        if (typeof input === 'string') {
          url = input;
        } else if (input instanceof Request) {
          url = input.url;
        } else {
          return originalFetch.apply(this, arguments);
        }
        
        // 转换URL
        if (url.startsWith('http://') || url.startsWith('https://')) {
          // 检查是否是绕过URL
          const bypassUrls = ${JSON.stringify(BYPASS_URLS)};
          for (const bypassUrl of bypassUrls) {
            if (url.startsWith(bypassUrl)) {
              return originalFetch.apply(this, arguments);
            }
          }
          url = '${thisProxyServerUrlHttps}' + url;
        } else if (url.startsWith('//')) {
          url = '${thisProxyServerUrlHttps}' + url.substring(2);
        } else if (url.startsWith('/')) {
          url = '${thisProxyServerUrlHttps}' + url.substring(1);
        }
        
        if (typeof input === 'string') {
          return originalFetch(url, init);
        } else {
          const newRequest = new Request(url, input);
          return originalFetch(newRequest, init);
        }
      };

      // 重写XMLHttpRequest
      const originalOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
        if (url.startsWith('http://') || url.startsWith('https://')) {
          const bypassUrls = ${JSON.stringify(BYPASS_URLS)};
          for (const bypassUrl of bypassUrls) {
            if (url.startsWith(bypassUrl)) {
              return originalOpen.apply(this, arguments);
            }
          }
          url = '${thisProxyServerUrlHttps}' + url;
        } else if (url.startsWith('//')) {
          url = '${thisProxyServerUrlHttps}' + url.substring(2);
        } else if (url.startsWith('/')) {
          url = '${thisProxyServerUrlHttps}' + url.substring(1);
        }
        return originalOpen.apply(this, arguments);
      };
      </script>
      `;

      // 将脚本注入到HTML的head部分
      if (text.includes("</head>")) {
        text = text.replace("</head>", injectScript + "</head>");
      } else if (text.includes("<html>")) {
        text = text.replace("<html>", "<html><head>" + injectScript + "</head>");
      } else {
        text = injectScript + text;
      }

      // 创建新的响应
      modifiedResponse = new Response(text, response);
    } else {
      // 非文本内容，直接返回
      modifiedResponse = new Response(response.body, response);
    }

    // 设置跨域头
    modifiedResponse.headers.set("Access-Control-Allow-Origin", "*");
    modifiedResponse.headers.delete("Content-Security-Policy");
    modifiedResponse.headers.delete("X-Frame-Options");
    
    return modifiedResponse;

  } catch (error) {
    return new Response(`Proxy error: ${error.message}`, {
      status: 500,
      headers: { "Content-Type": "text/plain" }
    });
  }
}