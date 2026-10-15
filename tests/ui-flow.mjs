import {JSDOM,VirtualConsole} from 'jsdom';
import {readFileSync,readdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const errors=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));vc.on('error',(...args)=>errors.push(args.join(' ')));
const dom=new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',{url:'https://example.test/double-horse/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window;w.structuredClone=structuredClone;w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
const script=readdirSync('dist/assets').find(f=>f.endsWith('.js'));w.eval(readFileSync('dist/assets/'+script,'utf8'));
const pause=()=>new Promise(r=>setTimeout(r,45));
const buttons=()=>[...w.document.querySelectorAll('button')];
const text=()=>w.document.body.textContent;
const state=()=>JSON.parse(w.localStorage.getItem('double-horse:v1'));
async function click(label,{exact=false}={}){await pause();const b=buttons().find(b=>exact?b.textContent.trim()===label:b.textContent.includes(label));assert(b,`Missing button: ${label}`);assert(!b.disabled,`Disabled button: ${label}`);b.click();await pause();}
async function input(selector,value){const e=w.document.querySelector(selector);assert(e,selector);Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,'value').set.call(e,value);e.dispatchEvent(new w.Event('input',{bubbles:true}));await pause();}
try{
 await pause();assert(text().includes('今晚，去哪冒险？'));assert.equal(w.document.querySelectorAll('.room-card').length,3);
 await click('加入团队');await input('#nickname','UITest');const form=w.document.querySelector('form');form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await pause();assert.equal(state().members[0].name,'UITest');
 await click('快速匹配');assert.equal(state().members.length,40);
 await click('切换团长，准备开团');await click('团长开始团本');assert.equal(state().phase,'live');
 // Disable both simulators to deterministically click through each payment transition.
 const checks=[...w.document.querySelectorAll('input[type=checkbox]')];checks.forEach(c=>{if(c.checked)c.click();});await pause();
 for(let i=0;i<3;i++){
  await click('模拟击败 Boss');const opt=w.document.querySelector('.drop-options button');opt.click();await pause();await click('开始拍卖');
  await input('input[aria-label="自定义竞拍金额 CAD"]','1000');await click('出价',{exact:true});assert.equal(state().drops.at(-1).winner,'self');
  await click('团长提前结束拍卖');await click('模拟付款');await click('二维码',{exact:true});assert(w.document.querySelector('.qr-placeholder'));assert(text().includes('不可扫描付款'));
  await click('我已模拟付款');assert.equal(state().drops.at(-1).status,'verifying');assert.equal(state().ledger.length,i);
  await click('确认到账',{exact:true});assert.equal(state().drops.at(-1).status,'confirmed');await click('分配装备',{exact:true});assert.equal(state().drops.at(-1).status,'distributed');
  await click(i===2?'结束团本，前往结算':'进入下一个 Boss');
 }
 assert.equal(state().phase,'ended');await click('保存账户');assert.equal(state().members[0].account,'adventurer@example.test');
 await click('锁定最终结算');assert(state().settlement);await click('模拟发送全部待付款');assert.equal(state().settlement.payouts.filter(p=>p.status==='sent').length,40);
 await click('查看完整报告');assert(text().includes('好装备属于勇士'));assert(text().includes('完整冒险日志'));
 // Persistence reload on same origin.
 const serialized=w.localStorage.getItem('double-horse:v1');assert(serialized.includes('receipt-loot'));assert.equal(errors.length,0,errors.join('\n'));
 console.log('PASS DOM click-through: lobby → join → 40 players → captain → 3 bosses → auctions → QR demo → verification → distribution → settlement → 40 payouts → report.');
 const reload=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://example.test/double-horse/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc});
 reload.window.structuredClone=structuredClone;reload.window.scrollTo=()=>{};reload.window.localStorage.setItem('double-horse:v1',serialized);reload.window.eval(readFileSync('dist/assets/'+script,'utf8'));await pause();
 assert.equal(JSON.parse(reload.window.localStorage.getItem('double-horse:v1')).settlement.payouts.filter(p=>p.status==='sent').length,40);
 const reportButton=[...reload.window.document.querySelectorAll('button')].find(b=>b.textContent.includes('团本报告'));reportButton.click();await pause();assert(reload.window.document.body.textContent.includes('好装备属于勇士'));reload.window.close();
 console.log('PASS UI console errors: 0. Reload restored all 40 payouts and financial report.');
}finally{dom.window.close();}
