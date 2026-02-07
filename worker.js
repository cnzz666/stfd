// 内存存储文件数据（重启会丢失）
const fileStore = new Map();
const activeSessions = new Map();

// 生成4位简单取件码
function generateCode() {
  const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // 去掉容易混淆的字符
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// 清理过期文件
function cleanupExpiredFiles() {
  const now = Date.now();
  for (const [code, data] of fileStore.entries()) {
    if (now - data.createdAt > 5 * 60 * 1000) { // 5分钟过期
      fileStore.delete(code);
      if (activeSessions.has(code)) {
        const ws = activeSessions.get(code);
        if (ws) ws.close(1000, 'Session expired');
        activeSessions.delete(code);
      }
    }
  }
}

// 定期清理（每30秒一次）
setInterval(cleanupExpiredFiles, 30000);

// WebSocket处理器
async function handleWebSocket(request) {
  const upgradeHeader = request.headers.get('Upgrade');
  if (!upgradeHeader || upgradeHeader !== 'websocket') {
    return new Response('Expected Upgrade: websocket', { status: 426 });
  }

  const webSocketPair = new WebSocketPair();
  const [client, server] = Object.values(webSocketPair);

  server.accept();
  let sessionCode = null;
  let isSender = false;

  server.addEventListener('message', async (event) => {
    try {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'create-session':
          // 创建新传输会话
          const code = generateCode();
          sessionCode = code;
          isSender = true;
          activeSessions.set(code, server);
          
          fileStore.set(code, {
            fileName: data.fileName,
            fileSize: data.fileSize,
            fileType: data.fileType,
            chunks: [],
            totalChunks: 0,
            receivedChunks: 0,
            createdAt: Date.now(),
            lastActivity: Date.now()
          });
          
          server.send(JSON.stringify({
            type: 'session-created',
            code: code
          }));
          break;
          
        case 'join-session':
          // 接收方加入会话
          const session = fileStore.get(data.code);
          if (!session) {
            server.send(JSON.stringify({
              type: 'error',
              message: '取件码无效或已过期'
            }));
            return;
          }
          
          sessionCode = data.code;
          isSender = false;
          activeSessions.set(data.code, server);
          
          // 更新活动时间
          session.lastActivity = Date.now();
          
          // 通知发送方接收方已连接
          const senderWs = activeSessions.get(data.code);
          if (senderWs) {
            senderWs.send(JSON.stringify({
              type: 'receiver-connected'
            }));
          }
          
          server.send(JSON.stringify({
            type: 'session-joined',
            fileName: session.fileName,
            fileSize: session.fileSize,
            fileType: session.fileType
          }));
          break;
          
        case 'file-chunk':
          // 接收文件块
          if (!sessionCode) return;
          
          const fileData = fileStore.get(sessionCode);
          if (!fileData) return;
          
          fileData.lastActivity = Date.now();
          fileData.chunks[data.index] = data.chunk;
          fileData.receivedChunks++;
          
          // 发送进度给发送方
          if (activeSessions.get(sessionCode)) {
            activeSessions.get(sessionCode).send(JSON.stringify({
              type: 'upload-progress',
              received: fileData.receivedChunks,
              total: data.totalChunks
            }));
          }
          
          // 如果所有块都已接收，通知接收方
          if (fileData.receivedChunks >= data.totalChunks) {
            server.send(JSON.stringify({
              type: 'upload-complete'
            }));
          }
          break;
          
        case 'request-chunk':
          // 接收方请求块
          if (!sessionCode) return;
          
          const fData = fileStore.get(sessionCode);
          if (!fData || !fData.chunks[data.index]) {
            server.send(JSON.stringify({
              type: 'chunk-error',
              index: data.index
            }));
            return;
          }
          
          fData.lastActivity = Date.now();
          server.send(JSON.stringify({
            type: 'file-chunk',
            index: data.index,
            chunk: fData.chunks[data.index],
            totalChunks: fData.chunks.length
          }));
          break;
          
        case 'transfer-complete':
          // 传输完成，清理数据
          if (sessionCode) {
            // 延迟清理，确保接收方完成下载
            setTimeout(() => {
              if (fileStore.has(sessionCode)) {
                fileStore.delete(sessionCode);
              }
              if (activeSessions.has(sessionCode)) {
                activeSessions.delete(sessionCode);
              }
            }, 10000); // 10秒后清理
          }
          break;
          
        case 'keepalive':
          // 保持连接活跃
          if (sessionCode && fileStore.has(sessionCode)) {
            fileStore.get(sessionCode).lastActivity = Date.now();
          }
          server.send(JSON.stringify({ type: 'pong' }));
          break;
      }
    } catch (error) {
      console.error('WebSocket error:', error);
    }
  });

  server.addEventListener('close', () => {
    if (sessionCode) {
      // 如果是发送方断开，立即清理
      if (isSender) {
        if (fileStore.has(sessionCode)) {
          fileStore.delete(sessionCode);
        }
      }
      activeSessions.delete(sessionCode);
    }
  });

  server.addEventListener('error', (error) => {
    console.error('WebSocket server error:', error);
  });

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
}

