/**
 * drag-engine.js — Drag-to-Reorder Engine
 *
 * Handles all drag-related state and logic previously in gesture.js.
 * Imports spring physics from spring.js.
 *
 * Exports predicates and public drag functions for gesture.js to use.
 */

import { springSettle } from './spring.js';
import { App, saveState, getTodayTasks } from './state.js';
import { renderHome } from './ui.js';

/* =======================================
   DRAG STATE (module-level)
======================================== */

let dragState = null;
let postDragTimestamp = 0;  // click guard after drag release

/* =======================================
   PREDICATE FUNCTIONS (for gesture.js)
======================================== */

export function isDragActive() {
  return dragState !== null;
}

export function isRecentDrag() {
  return Date.now() - postDragTimestamp < 150;
}

/* =======================================
   FILTER-AWARE INDEX MAPPING (internal)
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

/* =======================================
   TRANSFORM-BASED DRAG-TO-REORDER
   (WeChat-level enhanced)
======================================== */

export function startReorderDrag(inner, container, taskId, pointerY) {
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

  // Cache all swipe-inner references at drag start (M1 fix)
  const allInners = [...list.querySelectorAll('.swipe-inner')];

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
    allInners,
  };
}

export function scheduleDragUpdate(clientY) {
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

    updateCardGaps(ds.currentIndex, hoverIndex, ds);

    ds.currentIndex = hoverIndex;
  }
}

function updateCardGaps(fromIdx, toIdx, ds) {
  const allInners = ds.allInners;

  // Absolute-position algorithm: each call independently computes all offsets.
  // No "clear-all-then-reapply" — eliminates multi-step gap drift.
  allInners.forEach((inner, domIdx) => {
    if (inner === ds.dragEl) return;
    inner.classList.add('reorder-shift');

    if (toIdx > fromIdx) {
      if (domIdx > fromIdx && domIdx <= toIdx) {
        inner.style.transform = `translateY(${-ds.itemHeight}px)`;
      } else {
        inner.style.transform = 'translateY(0px)';
      }
    } else if (toIdx < fromIdx) {
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

/* =======================================
   SHARED FINISH LOGIC
======================================== */

function _finishDrag(ds, cancel) {
  // ── 0. Immediate unlock — allow scrolling during spring ──
  document.body.classList.remove('drag-locked');

  if (cancel) {
    // Restore original data from snapshot
    const tasks = getTodayTasks();
    tasks.length = 0;
    ds._originalTasks.forEach(t => tasks.push({...t}));
    saveState();
  }

  // ── 1. Other cards: smooth CSS transition to natural position ──
  ds.allInners.forEach(inner => {
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

export function endReorderDrag() {
  if (!dragState) return;
  _finishDrag(dragState, false);
}

export function cancelReorderDrag() {
  if (!dragState) return;
  _finishDrag(dragState, true);
}

function onDragComplete(ds) {
  // Cancel any still-running spring (safety against stale DOM refs)
  if (ds._stopSpring) {
    ds._stopSpring();
    ds._stopSpring = null;
  }

  ds.allInners.forEach(inner => {
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
