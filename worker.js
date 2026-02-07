// 存储活跃的连接信息（内存中，Worker重启会丢失）
const activeConnections = new Map();
const connectionTimeouts = new Map();

// 生成6位取件码
function generatePickupCode() {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

// 清理过期的连接
function cleanupConnection(code) {
  if (activeConnections.has(code)) {
    const conn = activeConnections.get(code);
    if (conn.peerConnection) conn.peerConnection.close();
    activeConnections.delete(code);
  }
  if (connectionTimeouts.has(code)) {
    clearTimeout(connectionTimeouts.get(code));
    connectionTimeouts.delete(code);
  }
}

// WebSocket 信令服务器
async function handleWebSocket(request, url) {
  const upgradeHeader = request.headers.get('Upgrade');
  if (!upgradeHeader || upgradeHeader !== 'websocket') {
    return new Response('Expected Upgrade: websocket', { status: 426 });
  }

  const webSocketPair = new WebSocketPair();
  const [client, server] = Object.values(webSocketPair);

  server.accept();
  
  server.addEventListener('message', async (event) => {
    try {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'create-offer':
          // 创建新的取件码
          const code = generatePickupCode();
          activeConnections.set(code, {
            sender: server,
            receiver: null,
            offer: data.offer,
            iceCandidates: [],
            createdAt: Date.now()
          });
          
          // 30分钟后自动清理
          connectionTimeouts.set(code, setTimeout(() => {
            cleanupConnection(code);
          }, 30 * 60 * 1000));
          
          server.send(JSON.stringify({
            type: 'pickup-code',
            code: code
          }));
          break;
          
        case 'join-receiver':
          // 接收方加入
          const conn = activeConnections.get(data.code);
          if (!conn) {
            server.send(JSON.stringify({
              type: 'error',
              message: '取件码无效或已过期'
            }));
            return;
          }
          
          conn.receiver = server;
          conn.receiverId = data.clientId;
          
          // 发送offer给接收方
          server.send(JSON.stringify({
            type: 'offer',
            offer: conn.offer,
            senderId: conn.senderId
          }));
          break;
          
        case 'ice-candidate':
          // 转发ICE候选
          const targetConn = activeConnections.get(data.code);
          if (targetConn) {
            const target = data.from === 'sender' ? targetConn.receiver : targetConn.sender;
            if (target) {
              target.send(JSON.stringify({
                type: 'ice-candidate',
                candidate: data.candidate,
                from: data.from
              }));
            }
          }
          break;
          
        case 'answer':
          // 转发answer
          const answerConn = activeConnections.get(data.code);
          if (answerConn && answerConn.sender) {
            answerConn.sender.send(JSON.stringify({
              type: 'answer',
              answer: data.answer,
              receiverId: data.clientId
            }));
          }
          break;
          
        case 'transfer-complete':
          // 传输完成，清理连接
          cleanupConnection(data.code);
          break;
      }
    } catch (error) {
      console.error('WebSocket error:', error);
    }
  });

  server.addEventListener('close', () => {
    // 清理相关连接
    for (const [code, conn] of activeConnections.entries()) {
      if (conn.sender === server || conn.receiver === server) {
        cleanupConnection(code);
        break;
      }
    }
  });

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
}

// 处理HTTP请求
async function handleRequest(request) {
  const url = new URL(request.url);
  
  // WebSocket 连接
  if (url.pathname === '/ws') {
    return handleWebSocket(request, url);
  }
  
  // 返回前端页面
  if (url.pathname === '/' || url.pathname === '/sender' || url.pathname === '/receiver') {
    return serveHTML(request);
  }
  
  // API端点
  if (url.pathname === '/api/check-code') {
    const code = url.searchParams.get('code');
    const exists = activeConnections.has(code);
    return new Response(JSON.stringify({ exists }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return new Response('Not Found', { status: 404 });
}

// 服务HTML页面
async function serveHTML(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  
  let html = '';
  if (path === '/' || path === '/sender') {
    html = getSenderHTML();
  } else if (path === '/receiver') {
    html = getReceiverHTML();
  }
  
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
      'Cache-Control': 'no-cache'
    }
  });
}

