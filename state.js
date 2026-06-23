/* ========================================
   state.js — Data Layer (zero dependencies)
   Single source of truth for all app state.
======================================== */

export const STORAGE_KEY = 'serene_logic_v2';

/* ── Core state ── */
export const App = {
  state: { tasks: {}, history: {} },

  /* Gesture / mode flags */
  selectionMode: false,
  dragActive: false,       // true when dragState is not null

  /* UI flags */
  currentScreen: 'home',
  currentFilter: 'all',
  addCategory: 'work',
  addPriority: 'routine',
  heatmapYear: undefined,
  heatmapMonth: undefined,
};

/* ========================================
   DATA ACCESS
======================================== */

export function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) App.state = JSON.parse(saved);
  } catch (e) { /* corrupt data – start fresh */ }
  if (Object.keys(App.state.tasks).length === 0) seedDemoData();
}

export function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(App.state));
}

export function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function getTodayTasks() {
  const key = getTodayKey();
  if (!App.state.tasks[key]) App.state.tasks[key] = [];
  return App.state.tasks[key];
}

export function updateTodayHistory() {
  const tasks = getTodayTasks();
  const key = getTodayKey();
  if (tasks.length > 0) {
    App.state.history[key] = {
      count: tasks.length,
      completed: tasks.filter(t => t.completed).length
    };
    saveState();
  }
}

/* ========================================
   SEED DEMO DATA
======================================== */

function seedDemoData() {
  const today = new Date();
  for (let i = 1; i <= 20; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = formatDateKey(d);
    const count = Math.floor(Math.random() * 5) + 1;
    const completed = Math.floor(Math.random() * count) + (i < 5 ? count : 0);
    App.state.history[key] = { count, completed: Math.min(completed, count) };
    App.state.tasks[key] = [];
    const catArr = ['work', 'life'];
    const priArr = ['urgent', 'routine'];
    const titles = ['完成季度报告', '阅读技术文档', '跑步30分钟', '整理笔记', '项目会议', '学习新技能', '准备演示', '收发邮件'];
    for (let j = 0; j < count; j++) {
      App.state.tasks[key].push({
        id: `${key}-${j}`,
        title: titles[Math.floor(Math.random() * titles.length)],
        category: catArr[Math.floor(Math.random() * 2)],
        priority: priArr[Math.floor(Math.random() * 2)],
        completed: j < App.state.history[key].completed
      });
    }
  }
  saveState();
}

/* ========================================
   GESTURE CONSTANTS
======================================== */

export const LONG_PRESS_DELAY = 500;
export const DRAG_DELAY = 300;
export const TAP_DRIFT = 10;
export const SWIPE_MIN = 30;
export const DELETE_DIST = 100;
export const MAX_DRAG = 140;

/* ========================================
   COMPUTED HELPERS (used by ui.js/profile)
======================================== */

export function calcStreak() {
  const today = new Date();
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const h = App.state.history[formatDateKey(d)];
    if (h && h.completed > 0) streak++;
    else if (i > 0) break;
  }
  return streak;
}

export function calcMaxStreak() {
  const today = new Date();
  let max = 0, cur = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const h = App.state.history[formatDateKey(d)];
    if (h && h.completed > 0) { cur++; max = Math.max(max, cur); }
    else cur = 0;
  }
  return max;
}
