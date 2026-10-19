/* Deterministic teaching model; one step is one simulated second. */
window.QueueLessonModel = {
 step(queue, packets, missPercent, capacity) {
  const arrivals = Math.round(packets * missPercent / 100);
  const processed = Math.min(queue + arrivals, capacity);
  return { arrivals, processed, queue: Math.max(0, queue + arrivals - processed) };
 }
};
