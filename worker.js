addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  thisProxyServerUrlHttps = `${url.protocol}//${url.hostname}/`;
  thisProxyServerUrl_hostOnly = url.host;
  event.respondWith(handleRequest(event.request))
})

const str = "/";
const replaceUrlObj = "__location__yproxy__";
const TARGET_URL = "https://ti.qq.com/qqlevel/index";

var thisProxyServerUrlHttps;
var thisProxyServerUrl_hostOnly;

// 需要绕过代理的URL（直接访问）
const BYPASS_URLS = [
  "https://ui.ptlogin2.qq.com/cgi-bin/ssl/check",
  "https://ui.ptlogin2.qq.com/"
];

const httpRequestInjection = `
//---***========================================***---information---***========================================***---
var nowURL = new URL(window.location.href);
var proxy_host = nowURL.host;
var proxy_protocol = nowURL.protocol;
var proxy_host_with_schema = proxy_protocol + "//" + proxy_host + "/";
var original_website_url_str = window.location.href.substring(proxy_host_with_schema.length);
var original_website_url = new URL(original_website_url_str);
var original_website_host = original_website_url_str.substring(original_website_url_str.indexOf("://") + "://".length);
original_website_host = original_website_host.split('/')[0];
var original_website_host_with_schema = original_website_url_str.substring(0, original_website_url_str.indexOf("://")) + "://" + original_website_host + "/";

//---***========================================***---通用func---***========================================***---
function changeURL(relativePath){
  if(relativePath == null) return null;

  var relativePath_str = "";
  if (relativePath instanceof URL) {
    relativePath_str = relativePath.href;
  } else {
    relativePath_str = relativePath.toString();
  }

  try {
    if(relativePath_str.startsWith("data:") || relativePath_str.startsWith("mailto:") || relativePath_str.startsWith("javascript:") || relativePath_str.startsWith("chrome") || relativePath_str.startsWith("edge")) return relativePath_str;
  } catch {
    return relativePath_str;
  }

  var pathAfterAdd = "";
  if(relativePath_str.startsWith("blob:")){
    pathAfterAdd = "blob:";
    relativePath_str = relativePath_str.substring("blob:".length);
  }

  try {
    if(relativePath_str.startsWith(proxy_host_with_schema)) relativePath_str = relativePath_str.substring(proxy_host_with_schema.length);
    if(relativePath_str.startsWith(proxy_host + "/")) relativePath_str = relativePath_str.substring(proxy_host.length + 1);
    if(relativePath_str.startsWith(proxy_host)) relativePath_str = relativePath_str.substring(proxy_host.length);
  } catch {
    //ignore
  }
  
  try {
    var absolutePath = new URL(relativePath_str, original_website_url_str).href;
    absolutePath = absolutePath.replaceAll(window.location.href, original_website_url_str);
    absolutePath = absolutePath.replaceAll(encodeURI(window.location.href), encodeURI(original_website_url_str));
    absolutePath = absolutePath.replaceAll(encodeURIComponent(window.location.href), encodeURIComponent(original_website_url_str));
    
    absolutePath = absolutePath.replaceAll(proxy_host, original_website_host);
    absolutePath = absolutePath.replaceAll(encodeURI(proxy_host), encodeURI(original_website_host));
    absolutePath = absolutePath.replaceAll(encodeURIComponent(proxy_host), encodeURIComponent(original_website_host));
    
    absolutePath = proxy_host_with_schema + absolutePath;
    absolutePath = pathAfterAdd + absolutePath;
    
    return absolutePath;
  } catch (e) {
    console.log("Exception occured: " + e.message);
    return relativePath_str;
  }
}

function getOriginalUrl(url){
  if(url == null) return null;
  if(url.startsWith(proxy_host_with_schema)) return url.substring(proxy_host_with_schema.length);
  return url;
}

//---***========================================***---注入网络---***========================================***---
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

//---***========================================***---注入元素的src和href---***========================================***---
function elementPropertyInject(){
  const originalSetAttribute = HTMLElement.prototype.setAttribute;
  HTMLElement.prototype.setAttribute = function (name, value) {
      if (name == "src" || name == "href") {
        value = changeURL(value);
      }
      originalSetAttribute.call(this, name, value);
  };

  const originalGetAttribute = HTMLElement.prototype.getAttribute;
  HTMLElement.prototype.getAttribute = function (name) {
    const val = originalGetAttribute.call(this, name);
    if (name == "href" || name == "src") {
      return getOriginalUrl(val);
    }
    return val;
  };

  const setList = [
    [HTMLAnchorElement, "href"],
    [HTMLScriptElement, "src"],
    [HTMLImageElement, "src"],
    [HTMLLinkElement, "href"],
    [HTMLIFrameElement, "src"],
    [HTMLVideoElement, "src"],
    [HTMLAudioElement, "src"],
    [HTMLSourceElement, "src"],
    [HTMLObjectElement, "data"],
    [HTMLFormElement, "action"],
  ];
  
  for (const [whichElement, whichProperty] of setList) {
    if (!whichElement || !whichElement.prototype) continue;
    const descriptor = Object.getOwnPropertyDescriptor(whichElement.prototype, whichProperty);
    if (!descriptor) continue;
  
    Object.defineProperty(whichElement.prototype, whichProperty, {
      get: function () {
        const real = descriptor.get.call(this);
        return getOriginalUrl(real);
      },
      set: function (val) {
        descriptor.set.call(this, changeURL(val));
      },
      configurable: true,
    });
  }
}

//---***========================================***---注入location---***========================================***---
class ProxyLocation {
  constructor(originalLocation) {
      this.originalLocation = originalLocation;
  }

  reload(forcedReload) {
    this.originalLocation.reload(forcedReload);
  }

  replace(url) {
    this.originalLocation.replace(changeURL(url));
  }

  assign(url) {
    this.originalLocation.assign(changeURL(url));
  }

  get href() {
    return original_website_url_str;
  }

  set href(url) {
    this.originalLocation.href = changeURL(url);
  }

  get protocol() {
    return original_website_url.protocol;
  }

  set protocol(value) {
    original_website_url.protocol = value;
    this.originalLocation.href = proxy_host_with_schema + original_website_url.href;
  }

  get host() {
    return original_website_url.host;
  }

  set host(value) {
    original_website_url.host = value;
    this.originalLocation.href = proxy_host_with_schema + original_website_url.href;
  }

  get hostname() {
    return original_website_url.hostname;
  }

  set hostname(value) {
    original_website_url.hostname = value;
    this.originalLocation.href = proxy_host_with_schema + original_website_url.href;
  }

  get port() {
    return original_website_url.port;
  }

  set port(value) {
    original_website_url.port = value;
    this.originalLocation.href = proxy_host_with_schema + original_website_url.href;
  }

  get pathname() {
    return original_website_url.pathname;
  }

  set pathname(value) {
    original_website_url.pathname = value;
    this.originalLocation.href = proxy_host_with_schema + original_website_url.href;
  }

  get search() {
    return original_website_url.search;
  }

  set search(value) {
    original_website_url.search = value;
    this.originalLocation.href = proxy_host_with_schema + original_website_url.href;
  }

  get hash() {
    return original_website_url.hash;
  }

  set hash(value) {
    original_website_url.hash = value;
    this.originalLocation.href = proxy_host_with_schema + original_website_url.href;
  }

  get origin() {
    return original_website_url.origin;
  }

  toString() {
    return this.originalLocation.href;
  }
}

function documentLocationInject(){
  Object.defineProperty(document, 'URL', {
    get: function () {
        return original_website_url_str;
    },
    set: function (url) {
        document.URL = changeURL(url);
    }
  });

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

//---***========================================***---注入历史---***========================================***---
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

//---***========================================***---操作---***========================================***---
networkInject();
elementPropertyInject();
documentLocationInject();
windowLocationInject();
historyInject();

window.addEventListener('load', () => {
  console.log("Proxy injection completed");
});
`;

