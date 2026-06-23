/* ========================================
   gesture.js — Unified Gesture State Machine
   idle → pressing → swiping / dragging / selecting

   Priority: LongPress(500ms) > Drag(300ms) > Swipe > Click

   Depends on: state.js, actions.js, ui.js
======================================== */

import {
  App, saveState, getTodayTasks,
  LONG_PRESS_DELAY, DRAG_DELAY, TAP_DRIFT,
  SWIPE_MIN, DELETE_DIST, MAX_DRAG
} from './state.js';

import { toggleTask, deleteTask } from './actions.js';
import { renderHome, showToast } from './ui.js';

/* ========================================
   DRAG STATE (module-level, replaces App.dragActive)
======================================== */

let dragState = null;   // { sourceIdx, targetIdx, sourceEl, placeholderEl, sourceContainer, cardHeight, originLeft, originWidth }

export function isDragActive() {
  return dragState !== null;
}

/* ========================================
   UNIFIED GESTURE BINDER
======================================== */

export function bindGestures() {
  document.querySelectorAll('.swipe-inner').forEach(inner => {
    if (inner.dataset.gestureBound) return;
    inner.dataset.gestureBound = '1';

    const container = inner.closest('.swipe-container');
    const card = inner.querySelector('.task-card');
    const taskId = inner.dataset.taskId;
    const indicator = inner.querySelector('.long-press-indicator');

    let cardState = 'idle';    // idle | pressing | swiping | dragging
    let startX = 0, startY = 0;
    let lastX = 0, lastY = 0;
    let pressTimer = null;
    let dragTimer = null;
    let hasMoved = false;
    let swipeLocked = false;

    function reset(keepPosition) {
      cardState = 'idle';
      hasMoved = false;
      swipeLocked = false;
      clearTimeout(pressTimer);
      clearTimeout(dragTimer);
      pressTimer = null;
      dragTimer = null;
      if (indicator) indicator.classList.remove('active');
      if (!keepPosition) {
        inner.style.transition = 'transform 280ms cubic-bezier(0.16, 1, 0.3, 1)';
        if (!dragState || dragState.sourceEl !== inner) {
          inner.style.transform = 'translateX(0)';
        }
      }
      inner.classList.remove('dragging');
    }

    /* ── POINTER DOWN ── */
    inner.addEventListener('pointerdown', e => {
      if (cardState === 'dragging') return;
      if (App.selectionMode) return; // selection mode: no swipe/drag, click only
      if (dragState) return;
      if (inner.classList.contains('removing')) return;

      cardState = 'pressing';
      startX = e.clientX;
      startY = e.clientY;
      lastX = startX;
      lastY = startY;
      hasMoved = false;
      swipeLocked = false;

      inner.style.transition = 'none';
      inner.setPointerCapture(e.pointerId);
      if (indicator) indicator.classList.add('active');

      // Drag timer: 300ms hold → drag-to-reorder
      dragTimer = setTimeout(() => {
        if (cardState !== 'pressing' || hasMoved || App.selectionMode) return;
        if (dragState) return;
        startDrag(inner, container, taskId, startY);
        cardState = 'dragging';
        clearTimeout(pressTimer);
      }, DRAG_DELAY);

      // Long-press timer: 500ms hold → selection mode
      pressTimer = setTimeout(() => {
        if (cardState !== 'pressing' || hasMoved || App.selectionMode) return;
        if (dragState) return;
        enterSelectionMode(taskId);
        cardState = 'idle';
        reset(false);
        inner.releasePointerCapture(e.pointerId);
      }, LONG_PRESS_DELAY);
    });

    /* ── POINTER MOVE ── */
    inner.addEventListener('pointermove', e => {
      if (cardState === 'dragging') {
        updateDrag(e.clientY);
        return;
      }
      if (cardState !== 'pressing') return;
      if (dragState) return;

      lastX = e.clientX;
      lastY = e.clientY;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (Math.abs(dx) > TAP_DRIFT || Math.abs(dy) > TAP_DRIFT) {
        hasMoved = true;
        if (indicator) indicator.classList.remove('active');
        clearTimeout(pressTimer);
        clearTimeout(dragTimer);

        if (dx < -TAP_DRIFT && Math.abs(dx) > Math.abs(dy) && !App.selectionMode) {
          cardState = 'swiping';
          swipeLocked = true;
        } else {
          inner.releasePointerCapture(e.pointerId);
          reset(true);
          return;
        }
      }

      if (cardState === 'swiping' && dx < 0) {
        inner.style.transform = `translateX(${Math.max(dx, -MAX_DRAG)}px)`;
      }
    });

    /* ── POINTER UP ── */
    inner.addEventListener('pointerup', e => {
      if (cardState === 'dragging') {
        endDrag();
        reset(true);
        return;
      }
      if (cardState === 'idle') { reset(false); return; }

      const dx = e.clientX - startX;

      if (cardState === 'swiping') {
        inner.style.transition = 'transform 280ms cubic-bezier(0.16, 1, 0.3, 1)';
        if (dx < -DELETE_DIST) {
          inner.classList.add('removing');
          const id = taskId;
          setTimeout(() => deleteTask(id), 340);
        } else {
          inner.style.transform = 'translateX(0)';
        }
        reset(true);
        return;
      }

      // Pure tap → complete task
      if (!hasMoved && !App.selectionMode && !swipeLocked) {
        toggleTask(taskId);
      }
      reset(false);
    });

    /* ── POINTER CANCEL ── */
    inner.addEventListener('pointercancel', () => {
      if (cardState === 'dragging') cancelDrag();
      if (cardState === 'swiping') inner.style.transform = 'translateX(0)';
      reset(false);
    });

    /* ── CLICK: selection mode ── */
    card.addEventListener('click', e => {
      if (!App.selectionMode) return;
      e.stopPropagation();
      toggleSelection(taskId);
    });
  });
}

