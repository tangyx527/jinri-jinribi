/**
 * spring.js — Pure Spring Physics Engine (zero dependencies)
 *
 * Hooke's law: F = -k*x - c*v
 * Creates natural overshoot → decay like iOS/WeChat list.
 *
 * @param {HTMLElement} el        - DOM element to animate
 * @param {number}      fromY     - current translateY
 * @param {number}      targetY   - target translateY
 * @param {Function}    onComplete - called when spring settles
 * @returns {Function}             - call to stop the animation early
 */
export function springSettle(el, fromY, targetY, onComplete) {
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
