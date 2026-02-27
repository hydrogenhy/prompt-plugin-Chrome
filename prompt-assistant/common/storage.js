/**
 * Storage Manager - 管理 Prompt 数据的存储和读取
 */

const StorageKeys = {
  PROMPTS: 'prompts',
  CATEGORIES: 'categories',
  SETTINGS: 'settings'
};

const DEFAULT_SETTINGS = {
  insertMode: 'append', // 'append' | 'replace'
  showCategories: true,
  autoFocus: true,
  theme: 'auto' // 'auto' | 'light' | 'dark'
};

const DEFAULT_CATEGORIES = [
  { id: 'general', name: '通用', color: '#6366f1' },
  { id: 'coding', name: '编程', color: '#10b981' },
  { id: 'writing', name: '写作', color: '#f59e0b' },
  { id: 'translation', name: '翻译', color: '#3b82f6' },
  { id: 'analysis', name: '分析', color: '#8b5cf6' },
  { id: 'creative', name: '创意', color: '#ec4899' }
];

class StorageManager {
  /**
   * 获取所有 Prompts
   */
  static async getPrompts() {
    const result = await chrome.storage.local.get(StorageKeys.PROMPTS);
    return result[StorageKeys.PROMPTS] || [];
  }

  /**
   * 保存所有 Prompts
   */
  static async setPrompts(prompts) {
    await chrome.storage.local.set({ [StorageKeys.PROMPTS]: prompts });
  }

  /**
   * 添加单个 Prompt
   */
  static async addPrompt(prompt) {
    const prompts = await this.getPrompts();
    const newPrompt = {
      id: this.generateId(),
      name: prompt.name,
      content: prompt.content,
      category: prompt.category || 'general',
      tags: prompt.tags || [],
      favorite: false,
      useCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    prompts.unshift(newPrompt);
    await this.setPrompts(prompts);
    return newPrompt;
  }

  /**
   * 更新 Prompt
   */
  static async updatePrompt(id, updates) {
    const prompts = await this.getPrompts();
    const index = prompts.findIndex(p => p.id === id);
    if (index === -1) return null;
    
    prompts[index] = {
      ...prompts[index],
      ...updates,
      updatedAt: Date.now()
    };
    await this.setPrompts(prompts);
    return prompts[index];
  }

  /**
   * 删除 Prompt
   */
  static async deletePrompt(id) {
    const prompts = await this.getPrompts();
    const filtered = prompts.filter(p => p.id !== id);
    await this.setPrompts(filtered);
    return filtered.length < prompts.length;
  }

  /**
   * 获取单个 Prompt
   */
  static async getPrompt(id) {
    const prompts = await this.getPrompts();
    return prompts.find(p => p.id === id) || null;
  }

  /**
   * 增加使用次数
   */
  static async incrementUseCount(id) {
    const prompts = await this.getPrompts();
    const index = prompts.findIndex(p => p.id === id);
    if (index !== -1) {
      prompts[index].useCount = (prompts[index].useCount || 0) + 1;
      prompts[index].lastUsedAt = Date.now();
      await this.setPrompts(prompts);
    }
  }

  /**
   * 切换收藏状态
   */
  static async toggleFavorite(id) {
    const prompts = await this.getPrompts();
    const index = prompts.findIndex(p => p.id === id);
    if (index !== -1) {
      prompts[index].favorite = !prompts[index].favorite;
      await this.setPrompts(prompts);
      return prompts[index].favorite;
    }
    return null;
  }

  /**
   * 搜索 Prompts
   */
  static async searchPrompts(query, options = {}) {
    let prompts = await this.getPrompts();
    
    // 按分类过滤
    if (options.category && options.category !== 'all') {
      prompts = prompts.filter(p => p.category === options.category);
    }
    
    // 只显示收藏
    if (options.favoritesOnly) {
      prompts = prompts.filter(p => p.favorite);
    }
    
    // 搜索过滤
    if (query && query.trim()) {
      const keywords = query.toLowerCase().trim().split(/\s+/);
      prompts = prompts.filter(p => {
        const text = `${p.name} ${p.content} ${(p.tags || []).join(' ')}`.toLowerCase();
        return keywords.every(kw => text.includes(kw));
      });
    }
    
    // 排序
    const sortBy = options.sortBy || 'updatedAt';
    const sortOrder = options.sortOrder || 'desc';
    prompts.sort((a, b) => {
      let valA = a[sortBy] || 0;
      let valB = b[sortBy] || 0;
      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }
      if (sortOrder === 'desc') {
        return valA > valB ? -1 : valA < valB ? 1 : 0;
      }
      return valA < valB ? -1 : valA > valB ? 1 : 0;
    });
    
    return prompts;
  }

  /**
   * 获取分类列表
   */
  static async getCategories() {
    const result = await chrome.storage.local.get(StorageKeys.CATEGORIES);
    return result[StorageKeys.CATEGORIES] || DEFAULT_CATEGORIES;
  }

