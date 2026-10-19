(() => {
  const root = document.getElementById('control-data-lab');
  if (!root) return;
  const get = id => root.querySelector('#' + id);
  let connected = true, rule = null, sent = 0, updates = 0, explored = false, disconnected = false;
  let busy = false, epoch = 0, raf = 0;
  const answers = new Map();
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const log = message => {
    const item = document.createElement('li'); item.textContent = message;
    get('lab-events').prepend(item);
    while (get('lab-events').children.length > 12) get('lab-events').lastChild.remove();
  };
  const note = message => { get('lab-feedback').textContent = message; log(message); };
  function render() {
    get('lab-link').textContent = connected ? '控制连接：已连接' : '控制连接：已断开';
    get('lab-control-path').classList.toggle('offline', !connected);
    get('lab-toggle').textContent = connected ? '断开控制连接' : '恢复控制连接';
    get('lab-rule').textContent = rule === null ? '无匹配规则' : `输出 → 接口 ${rule}`;
    get('lab-rule-status').textContent = rule === null ? '尚未安装' : '已安装 · 持续有效';
    get('lab-switch-state').textContent = rule === null ? '等待规则' : `目的 B → 接口 ${rule}`;
    [2, 3].forEach(port => get('lab-route-' + port).classList.toggle('selected', rule === port));
    get('lab-count').textContent = String(sent); get('lab-updates').textContent = String(updates);
    [updates > 0, sent > 0, disconnected, explored].forEach((done, i) => get('lab-step-' + (i + 1)).classList.toggle('done', done));
    ['lab-install', 'lab-send', 'lab-toggle'].forEach(id => { get(id).disabled = busy; });
    get('lab-summary').value = `第七课互动摘要\n规则更新成功：${updates} 次；按规则转发成功：${sent} 帧。\n控制断开后仍按已有规则转发：${explored ? '已观察' : '未观察'}。\n分类练习：${answers.size}/3 已作答，${[...answers.values()].filter(Boolean).length}/3 正确。\n我的解释或疑问：`;
  }
  function move(pathId, control, token, done) {
    const path = get(pathId), dot = get('lab-packet');
    const length = path.getTotalLength(); let start;
    dot.setAttribute('class', control ? 'packet control' : 'packet');
    dot.setAttribute('visibility', 'visible');
    const duration = reduced() ? 0 : (control ? 720 : 850);
    function step(time) {
      if (token !== epoch) return;
      if (start === undefined) start = time;
      const progress = duration === 0 ? 1 : Math.min(1, (time - start) / duration);
      const point = path.getPointAtLength(length * progress);
      dot.setAttribute('cx', point.x); dot.setAttribute('cy', point.y);
      if (progress < 1) raf = requestAnimationFrame(step);
      else { dot.setAttribute('visibility', 'hidden'); done(); }
    }
    raf = requestAnimationFrame(step);
  }
  get('lab-install').addEventListener('click', () => {
    if (busy) return;
    if (!connected) { note('更新失败：控制连接已断开。旧规则保持不变；恢复连接后才能通过此通道下发新规则。'); return; }
    const chosen = Number(get('lab-port').value); const token = ++epoch;
    busy = true; note(`控制平面：正在向交换机下发“目的 B → 接口 ${chosen}”……`); render();
    move('lab-control-path', true, token, () => {
      rule = chosen; updates++; busy = false;
      note(`规则已安装：目的 B → 接口 ${rule}。接下来试着发送一帧。`); render();
    });
  });
  get('lab-send').addEventListener('click', () => {
    if (busy) return;
    const chosen = rule; const token = ++epoch; busy = true;
    note('数据帧从 A 出发，正在进入交换机匹配规则……'); render();
    move('lab-input-path', false, token, () => {
      if (chosen === null) {
        busy = false; note('帧在 S 处未匹配。本模型将其丢弃，B 未收到；真实系统的未匹配处理取决于配置。'); render(); return;
      }
      get('lab-feedback').textContent = `在 S 匹配到规则，正在沿接口 ${chosen} 的路径发往 B；无需逐帧询问控制器。`;
      move('lab-route-' + chosen, false, token, () => {
        sent++; if (!connected) explored = true; busy = false;
        note(`B 收到一帧：由 S 的接口 ${chosen} 转发。${connected ? '本帧仅执行现有规则，没有询问控制器。' : '控制连接虽已断开，已有规则仍有效，业务转发继续。'}`); render();
      });
    });
  });
  get('lab-toggle').addEventListener('click', () => {
    if (busy) return;
    connected = !connected; if (!connected) disconnected = true;
    note(connected ? '控制连接恢复。可以修改出口并重新安装规则。' : '只断开蓝色控制连接，业务链路保持正常。试发一帧，再试更新规则，比较两种结果。'); render();
  });
  get('lab-reset').addEventListener('click', () => {
    epoch++; cancelAnimationFrame(raf); get('lab-packet').setAttribute('visibility', 'hidden');
    connected = true; rule = null; sent = 0; updates = 0; explored = false; disconnected = false; busy = false; answers.clear();
    get('lab-events').replaceChildren(); get('lab-port').value = '2'; get('lab-copy-status').textContent = '';
    root.querySelectorAll('input[type=radio]').forEach(n => { n.checked = false; });
    root.querySelectorAll('.lab-answer').forEach(n => { n.textContent = ''; });
    note('实验已重置。你可以先发一帧观察无规则的结果，也可以先安装规则。'); render();
  });
  root.querySelectorAll('input[type=radio]').forEach(input => input.addEventListener('change', () => {
    const field = input.closest('fieldset'); const correct = input.value === field.dataset.answer;
    answers.set(input.name, correct);
    field.querySelector('.lab-answer').textContent = (correct ? '✓ 正确。' : '再想一步：') + field.dataset.explanation; render();
  }));
  get('lab-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(get('lab-summary').value); get('lab-copy-status').textContent = '摘要已复制。'; }
    catch { get('lab-summary').focus(); get('lab-summary').select(); get('lab-copy-status').textContent = '请复制上面已选中的摘要。'; }
  });
  render();
})();
