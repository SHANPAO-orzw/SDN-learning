/* Fluid teaching model: proportional admission is an explicit assumption. */
window.RateLimitLessonModel = {
 step(queue, offered, legalPercent, limit, capacity, enabled) {
  const admitted = enabled ? Math.min(offered, limit) : offered;
  const legalOffered = offered * legalPercent / 100;
  const legalAdmitted = admitted * legalPercent / 100;
  const blocked = offered - admitted;
  const legalBlocked = legalOffered - legalAdmitted;
  const processed = Math.min(queue + admitted, capacity);
  return {admitted, legalOffered, legalAdmitted, blocked, legalBlocked, processed, queue: Math.max(0, queue + admitted - processed)};
 }
};
