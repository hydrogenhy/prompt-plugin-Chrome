/**
 * Content Script
 * 与 AI 平台页面交互，自动插入 prompt
 */

// 支持的平台配置
const PLATFORM_CONFIG = {
  'chat.openai.com': {
    name: 'ChatGPT',
    selectors: {
      input: '#prompt-textarea, [data-testid="text-input"], .ProseMirror[contenteditable="true"]',
      sendButton: 'button[data-testid="send-button"], button[aria-label="Send message"]'
    }
  },
  'chatgpt.com': {
    name: 'ChatGPT',
    selectors: {
      input: '#prompt-textarea, [data-testid="text-input"], .ProseMirror[contenteditable="true"]',
      sendButton: 'button[data-testid="send-button"], button[aria-label="Send message"]'
    }
  },
  'claude.ai': {
    name: 'Claude',
    selectors: {
      input: '[contenteditable="true"][aria-label*="message"], [contenteditable="true"][placeholder*="Message"]',
      sendButton: 'button[aria-label="Send message"], button[type="submit"]'
    }
  },
  'gemini.google.com': {
    name: 'Gemini',
    selectors: {
      input: '[contenteditable="true"][aria-label*="input"], rich-textarea [contenteditable="true"]',
      sendButton: 'button[aria-label="Send message"], send-button'
    }
  },
  'kimi.moonshot.cn': {
    name: 'Kimi',
    selectors: {
      input: '[contenteditable="true"], .chat-input textarea, .ProseMirror',
      sendButton: 'button[type="submit"], .send-btn'
    }
  },
  'kimi.com': {
    name: 'Kimi',
    selectors: {
      input: '[contenteditable="true"], .chat-input textarea, .ProseMirror',
      sendButton: 'button[type="submit"], .send-btn'
    }
  },
  'tongyi.aliyun.com': {
    name: '通义千问',
    selectors: {
      input: 'textarea[placeholder*="输入"], [contenteditable="true"], .ant-input',
      sendButton: 'button[type="submit"], .send-button'
    }
  },
  'yiyan.baidu.com': {
    name: '文心一言',
    selectors: {
      input: 'textarea, [contenteditable="true"], .yc-editor',
      sendButton: '.send-btn, button[type="submit"]'
    }
  },
  'xinghuo.xfyun.cn': {
    name: '讯飞星火',
    selectors: {
      input: 'textarea, [contenteditable="true"], .chat-input-inner',
      sendButton: '.send-btn, button[type="submit"]'
    }
  },
  'doubao.com': {
    name: '豆包',
    selectors: {
      input: 'textarea, [contenteditable="true"], .editor-content',
      sendButton: '.send-btn, button[type="submit"]'
    }
  },
  'chatglm.cn': {
    name: 'ChatGLM',
    selectors: {
      input: 'textarea, [contenteditable="true"], .input-box',
      sendButton: '.send-btn, button[type="submit"]'
    }
  },
  'poe.com': {
    name: 'Poe',
    selectors: {
      input: 'textarea[class*="ChatMessageInput"], [contenteditable="true"], .MarkdownInput',
      sendButton: 'button[class*="send"], button[type="submit"]'
    }
  },
  'copilot.microsoft.com': {
    name: 'Copilot',
    selectors: {
      input: '[contenteditable="true"], textarea, .cib-serp-main',
      sendButton: 'button[type="submit"], .submit-button'
    }
  }
};

// 获取当前平台配置
function getPlatformConfig() {
  const hostname = window.location.hostname;
  for (const [domain, config] of Object.entries(PLATFORM_CONFIG)) {
    if (hostname.includes(domain)) {
      return { domain, ...config };
    }
  }
  return null;
}

// 查找输入框
function findInputElement(config) {
  if (!config) return null;
  
  const selectors = config.selectors.input.split(', ');
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      return element;
    }
  }
  
  // 兜底：尝试常见选择器
  const fallbackSelectors = [
    'textarea',
    '[contenteditable="true"]',
    '.ProseMirror',
    '[role="textbox"]',
    '.chat-input',
    'input[type="text"]'
  ];
  
  for (const selector of fallbackSelectors) {
    const elements = document.querySelectorAll(selector);
    for (const el of elements) {
      // 优先选择可见且较大的输入框
      const rect = el.getBoundingClientRect();
      if (rect.width > 200 && rect.height > 40 && isVisible(el)) {
        return el;
      }
    }
  }
  
  return null;
}

