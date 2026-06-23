/* ========================================
   storage.js — Import / Export
   Depends on: state.js
   Notifies app.js via callback after import.
======================================== */

import { App, saveState, saveStateNow, getTodayKey } from './state.js';

/* Callback set by app.js */
let _onImportSuccess = null;
let _showToast = null;

export function setStorageCallbacks({ onImportSuccess, showToast }) {
  _onImportSuccess = onImportSuccess;
  _showToast = showToast;
}

/* ========================================
   EXPORT
======================================== */

export function exportData() {
  try {
    const exportObj = { tasks: App.state.tasks, history: App.state.history };
    const json = JSON.stringify(exportObj, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jinrishijibi_${getTodayKey()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    _showToast?.('数据已导出 \u2705');
  } catch (e) {
    _showToast?.('导出失败：' + e.message);
  }
}

/* ========================================
   IMPORT
======================================== */

/**
 * Validate a single task object has all required fields with correct types.
 * Returns { valid: boolean, reason: string }.
 */
function validateTask(task, dateKey, index) {
  if (!task || typeof task !== 'object') {
    return { valid: false, reason: `${dateKey}[${index}] 不是有效对象` };
  }
  if (typeof task.id !== 'string' || !task.id) {
    return { valid: false, reason: `${dateKey}[${index}] 缺少有效 id` };
  }
  if (typeof task.title !== 'string' || !task.title.trim()) {
    return { valid: false, reason: `"${task.id}" 缺少有效标题` };
  }
  if (!['work', 'life'].includes(task.category)) {
    return { valid: false, reason: `"${task.title}" 分类无效（应为 work/life）` };
  }
  if (!['urgent', 'routine'].includes(task.priority)) {
    return { valid: false, reason: `"${task.title}" 优先级无效（应为 urgent/routine）` };
  }
  if (typeof task.completed !== 'boolean') {
    return { valid: false, reason: `"${task.title}" completed 字段不是布尔值` };
  }
  return { valid: true };
}

export function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onerror = () => {
    _showToast?.('导入失败：无法读取文件');
    event.target.value = '';
  };
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);

      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('文件格式不正确：顶层必须是对象');
      }
      if (!data.tasks || typeof data.tasks !== 'object' || Array.isArray(data.tasks)) {
        throw new Error('文件缺少 tasks 字段或格式不正确');
      }
      if (!data.history || typeof data.history !== 'object' || Array.isArray(data.history)) {
        throw new Error('文件缺少 history 字段或格式不正确');
      }

      // Validate every task in the import
      let invalidCount = 0;
      const firstError = { dateKey: '', reason: '' };
      for (const [dateKey, tasks] of Object.entries(data.tasks)) {
        if (!Array.isArray(tasks)) {
          invalidCount++;
          if (!firstError.reason) firstError.reason = `${dateKey} 不是数组`;
          continue;
        }
        for (let i = 0; i < tasks.length; i++) {
          const result = validateTask(tasks[i], dateKey, i);
          if (!result.valid) {
            invalidCount++;
            if (!firstError.reason) firstError.reason = result.reason;
          }
        }
      }
      if (invalidCount > 0) {
        throw new Error(`${invalidCount} 个任务格式不正确（例：${firstError.reason}）`);
      }

      App.state.tasks = data.tasks;
      App.state.history = data.history;
      saveStateNow();
      _onImportSuccess?.();
      _showToast?.('数据导入成功 \u2705');
    } catch (e) {
      _showToast?.('导入失败：' + e.message);
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsText(file);
}
