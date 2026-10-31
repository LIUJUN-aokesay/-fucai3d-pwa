(()=>{'use strict';const $=x=>document.getElementById(x),KEY='kl8_v6_ledger';let db,rows=[],ledger={};const fmt=a=>a.map(x=>String(x).padStart(2,'0')).join(' ');function hash(s){let h=2166136261;for(let c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}function select(rr,n,seed,model){const counts=Array(81).fill(0);for(const r of rr)for(const v of r.numbers)counts[v]++;const m=rr.length;let scored=[];for(let i=1;i<=80;i++){let p=model==='recent'?(counts[i]+5)/(m+20):.25,tie=hash(seed+'|'+i)/4294967296;scored.push({i,score:p+tie*1e-8})}scored.sort((a,b)=>b.score-a.score);return scored.slice(0,n).map(x=>x.i).sort((a,b)=>a-b)}function pick(n){const seed=(rows[0]?.issue||'empty')+'|'+rows.length+'|'+n,train=rows.slice(0,300);return train.length>=100?select(train,n,seed,'recent'):select([],n,seed,'uniform')}
function validate(x){let issue=String(x.issue??x.period??'').trim(),date=String(x.date??x.draw_date??'').slice(0,10),nums=x.numbers?.nums??x.numbers?.digits??x.numbers??x.digits??x.codes??x.result;if(typeof nums==='string'){let s=nums.trim();nums=/^\d{40}$/.test(s)?s.match(/.{2}/g).map(Number):s.split(/[\s,，;|\-]+/).filter(Boolean).map(Number)}if(!Array.isArray(nums)||nums.length!==20||nums.some(n=>!Number.isInteger(+n)||+n<1||+n>80)||new Set(nums.map(Number)).size!==20)throw Error('号码格式无效');if(!/^\d{7,8}$/.test(issue)||!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('期号或日期无效');return {issue,date,numbers:nums.map(Number).sort((a,b)=>a-b),verified:!!x.verified,source:x.source||'历史导入'}}
function open(){return new Promise((ok,no)=>{let r=indexedDB.open('fucai_kl8_v1',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('draws'))r.result.createObjectStore('draws',{keyPath:'issue'})};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}function all(){return new Promise((ok,no)=>{let r=db.transaction('draws').objectStore('draws').getAll();r.onsuccess=()=>ok(r.result.sort((a,b)=>b.issue.localeCompare(a.issue)));r.onerror=()=>no(r.error)})}function put(x){return new Promise((ok,no)=>{let t=db.transaction('draws','readwrite');t.objectStore('draws').put(x);t.oncomplete=ok;t.onerror=()=>no(t.error)})}async function merge(list,source,verified){let added=0,dup=0,bad=0,conflicts=[];let map=new Map(rows.map(x=>[x.issue,x]));for(let x of list){try{let r=validate({...x,source:x.source||source,verified:x.verified??verified}),old=map.get(r.issue);if(old){if(old.date===r.date&&old.numbers.join()==r.numbers.join()){dup++;if(!old.verified&&r.verified){await put({...old,verified:true,source:r.source})}}else conflicts.push(r.issue)}else{await put(r);map.set(r.issue,r);added++}}catch{bad++}}rows=await all();render();return {added,dup,bad,conflicts}}
const hits=(a,b)=>a.filter(n=>b.includes(n)).length;function balls(a){return '<div class="ballset">'+a.map(n=>`<span class="ball">${String(n).padStart(2,'0')}</span>`).join('')+'</div>'}function ensure(){if(rows.length<100)return null;let issue=String(Number(rows[0].issue)+1);if(!ledger[issue]){ledger[issue]={issue,createdAt:new Date().toISOString(),basisIssue:rows[0].issue,algorithm:'recent300-v1',five:{nums:pick(5),status:'no',stake:null},ten:{nums:pick(10),status:'no',stake:null}};save()}return ledger[issue]}function addHistoricalPurchase(){
 const issue='2026289';
 if(ledger[issue])return;
 ledger[issue]={issue,createdAt:null,basisIssue:null,algorithm:'历史补录（非自动开奖前锁定）',retrospective:true,
   actualSnapshot:[2,4,5,6,7,11,16,17,18,33,34,36,47,56,58,62,68,73,76,78],
   five:{nums:[2,11,33,51,62],status:'yes',stake:null},
   ten:{nums:[2,11,12,14,33,35,37,39,51,62],status:'yes',stake:null}};
 save();
}
function save(){localStorage.setItem(KEY,JSON.stringify(ledger))}
function control(issue,g,val){const bought=val==='yes';return `<button type="button" class="buy-toggle ${bought?'bought':'ghost'}" data-buy="${issue}|${g}" aria-pressed="${bought}">${bought?'✓ 已购买 · 点击取消':'标记已购买'}</button>`}
function drawHtml(){return rows.slice(0,10).map(r=>`<div style="padding:10px 0;border-bottom:1px solid #e4cda6"><div class="line"><b>${r.issue}期</b><span class="status">${r.date} · ${r.verified?'已核验':'待核验'}</span></div><div class="nums">${fmt(r.numbers.slice(0,10))}<br>${fmt(r.numbers.slice(10))}</div></div>`).join('')||'暂无记录'}
// 2025-12-30 第2025350期起的官方奖金规则；更早期次暂不套用新规则。
// 固定奖金是规则标准值，实际兑奖以当期开奖公告（含限额赔付、派奖）为准。
const RULE_START='2025350';
const PRIZE_2025={five:{3:3,4:20,5:1000},ten:{0:2,5:3,6:5,7:80,8:720,9:8000}};
function award(g,h,issue){
  if(!Number.isInteger(h)||h<0||h>(g==='five'?5:10))return {kind:'invalid',amount:null,label:'命中数无效'};
  if(String(issue)<RULE_START)return {kind:'historical',amount:null,label:'旧期奖金待按当期规则核验'};
  if(g==='ten'&&h===10)return {kind:'floating',amount:null,label:'选十中十：浮动奖金，待当期开奖公告'};
  const amount=PRIZE_2025[g]?.[h]??0;
  return {kind:'fixed',amount,label:'规则标准奖金 ¥'+amount};
}function renderLedger(){
 let entries=Object.values(ledger).sort((a,b)=>b.issue.localeCompare(a.issue));
 let stake=0,estimated=0,pending=0,purchased=0,unknownStake=0;
 // 汇总全部记录，不仅仅是界面展示的最近100期。
 for(const e of entries)for(const g of ['five','ten']){
   const v=e[g],r=rows.find(x=>x.issue===e.issue);
   if(!v||v.status!=='yes')continue;
   purchased++;
   const cost=v.stake===null?null:Number(v.stake);if(cost!==null&&Number.isFinite(cost))stake+=cost;else unknownStake++;
   if(!r&&!e.actualSnapshot)continue;
   const p=award(g,hits(v.nums,r?.numbers||e.actualSnapshot),e.issue);
   if(p.kind==='fixed'&&cost!==null&&Number.isFinite(cost))estimated+=p.amount*cost/2;
   else pending++;
 }
 let html=entries.slice(0,100).map(e=>{
   let r=rows.find(x=>x.issue===e.issue);let actual=r?.numbers||e.actualSnapshot;
   let parts=['five','ten'].map(g=>{
     let v=e[g];if(!v)return '';
     let h=actual?hits(v.nums,actual):null,p=h===null?null:award(g,h,e.issue);
     let prize=h===null?'待开奖':p.label;
     let purchase=v.status==='yes'?'已买':'未买';
     return `<div class="line"><b>${g==='five'?'选五':'选十'}</b>${control(e.issue,g,v.status)}</div><div class="status">${fmt(v.nums)} · ${h===null?'待开奖':'命中'+h+'个'} · ${prize} · ${purchase}</div>${v.status==='yes'?`<label class="status">实际投入 ¥ <input type="number" min="2" step="2" style="width:95px" placeholder="待填写" data-stake="${e.issue}|${g}" value="${v.stake??''}"></label>`:''}`;
   }).join('');
   return `<details><summary>${e.issue}期 · ${r||e.actualSnapshot?'已开奖':'待开奖'}${e.retrospective?' · 历史补录':''}</summary>${parts}<p class="status">${e.retrospective?'历史补录：不作为开奖前自动锁定证据':('锁定于 '+e.createdAt)} · ${e.algorithm}</p>${e.retrospective?'<p class="status">本期两组均已买；购买金额未确认，请分别填写实际金额（每注2元的倍数）。</p>':''}</details>`;
 }).join('');
 $('ledgerRows').innerHTML=html||'暂无开奖前推荐记录';
 $('ledgerSummary').textContent=`记录${entries.length}期；已买${purchased}项；已确认投入¥${stake.toFixed(2)}${unknownStake?'；金额待补录'+unknownStake+'项':''}；已开奖且规则明确的标准奖金合计¥${estimated.toFixed(2)}；待核验${pending}项。未购买不计投入和奖金；标准奖金不等于已兑奖到账，未结算项目不计算确定净盈亏。`;
 $('lastResult').textContent=entries.filter(e=>rows.some(r=>r.issue===e.issue)||e.actualSnapshot).slice(0,1).map(e=>{let r=rows.find(x=>x.issue===e.issue);return `${e.issue}期：选五命中${hits(e.five.nums,r?.numbers||e.actualSnapshot)}个，选十命中${hits(e.ten.nums,r?.numbers||e.actualSnapshot)}个。详见「成绩」。`})[0]||'暂无已开奖的提前锁定推荐';
}
function render(){let e=ensure();$('dbCount').textContent=rows.length+'期';$('latest').textContent=rows[0]?rows[0].issue+'期 · '+rows[0].date:'本地暂无开奖';$('target').textContent=e?`目标 ${e.issue}期 · 依据 ${e.basisIssue}期及之前数据`:'历史不足100期';$('recommendations').innerHTML=e?['five','ten'].map(g=>`<div class="panel" style="margin:0;background:#fff0d9"><b>${g==='five'?'选五':'选十'} · ${e.issue}期</b>${balls(e[g].nums)}<div class="line">${control(e.issue,g,e[g].status)}${e[g].status==='yes'?`<label>投入 ¥<input type="number" min="2" step="2" style="width:78px" data-stake="${e.issue}|${g}" value="${e[g].stake??2}"></label>`:''}</div></div>`).join(''):'请先导入至少100期历史开奖';$('recInfo').textContent=e?`锁定时间：${new Date(e.createdAt).toLocaleString('zh-CN')}；当前算法保持不变。重复打开不会改变同一期候选。`:'无足够数据，不生成正式推荐';$('recentHome').innerHTML=drawHtml();$('recentDraws').innerHTML=drawHtml();$('dataHealth').textContent=`本地${rows.length}期；最新${rows[0]?.issue||'无'}；待核验${rows.filter(r=>!r.verified).length}期。`;renderLedger()}
async function update(){[$('updateHome'),$('updateDraws')].forEach(x=>x.disabled=true);let messages=[],limit=Number($('limit').value);for(let s of [{name:'仓库官方核验文件',url:'./kl8_official_verified.json',verified:true},{name:'公开开奖镜像',url:'https://raw.githubusercontent.com/wenjinliuu/lottery-data-repo/main/public_data/v2/draws/kl8.json',verified:false}]){try{let r=await fetch(s.url+(s.url.includes('?')?'&':'?')+'t='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('HTTP '+r.status);let j=await r.json(),list=Array.isArray(j)?j:j.draws||j.data||j.list;if(!Array.isArray(list))throw Error('无开奖记录数组');list=list.slice().sort((a,b)=>String(b.issue).localeCompare(String(a.issue)));let v=await merge(list.slice(0,limit),s.name,s.verified);messages.push(`${s.name}：源最新${list[0]?.issue||'未知'}，新增${v.added}，重复${v.dup}，无效${v.bad}，冲突${v.conflicts.length}`)}catch(e){messages.push(`${s.name}：暂不可用（${e.message}）`)}}$('sourceStatus').textContent='最近检查：'+new Date().toLocaleString('zh-CN');$('updateMsg').textContent=messages.join('\n');$('updateDetails').textContent=messages.join('\n');[$('updateHome'),$('updateDraws')].forEach(x=>x.disabled=false)}
function download(name,s,type='application/json'){let a=document.createElement('a'),url=URL.createObjectURL(new Blob([s],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)}function csvRows(s){let lines=s.replace(/^\uFEFF/,'').trim().split(/\r?\n/),head=lines.shift().split(',');return lines.map(l=>{let m=l.match(/^([^,]+),([^,]+),"?([^"]+)"?$/);return m?{issue:m[1],date:m[2],numbers:m[3]}:Object.fromEntries(l.split(',').map((v,i)=>[head[i],v]))})}function backtest(){
 if(rows.length<101)return '至少需要101期历史；当前'+rows.length+'期。';
 const a=rows.slice().reverse(), start=100, total=a.length-start, out=[];
 for(const n of [5,10]){
  const result={recent300:{sum:0,full:0},allHistory:{sum:0,full:0},uniform:{sum:0,full:0}};
  for(let i=start;i<a.length;i++){
   const prior=a.slice(0,i).reverse(),actual=a[i].numbers;
   const picks={
    recent300:select(prior.slice(0,300),n,'kl8|'+a[i].issue,'recent'),
    allHistory:select(prior,n,'kl8|'+a[i].issue,'recent'),
    uniform:select([],n,'base|'+a[i].issue,'uniform')
   };
   for(const [key,pick] of Object.entries(picks)){
    const h=hits(pick,actual);result[key].sum+=h;if(h===n)result[key].full++;
   }
  }
  out.push(`选${n}｜回测${total}期（每期仅用之前的数据）`);
  for(const [key,label] of [['recent300','现行近300期'],['allHistory','实验全历史'],['uniform','均匀基准']]){
   const r=result[key];out.push(`${label}：平均命中${(r.sum/total).toFixed(3)}个；全中${r.full}次`);
  }
  out.push(`理论平均命中${(n/4).toFixed(3)}个。`);
 }
 return out.join('\n')+'\n不同模型使用同一回测区间；现行推荐算法未修改。历史表现不保证未来中奖。';
}
async function init(){try{ledger=JSON.parse(localStorage.getItem(KEY)||'{}');for(const e of Object.values(ledger)){for(const g of ['five','ten'])if(e[g]?.status==='unset')e[g].status='no'}addHistoricalPurchase();db=await open();rows=await all();render()}catch(e){$('updateMsg').textContent='初始化失败：'+e.message}}document.querySelectorAll('.nav button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.nav button').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id===b.dataset.page));scrollTo(0,0)});$('updateHome').onclick=update;$('updateDraws').onclick=update;document.addEventListener('click',e=>{const b=e.target.closest('[data-buy]');if(!b)return;const [issue,g]=b.dataset.buy.split('|');const v=ledger[issue]?.[g];if(!v)return;v.status=v.status==='yes'?'no':'yes';if(v.status==='yes'&&(v.stake===null||!Number.isFinite(Number(v.stake))))v.stake=2;save();render()});document.addEventListener('change',e=>{let t=e.target;if(t.dataset.stake){let [issue,g]=t.dataset.stake.split('|');if(ledger[issue]?.[g]){let amount=Number(t.value);if(!Number.isFinite(amount)||amount<2||amount%2!==0){alert('投注金额必须为2元的正整数倍');t.value=ledger[issue][g].stake??'';return}ledger[issue][g].stake=amount;save();renderLedger()}}});$('statsBtn').onclick=()=>{let c=Array(81).fill(0);for(let r of rows)for(let n of r.numbers)c[n]++;$('statsOutput').textContent=`全历史${rows.length}期，每个号码理论出现频率25%\n`+c.slice(1).map((v,i)=>String(i+1).padStart(2,'0')+':'+v).join('  ')};$('backtestBtn').onclick=()=>$('statsOutput').textContent=backtest();$('importBtn').onclick=async()=>{try{let f=$('importFile').files[0];if(!f)throw Error('请选择文件');let s=await f.text(),j=f.name.endsWith('.json')?JSON.parse(s):csvRows(s),list=Array.isArray(j)?j:j.draws||j.data||j.list;if(!Array.isArray(list))throw Error('找不到开奖记录数组');let r=await merge(list,'历史导入',false);if(j.ledger&&typeof j.ledger==='object'&&!Array.isArray(j.ledger)){for(let [k,v] of Object.entries(j.ledger))if(!ledger[k])ledger[k]=v;save();render()}$('importMsg').textContent=`新增${r.added}，重复${r.dup}，无效${r.bad}，冲突${r.conflicts.length}。`}catch(e){$('importMsg').textContent=e.message}};$('exportDraws').onclick=()=>download('kl8_history.csv','\uFEFFissue,date,numbers\n'+rows.slice().reverse().map(r=>`${r.issue},${r.date},"${fmt(r.numbers)}"`).join('\n'),'text/csv');$('exportAll').onclick=()=>download('kl8_v6_full_backup.json',JSON.stringify({draws:rows,ledger,exportedAt:new Date().toISOString()},null,2));$('exportLedger').onclick=()=>download('kl8_recommendations.json',JSON.stringify(ledger,null,2));init();})();
