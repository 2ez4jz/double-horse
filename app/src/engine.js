import { ROOMS } from './data.js';
export const money = n => new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(n/100);
const names=['Mooncake','冰镇可乐','Thunderpaw','晚风','小熊软糖','Silverleaf','奶糖','Ashbringer','星河','Mochi','乌龙茶','Duskblade','北境','Windrunner','芝士','Foxglove','山海','小橘','Raven','Hearth','晚安','团团','Seabreeze','Frost','雪球','Wanderer','薄荷','Lucky','松果','Yuki','阿布','Nova','玉米','Fable','黑糖','Panda','Echo','Maple','Cloud'];
const classes=['战士','牧师','法师','萨满','猎人','术士','德鲁伊','盗贼','圣骑士'];
export function fresh(){return {version:1,sessionId:globalThis.crypto?.randomUUID?.()||String(Date.now()),roomId:null,members:[],phase:'lobby',bossIndex:0,defeated:[],drops:[],ledger:[],logs:[],seq:0,settlement:null,settings:{commission:10,leader:10000,tank:5000,healer:2500,bonus:0,bonusPlayer:'self',bonusRate:0,fee:0},simulation:true};}
export const roomOf=s=>ROOMS.find(r=>r.id===s.roomId);
export function collected(s){return (s.ledger||[]).reduce((n,e)=>n+(e.type==='receipt'?e.amount:-e.amount),0);}
function requireThat(condition,message){if(!condition)throw new Error(message);}
function log(s,text){s.logs.unshift({id:++s.seq,time:new Date().toISOString(),text});}
export function settlementPreview(s){
 const total=collected(s),v=s.settings,n=s.members.length;
 const commission=Math.round(total*v.commission/100),fees=v.fee;
 const subsidies=s.members.map(m=>({id:m.id,value:(m.leader?v.leader:0)+(m.role==='tank'?v.tank:0)+(m.role==='healer'?v.healer:0)+(m.id===v.bonusPlayer?v.bonus+Math.round(total*v.bonusRate/100):0)}));
 const subsidyTotal=subsidies.reduce((a,b)=>a+b.value,0),pool=total-commission-fees-subsidyTotal;
 const base=n?Math.floor(Math.max(pool,0)/n):0,remainder=n?Math.max(pool,0)%n:0;
 const payouts=s.members.map((m,i)=>({id:m.id,name:m.name,role:m.role,account:m.account,method:m.method,base:base+(i<remainder?1:0),subsidy:subsidies[i].value,amount:base+(i<remainder?1:0)+subsidies[i].value,status:'pending',attempts:0}));
 return {total,commission,fees,subsidyTotal,pool,base,remainder,payouts,valid:pool>=0&&n>0};
}
export function step(state,action,actor='leader',now=Date.now()){
 const s=structuredClone(state),{type}=action;
 const leader=()=>requireThat(actor==='leader','请切换到团长视角操作');
 const unlocked=()=>requireThat(!s.settlement,'结算已经锁定，不能修改账目');
 const drop=()=>{const d=s.drops.find(d=>d.id===action.id);requireThat(d,'装备记录不存在');return d;};
 const live=()=>requireThat(s.phase==='live','请先开始团本');
 switch(type){
 case 'JOIN':{
  requireThat(s.phase==='lobby','请先退出当前房间');
  const room=ROOMS.find(r=>r.id===action.roomId);requireThat(room,'房间不存在');
  requireThat(action.name?.trim()&&action.name.trim().length<=20,'请输入 1–20 字昵称');
  requireThat(classes.includes(action.className),'请选择职业');requireThat(['tank','healer','dps'].includes(action.role),'请选择定位');
  s.roomId=room.id;s.phase='waiting';
  s.members=[{id:'self',name:action.name.trim(),className:action.className,role:action.role,leader:false,account:'',method:'EMT'}];
  log(s,`${action.name.trim()} 加入了团队。`);break;
 }
 case 'LEAVE': requireThat(s.phase==='waiting','开团后不能退出演示团队');return fresh();
 case 'FILL':{
  requireThat(s.phase==='waiting','当前不在匹配阶段');
  const cap=roomOf(s).capacity,target=action.one?Math.min(cap,s.members.length+1):cap;
  const tanks=cap===40?2:1,healers=cap===40?4:cap===20?3:2;
  while(s.members.length<target){const i=s.members.length;const t=s.members.filter(m=>m.role==='tank').length,h=s.members.filter(m=>m.role==='healer').length;const role=t<tanks?'tank':h<healers?'healer':'dps';
   s.members.push({id:`bot-${i}`,name:names[(i-1)%names.length],className:role==='tank'?'战士':role==='healer'?'牧师':classes[(i+2)%classes.length],role,leader:i===1,account:`raider${i}@example.test`,method:i%2?'EMT':'PayPal'});
  }
  log(s,`模拟队员已加入，当前 ${s.members.length}/${cap}。`);break;
 }
 case 'START':leader();requireThat(s.phase==='waiting'&&s.members.length===roomOf(s).capacity,'请先等待团队满员');s.phase='live';log(s,'团长发起团本，冒险开始。');break;
 case 'DEFEAT':leader();live();requireThat(!s.defeated.includes(s.bossIndex),'这个 Boss 已被击败');s.defeated.push(s.bossIndex);log(s,`已击败 ${roomOf(s).bosses[s.bossIndex].name}（模拟）。`);break;
 case 'DROP':{
  leader();live();unlocked();requireThat(s.defeated.includes(s.bossIndex),'请先模拟击败 Boss');
  const boss=roomOf(s).bosses[s.bossIndex];let item=boss.items.find(i=>i.id===action.itemId);
  if(action.custom){requireThat(action.custom.trim().length>0&&action.custom.trim().length<=50,'装备名称须为 1–50 字');item={id:`custom-${s.seq+1}`,name:action.custom.trim(),slot:'自定义演示装备',stats:['属性由团长自行说明'],quality:4,start:5000,increment:1000,icon:''};}
  requireThat(item,'请选择装备');requireThat(!s.drops.some(d=>d.bossIndex===s.bossIndex&&d.item.id===item.id),'这件掉落已经录入');
  const id=`loot-${++s.seq}`;s.drops.push({id,bossIndex:s.bossIndex,item,status:'ready',bids:[],price:0,winner:null,attempt:1,method:'EMT',endsAt:null});log(s,`已录入掉落：${item.name}。`);break;
 }
 case 'OPEN':{
  leader();live();unlocked();const d=drop();requireThat(d.bossIndex===s.bossIndex,'只能在当前 Boss 阶段重新拍卖');requireThat(['ready','unsold','failed','cancelled','refunded'].includes(d.status),'这件装备不能重新开拍');
  requireThat(!s.drops.some(x=>x.status==='open'),'请先完成正在进行的拍卖');
  if(d.status!=='ready'){d.history=[...(d.history||[]),{attempt:d.attempt,status:d.status,price:d.price,winner:d.winner,bids:structuredClone(d.bids)}];d.attempt++;d.bids=[];d.price=0;d.winner=null;}
  d.status='open';d.endsAt=now+30000;log(s,`${d.item.name} 第 ${d.attempt} 次拍卖开始，30 秒倒计时。`);break;
 }
 case 'BID':{
  live();unlocked();const d=drop();requireThat(d.status==='open'&&now<d.endsAt,'拍卖已结束');
  const bidder=s.members.find(m=>m.id===(action.playerId||'self'));requireThat(bidder,'竞价玩家不在团队');
  requireThat(actor==='system'||bidder.id==='self','只能以自己的身份竞价');
  requireThat(Number.isSafeInteger(action.amount)&&action.amount>0&&action.amount<=100000000,'请输入 0–1,000,000 CAD 内的有效金额');
  const min=d.bids.length?d.price+d.item.increment:d.item.start;requireThat(action.amount>=min,`最低出价 ${money(min)}`);
  requireThat(d.winner!==bidder.id,'你已经是最高出价者');
  d.bids.unshift({playerId:bidder.id,name:bidder.name,amount:action.amount,time:now});d.price=action.amount;d.winner=bidder.id;log(s,`${bidder.name} 出价 ${money(d.price)} · ${d.item.name}`);break;
 }
 case 'CLOSE':{
  if(actor!=='system')leader();live();const d=drop();requireThat(d.status==='open','没有正在进行的拍卖');
  requireThat(actor!=='system'||now>=d.endsAt,'尚未到截止时间');d.status=d.bids.length?'pending':'unsold';
  log(s,d.status==='unsold'?`${d.item.name} 无人竞价，已流拍。`:`${d.item.name} 成交 ${money(d.price)}，等待模拟付款。`);break;
 }
 case 'SUBMIT_PAYMENT':{
  unlocked();const d=drop();requireThat(d.status==='pending','当前无法提交付款');requireThat(actor==='leader'||d.winner==='self','只有中标玩家可提交付款');requireThat(['EMT','PayPal','QR'].includes(action.method),'请选择模拟付款方式');
  d.method=action.method;d.status='verifying';log(s,`${d.item.name}：已提交模拟付款声明，等待独立验收。`);break;
 }
 case 'VERIFY':{
  if(actor!=='system')leader();unlocked();const d=drop();requireThat(d.status==='verifying','必须先提交模拟付款声明');d.status=action.success?'confirmed':'failed';if(action.success)s.ledger.push({id:`receipt-${d.id}-${d.attempt}`,type:'receipt',dropId:d.id,attempt:d.attempt,amount:d.price,time:new Date(now).toISOString()});
  log(s,`${d.item.name}：${action.success?'模拟到账已核验':'模拟核验失败，未计入收入'}。`);break;
 }
 case 'RETRY_PAYMENT':leader();unlocked();{const d=drop();requireThat(d.status==='failed','只有失败付款可重试');d.status='pending';log(s,`${d.item.name} 重新等待付款。`);}break;
 case 'DISTRIBUTE':leader();unlocked();{const d=drop();requireThat(d.status==='confirmed','确认到账后才能分配装备');d.status='distributed';log(s,`${d.item.name} 已分配给 ${s.members.find(m=>m.id===d.winner)?.name}。`);}break;
 case 'CANCEL':leader();unlocked();{const d=drop();requireThat(['ready','open','unsold','pending','verifying','failed'].includes(d.status),'已入账装备需先退款');d.status='cancelled';log(s,`${d.item.name} 拍卖已取消。`);}break;
 case 'REFUND':leader();unlocked();{const d=drop();requireThat(['confirmed','distributed'].includes(d.status),'仅已确认到账交易可以退款');d.status='refunded';s.ledger.push({id:`refund-${d.id}-${d.attempt}`,type:'refund',dropId:d.id,attempt:d.attempt,amount:d.price,time:new Date(now).toISOString()});log(s,`${d.item.name} 全额模拟退款 ${money(d.price)}，已从收入扣除。`);}break;
 case 'NEXT':{
  leader();live();requireThat(s.defeated.includes(s.bossIndex),'请先击败当前 Boss');
  const current=s.drops.filter(d=>d.bossIndex===s.bossIndex);requireThat(current.length,'请至少录入一件掉落');
  requireThat(current.every(d=>['distributed','unsold','cancelled','refunded'].includes(d.status)),'请先处理当前 Boss 的掉落与付款');
  if(s.bossIndex<roomOf(s).bosses.length-1)s.bossIndex++;else s.phase='ended';log(s,s.phase==='ended'?'全部 Boss 已结束，可以生成结算。':'进入下一个 Boss。');break;
 }
 case 'SETTINGS':{
  leader();unlocked();const v={...s.settings,...action.values};
  for(const key of ['commission','bonusRate'])requireThat(Number.isFinite(v[key])&&v[key]>=0&&v[key]<=100,'比例须在 0–100% 之间');
  for(const key of ['leader','tank','healer','bonus','fee'])requireThat(Number.isSafeInteger(v[key])&&v[key]>=0&&v[key]<=100000000,'金额必须为有效非负数');
  requireThat(s.members.some(m=>m.id===v.bonusPlayer),'请选择奖金获得者');s.settings=v;log(s,'团长更新了佣金与补贴规则。');break;
 }
 case 'ACCOUNT':{
  const m=s.members.find(m=>m.id===(action.playerId||'self'));requireThat(m,'玩家不存在');requireThat(actor==='leader'||m.id==='self','只能设置自己的收款资料');
  requireThat(/^[a-zA-Z0-9._-]{1,30}$/.test(action.alias),'请用 1–30 位字母或数字填写模拟账户别名');requireThat(['EMT','PayPal','Other'].includes(action.method),'收款方式无效');
  m.account=`${action.alias}@example.test`;m.method=action.method;
  if(s.settlement){const p=s.settlement.payouts.find(p=>p.id===m.id);requireThat(p.status!=='sent','已发送的付款不能修改账户');p.account=m.account;p.method=m.method;}
  log(s,`${m.name} 更新了模拟收款资料。`);break;
 }
 case 'LOCK':{
  leader();unlocked();requireThat(s.phase==='ended','请完成全部 Boss 后再结算');
  const p=settlementPreview(s);requireThat(p.valid,'补贴与支出超过可用收入，请调整规则');
  requireThat(p.payouts.every(x=>x.account?.endsWith('@example.test')),'请先补全所有成员的模拟收款资料');
  s.settlement={...p,id:`settlement-${s.sessionId}`,lockedAt:new Date(now).toISOString()};log(s,'最终结算已锁定，生成唯一模拟付款指令。');break;
 }
 case 'PAYOUT':{
  leader();requireThat(s.settlement,'请先锁定结算');const p=s.settlement.payouts.find(p=>p.id===action.playerId);requireThat(p,'付款指令不存在');requireThat(p.status!=='sent','此笔付款已发送，禁止重复付款');
  requireThat(p.account?.endsWith('@example.test'),'请先填写模拟收款资料');p.attempts++;
  p.status=action.fail?'failed':action.review?'review':'sent';p.reference=`DEMO-${s.sessionId.slice(0,8)}-${p.id}`;log(s,`${p.name} 的 ${money(p.amount)} 模拟分红：${p.status==='sent'?'已发送':p.status==='failed'?'发送失败，可重试':'待人工审核'}。`);break;
 }
 case 'PAYOUT_ALL':{
  leader();requireThat(s.settlement,'请先锁定结算');for(const p of s.settlement.payouts){if(p.status==='pending'){p.status='sent';p.attempts++;p.reference=`DEMO-${s.sessionId.slice(0,8)}-${p.id}`;}}
  log(s,'所有待发送指令已模拟发送；已发送、失败及待审核指令保持原状态。');break;
 }
 case 'SIMULATION':s.simulation=!!action.value;break;
 default:throw new Error('未知操作');
 }
 return s;
}
export function exportReport(s){return JSON.stringify({demo:true,currency:'CAD',unit:'integer cents',room:roomOf(s)?.name,sessionId:s.sessionId,phase:s.phase,drops:s.drops,ledger:s.ledger,settlement:s.settlement||settlementPreview(s),logs:s.logs},null,2);}
