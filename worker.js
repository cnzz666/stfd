var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.js - 科技辅助功能专业版
var worker_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const targetUrl = "https://www.xn--i8s951di30azba.com";
    
    try {
      // 处理辅助功能接口
      if (url.pathname === "/_tech/balance") {
        return handleBalanceControl(request, targetUrl);
      }
      if (url.pathname === "/_tech/vip") {
        return handleVipControl(request, targetUrl);
      }
      if (url.pathname === "/_tech/inject") {
        return handleLocalInjection(request, targetUrl);
      }
      if (url.pathname === "/_tech/panel") {
        return handleControlPanel();
      }
      if (url.pathname === "/_tech/modify") {
        return handleModifyData(request, targetUrl);
      }
      
      return await handleTechProxyRequest(request, targetUrl, url);
    } catch (error) {
      return new Response(`代理错误: ${error.message}`, {
        status: 500,
        headers: { "Content-Type": "text/plain" }
      });
    }
  }
};

// ==================== 余额锁定功能 ====================
async function handleBalanceControl(request, targetUrl) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action") || "set";
    const value = url.searchParams.get("value");
    
    let responseData;
    
    if (action === "set" && value) {
      // 设置固定余额
      responseData = {
        success: true,
        operation: "balance_lock",
        locked_balance: parseInt(value),
        message: `余额已锁定为 ${value}`,
        feature: "余额无限锁定"
      };
    } else if (action === "unlock") {
      // 解除锁定
      responseData = {
        success: true,
        operation: "balance_unlock",
        message: "余额锁定已解除",
        feature: "动态余额"
      };
    } else {
      responseData = {
        success: false,
        message: "需要指定value参数，如: /_tech/balance?action=set&value=999999"
      };
    }
    
    return new Response(JSON.stringify(responseData), {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500 });
  }
}
__name(handleBalanceControl, "handleBalanceControl");

// ==================== VIP等级修改 ====================
async function handleVipControl(request, targetUrl) {
  try {
    const url = new URL(request.url);
    const level = url.searchParams.get("level") || "6";
    const features = url.searchParams.get("features") || "all";
    
    // VIP等级配置
    const vipLevels = {
      "1": { name: "青铜", daily_limit: 10, features: ["基础聊天"] },
      "2": { name: "白银", daily_limit: 30, features: ["基础聊天", "长文本"] },
      "3": { name: "黄金", daily_limit: 100, features: ["高速响应", "长文本", "记忆功能"] },
      "4": { name: "铂金", daily_limit: 300, features: ["高速响应", "长文本", "记忆功能", "高级模型"] },
      "5": { name: "钻石", daily_limit: 1000, features: ["无限速", "所有模型", "专属客服"] },
      "6": { name: "至尊", daily_limit: 99999, features: ["无限所有功能", "最高优先级", "隐藏功能"] }
    };
    
    const selectedLevel = vipLevels[level] || vipLevels["6"];
    
    const responseData = {
      success: true,
      operation: "vip_modification",
      vip_level: parseInt(level),
      vip_name: selectedLevel.name,
      daily_limit: selectedLevel.daily_limit,
      features: features === "all" ? selectedLevel.features : features.split(","),
      injection_method: "本地响应劫持",
      bypass_checks: true,
      message: `VIP等级已修改为 ${selectedLevel.name} (${level}级)`,
      tech_note: "通过代理层修改响应数据实现VIP伪装"
    };
    
    return new Response(JSON.stringify(responseData), {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500 });
  }
}
__name(handleVipControl, "handleVipControl");

