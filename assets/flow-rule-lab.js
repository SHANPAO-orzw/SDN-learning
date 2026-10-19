(() => {
  const root = document.getElementById('flow-rule-lab');
  if (!root) return;
  const get = id => root.querySelector('#' + id);
  let rule = null, busy = false, cancelMotion = null, epoch = 0;
  let matched = 0, missed = 0, delivered = 0, dropped = 0;
  const seen = new Set();
  const name = value => value === 'drop' ? '丢弃（不输出）' : '输出到接口 ' + value;
  function update() {
    get('flow-match').textContent = rule ? `目的 MAC = ${rule.dest}（…:${rule.dest === 'B' ? '0b' : '0c'}）` : '尚未安装规则';
    get('flow-action').textContent = rule ? name(rule.action) : '—';
    get('flow-hits').textContent = String(matched);
    get('flow-misses').textContent = String(missed);
    get('flow-delivered').textContent = String(delivered);
    get('flow-drops').textContent = String(dropped);
    ['flow-install', 'flow-send'].forEach(id => { get(id).disabled = busy; });
    [rule !== null, seen.has('hit'), seen.has('miss'), seen.has('drop')].forEach((done, i) => get('flow-step-' + (i + 1)).classList.toggle('done', done));
    get('flow-summary').value = `第八课：匹配条件与动作\n当前规则：${rule ? '目的=' + rule.dest + ' → ' + name(rule.action) : '无'}\n匹配 ${matched} 次；未匹配 ${missed} 次；正确交付 ${delivered} 帧；丢弃 ${dropped} 帧。\n已观察：${[...seen].join('、') || '尚未操作'}\n为什么未匹配不等于自动泛洪：`;
  }
  const feedback = message => { get('flow-feedback').textContent = message; };
  get('flow-install').addEventListener('click', () => {
    if (busy) return;
    rule = {dest: get('flow-rule-dest').value, action: get('flow-rule-action').value};
    matched = 0;
    feedback(`规则已替换为：目的 ${rule.dest} → ${name(rule.action)}。这里只保留一条具体规则，计数器随该规则重置。`); update();
  });
  get('flow-send').addEventListener('click', () => {
    if (busy) return;
    const dest = get('flow-frame-dest').value, current = rule && {...rule};
    const token = ++epoch; busy = true; feedback(`A 发出目的为 ${dest} 的帧，正在进入交换机……`); update();
    cancelMotion = window.TeachingPacketMotion(get('flow-input-path'), get('flow-packet'), () => {
      if (token !== epoch) return;
      const hit = current && current.dest === dest;
      if (!hit) {
        missed++; dropped++; seen.add('miss'); busy = false;
        feedback(`未匹配：目的为 ${dest}，没有命中具体规则。本实验的兜底规则是丢弃，因此帧停在交换机，不会自动泛洪或上送控制器。`); update(); return;
      }
      matched++; seen.add('hit');
      if (current.action === 'drop') {
        dropped++; seen.add('drop'); busy = false;
        feedback('匹配成功，但动作是丢弃：命中规则不等于一定转发。'); update(); return;
      }
      feedback(`目的匹配成功，执行“${name(current.action)}”……`);
      cancelMotion = window.TeachingPacketMotion(get('flow-path-' + current.action), get('flow-packet'), () => {
        if (token !== epoch) return;
        const receiver = current.action === '2' ? 'B' : 'C';
        if (receiver === dest) { delivered++; feedback(`交换机按规则从接口 ${current.action} 发出，${receiver} 收到发给自己的帧。`); }
        else { dropped++; feedback(`交换机执行了规则，但接口 ${current.action} 连接 ${receiver}，目的却是 ${dest}；${receiver} 的普通网卡过滤此帧。规则可以配置错误，执行不保证送达。`); }
        busy = false; update();
      });
    });
  });
  get('flow-reset').addEventListener('click', () => {
    epoch++; if (cancelMotion) cancelMotion(); busy = false; rule = null;
    matched = missed = delivered = dropped = 0; seen.clear();
    get('flow-rule-dest').value = 'B'; get('flow-rule-action').value = '2'; get('flow-frame-dest').value = 'B';
    feedback('已重置。先安装“目的 B → 接口2”，再试发给 B 和 C。'); update();
  });
  get('flow-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(get('flow-summary').value); get('flow-copy-status').textContent = '已复制'; }
    catch { get('flow-summary').focus(); get('flow-summary').select(); get('flow-copy-status').textContent = '请复制选中的文字'; }
  });
  update();
})();
