"use strict";
const get = id => document.getElementById(id);
const directions = {up:[0,-1], right:[1,0], down:[0,1], left:[-1,0]};
const short = {u:"up",r:"right",d:"down",l:"left"};
const inkName = ["Teal","Coral"];
const N = 5;
let page, positions, starting, activeInk, undoStack, optimal, hintCount, solved, soundOn=false, audio;
const clean=[0,0,0,0];
let records={};
try { records = JSON.parse(localStorage.getItem("tideprint-famobi-v1") || "{}") || {}; } catch {}
const bestMoves = i => Number.isInteger(records[i]) && records[i]>0 ? records[i] : null;
function shifted(state, ink, dir, rule) {
  const next=state.slice();
  const [dx,dy]=directions[dir], axis=dx?0:1, delta=dx||dy;
  const index=ink*2+axis, tow=rule.linked[index];
  next[index]=(next[index]+delta+N)%N;
  if(tow){const other=(1-ink)*2+Math.abs(tow)-1;next[other]=(next[other]+Math.sign(tow)*delta+N)%N;}
  return next;
}
function shortest(state, rule) {
  const queue=[{state,first:null,depth:0}], seen=new Set([state.join("")]);
  for(let j=0;j<queue.length;j++){
    const current=queue[j];
    if(current.state.every(v=>v===0)) return current;
    for(const ink of rule.fixed?[1]:[0,1]){
      for(const dir of Object.keys(directions)){
        const next=shifted(current.state,ink,dir,rule), key=next.join("");
        if(seen.has(key))continue;
        seen.add(key);queue.push({state:next,first:current.first||{ink,dir},depth:current.depth+1});
      }
    }
  }
  throw Error("Unreachable print");
}
function sound(kind) {
  if(!soundOn)return;
  try {
    audio ||= new AudioContext();
    audio.resume().catch(()=>{});
    const notes=kind==="finish"?[392,494,587]:kind==="switch"?[305]:[activeInk?220:165];
    notes.forEach((hz,i)=>{
      const t=audio.currentTime+i*.065,o=audio.createOscillator(),g=audio.createGain();
      o.type=kind==="finish"?"sine":"triangle";o.frequency.setValueAtTime(hz,t);o.frequency.exponentialRampToValueAtTime(hz*.89,t+.075);
      g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.055,t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+.14);
      o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+.15);
    });
  } catch {}
}
function svgFrame(id, rule) {
  const mark=lines(.4,"M2 7H8M5 4V10M92 7H98M95 4V10M2 93H8M5 90V96M92 93H98M95 90V96");
  const grid=Array.from({length:N-1},(_,i)=>{const k=(i+1)*20;return lines(.28,"M"+k+" 0V100","M0 "+k+"H100");}).join("");
  const separation=(ink)=>'<g id="'+id+'-sep'+ink+'">'+rule.art[ink]+'</g>';
  const copies=(ink)=>[-100,0,100].flatMap(x=>[-100,0,100].map(y=>'<use href="#'+id+'-sep'+ink+'" x="'+x+'" y="'+y+'"/>')).join("");
  return '<svg viewBox="0 0 100 100" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><defs>'+
    '<clipPath id="'+id+'-cut"><rect width="100" height="100"/></clipPath>'+separation(0)+separation(1)+
    '<pattern id="'+id+'-grain" patternUnits="userSpaceOnUse" width="3" height="4"><circle cx=".6" cy="1" r=".12" fill="#465953"/><circle cx="2.4" cy="3.2" r=".1" fill="#465953"/></pattern></defs>'+
    '<rect width="100" height="100" fill="#f5efdc"/><g transform="translate(7.5 10) scale(.85)"><rect width="100" height="100" fill="#f0e8d0" stroke="#9ca391" stroke-width=".4"/><g color="#b8b8a5" stroke-dasharray="1.1 1.3">'+grid+'</g>'+
    '<g clip-path="url(#'+id+'-cut)" style="isolation:isolate"><g data-layer="0" fill="#186878" color="#186878">'+copies(0)+'</g><g data-layer="1" fill="#e36647" color="#e36647" style="mix-blend-mode:multiply">'+copies(1)+'</g></g>'+
    '<rect width="100" height="100" fill="url(#'+id+'-grain)" opacity=".38"/></g><g color="#768279">'+mark+'</g></svg>';
}