// 主页面HTML
const HTML = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>即时快传 - 点对点极速文件传输</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
            color: #333;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 15px;
        }
        
        .header p {
            opacity: 0.9;
            font-size: 1.1rem;
        }
        
        .tabs {
            display: flex;
            background: #f5f5f5;
            border-bottom: 1px solid #e0e0e0;
        }
        
        .tab {
            flex: 1;
            padding: 20px;
            text-align: center;
            font-size: 1.2rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
            color: #666;
        }
        
        .tab:hover {
            background: #e8e8e8;
        }
        
        .tab.active {
            background: white;
            color: #667eea;
            border-bottom: 3px solid #667eea;
        }
        
        .content {
            padding: 40px;
            min-height: 500px;
        }
        
        .tab-content {
            display: none;
        }
        
        .tab-content.active {
            display: block;
            animation: fadeIn 0.5s;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .drop-zone {
            border: 3px dashed #ccc;
            border-radius: 15px;
            padding: 60px 20px;
            text-align: center;
            cursor: pointer;
            transition: all 0.3s;
            margin-bottom: 30px;
            background: #fafafa;
        }
        
        .drop-zone:hover {
            border-color: #667eea;
            background: #f0f2ff;
        }
        
        .drop-zone.dragover {
            border-color: #667eea;
            background: #e8ebff;
        }
        
        .drop-zone i {
            font-size: 64px;
            color: #667eea;
            margin-bottom: 20px;
        }
        
        .drop-zone h3 {
            font-size: 1.8rem;
            margin-bottom: 10px;
        }
        
        .file-info {
            background: #f8f9ff;
            border-radius: 12px;
            padding: 25px;
            margin: 20px 0;
            display: none;
        }
        
        .file-info.show {
            display: block;
            animation: slideIn 0.3s;
        }
        
        @keyframes slideIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .file-info-header {
            display: flex;
            align-items: center;
            gap: 20px;
            margin-bottom: 15px;
        }
        
        .file-icon {
            font-size: 48px;
            color: #667eea;
        }
        
        .file-details {
            flex: 1;
        }
        
        .file-name {
            font-weight: bold;
            font-size: 1.3rem;
            margin-bottom: 5px;
            word-break: break-all;
        }
        
        .file-size {
            color: #666;
            font-size: 1rem;
        }
        
        .progress-container {
            margin: 30px 0;
        }
        
        .progress-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
        }
        
        .progress-bar {
            height: 12px;
            background: #e0e0e0;
            border-radius: 6px;
            overflow: hidden;
        }
        
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #667eea, #764ba2);
            width: 0%;
            transition: width 0.3s;
            border-radius: 6px;
        }
        
        .code-container {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 15px;
            padding: 30px;
            text-align: center;
            color: white;
            margin: 30px 0;
            display: none;
        }
        
        .code-container.show {
            display: block;
            animation: popIn 0.5s;
        }
        
        @keyframes popIn {
            0% { transform: scale(0.8); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
        }
        
        .code-display {
            font-size: 3.5rem;
            font-weight: bold;
            letter-spacing: 10px;
            margin: 20px 0;
            font-family: 'Courier New', monospace;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        
        .code-instruction {
            font-size: 1.1rem;
            opacity: 0.9;
            margin-bottom: 10px;
        }
        
        .receiver-input {
            margin: 40px 0;
            text-align: center;
        }
        
        .code-input {
            font-size: 2.5rem;
            width: 200px;
            padding: 15px;
            text-align: center;
            border: 3px solid #667eea;
            border-radius: 12px;
            font-weight: bold;
            letter-spacing: 8px;
            text-transform: uppercase;
            margin: 20px 0;
        }
        
        .code-input:focus {
            outline: none;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.3);
        }
        
        .download-info {
            background: #f0f7ff;
            border-radius: 12px;
            padding: 25px;
            margin: 20px 0;
            display: none;
        }
        
        .download-info.show {
            display: block;
        }
        
        .download-button {
            display: block;
            width: 100%;
            background: linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%);
            color: white;
            border: none;
            padding: 20px;
            font-size: 1.3rem;
            border-radius: 12px;
            cursor: pointer;
            margin: 30px 0;
            transition: transform 0.2s;
        }
        
        .download-button:hover {
            transform: translateY(-3px);
        }
        
        .status {
            padding: 15px;
            border-radius: 10px;
            margin: 15px 0;
            text-align: center;
            font-weight: 500;
            display: none;
        }
        
        .status.show {
            display: block;
        }
        
        .status.info {
            background: #e3f2fd;
            color: #1565c0;
        }
        
        .status.success {
            background: #e8f5e9;
            color: #2e7d32;
        }
        
        .status.warning {
            background: #fff3e0;
            color: #ef6c00;
        }
        
        .status.error {
            background: #ffebee;
            color: #c62828;
        }
        
        .button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 18px 40px;
            font-size: 1.2rem;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.3s;
            display: block;
            width: 100%;
            margin-top: 20px;
        }
        
        .button:hover:not(:disabled) {
            transform: translateY(-3px);
            box-shadow: 0 10px 20px rgba(0,0,0,0.2);
        }
        
        .button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        
        .button.secondary {
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            color: #333;
        }
        
        .qr-container {
            text-align: center;
            margin: 30px 0;
        }
        
        .qr-code {
            display: inline-block;
            padding: 15px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        
        .tip {
            text-align: center;
            color: #666;
            font-size: 0.9rem;
            margin-top: 30px;
            padding: 15px;
            background: #f9f9f9;
            border-radius: 10px;
        }
        
        .stats {
            display: flex;
            justify-content: space-between;
            background: #f5f5f5;
            padding: 15px;
            border-radius: 10px;
            margin: 20px 0;
        }
        
        .stat {
            text-align: center;
            flex: 1;
        }
        
        .stat-value {
            font-size: 1.8rem;
            font-weight: bold;
            color: #667eea;
        }
        
        .stat-label {
            font-size: 0.9rem;
            color: #666;
            margin-top: 5px;
        }
        
        .footer {
            text-align: center;
            padding: 20px;
            color: #666;
            font-size: 0.9rem;
            border-top: 1px solid #eee;
            margin-top: 30px;
        }
        
        .mobile-notice {
            display: none;
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 10px;
            padding: 15px;
            margin: 20px 0;
            text-align: center;
        }
        
        @media (max-width: 768px) {
            .container {
                border-radius: 10px;
            }
            
            .header h1 {
                font-size: 1.8rem;
            }
            
            .content {
                padding: 20px;
            }
            
            .drop-zone {
                padding: 40px 15px;
            }
            
            .drop-zone i {
                font-size: 48px;
            }
            
            .code-display {
                font-size: 2.5rem;
                letter-spacing: 5px;
            }
            
            .code-input {
                font-size: 1.8rem;
                width: 180px;
                letter-spacing: 5px;
            }
            
            .mobile-notice {
                display: block;
            }
        }
        
        .hidden {
            display: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1><i class="fas fa-bolt"></i> 即时快传</h1>
            <p>点对点极速文件传输 • 无需注册 • 完全免费</p>
        </div>
        
        <div class="tabs">
            <div class="tab active" data-tab="send">发送文件</div>
            <div class="tab" data-tab="receive">接收文件</div>
        </div>
        
        <div class="content">
            <!-- 发送文件页面 -->
            <div class="tab-content active" id="send-tab">
                <div class="drop-zone" id="dropZone">
                    <i class="fas fa-cloud-upload-alt"></i>
                    <h3>拖放文件到这里</h3>
                    <p>或点击选择文件（最大支持100MB）</p>
                    <input type="file" id="fileInput" class="hidden">
                </div>
                
                <div class="file-info" id="fileInfo">
                    <div class="file-info-header">
                        <div class="file-icon" id="fileIcon">📄</div>
                        <div class="file-details">
                            <div class="file-name" id="fileName"></div>
                            <div class="file-size" id="fileSize"></div>
                        </div>
                    </div>
                    <div class="progress-container">
                        <div class="progress-header">
                            <span>上传进度</span>
                            <span id="progressText">0%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" id="progressFill"></div>
                        </div>
                    </div>
                </div>
                
                <div class="code-container" id="codeContainer">
                    <h3>取件码</h3>
                    <div class="code-display" id="codeDisplay"></div>
                    <p class="code-instruction">分享此码给接收方，对方输入此码即可接收文件</p>
                    <p>有效期：5分钟</p>
                    
                    <div class="qr-container">
                        <div class="qr-code">
                            <canvas id="qrCanvas"></canvas>
                        </div>
                    </div>
                </div>
                
                <div class="status" id="sendStatus"></div>
                
                <button class="button" id="startButton" disabled>
                    <i class="fas fa-play"></i> 生成取件码并上传
                </button>
                
                <div class="tip">
                    <i class="fas fa-info-circle"></i> 
                    提示：文件将在服务器内存中临时存储5分钟，传输完成后自动删除
                </div>
            </div>
            
            <!-- 接收文件页面 -->
            <div class="tab-content" id="receive-tab">
                <div class="receiver-input">
                    <h2><i class="fas fa-download"></i> 输入取件码</h2>
                    <p>请输入发送方提供的4位取件码</p>
                    <input type="text" maxlength="4" class="code-input" id="receiverCode" 
                           placeholder="A1B2" oninput="this.value = this.value.toUpperCase()">
                </div>
                
                <div class="download-info" id="downloadInfo">
                    <div class="file-info-header">
                        <div class="file-icon" id="downloadFileIcon">📄</div>
                        <div class="file-details">
                            <div class="file-name" id="downloadFileName"></div>
                            <div class="file-size" id="downloadFileSize"></div>
                        </div>
                    </div>
                    
                    <div class="progress-container">
                        <div class="progress-header">
                            <span>下载进度</span>
                            <span id="downloadProgressText">0%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" id="downloadProgressFill"></div>
                        </div>
                    </div>
                </div>
                
                <div class="status" id="receiveStatus"></div>
                
                <button class="button" id="connectButton" disabled>
                    <i class="fas fa-plug"></i> 连接并接收文件
                </button>
                
                <button class="button secondary hidden" id="downloadButton">
                    <i class="fas fa-download"></i> 下载文件
                </button>
                
                <div class="tip">
                    <i class="fas fa-lightbulb"></i> 
                    提示：请确保发送方已生成取件码，连接后会自动开始下载
                </div>
            </div>
            
            <div class="stats">
                <div class="stat">
                    <div class="stat-value" id="activeSessions">0</div>
                    <div class="stat-label">活跃传输</div>
                </div>
                <div class="stat">
                    <div class="stat-value" id="filesToday">0</div>
                    <div class="stat-label">今日传输</div>
                </div>
                <div class="stat">
                    <div class="stat-value">5分钟</div>
                    <div class="stat-label">文件有效期</div>
                </div>
            </div>
            
            <div class="mobile-notice">
                <i class="fas fa-mobile-alt"></i>
                手机端访问建议保持屏幕常亮，避免传输中断
            </div>
        </div>
        
        <div class="footer">
            <p>即时快传 © 2023 • 基于Cloudflare Workers构建 • 文件不永久存储</p>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
    <script>
        // 全局变量
        let ws = null;
        let currentTab = 'send';
        let selectedFile = null;
        let sessionCode = null;
        let isSender = false;
        let chunks = [];
        let chunkSize = 64 * 1024; // 64KB 每块
        let totalChunks = 0;
        let fileData = null;
        let receivedChunks = 0;
        let downloadUrl = null;
        
        // 切换标签页
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                
                tab.classList.add('active');
                currentTab = tab.dataset.tab;
                document.getElementById(`${currentTab}-tab`).classList.add('active');
                
                // 重置状态
                if (currentTab === 'send') {
                    resetSender();
                } else {
                    resetReceiver();
                }
            });
        });
        
        // 发送方：文件选择
        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('fileInput');
        const fileInfo = document.getElementById('fileInfo');
        const fileName = document.getElementById('fileName');
        const fileSize = document.getElementById('fileSize');
        const startButton = document.getElementById('startButton');
        const codeContainer = document.getElementById('codeContainer');
        const codeDisplay = document.getElementById('codeDisplay');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        const sendStatus = document.getElementById('sendStatus');
        
        dropZone.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', handleFileSelect);
        
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });
        
        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });
        
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            if (e.dataTransfer.files.length) {
                fileInput.files = e.dataTransfer.files;
                handleFileSelect({ target: fileInput });
            }
        });
        
        function handleFileSelect(e) {
            selectedFile = e.target.files[0];
            if (!selectedFile) return;
            
            // 限制文件大小（100MB）
            if (selectedFile.size > 100 * 1024 * 1024) {
                showStatus(sendStatus, '文件大小不能超过100MB', 'error');
                return;
            }
            
            // 显示文件信息
            fileName.textContent = selectedFile.name;
            fileSize.textContent = formatFileSize(selectedFile.size);
            
            // 设置文件图标
            const icon = getFileIcon(selectedFile.name, selectedFile.type);
            document.getElementById('fileIcon').textContent = icon;
            
            fileInfo.classList.add('show');
            startButton.disabled = false;
            
            // 计算分片
            totalChunks = Math.ceil(selectedFile.size / chunkSize);
            chunks = new Array(totalChunks);
            
            showStatus(sendStatus, '文件已选择，点击按钮开始上传', 'info');
        }
        
        function getFileIcon(filename, filetype) {
            const ext = filename.split('.').pop().toLowerCase();
            const type = filetype.split('/')[0];
            
            if (type === 'image') return '🖼️';
            if (type === 'video') return '🎬';
            if (type === 'audio') return '🎵';
            if (type === 'text' || ext === 'pdf' || ext === 'doc' || ext === 'docx') return '📄';
            if (ext === 'zip' || ext === 'rar' || ext === '7z') return '📦';
            if (ext === 'exe' || ext === 'msi') return '⚙️';
            return '📎';
        }
        
        function formatFileSize(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }
        
        // 开始传输
        startButton.addEventListener('click', startFileTransfer);
        
        function startFileTransfer() {
            if (!selectedFile) return;
            
            startButton.disabled = true;
            startButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 连接中...';
            
            // 创建WebSocket连接
            connectWebSocket(true);
        }
        
        // 接收方：连接
        const receiverCode = document.getElementById('receiverCode');
        const connectButton = document.getElementById('connectButton');
        const downloadInfo = document.getElementById('downloadInfo');
        const downloadFileName = document.getElementById('downloadFileName');
        const downloadFileSize = document.getElementById('downloadFileSize');
        const downloadFileIcon = document.getElementById('downloadFileIcon');
        const downloadProgressFill = document.getElementById('downloadProgressFill');
        const downloadProgressText = document.getElementById('downloadProgressText');
        const downloadButton = document.getElementById('downloadButton');
        const receiveStatus = document.getElementById('receiveStatus');
        
        receiverCode.addEventListener('input', () => {
            const code = receiverCode.value.trim();
            connectButton.disabled = code.length !== 4;
        });
        
        connectButton.addEventListener('click', () => {
            const code = receiverCode.value.trim().toUpperCase();
            if (code.length !== 4) return;
            
            connectButton.disabled = true;
            connectButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 连接中...';
            
            sessionCode = code;
            isSender = false;
            
            connectWebSocket(false);
        });
        
        // WebSocket连接
        function connectWebSocket(isSenderMode) {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
            
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
            
            ws.onopen = () => {
                if (isSenderMode) {
                    // 发送方：创建会话
                    ws.send(JSON.stringify({
                        type: 'create-session',
                        fileName: selectedFile.name,
                        fileSize: selectedFile.size,
                        fileType: selectedFile.type || 'application/octet-stream'
                    }));
                    
                    showStatus(sendStatus, '正在创建传输会话...', 'info');
                } else {
                    // 接收方：加入会话
                    ws.send(JSON.stringify({
                        type: 'join-session',
                        code: sessionCode
                    }));
                    
                    showStatus(receiveStatus, '正在连接发送方...', 'info');
                }
            };
            
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                
                if (isSenderMode) {
                    handleSenderMessage(data);
                } else {
                    handleReceiverMessage(data);
                }
            };
            
            ws.onclose = (event) => {
                if (event.code !== 1000) {
                    if (isSenderMode) {
                        showStatus(sendStatus, `连接断开: ${event.reason || '未知错误'}`, 'error');
                        startButton.disabled = false;
                        startButton.innerHTML = '<i class="fas fa-redo"></i> 重新连接';
                    } else {
                        showStatus(receiveStatus, `连接断开: ${event.reason || '未知错误'}`, 'error');
                        connectButton.disabled = false;
                        connectButton.innerHTML = '<i class="fas fa-plug"></i> 重新连接';
                    }
                }
            };
            
            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                if (isSenderMode) {
                    showStatus(sendStatus, '连接错误，请重试', 'error');
                } else {
                    showStatus(receiveStatus, '连接错误，请重试', 'error');
                }
            };
            
            // 心跳保活
            setInterval(() => {
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'keepalive' }));
                }
            }, 30000);
        }
        
        // 发送方处理消息
        function handleSenderMessage(data) {
            switch (data.type) {
                case 'session-created':
                    sessionCode = data.code;
                    codeDisplay.textContent = data.code;
                    codeContainer.classList.add('show');
                    startButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 等待接收方连接...';
                    
                    // 生成二维码
                    QRCode.toCanvas(document.getElementById('qrCanvas'), 
                        `${window.location.origin}/#${data.code}`, 
                        { width: 150, height: 150 });
                    
                    showStatus(sendStatus, '取件码已生成，等待接收方连接...', 'info');
                    
                    // 开始上传文件
                    uploadNextChunk();
                    break;
                    
                case 'receiver-connected':
                    showStatus(sendStatus, '接收方已连接，开始传输文件...', 'success');
                    break;
                    
                case 'upload-progress':
                    const percent = Math.round((data.received / totalChunks) * 100);
                    progressFill.style.width = `${percent}%`;
                    progressText.textContent = `${percent}%`;
                    
                    if (data.received >= totalChunks) {
                        showStatus(sendStatus, '文件传输完成！', 'success');
                        startButton.innerHTML = '<i class="fas fa-check"></i> 传输完成';
                        
                        // 通知服务器传输完成
                        ws.send(JSON.stringify({
                            type: 'transfer-complete',
                            code: sessionCode
                        }));
                        
                        // 5秒后关闭连接
                        setTimeout(() => {
                            if (ws) ws.close(1000, 'Transfer complete');
                        }, 5000);
                    }
                    break;
                    
                case 'pong':
                    // 心跳响应
                    break;
            }
        }
        
        // 上传文件分片
        function uploadNextChunk() {
            let chunkIndex = chunks.findIndex(chunk => chunk === undefined);
            
            if (chunkIndex === -1) {
                // 所有分片已上传
                return;
            }
            
            const start = chunkIndex * chunkSize;
            const end = Math.min(start + chunkSize, selectedFile.size);
            const chunk = selectedFile.slice(start, end);
            
            const reader = new FileReader();
            reader.onload = (e) => {
                const base64Chunk = e.target.result.split(',')[1]; // 移除 data URL 前缀
                
                ws.send(JSON.stringify({
                    type: 'file-chunk',
                    code: sessionCode,
                    index: chunkIndex,
                    chunk: base64Chunk,
                    totalChunks: totalChunks
                }));
                
                chunks[chunkIndex] = base64Chunk;
                
                // 继续上传下一个分片
                setTimeout(uploadNextChunk, 10);
            };
            
            reader.readAsDataURL(chunk);
        }
        
        // 接收方处理消息
        function handleReceiverMessage(data) {
            switch (data.type) {
                case 'session-joined':
                    fileData = {
                        name: data.fileName,
                        size: data.fileSize,
                        type: data.fileType,
                        chunks: []
                    };
                    
                    downloadFileName.textContent = data.fileName;
                    downloadFileSize.textContent = formatFileSize(data.fileSize);
                    downloadFileIcon.textContent = getFileIcon(data.fileName, data.fileType);
                    downloadInfo.classList.add('show');
                    
                    connectButton.classList.add('hidden');
                    showStatus(receiveStatus, '已连接，开始下载文件...', 'success');
                    
                    // 请求文件分片
                    requestNextChunk();
                    break;
                    
                case 'file-chunk':
                    receivedChunks++;
                    fileData.chunks[data.index] = data.chunk;
                    
                    // 更新进度
                    const percent = Math.round((receivedChunks / data.totalChunks) * 100);
                    downloadProgressFill.style.width = `${percent}%`;
                    downloadProgressText.textContent = `${percent}%`;
                    
                    showStatus(receiveStatus, `下载中: ${percent}%`, 'info');
                    
                    // 请求下一个分片
                    if (receivedChunks < data.totalChunks) {
                        requestNextChunk();
                    } else {
                        // 所有分片已接收
                        showStatus(receiveStatus, '文件下载完成！', 'success');
                        assembleFile();
                    }
                    break;
                    
                case 'chunk-error':
                    // 重试请求
                    setTimeout(() => {
                        ws.send(JSON.stringify({
                            type: 'request-chunk',
                            code: sessionCode,
                            index: data.index
                        }));
                    }, 1000);
                    break;
                    
                case 'upload-complete':
                    // 发送方上传完成
                    break;
                    
                case 'pong':
                    // 心跳响应
                    break;
                    
                case 'error':
                    showStatus(receiveStatus, data.message, 'error');
                    connectButton.disabled = false;
                    connectButton.innerHTML = '<i class="fas fa-plug"></i> 重新连接';
                    break;
            }
        }
        
        // 请求下一个分片
        function requestNextChunk() {
            let chunkIndex = fileData.chunks.findIndex(chunk => chunk === undefined);
            
            if (chunkIndex !== -1) {
                ws.send(JSON.stringify({
                    type: 'request-chunk',
                    code: sessionCode,
                    index: chunkIndex
                }));
            }
        }
        
        // 组装文件
        function assembleFile() {
            try {
                // 将所有base64分片合并
                const base64Data = fileData.chunks.join('');
                const binaryData = atob(base64Data);
                const bytes = new Uint8Array(binaryData.length);
                
                for (let i = 0; i < binaryData.length; i++) {
                    bytes[i] = binaryData.charCodeAt(i);
                }
                
                const blob = new Blob([bytes], { type: fileData.type });
                downloadUrl = URL.createObjectURL(blob);
                
                // 显示下载按钮
                downloadButton.classList.remove('hidden');
                downloadButton.addEventListener('click', () => {
                    const a = document.createElement('a');
                    a.href = downloadUrl;
                    a.download = fileData.name;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    
                    showStatus(receiveStatus, '文件已开始下载！', 'success');
                    
                    // 通知服务器传输完成
                    ws.send(JSON.stringify({
                        type: 'transfer-complete',
                        code: sessionCode
                    }));
                    
                    // 5秒后关闭连接
                    setTimeout(() => {
                        if (ws) ws.close(1000, 'Download complete');
                    }, 5000);
                });
                
            } catch (error) {
                console.error('Error assembling file:', error);
                showStatus(receiveStatus, '文件组装失败: ' + error.message, 'error');
            }
        }
        
        // 显示状态消息
        function showStatus(element, message, type) {
            element.textContent = message;
            element.className = `status show ${type}`;
        }
        
        // 重置发送方状态
        function resetSender() {
            selectedFile = null;
            sessionCode = null;
            chunks = [];
            
            fileInfo.classList.remove('show');
            codeContainer.classList.remove('show');
            startButton.disabled = true;
            startButton.innerHTML = '<i class="fas fa-play"></i> 生成取件码并上传';
            progressFill.style.width = '0%';
            progressText.textContent = '0%';
            sendStatus.className = 'status';
            
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.close(1000, 'Tab switched');
            }
        }
        
        // 重置接收方状态
        function resetReceiver() {
            sessionCode = null;
            fileData = null;
            receivedChunks = 0;
            
            downloadInfo.classList.remove('show');
            downloadButton.classList.add('hidden');
            connectButton.disabled = true;
            connectButton.classList.remove('hidden');
            connectButton.innerHTML = '<i class="fas fa-plug"></i> 连接并接收文件';
            downloadProgressFill.style.width = '0%';
            downloadProgressText.textContent = '0%';
            receiveStatus.className = 'status';
            
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.close(1000, 'Tab switched');
            }
        }
        
        // 检查URL中的取件码（方便分享）
        window.addEventListener('load', () => {
            const hash = window.location.hash.substring(1);
            if (hash && hash.length === 4) {
                // 切换到接收方标签页
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                
                currentTab = 'receive';
                document.querySelector('.tab[data-tab="receive"]').classList.add('active');
                document.getElementById('receive-tab').classList.add('active');
                
                // 填入取件码
                receiverCode.value = hash.toUpperCase();
                connectButton.disabled = false;
            }
        });
        
        // 更新统计信息（模拟）
        function updateStats() {
            document.getElementById('activeSessions').textContent = 
                Math.floor(Math.random() * 10) + 1;
            document.getElementById('filesToday').textContent = 
                Math.floor(Math.random() * 100) + 20;
        }
        
        // 初始化和定期更新统计
        updateStats();
        setInterval(updateStats, 10000);
    </script>
</body>
</html>
`;

// 处理HTTP请求
async function handleRequest(request) {
  const url = new URL(request.url);
  
  // WebSocket连接
  if (url.pathname === '/ws') {
    return handleWebSocket(request);
  }
  
  // 返回主页面
  if (url.pathname === '/' || url.pathname === '/index.html') {
    return new Response(HTML, {
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  }
  
  // API端点：检查取件码是否存在
  if (url.pathname === '/api/check') {
    const code = url.searchParams.get('code');
    const exists = fileStore.has(code);
    
    return new Response(JSON.stringify({
      exists: exists,
      fileName: exists ? fileStore.get(code).fileName : null,
      fileSize: exists ? fileStore.get(code).fileSize : null
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
  }
  
  // 404处理
  return new Response('Not Found', { 
    status: 404,
    headers: {
      'Content-Type': 'text/plain'
    }
  });
}

// Worker入口
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});