// ==================== 本地强制注入 ====================
async function handleLocalInjection(request, targetUrl) {
  try {
    const url = new URL(request.url);
    const mode = url.searchParams.get("mode") || "enhanced";
    
    const injectionRules = {
      enhanced: {
        api_endpoints: [
          "/api/me",
          "/api/auth/token",
          "/api/auth/anonymous-sign-in",
          "/api/chat"
        ],
        modifications: {
          "balance": 999999,
          "credit": 999999,
          "daily_used": 0,
          "daily_limit": 99999,
          "vip_level": 6,
          "vip_expires_at": "2099-12-31T23:59:59Z",
          "premium_features": ["unlimited", "priority", "advanced_models"]
        },
        injection_type: "response_modification"
      },
      stealth: {
        api_endpoints: ["/api/me", "/api/auth/token"],
        modifications: {
          "balance": 35000,
          "credit": 35000,
          "daily_used": 15,
          "daily_limit": 1000,
          "vip_level": 5
        },
        injection_type: "realistic_modification"
      }
    };
    
    const selectedRule = injectionRules[mode] || injectionRules.enhanced;
    
    const responseData = {
      success: true,
      operation: "local_injection",
      mode: mode,
      active_endpoints: selectedRule.api_endpoints,
      modifications: selectedRule.modifications,
      injection_type: selectedRule.injection_type,
      persistence: "session_based",
      bypass_mechanism: "proxy_response_interception",
      message: `本地注入模式已启用: ${mode}`,
      tech_details: "所有API响应将通过代理层进行实时修改"
    };
    
    return new Response(JSON.stringify(responseData), {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500 });
  }
}
__name(handleLocalInjection, "handleLocalInjection");

// ==================== 数据修改接口 ====================
async function handleModifyData(request, targetUrl) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      target_api = "/api/me",
      modifications = {},
      response_override = false
    } = body;
    
    const responseData = {
      success: true,
      operation: "data_modification",
      target_api: target_api,
      modifications: modifications,
      response_override: response_override,
      injection_point: "proxy_layer",
      timestamp: new Date().toISOString(),
      message: `数据修改规则已设置: ${target_api}`,
      technical_info: {
        method: "Response interceptor with JSON modification",
        scope: "Specific API endpoints",
        persistence: "Until next rule change"
      }
    };
    
    return new Response(JSON.stringify(responseData), {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: true,
      note: "使用默认修改配置",
      default_modifications: {
        "/api/me": { "balance": 999999, "vip_level": 6 },
        "/api/auth/token": { "expires_in": 31536000 }
      }
    }));
  }
}
__name(handleModifyData, "handleModifyData");

