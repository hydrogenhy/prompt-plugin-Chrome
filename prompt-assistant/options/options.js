/**
 * Options Page Script
 * 处理设置页面的交互逻辑
 */

// 全局状态
let currentPrompts = [];
let currentCategories = [];
let editingPromptId = null;
let pendingImportData = null;

// DOM 元素缓存
const elements = {};

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  cacheElements();
  bindEvents();
  await loadCategories();
  await loadPrompts();
  await loadSettings();
  
  // 默认显示 prompts 页面
  showSection('prompts');
});

// 缓存 DOM 元素
function cacheElements() {
  // Navigation
  elements.navItems = document.querySelectorAll('.nav-item');
  elements.sections = document.querySelectorAll('.section');
  
  // Prompts
  elements.promptsSearch = document.getElementById('prompts-search');
  elements.promptsCategoryFilter = document.getElementById('prompts-category-filter');
  elements.promptsSort = document.getElementById('prompts-sort');
  elements.promptsTbody = document.getElementById('prompts-tbody');
  elements.promptsEmpty = document.getElementById('prompts-empty');
  
  // Import/Export
  elements.importFile = document.getElementById('import-file');
  elements.importPreview = document.getElementById('import-preview');
  elements.importPreviewContent = document.getElementById('import-preview-content');
  
  // Settings
  elements.settingInsertMode = document.getElementById('setting-insert-mode');
  elements.settingAutoFocus = document.getElementById('setting-auto-focus');
  elements.settingShowCategories = document.getElementById('setting-show-categories');
  elements.categoryList = document.getElementById('category-list');
  
  // Modals
  elements.promptModal = document.getElementById('prompt-modal');
  elements.batchModal = document.getElementById('batch-modal');
  elements.categoryModal = document.getElementById('category-modal');
  
  // Toast
  elements.toast = document.getElementById('toast');
  elements.toastMessage = document.getElementById('toast-message');
}

// 绑定事件
function bindEvents() {
  // Navigation
  elements.navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const section = item.dataset.section;
      showSection(section);
      
      elements.navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');
    });
  });
  
  // Prompts filters
  elements.promptsSearch.addEventListener('input', debounce(loadPrompts, 300));
  elements.promptsCategoryFilter.addEventListener('change', loadPrompts);
  elements.promptsSort.addEventListener('change', loadPrompts);
  
  // Add buttons
  document.getElementById('btn-add-prompt').addEventListener('click', () => openPromptModal());
  document.getElementById('btn-batch-import').addEventListener('click', () => openBatchModal());
  
  // Export/Import
  document.getElementById('btn-export').addEventListener('click', exportData);
  elements.importFile.addEventListener('change', handleImportFile);
  document.getElementById('btn-cancel-import').addEventListener('click', cancelImport);
  document.getElementById('btn-confirm-import').addEventListener('click', confirmImport);
  
  // Settings
  elements.settingInsertMode.addEventListener('change', saveSettings);
  elements.settingAutoFocus.addEventListener('change', saveSettings);
  elements.settingShowCategories.addEventListener('change', saveSettings);
  document.getElementById('btn-clear-all').addEventListener('click', clearAllData);
  document.getElementById('btn-shortcut-settings').addEventListener('click', openShortcutSettings);
  
  // Category Management
  document.getElementById('btn-add-category').addEventListener('click', openCategoryModal);
  document.getElementById('category-btn-cancel').addEventListener('click', closeCategoryModal);
  document.getElementById('category-btn-save').addEventListener('click', saveCategory);
  
  // Color picker sync
  const colorPicker = document.getElementById('category-color');
  const colorText = document.getElementById('category-color-text');
  colorPicker.addEventListener('input', () => colorText.value = colorPicker.value);
  colorText.addEventListener('input', () => colorPicker.value = colorText.value);
  
  // Modal buttons
  document.getElementById('prompt-btn-cancel').addEventListener('click', closePromptModal);
  document.getElementById('prompt-btn-save').addEventListener('click', savePrompt);
  document.getElementById('batch-btn-cancel').addEventListener('click', closeBatchModal);
  document.getElementById('batch-btn-import').addEventListener('click', importBatch);
  
  // Modal close buttons
  document.querySelectorAll('.modal-close, .modal-overlay').forEach(el => {
    el.addEventListener('click', closeAllModals);
  });
}