// 发送方HTML页面
function getSenderHTML() {
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>即时快传 - 发送文件</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            width: 100%;
            max-width: 500px;
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            font-size: 28px;
            margin-bottom: 10px;
        }
        .header p {
            opacity: 0.9;
            font-size: 14px;
        }
        .content {
            padding: 30px;
        }
        .drop-zone {
            border: 3px dashed #e0e0e0;
            border-radius: 15px;
            padding: 50px 20px;
            text-align: center;
            cursor: pointer;
            transition: all 0.3s;
            margin-bottom: 20px;
        }
        .drop-zone:hover {
            border-color: #667eea;
            background: #f8f9ff;
        }
        .drop-zone.dragover {
            border-color: #667eea;
            background: #f0f2ff;
        }
        .drop-zone i {
            font-size: 48px;
            color: #667eea;
            margin-bottom: 15px;
        }
        .file-info {
            background: #f8f9fa;
            border-radius: 10px;
            padding: 15px;
            margin: 20px 0;
            display: none;
        }
        .file-info.show {
            display: block;
        }
        .progress-container {
            background: #e0e0e0;
            border-radius: 10px;
            height: 10px;
            margin: 20px 0;
            overflow: hidden;
            display: none;
        }
        .progress-container.show {
            display: block;
        }
        .progress-bar {
            background: linear-gradient(90deg, #667eea, #764ba2);
            height: 100%;
            width: 0%;
            transition: width 0.3s;
        }
        .pickup-code {
            background: #f8f9fa;
            border-radius: 10px;
            padding: 25px;
            text-align: center;
            margin: 20px 0;
            display: none;
        }
        .pickup-code.show {
            display: block;
        }
        .code-display {
            font-size: 36px;
            font-weight: bold;
            letter-spacing: 5px;
            color: #667eea;
            margin: 15px 0;
        }
        .status {
            text-align: center;
            padding: 15px;
            border-radius: 10px;
            margin: 10px 0;
            display: none;
        }
        .status.show {
            display: block;
        }
        .status.connecting {
            background: #fff3cd;
            color: #856404;
        }
        .status.connected {
            background: #d4edda;
            color: #155724;
        }
        .status.error {
            background: #f8d7da;
            color: #721c24;
        }
        button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 10px;
            font-size: 16px;
            cursor: pointer;
            width: 100%;
            transition: transform 0.2s;
        }
        button:hover {
            transform: translateY(-2px);
        }
        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📤 即时快传</h1>
            <p>点对点极速文件传输</p>
        </div>
        
        <div class="content">
            <div class="drop-zone" id="dropZone">
                <div>📁</div>
                <h3>拖放文件到这里</h3>
                <p>或点击选择文件</p>
                <input type="file" id="fileInput" style="display: none;">
            </div>
            
            <div class="file-info" id="fileInfo">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="font-size: 40px;">📄</div>
                    <div style="flex: 1;">
                        <div style="font-weight: bold;" id="fileName"></div>
                        <div style="color: #666; font-size: 14px;" id="fileSize"></div>
                    </div>
                </div>
            </div>
            
            <div class="progress-container" id="progressContainer">
                <div class="progress-bar" id="progressBar"></div>
            </div>
            
            <div class="pickup-code" id="pickupCode">
                <h3>取件码</h3>
                <div class="code-display" id="codeDisplay"></div>
                <p>将此码分享给接收方，对方输入此码即可接收文件</p>
                <p style="color: #666; font-size: 12px; margin-top: 10px;">有效期30分钟</p>
            </div>
            
            <div class="status" id="status"></div>
            
            <button id="sendButton" disabled>生成取件码并等待接收方</button>
        </div>
    </div>

    <script>
        let peerConnection = null;
        let dataChannel = null;
        let ws = null;
        let pickupCode = '';
        let selectedFile = null;
        const CHUNK_SIZE = 16 * 1024; // 16KB chunks

        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('fileInput');
        const fileInfo = document.getElementById('fileInfo');
        const fileName = document.getElementById('fileName');
        const fileSize = document.getElementById('fileSize');
        const progressContainer = document.getElementById('progressContainer');
        const progressBar = document.getElementById('progressBar');
        const pickupCodeDiv = document.getElementById('pickupCode');
        const codeDisplay = document.getElementById('codeDisplay');
        const statusDiv = document.getElementById('status');
        const sendButton = document.getElementById('sendButton');

        // 文件选择处理
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
            
            fileName.textContent = selectedFile.name;
            fileSize.textContent = formatFileSize(selectedFile.size);
            fileInfo.classList.add('show');
            sendButton.disabled = false;
        }

        function formatFileSize(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }

        sendButton.addEventListener('click', startFileTransfer);

        async function startFileTransfer() {
            if (!selectedFile) return;
            
            sendButton.disabled = true;
            sendButton.textContent = '正在创建连接...';
            statusDiv.textContent = '正在创建P2P连接...';
            statusDiv.className = 'status show connecting';
            
            try {
                // 创建WebSocket连接
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                ws = new WebSocket(\`\${protocol}//\${window.location.host}/ws\`);
                
                ws.onopen = () => {
                    // 创建RTCPeerConnection
                    const config = {
                        iceServers: [
                            { urls: 'stun:stun.l.google.com:19302' },
                            { urls: 'stun:global.stun.twilio.com:3478' }
                        ]
                    };
                    
                    peerConnection = new RTCPeerConnection(config);
                    
                    // 创建数据通道
                    dataChannel = peerConnection.createDataChannel('fileTransfer');
                    setupDataChannel();
                    
                    // 收集ICE候选
                    peerConnection.onicecandidate = (event) => {
                        if (event.candidate && ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({
                                type: 'ice-candidate',
                                candidate: event.candidate,
                                from: 'sender',
                                code: pickupCode
                            }));
                        }
                    };
                    
                    // 创建offer
                    peerConnection.createOffer()
                        .then(offer => peerConnection.setLocalDescription(offer))
                        .then(() => {
                            ws.send(JSON.stringify({
                                type: 'create-offer',
                                offer: peerConnection.localDescription
                            }));
                        });
                };
                
                ws.onmessage = async (event) => {
                    const data = JSON.parse(event.data);
                    
                    switch (data.type) {
                        case 'pickup-code':
                            pickupCode = data.code;
                            codeDisplay.textContent = pickupCode;
                            pickupCodeDiv.classList.add('show');
                            sendButton.textContent = '等待接收方连接...';
                            statusDiv.textContent = '等待接收方连接中...';
                            break;
                            
                        case 'answer':
                            await peerConnection.setRemoteDescription(
                                new RTCSessionDescription(data.answer)
                            );
                            statusDiv.textContent = '接收方已连接，准备发送文件...';
                            statusDiv.className = 'status show connected';
                            break;
                            
                        case 'ice-candidate':
                            if (data.from === 'receiver' && data.candidate) {
                                await peerConnection.addIceCandidate(
                                    new RTCIceCandidate(data.candidate)
                                );
                            }
                            break;
                    }
                };
                
                ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    statusDiv.textContent = '连接错误，请重试';
                    statusDiv.className = 'status show error';
                    sendButton.disabled = false;
                    sendButton.textContent = '重新尝试';
                };
                
            } catch (error) {
                console.error('Error:', error);
                statusDiv.textContent = '创建连接失败: ' + error.message;
                statusDiv.className = 'status show error';
                sendButton.disabled = false;
                sendButton.textContent = '重新尝试';
            }
        }

        function setupDataChannel() {
            dataChannel.binaryType = 'arraybuffer';
            
            dataChannel.onopen = () => {
                progressContainer.classList.add('show');
                statusDiv.textContent = '连接已建立，开始传输文件...';
                
                // 发送文件信息
                dataChannel.send(JSON.stringify({
                    type: 'file-info',
                    name: selectedFile.name,
                    size: selectedFile.size,
                    type: selectedFile.type
                }));
                
                // 分片发送文件
                sendFileInChunks();
            };
            
            dataChannel.onclose = () => {
                statusDiv.textContent = '传输完成！';
                if (ws) {
                    ws.send(JSON.stringify({
                        type: 'transfer-complete',
                        code: pickupCode
                    }));
                    ws.close();
                }
            };
            
            dataChannel.onerror = (error) => {
                console.error('DataChannel error:', error);
                statusDiv.textContent = '传输错误: ' + error.message;
                statusDiv.className = 'status show error';
            };
        }

        function sendFileInChunks() {
            const reader = new FileReader();
            let offset = 0;
            
            reader.onload = (e) => {
                if (dataChannel.readyState === 'open') {
                    dataChannel.send(e.target.result);
                    offset += e.target.result.byteLength;
                    
                    // 更新进度条
                    const percent = (offset / selectedFile.size * 100).toFixed(1);
                    progressBar.style.width = percent + '%';
                    
                    if (offset < selectedFile.size) {
                        readNextChunk();
                    } else {
                        dataChannel.close();
                    }
                }
            };
            
            function readNextChunk() {
                const slice = selectedFile.slice(offset, offset + CHUNK_SIZE);
                reader.readAsArrayBuffer(slice);
            }
            
            readNextChunk();
        }
    </script>
</body>
</html>
  `;
}

// 接收方HTML页面
function getReceiverHTML() {
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>即时快传 - 接收文件</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            width: 100%;
            max-width: 500px;
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            font-size: 28px;
            margin-bottom: 10px;
        }
        .header p {
            opacity: 0.9;
            font-size: 14px;
        }
        .content {
            padding: 30px;
        }
        .input-group {
            margin-bottom: 25px;
        }
        .input-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
            color: #333;
        }
        .input-group input {
            width: 100%;
            padding: 15px;
            border: 2px solid #e0e0e0;
            border-radius: 10px;
            font-size: 18px;
            text-align: center;
            letter-spacing: 3px;
            transition: border-color 0.3s;
        }
        .input-group input:focus {
            outline: none;
            border-color: #4facfe;
        }
        .file-info {
            background: #f8f9fa;
            border-radius: 10px;
            padding: 20px;
            margin: 20px 0;
            display: none;
        }
        .file-info.show {
            display: block;
        }
        .file-info-header {
            display: flex;
            align-items: center;
            gap: 15px;
            margin-bottom: 15px;
        }
        .file-icon {
            font-size: 40px;
        }
        .file-details {
            flex: 1;
        }
        .file-name {
            font-weight: bold;
            font-size: 16px;
            margin-bottom: 5px;
        }
        .file-size {
            color: #666;
            font-size: 14px;
        }
        .progress-container {
            background: #e0e0e0;
            border-radius: 10px;
            height: 10px;
            margin: 20px 0;
            overflow: hidden;
            display: none;
        }
        .progress-container.show {
            display: block;
        }
        .progress-bar {
            background: linear-gradient(90deg, #4facfe, #00f2fe);
            height: 100%;
            width: 0%;
            transition: width 0.3s;
        }
        .status {
            text-align: center;
            padding: 15px;
            border-radius: 10px;
            margin: 10px 0;
            display: none;
        }
        .status.show {
            display: block;
        }
        .status.connecting {
            background: #fff3cd;
            color: #856404;
        }
        .status.connected {
            background: #d4edda;
            color: #155724;
        }
        .status.downloading {
            background: #cce5ff;
            color: #004085;
        }
        .status.error {
            background: #f8d7da;
            color: #721c24;
        }
        .status.success {
            background: #d4edda;
            color: #155724;
        }
        button {
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 10px;
            font-size: 16px;
            cursor: pointer;
            width: 100%;
            transition: transform 0.2s;
        }
        button:hover {
            transform: translateY(-2px);
        }
        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
        }
        .download-link {
            display: none;
            text-align: center;
            margin-top: 20px;
        }
        .download-link.show {
            display: block;
        }
        .download-link a {
            background: #28a745;
            color: white;
            padding: 15px 30px;
            border-radius: 10px;
            text-decoration: none;
            display: inline-block;
            transition: transform 0.2s;
        }
        .download-link a:hover {
            transform: translateY(-2px);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📥 即时快传</h1>
            <p>输入取件码接收文件</p>
        </div>
        
        <div class="content">
            <div class="input-group">
                <label for="pickupCode">请输入6位取件码</label>
                <input 
                    type="text" 
                    id="pickupCode" 
                    maxlength="6" 
                    placeholder="例如: A1B2C3"
                    oninput="this.value = this.value.toUpperCase()"
                >
            </div>
            
            <div class="file-info" id="fileInfo">
                <div class="file-info-header">
                    <div class="file-icon">📄</div>
                    <div class="file-details">
                        <div class="file-name" id="fileName"></div>
                        <div class="file-size" id="fileSize"></div>
                    </div>
                </div>
                <div id="fileType"></div>
            </div>
            
            <div class="progress-container" id="progressContainer">
                <div class="progress-bar" id="progressBar"></div>
            </div>
            
            <div class="status" id="status"></div>
            
            <button id="connectButton" disabled>连接发送方</button>
            
            <div class="download-link" id="downloadLink">
                <a id="downloadAnchor" download>📥 下载文件</a>
            </div>
        </div>
    </div>

    <script>
        let peerConnection = null;
        let ws = null;
        let dataChannel = null;
        let receivedChunks = [];
        let fileInfo = null;
        let totalSize = 0;
        let receivedSize = 0;

        const pickupCodeInput = document.getElementById('pickupCode');
        const connectButton = document.getElementById('connectButton');
        const fileInfoDiv = document.getElementById('fileInfo');
        const fileName = document.getElementById('fileName');
        const fileSize = document.getElementById('fileSize');
        const progressContainer = document.getElementById('progressContainer');
        const progressBar = document.getElementById('progressBar');
        const statusDiv = document.getElementById('status');
        const downloadLink = document.getElementById('downloadLink');
        const downloadAnchor = document.getElementById('downloadAnchor');

        // 检查取件码输入
        pickupCodeInput.addEventListener('input', () => {
            const code = pickupCodeInput.value.trim();
            connectButton.disabled = code.length !== 6;
        });

        connectButton.addEventListener('click', connectToSender);

        async function connectToSender() {
            const code = pickupCodeInput.value.trim().toUpperCase();
            if (code.length !== 6) return;
            
            connectButton.disabled = true;
            connectButton.textContent = '连接中...';
            statusDiv.textContent = '正在连接发送方...';
            statusDiv.className = 'status show connecting';
            
            try {
                // 创建WebSocket连接
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                ws = new WebSocket(\`\${protocol}//\${window.location.host}/ws\`);
                
                ws.onopen = () => {
                    // 发送加入请求
                    ws.send(JSON.stringify({
                        type: 'join-receiver',
                        code: code,
                        clientId: 'receiver-' + Date.now()
                    }));
                    
                    // 创建RTCPeerConnection
                    const config = {
                        iceServers: [
                            { urls: 'stun:stun.l.google.com:19302' },
                            { urls: 'stun:global.stun.twilio.com:3478' }
                        ]
                    };
                    
                    peerConnection = new RTCPeerConnection(config);
                    
                    // 设置数据通道回调
                    peerConnection.ondatachannel = (event) => {
                        dataChannel = event.channel;
                        setupDataChannel();
                    };
                    
                    // 收集ICE候选
                    peerConnection.onicecandidate = (event) => {
                        if (event.candidate && ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({
                                type: 'ice-candidate',
                                candidate: event.candidate,
                                from: 'receiver',
                                code: code
                            }));
                        }
                    };
                };
                
                ws.onmessage = async (event) => {
                    const data = JSON.parse(event.data);
                    
                    switch (data.type) {
                        case 'offer':
                            await peerConnection.setRemoteDescription(
                                new RTCSessionDescription(data.offer)
                            );
                            
                            // 创建answer
                            const answer = await peerConnection.createAnswer();
                            await peerConnection.setLocalDescription(answer);
                            
                            ws.send(JSON.stringify({
                                type: 'answer',
                                answer: answer,
                                code: code,
                                clientId: 'receiver-' + Date.now()
                            }));
                            
                            statusDiv.textContent = '已连接，等待文件信息...';
                            statusDiv.className = 'status show connected';
                            break;
                            
                        case 'ice-candidate':
                            if (data.from === 'sender' && data.candidate) {
                                await peerConnection.addIceCandidate(
                                    new RTCIceCandidate(data.candidate)
                                );
                            }
                            break;
                            
                        case 'error':
                            statusDiv.textContent = data.message;
                            statusDiv.className = 'status show error';
                            connectButton.disabled = false;
                            connectButton.textContent = '重新连接';
                            break;
                    }
                };
                
                ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    statusDiv.textContent = '连接错误，请重试';
                    statusDiv.className = 'status show error';
                    connectButton.disabled = false;
                    connectButton.textContent = '重新连接';
                };
                
            } catch (error) {
                console.error('Error:', error);
                statusDiv.textContent = '连接失败: ' + error.message;
                statusDiv.className = 'status show error';
                connectButton.disabled = false;
                connectButton.textContent = '重新连接';
            }
        }

        function setupDataChannel() {
            dataChannel.binaryType = 'arraybuffer';
            
            dataChannel.onopen = () => {
                statusDiv.textContent = '连接已建立，等待文件...';
            };
            
            dataChannel.onmessage = (event) => {
                // 检查是否是文件信息
                if (typeof event.data === 'string') {
                    try {
                        const info = JSON.parse(event.data);
                        if (info.type === 'file-info') {
                            fileInfo = info;
                            totalSize = info.size;
                            
                            fileName.textContent = info.name;
                            fileSize.textContent = formatFileSize(info.size);
                            fileInfoDiv.classList.add('show');
                            progressContainer.classList.add('show');
                            
                            statusDiv.textContent = '开始接收文件...';
                            statusDiv.className = 'status show downloading';
                            connectButton.style.display = 'none';
                        }
                    } catch {
                        // 如果不是JSON，则是二进制数据
                        receiveChunk(event.data);
                    }
                } else {
                    receiveChunk(event.data);
                }
            };
            
            dataChannel.onclose = () => {
                if (fileInfo && receivedSize === totalSize) {
                    // 合并所有chunks
                    const blob = new Blob(receivedChunks, { type: fileInfo.type });
                    
                    // 创建下载链接
                    const url = URL.createObjectURL(blob);
                    downloadAnchor.href = url;
                    downloadAnchor.download = fileInfo.name;
                    downloadLink.classList.add('show');
                    
                    statusDiv.textContent = '文件接收完成！';
                    statusDiv.className = 'status show success';
                    
                    // 通知服务器传输完成
                    if (ws) {
                        ws.send(JSON.stringify({
                            type: 'transfer-complete',
                            code: pickupCodeInput.value.trim().toUpperCase()
                        }));
                        ws.close();
                    }
                }
            };
        }

        function receiveChunk(chunk) {
            receivedChunks.push(chunk);
            receivedSize += chunk.byteLength;
            
            // 更新进度条
            const percent = (receivedSize / totalSize * 100).toFixed(1);
            progressBar.style.width = percent + '%';
            
            statusDiv.textContent = \`正在接收: \${percent}%\`;
        }

        function formatFileSize(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }

        // 允许按Enter键连接
        pickupCodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !connectButton.disabled) {
                connectToSender();
            }
        });
    </script>
</body>
</html>
  `;
}

// Worker入口点
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});