/* ========================================
   DRAG-TO-REORDER
======================================== */

function startDrag(inner, container, taskId, pointerY) {
  const allContainers = [...document.querySelectorAll('#task-list .swipe-container')];
  const sourceIdx = allContainers.indexOf(container);
  if (sourceIdx < 0) return;

  const containerRect = container.getBoundingClientRect();
  const cardHeight = containerRect.height;

  const placeholder = document.createElement('div');
  placeholder.className = 'swipe-container sortable';
  const phInner = document.createElement('div');
  phInner.className = 'drag-placeholder';
  phInner.style.minHeight = cardHeight + 'px';
  placeholder.appendChild(phInner);
  container.parentNode.insertBefore(placeholder, container);
  container.style.display = 'none';

  inner.classList.add('dragging');
  inner.style.transition = 'none';
  inner.style.position = 'fixed';
  inner.style.left = containerRect.left + 'px';
  inner.style.width = containerRect.width + 'px';
  inner.style.top = (pointerY - cardHeight / 2) + 'px';
  inner.style.zIndex = '200';
  document.body.appendChild(inner);

  dragState = {
    sourceIdx,
    targetIdx: sourceIdx,
    sourceEl: inner,
    placeholderEl: placeholder,
    sourceContainer: container,
    cardHeight,
    originLeft: containerRect.left,
    originWidth: containerRect.width
  };
  document.body.classList.add('gesture-active');
}

function updateDrag(clientY) {
  if (!dragState) return;
  const { sourceEl, cardHeight, placeholderEl } = dragState;
  sourceEl.style.top = (clientY - cardHeight / 2) + 'px';

  const allContainers = [...document.querySelectorAll('#task-list .swipe-container')];
  const placeholderIdx = allContainers.indexOf(placeholderEl);
  if (placeholderIdx < 0) return;

  let bestIdx = placeholderIdx;
  let bestDist = Infinity;

  for (let i = 0; i < allContainers.length; i++) {
    if (allContainers[i] === placeholderEl) continue;
    const r = allContainers[i].getBoundingClientRect();
    const midY = r.top + r.height / 2;
    const dist = Math.abs(clientY - midY);
    if (dist < bestDist) { bestDist = dist; bestIdx = i; }
  }

  const lastRect = allContainers[allContainers.length - 1]?.getBoundingClientRect();
  if (lastRect && clientY > lastRect.top + lastRect.height) {
    bestIdx = allContainers.length - 1;
    const list = document.getElementById('task-list');
    if (placeholderEl !== allContainers[allContainers.length - 1]) {
      list.appendChild(placeholderEl);
    }
  }

  if (bestIdx !== dragState.targetIdx && bestIdx !== placeholderIdx) {
    dragState.targetIdx = bestIdx;
    const list = document.getElementById('task-list');
    const targetContainer = allContainers[bestIdx];
    if (targetContainer) list.insertBefore(placeholderEl, targetContainer);
  }
}

