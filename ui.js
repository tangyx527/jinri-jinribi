/* ========================================
   ui.js — UI Rendering Layer
   Depends on: state.js
   No dependency on actions.js or gesture.js.
   All onclick="" strings resolve at runtime via window.
======================================== */

import {
  App, getTodayTasks, getTodayKey, formatDateKey,
  calcStreak, calcMaxStreak, updateTodayHistory
} from './state.js';

/* Callbacks set by app.js for gesture/action wiring */
let _onAfterRender = null;   // called after renderHome (for bindGestures + updateSelectionUI)

export function setUiCallbacks({ onAfterRender }) {
  _onAfterRender = onAfterRender;
}

/* ========================================
   UTIL
======================================== */

const encouragements = [
  '很棒，继续！', '保持节奏 \uD83C\uDFAF', '你做得很好', '一步一步来', '专注当下',
  '完成又一个！', '低压前行 \uD83C\uDF3F', '平静的力量', '每天一点点', '积累的魔法'
];

export function randomEncouragement() {
  return encouragements[Math.floor(Math.random() * encouragements.length)];
}

export function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

let toastTimer;

export function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

export function setTodayDate() {
  const d = new Date();
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const months = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
  document.getElementById('today-date').textContent =
    `${d.getFullYear()}年${months[d.getMonth()]}月${d.getDate()}日 ${weekdays[d.getDay()]}`;
}

/* ========================================
   NAVIGATION
======================================== */

export function switchScreen(screen, navEl) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`screen-${screen}`).classList.add('active');
  navEl.classList.add('active');
  App.currentScreen = screen;
  if (screen === 'log') renderLog();
  if (screen === 'profile') renderProfile();
}

/* ========================================
   HOME SCREEN
======================================== */

export function renderHome() {
  const tasks = getTodayTasks();
  const total = tasks.length;
  const done = tasks.filter(t => t.completed).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  // Update ring
  const circumference = 565.48;
  const offset = circumference - (circumference * pct / 100);
  const ring = document.getElementById('ring-progress');
  const glow = document.getElementById('ring-glow');
  ring.style.strokeDashoffset = offset;
  glow.style.strokeDashoffset = offset;
  glow.style.opacity = pct > 0 ? 0.3 : 0;
  document.getElementById('ring-percent').textContent = `${pct}%`;

  // Status text
  const statuses = [
    [0, '从今天开始'], [1, '迈出第一步'], [25, '慢慢来，很好'],
    [50, '保持节奏'], [75, '快完成了！'], [100, '全部完成']
  ];
  let status = statuses[0][1];
  for (const [threshold, text] of statuses) {
    if (pct >= threshold) status = text;
  }
  document.getElementById('ring-status').textContent = status;
  if (pct === 100 && total > 0) triggerCelebration();

  // Render task list
  const filtered = App.currentFilter === 'all' ? tasks : tasks.filter(t => t.category === App.currentFilter);
  const list = document.getElementById('task-list');

  if (filtered.length === 0) {
    list.innerHTML = `<div class="empty-state">
      <div class="float-anim">
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" color="#c5d9c2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/>
        </svg>
      </div>
      <h3>${tasks.length === 0 ? '今天还没有任务' : '该分类暂无任务'}</h3>
      <p>${tasks.length === 0 ? '点击右下角 + 添加你的第一个任务' : '试试切换其他分类'}</p>
    </div>`;
    return;
  }

  list.innerHTML = filtered.map((t, i) => `
    <div class="swipe-container" data-task-id="${t.id}" data-index="${i}">

      <div class="swipe-inner" data-task-id="${t.id}" style="animation-delay:${i * 40}ms">
        <div class="long-press-indicator"></div>
        <div class="task-card ${t.completed ? 'completed' : ''} ${t.selected ? 'selected' : ''}">
          <div class="select-checkbox">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div class="task-check">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div class="task-content">
            <div class="task-title">${escapeHtml(t.title)}</div>
            <div class="task-meta">
              <span class="task-tag tag-${t.category}">${t.category === 'work' ? '工作' : '生活'}</span>
              <span class="task-tag tag-${t.priority}">${t.priority === 'urgent' ? '紧急' : '日常'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `).join('');

  // Update today's history for heatmap/streak
  updateTodayHistory();

  // Notify app.js to bind gestures + update selection UI
  _onAfterRender?.();
}

/* ========================================
   CELEBRATION
======================================== */

export function triggerCelebration() {
  const ring = document.getElementById('celebration-ring');
  ring.style.animation = 'none';
  ring.offsetHeight; // reflow
  ring.style.animation = 'celebrate 600ms ease-out forwards';
}

/* ========================================
   LOG SCREEN
======================================== */