// 显示指定 section
async function showSection(sectionId) {
  elements.sections.forEach(s => s.classList.remove('active'));
  document.getElementById(`section-${sectionId}`).classList.add('active');
  
  // 如果切换到分类管理页面，加载分类列表
  if (sectionId === 'categories') {
    await loadCategoryList();
  }
}

// 加载分类
async function loadCategories() {
  currentCategories = await StorageManager.getCategories();
  
  // 更新分类过滤器
  const options = ['<option value="all">全部分类</option>'];
  currentCategories.forEach(cat => {
    options.push(`<option value="${cat.id}">${cat.name}</option>`);
  });
  elements.promptsCategoryFilter.innerHTML = options.join('');
}

// 加载 Prompts
async function loadPrompts() {
  const options = {
    category: elements.promptsCategoryFilter.value,
    sortBy: elements.promptsSort.value,
    sortOrder: elements.promptsSort.value === 'name' ? 'asc' : 'desc'
  };
  
  currentPrompts = await StorageManager.searchPrompts(
    elements.promptsSearch.value,
    options
  );
  
  renderPromptsTable();
}

// 渲染 Prompts 表格
function renderPromptsTable() {
  if (currentPrompts.length === 0) {
    elements.promptsTbody.innerHTML = '';
    elements.promptsEmpty.classList.remove('hidden');
    return;
  }
  
  elements.promptsEmpty.classList.add('hidden');
  
  elements.promptsTbody.innerHTML = currentPrompts.map(prompt => {
    const category = currentCategories.find(c => c.id === prompt.category);
    const tags = (prompt.tags || []).slice(0, 3);
    
    return `
      <tr data-id="${prompt.id}">
        <td class="col-favorite">
          <button class="favorite-btn ${prompt.favorite ? 'active' : ''}" data-action="favorite" data-id="${prompt.id}">
            <svg viewBox="0 0 24 24" fill="${prompt.favorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </button>
        </td>
        <td class="col-name">
          <div class="cell-name">${escapeHtml(prompt.name)}</div>
          <div class="cell-content">${escapeHtml(prompt.content.substring(0, 60))}${prompt.content.length > 60 ? '...' : ''}</div>
        </td>
        <td class="col-category">
          ${category ? `
            <span class="category-badge" style="background: ${category.color}20; color: ${category.color}">
              <span class="category-dot" style="background: ${category.color}"></span>
              ${category.name}
            </span>
          ` : '-'}
        </td>
        <td class="col-tags">
          <div class="tags-list">
            ${tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
            ${(prompt.tags || []).length > 3 ? `<span class="tag">+${prompt.tags.length - 3}</span>` : ''}
          </div>
        </td>
        <td class="col-stats">
          <div>使用 ${prompt.useCount || 0} 次</div>
          <div>${formatDate(prompt.updatedAt)}</div>
        </td>
        <td class="col-actions">
          <button class="btn-icon" data-action="edit" data-id="${prompt.id}" title="编辑">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="btn-icon danger" data-action="delete" data-id="${prompt.id}" title="删除">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </td>
      </tr>
    `;
  }).join('');
  
  // 绑定事件（替代 inline onclick）
  bindPromptTableEvents();
}

// 绑定 Prompt 表格事件
function bindPromptTableEvents() {
  elements.promptsTbody.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      const prompt = currentPrompts.find(p => p.id === id);
      
      if (!prompt) return;
      
      switch (action) {
        case 'favorite':
          toggleFavorite(id);
          break;
        case 'edit':
          openPromptModal(prompt);
          break;
        case 'delete':
          deletePrompt(id);
          break;
      }
    });
  });
}

// 切换收藏状态
async function toggleFavorite(id) {
  await StorageManager.toggleFavorite(id);
  await loadPrompts();
}