const pad = [...document.querySelectorAll('[data-dir]')];
const inks = [get('blue'), get('red')];
const panel = document.querySelector('.tools');
const icon = name => '<svg aria-hidden="true" viewBox="0 0 24 24"><use href="#i-'+name+'"/></svg>';
let guide = null;
function announce(message) { get('voice').textContent = message; }
function loadPage(i) {
  page=i;
  const rule=editions[i];
  starting=rule.scramble.reduce((state,op)=>shifted(state,Number(op[0]),short[op[1]],rule),clean);
  positions=starting.slice(); optimal=shortest(positions,rule).depth;
  activeInk=rule.fixed?1:0; undoStack=[]; solved=false;
  guide=page===0?shortest(positions,rule).first:null;
  get('reference').innerHTML=svgFrame('ref',rule);
  get('reference').setAttribute('aria-label','Target image, '+rule.name);
  get('print').innerHTML=svgFrame('work',rule);
  get('advance').hidden=true;
  draw(); drawNav();
  announce('Print '+(i+1)+', '+rule.name+'. '+rule.rule+' Match the target image. Arrows shift the current plate, one and two choose the ink, H gives a hint.');
}
function drawNav() {
  get('levels').replaceChildren(...editions.map((ed,i)=>{
    const button=document.createElement('button');
    button.disabled=i>0&&!bestMoves(i-1);
    button.toggleAttribute('data-complete',!!bestMoves(i));
    button.setAttribute('aria-label','Print '+(i+1)+', '+ed.name+(button.disabled?', locked':bestMoves(i)?', completed':''));
    if(page===i)button.setAttribute('aria-current','step');
    button.onclick=()=>loadPage(i);
    return button;
  }));
}
function draw() {
  const work=get('print');
  work.parentElement.classList.toggle('registered',solved);
  work.querySelectorAll('[data-layer]').forEach((layer,ink)=>{
    layer.setAttribute('transform','translate('+positions[ink*2]*20+' '+positions[ink*2+1]*20+')');
  });
  work.setAttribute('aria-label',editions[page].name+'. '+(solved?'In register.':'Working print. Teal is '+positions[0]+' columns right and '+positions[1]+' rows down from target. Coral is '+positions[2]+' columns right and '+positions[3]+' rows down. Position wraps every five steps.'));
  panel.style.setProperty('--tone',activeInk?'var(--coral)':'var(--teal)');
  panel.classList.toggle('done',solved);
  panel.querySelector('.pad-hub').innerHTML=icon(activeInk?'coral':'teal');
  inks.forEach((button,i)=>{
    button.disabled=solved||(i===0&&editions[page].fixed);
    button.setAttribute('aria-pressed',String(i===activeInk));
    button.classList.toggle('guided',!!guide&&guide.ink!==activeInk&&guide.ink===i);
  });
  pad.forEach(button=>{
    button.disabled=solved;
    button.classList.toggle('guided',!!guide&&guide.ink===activeInk&&guide.dir===button.dataset.dir);
  });
  get('undo').disabled=!undoStack.length||solved; get('hint').disabled=solved;
}
function choose(i) {
  if(solved||(i===0&&editions[page].fixed))return;
  activeInk=i;draw();sound('switch');announce(inkName[i]+' ink selected.');
}
function move(dir) {
  if(solved)return;
  const before=positions;
  undoStack.push({positions,ink:activeInk});
  positions=shifted(positions,activeInk,dir,editions[page]);solved=positions.every(v=>v===0);
  guide=!solved&&page===0?shortest(positions,editions[page]).first:null;
  if(solved){
    const moves=undoStack.length, best=bestMoves(page);
    if(!best||moves<best)records[page]=moves;
    try{localStorage.setItem('tideprint-famobi-v1',JSON.stringify(records));}catch{}
    const last=page===editions.length-1;
    const advance=get('advance'); advance.innerHTML=icon(last?'check':'arrow');
    advance.setAttribute('aria-label',last?'View completed collection':'Next print');advance.hidden=false;
    drawNav();draw();advance.focus({preventScroll:true});sound('finish');
    announce('Print registered in '+moves+' moves. '+(last?'Open the collection.':'Next print unlocked.'));
  }else{
    draw();sound('press');announce(inkName[activeInk]+' shifted '+dir+'. '+undoStack.length+' moves.');
  }
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
    get('print').querySelectorAll('[data-layer]').forEach((layer,ink)=>{
      const ix=ink*2, x=positions[ix], y=positions[ix+1];
      const dx=(x-before[ix]+7)%5-2, dy=(y-before[ix+1]+7)%5-2;
      if(!dx&&!dy)return;
      layer.getAnimations().forEach(effect=>effect.cancel());
      layer.animate([{transform:'translate('+20*(x-dx)+'px,'+20*(y-dy)+'px)'},{transform:'translate('+20*x+'px,'+20*y+'px)'}],{duration:130,easing:'ease-out'});
    });
  }
}
function undo() {
  if(solved||!undoStack.length)return;
  const back=undoStack.pop();positions=back.positions;activeInk=back.ink;
  guide=page===0?shortest(positions,editions[page]).first:null;
  draw();announce('Last shift undone.');
}
function hint() {
  if(solved)return;
  guide=shortest(positions,editions[page]).first;draw();
  announce('Try '+inkName[guide.ink]+' '+guide.dir+'.');
}
pad.forEach(button=>{button.innerHTML=icon('arrow');button.onclick=()=>move(button.dataset.dir);});
inks.forEach((button,i)=>button.onclick=()=>choose(i));
get('undo').onclick=undo;get('hint').onclick=hint;get('reset').onclick=()=>loadPage(page);
get('sound').onclick=()=>{
  soundOn=!soundOn;get('sound').setAttribute('aria-pressed',String(soundOn));sound('switch');
};
get('advance').onclick=()=>{
  if(page<editions.length-1){loadPage(page+1);inks[activeInk].focus({preventScroll:true});return;}
  const gallery=get('gallery');
  gallery.replaceChildren(...editions.map((ed,i)=>{
    const button=document.createElement('button');
    button.innerHTML=svgFrame('gallery'+i,ed);
    button.setAttribute('aria-label','Replay '+ed.name);
    button.onclick=()=>{get('finished').close();loadPage(i);};
    return button;
  }));
  get('finished').showModal();get('close').focus({preventScroll:true});
};
get('close').onclick=()=>get('finished').close();
let contact=null;
// The press owns single-finger swipes. Suppress their compatibility click so
// Chromium delivers a tap on the controls immediately after a swipe.
get('print').addEventListener('touchstart',e=>{if(e.touches.length===1)e.preventDefault();},{passive:false});
get('print').addEventListener('pointerdown',e=>{
  if(solved||!e.isPrimary||e.button!==0)return;
  contact={x:e.clientX,y:e.clientY,id:e.pointerId};e.currentTarget.setPointerCapture(e.pointerId);
});
get('print').addEventListener('pointerup',e=>{
  if(!contact||contact.id!==e.pointerId)return;
  const dx=e.clientX-contact.x,dy=e.clientY-contact.y;
  contact=null;
  if(Math.max(Math.abs(dx),Math.abs(dy))<Math.max(12,e.currentTarget.clientWidth*.075))return;
  move(Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up'));
});
get('print').addEventListener('pointercancel',()=>{contact=null;});
document.addEventListener('keydown',e=>{
  if(get('finished').open||e.ctrlKey||e.altKey||e.metaKey)return;
  const key=e.key.toLowerCase();
  if(key.startsWith('arrow')&&directions[key.slice(5)]){e.preventDefault();move(key.slice(5));}
  else if(key==='1'||key==='2'){e.preventDefault();choose(Number(key)-1);}
  else if(key==='z'){undo();}else if(key==='r'){loadPage(page);}else if(key==='h'){hint();}
});
loadPage(0);