export function renderLog() {
  const streak = calcStreak();
  const maxStreak = calcMaxStreak();
  document.getElementById('streak-num').textContent = streak;
  document.getElementById('max-streak-num').textContent = maxStreak;
  renderHeatmap();
}

export function renderHeatmap() {
  const now = new Date();
  if (App.heatmapYear === undefined) { App.heatmapYear = now.getFullYear(); App.heatmapMonth = now.getMonth(); }

  const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
  document.getElementById('month-name').textContent = `${App.heatmapYear}年 ${monthNames[App.heatmapMonth]}`;

  const firstDay = new Date(App.heatmapYear, App.heatmapMonth, 1).getDay();
  const daysInMonth = new Date(App.heatmapYear, App.heatmapMonth + 1, 0).getDate();
  const today = formatDateKey(now);
  const grid = document.getElementById('heatmap-grid');
  let html = '';

  for (let i = 0; i < firstDay; i++) html += `<div class="heatmap-cell empty"></div>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(App.heatmapYear, App.heatmapMonth, d);
    const key = formatDateKey(date);
    const isFuture = key > today;
    const isToday = key === today;

    let level = 0;
    if (!isFuture && App.state.history[key]) {
      const h = App.state.history[key];
      const ratio = h.count > 0 ? h.completed / h.count : 0;
      if (h.completed >= 1) level = 1;
      if (h.completed >= 3) level = 2;
      if (ratio >= 0.5) level = 3;
      if (ratio >= 1) level = 4;
    }

    const classes = ['heatmap-cell'];
    if (isFuture) classes.push('future');
    if (isToday) classes.push('today');
    if (!isFuture && level > 0) classes.push(`level-${level}`);

    const clickHandler = isFuture ? '' : `onclick="showDayDetail('${key}', ${d})"`;
    html += `<div class="${classes.join(' ')}" ${clickHandler} title="${key}"></div>`;
  }
  grid.innerHTML = html;
}

export function changeMonth(dir) {
  App.heatmapMonth += dir;
  if (App.heatmapMonth > 11) { App.heatmapMonth = 0; App.heatmapYear++; }
  if (App.heatmapMonth < 0) { App.heatmapMonth = 11; App.heatmapYear--; }
  renderHeatmap();
}

export function showDayDetail(key, day) {
  const tasks = App.state.tasks[key] || [];
  const monthNames = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
  const date = new Date(key);
  document.getElementById('day-modal-title').textContent =
    `${date.getFullYear()}年${monthNames[date.getMonth()]}月${day}日`;

  const completedTasks = tasks.filter(t => t.completed);
  if (completedTasks.length === 0) {
    document.getElementById('day-modal-content').innerHTML = `<div class="no-data">这天没有完成任务记录</div>`;
  } else {
    document.getElementById('day-modal-content').innerHTML = completedTasks.map(t => `
      <div class="detail-task-item">
        <div class="detail-dot"></div>
        <div class="detail-task-name">${escapeHtml(t.title)}</div>
        <span class="task-tag tag-${t.category}" style="margin-left:auto">${t.category === 'work' ? '工作' : '生活'}</span>
      </div>
    `).join('');
  }
  document.getElementById('day-modal').classList.add('open');
}

export function closeDayModal(e) {
  if (e.target === document.getElementById('day-modal')) {
    document.getElementById('day-modal').classList.remove('open');
  }
}

/* ========================================
   PROFILE SCREEN
======================================== */

export function renderProfile() {
  const today = getTodayKey();
  const todayTasks = App.state.tasks[today] || [];
  const todayDone = todayTasks.filter(t => t.completed).length;
  const streak = calcStreak();

  let totalDone = 0, workCount = 0, lifeCount = 0, urgentCount = 0, routineCount = 0;
  Object.values(App.state.tasks).forEach(tasks => {
    tasks.forEach(t => {
      if (t.completed) {
        totalDone++;
        if (t.category === 'work') workCount++; else lifeCount++;
        if (t.priority === 'urgent') urgentCount++; else routineCount++;
      }
    });
  });

  document.getElementById('stat-total').textContent = totalDone;
  document.getElementById('stat-today').textContent = todayDone;
  document.getElementById('stat-streak').textContent = streak;
  document.getElementById('streak-big').textContent = streak;

  // Donut
  const totalCat = workCount + lifeCount;
  const workPct = totalCat ? Math.round(workCount / totalCat * 100) : 50;
  const lifePct = 100 - workPct;
  const circ = 251.33;
  document.getElementById('donut-work').style.strokeDashoffset = circ - (circ * workPct / 100);
  document.getElementById('donut-life').style.strokeDasharray = `${circ * lifePct / 100} ${circ}`;
  document.getElementById('donut-life').style.strokeDashoffset = -(circ * workPct / 100) + '';
  document.getElementById('work-pct').textContent = `${workPct}% (${workCount}个)`;
  document.getElementById('life-pct').textContent = `${lifePct}% (${lifeCount}个)`;

  // Bar chart
  const maxBar = Math.max(urgentCount, routineCount, workCount, lifeCount, 1);
  document.getElementById('bar-chart').innerHTML = `
    <div class="bar-row">
      <span class="bar-label">紧急</span>
      <div class="bar-track"><div class="bar-fill" style="width:${urgentCount/maxBar*100}%;background:#ef4444"></div></div>
      <span class="bar-val">${urgentCount}</span>
    </div>
    <div class="bar-row">
      <span class="bar-label">日常</span>
      <div class="bar-track"><div class="bar-fill" style="width:${routineCount/maxBar*100}%"></div></div>
      <span class="bar-val">${routineCount}</span>
    </div>
    <div class="bar-row">
      <span class="bar-label">工作</span>
      <div class="bar-track"><div class="bar-fill" style="width:${workCount/maxBar*100}%;background:#f59e0b"></div></div>
      <span class="bar-val">${workCount}</span>
    </div>
    <div class="bar-row">
      <span class="bar-label">生活</span>
      <div class="bar-track"><div class="bar-fill" style="width:${lifeCount/maxBar*100}%;background:#8b5cf6"></div></div>
      <span class="bar-val">${lifeCount}</span>
    </div>
  `;

  renderLineChart();
}

export function renderLineChart() {
  const today = new Date();
  const days = 14;
  const data = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    const key = formatDateKey(d);
    const h = App.state.history[key];
    data.push({ day: d.getDate(), value: h ? h.completed : 0 });
  }

  const W = 320, H = 140, padL = 32, padR = 12, padT = 16, padB = 28;
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const xStep = (W - padL - padR) / (days - 1);

  const points = data.map((d, i) => ({
    x: padL + i * xStep,
    y: padT + (H - padT - padB) * (1 - d.value / maxVal)
  }));

  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const cp1x = points[i - 1].x + xStep / 3;
    const cp2x = points[i].x - xStep / 3;
    pathD += ` C ${cp1x} ${points[i - 1].y} ${cp2x} ${points[i].y} ${points[i].x} ${points[i].y}`;
  }

  let areaD = pathD + ` L ${points[points.length - 1].x} ${H - padB} L ${points[0].x} ${H - padB} Z`;

  const xLabels = data.map((d, i) => {
    if (i % 2 === 0) return `<text x="${padL + i * xStep}" y="${H - padB + 14}" text-anchor="middle" fill="#9bb898" font-size="10">${d.day}</text>`;
    return '';
  }).join('');

  const gridLines = [0, 0.5, 1].map(r => {
    const y = padT + (H - padT - padB) * (1 - r);
    const val = Math.round(maxVal * r);
    return `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#e2f0df" stroke-width="1"/>
            <text x="${padL - 4}" y="${y + 3}" text-anchor="end" fill="#9bb898" font-size="10">${val}</text>`;
  }).join('');

  document.getElementById('line-chart').innerHTML = `
    <defs>
      <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#22c55e" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="#22c55e" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${gridLines}
    <path d="${areaD}" fill="url(#lineGrad)"/>
    <path d="${pathD}" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round"/>
    ${points.map(p => `<circle cx="${p.x}" cy="${p.y}" r="3" fill="#22c55e"/>`).join('')}
    ${xLabels}
  `;
}

/* ========================================
   MODALS & CLEAR
======================================== */

export function openAddModal() {
  document.getElementById('add-modal').classList.add('open');
  document.getElementById('task-input').value = '';
  setTimeout(() => document.getElementById('task-input').focus(), 400);
}

export function closeAddModal() {
  document.getElementById('add-modal').classList.remove('open');
}

export function closeModalOnBg(e) {
  if (e.target === document.getElementById('add-modal')) closeAddModal();
}

export function openClearConfirm() {
  document.getElementById('clear-confirm-overlay').style.display = 'flex';
}

export function closeClearConfirm() {
  document.getElementById('clear-confirm-overlay').style.display = 'none';
}

export function clearAllRecords() {
  localStorage.removeItem('serene_logic_v2');
  localStorage.removeItem('serene_last_date');
  App.state = { tasks: {}, history: {} };
  closeClearConfirm();
  renderHome();
  renderLog();
  renderProfile();
  showToast('记录已清除');
}

export function showUpdateModal() {
  document.getElementById('update-modal').classList.add('open');
}

export function closeUpdateModal() {
  document.getElementById('update-modal').classList.remove('open');
  localStorage.setItem('update_seen_v1', '1');
}

export function showGuideModal() {
  document.getElementById('guide-modal').classList.add('open');
}

export function closeGuideModal() {
  document.getElementById('guide-modal').classList.remove('open');
}
