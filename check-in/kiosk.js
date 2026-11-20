"use strict";

const screen = document.querySelector("#screen");
const demoPhone = "00000000000";
let locale = "ja";
let view = "welcome";
let phone = "";
let hasArrived = false;
let filter = "all";
let message = "";
const words = (ja, en) => locale === "ja" ? ja : en;
const primary = (action, label) =>
  '<button class="primary" data-action="'+action+'">'+label+'<span aria-hidden="true">→</span></button>';
const back = (action) =>
  '<button class="back" data-action="'+action+'">← '+words("戻る", "Back")+'</button>';
const step = (num) => '<p class="step">'+words("チェックイン", "Check-in")+'　'+num+' / 3</p>';
const title = (label) => '<h1 tabindex="-1">'+label+'</h1>';
const line = (field, value) => "<div><dt>"+field+"</dt><dd>"+value+"</dd></div>";
const bookingId = "GS-042";

function welcome() {
  return '<section class="scene hero"><figure><img src="../media/rowena.webp" alt="'+
    words("コロンビア川峡谷を望む緑の丘", "Green hills above the Columbia River Gorge")+
    '"><figcaption>Columbia River Gorge</figcaption></figure><div class="intro">'+
    '<p class="step">'+words("セルフチェックイン","Guest check-in")+'</p>'+
    title(words("ようこそ、<br>Gorge Stayへ。","Welcome to<br>Gorge Stay."))+
    '<p class="lead">'+words("ご到着ありがとうございます。こちらの端末で、お部屋の鍵の受け取りまでご案内します。","Find your reservation and see where to collect your room key.")+'</p>'+
    primary("search",words("チェックインを始める","Start check-in"))+'</div></section>';
}

function search() {
  const pad = ["1","2","3","4","5","6","7","8","9","clear","0","erase"].map(k => {
    const label = k==="erase" ? words("1字削除","Delete") : k==="clear" ? words("全消去","Clear") : k;
    return '<button type="button" data-key="'+k+'" class="'+(k.length>1?"small":"")+'">'+label+'</button>';
  }).join("");
  return '<section class="scene inner">'+back("welcome")+'<div class="searchgrid"><div>'+step(1)+title(words("ご予約を検索","Find your reservation"))+
    '<label class="field" for="phone">'+words("予約時の電話番号","Phone number on the booking")+'</label>'+
    '<input autocomplete="off" type="tel" inputmode="numeric" maxlength="15" id="phone" aria-describedby="hint msg">'+
    '<p id="hint" class="note">'+words("操作見本です。架空の番号 000-0000-0000 をお使いください。","For this demo, use the fictional number 000-0000-0000.")+'</p>'+
    '<button class="demoFill" data-action="fill">'+words("デモ番号を入力","Fill demo number")+'</button>'+
    '<p class="msg" aria-live="polite" id="msg"></p></div><div class="controls"><div class="pad">'+pad+
    '</div>'+primary("find",words("この番号で検索","Find reservation"))+'</div></div></section>';
}

function confirm() {
  return '<section class="scene inner">'+back("search")+'<div class="confirmgrid"><div>'+step(2)+title(words("ご予約の確認","Review your stay"))+
    '<p class="lead">'+words("日程と人数をご確認ください。","Please check your dates and party size.")+'</p><dl class="details">'+
    line(words("予約番号","Reservation"),bookingId)+line(words("ご宿泊日","Stay dates"),words("12月12日 — 13日","Dec 12 – 13"))+
    line(words("お部屋・人数","Room and guests"),words("ツイン・2名","Twin · 2 guests"))+
    line(words("お支払い","Payment"),words("事前決済済み","Paid in advance"))+'</dl></div><div class="paper"><h2>'+
    words("鍵のお受け取りについて","Collecting your room key")+'</h2><p class="lead">'+
    words("確定後、フロントで受け取るお部屋の番号を表示します。","After confirmation, your room number will be displayed for key collection at reception.")+
    '</p>'+primary("finish",words("内容を確認してチェックイン","Confirm and check in"))+'</div></div></section>';
}

function keyGuide() {
  return '<section class="scene inner"><div class="confirmgrid" style="min-height:400px"><div>'+step(3)+title(words("鍵のお受け取り","Collect your key"))+
    '<p class="lead">'+words("チェックインが完了しました。フロントでこちらの画面をご提示ください。","You are checked in. Show this screen at reception to collect your key.")+
    '</p>'+primary("end",words("終了して最初の画面に戻る","Finish and return to start"))+'</div><div class="paper"><h2>'+
    words("お部屋番号","Room number")+'</h2><p class="room">206</p><p class="note">'+words("2階　ツインルーム","Level 2 · Twin room")+'</p></div></div></section>';
}

