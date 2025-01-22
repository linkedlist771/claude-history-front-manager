addEventListener('fetch', event => {
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
      function getAllConversationHistory(){
        // 选择所有 class 为 "font-user-message" 的元素
        let userMessages = document.querySelectorAll('.font-user-message');
        // 选择所有 class 为 "font-claude-message" 的元素
        let claudeMessages = document.querySelectorAll('.font-claude-message');
        // 创建新的数组来存储格式化后的消息
        let messages = [];
        // 获取用户消息和Claude消息中较短的那个长度
        let minLength = Math.min(userMessages.length, claudeMessages.length);
        // 遍历并严格交替添加用户和Claude的消息
        for (let i = 0; i < minLength; i++) {
            // 添加用户消息
            messages.push({
            'role': 'user',
            'content': userMessages[i].textContent.trim()
            });
            // 添加Claude消息
            messages.push({
            'role': 'assistant',
            'content': claudeMessages[i].textContent.trim()
            });
        }
        
        // 如果还有剩余的用户消息，添加到最后
        if (userMessages.length > minLength) {
            messages.push({
            'role': 'user',
            'content': userMessages[minLength].textContent.trim()
            });
        }
        return messages;
      }
      
      function shouldShowUI(){
        const url = window.location.href;
        const parts = url.split('/');
        // Check if there's a first-level route and if it's "chat"
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
          const jsonString = JSON.stringify(history, null, 2);
          const blob = new Blob([jsonString], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
    
          const a = document.createElement('a');
          a.href = url;
          a.download = 'conversation_history.json';
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
  
      // 初始更新UI
      updateUI();
  
      // 监听URL变化
      let lastUrl = location.href; 
      new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
          lastUrl = url;
          updateUI();
        }
      }).observe(document, {subtree: true, childList: true});
  
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
  