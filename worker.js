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
(function () {
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
      // 
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
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '10px';

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
          txtContent += "user:\\n" + message.content + "\\n\\n";
        } else if (message.role === 'assistant') {
          txtContent += "assistant:\\n" + message.content + "\\n\\n";
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

    const switchAccountButton = document.createElement('button');
    switchAccountButton.textContent = '智能换号';
    switchAccountButton.style.padding = '8px 12px';
    switchAccountButton.style.backgroundColor = '#4169E1';
    switchAccountButton.style.color = 'white';
    switchAccountButton.style.border = 'none';
    switchAccountButton.style.borderTopLeftRadius = '20px';
    switchAccountButton.style.borderBottomLeftRadius = '20px';
    switchAccountButton.style.borderTopRightRadius = '0';
    switchAccountButton.style.borderBottomRightRadius = '0';
    switchAccountButton.style.cursor = 'pointer';
    switchAccountButton.style.fontSize = '14px';
    switchAccountButton.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    switchAccountButton.style.transition = 'background-color 0.3s';
    switchAccountButton.style.width = 'auto';

    switchAccountButton.addEventListener('mouseover', () => {
      switchAccountButton.style.backgroundColor = '#0000CD';
    });

    switchAccountButton.addEventListener('mouseout', () => {
      switchAccountButton.style.backgroundColor = '#4169E1';
    });

    switchAccountButton.addEventListener('click', () => {
      smartChangeAccount();
    });

    // 创建加载动画容器
    const loaderContainer = document.createElement('div');
    loaderContainer.id = 'account-loader';
    loaderContainer.style.display = 'none';
    loaderContainer.style.justifyContent = 'center';
    loaderContainer.style.alignItems = 'center';
    loaderContainer.style.paddingLeft = '10px';

    // 创建加载动画
    const loader = document.createElement('div');
    loader.style.width = '20px';
    loader.style.height = '20px';
    loader.style.border = '3px solid rgba(255,255,255,0.3)';
    loader.style.borderRadius = '50%';
    loader.style.borderTop = '3px solid #4169E1';
    loader.style.animation = 'spin 1s linear infinite';

    // 添加旋转动画样式
    const style = document.createElement('style');
    style.textContent = "@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }";
    document.head.appendChild(style);

    loaderContainer.appendChild(loader);

    container.appendChild(exportButton);
    container.appendChild(switchAccountButton);
    container.appendChild(loaderContainer);
    document.body.appendChild(container);
  }

  function removeHistoryControlUI() {
    const container = document.getElementById('history-control-ui');
    if (container) {
      container.remove();
    }
  }

  let availableCarID = null;
  let checkingAccounts = false;
  let accountCheckInterval = null;

  async function checkAvailableAccount() {
    if (checkingAccounts) return;
    
    checkingAccounts = true;
    // 显示加载动画
    const loader = document.getElementById('account-loader');
    if (loader) {
      loader.style.display = 'flex';
    }

    try {
      availableCarID = await chooseAvailableAccount();
      // 隐藏加载动画
      if (loader) {
        loader.style.display = 'none';
      }
    } catch (error) {
      console.error('Error during account checking:', error);
      // 隐藏加载动画
      if (loader) {
        loader.style.display = 'none';
      }
    } finally {
      checkingAccounts = false;
    }
  }

  async function smartChangeAccount() {
    if (availableCarID) {
      redirectTo(availableCarID);
    } else {
      // 如果没有预先获取到可用账号，则进行即时检查
      // 显示加载动画
      const loader = document.getElementById('account-loader');
      if (loader) {
        loader.style.display = 'flex';
      }

      try {
        const carID = await chooseAvailableAccount();
        if (carID) {
          redirectTo(carID);
        } else {
          // 提示用户没有可用的账号
          alert("没有可用的账号");
          // 隐藏加载动画
          if (loader) {
            loader.style.display = 'none';
          }
        }
      } catch (error) {
        console.error('Error during account switching:', error);
        alert("切换账号时出错");
        // 隐藏加载动画
        if (loader) {
          loader.style.display = 'none';
        }
      }
    }
  }

  function startAccountChecking() {
    if (shouldShowUI() && !accountCheckInterval) {
      // 初始加载时立即检查一次
      checkAvailableAccount();
      
      // 设置30秒定时检查
      accountCheckInterval = setInterval(checkAvailableAccount, 30000);
    }
  }

  function stopAccountChecking() {
    if (accountCheckInterval) {
      clearInterval(accountCheckInterval);
      accountCheckInterval = null;
    }
  }

  function updateUI() {
    if (shouldShowUI()) {
      if (!document.getElementById('history-control-ui')) {
        createHistoryControlUI();
      }
      startAccountChecking();
    } else {
      removeHistoryControlUI();
      stopAccountChecking();
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


  const getApiKeyInfo = async (api_key) => {
    try {
      const requestOptions = {
        method: "GET",
        headers: {
          'Content-Type': 'application/json'
        }
      };
      const url = "https://api.claude35.585dg.com/api/v1/api_key/expirations_date/" + api_key;

      const response = await fetch(url, requestOptions);
      const data = await response.json();

      // Check if the response data has content
      return data;
    } catch (error) {
      console.error('Error checking API key:', error);
      return false;
    }
  };

  async function getAccountTyep() {
    // 判断当前账号是不是plus账号
    const api_key = localStorage.getItem('storedValue');
    const api_key_info = await getApiKeyInfo(api_key);
    const isPlus = api_key_info.isPlus;
    return isPlus;
  }

  async function getCarList() {
    const isPlus = await getAccountTyep();
    response = await fetch('/carpage', {
      method: 'POST',
      body: JSON.stringify({
        page: 1,
        size: 1000
      })
    })
    const accountList = (await response.json()).data.list;

    // 挑选出accountList对应为isPlus状态的账号
    const filteredAccounts = accountList.filter(account => {
      // 如果当前账号是Plus，返回所有Plus账号；否则返回所有非Plus账号
      return isPlus ? account.isPlus === 1 : account.isPlus === 0;
    });

    // 构建carID列表
    const carIDList = filteredAccounts.map(account => account.carID);

    return carIDList;

    //  {carID: "claude-pro46", isPlus: 1, status: 1} 每个里面的元素。 
  }


  async function getCarStatus(carID) {
    const requestUrl = "/endpoint?carid=" + encodeURIComponent(carID);

    // message: "繁忙|可用" "推荐"
    return fetch(requestUrl)
      .then(response => response.json())
      .then(data => {
        return { carID, ...data };
      });
  }

  async function isCarAvailable(carID) {
    const carStatus = await getCarStatus(carID);
    // 如果 可用 或者 推荐 是message的自字符串
    return carStatus.message.includes("可用") || carStatus.message.includes("推荐");
  }

  function redirectTo(carID) {
    window.location.href = window.location.origin + "/auth/login?carid=" + encodeURIComponent(carID);
  }

  async function chooseAvailableAccount() {
    const carIDList = await getCarList();
    // 然后获取所有的carIDList的status

    // 每批处理的车辆数量
    const batchSize = 15;

    // 分批处理
    for (let i = 0; i < carIDList.length; i += batchSize) {
      const batch = carIDList.slice(i, i + batchSize);

      // 并行检查这一批车辆
      const statusPromises = batch.map(carID => isCarAvailable(carID));
      const statuses = await Promise.all(statusPromises);

      // 找到第一个可用的车辆
      const availableIndex = statuses.findIndex(status => status === true);
      if (availableIndex !== -1) {
        // 返回可用的车辆ID
        return batch[availableIndex];
      }
    }
    // 如果没有可用的车辆，返回null
    return null;
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
    checkForNewMessages();
  }).observe(document, { subtree: true, childList: true });

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
