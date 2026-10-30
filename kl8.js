/* 快乐8模块：独立IndexedDB，全部计算在本机进行。 */
(()=>{'use strict';
const el=id=>document.getElementById(id), DB='fucai_kl8_v1';let db;
const fmt=a=>a.map(n=>String(n).padStart(2,'0')).join(' ');
function validate(x){
  if(!x||typeof x!=='object')throw Error('记录不是对象');
  const issue=String(x.issue??x.period??x.code??x.issueNo??x.drawNo??'').trim();
  const dateRaw=x.date??x.draw_date??x.drawDate??x.openTime??x.open_date??x.draw_time??'';
  let date=String(dateRaw).trim().slice(0,10).replace(/\//g,'-');
  const candidates=[x.numbers?.digits,x.numbers?.values,x.numbers?.list,x.numbers?.red,x.numbers?.balls,x.numbers,x.digits,x.codes,x.result,x.openCode,x.open_code,x.drawResult,x.draw_result,x.lotteryDrawResult,x.number,x.balls,x.red,x.redBalls,x.detail];
  function parse(v){
    if(v==null)return null;
    if(Array.isArray(v)){
      if(v.length===20&&v.every(z=>typeof z==='number'||typeof z==='string'))return v.map(Number);
      if(v.length===1)return parse(v[0]);
      return null;
    }
    if(typeof v==='object'){
      for(const key of ['digits','values','list','numbers','red','balls','codes','result','value','data']){const r=parse(v[key]);if(r)return r}
      return null;
    }
    if(typeof v==='string'){
      const t=v.trim();
      if(/^\d{40}$/.test(t))return t.match(/.{2}/g).map(Number);
      const parts=t.split(/[\s,，;；|\/\-、]+/).filter(Boolean);
      if(parts.length===20&&parts.every(z=>/^\d{1,2}$/.test(z)))return parts.map(Number);
      return null;
    }
    return null;
  }
  let nums=null;for(const v of candidates){nums=parse(v);if(nums)break}
  if(!nums)throw Error('未识别20个号码；字段：'+Object.keys(x).slice(0,18).join(','));
  if(nums.length!==20||nums.some(n=>!Number.isInteger(n)||n<1||n>80)||new Set(nums).size!==20)throw Error('开奖号码必须为20个不同的01—80号码');
  if(!/^\d{7,8}$/.test(issue))throw Error('期号格式错误：'+issue);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('日期格式错误：'+String(dateRaw).slice(0,40));
  return {issue,date,numbers:nums.sort((a,b)=>a-b)};
}
function open(){return new Promise((yes,no)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore('draws',{keyPath:'issue'});r.onsuccess=()=>yes(r.result);r.onerror=()=>no(r.error)})}
function getAll(){return new Promise((yes,no)=>{let r=db.transaction('draws').objectStore('draws').getAll();r.onsuccess=()=>yes(r.result.sort((a,b)=>b.issue.localeCompare(a.issue)));r.onerror=()=>no(r.error)})}
function readOne(k){return new Promise((yes,no)=>{let r=db.transaction('draws').objectStore('draws').get(k);r.onsuccess=()=>yes(r.result);r.onerror=()=>no(r.error)})}
function insert(x){return new Promise((yes,no)=>{let t=db.transaction('draws','readwrite');t.objectStore('draws').add(x);t.oncomplete=yes;t.onerror=()=>no(t.error)})}
async function merge(rows){let added=0,duplicate=0,invalid=0,conflicts=[],examples=[];for(const raw of rows){try{const r=validate(raw),old=await readOne(r.issue);if(old){if(old.date===r.date&&old.numbers.join(',')===r.numbers.join(','))duplicate++;else conflicts.push(r.issue)}else{await insert(r);added++}}catch(e){invalid++;if(examples.length<3)examples.push(String(e.message||e))}}await render();return {added,duplicate,invalid,conflicts,examples}}

function hash(s){let h=2166136261;for(let c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function select(rows,n,seed,model){const counts=Array(81).fill(0);for(const r of rows)for(const v of r.numbers)counts[v]++;const m=rows.length;let scored=[];for(let i=1;i<=80;i++){let p=model==='recent'?(counts[i]+5)/(m+20):.25;const tie=hash(seed+'|'+i)/4294967296;scored.push({i,score:p+tie*1e-8})}scored.sort((a,b)=>b.score-a.score);return scored.slice(0,n).map(x=>x.i).sort((a,b)=>a-b)}
function matches(pick,actual){const s=new Set(actual);return pick.filter(x=>s.has(x)).length}
function probability(n,k){const comb=(a,b)=>{if(b<0||b>a)return 0;let v=1;for(let i=1;i<=b;i++)v=v*(a-i+1)/i;return v};return comb(20,k)*comb(60,n-k)/comb(80,n)}
function candidate(rows,n){const seed=(rows[0]?.issue||'empty')+'|'+rows.length+'|'+n;const train=rows.slice(0,Math.min(300,rows.length));const enough=train.length>=100;const uniform=select([],n,seed,'uniform');const weighted=select(train,n,seed,'recent');return {nums:enough?weighted:uniform,model:enough?'近300期平滑频率实验模型':'均匀基准（样本不足）'}}
function report(rows){let a=rows.slice().reverse();const warm=100, trials=Math.max(0,a.length-warm);if(!trials)return '真实滚动回测需要至少101期；当前'+a.length+'期。';let out=[];for(let n of [5,10]){let score=0,base=0,full=0;for(let i=warm;i<a.length;i++){let prior=a.slice(Math.max(0,i-300),i).reverse(),r=a[i];let p=select(prior,n,'kl8|'+r.issue,'recent'),b=select([],n,'base|'+r.issue,'uniform');score+=matches(p,r.numbers);base+=matches(b,r.numbers);if(matches(p,r.numbers)===n)full++}out.push(`选${n===5?'五':'十'}：${trials}期；模型平均命中 ${(score/trials).toFixed(3)}个，随机基准 ${(base/trials).toFixed(3)}个；全中 ${full}次。理论平均命中 ${(n/4).toFixed(3)}个。`)}return out.join('\n')+'\n回测只使用开奖前数据；没有证明未来预测优势。'}
async function render(){const rows=await getAll();el('klCount').textContent=rows.length;el('klLatest').textContent=rows[0]?`最新 ${rows[0].issue} · ${rows[0].date}`:'暂无数据：先联网更新或导入历史JSON/CSV';el('klRecent').innerHTML=rows.slice(0,10).map(r=>`<tr><td>${r.issue}</td><td>${r.date}</td><td style="white-space:normal;min-width:215px">${fmt(r.numbers)}</td></tr>`).join('')||'<tr><td colspan="3">暂无开奖数据</td></tr>';const a=candidate(rows,5),b=candidate(rows,10);el('klFive').textContent=fmt(a.nums);el('klTen').textContent=fmt(b.nums);el('klModels').textContent=`选五：${a.model}；选十：${b.model}。\n同一数据库状态下结果固定，开奖更新后重新计算。\n指定选五全中理论概率 ${(probability(5,5)*100).toFixed(5)}%；指定选十全中理论概率 ${(probability(10,10)*100).toFixed(8)}%。`}
function unpack(json){if(Array.isArray(json))return json;if(Array.isArray(json.draws))return json.draws;if(Array.isArray(json.data))return json.data;if(Array.isArray(json.list))return json.list;throw Error('数据源没有可识别的draws数组')}
async function update(){const btn=el('klUpdateBtn');btn.disabled=true;el('klMsg').textContent='联网检查中…';try{const url='https://raw.githubusercontent.com/wenjinliuu/lottery-data-repo/main/public_data/v2/draws/kl8.json';const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);let response;try{response=await fetch(url,{cache:'no-store',signal:controller.signal})}finally{clearTimeout(timer)}if(!response.ok)throw Error('HTTP '+response.status);const all=unpack(await response.json()).sort((a,b)=>String(b.issue).localeCompare(String(a.issue))),limit=Number(el('klLimit').value),recent=all.slice(0,limit),result=await merge(recent);el('klMsg').textContent=`数据源最新：${all[0]?.issue||'未知'}；检查${recent.length}期。\n新增${result.added}，重复${result.duplicate}，无效${result.invalid}，冲突${result.conflicts.join(',')||'无'}。\n${result.invalid?'无效原因：'+result.examples.join('；')+'。\n':''}数据镜像通常次日更新，不是即时开奖接口。`}catch(e){el('klMsg').textContent='联网更新失败：'+e.message+'。本地数据和离线功能不受影响。'}finally{btn.disabled=false}}
function csvRows(s){const lines=s.replace(/^\uFEFF/,'').trim().split(/\r?\n/).filter(Boolean);const headers=lines.shift().split(',').map(x=>x.trim().toLowerCase());return lines.map(line=>{let c=line.split(','),r={};headers.forEach((h,i)=>r[h]=c[i]);return {issue:r.issue,date:r.date||r.draw_date,numbers:(r.numbers||r.digits||r.nums||r.result||'').replace(/^"|"$/g,'')}})}
async function importFile(){const f=el('klFile').files[0];if(!f)return;try{const s=await f.text(),rows=f.name.toLowerCase().endsWith('.json')?unpack(JSON.parse(s)):csvRows(s),res=await merge(rows);el('klImportMsg').textContent=JSON.stringify(res)}catch(e){el('klImportMsg').textContent='导入失败：'+e.message}}
async function exportCSV(){const rows=await getAll(),csv='issue,date,numbers\n'+rows.slice().reverse().map(r=>`${r.issue},${r.date},"${fmt(r.numbers)}"`).join('\n');const url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='kl8_backup.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000)}
async function stats(){const rows=await getAll(),counts=Array(81).fill(0);for(let r of rows)for(let x of r.numbers)counts[x]++;let n=rows.length;if(!n){el('klStats').textContent='暂无数据';return}let chi=counts.slice(1).reduce((a,v)=>a+(v-n/4)**2/(n/4),0);el('klStats').textContent=`全部 ${n} 期 · 01—80每号理论期望 ${n/4} 次\n频率卡方描述量（注意同期开奖号码不独立） ${chi.toFixed(2)}\n${counts.slice(1).map((v,i)=>String(i+1).padStart(2,'0')+':'+v).join('  ')}`}
async function init(){try{db=await open();await render();el('klUpdateBtn').onclick=update;el('klImportBtn').onclick=importFile;el('klExportBtn').onclick=exportCSV;el('klStatsBtn').onclick=stats;el('klBacktestBtn').onclick=async()=>el('klBacktest').textContent=report(await getAll())}catch(e){el('klMsg').textContent='初始化失败：'+e.message}}init();
})();
