(() => {
 const root=document.getElementById('pressure-lab');if(!root)return;
 const get=id=>root.querySelector('#'+id);
 let queue=0,time=0,arrived=0,processed=0,history=[{t:0,q:0}];
 const read=()=>({packets:Number(get('pressure-packets').value),miss:Number(get('pressure-miss').value),capacity:Number(get('pressure-capacity').value)});
 function draw(){
  const p=read(),a=Math.round(p.packets*p.miss/100);
  get('pressure-packets-label').textContent=p.packets+' 帧/秒';get('pressure-miss-label').textContent=p.miss+'%';get('pressure-capacity-label').textContent=p.capacity+' 条/秒';
  get('pressure-arrival').textContent=String(a);get('pressure-service').textContent=String(p.capacity);get('pressure-queue').textContent=String(queue);get('pressure-time').textContent=String(time);
  get('pressure-processed').textContent=String(processed);get('pressure-total').textContent=String(arrived);
  const view=history.slice(-31),max=Math.max(500,...view.map(x=>x.q));
  get('pressure-y-max').textContent=String(max);get('pressure-x-start').textContent=view[0].t+'秒';get('pressure-x-end').textContent=time+'秒';
  const start=view[0].t,span=Math.max(1,time-start);
  get('pressure-line').setAttribute('points',view.map(x=>(65+(x.t-start)/span*625).toFixed(1)+','+(205-x.q/max*160).toFixed(1)).join(' '));
  const denominator=Math.max(a,p.capacity,1);
  get('pressure-arrival-bar').setAttribute('width',String(a/denominator*230));get('pressure-service-bar').setAttribute('width',String(p.capacity/denominator*230));
  get('pressure-status').textContent=a>p.capacity?`当前每秒上报 ${a} 条，大于处理能力 ${p.capacity} 条；持续不变时，每秒净增 ${a-p.capacity} 条待处理消息。`:a===p.capacity?`当前到达量与处理能力相等。模型中队列不会新增，但已有积压也不会减少；没有应对额外波动的余量。`:`当前处理能力多出 ${p.capacity-a} 条/秒，可用于清理已有积压；若队列为空则保持为零。`;
  get('pressure-summary').value=`第十一课：Packet-In资源压力\n模拟${time}秒；累计上报${arrived}条，处理${processed}条，积压${queue}条。\n当前总流量${p.packets}帧/秒，未匹配比例${p.miss}%，上报${a}条/秒，处理能力${p.capacity}条/秒。\n注意：简化模型，无真实网络访问；未匹配比例为外部给定。\n我的解释：`;
 }
 function reset(){queue=time=arrived=processed=0;history=[{t:0,q:0}];draw()}
 function advance(seconds){
  const p=read();
  for(let i=0;i<seconds;i++){
   const result=window.QueueLessonModel.step(queue,p.packets,p.miss,p.capacity);
   queue=result.queue;arrived+=result.arrivals;processed+=result.processed;time++;history.push({t:time,q:queue});
  }
  history=history.slice(-31);draw();
 }
 ['pressure-packets','pressure-miss','pressure-capacity'].forEach(id=>get(id).addEventListener('input',draw));
 get('pressure-step').addEventListener('click',()=>advance(1));get('pressure-ten').addEventListener('click',()=>advance(10));get('pressure-reset').addEventListener('click',reset);
 get('pressure-normal').addEventListener('click',()=>{get('pressure-packets').value='1000';get('pressure-miss').value='10';get('pressure-capacity').value='200';reset()});
 get('pressure-overload').addEventListener('click',()=>{get('pressure-packets').value='1000';get('pressure-miss').value='60';get('pressure-capacity').value='200';reset()});
 get('pressure-copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(get('pressure-summary').value);get('pressure-copy-status').textContent='已复制'}catch{get('pressure-summary').focus();get('pressure-summary').select();get('pressure-copy-status').textContent='请复制选中文字'}});
 draw();
})();
