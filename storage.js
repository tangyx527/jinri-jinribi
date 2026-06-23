/* ========================================
   storage.js — Import / Export
   Depends on: state.js
   Notifies app.js via callback after import.
======================================== */

import { App, saveState, getTodayKey } from './state.js';

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

      App.state.tasks = data.tasks;
      App.state.history = data.history;
      saveState();
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