// 编辑 Prompt
function editPrompt(id) {
  const prompt = currentPrompts.find(p => p.id === id);
  if (prompt) {
    openPromptModal(prompt);
  }
}

// 删除 Prompt
async function deletePrompt(id) {
  const prompt = currentPrompts.find(p => p.id === id);
  if (!prompt) return;
  
  if (confirm(`确定要删除 "${prompt.name}" 吗？`)) {
    await StorageManager.deletePrompt(id);
    await loadPrompts();
    showToast('已删除');
  }
}

// 打开 Prompt 编辑 Modal
function openPromptModal(prompt = null) {
  editingPromptId = prompt?.id || null;
  document.getElementById('prompt-modal-title').textContent = prompt ? '编辑 Prompt' : '添加 Prompt';
  
  document.getElementById('prompt-edit-name').value = prompt?.name || '';
  document.getElementById('prompt-edit-category').innerHTML = currentCategories.map(cat => 
    `<option value="${cat.id}" ${prompt?.category === cat.id ? 'selected' : ''}>${cat.name}</option>`
  ).join('');
  document.getElementById('prompt-edit-content').value = prompt?.content || '';
  document.getElementById('prompt-edit-tags').value = (prompt?.tags || []).join(', ');
  
  elements.promptModal.classList.remove('hidden');
  document.getElementById('prompt-edit-name').focus();
}

// 关闭 Prompt Modal
function closePromptModal() {
  elements.promptModal.classList.add('hidden');
  editingPromptId = null;
}

// 保存 Prompt
async function savePrompt() {
  const name = document.getElementById('prompt-edit-name').value.trim();
  const content = document.getElementById('prompt-edit-content').value.trim();
  
  if (!name) {
    showToast('请输入名称', 'error');
    return;
  }
  
  if (!content) {
    showToast('请输入内容', 'error');
    return;
  }
  
  const data = {
    name,
    content,
    category: document.getElementById('prompt-edit-category').value,
    tags: document.getElementById('prompt-edit-tags').value.split(/[,，]/).map(t => t.trim()).filter(Boolean)
  };
  
  try {
    if (editingPromptId) {
      await StorageManager.updatePrompt(editingPromptId, data);
      showToast('已保存');
    } else {
      await StorageManager.addPrompt(data);
      showToast('已添加');
    }
    
    closePromptModal();
    await loadPrompts();
  } catch (err) {
    showToast('保存失败：' + err.message, 'error');
  }
}

// ========== 导入/导出 ==========

