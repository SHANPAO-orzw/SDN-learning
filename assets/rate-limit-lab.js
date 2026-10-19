(() => {
 const root=document.getElementById('rate-limit-lab');if(!root)return;
 const get=id=>root.querySelector('#'+id),fmt=n=>Number(n.toFixed(1)).toLocaleString('zh-CN');
 let queue=0,time=0,blockedTotal=0,legalBlockedTotal=0,processedTotal=0;
 const read=()=>({offered:Number(get('limit-offered').value),legal:Number(get('limit-legal').value),limit:Number(get('limit-threshold').value),capacity:200,enabled:get('limit-enabled').checked});
 const result=()=>{const p=read();return window.RateLimitLessonModel.step(queue,p.offered,p.legal,p.limit,p.capacity,p.enabled)};
 function render(){
  const p=read(),r=result();
  get('limit-offered-label').textContent=p.offered+' 条/秒';get('limit-legal-label').textContent=p.legal+'%';get('limit-threshold-label').textContent=p.limit+' 条/秒';
  get('limit-admitted').textContent=fmt(r.admitted);get('limit-legal-admitted').textContent=fmt(r.legalAdmitted);get('limit-legal-blocked').textContent=fmt(r.legalBlocked);get('limit-queue').textContent=fmt(queue);get('limit-time').textContent=String(time);
  get('limit-blocked-total').textContent=fmt(blockedTotal);get('limit-legal-blocked-total').textContent=fmt(legalBlockedTotal);
  get('limit-svg-offered').textContent=fmt(p.offered)+' 条/秒';get('limit-svg-admitted').textContent=fmt(r.admitted)+' 条/秒';get('limit-svg-blocked').textContent=fmt(r.blocked)+' 条/秒被丢弃';get('limit-svg-queue').textContent='当前积压 '+fmt(queue)+' 条';
  const max=Math.max(1,p.offered);get('limit-allow-bar').setAttribute('width',String(r.admitted/max*500));get('limit-block-bar').setAttribute('x',String(85+r.admitted/max*500));get('limit-block-bar').setAttribute('width',String(r.blocked/max*500));
  const trend=r.admitted>p.capacity?`仍超过处理能力：持续不变时，积压每秒净增 ${fmt(r.admitted-p.capacity)} 条。`:r.admitted===p.capacity?'进入量恰好等于处理能力：从空队列开始不新增积压，但已有积压不会消退。':`进入量低于处理能力：每秒最多清理 ${fmt(p.capacity-r.admitted)} 条已有积压。`;
  get('limit-feedback').textContent=trend+` 按本模型的比例假设，每秒允许 ${fmt(r.legalAdmitted)} 条合法消息进入，同时丢弃 ${fmt(r.legalBlocked)} 条合法消息；限速没有识别消息好坏。`;
  get('limit-summary').value=`第十二课：上报限速的代价\n模拟${time}秒，当前积压${fmt(queue)}条；累计处理${fmt(processedTotal)}条。\n当前原始上报需求${p.offered}条/秒，合法占${p.legal}%，${p.enabled?'启用限速'+p.limit+'条/秒':'不限速'}，处理能力200条/秒。\n按比例模型每秒合法进入${fmt(r.legalAdmitted)}条、合法被限丢弃${fmt(r.legalBlocked)}条。\n累计限丢弃${fmt(blockedTotal)}条，其中合法${fmt(legalBlockedTotal)}条。\n为什么队列不增长不等于防御没有代价：`;
 }
 function advance(n){for(let i=0;i<n;i++){const r=result();queue=r.queue;blockedTotal+=r.blocked;legalBlockedTotal+=r.legalBlocked;processedTotal+=r.processed;time++}render()}
 function reset(){queue=time=blockedTotal=legalBlockedTotal=processedTotal=0;render()}
 ['limit-offered','limit-legal','limit-threshold'].forEach(id=>get(id).addEventListener('input',render));get('limit-enabled').addEventListener('change',render);
 get('limit-step').addEventListener('click',()=>advance(1));get('limit-ten').addEventListener('click',()=>advance(10));get('limit-reset').addEventListener('click',reset);
 get('limit-baseline').addEventListener('click',()=>{get('limit-offered').value='600';get('limit-legal').value='20';get('limit-threshold').value='200';get('limit-enabled').checked=false;reset()});
 get('limit-capped').addEventListener('click',()=>{get('limit-offered').value='600';get('limit-legal').value='20';get('limit-threshold').value='200';get('limit-enabled').checked=true;reset()});
 get('limit-copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(get('limit-summary').value);get('limit-copy-status').textContent='已复制'}catch{get('limit-summary').focus();get('limit-summary').select();get('limit-copy-status').textContent='请复制选中文字'}});
 render();
})();
