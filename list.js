$(window).on("load", function() {
    setTimeout(function() {
      var $div = $("<div></div>");
      $div.css({
        "border-top-left-radius": "34px",
        "border-bottom-left-radius": "34px",
        background: "linear-gradient(140.91deg, #FF87B7 12.61%, #EC4C8C 76.89%)",
        height: "34px",
        width: "45px",
        margin: "1px",
        display: "flex",
        "align-items": "center",
        position: "fixed",
        right: "0px",
        top: `70px`,
        cursor: "pointer",
      });
      $div.html(
        "<span style='color:white;font-size:15px;margin-left:10px'>换号</span>"
      );
      $("body").append($div);
      $div.click(function () {
        window.location.href = "/list";
      });

      // 添加CSS动画样式
      const style = $("<style></style>");
      style.text("@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }");
      $("head").append(style);

      // 导出按钮
      var $exportDiv = $("<div></div>");
      $exportDiv.css({
        "border-top-left-radius": "34px",
        "border-bottom-left-radius": "34px",
        background: "linear-gradient(140.91deg, #FF69B4 12.61%, #FF1493 76.89%)",
        height: "34px",
        width: "45px",
        margin: "1px",
        display: "flex",
        "align-items": "center",
        position: "fixed",
        right: "0px",
        top: `110px`,
        cursor: "pointer",
      });
      $exportDiv.html(
        "<span style='color:white;font-size:15px;margin-left:10px'>导出</span>"
      );
      $("body").append($exportDiv);

      // 智能换号按钮
      var $smartDiv = $("<div></div>");
      $smartDiv.css({
        "border-top-left-radius": "34px",
        "border-bottom-left-radius": "34px",
        background: "linear-gradient(140.91deg, #4169E1 12.61%, #0000CD 76.89%)",
        height: "34px",
        width: "60px",
        margin: "1px",
        display: "flex",
        "align-items": "center",
        position: "fixed",
        right: "0px",
        top: `150px`,
        cursor: "pointer",
      });
      $smartDiv.html(
        "<span style='color:white;font-size:13px;margin-left:8px'>智能换号</span>"
      );
      $("body").append($smartDiv);

      // 加载动画
      var $loaderDiv = $("<div></div>");
      $loaderDiv.attr("id", "account-loader");
      $loaderDiv.css({
        position: "fixed",
        right: "10px",
        top: `190px`,
        display: "none",
        "justify-content": "center",
        "align-items": "center"
      });
      var $loader = $("<div></div>");
      $loader.css({
        width: "20px",
        height: "20px",
        border: "3px solid rgba(255,255,255,0.3)",
        "border-radius": "50%",
        "border-top": "3px solid #4169E1",
        animation: "spin 1s linear infinite"
      });
      $loaderDiv.append($loader);
      $("body").append($loaderDiv);

      // worker.js的功能函数
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
          return data;
        } catch (error) {
          console.error('Error checking API key:', error);
          return false;
        }
      };

      async function getAccountTyep() {
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

        const filteredAccounts = accountList.filter(account => {
          return isPlus ? account.isPlus === 1 : account.isPlus === 0;
        });

        const carIDList = filteredAccounts.map(account => account.carID);
        return carIDList;
      }

      async function getCarStatus(carID) {
        const requestUrl = "/endpoint?carid=" + encodeURIComponent(carID);
        return fetch(requestUrl)
          .then(response => response.json())
          .then(data => {
            return { carID, ...data };
          });
      }

      async function isCarAvailable(carID) {
        const carStatus = await getCarStatus(carID);
        return (carStatus.message.includes("可用") || carStatus.message.includes("推荐")) && (!carStatus.message.includes("不可用"));
      }

      function redirectTo(carID) {
        window.location.href = window.location.origin + "/auth/login?carid=" + encodeURIComponent(carID);
      }

      async function chooseAvailableAccount() {
        const carIDList = await getCarList();
        const batchSize = 15;

        for (let i = 0; i < carIDList.length; i += batchSize) {
          const batch = carIDList.slice(i, i + batchSize);
          const statusPromises = batch.map(carID => isCarAvailable(carID));
          const statuses = await Promise.all(statusPromises);

          const availableIndex = statuses.findIndex(status => status === true);
          if (availableIndex !== -1) {
            return batch[availableIndex];
          }
        }
        return null;
      }

      let availableCarID = null;
      let checkingAccounts = false;

      async function checkAvailableAccount() {
        if (checkingAccounts) return;
        
        checkingAccounts = true;
        // 显示加载动画
        const loader = $("#account-loader");
        if (loader.length) {
          loader.css("display", "flex");
        }

        try {
          availableCarID = await chooseAvailableAccount();
          // 隐藏加载动画
          if (loader.length) {
            loader.css("display", "none");
          }
        } catch (error) {
          console.error('Error during account checking:', error);
          // 隐藏加载动画
          if (loader.length) {
            loader.css("display", "none");
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
          const loader = $("#account-loader");
          if (loader.length) {
            loader.css("display", "flex");
          }

          try {
            const carID = await chooseAvailableAccount();
            if (carID) {
              redirectTo(carID);
            } else {
              // 提示用户没有可用的账号
              alert("没有可用的账号");
              // 隐藏加载动画
              if (loader.length) {
                loader.css("display", "none");
              }
            }
          } catch (error) {
            console.error('Error during account switching:', error);
            alert("切换账号时出错");
            // 隐藏加载动画
            if (loader.length) {
              loader.css("display", "none");
            }
          }
        }
      }

      // 绑定导出按钮点击事件
      $exportDiv.click(function () {
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

      // 绑定智能换号按钮点击事件
      $smartDiv.click(function () {
        smartChangeAccount();
      });

      // 检查是否在chat页面
      function shouldShowUI() {
        const url = window.location.href;
        const parts = url.split('/');
        return parts.length >= 4 && parts[3] === "chat";
      }

      let accountCheckInterval = null;
      let lastMessageCount = 0;

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
          startAccountChecking();
        } else {
          stopAccountChecking();
        }
      }

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
      const observer = new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
          lastUrl = url;
          lastMessageCount = 0; // Reset message count when URL changes
          updateUI();
        }
        checkForNewMessages();
      });
      observer.observe(document, { subtree: true, childList: true });

    }, 2000); // 延迟2秒
  });
  