user: addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request))
  })
  
  async function handleRequest(request) {
    // 获取原始响应
    let response = await fetch(request)
  
    // 克隆响应体
    let originalBody = await response.text()
  
    // 注入我们的脚本
    let modifiedBody = originalBody.replace('</body>', `
      <script>
      function getAllConversationHistory() {
        let userMessages = document.querySelectorAll('.font-user-message');
        let claudeMessages = document.querySelectorAll('.font-claude-message');
        let messages = [];
        let minLength = Math.min(userMessages.length, claudeMessages.length);
        for (let i = 0; i < minLength; i++) {
          messages.push({
            'role': 'user',
            'content': userMessages[i].textContent.trim()
          });
          messages.push({
            'role': 'assistant',
            'content': claudeMessages[i].textContent.trim()
          });
        }
        
        if (userMessages.length > minLength) {
          messages.push({
            'role': 'user',
            'content': userMessages[minLength].textContent.trim()
          });
        }
        return messages;
      }
      
      function shouldShowUI() {
        const url = window.location.href;
        const parts = url.split('/');
        return parts.length >= 4 && parts[3] === "chat";
      }
      
      function createHistoryControlUI() {
        const container = document.createElement('div');
        container.id = 'history-control-ui';
        container.style.position = 'fixed';
        container.style.right = '0';
        container.style.top = '30%';
        container.style.zIndex = '9999';
      
        const exportButton = document.createElement('button');
        exportButton.textContent = '导出';
        exportButton.style.padding = '8px 12px';
        exportButton.style.backgroundColor = '#FF69B4';
        exportButton.style.color = 'white';
        exportButton.style.border = 'none';
        exportButton.style.borderTopLeftRadius = '20px';
        exportButton.style.borderBottomLeftRadius = '20px';
        exportButton.style.borderTopRightRadius = '0';
        exportButton.style.borderBottomRightRadius = '0';
        exportButton.style.cursor = 'pointer';
        exportButton.style.fontSize = '14px';
        exportButton.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
        exportButton.style.transition = 'background-color 0.3s';
        exportButton.style.width = 'auto';
      
        exportButton.addEventListener('mouseover', () => {
          exportButton.style.backgroundColor = '#FF1493';
        });
      
        exportButton.addEventListener('mouseout', () => {
          exportButton.style.backgroundColor = '#FF69B4';
        });
      
        exportButton.addEventListener('click', () => {
          const history = getAllConversationHistory();
          let txtContent = '';
          history.forEach(message => {
            if (message.role === 'user') {
              if (message.content !== '默认跟随系统阅读障碍友好') {
              txtContent += \`user:\n\${message.content}\n\n\`;}
            } else if (message.role === 'assistant') {
              txtContent += \`assistant:\n\${message.content}\n\n\`;
            }
          });
          const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
      
          const a = document.createElement('a');
          a.href = url;
          a.download = 'conversation_history.txt';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        });
      
        container.appendChild(exportButton);
        document.body.appendChild(container);
      }
      
      function removeHistoryControlUI() {
        const container = document.getElementById('history-control-ui');
        if (container) {
          container.remove();
        }
      }
      
      function updateUI() {
        if (shouldShowUI()) {
          if (!document.getElementById('history-control-ui')) {
            createHistoryControlUI();
          }
        } else {
          removeHistoryControlUI();
        }
      }
      
      let lastMessageCount = 0;
      
      function checkForNewMessages() {
        const userMessages = document.querySelectorAll('.font-user-message');
        const claudeMessages = document.querySelectorAll('.font-claude-message');
        const currentMessageCount = userMessages.length + claudeMessages.length;
      
        if (currentMessageCount !== lastMessageCount) {
          lastMessageCount = currentMessageCount;
          updateUI();
        }
      }
      
      // 初始更新UI
      updateUI();
      
      // 监听URL变化
      let lastUrl = location.href; 
      new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
          lastUrl = url;
          lastMessageCount = 0; // Reset message count when URL changes
          updateUI();
        }
      }).observe(document, {subtree: true, childList: true});
  
      // 监听新消息
      new MutationObserver(() => {
        checkForNewMessages();
      }).observe(document.body, {subtree: true, childList: true});
      </script>
      </body>
    `)
  
    // 创建新的响应
    let newResponse = new Response(modifiedBody, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    })
  
    return newResponse
  }
  