const htmlCovPathInjectFuncName = "parseAndInsertDoc";
const htmlCovPathInject = `
function ${htmlCovPathInjectFuncName}(htmlString) {
  const parser = new DOMParser();
  const tempDoc = parser.parseFromString(htmlString, 'text/html');
  
  const allElements = tempDoc.querySelectorAll('*');
  allElements.forEach(element => {
    if (element.hasAttribute("href")) {
      const relativePath = element.getAttribute("href");
      try {
        const absolutePath = changeURL(relativePath);
        element.setAttribute("href", absolutePath);
      } catch (e) {}
    }

    if (element.hasAttribute("src")) {
      const relativePath = element.getAttribute("src");
      try {
        const absolutePath = changeURL(relativePath);
        element.setAttribute("src", absolutePath);
      } catch (e) {}
    }
    
    if (element.tagName === "FORM" && element.hasAttribute("action")) {
      const relativePath = element.getAttribute("action");
      try {
        const absolutePath = changeURL(relativePath);
        element.setAttribute("action", absolutePath);
      } catch (e) {}
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
  const userAgent = request.headers.get('User-Agent');
  
  // 过滤爬虫
  if (userAgent && userAgent.includes("Bytespider")) {
    return getHTMLResponse("Bytespider detected");
  }

  // 根路径显示nginx页面
  if (url.pathname === "/" || url.pathname === "") {
    return getHTMLResponse(nginxWelcomePage);
  }

  // 检查是否需要绕过代理
  const requestPath = url.pathname + url.search + url.hash;
  const requestUrl = requestPath.startsWith("/") ? requestPath.substring(1) : requestPath;
  
  // 检查是否是绕过代理的URL
  for (const bypassUrl of BYPASS_URLS) {
    if (requestUrl.includes(bypassUrl)) {
      // 直接访问，不代理
      const directUrl = new URL(requestUrl);
      const directResponse = await fetch(directUrl, {
        headers: request.headers,
        method: request.method,
        body: request.body,
        redirect: "manual"
      });
      return new Response(directResponse.body, directResponse);
    }
  }

  // 构建目标URL
  let targetUrl;
  if (requestUrl.startsWith("http://") || requestUrl.startsWith("https://")) {
    targetUrl = new URL(requestUrl);
  } else {
    // 将路径附加到目标网站
    const targetBase = new URL(TARGET_URL);
    targetUrl = new URL(requestPath, targetBase);
  }

  // 处理客户端发来的 Header
  let clientHeaderWithChange = new Headers();
  request.headers.forEach((value, key) => {
    let newValue = value
      .replaceAll(thisProxyServerUrlHttps + "http", "http")
      .replaceAll(thisProxyServerUrlHttps, `${targetUrl.protocol}//${targetUrl.hostname}/`)
      .replaceAll(thisProxyServerUrlHttps.substring(0, thisProxyServerUrlHttps.length - 1), `${targetUrl.protocol}//${targetUrl.hostname}`)
      .replaceAll(thisProxyServerUrl_hostOnly, targetUrl.host);
    clientHeaderWithChange.set(key, newValue);
  });

  // 处理客户端发来的 Body
  let clientRequestBodyWithChange;
  if (request.body) {
    const [body1, body2] = request.body.tee();
    try {
      const bodyText = await new Response(body1).text();
      if (bodyText.includes(thisProxyServerUrlHttps) || bodyText.includes(thisProxyServerUrl_hostOnly)) {
        clientRequestBodyWithChange = bodyText
          .replaceAll(thisProxyServerUrlHttps, targetUrl.href)
          .replaceAll(thisProxyServerUrl_hostOnly, targetUrl.host);
      } else {
        clientRequestBodyWithChange = body2;
      }
    } catch (e) {
      clientRequestBodyWithChange = body2;
    }
  }

  // 构造代理请求
  const modifiedRequest = new Request(targetUrl, {
    headers: clientHeaderWithChange,
    method: request.method,
    body: request.body ? clientRequestBodyWithChange : request.body,
    redirect: "manual"
  });

  const response = await fetch(modifiedRequest);
  
  // 处理重定向
  if (response.status.toString().startsWith("3") && response.headers.get("Location")) {
    try {
      const redirectUrl = new URL(response.headers.get("Location"), targetUrl.href);
      return Response.redirect(thisProxyServerUrlHttps + redirectUrl.href, 301);
    } catch (e) {
      return getHTMLResponse("Redirect error");
    }
  }

  let modifiedResponse;
  let bd;
  const contentType = response.headers.get("Content-Type");
  let isHTML = false;

  if (response.body) {
    if (contentType && contentType.startsWith("text/")) {
      bd = await response.text();
      isHTML = (contentType && contentType.includes("text/html") && bd.includes("<html"));

      if (contentType && (contentType.includes("html") || contentType.includes("javascript"))) {
        bd = bd.replaceAll("window.location", "window." + replaceUrlObj);
        bd = bd.replaceAll("document.location", "document." + replaceUrlObj);
      }

      if (isHTML) {
        // 移除BOM
        var hasBom = false;
        if (bd.charCodeAt(0) === 0xFEFF) {
          bd = bd.substring(1);
          hasBom = true;
        }

        const inject = `
        <!DOCTYPE html>
        <script>
        (function () {
          ${httpRequestInjection}
          ${htmlCovPathInject}
          
          const originalBodyBase64Encoded = "${new TextEncoder().encode(bd)}";
          const bytes = new Uint8Array(originalBodyBase64Encoded.split(',').map(Number));
          ${htmlCovPathInjectFuncName}(new TextDecoder().decode(bytes));
        })();
        </script>
        `;

        bd = (hasBom ? "\uFEFF" : "") + inject;
      } else {
        // 替换非HTML文本中的链接
        let regex = new RegExp(`(?<!src="|href=")(https?:\\/\\/[^\s'"]+)`, 'g');
        bd = bd.replaceAll(regex, (match) => {
          if (match.startsWith("http")) {
            return thisProxyServerUrlHttps + match;
          } else {
            return thisProxyServerUrl_hostOnly + "/" + match;
          }
        });
      }

      modifiedResponse = new Response(bd, response);
    } else {
      modifiedResponse = new Response(response.body, response);
    }
  } else {
    modifiedResponse = new Response(response.body, response);
  }

  // 处理Cookie Header
  let headers = modifiedResponse.headers;
  let cookieHeaders = [];

  for (let [key, value] of headers.entries()) {
    if (key.toLowerCase() == 'set-cookie') {
      cookieHeaders.push({ headerName: key, headerValue: value });
    }
  }

  if (cookieHeaders.length > 0) {
    cookieHeaders.forEach(cookieHeader => {
      let cookies = cookieHeader.headerValue.split(',').map(cookie => cookie.trim());

      for (let i = 0; i < cookies.length; i++) {
        let parts = cookies[i].split(';').map(part => part.trim());
        
        // 修改Path
        let pathIndex = parts.findIndex(part => part.toLowerCase().startsWith('path='));
        let originalPath;
        if (pathIndex !== -1) {
          originalPath = parts[pathIndex].substring("path=".length);
        }
        let absolutePath = "/" + new URL(originalPath || "/", targetUrl.href).href;

        if (pathIndex !== -1) {
          parts[pathIndex] = `Path=${absolutePath}`;
        } else {
          parts.push(`Path=${absolutePath}`);
        }

        // 修改Domain
        let domainIndex = parts.findIndex(part => part.toLowerCase().startsWith('domain='));
        if (domainIndex !== -1) {
          parts[domainIndex] = `domain=${thisProxyServerUrl_hostOnly}`;
        } else {
          parts.push(`domain=${thisProxyServerUrl_hostOnly}`);
        }

        cookies[i] = parts.join('; ');
      }

      headers.set(cookieHeader.headerName, cookies.join(', '));
    });
  }

  // 设置允许跨域访问
  modifiedResponse.headers.set('Access-Control-Allow-Origin', '*');
  modifiedResponse.headers.set("X-Frame-Options", "ALLOWALL");

  // 删除限制性Header
  const listHeaderDel = ["Content-Security-Policy", "Permissions-Policy", "Cross-Origin-Embedder-Policy", "Cross-Origin-Resource-Policy"];
  listHeaderDel.forEach(element => {
    modifiedResponse.headers.delete(element);
    modifiedResponse.headers.delete(element + "-Report-Only");
  });

  return modifiedResponse;
}

function getHTMLResponse(html) {
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8"
    }
  });
}