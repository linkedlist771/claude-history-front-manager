const getApiKeyInfo = async (api_key) => {
    try {
        const requestOptions = {
            method: "GET",
            headers: {
                'Content-Type': 'application/json'
            }
        };
        const url = `https://api.claude35.585dg.com/api/v1/api_key/expirations_date/${api_key}`;

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
    const requestUrl = `/endpoint?carid=${encodeURIComponent(carID)}`;
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
    window.location.href = `${window.location.origin
    }/auth/login?carid=${encodeURI(carID)}`;
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

async function smartChangeAccount() {
    const carID = await chooseAvailableAccount();
    if (carID) {
        redirectTo(carID);
    }
    else{
        // 提示用户没有可用的账号
        alert("没有可用的账号");
    }
}



