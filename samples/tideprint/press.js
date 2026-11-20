"use strict";
const get = id => document.getElementById(id);
const directions = {up:[0,-1], right:[1,0], down:[0,1], left:[-1,0]};
const short = {u:"up",r:"right",d:"down",l:"left"};
const inkName = ["Teal","Coral"];
const N = 5;
let page, positions, starting, activeInk, undoStack, optimal, hintCount, solved, soundOn=false, audio;
const clean=[0,0,0,0];
let records={};
try { records = JSON.parse(localStorage.getItem("tideprint-edition-v1") || "{}") || {}; } catch {}
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
  const dims='<g fill="#65726b" font-family="monospace" font-size="2.25" letter-spacing=".42"><text x="7" y="6">TIDEPRINT</text><text x="77" y="6">P / 0'+(page+1)+'</text></g>';
  const separation=(ink)=>'<g id="'+id+'-sep'+ink+'">'+rule.art[ink]+'</g>';
  const copies=(ink)=>[-100,0,100].flatMap(x=>[-100,0,100].map(y=>'<use href="#'+id+'-sep'+ink+'" x="'+x+'" y="'+y+'"/>')).join("");
  return '<svg viewBox="0 0 100 100" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><defs>'+
    '<clipPath id="'+id+'-cut"><rect width="100" height="100"/></clipPath>'+separation(0)+separation(1)+
    '<pattern id="'+id+'-grain" patternUnits="userSpaceOnUse" width="3" height="4"><circle cx=".6" cy="1" r=".12" fill="#465953"/><circle cx="2.4" cy="3.2" r=".1" fill="#465953"/></pattern></defs>'+
    '<rect width="100" height="100" fill="#f5efdc"/><g transform="translate(7.5 10) scale(.85)"><rect width="100" height="100" fill="#f0e8d0" stroke="#9ca391" stroke-width=".4"/><g color="#b8b8a5" stroke-dasharray="1.1 1.3">'+grid+'</g>'+
    '<g clip-path="url(#'+id+'-cut)" style="isolation:isolate"><g data-layer="0" fill="#186878" color="#186878">'+copies(0)+'</g><g data-layer="1" fill="#e36647" color="#e36647" style="mix-blend-mode:multiply">'+copies(1)+'</g></g>'+
    '<rect width="100" height="100" fill="url(#'+id+'-grain)" opacity=".38"/></g><g color="#768279">'+mark+'</g>'+dims+'</svg>';
}
function loadPage(i) {
  page=i;const rule=editions[i];
  starting=rule.scramble.reduce((state,op)=>shifted(state,Number(op[0]),short[op[1]],rule),clean);
  positions=starting.slice();optimal=shortest(positions,rule).depth;activeInk=rule.fixed?1:0;undoStack=[];hintCount=0;solved=false;
  get("title").textContent=rule.name;get("edition").textContent="Plate "+String(i+1).padStart(2,"0")+" / 06";
  get("effect").textContent=rule.rule;get("reference").setAttribute("aria-label","Reference for "+rule.name);
  get("reference").innerHTML=svgFrame("ref",rule);get("print").innerHTML=svgFrame("work",rule);
  get("feedback").textContent="";get("advance").hidden=true;get("par").textContent=optimal;draw();drawNav();
}
function drawNav() {
  const nav=get("levels");
  nav.replaceChildren(...editions.map((ed,i)=>{
    const button=document.createElement("button");
    button.textContent=String(i+1).padStart(2,"0");button.disabled=i>0&&!bestMoves(i-1);
    button.setAttribute("aria-label","Print "+(i+1)+", "+ed.name+(button.disabled?", locked":""));
    if(page===i)button.setAttribute("aria-current","step");
    button.onclick=()=>loadPage(i);return button;
  }));
}
function draw() {
  const working=get("print");
  working.querySelectorAll("[data-layer]").forEach((layer,ink)=>{
    const x=positions[ink*2]*20,y=positions[ink*2+1]*20;
    layer.setAttribute("transform","translate("+x+" "+y+")");
  });
  get("blue").disabled=editions[page].fixed||solved;get("red").disabled=solved;
  [get("blue"),get("red")].forEach((b,i)=>b.setAttribute("aria-pressed",String(activeInk===i)));
  document.querySelectorAll("[data-dir]").forEach(b=>b.disabled=solved);
  get("undo").disabled=!undoStack.length||solved;get("hint").disabled=solved;
  get("moves").textContent=undoStack.length;get("best").textContent=bestMoves(page)??"—";
  get("status").textContent=solved?"In register":"Out of register";get("status").classList.toggle("ok",solved);
}
function choose(i) {
  if(solved||(i===0&&editions[page].fixed))return;
  activeInk=i;draw();sound("switch");
}
function move(dir) {
  if(solved)return;
  const before=positions;undoStack.push({positions:before,ink:activeInk});
  positions=shifted(before,activeInk,dir,editions[page]);solved=positions.every(v=>v===0);
  get("feedback").textContent="";
  if(solved){
    const moves=undoStack.length, best=bestMoves(page);
    if(!best||moves<best)records[page]=moves;
    try{localStorage.setItem("tideprint-edition-v1",JSON.stringify(records));}catch{}
    get("feedback").textContent=(moves===optimal?"Clean proof at par.":"Proof registered in "+moves+" moves.")+(hintCount?" Assisted.":"");
    get("advance").textContent=page===editions.length-1?"View edition →":"Next print →";
    get("advance").hidden=false;drawNav();sound("finish");
  }else sound("press");
  draw();
}
function undo() {
  if(solved||!undoStack.length)return;
  const back=undoStack.pop();positions=back.positions;activeInk=back.ink;
  get("feedback").textContent="Last shift undone.";draw();
}
function hint(){
  if(solved)return;
  const answer=shortest(positions,editions[page]);hintCount++;
  get("feedback").textContent="Try "+inkName[answer.first.ink]+" "+answer.first.dir+". "+answer.depth+" moves to register.";
}
document.querySelectorAll("[data-dir]").forEach(b=>b.onclick=()=>move(b.dataset.dir));
get("blue").onclick=()=>choose(0);get("red").onclick=()=>choose(1);
get("undo").onclick=undo;get("reset").onclick=()=>loadPage(page);get("hint").onclick=hint;
get("sound").onclick=()=>{soundOn=!soundOn;get("sound").textContent=soundOn?"Sound on":"Sound off";get("sound").setAttribute("aria-pressed",String(soundOn));sound("switch");};
get("advance").onclick=()=>{
  if(page<editions.length-1){loadPage(page+1);return;}
  const total=editions.reduce((sum,_,i)=>sum+bestMoves(i),0);
  get("summary").textContent="All six harbour prints are in register. Your best proofs total "+total+" moves. Reopen any plate to refine the edition.";
  get("finished").showModal();
};
document.addEventListener("keydown", e=>{
  if(get("finished").open||e.metaKey||e.ctrlKey||e.altKey)return;
  const key=e.key.toLowerCase();
  if(key.startsWith("arrow")&&directions[key.slice(5)]){e.preventDefault();move(key.slice(5));}
  else if(key==="1"||key==="2"){e.preventDefault();choose(Number(key)-1);}
  else if(key==="z"){undo();}else if(key==="r"){loadPage(page);}else if(key==="h"){hint();}
});
loadPage(0);
