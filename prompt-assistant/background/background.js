/**
 * Background Service Worker
 * 处理跨标签通信、安装初始化等
 */

importScripts('../common/storage.js');

// 安装时初始化
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Prompt Assistant 已安装');
    initializeDefaultData();
  } else if (details.reason === 'update') {
    console.log('Prompt Assistant 已更新');
  }
});

// 从 JSON 文件加载默认数据
async function loadDefaultData() {
  try {
    const response = await fetch(chrome.runtime.getURL('data/default-prompts.json'));
    const data = await response.json();
    return data;
  } catch (err) {
    console.error('加载默认数据失败:', err);
    return null;
  }
}

// 根据分类名称获取或创建分类 ID
async function getOrCreateCategory(categoryName) {
  const categories = await StorageManager.getCategories();
  
  // 尝试通过名称查找现有分类
  const existingCategory = categories.find(c => c.name === categoryName);
  if (existingCategory) {
    return existingCategory.id;
  }
  
  // 创建新分类（使用随机颜色）
  const colors = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#14b8a6'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const newCategory = await StorageManager.addCategory({ name: categoryName, color });
  return newCategory.id;
}

// 初始化默认数据
async function initializeDefaultData() {
  const prompts = await StorageManager.getPrompts();
  if (prompts.length === 0) {
    // 从 JSON 文件加载默认数据
    const defaultData = await loadDefaultData();
    
    if (!defaultData) {
      console.error('无法加载默认数据');
      return;
    }
    
    // 导入分类
    const categoryNameToId = {};
    if (defaultData.categories && defaultData.categories.length > 0) {
      for (const cat of defaultData.categories) {
        const categoryId = await getOrCreateCategory(cat.name);
        categoryNameToId[cat.name] = categoryId;
        
        // 更新分类颜色
        const categories = await StorageManager.getCategories();
        const existingCat = categories.find(c => c.id === categoryId);
        if (existingCat && cat.color) {
          existingCat.color = cat.color;
          await StorageManager.setCategories(categories);
        }
      }
    }
    
    // 导入 prompts
    if (defaultData.prompts && defaultData.prompts.length > 0) {
      for (const prompt of defaultData.prompts) {
        // 根据分类名称获取分类 ID
        const categoryId = categoryNameToId[prompt.category] || 'general';
        
        await StorageManager.addPrompt({
          name: prompt.name,
          content: prompt.content,
          category: categoryId,
          tags: prompt.tags || []
        });
      }
      console.log(`默认 prompts 已初始化: ${defaultData.prompts.length} 个`);
    }
  }
}

// 监听来自 popup/content 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse).catch(err => {
    console.error('Background error:', err);
    sendResponse({ success: false, error: err.message });
  });
  return true; // 保持消息通道打开
});

async function handleMessage(message, sender) {
  switch (message.type) {
    case 'INSERT_PROMPT':
      return await handleInsertPrompt(message.prompt);
      
    case 'GET_CURRENT_TAB':
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return { success: true, tab: { id: tab.id, url: tab.url, title: tab.title } };
      
    case 'COPY_TO_CLIPBOARD':
      await navigator.clipboard.writeText(message.text);
      return { success: true };
      
    default:
      return { success: false, error: 'Unknown message type' };
  }
}

// 处理插入 prompt 到当前标签页
async function handleInsertPrompt(prompt) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab) {
    return { success: false, error: 'No active tab' };
  }

  // 检查是否在支持的网站上
  const supportedSites = [
    'chat.openai.com',
    'chatgpt.com',
    'claude.ai',
    'gemini.google.com',
    'kimi.moonshot.cn',
    'tongyi.aliyun.com',
    'yiyan.baidu.com',
    'xinghuo.xfyun.cn',
    'doubao.com',
    'chatglm.cn',
    'kimi.com',
    'poe.com',
    'copilot.microsoft.com'
  ];
  
  const isSupported = supportedSites.some(site => tab.url.includes(site));
  
  if (!isSupported) {
    // 复制到剪贴板作为备选
    await navigator.clipboard.writeText(prompt.content);
    return { 
      success: true, 
      mode: 'clipboard',
      message: '当前页面不支持自动插入，已复制到剪贴板' 
    };
  }

  try {
    // 向 content script 发送插入请求
    await chrome.tabs.sendMessage(tab.id, {
      type: 'INSERT_TEXT',
      text: prompt.content
    });
    
    // 增加使用次数
    await StorageManager.incrementUseCount(prompt.id);
    
    return { success: true, mode: 'insert' };
  } catch (err) {
    // 如果 content script 未加载，复制到剪贴板
    await navigator.clipboard.writeText(prompt.content);
    return { 
      success: true, 
      mode: 'clipboard',
      message: '已复制到剪贴板，请手动粘贴' 
    };
  }
}

// 监听快捷键
chrome.commands.onCommand.addListener((command) => {
  if (command === '_execute_action') {
    // 默认行为：打开 popup
  }
});

// 监听存储变化，可用于同步
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    // 可以在这里处理跨设备同步
  }
});