function endDrag() {
  if (!dragState) return;
  const { sourceEl, sourceContainer, placeholderEl, sourceIdx, targetIdx, originWidth } = dragState;
  const phRect = placeholderEl.getBoundingClientRect();

  sourceEl.style.transition = 'all 250ms cubic-bezier(0.16, 1, 0.3, 1)';
  sourceEl.style.left = phRect.left + 'px';
  sourceEl.style.top = phRect.top + 'px';
  sourceEl.style.width = originWidth + 'px';

  const finalEl = sourceEl;
  const savedDrag = { ...dragState };

  setTimeout(() => {
    finalEl.style.position = '';
    finalEl.style.left = '';
    finalEl.style.top = '';
    finalEl.style.width = '';
    finalEl.style.zIndex = '';
    finalEl.style.transition = '';
    finalEl.classList.remove('dragging');

    sourceContainer.style.display = '';
    sourceContainer.parentNode.insertBefore(sourceContainer, placeholderEl);
    sourceContainer.querySelector('.swipe-inner').style.transform = '';

    placeholderEl.remove();

    const tasks = getTodayTasks();
    if (sourceIdx >= 0 && sourceIdx < tasks.length && savedDrag.targetIdx >= 0 && savedDrag.targetIdx < tasks.length) {
      const [moved] = tasks.splice(sourceIdx, 1);
      tasks.splice(savedDrag.targetIdx, 0, moved);
      saveState();
      renderHome();
    }

    document.body.classList.remove('gesture-active');
    dragState = null;
  }, 260);
}

function cancelDrag() {
  if (!dragState) return;
  const { sourceEl, sourceContainer, placeholderEl } = dragState;

  sourceEl.style.position = '';
  sourceEl.style.left = '';
  sourceEl.style.top = '';
  sourceEl.style.width = '';
  sourceEl.style.zIndex = '';
  sourceEl.style.transition = '';
  sourceEl.classList.remove('dragging');
  sourceEl.style.transform = '';

  sourceContainer.style.display = '';
  sourceContainer.appendChild(sourceEl);
  placeholderEl.remove();
  document.body.classList.remove('gesture-active');
  dragState = null;
  renderHome();
}

/* ========================================
   MULTI-SELECTION LOGIC
======================================== */

export function enterSelectionMode(firstId) {
  App.selectionMode = true;
  document.body.classList.add('selection-mode');
  const tasks = getTodayTasks();
  const task = tasks.find(t => t.id === firstId);
  if (task) task.selected = true;
  saveState();
  renderHome();
  updateSelectionUI();
}

export function toggleSelection(taskId) {
  if (!App.selectionMode) return;
  const tasks = getTodayTasks();
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;
  task.selected = !task.selected;
  saveState();

  const card = document.querySelector(`.swipe-inner[data-task-id="${taskId}"] .task-card`);
  if (card) card.classList.toggle('selected', task.selected);
  updateSelectionUI();

  const selCount = tasks.filter(t => t.selected).length;
  if (selCount === 0) exitSelectionMode();
}

export function updateSelectionUI() {
  const tasks = getTodayTasks();
  const selCount = tasks.filter(t => t.selected).length;
  const toolbar = document.getElementById('selection-toolbar');

  if (App.selectionMode && selCount > 0) {
    toolbar.classList.add('active');
    document.getElementById('sel-count').textContent = `已选 ${selCount} 项`;
  } else {
    toolbar.classList.remove('active');
  }
  document.body.classList.toggle('selection-mode', App.selectionMode);
}

export function exitSelectionMode() {
  App.selectionMode = false;
  const tasks = getTodayTasks();
  tasks.forEach(t => t.selected = false);
  document.body.classList.remove('selection-mode');
  document.getElementById('selection-toolbar').classList.remove('active');
  saveState();
  renderHome();
}

export function batchComplete() {
  if (!App.selectionMode) return;
  const tasks = getTodayTasks();
  const selTasks = tasks.filter(t => t.selected);
  if (selTasks.length === 0) return;
  selTasks.forEach(t => { t.completed = true; t.selected = false; });
  saveState();
  exitSelectionMode();
  showToast(`${selTasks.length} 个任务已完成 \u2705`);
}

export function batchDelete() {
  if (!App.selectionMode) return;
  const tasks = getTodayTasks();
  const selTasks = tasks.filter(t => t.selected);
  if (selTasks.length === 0) return;
  const count = selTasks.length;
  for (let i = tasks.length - 1; i >= 0; i--) {
    if (tasks[i].selected) tasks.splice(i, 1);
  }
  saveState();
  exitSelectionMode();
  showToast(`${count} 个任务已删除`);
}
