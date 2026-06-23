/* ========================================
   gesture.js — Unified Gesture State Machine
   idle → pressing → swiping / dragging / selecting

   Priority: LongPress(500ms) > Drag(80ms) > Swipe > Click

   Drag system: transform: translateY() only.
   Data-driven reorder + translateY gap animation.
   RAF-throttled pointermove.

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
   DRAG STATE (module-level)
======================================== */

let dragState = null;
let postDragTimestamp = 0;  // click guard after drag release

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
        if (!dragState) {
          inner.style.transform = 'translateX(0)';
        }
      }
      inner.classList.remove('dragging');
    }

    /* ── POINTER DOWN ── */
    inner.addEventListener('pointerdown', e => {
      if (cardState === 'dragging') return;
      if (App.selectionMode) return;
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

      // Drag timer: 80ms hold → drag-to-reorder (WeChat-level responsiveness)
      dragTimer = setTimeout(() => {
        if (cardState !== 'pressing' || hasMoved || App.selectionMode) return;
        if (dragState) return;
        startReorderDrag(inner, container, taskId, startY);
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
        scheduleDragUpdate(e.clientY);
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
        if (Date.now() - postDragTimestamp >= 150) {
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

/* ========================================
   SPRING PHYSICS ENGINE (WeChat-level)
   Hooke's law: F = -k*x - c*v
   Creates natural overshoot → decay like iOS/WeChat list.
======================================== */

/**
 * Spring-settle an element to targetY with RAF-driven physics.
 * @param {HTMLElement} el
 * @param {number} fromY - current translateY
 * @param {number} targetY - target translateY
 * @param {Function} onComplete
 * @returns {Function} stopSpring()
 */
function springSettle(el, fromY, targetY, onComplete) {
  let y = fromY;
  let velocity = 0;
  let running = true;
  const k = 180;       // stiffness (lower = more overshoot)
  const c = 26;        // damping
  const mass = 1;
  const precision = 0.25;
  const dt = 0.016;    // ~60fps

  function tick() {
    if (!running) return;
    const force = -k * (y - targetY);
    const dampingForce = -c * velocity;
    const acceleration = (force + dampingForce) / mass;

    velocity += acceleration * dt;
    y += velocity * dt;

    el.style.transform = `translateY(${y}px)`;

    if (Math.abs(y - targetY) < precision && Math.abs(velocity) < precision) {
      el.style.transform = `translateY(${targetY}px)`;
      running = false;
      onComplete?.();
      return;
    }
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
  return () => { running = false; };
}

/* ========================================
   FILTER-AWARE INDEX MAPPING
======================================== */

/**
 * Map DOM-visible indices to full data indices.
 * When a filter is active, only matching tasks appear in DOM.
 * Returns { visibleTasks, visibleMap } where visibleMap[domIdx] = fullDataIdx.
 */
function getVisibleTaskIndices() {
  const tasks = getTodayTasks();
  if (App.currentFilter === 'all') {
    return { visibleTasks: tasks, visibleMap: tasks.map((_, i) => i) };
  }
  const visibleTasks = [];
  const visibleMap = [];
  tasks.forEach((t, i) => {
    if (t.category === App.currentFilter) {
      visibleTasks.push(t);
      visibleMap.push(i);
    }
  });
  return { visibleTasks, visibleMap };
}

/* ========================================
   TRANSFORM-BASED DRAG-TO-REORDER
   (WeChat-level enhanced)
======================================== */

function startReorderDrag(inner, container, taskId, pointerY) {
  const list = document.getElementById('task-list');
  const allContainers = [...list.querySelectorAll('.swipe-container')];
  const startIdx = allContainers.indexOf(container);
  if (startIdx < 0) return;

  const containerRect = container.getBoundingClientRect();
  const itemHeight = containerRect.height;

  // Visual: drag card lifts up — scale + shadow via CSS .drag-active
  inner.classList.add('drag-active');
  inner.classList.remove('spring-return');
  inner.style.transition = 'none';
  inner.style.transform = 'translateY(0px)';
  inner.style.zIndex = '999';

  // Lock body during drag
  document.body.classList.add('gesture-active');
  document.body.classList.add('drag-locked');

  dragState = {
    dragEl: inner,
    dragContainer: container,
    draggedTaskId: taskId,
    startIndex: startIdx,
    currentIndex: startIdx,
    itemHeight,
    containerCenter: containerRect.top + itemHeight / 2,
    rafPending: false,
    pendingY: pointerY,
    initialDelta: 0,
    _stopSpring: null,
    _originalTasks: [...getTodayTasks()].map(t => ({...t, selected: t.selected || false})),
  };
}

function scheduleDragUpdate(clientY) {
  if (!dragState) return;
  dragState.pendingY = clientY;
  if (dragState.rafPending) return;
  dragState.rafPending = true;
  requestAnimationFrame(() => {
    if (!dragState) return;
    dragState.rafPending = false;
    applyDragUpdate(dragState.pendingY);
  });
}

function applyDragUpdate(clientY) {
  const ds = dragState;
  if (!ds) return;

  const fullTasks = getTodayTasks();
  const { visibleTasks, visibleMap } = getVisibleTaskIndices();

  // ── 1. Dragged card follows pointer ──
  const rawDelta = clientY - ds.containerCenter;

  // Boundary resistance: dampen when dragged past visible list edges
  const resistanceThreshold = ds.itemHeight / 2;
  const upperBound = -resistanceThreshold;
  const lowerBound = (visibleTasks.length - 1) * ds.itemHeight - resistanceThreshold;

  let deltaY = rawDelta;
  if (rawDelta < upperBound) {
    deltaY = upperBound + (rawDelta - upperBound) * 0.3;
  } else if (rawDelta > lowerBound) {
    deltaY = lowerBound + (rawDelta - lowerBound) * 0.3;
  }

  ds.dragEl.style.transform = `translateY(${deltaY}px)`;
  ds.initialDelta = deltaY;

  // ── 2. Calculate hover index (clamped to visible task count) ──
  let hoverIndex = ds.currentIndex + Math.round(rawDelta / ds.itemHeight);
  hoverIndex = Math.max(0, Math.min(hoverIndex, visibleTasks.length - 1));

  // ── 3. Reorder if changed (map DOM indices → real data indices) ──
  if (hoverIndex !== ds.currentIndex) {
    const realFrom = visibleMap[ds.currentIndex];
    const realTo = visibleMap[hoverIndex];

    const [moved] = fullTasks.splice(realFrom, 1);
    fullTasks.splice(realTo, 0, moved);
    saveState();

    // Visual gaps: affected cards get translateY shifts (DOM-index-based)
    updateCardGaps(ds.currentIndex, hoverIndex, ds);

    ds.currentIndex = hoverIndex;
  }
}

function updateCardGaps(fromIdx, toIdx, ds) {
  const list = document.getElementById('task-list');
  const allInners = [...list.querySelectorAll('.swipe-inner')];

  // C2 fix: absolute-position algorithm.
  // Every call independently decides each card's translateY based on
  // whether it sits between the drag card's start and target position.
  // No "clear-all-then-reapply" — eliminates multi-step gap drift.
  allInners.forEach((inner, domIdx) => {
    if (inner === ds.dragEl) return;
    inner.classList.add('reorder-shift');

    if (toIdx > fromIdx) {
      // Dragging down: cards in (fromIdx, toIdx] shift UP
      if (domIdx > fromIdx && domIdx <= toIdx) {
        inner.style.transform = `translateY(${-ds.itemHeight}px)`;
      } else {
        inner.style.transform = 'translateY(0px)';
      }
    } else if (toIdx < fromIdx) {
      // Dragging up: cards in [toIdx, fromIdx) shift DOWN
      if (domIdx >= toIdx && domIdx < fromIdx) {
        inner.style.transform = `translateY(${ds.itemHeight}px)`;
      } else {
        inner.style.transform = 'translateY(0px)';
      }
    } else {
      inner.style.transform = 'translateY(0px)';
    }
  });
}

function endReorderDrag() {
  if (!dragState) return;
  const ds = dragState;

  // ── 0. Immediate unlock — allow scrolling during spring (H1 fix) ──
  document.body.classList.remove('drag-locked');

  const list = document.getElementById('task-list');

  // ── 1. Other cards: smooth CSS transition to natural position ──
  list.querySelectorAll('.swipe-inner').forEach(inner => {
    if (inner !== ds.dragEl) {
      inner.classList.add('reorder-shift');
      inner.style.transform = 'translateY(0px)';
    }
  });

  // ── 2. Dragged card: spring settle to slot ──
  ds.dragEl.classList.add('spring-return');
  ds.dragEl.style.transition = 'none';

  const fromY = ds.initialDelta;
  ds._stopSpring = springSettle(ds.dragEl, fromY, 0, () => {
    onDragComplete(ds);
  });

  // ── 3. Set click guard ──
  postDragTimestamp = Date.now();
}

function cancelReorderDrag() {
  if (!dragState) return;
  const ds = dragState;

  // ── 0. Immediate unlock (H1 fix) ──
  document.body.classList.remove('drag-locked');

  // ── 1. Restore original data from snapshot (robust against filter shifts) ──
  const tasks = getTodayTasks();
  tasks.length = 0;
  ds._originalTasks.forEach(t => tasks.push({...t}));
  saveState();

  // ── 2. Other cards: smooth CSS transition back ──
  const list = document.getElementById('task-list');
  list.querySelectorAll('.swipe-inner').forEach(inner => {
    if (inner !== ds.dragEl) {
      inner.classList.add('reorder-shift');
      inner.style.transform = 'translateY(0px)';
    }
  });

  // ── 3. Dragged card: spring snap-back ──
  ds.dragEl.classList.add('spring-return');
  ds.dragEl.style.transition = 'none';

  const fromY = ds.initialDelta;
  ds._stopSpring = springSettle(ds.dragEl, fromY, 0, () => {
    onDragComplete(ds);
  });

  // ── 4. Set click guard ──
  postDragTimestamp = Date.now();
}

/**
 * Shared cleanup after spring animation completes.
 * Reconciles DOM, clears drag state, restores body classes.
 */
function onDragComplete(ds) {
  // Cancel any still-running spring (H5 fix — safety against stale DOM refs)
  if (ds._stopSpring) {
    ds._stopSpring();
    ds._stopSpring = null;
  }

  const list = document.getElementById('task-list');
  list.querySelectorAll('.swipe-inner').forEach(inner => {
    inner.style.transition = '';
    inner.style.transform = 'translateY(0px)';
    inner.style.zIndex = '';
    inner.classList.remove('drag-active', 'spring-return', 'reorder-shift');
  });

  document.body.classList.remove('gesture-active');
  document.body.classList.remove('drag-locked');
  dragState = null;

  // Final render syncs DOM to data
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
