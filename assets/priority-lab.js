(() => {
 const root=document.getElementById('priority-lab');if(!root)return;
 const get=id=>root.querySelector('#'+id);
 let rules={general:100,specific:200},busy=false,epoch=0,cancel=null;
 const counts={general:0,specific:0},seen=new Set();
 function render(){
  get('priority-live-general').textContent=String(rules.general);get('priority-live-specific').textContent=String(rules.specific);
  get('priority-count-general').textContent=String(counts.general);get('priority-count-specific').textContent=String(counts.specific);
  ['priority-apply','priority-send','priority-swap'].forEach(id=>{get(id).disabled=busy});
  get('priority-summary').value=`第九课：优先级\n已安装：目的B→接口2，优先级${rules.general}；源A且目的B→丢弃，优先级${rules.specific}。\n获胜计数：一般规则${counts.general}，特定规则${counts.specific}。\n已观察：${[...seen].join('、')||'尚未操作'}\n我的解释：`;
 }
 const note=s=>{get('priority-feedback').textContent=s};
 function apply(){
  if(busy)return;
  const general=Number(get('priority-general').value),specific=Number(get('priority-specific').value);
  if(general===specific){note('未安装：两条有重叠的规则优先级相同。规范不保证此时选择哪条；本实验要求设成不同数值，旧配置保持不变。');return}
  rules={general,specific};counts.general=counts.specific=0;
  ['general','specific'].forEach(k=>get('priority-row-'+k).classList.remove('selected-row'));
  note('两条规则已安装。发一帧，先看哪些条件匹配，再比较优先级；新规则计数器已归零。');render();
 }
 get('priority-apply').addEventListener('click',apply);
 get('priority-swap').addEventListener('click',()=>{if(busy)return;get('priority-general').value=String(rules.specific);get('priority-specific').value=String(rules.general);apply()});
 get('priority-send').addEventListener('click',()=>{
  if(busy)return;
  const source=get('priority-source').value,token=++epoch;
  const specificMatches=source==='A';
  const winner=specificMatches&&rules.specific>rules.general?'specific':'general';
  busy=true;note(`源${source}、目的B的帧正从接口1进入……`);render();
  ['general','specific'].forEach(k=>get('priority-row-'+k).classList.remove('selected-row'));
  cancel=window.TeachingPacketMotion(get('priority-input-path'),get('priority-packet'),()=>{
   if(token!==epoch)return;
   const candidates=specificMatches?'两条条件都匹配':'仅一般规则匹配（源不是A）';
   counts[winner]++;seen.add(source==='A'?(winner==='specific'?'双匹配选丢弃':'双匹配选转发'):'排除不匹配规则');
   get('priority-row-'+winner).classList.add('selected-row');
   if(winner==='specific'){
    busy=false;note(`${candidates}。特定规则优先级${rules.specific}较高，只执行它的丢弃，不再执行低优先级转发。`);render();return;
   }
   note(`${candidates}。选中一般规则，执行接口2输出……`);
   cancel=window.TeachingPacketMotion(get('priority-output-path'),get('priority-packet'),()=>{
    if(token!==epoch)return;busy=false;
    note(`${candidates}。一般规则获胜，B收到帧。${specificMatches?'更具体的规则不会自动胜出，必须比较显式优先级。':'即使特定规则数字更高，不匹配的规则也不能参与选择。'}`);render();
   });
  });
 });
 get('priority-reset').addEventListener('click',()=>{
  epoch++;if(cancel)cancel();busy=false;rules={general:100,specific:200};counts.general=counts.specific=0;seen.clear();
  get('priority-general').value='100';get('priority-specific').value='200';get('priority-source').value='A';
  ['general','specific'].forEach(k=>get('priority-row-'+k).classList.remove('selected-row'));
  note('已恢复初始已安装配置：一般100，特定200。');render();
 });
 get('priority-copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(get('priority-summary').value);get('priority-copy-status').textContent='已复制'}catch{get('priority-summary').focus();get('priority-summary').select();get('priority-copy-status').textContent='请复制选中文字'}});
 render();
})();