function admin() {
  const rows = [[bookingId,"206",words("ツイン","Twin"),hasArrived],["GS-051","211",words("ダブル","Double"),false],["GS-036","201",words("ツイン","Twin"),true]];
  const visible = rows.filter(r=>filter==="all" || !r[3]);
  const filterButton = (id, label) => '<button class="ghost" data-filter="'+id+'" aria-pressed="'+(filter===id)+'">'+label+'</button>';
  return '<section class="scene staff"><p class="step">'+words("フロント・12月12日","Front desk · Dec 12")+'</p>'+title(words("本日の到着","Today’s arrivals"))+
    '<div class="tabs">'+filterButton("all",words("すべて","All")+' ('+rows.length+')')+
    filterButton("waiting",words("到着待ち","Expected")+' ('+rows.filter(r=>!r[3]).length+')')+
    '</div><div class="tableWrap"><table><thead><tr>'+[words("予約番号","Booking"),words("客室","Room"),words("部屋タイプ","Room type"),words("受付状況","Status")].map(s=>"<th>"+s+"</th>").join("")+
    '</tr></thead><tbody>'+visible.map(r=>'<tr><td>'+r[0]+'</td><td>'+r[1]+'</td><td>'+r[2]+'</td><td><span class="status '+(r[3]?"":"waiting")+'">'+
    (r[3]?words("受付済み","Checked in"):words("到着待ち","Expected"))+'</span></td></tr>').join("")+'</tbody></table></div></section>';
}

function updateField() {
  const field = document.querySelector("#phone");
  if (!field) return;
  const parts = [phone.slice(0,3),phone.slice(3,7),phone.slice(7)].filter(Boolean);
  field.value = parts.join("-");
  const error = document.querySelector("#msg");
  error.textContent = message ? words("該当する予約がありません。デモ番号でお試しください。","No matching reservation. Please use the demo number.") : "";
  field.setAttribute("aria-invalid",String(Boolean(message)));
  document.querySelector('[data-action="find"]').disabled = phone.length<10;
}

function render(focus = true) {
  document.documentElement.lang = locale;
  document.querySelector("#demoNote").textContent = words("操作見本 · 架空の予約を使用","Interactive demo · Fictional reservations");
  document.querySelector("#mode").textContent = view==="admin" ? words("宿泊者画面へ","Guest view") : words("管理画面の見本","Staff view");
  document.querySelector("#lang").textContent = words("English","日本語");
  screen.innerHTML = ({welcome,search,confirm,key:keyGuide,admin})[view]();
  updateField();
  if (focus) screen.querySelector("h1").focus({preventScroll:true});
}

function act(action) {
  if (action === "fill") {
    phone = demoPhone; message = ""; updateField(); return;
  }
  if (action === "find" && phone !== demoPhone) {
    message = "no-match"; updateField(); return;
  }
  if (action === "find") { view = hasArrived ? "key" : "confirm"; if (hasArrived) phone = ""; }
  if (action === "finish") { hasArrived = true; view = "key"; phone = ""; }
  if (action === "end" || action === "welcome") { view = "welcome"; phone = ""; }
  if (action === "search") view = "search";
  message = "";
  render();
}
screen.addEventListener("click",event=>{
  const b = event.target.closest("button");
  if (!b) return;
  if (b.dataset.action) return act(b.dataset.action);
  if (b.dataset.filter) { filter=b.dataset.filter; render(false); screen.querySelector('[data-filter="'+filter+'"]').focus(); return; }
  if (b.dataset.key) {
    const k=b.dataset.key;
    if(k==="clear") phone="";
    else if(k==="erase") phone=phone.slice(0,-1);
    else phone=(phone+k).slice(0,11);
    message="";updateField();
  }
});
screen.addEventListener("input",e=>{
  if(e.target.id!=="phone")return;
  phone=e.target.value.normalize("NFKC").replace(/[^0-9]/g,"").slice(0,11);
  message="";updateField();
});
screen.addEventListener("keydown",e=>{
  if(e.target.id==="phone" && e.key==="Enter" && phone.length>=10) act("find");
});
document.querySelector("#lang").onclick=()=>{locale=locale==="ja"?"en":"ja";render(false);};
document.querySelector("#mode").onclick=()=>{view=view==="admin"?"welcome":"admin";phone="";message="";filter="all";render();};
render(false);
