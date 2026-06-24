/**
 * gesture.js — Unified Gesture State Machine (Facade)
 *
 * Delegates drag-to-reorder logic to drag-engine.js.
 * Keeps: bindGestures() + multi-select logic.
 *
 * Exports (unchanged for app.js compatibility):
 *   bindGestures, updateSelectionUI,
 *   enterSelectionMode, exitSelectionMode,
 *   toggleSelection, batchComplete, batchDelete
 */

import {
  App, saveState, getTodayTasks,
  LONG_PRESS_DELAY, DRAG_DELAY, TAP_DRIFT,
  DELETE_DIST, MAX_DRAG
} from './state.js';

import { toggleTask, deleteTask } from './actions.js';
import { renderHome, showToast } from './ui.js';

import {
  isDragActive, isRecentDrag,
  startReorderDrag, scheduleDragUpdate,
  endReorderDrag, cancelReorderDrag
} from './drag-engine.js';

/* =======================================
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
        if (!isDragActive()) {
          inner.style.transform = 'translateX(0)';
        }
      }
      inner.classList.remove('dragging');
    }

    /* ── POINTER DOWN ── */
    inner.addEventListener('pointerdown', e => {
      if (cardState === 'dragging') return;
      if (App.selectionMode) return;
      if (isDragActive()) return;
      if (inner.classList.contains('removing')) return;

      cardState = 'pressing';
      startX = e.clientX;
      startY = e.clientY;
      hasMoved = false;
      swipeLocked = false;

      inner.style.transition = 'none';
      inner.setPointerCapture(e.pointerId);
      if (indicator) indicator.classList.add('active');

      // Drag timer: 80ms hold → drag-to-reorder
      dragTimer = setTimeout(() => {
        if (cardState !== 'pressing' || hasMoved || App.selectionMode) return;
        if (isDragActive()) return;
        startReorderDrag(inner, container, taskId, startY);
        cardState = 'dragging';
        clearTimeout(pressTimer);
      }, DRAG_DELAY);

      // Long-press timer: 500ms hold → selection mode
      pressTimer = setTimeout(() => {
        if (cardState !== 'pressing' || hasMoved || App.selectionMode) return;
        if (isDragActive()) return;
        enterSelectionMode(taskId);
        cardState = 'idle';
        reset(false);
        inner.releasePointerCapture(e.pointerId);
      }, LONG_PRESS_DELAY);
    });

    /* ── POINTER MOVE ── */
    inner.addEventListener('pointermove', e => {
      if (cardState === 'dragging') {
        scheduleDragUpdate(e.clientY);
        return;
      }
      if (cardState !== 'pressing') return;
      if (isDragActive()) return;

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
        endReorderDrag();
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

      // Pure tap → complete task (with post-drag click guard)
      if (!hasMoved && !App.selectionMode && !swipeLocked) {
        if (!isRecentDrag()) {
          toggleTask(taskId);
        }
      }
      reset(false);
    });

    /* ── POINTER CANCEL ── */
    inner.addEventListener('pointercancel', () => {
      if (cardState === 'dragging') cancelReorderDrag();
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

/* =======================================
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
  showToast(`${selTasks.length} 个任务已完成 ✅`);
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
