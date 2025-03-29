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
      
        // 创建下拉菜单容器
        const dropdownContainer = document.createElement('div');
        dropdownContainer.style.position = 'relative';
        dropdownContainer.style.display = 'inline-block';
      
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
      
        // 创建下拉菜单
        const dropdownMenu = document.createElement('div');
        dropdownMenu.style.display = 'none';
        dropdownMenu.style.position = 'absolute';
        dropdownMenu.style.right = '0';
        dropdownMenu.style.backgroundColor = 'white';
        dropdownMenu.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
        dropdownMenu.style.borderRadius = '4px';
        dropdownMenu.style.overflow = 'hidden';
      
        // 创建菜单选项
        const currentChatOption = document.createElement('div');
        currentChatOption.textContent = '导出当前对话';
        currentChatOption.style.padding = '8px 12px';
        currentChatOption.style.cursor = 'pointer';
        currentChatOption.style.transition = 'background-color 0.3s';
      
        const allChatsOption = document.createElement('div');
        allChatsOption.textContent = '导出全部对话';
        allChatsOption.style.padding = '8px 12px';
        allChatsOption.style.cursor = 'pointer';
        allChatsOption.style.transition = 'background-color 0.3s';
      
        // 添加悬浮效果
        [currentChatOption, allChatsOption].forEach(option => {
          option.addEventListener('mouseover', () => {
            option.style.backgroundColor = '#f0f0f0';
          });
          option.addEventListener('mouseout', () => {
            option.style.backgroundColor = 'white';
          });
        });
      
        // 添加点击事件
        currentChatOption.addEventListener('click', () => {
          const history = getAllConversationHistory();
          exportConversation(history);
          dropdownMenu.style.display = 'none';
        });
      
        allChatsOption.addEventListener('click', async () => {
          try {
            const storedValue = localStorage.getItem('storedValue');
            if (!storedValue) {
              console.error('No stored conversation ID found');
              return;
            }

            const myHeaders = new Headers();
            myHeaders.append("User-Agent", "Apifox/1.0.0 (https://apifox.com)");

            const requestOptions = {
              method: 'GET',
              headers: myHeaders,
              redirect: 'follow'
            };
            const fetchUrl = "http://54.254.143.80:8091/conversations/" + storedValue;
            const response = await fetch(fetchUrl, requestOptions);
            const result = await response.text();
            
            // Create and trigger download
            const blob = new Blob([result], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = 'all_conversations.txt';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            dropdownMenu.style.display = 'none';
          } catch (error) {
            console.error('Error exporting all chats:', error);
          }
        });
      
        // 显示/隐藏下拉菜单
        dropdownContainer.addEventListener('mouseenter', () => {
          dropdownMenu.style.display = 'block';
        });
      
        dropdownContainer.addEventListener('mouseleave', () => {
          dropdownMenu.style.display = 'none';
        });
      
        // 将原来的导出逻辑抽取为单独的函数
        function exportConversation(history) {
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
        }
      
        // 组装UI组件
        dropdownMenu.appendChild(currentChatOption);
        dropdownMenu.appendChild(allChatsOption);
        dropdownContainer.appendChild(exportButton);
        dropdownContainer.appendChild(dropdownMenu);
        container.appendChild(dropdownContainer);
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
