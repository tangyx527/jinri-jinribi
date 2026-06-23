/* ========================================
   app.js — Entry Point
   Imports all modules, wires callbacks,
   binds functions to window for HTML onclick,
   initializes the application.
======================================== */

import { App, loadState, saveState, getTodayKey } from './state.js';

import { setStorageCallbacks, exportData, importData } from './storage.js';

import {
  setUiCallbacks,
  renderHome, renderLog, renderProfile, renderHeatmap,
  renderLineChart,
  showToast, escapeHtml, setTodayDate, randomEncouragement,
  triggerCelebration, switchScreen,
  showDayDetail, closeDayModal, changeMonth,
  openAddModal, closeAddModal, closeModalOnBg,
  openClearConfirm, closeClearConfirm, clearAllRecords,
  showUpdateModal, closeUpdateModal,
  showGuideModal, closeGuideModal
} from './ui.js';

import {
  toggleTask, deleteTask, filterTasks,
  selectCategory, selectPriority, addTask
} from './actions.js';

import {
  bindGestures, updateSelectionUI,
  enterSelectionMode, exitSelectionMode,
  toggleSelection, batchComplete, batchDelete
} from './gesture.js';

/* ========================================
   WIRE CALLBACKS
======================================== */

// storage.js → needs re-render after import
setStorageCallbacks({
  onImportSuccess() {
    renderHome();
    renderLog();
    renderProfile();
  },
  showToast
});

// ui.js → needs gesture binding after renderHome
setUiCallbacks({
  onAfterRender() {
    bindGestures();
    updateSelectionUI();
  }
});

/* ========================================
   BIND TO WINDOW (for HTML onclick="...")
======================================== */

Object.assign(window, {
  // ui
  showToast, escapeHtml, setTodayDate, randomEncouragement,
  renderHome, renderLog, renderProfile, renderHeatmap, renderLineChart,
  triggerCelebration, switchScreen,
  showDayDetail, closeDayModal, changeMonth,
  openAddModal, closeAddModal, closeModalOnBg,
  openClearConfirm, closeClearConfirm, clearAllRecords,
  showUpdateModal, closeUpdateModal,
  showGuideModal, closeGuideModal,

  // actions
  toggleTask, deleteTask, filterTasks,
  selectCategory, selectPriority, addTask,

  // storage
  exportData, importData,

  // gesture
  enterSelectionMode, exitSelectionMode,
  toggleSelection, batchComplete, batchDelete,
});

/* ========================================
   INIT
======================================== */

loadState();
setTodayDate();
renderHome();

// Service Worker registration
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
    .then(reg => console.log('[PWA] Service Worker registered:', reg.scope))
    .catch(err => console.warn('[PWA] SW registration failed:', err));
}

// Update modal on first visit
if (!localStorage.getItem('update_seen_v1')) {
  setTimeout(() => showUpdateModal(), 600);
}

// Day reset check
const lastDate = localStorage.getItem('serene_last_date');
const todayStr = getTodayKey();
if (lastDate && lastDate !== todayStr) {
  showToast('新的一天，新的开始 \uD83C\uDF31');
}
localStorage.setItem('serene_last_date', todayStr);

/* ========================================
   KEYBOARD HANDLER
======================================== */

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('add-modal').classList.contains('open')) {
    addTask();
  }
  if (e.key === 'Escape') {
    if (App.selectionMode) { exitSelectionMode(); return; }
    document.getElementById('add-modal').classList.remove('open');
    document.getElementById('day-modal').classList.remove('open');
    document.getElementById('update-modal').classList.remove('open');
    document.getElementById('guide-modal').classList.remove('open');
  }
});

/* ========================================
   VISUAL VIEWPORT — 键盘适配
======================================== */

if (window.visualViewport) {
  let basePadding = null;

  window.visualViewport.addEventListener('resize', () => {
    const sheet = document.querySelector('#add-modal .modal-sheet');
    const modal = document.getElementById('add-modal');
    if (basePadding === null && sheet) {
      basePadding = parseFloat(getComputedStyle(sheet).paddingBottom) || 40;
    }
    if (!modal.classList.contains('open')) return;
    const keyboardH = window.innerHeight - window.visualViewport.height;
    if (sheet && keyboardH > 50) {
      sheet.style.paddingBottom = (basePadding + keyboardH) + 'px';
    } else if (sheet) {
      sheet.style.paddingBottom = '';
    }
  });
}
