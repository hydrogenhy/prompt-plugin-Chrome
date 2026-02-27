/**
 * Popup Script
 * 处理 Popup 界面的交互逻辑
 */

// 全局状态
let currentPrompts = [];
let currentCategories = [];
let editingPromptId = null;
let previewPromptId = null;

// DOM 元素缓存
const elements = {};

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  cacheElements();
  bindEvents();
  await loadCategories();
  await loadPrompts();
});

// 缓存 DOM 元素
function cacheElements() {
  elements.searchInput = document.getElementById('search-input');
  elements.clearSearch = document.getElementById('btn-clear-search');
  elements.categoryFilter = document.getElementById('category-filter');
  elements.favoritesBtn = document.getElementById('btn-favorites');
  elements.sortBy = document.getElementById('sort-by');
  elements.statsText = document.getElementById('stats-text');
  elements.promptList = document.getElementById('prompt-list');
  elements.emptyState = document.getElementById('empty-state');
  elements.toast = document.getElementById('toast');
  elements.toastMessage = document.getElementById('toast-message');
  
  // Modal
  elements.editModal = document.getElementById('edit-modal');
  elements.previewModal = document.getElementById('preview-modal');
  elements.modalTitle = document.getElementById('modal-title');
  elements.editName = document.getElementById('edit-name');
  elements.editCategory = document.getElementById('edit-category');
  elements.editContent = document.getElementById('edit-content');
  elements.editTags = document.getElementById('edit-tags');
  elements.previewTitle = document.getElementById('preview-title');
  elements.previewContent = document.getElementById('preview-content');
}

// 绑定事件
function bindEvents() {
  // 搜索
  elements.searchInput.addEventListener('input', debounce(() => {
    toggleClass(elements.clearSearch, 'hidden', !elements.searchInput.value);
    loadPrompts();
  }, 300));
  
  elements.clearSearch.addEventListener('click', () => {
    elements.searchInput.value = '';
    elements.clearSearch.classList.add('hidden');
    loadPrompts();
  });
  
  // 过滤
  elements.categoryFilter.addEventListener('change', loadPrompts);
  elements.favoritesBtn.addEventListener('click', () => {
    elements.favoritesBtn.classList.toggle('active');
    loadPrompts();
  });
  elements.sortBy.addEventListener('change', loadPrompts);
  
  // 按钮
  document.getElementById('btn-add').addEventListener('click', () => openEditModal());
  document.getElementById('btn-settings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  document.getElementById('btn-create-first').addEventListener('click', () => openEditModal());
  
  // Modal 按钮
  document.getElementById('btn-cancel').addEventListener('click', closeEditModal);
  document.getElementById('btn-save').addEventListener('click', savePrompt);
  document.getElementById('btn-copy').addEventListener('click', copyPreviewToClipboard);
  document.getElementById('btn-insert').addEventListener('click', insertPreviewToPage);
  document.getElementById('btn-preview-favorite').addEventListener('click', togglePreviewFavorite);
  
  // Modal 关闭
  document.querySelectorAll('.modal-close, .modal-overlay').forEach(el => {
    el.addEventListener('click', closeAllModals);
  });
  
  // ESC 关闭 Modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllModals();
  });
}

// 加载分类
async function loadCategories() {
  currentCategories = await StorageManager.getCategories();
  
  // 更新分类选择器
  const options = ['<option value="all">全部分类</option>'];
  currentCategories.forEach(cat => {
    options.push(`<option value="${cat.id}">${cat.name}</option>`);
  });
  
  elements.categoryFilter.innerHTML = options.join('');
  elements.editCategory.innerHTML = currentCategories.map(cat => 
    `<option value="${cat.id}">${cat.name}</option>`
  ).join('');
}

// 加载 Prompts
async function loadPrompts() {
  const options = {
    category: elements.categoryFilter.value,
    favoritesOnly: elements.favoritesBtn.classList.contains('active'),
    sortBy: elements.sortBy.value,
    sortOrder: elements.sortBy.value === 'name' ? 'asc' : 'desc'
  };
  
  currentPrompts = await StorageManager.searchPrompts(
    elements.searchInput.value,
    options
  );
  
  renderPromptList();
  updateStats();
}

