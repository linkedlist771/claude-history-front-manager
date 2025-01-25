addEventListener('fetch', event => {
  event.passThroughOnException();
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const response = await fetch(request);
  const ctype = response.headers.get('content-type');
  if (!ctype || !ctype.startsWith('text/html')) {
    return response; // Only parse html body
  }

  let { readable, writable } = new TransformStream();
  let promise = injectScripts(response.body, writable);
  return new Response(readable, response);
}

async function injectScripts(readable, writable) {
  const writer = writable.getWriter();
  const reader = readable.getReader();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  const scriptToInject = `
    <script>
    (function() {
      console.log('script injected');
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
        return true;
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
                txtContent += \`user:\n\${message.content}\n\n\`;
              }
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
      
      let lastUrl = location.href;
      let lastMessageCount = 0;
      
      function checkAndUpdateUI() {
        const userMessages = document.querySelectorAll('.font-user-message');
        const claudeMessages = document.querySelectorAll('.font-claude-message');
        const currentMessageCount = userMessages.length + claudeMessages.length;
        const currentUrl = location.href;
      
        if (currentUrl !== lastUrl || currentMessageCount !== lastMessageCount) {
          lastUrl = currentUrl;
          lastMessageCount = currentMessageCount;
          updateUI();
        }
      }
      
      // 立即开始执行检查和更新UI
      setInterval(checkAndUpdateUI, 1000);
      console.log('checkAndUpdateUI interval set');
      checkAndUpdateUI();
    })();
    </script>
  `;

  let buffer = '';
  
  try {

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        if (buffer) {
          await writer.write(encoder.encode(buffer));
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      
      const bodyEndIndex = buffer.indexOf('</body>');
      
      if (bodyEndIndex !== -1) {
        // Write everything before </body>
        const beforeBody = buffer.slice(0, bodyEndIndex);
        await writer.write(encoder.encode(beforeBody));
        
        // Write our injected script
        await writer.write(encoder.encode(scriptToInject));
        
        // Write </body> and anything after it
        const afterBody = buffer.slice(bodyEndIndex);
        await writer.write(encoder.encode(afterBody));
        
        // Reset buffer since we've written everything
        buffer = '';
      }
      
    }
  } catch (error) {
    console.error('Error during transform:', error);
  } finally {
    await writer.close();
  }
}
