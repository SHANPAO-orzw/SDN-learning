/* Shared SVG path animation. Cancelling never completes the operation. */
window.TeachingPacketMotion = (path, dot, onComplete) => {
  let frame = 0, cancelled = false, start;
  const length = path.getTotalLength();
  const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 800;
  dot.setAttribute('visibility', 'visible');
  function step(time) {
    if (cancelled) return;
    if (start === undefined) start = time;
    const fraction = duration === 0 ? 1 : Math.min(1, (time - start) / duration);
    const point = path.getPointAtLength(length * fraction);
    dot.setAttribute('cx', point.x); dot.setAttribute('cy', point.y);
    if (fraction < 1) frame = requestAnimationFrame(step);
    else { dot.setAttribute('visibility', 'hidden'); onComplete(); }
  }
  frame = requestAnimationFrame(step);
  return () => { cancelled = true; cancelAnimationFrame(frame); dot.setAttribute('visibility', 'hidden'); };
};