// 渲染 Prompt 列表
function renderPromptList() {
  if (currentPrompts.length === 0) {
    elements.promptList.innerHTML = '';
    elements.emptyState.classList.remove('hidden');
    return;
  }
  
  elements.emptyState.classList.add('hidden');
  
  elements.promptList.innerHTML = currentPrompts.map(prompt => {
    const category = currentCategories.find(c => c.id === prompt.category);
    const categoryColor = category?.color || '#6366f1';
    const icon = getPromptIcon(prompt.name);
    
    return `
      <div class="prompt-item ${prompt.favorite ? 'favorite' : ''}" data-id="${prompt.id}">
        <div class="prompt-icon" style="background: ${categoryColor}20; color: ${categoryColor}">
          ${icon}
        </div>
        <div class="prompt-info">
          <div class="prompt-name">${escapeHtml(prompt.name)}</div>
          <div class="prompt-meta">
            <span class="prompt-category">
              <span class="category-dot" style="background: ${categoryColor}"></span>
              ${category?.name || '未分类'}
            </span>
            ${prompt.useCount ? `<span>使用 ${prompt.useCount} 次</span>` : ''}
          </div>
        </div>
        <div class="prompt-actions">
          <button class="action-btn favorite-btn ${prompt.favorite ? 'active' : ''}" 
                  data-action="favorite" title="收藏">
            <svg viewBox="0 0 24 24" fill="${prompt.favorite ? 'currentColor' : 'none'}" 
                 stroke="currentColor" stroke-width="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </button>
          <button class="action-btn" data-action="edit" title="编辑">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="action-btn" data-action="preview" title="预览/插入">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }).join('');
  
  // 绑定列表项事件
  elements.promptList.querySelectorAll('.prompt-item').forEach(item => {
    const id = item.dataset.id;
    const prompt = currentPrompts.find(p => p.id === id);
    
    // 点击整行预览/插入
    item.addEventListener('click', (e) => {
      if (!e.target.closest('.action-btn')) {
        openPreviewModal(prompt);
      }
    });
    
    // 按钮事件
    item.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        handlePromptAction(action, prompt);
      });
    });
  });
}

// 处理 Prompt 动作
async function handlePromptAction(action, prompt) {
  switch (action) {
    case 'favorite':
      const isFavorite = await StorageManager.toggleFavorite(prompt.id);
      await loadPrompts();
      showToast(isFavorite ? '已添加到收藏' : '已取消收藏');
      // 更新预览模态框中的收藏按钮状态
      updatePreviewFavoriteButton(prompt.id, isFavorite);
      break;
    case 'edit':
      openEditModal(prompt);
      break;
    case 'preview':
      openPreviewModal(prompt);
      break;
    case 'delete':
      if (confirm(`确定要删除 "${prompt.name}" 吗？`)) {
        await StorageManager.deletePrompt(prompt.id);
        await loadPrompts();
        showToast('已删除');
      }
      break;
  }
}

// 打开编辑 Modal
function openEditModal(prompt = null) {
  editingPromptId = prompt?.id || null;
  elements.modalTitle.textContent = prompt ? '编辑 Prompt' : '添加 Prompt';
  
  if (prompt) {
    elements.editName.value = prompt.name;
    elements.editCategory.value = prompt.category;
    elements.editContent.value = prompt.content;
    elements.editTags.value = (prompt.tags || []).join(', ');
  } else {
    elements.editName.value = '';
    elements.editCategory.value = currentCategories[0]?.id || 'general';
    elements.editContent.value = '';
    elements.editTags.value = '';
  }
  
  elements.editModal.classList.remove('hidden');
  elements.editName.focus();
}

// 关闭编辑 Modal
function closeEditModal() {
  elements.editModal.classList.add('hidden');
  editingPromptId = null;
}

// 保存 Prompt
async function savePrompt() {
  const name = elements.editName.value.trim();
  const content = elements.editContent.value.trim();
  
  if (!name) {
    showToast('请输入名称', 'error');
    elements.editName.focus();
    return;
  }
  
  if (!content) {
    showToast('请输入内容', 'error');
    elements.editContent.focus();
    return;
  }
  
  const data = {
    name,
    content,
    category: elements.editCategory.value,
    tags: elements.editTags.value.split(/[,，]/).map(t => t.trim()).filter(Boolean)
  };
  
  try {
    if (editingPromptId) {
      await StorageManager.updatePrompt(editingPromptId, data);
      showToast('已保存');
    } else {
      await StorageManager.addPrompt(data);
      showToast('已添加');
    }
    
    closeEditModal();
    await loadPrompts();
  } catch (err) {
    showToast('保存失败：' + err.message, 'error');
  }
}

// 打开预览 Modal
function openPreviewModal(prompt) {
  previewPromptId = prompt.id;
  elements.previewTitle.textContent = prompt.name;
  elements.previewContent.textContent = prompt.content;
  
  // 更新收藏按钮状态
  const favoriteBtn = document.getElementById('btn-preview-favorite');
  if (favoriteBtn) {
    favoriteBtn.classList.toggle('active', prompt.favorite);
    favoriteBtn.querySelector('svg').setAttribute('fill', prompt.favorite ? 'currentColor' : 'none');
  }
  
  elements.previewModal.classList.remove('hidden');
}

// 更新预览模态框中的收藏按钮状态
function updatePreviewFavoriteButton(promptId, isFavorite) {
  if (previewPromptId === promptId) {
    const favoriteBtn = document.getElementById('btn-preview-favorite');
    if (favoriteBtn) {
      favoriteBtn.classList.toggle('active', isFavorite);
      favoriteBtn.querySelector('svg').setAttribute('fill', isFavorite ? 'currentColor' : 'none');
    }
  }
}

// 关闭所有 Modal
function closeAllModals() {
  elements.editModal.classList.add('hidden');
  elements.previewModal.classList.add('hidden');
  editingPromptId = null;
  previewPromptId = null;
}

// 预览模态框中切换收藏
async function togglePreviewFavorite() {
  const prompt = currentPrompts.find(p => p.id === previewPromptId);
  if (!prompt) return;
  
  const isFavorite = await StorageManager.toggleFavorite(prompt.id);
  prompt.favorite = isFavorite; // 更新本地数据
  
  // 更新按钮状态
  updatePreviewFavoriteButton(prompt.id, isFavorite);
  
  // 刷新列表
  await loadPrompts();
  
  showToast(isFavorite ? '已添加到收藏' : '已取消收藏');
}

// 复制预览内容到剪贴板
async function copyPreviewToClipboard() {
  const prompt = currentPrompts.find(p => p.id === previewPromptId);
  if (!prompt) return;
  
  try {
    await navigator.clipboard.writeText(prompt.content);
    // 增加使用次数
    await StorageManager.incrementUseCount(prompt.id);
    showToast('已复制到剪贴板');
  } catch (err) {
    showToast('复制失败', 'error');
  }
}

// 插入预览内容到页面
async function insertPreviewToPage() {
  const prompt = currentPrompts.find(p => p.id === previewPromptId);
  if (!prompt) return;
  
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'INSERT_PROMPT',
      prompt: prompt
    });
    
    if (response.success) {
      if (response.mode === 'clipboard') {
        showToast(response.message || '已复制到剪贴板');
      } else {
        showToast('已插入到输入框');
        closeAllModals();
      }
      await loadPrompts();
    } else {
      showToast(response.error || '插入失败', 'error');
    }
  } catch (err) {
    showToast('插入失败，请复制后手动粘贴', 'error');
  }
}

// 更新统计信息
function updateStats() {
  const total = currentPrompts.length;
  const searchValue = elements.searchInput.value.trim();
  
  if (searchValue) {
    elements.statsText.textContent = `找到 ${total} 个结果`;
  } else {
    StorageManager.getPrompts().then(all => {
      elements.statsText.textContent = `共 ${all.length} 个 Prompt`;
    });
  }
}

// 显示 Toast
function showToast(message, type = 'success') {
  elements.toastMessage.textContent = message;
  elements.toast.classList.remove('hidden');
  
  if (type === 'error') {
    elements.toast.style.background = 'var(--danger)';
  } else {
    elements.toast.style.background = 'var(--text-primary)';
  }
  
  setTimeout(() => {
    elements.toast.classList.add('hidden');
  }, 2500);
}

// 工具函数：防抖
function debounce(fn, delay) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// 工具函数：切换 class
function toggleClass(el, className, condition) {
  el.classList.toggle(className, condition);
}

// 工具函数：HTML 转义
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 工具函数：获取 Prompt 图标（emoji）
function getPromptIcon(name) {
  // 从名称中提取 emoji
  const emojiMatch = name.match(/[\u{1F300}-\u{1F9FF}]/u);
  if (emojiMatch) return emojiMatch[0];
  
  // 根据关键词返回 emoji
  const keywords = {
    '代码': '💻',
    '编程': '💻',
    'code': '💻',
    '写': '✍️',
    '写作': '✍️',
    '翻译': '🌐',
    '译': '🌐',
    '总结': '📝',
    '概括': '📝',
    '解释': '💡',
    '说明': '💡',
    '优化': '🔧',
    '改进': '🔧',
    '分析': '📊',
    '分析': '📈',
    '邮件': '📧',
    'email': '📧',
    '测试': '🧪',
    'debug': '🐛',
    '调试': '🐛',
    '创意': '✨',
    '想法': '💭',
    '学习': '📚',
    '知识': '🎓',
    '问': '❓',
    '答': '💬'
  };
  
  for (const [kw, emoji] of Object.entries(keywords)) {
    if (name.toLowerCase().includes(kw)) return emoji;
  }
  
  return '📄';
}