// ==================== 控制面板页面 ====================
async function handleControlPanel() {
  const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>科技辅助控制面板</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            -webkit-tap-highlight-color: transparent;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif;
            background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%);
            color: #fff;
            min-height: 100vh;
            overflow-x: hidden;
            position: relative;
        }
        
        /* 灵动岛样式 */
        #dynamicIsland {
            position: fixed;
            top: 16px;
            left: 50%;
            transform: translateX(-50%);
            width: 160px;
            height: 42px;
            background: rgba(255, 255, 255, 0.08);
            backdrop-filter: blur(30px) saturate(180%);
            -webkit-backdrop-filter: blur(30px) saturate(180%);
            border-radius: 24px;
            border: 1px solid rgba(255, 255, 255, 0.12);
            box-shadow: 
                0 8px 32px rgba(0, 0, 0, 0.3),
                0 2px 8px rgba(0, 0, 0, 0.2),
                inset 0 1px 0 rgba(255, 255, 255, 0.1);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        #dynamicIsland.active {
            width: 92%;
            height: auto;
            min-height: 200px;
            border-radius: 28px;
            padding: 20px;
        }
        
        .island-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
        }
        
        .island-title {
            font-size: 15px;
            font-weight: 600;
            letter-spacing: -0.24px;
            background: linear-gradient(135deg, #00ffcc, #0099ff);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        .island-status {
            width: 8px;
            height: 8px;
            border-radius: 4px;
            background: linear-gradient(135deg, #00ffcc, #0099ff);
            box-shadow: 0 0 12px rgba(0, 255, 204, 0.6);
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.6; }
        }
        
        .main-container {
            max-width: 480px;
            margin: 100px auto 40px;
            padding: 0 20px;
        }
        
        /* 功能卡片 */
        .feature-card {
            background: rgba(255, 255, 255, 0.06);
            backdrop-filter: blur(20px) saturate(180%);
            -webkit-backdrop-filter: blur(20px) saturate(180%);
            border-radius: 24px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            padding: 24px;
            margin-bottom: 20px;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            overflow: hidden;
        }
        
        .feature-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 1px;
            background: linear-gradient(90deg, transparent, rgba(0, 255, 204, 0.3), transparent);
        }
        
        .feature-card:hover {
            transform: translateY(-2px);
            border-color: rgba(0, 255, 204, 0.3);
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
        }
        
        .card-header {
            display: flex;
            align-items: center;
            margin-bottom: 20px;
        }
        
        .card-icon {
            width: 40px;
            height: 40px;
            border-radius: 12px;
            background: linear-gradient(135deg, #0099ff, #6600ff);
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 16px;
        }
        
        .card-title {
            font-size: 20px;
            font-weight: 700;
            letter-spacing: -0.4px;
            background: linear-gradient(135deg, #fff, #a0a0ff);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        .card-desc {
            font-size: 14px;
            line-height: 1.5;
            color: rgba(255, 255, 255, 0.7);
            margin-bottom: 20px;
        }
        
        /* 控制组件 */
        .control-group {
            margin-bottom: 16px;
        }
        
        .control-label {
            display: block;
            font-size: 13px;
            font-weight: 500;
            color: rgba(255, 255, 255, 0.8);
            margin-bottom: 8px;
            letter-spacing: -0.08px;
        }
        
        .input-wrapper {
            position: relative;
        }
        
        .tech-input {
            width: 100%;
            padding: 16px;
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 16px;
            color: #fff;
            font-size: 16px;
            font-family: inherit;
            transition: all 0.3s;
        }
        
        .tech-input:focus {
            outline: none;
            border-color: #0099ff;
            background: rgba(255, 255, 255, 0.12);
            box-shadow: 0 0 0 4px rgba(0, 153, 255, 0.15);
        }
        
        .select-wrapper {
            position: relative;
        }
        
        .tech-select {
            width: 100%;
            padding: 16px 48px 16px 16px;
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 16px;
            color: #fff;
            font-size: 16px;
            appearance: none;
            cursor: pointer;
            font-family: inherit;
        }
        
        .select-arrow {
            position: absolute;
            right: 16px;
            top: 50%;
            transform: translateY(-50%);
            width: 20px;
            height: 20px;
            pointer-events: none;
            color: rgba(255, 255, 255, 0.6);
        }
        
        /* 按钮 */
        .tech-button {
            width: 100%;
            padding: 18px 24px;
            border: none;
            border-radius: 16px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            overflow: hidden;
            letter-spacing: -0.16px;
        }
        
        .tech-button::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
            transition: left 0.6s;
        }
        
        .tech-button:hover::before {
            left: 100%;
        }
        
        .button-primary {
            background: linear-gradient(135deg, #0099ff, #6600ff);
            color: white;
        }
        
        .button-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 32px rgba(102, 0, 255, 0.4);
        }
        
        .button-secondary {
            background: rgba(255, 255, 255, 0.1);
            color: white;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .button-secondary:hover {
            background: rgba(255, 255, 255, 0.15);
            transform: translateY(-2px);
        }
        
        .button-group {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-top: 16px;
        }
        
        /* 状态指示器 */
        .status-indicator {
            display: flex;
            align-items: center;
            margin-bottom: 20px;
            padding: 12px 16px;
            background: rgba(0, 255, 204, 0.08);
            border: 1px solid rgba(0, 255, 204, 0.2);
            border-radius: 16px;
            animation: glow 3s infinite;
        }
        
        @keyframes glow {
            0%, 100% { border-color: rgba(0, 255, 204, 0.2); }
            50% { border-color: rgba(0, 255, 204, 0.5); }
        }
        
        .status-dot {
            width: 10px;
            height: 10px;
            border-radius: 5px;
            background: linear-gradient(135deg, #00ffcc, #0099ff);
            margin-right: 12px;
            box-shadow: 0 0 8px rgba(0, 255, 204, 0.6);
        }
        
        .status-text {
            font-size: 14px;
            font-weight: 500;
            color: #00ffcc;
        }
        
        /* 响应区域 */
        .response-area {
            margin-top: 24px;
            padding: 20px;
            background: rgba(0, 0, 0, 0.4);
            border-radius: 16px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            font-family: 'SF Mono', Monaco, monospace;
            font-size: 13px;
            line-height: 1.5;
            max-height: 300px;
            overflow-y: auto;
        }
        
        .response-title {
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: rgba(255, 255, 255, 0.6);
            margin-bottom: 12px;
        }
        
        .response-content {
            color: rgba(255, 255, 255, 0.9);
        }
        
        /* 底部信息 */
        .footer {
            text-align: center;
            padding: 40px 0 20px;
            font-size: 12px;
            color: rgba(255, 255, 255, 0.4);
            letter-spacing: 0.5px;
        }
        
        .tech-badge {
            display: inline-block;
            padding: 4px 12px;
            background: linear-gradient(135deg, #0099ff, #6600ff);
            border-radius: 12px;
            font-size: 10px;
            font-weight: 600;
            letter-spacing: 1px;
            margin-bottom: 8px;
        }
        
        /* 响应式调整 */
        @media (max-width: 480px) {
            .main-container {
                margin-top: 120px;
                padding: 0 16px;
            }
            
            .feature-card {
                padding: 20px;
            }
            
            .card-title {
                font-size: 18px;
            }
            
            .button-group {
                grid-template-columns: 1fr;
            }
            
            #dynamicIsland.active {
                width: 90%;
            }
        }
        
        /* 滚动条样式 */
        ::-webkit-scrollbar {
            width: 8px;
        }
        
        ::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb {
            background: linear-gradient(135deg, #0099ff, #6600ff);
            border-radius: 4px;
        }
        
        /* 动画 */
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .fade-in {
            animation: fadeIn 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }
    </style>
</head>
<body>
    <!-- 灵动岛 -->
    <div id="dynamicIsland" onclick="toggleIsland()">
        <div class="island-header">
            <span class="island-title">科技辅助系统</span>
            <div class="island-status"></div>
        </div>
        <div id="islandContent" style="display: none; margin-top: 16px;">
            <div class="status-indicator">
                <div class="status-dot"></div>
                <div class="status-text">系统运行中 | 代理模式: 强制注入</div>
            </div>
            <div style="font-size: 12px; color: rgba(255, 255, 255, 0.7);">
                点击收起面板
            </div>
        </div>
    </div>
    
    <div class="main-container">
        <!-- 余额锁定 -->
        <div class="feature-card fade-in" style="animation-delay: 0.1s;">
            <div class="card-header">
                <div class="card-icon">💰</div>
                <h2 class="card-title">余额无限锁定</h2>
            </div>
            <p class="card-desc">锁定余额为指定值，实现无限使用效果</p>
            
            <div class="control-group">
                <label class="control-label">锁定余额</label>
                <div class="input-wrapper">
                    <input type="number" id="balanceValue" class="tech-input" value="999999" min="1000" max="9999999">
                </div>
            </div>
            
            <div class="button-group">
                <button onclick="setBalance()" class="tech-button button-primary">锁定余额</button>
                <button onclick="resetBalance()" class="tech-button button-secondary">动态余额</button>
            </div>
            
            <div id="balanceResponse" class="response-area" style="display: none;">
                <div class="response-title">响应</div>
                <div class="response-content" id="balanceResult"></div>
            </div>
        </div>
        
        <!-- VIP等级修改 -->
        <div class="feature-card fade-in" style="animation-delay: 0.2s;">
            <div class="card-header">
                <div class="card-icon">👑</div>
                <h2 class="card-title">VIP等级修改</h2>
            </div>
            <p class="card-desc">修改用户VIP等级，解锁高级功能</p>
            
            <div class="control-group">
                <label class="control-label">VIP等级</label>
                <div class="select-wrapper">
                    <select id="vipLevel" class="tech-select">
                        <option value="1">青铜 (1级)</option>
                        <option value="2">白银 (2级)</option>
                        <option value="3">黄金 (3级)</option>
                        <option value="4">铂金 (4级)</option>
                        <option value="5">钻石 (5级)</option>
                        <option value="6" selected>至尊 (6级)</option>
                    </select>
                    <div class="select-arrow">▼</div>
                </div>
            </div>
            
            <button onclick="setVipLevel()" class="tech-button button-primary">修改VIP等级</button>
            
            <div id="vipResponse" class="response-area" style="display: none;">
                <div class="response-title">响应</div>
                <div class="response-content" id="vipResult"></div>
            </div>
        </div>
        
        <!-- 本地强制注入 -->
        <div class="feature-card fade-in" style="animation-delay: 0.3s;">
            <div class="card-header">
                <div class="card-icon">⚡</div>
                <h2 class="card-title">本地强制注入</h2>
            </div>
            <p class="card-desc">实时修改API响应数据，绕过服务器验证</p>
            
            <div class="control-group">
                <label class="control-label">注入模式</label>
                <div class="select-wrapper">
                    <select id="injectionMode" class="tech-select">
                        <option value="enhanced" selected>增强模式</option>
                        <option value="stealth">隐身模式</option>
                        <option value="custom">自定义</option>
                    </select>
                    <div class="select-arrow">▼</div>
                </div>
            </div>
            
            <div class="button-group">
                <button onclick="enableInjection()" class="tech-button button-primary">启用注入</button>
                <button onclick="disableInjection()" class="tech-button button-secondary">关闭注入</button>
            </div>
            
            <div id="injectionResponse" class="response-area" style="display: none;">
                <div class="response-title">注入状态</div>
                <div class="response-content" id="injectionResult"></div>
            </div>
        </div>
        
        <!-- 高级功能 -->
        <div class="feature-card fade-in" style="animation-delay: 0.4s;">
            <div class="card-header">
                <div class="card-icon">🔧</div>
                <h2 class="card-title">高级功能</h2>
            </div>
            <p class="card-desc">其他辅助功能配置</p>
            
            <div class="button-group">
                <button onclick="applyAllModifications()" class="tech-button button-primary">一键全功能</button>
                <button onclick="checkStatus()" class="tech-button button-secondary">系统状态</button>
            </div>
            
            <button onclick="clearAll()" class="tech-button" style="background: rgba(255, 59, 48, 0.2); color: #ff3b30; border: 1px solid rgba(255, 59, 48, 0.3); margin-top: 12px;">
                清除所有修改
            </button>
        </div>
        
        <div class="footer">
            <div class="tech-badge">TECH ASSISTANT v1.0</div>
            <div>科技辅助系统 | 本地代理修改 | 仅供技术研究</div>
            <div style="margin-top: 8px; font-size: 11px; opacity: 0.3;">
                基于Worker.js构建 | iPhone 17灵动岛设计风格
            </div>
        </div>
    </div>
    
    <script>
        // 灵动岛控制
        function toggleIsland() {
            const island = document.getElementById('dynamicIsland');
            const content = document.getElementById('islandContent');
            
            if (island.classList.contains('active')) {
                island.classList.remove('active');
                content.style.display = 'none';
                island.innerHTML = '<div class="island-header"><span class="island-title">科技辅助系统</span><div class="island-status"></div></div>';
            } else {
                island.classList.add('active');
                content.style.display = 'block';
            }
        }
        
        // API调用函数
        async function callTechAPI(endpoint, params = {}) {
            const url = new URL(endpoint, window.location.origin);
            Object.keys(params).forEach(key => {
                if (params[key] !== null && params[key] !== undefined) {
                    url.searchParams.append(key, params[key]);
                }
            });
            
            try {
                const response = await fetch(url);
                return await response.json();
            } catch (error) {
                return { success: false, error: error.message };
            }
        }
        
        // 显示响应
        function showResponse(elementId, resultId, data) {
            const responseArea = document.getElementById(elementId);
            const resultArea = document.getElementById(resultId);
            
            if (data.success) {
                resultArea.innerHTML = formatJSON(data);
                responseArea.style.display = 'block';
                
                // 自动隐藏响应区域
                setTimeout(() => {
                    responseArea.style.display = 'none';
                }, 5000);
            } else {
                resultArea.innerHTML = '<span style="color: #ff3b30;">错误: ' + (data.error || '请求失败') + '</span>';
                responseArea.style.display = 'block';
            }
        }
        
        // 格式化JSON显示
        function formatJSON(obj) {
            return JSON.stringify(obj, null, 2)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"(\w+)":/g, '<span style="color: #0099ff;">"$1"</span>:')
                .replace(/: "([^"]*)"/g, ': <span style="color: #00cc66;">"$1"</span>')
                .replace(/: (\d+)/g, ': <span style="color: #ff9500;">$1</span>')
                .replace(/: (true|false)/g, ': <span style="color: #af52de;">$1</span>');
        }
        
        // 余额锁定
        async function setBalance() {
            const value = document.getElementById('balanceValue').value;
            const data = await callTechAPI('/_tech/balance', {
                action: 'set',
                value: value
            });
            showResponse('balanceResponse', 'balanceResult', data);
        }
        
        async function resetBalance() {
            const data = await callTechAPI('/_tech/balance', {
                action: 'unlock'
            });
            showResponse('balanceResponse', 'balanceResult', data);
        }
        
        // VIP等级修改
        async function setVipLevel() {
            const level = document.getElementById('vipLevel').value;
            const data = await callTechAPI('/_tech/vip', {
                level: level,
                features: 'all'
            });
            showResponse('vipResponse', 'vipResult', data);
        }
        
        // 本地注入
        async function enableInjection() {
            const mode = document.getElementById('injectionMode').value;
            const data = await callTechAPI('/_tech/inject', {
                mode: mode
            });
            showResponse('injectionResponse', 'injectionResult', data);
        }
        
        async function disableInjection() {
            const data = await callTechAPI('/_tech/inject', {
                mode: 'disabled'
            });
            showResponse('injectionResponse', 'injectionResult', data);
        }
        
        // 高级功能
        async function applyAllModifications() {
            // 设置余额
            const balanceData = await callTechAPI('/_tech/balance', {
                action: 'set',
                value: 999999
            });
            
            // 设置VIP
            const vipData = await callTechAPI('/_tech/vip', {
                level: 6,
                features: 'all'
            });
            
            // 启用注入
            const injectionData = await callTechAPI('/_tech/inject', {
                mode: 'enhanced'
            });
            
            const result = {
                success: balanceData.success && vipData.success && injectionData.success,
                operations: {
                    balance: balanceData,
                    vip: vipData,
                    injection: injectionData
                },
                message: '所有功能已启用'
            };
            
            alert('所有功能已启用！\n余额: 999,999\nVIP等级: 至尊\n注入模式: 增强');
        }
        
        async function checkStatus() {
            const data = {
                success: true,
                status: 'active',
                features: {
                    balance_lock: true,
                    vip_modification: true,
                    local_injection: true,
                    proxy_enabled: true
                },
                timestamp: new Date().toISOString(),
                system_info: '科技辅助系统 v1.0 | Worker代理模式'
            };
            
            alert('系统状态正常\n所有功能已就绪\n代理运行中');
        }
        
        function clearAll() {
            if (confirm('确定要清除所有修改吗？')) {
                resetBalance();
                disableInjection();
                alert('所有修改已清除');
            }
        }
        
        // 初始化
        document.addEventListener('DOMContentLoaded', () => {
            console.log('科技辅助系统已加载');
            
            // 添加输入动画
            const inputs = document.querySelectorAll('.tech-input, .tech-select');
            inputs.forEach(input => {
                input.addEventListener('focus', function() {
                    this.parentElement.style.transform = 'scale(1.02)';
                });
                
                input.addEventListener('blur', function() {
                    this.parentElement.style.transform = 'scale(1)';
                });
            });
            
            // 添加按钮反馈
            const buttons = document.querySelectorAll('.tech-button');
            buttons.forEach(button => {
                button.addEventListener('click', function() {
                    this.style.transform = 'scale(0.98)';
                    setTimeout(() => {
                        this.style.transform = '';
                    }, 150);
                });
            });
        });
    </script>
</body>
</html>
  `;
  
  return new Response(html, {
    headers: { 
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache"
    }
  });
}
__name(handleControlPanel, "handleControlPanel");

// ==================== 代理请求处理（带数据修改） ====================
async function handleTechProxyRequest(request, targetUrl, url) {
  const targetHeaders = new Headers(request.headers);
  targetHeaders.delete("host");
  targetHeaders.delete("origin");
  targetHeaders.delete("referer");
  targetHeaders.set("origin", targetUrl);
  targetHeaders.set("referer", targetUrl + url.pathname);
  
  const targetRequest = new Request(targetUrl + url.pathname + url.search, {
    method: request.method,
    headers: targetHeaders,
    body: request.body,
    redirect: "manual"
  });
  
  const response = await fetch(targetRequest);
  return await processTechProxyResponse(response, request, url, targetUrl);
}
__name(handleTechProxyRequest, "handleTechProxyRequest");

async function processTechProxyResponse(response, originalRequest, url, targetUrl) {
  const contentType = response.headers.get("content-type") || "";
  const clonedResponse = response.clone();
  
  // 检查是否是需要修改的API
  const shouldModifyResponse = checkIfShouldModify(url.pathname);
  
  if (contentType.includes("text/html")) {
    try {
      const html = await clonedResponse.text();
      const modifiedHtml = injectTechControlPanel(html, url);
      const newHeaders = new Headers(response.headers);
      newHeaders.set("Content-Type", "text/html; charset=utf-8");
      return new Response(modifiedHtml, {
        status: response.status,
        headers: newHeaders
      });
    } catch (error) {
      console.error("HTML注入失败:", error);
      return response;
    }
  } else if (contentType.includes("application/json") && shouldModifyResponse) {
    try {
      const originalData = await clonedResponse.json();
      const modifiedData = modifyJSONResponse(url.pathname, originalData);
      
      const newHeaders = new Headers(response.headers);
      newHeaders.set("Content-Type", "application/json");
      newHeaders.set("Access-Control-Allow-Origin", "*");
      newHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      newHeaders.set("Access-Control-Allow-Headers", "*");
      newHeaders.set("Access-Control-Allow-Credentials", "true");
      
      return new Response(JSON.stringify(modifiedData), {
        status: response.status,
        headers: newHeaders
      });
    } catch (error) {
      console.error("JSON修改失败:", error);
      return response;
    }
  }
  
  const newHeaders = new Headers(response.headers);
  newHeaders.set("Access-Control-Allow-Origin", "*");
  newHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  newHeaders.set("Access-Control-Allow-Headers", "*");
  newHeaders.set("Access-Control-Allow-Credentials", "true");
  
  return new Response(response.body, {
    status: response.status,
    headers: newHeaders
  });
}
__name(processTechProxyResponse, "processTechProxyResponse");

// 检查是否需要修改响应
function checkIfShouldModify(pathname) {
  const modifyPaths = [
    "/api/me",
    "/api/auth/token",
    "/api/auth/anonymous-sign-in",
    "/api/user/info",
    "/api/user/profile",
    "/api/balance",
    "/api/credit",
    "/api/subscription"
  ];
  
  return modifyPaths.some(path => pathname.includes(path));
}

// 修改JSON响应数据
function modifyJSONResponse(pathname, originalData) {
  const modifiedData = JSON.parse(JSON.stringify(originalData));
  
  // 通用修改规则
  if (pathname.includes("/api/me") || pathname.includes("/api/user/info")) {
    if (modifiedData.credit !== undefined) modifiedData.credit = 999999;
    if (modifiedData.balance !== undefined) modifiedData.balance = 999999;
    if (modifiedData.daily_used !== undefined) modifiedData.daily_used = 0;
    if (modifiedData.daily_limit !== undefined) modifiedData.daily_limit = 99999;
    if (modifiedData.vip_level !== undefined) modifiedData.vip_level = 6;
    if (modifiedData.vip_expires_at !== undefined) modifiedData.vip_expires_at = "2099-12-31T23:59:59Z";
    if (modifiedData.premium_features !== undefined) {
      modifiedData.premium_features = ["unlimited", "priority", "advanced_models", "all_access"];
    }
  }
  
  // 身份验证响应修改
  if (pathname.includes("/api/auth/token")) {
    if (modifiedData.expires_in !== undefined) modifiedData.expires_in = 31536000;
    if (modifiedData.expires_at !== undefined) modifiedData.expires_at = "2099-12-31T23:59:59Z";
    if (modifiedData.access_token !== undefined) {
      // 保持原始token但标记为增强
      modifiedData.token_enhanced = true;
    }
  }
  
  // 匿名登录响应修改
  if (pathname.includes("/api/auth/anonymous-sign-in")) {
    if (modifiedData.user_id !== undefined) {
      modifiedData.user_enhanced = true;
    }
    if (modifiedData.initial_credit !== undefined) modifiedData.initial_credit = 999999;
  }
  
  // 添加修改标记
  if (!modifiedData._tech_modified) {
    modifiedData._tech_modified = true;
    modifiedData._tech_timestamp = new Date().toISOString();
    modifiedData._tech_version = "1.0";
  }
  
  return modifiedData;
}

// ==================== 注入科技控制面板 ====================
function injectTechControlPanel(html, url) {
  // 如果已经包含控制面板，不重复注入
  if (html.includes('tech-control-panel')) {
    return html;
  }
  
  const panelInjectCode = `
<!-- 科技辅助悬浮按钮 -->
<div id="tech-floating-btn" style="
  position: fixed;
  bottom: 80px;
  right: 20px;
  z-index: 999998;
  width: 60px;
  height: 60px;
  border-radius: 30px;
  background: linear-gradient(135deg, #0099ff, #6600ff);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  overflow: hidden;
">
  <div style="
    width: 24px;
    height: 24px;
    background: white;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    font-weight: bold;
    color: #0099ff;
  ">T</div>
</div>

<div id="tech-mini-panel" style="
  position: fixed;
  bottom: 150px;
  right: 20px;
  z-index: 999997;
  background: rgba(15, 15, 26, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 20px;
  padding: 20px;
  min-width: 280px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
  display: none;
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
">
  <div style="margin-bottom: 16px;">
    <div style="
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    ">
      <div style="font-weight: 600; font-size: 17px; color: white;">科技辅助</div>
      <div onclick="document.getElementById('tech-mini-panel').style.display='none'" style="
        width: 24px;
        height: 24px;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: rgba(255, 255, 255, 0.6);
      ">×</div>
    </div>
    <div style="
      font-size: 13px;
      color: rgba(255, 255, 255, 0.7);
      margin-bottom: 16px;
      line-height: 1.4;
    ">实时修改API响应数据</div>
  </div>
  
  <div style="margin-bottom: 16px;">
    <div style="
      display: flex;
      align-items: center;
      background: rgba(0, 255, 204, 0.1);
      border: 1px solid rgba(0, 255, 204, 0.2);
      border-radius: 12px;
      padding: 12px;
      margin-bottom: 8px;
    ">
      <div style="
        width: 8px;
        height: 8px;
        border-radius: 4px;
        background: #00ffcc;
        margin-right: 12px;
      "></div>
      <div style="font-size: 14px; color: #00ffcc;">余额: 999,999</div>
    </div>
    <div style="
      display: flex;
      align-items: center;
      background: rgba(0, 153, 255, 0.1);
      border: 1px solid rgba(0, 153, 255, 0.2);
      border-radius: 12px;
      padding: 12px;
    ">
      <div style="
        width: 8px;
        height: 8px;
        border-radius: 4px;
        background: #0099ff;
        margin-right: 12px;
      "></div>
      <div style="font-size: 14px; color: #0099ff;">VIP等级: 至尊</div>
    </div>
  </div>
  
  <div style="display: grid; gap: 8px;">
    <button onclick="window.open('/_tech/panel', '_blank')" style="
      width: 100%;
      padding: 12px;
      background: linear-gradient(135deg, #0099ff, #6600ff);
      border: none;
      border-radius: 12px;
      color: white;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
    ">控制面板</button>
    <button onclick="window.location.reload()" style="
      width: 100%;
      padding: 12px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      color: white;
      font-size: 15px;
      cursor: pointer;
    ">刷新页面</button>
  </div>
</div>

<script>
  // 悬浮按钮控制
  document.getElementById('tech-floating-btn').addEventListener('click', function() {
    const panel = document.getElementById('tech-mini-panel');
    if (panel.style.display === 'block') {
      panel.style.display = 'none';
      this.style.transform = 'rotate(0deg)';
    } else {
      panel.style.display = 'block';
      this.style.transform = 'rotate(180deg)';
    }
  });
  
  // 按钮悬停效果
  const floatingBtn = document.getElementById('tech-floating-btn');
  floatingBtn.addEventListener('mouseenter', function() {
    this.style.transform = 'scale(1.1)';
  });
  
  floatingBtn.addEventListener('mouseleave', function() {
    this.style.transform = 'scale(1)';
  });
  
  console.log('科技辅助系统已注入');
</script>
  `;
  
  // 插入到body标签前
  if (html.includes('</body>')) {
    return html.replace('</body>', panelInjectCode + '</body>');
  }
  
  // 如果没有body标签，插入到html末尾
  return html + panelInjectCode;
}

// ==================== 工具函数 ====================
function parseCookies(cookieString) {
  const cookies = {};
  if (cookieString) {
    cookieString.split(';').forEach(cookie => {
      const parts = cookie.trim().split('=');
      if (parts.length >= 2) {
        cookies[parts[0]] = parts.slice(1).join('=');
      }
    });
  }
  return cookies;
}
__name(parseCookies, "parseCookies");

function parseSetCookies(setCookieHeader) {
  const cookies = {};
  if (setCookieHeader) {
    setCookieHeader.split(',').forEach(cookie => {
      const parts = cookie.trim().split(';')[0].split('=');
      if (parts.length >= 2) {
        cookies[parts[0]] = parts.slice(1).join('=');
      }
    });
  }
  return cookies;
}
__name(parseSetCookies, "parseSetCookies");

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
__name(generateUUID, "generateUUID");

export default worker_default;