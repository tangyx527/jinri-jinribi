/* ========================================
   actions.js — Business Logic Layer
   Depends on: state.js, ui.js
   All task mutation + form handling lives here.
======================================== */

import { App, saveState, getTodayTasks, getTodayKey } from './state.js';
import { renderHome, renderLog, renderProfile, showToast, randomEncouragement } from './ui.js';

/* ========================================
   TASK OPERATIONS
======================================== */

export function toggleTask(id) {
  const tasks = getTodayTasks();
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.completed = !task.completed;
  if (task.completed) showToast(randomEncouragement());
  saveState();
  renderHome();
}

export function deleteTask(id) {
  const tasks = getTodayTasks();
  const idx = tasks.findIndex(t => t.id === id);
  if (idx === -1) return;
  tasks.splice(idx, 1);
  saveState();
  renderHome();
  showToast('任务已删除');
}

export function filterTasks(btn, filter) {
  document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  App.currentFilter = filter;
  renderHome();
}

/* ========================================
   ADD TASK FORM
======================================== */

export function selectCategory(cat) {
  App.addCategory = cat;
  document.getElementById('cat-work').classList.toggle('selected', cat === 'work');
  document.getElementById('cat-life').classList.toggle('selected', cat === 'life');
}

export function selectPriority(pri) {
  App.addPriority = pri;
  document.getElementById('pri-urgent').classList.toggle('selected', pri === 'urgent');
  document.getElementById('pri-routine').classList.toggle('selected', pri === 'routine');
}

export function addTask() {
  const input = document.getElementById('task-input');
  const title = input.value.trim();
  if (!title) {
    input.focus();
    input.style.borderColor = '#ef4444';
    setTimeout(() => input.style.borderColor = '', 800);
    return;
  }

  const key = getTodayKey();
  if (!App.state.tasks[key]) App.state.tasks[key] = [];
  App.state.tasks[key].push({
    id: `${key}-${Date.now()}`,
    title,
    category: App.addCategory,
    priority: App.addPriority,
    completed: false
  });
  saveState();
  document.getElementById('add-modal').classList.remove('open');
  renderHome();
  showToast('任务已添加 \uD83D\uDC4D');
}