// 检查元素是否可见
function isVisible(element) {
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && 
         style.visibility !== 'hidden' && 
         style.opacity !== '0';
}

// 插入文本到输入框
function insertTextToInput(element, text) {
  if (!element) return false;

  // 判断是 contenteditable 还是 textarea/input
  const isContentEditable = element.isContentEditable || element.getAttribute('contenteditable') === 'true';
  
  if (isContentEditable) {
    return insertToContentEditable(element, text);
  } else {
    return insertToTextInput(element, text);
  }
}

// 插入到 contenteditable 元素
function insertToContentEditable(element, text) {
  try {
    // 聚焦元素
    element.focus();
    
    // 获取当前选择
    const selection = window.getSelection();
    const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : document.createRange();
    
    // 如果当前没有选区或选区不在目标元素内，创建一个新的选区
    if (!element.contains(range.commonAncestorContainer)) {
      range.selectNodeContents(element);
      range.collapse(false); // 折叠到末尾
    }
    
    // 删除当前选中的内容
    range.deleteContents();
    
    // 插入文本节点
    const textNode = document.createTextNode(text);
    range.insertNode(textNode);
    
    // 移动光标到插入文本之后
    range.setStartAfter(textNode);
    range.setEndAfter(textNode);
    selection.removeAllRanges();
    selection.addRange(range);
    
    // 触发输入事件
    triggerInputEvent(element);
    
    return true;
  } catch (err) {
    console.error('Insert to contenteditable failed:', err);
    // 兜底方案
    element.textContent += text;
    triggerInputEvent(element);
    return true;
  }
}

// 插入到 textarea/input 元素
function insertToTextInput(element, text) {
  try {
    element.focus();
    
    const start = element.selectionStart || element.value.length;
    const end = element.selectionEnd || element.value.length;
    const value = element.value;
    
    // 在光标位置插入文本
    element.value = value.substring(0, start) + text + value.substring(end);
    
    // 移动光标到插入文本之后
    const newCursorPos = start + text.length;
    element.selectionStart = element.selectionEnd = newCursorPos;
    
    // 触发输入事件
    triggerInputEvent(element);
    
    return true;
  } catch (err) {
    console.error('Insert to text input failed:', err);
    // 兜底方案
    element.value += text;
    triggerInputEvent(element);
    return true;
  }
}

// 触发输入事件
function triggerInputEvent(element) {
  const events = ['input', 'change', 'keyup', 'keydown'];
  events.forEach(eventType => {
    const event = new Event(eventType, { bubbles: true, cancelable: true });
    element.dispatchEvent(event);
  });
}

// 自动发送（可选）
function autoSend(config) {
  // 延迟一下再发送，让用户有机会检查
  setTimeout(() => {
    const sendButton = document.querySelector(config.selectors.sendButton);
    if (sendButton && !sendButton.disabled) {
      // 不自动点击发送，让用户自己决定
      // sendButton.click();
    }
  }, 100);
}

// 主插入函数
function insertPrompt(text) {
  const config = getPlatformConfig();
  const inputElement = findInputElement(config);
  
  if (!inputElement) {
    console.log('Prompt Assistant: 未找到输入框');
    return { success: false, error: '未找到输入框，请确保页面已完全加载' };
  }
  
  const success = insertTextToInput(inputElement, text);
  
  if (success) {
    // 滚动到输入框
    inputElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // 视觉反馈
    highlightInput(inputElement);
    
    return { success: true };
  }
  
  return { success: false, error: '插入失败' };
}

// 高亮输入框提供视觉反馈
function highlightInput(element) {
  const originalTransition = element.style.transition;
  const originalBoxShadow = element.style.boxShadow;
  
  element.style.transition = 'box-shadow 0.3s ease';
  element.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.5)';
  
  setTimeout(() => {
    element.style.boxShadow = originalBoxShadow;
    element.style.transition = originalTransition;
  }, 1000);
}

// 监听来自 background/popup 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'INSERT_TEXT') {
    const result = insertPrompt(message.text);
    sendResponse(result);
  } else if (message.type === 'PING') {
    sendResponse({ success: true, platform: getPlatformConfig()?.name });
  }
  return true;
});

// 页面加载完成后的初始化
function initialize() {
  console.log('Prompt Assistant: Content script loaded on', window.location.hostname);
  
  // 可以在这里添加更多功能，比如右键菜单、浮动按钮等
}

// 等待页面加载
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// 导出供测试
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { insertPrompt, getPlatformConfig };
}