// 导出数据
async function exportData() {
  const data = await StorageManager.exportData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `prompt-assistant-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  
  URL.revokeObjectURL(url);
  showToast('导出成功');
}

// 处理导入文件
async function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    
    // 验证数据格式
    if (!data.prompts || !Array.isArray(data.prompts)) {
      throw new Error('无效的数据格式');
    }
    
    pendingImportData = data;
    
    // 显示预览
    const importMode = document.querySelector('input[name="import-mode"]:checked').value;
    const existingPrompts = await StorageManager.getPrompts();
    
    elements.importPreviewContent.innerHTML = `
      <div class="import-summary">
        <div class="import-stat">
          <div class="number">${data.prompts.length}</div>
          <div class="label">Prompts</div>
        </div>
        <div class="import-stat">
          <div class="number">${(data.categories || []).length}</div>
          <div class="label">分类</div>
        </div>
        <div class="import-stat">
          <div class="number">${importMode === 'merge' ? existingPrompts.length + data.prompts.length : data.prompts.length}</div>
          <div class="label">导入后总数</div>
        </div>
      </div>
      <div class="import-list">
        ${data.prompts.slice(0, 5).map(p => `
          <div class="import-item">
            <span class="status success">✓</span>
            <span>${escapeHtml(p.name)}</span>
          </div>
        `).join('')}
        ${data.prompts.length > 5 ? `<div class="import-item">...还有 ${data.prompts.length - 5} 个</div>` : ''}
      </div>
    `;
    
    elements.importPreview.classList.remove('hidden');
  } catch (err) {
    showToast('导入失败：' + err.message, 'error');
  }
  
  // 清空文件 input
  e.target.value = '';
}

// 取消导入
function cancelImport() {
  pendingImportData = null;
  elements.importPreview.classList.add('hidden');
}

// 确认导入
async function confirmImport() {
  if (!pendingImportData) return;
  
  const importMode = document.querySelector('input[name="import-mode"]:checked').value;
  
  try {
    if (importMode === 'replace') {
      await StorageManager.clearAll();
    }
    
    await StorageManager.importData(pendingImportData);
    
    showToast('导入成功');
    cancelImport();
    await loadCategories();
    await loadPrompts();
  } catch (err) {
    showToast('导入失败：' + err.message, 'error');
  }
}

// 打开批量导入 Modal
function openBatchModal() {
  elements.batchModal.classList.remove('hidden');
  document.getElementById('batch-input').value = '';
}

// 关闭批量导入 Modal
function closeBatchModal() {
  elements.batchModal.classList.add('hidden');
}

// 批量导入
async function importBatch() {
  const input = document.getElementById('batch-input').value.trim();
  if (!input) {
    showToast('请输入内容', 'error');
    return;
  }
  
  const prompts = [];
  const blocks = input.split(/\n---\n/);
  
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length === 0) continue;
    
    // 单行格式: 名称 | 内容
    if (block.includes('|') && !block.includes('\n')) {
      const [name, ...contentParts] = block.split('|');
      prompts.push({
        name: name.trim(),
        content: contentParts.join('|').trim()
      });
    }
    // 多行格式: 第一行是名称，后面是内容
    else {
      const name = lines[0].trim();
      const content = lines.slice(1).join('\n').trim();
      if (name && content) {
        prompts.push({ name, content });
      }
    }
  }
  
  if (prompts.length === 0) {
    showToast('未识别到有效的 Prompt', 'error');
    return;
  }
  
  for (const prompt of prompts) {
    await StorageManager.addPrompt(prompt);
  }
  
  showToast(`成功导入 ${prompts.length} 个 Prompt`);
  closeBatchModal();
  await loadPrompts();
}

// ========== 设置 ==========

// 加载设置
async function loadSettings() {
  const settings = await StorageManager.getSettings();
  elements.settingInsertMode.value = settings.insertMode;
  elements.settingAutoFocus.checked = settings.autoFocus;
  elements.settingShowCategories.checked = settings.showCategories;
  
  // 加载当前快捷键
  await loadCurrentShortcut();
}

// 加载当前快捷键
async function loadCurrentShortcut() {
  try {
    const commands = await chrome.commands.getAll();
    const command = commands.find(cmd => cmd.name === '_execute_action');
    if (command && command.shortcut) {
      const shortcutDisplay = document.getElementById('shortcut-display');
      shortcutDisplay.textContent = `当前快捷键: ${formatShortcut(command.shortcut)}`;
    }
  } catch (err) {
    console.error('Failed to load shortcut:', err);
  }
}

// 格式化快捷键显示
function formatShortcut(shortcut) {
  return shortcut
    .replace(/Alt/g, 'Alt')
    .replace(/Ctrl/g, 'Ctrl')
    .replace(/Command/g, '⌘')
    .replace(/Shift/g, 'Shift')
    .replace(/\+/g, ' + ');
}

// 打开 Chrome 快捷键设置页面
function openShortcutSettings() {
  chrome.tabs.create({
    url: 'chrome://extensions/shortcuts'
  });
}

// 保存设置
async function saveSettings() {
  await StorageManager.setSettings({
    insertMode: elements.settingInsertMode.value,
    autoFocus: elements.settingAutoFocus.checked,
    showCategories: elements.settingShowCategories.checked
  });
  showToast('设置已保存');
}

// 清空所有数据
async function clearAllData() {
  if (confirm('⚠️ 警告：确定要清除所有数据吗？此操作不可恢复！')) {
    if (confirm('再次确认：你将丢失所有 Prompt 和分类，确定继续吗？')) {
      await StorageManager.clearAll();
      await loadCategories();
      await loadPrompts();
      showToast('所有数据已清除');
    }
  }
}

// ========== 分类管理 ==========

// 加载分类列表
async function loadCategoryList() {
  if (!elements.categoryList) return;
  
  const categories = await StorageManager.getCategories();
  const prompts = await StorageManager.getPrompts();
  
  elements.categoryList.innerHTML = categories.map(cat => {
    const count = prompts.filter(p => p.category === cat.id).length;
    return `
      <div class="category-item">
        <div class="category-item-info">
          <span class="category-item-dot" style="background: ${cat.color}"></span>
          <span class="category-item-name">${escapeHtml(cat.name)}</span>
          <span class="category-item-count">(${count} 个 Prompt)</span>
        </div>
        <button class="category-item-delete" data-id="${cat.id}" title="删除分类">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    `;
  }).join('');
  
  // 绑定删除按钮事件
  elements.categoryList.querySelectorAll('.category-item-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteCategory(btn.dataset.id));
  });
}

// 打开分类模态框
function openCategoryModal() {
  document.getElementById('category-name').value = '';
  document.getElementById('category-color').value = '#6366f1';
  document.getElementById('category-color-text').value = '#6366f1';
  elements.categoryModal.classList.remove('hidden');
  document.getElementById('category-name').focus();
}

// 关闭分类模态框
function closeCategoryModal() {
  elements.categoryModal.classList.add('hidden');
}

// 保存分类
async function saveCategory() {
  const name = document.getElementById('category-name').value.trim();
  const color = document.getElementById('category-color').value;
  
  if (!name) {
    showToast('请输入分类名称', 'error');
    return;
  }
  
  try {
    await StorageManager.addCategory({ name, color });
    showToast('分类已添加');
    closeCategoryModal();
    
    // 刷新分类列表和相关下拉框
    await loadCategoryList();
    await loadCategories();
    await loadPrompts();
  } catch (err) {
    showToast('添加失败：' + err.message, 'error');
  }
}

// 删除分类
async function deleteCategory(id) {
  const categories = await StorageManager.getCategories();
  const category = categories.find(c => c.id === id);
  if (!category) return;
  
  // 检查该分类下有多少 Prompt
  const prompts = await StorageManager.getPrompts();
  const count = prompts.filter(p => p.category === id).length;
  
  if (count === 0) {
    // 没有 Prompt，直接删除
    if (confirm(`确定要删除分类 "${category.name}" 吗？`)) {
      await StorageManager.deleteCategory(id);
      showToast('分类已删除');
      await loadCategoryList();
      await loadCategories();
    }
  } else {
    // 有 Prompt，弹出警告
    const confirmed = confirm(
      `⚠️ 警告：当前分类 "${category.name}" 下有 ${count} 个 Prompt。\n\n` +
      `若删除此分类，该分类下所有 Prompt 都将被删除。\n\n` +
      `点击「确定」删除分类及其所有 Prompt，点击「取消」保持不变。`
    );
    
    if (confirmed) {
      // 删除该分类下的所有 Prompt
      const remainingPrompts = prompts.filter(p => p.category !== id);
      await StorageManager.setPrompts(remainingPrompts);
      
      // 删除分类
      await StorageManager.deleteCategory(id);
      
      showToast('分类及其 Prompt 已删除');
      await loadCategoryList();
      await loadCategories();
      await loadPrompts();
    }
  }
}

// 关闭所有 Modal
function closeAllModals() {
  elements.promptModal.classList.add('hidden');
  elements.batchModal.classList.add('hidden');
  elements.categoryModal.classList.add('hidden');
  editingPromptId = null;
}

// 显示 Toast
function showToast(message, type = 'success') {
  elements.toastMessage.textContent = message;
  elements.toast.classList.remove('hidden');
  elements.toast.style.background = type === 'error' ? 'var(--danger)' : 'var(--text-primary)';
  
  setTimeout(() => {
    elements.toast.classList.add('hidden');
  }, 3000);
}

// 工具函数：防抖
function debounce(fn, delay) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// 工具函数：HTML 转义
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 工具函数：格式化日期
function formatDate(timestamp) {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