  /**
   * 保存分类
   */
  static async setCategories(categories) {
    await chrome.storage.local.set({ [StorageKeys.CATEGORIES]: categories });
  }

  /**
   * 添加分类
   */
  static async addCategory(category) {
    const categories = await this.getCategories();
    const newCategory = {
      id: this.generateId(),
      name: category.name,
      color: category.color || '#6366f1'
    };
    categories.push(newCategory);
    await this.setCategories(categories);
    return newCategory;
  }

  /**
   * 删除分类
   */
  static async deleteCategory(id) {
    const categories = await this.getCategories();
    const filtered = categories.filter(c => c.id !== id);
    await this.setCategories(filtered);
    
    // 将该分类下的 prompt 移到默认分类
    const prompts = await this.getPrompts();
    prompts.forEach(p => {
      if (p.category === id) {
        p.category = 'general';
      }
    });
    await this.setPrompts(prompts);
    
    return filtered.length < categories.length;
  }

  /**
   * 获取设置
   */
  static async getSettings() {
    const result = await chrome.storage.local.get(StorageKeys.SETTINGS);
    return { ...DEFAULT_SETTINGS, ...result[StorageKeys.SETTINGS] };
  }

  /**
   * 保存设置
   */
  static async setSettings(settings) {
    const current = await this.getSettings();
    await chrome.storage.local.set({
      [StorageKeys.SETTINGS]: { ...current, ...settings }
    });
  }

  /**
   * 导入数据（统一格式：只包含必要字段）
   */
  static async importData(data) {
    // 处理分类导入
    if (data.categories) {
      const existingCategories = await this.getCategories();
      const categoryMap = {}; // 用于映射外部分类名到内部ID
      
      // 为导入的分类创建新的 ID
      const importedCategories = data.categories.map(c => {
        const existing = existingCategories.find(ec => ec.name === c.name);
        const id = existing ? existing.id : this.generateId();
        categoryMap[c.name] = id;
        return {
          id,
          name: c.name.trim(),
          color: c.color || '#6366f1'
        };
      });
      
      // 合并现有分类和导入分类（去重）
      const mergedCategories = [...existingCategories];
      importedCategories.forEach(ic => {
        if (!mergedCategories.some(c => c.id === ic.id)) {
          mergedCategories.push(ic);
        }
      });
      await this.setCategories(mergedCategories);
    }
    
    // 处理 prompts 导入
    if (data.prompts) {
      const existingPrompts = await this.getPrompts();
      const categories = await this.getCategories();
      
      const validPrompts = data.prompts.filter(p => p.name && p.content).map(p => {
        // 查找或创建分类
        let categoryId = p.category;
        const categoryExists = categories.some(c => c.id === categoryId);
        if (!categoryExists) {
          // 尝试通过名称查找分类
          const categoryByName = categories.find(c => c.name === p.category);
          categoryId = categoryByName ? categoryByName.id : 'general';
        }
        
        return {
          id: this.generateId(),
          name: p.name.trim(),
          content: p.content.trim(),
          category: categoryId,
          tags: Array.isArray(p.tags) ? p.tags : [],
          favorite: !!p.favorite,
          useCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
      });
      
      // 合并（追加到现有 prompts 后面）
      const mergedPrompts = [...existingPrompts, ...validPrompts];
      await this.setPrompts(mergedPrompts);
    }
    
    return {
      promptsCount: data.prompts?.length || 0,
      categoriesCount: data.categories?.length || 0
    };
  }

  /**
   * 导出数据（统一格式：只包含必要字段）
   */
  static async exportData() {
    const prompts = await this.getPrompts();
    const categories = await this.getCategories();
    
    // 导出分类名称和颜色（不包含ID）
    const categoryMap = {};
    prompts.forEach(p => {
      const cat = categories.find(c => c.id === p.category);
      if (cat) {
        categoryMap[p.category] = { name: cat.name, color: cat.color };
      }
    });
    
    // 只导出必要字段，category 使用名称而非 ID
    const simplifiedPrompts = prompts.map(p => {
      const cat = categories.find(c => c.id === p.category);
      return {
        name: p.name,
        content: p.content,
        category: cat ? cat.name : p.category, // 使用分类名称
        tags: p.tags || [],
        favorite: p.favorite
      };
    });
    
    const simplifiedCategories = Object.values(categoryMap);
    
    return {
      prompts: simplifiedPrompts,
      categories: simplifiedCategories
    };
  }

  /**
   * 生成唯一 ID
   */
  static generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  /**
   * 清空所有数据
   */
  static async clearAll() {
    await chrome.storage.local.remove([
      StorageKeys.PROMPTS,
      StorageKeys.CATEGORIES,
      StorageKeys.SETTINGS
    ]);
  }
}

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { StorageManager, StorageKeys, DEFAULT_SETTINGS, DEFAULT_CATEGORIES };
}
