(() => {
 const root=document.getElementById('table-miss-lab');if(!root)return;
 const get=id=>root.querySelector('#'+id);
 let installed=false,pending=false,mode='controller',busy=false,epoch=0,cancel=null;
 let reports=0,delivered=0,dropped=0;const seen=new Set();
 function render(){
  get('miss-live-rule').textContent=installed?'优先级100：目的B → 接口2':'尚无 B 的具体规则';
  get('miss-live-policy').textContent=mode==='controller'?'优先级0：其他帧 → 控制器':'优先级0：其他帧 → 丢弃';
  get('miss-controller-state').textContent=pending?'收到上报 · 待你处理':'等待新上报';
  get('miss-reports').textContent=String(reports);get('miss-delivered').textContent=String(delivered);get('miss-dropped').textContent=String(dropped);
  ['miss-send','miss-apply'].forEach(id=>get(id).disabled=busy);get('miss-install').disabled=busy||!pending;
  [reports>0,installed,seen.has('local')].forEach((done,i)=>get('miss-step-'+(i+1)).classList.toggle('done',done));
  get('miss-summary').value=`第十课：Table-miss 与 Packet-In\n兜底策略：${mode==='controller'?'上送控制器':'丢弃'}；B的具体规则：${installed?'已安装':'未安装'}。\nPacket-In：${reports}；本地交付：${delivered}；直接丢弃：${dropped}。\n已观察：${[...seen].join('、')||'尚未操作'}。\n规则安装后再发一帧为什么可能不上报：`;
 }
 const note=s=>{get('miss-feedback').textContent=s};
 get('miss-apply').addEventListener('click',()=>{if(busy)return;mode=get('miss-policy').value;note('已更新兜底策略。已有 B 的具体规则不会被删除；具体规则匹配时仍优先执行。');render()});
 get('miss-send').addEventListener('click',()=>{
  if(busy)return;const token=++epoch,hasRule=installed,policy=mode;busy=true;note('A 的帧正进入交换机……');render();
  cancel=window.TeachingPacketMotion(get('miss-input-path'),get('miss-packet'),()=>{
   if(token!==epoch)return;
   if(hasRule){
    note('匹配到 B 的具体规则，直接从接口2发出……');
    cancel=window.TeachingPacketMotion(get('miss-output-path'),get('miss-packet'),()=>{if(token!==epoch)return;delivered++;seen.add('local');busy=false;note('B收到这一帧。已有有效匹配规则，因此本帧没有触发新的 Packet-In。');render()});return;
   }
   if(policy==='drop'){dropped++;seen.add('miss-drop');busy=false;note('没有匹配的具体规则，执行兜底丢弃；不会自动上报控制器。');render();return}
   get('miss-packet').classList.add('control');note('没有匹配的具体规则，兜底指定上送；生成 Packet-In 消息……');
   cancel=window.TeachingPacketMotion(get('miss-up-path'),get('miss-packet'),()=>{if(token!==epoch)return;get('miss-packet').classList.remove('control');reports++;pending=true;seen.add('packet-in');busy=false;note('控制器收到 Packet-In。请点击处理上报并安装规则。本模型不回放首帧，安装后要另发一帧观察后续转发。');render()});
  });
 });
 get('miss-install').addEventListener('click',()=>{
  if(busy||!pending)return;const token=++epoch;busy=true;note('控制器决定允许到 B 的流量，下发“目的B → 接口2”的规则……');get('miss-packet').classList.add('control');render();
  cancel=window.TeachingPacketMotion(get('miss-down-path'),get('miss-packet'),()=>{if(token!==epoch)return;get('miss-packet').classList.remove('control');installed=true;pending=false;busy=false;seen.add('rule-installed');note('规则已安装；这不等于首帧已交付。请另点发送一帧，观察交换机直接查表转发。');render()});
 });
 get('miss-reset').addEventListener('click',()=>{epoch++;if(cancel)cancel();get('miss-packet').classList.remove('control');installed=pending=busy=false;mode='controller';reports=delivered=dropped=0;seen.clear();get('miss-policy').value='controller';note('已重置：无具体规则，兜底上送控制器。先发一帧。');render()});
 get('miss-copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(get('miss-summary').value);get('miss-copy-status').textContent='已复制'}catch{get('miss-summary').focus();get('miss-summary').select();get('miss-copy-status').textContent='请复制选中文字'}});
 render();
})();
