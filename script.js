
/* ============================================================
   Lok Yi Hub · script.js
   學生綜合管理平台（Lok Yi + Austin 雙帳號）
   資料儲存：localStorage（lyhub_ 前綴）+ IndexedDB（課堂材料）
   ============================================================ */
(function () {
&#x27;use strict&#x27;;

/* ==================== 工具 ==================== */
var $id = function (i) { return document.getElementById(i); };
var $q  = function (s, r) { return (r || document).querySelector(s); };
var $qa = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

function esc(s) {
  return String(s == null ? &#x27;&#x27; : s).replace(/[&amp;&lt;&gt;&quot;&#x27;]/g, function (c) {
    return { &#x27;&amp;&#x27;: &#x27;&amp;amp;&#x27;, &#x27;&lt;&#x27;: &#x27;&amp;lt;&#x27;, &#x27;&gt;&#x27;: &#x27;&amp;gt;&#x27;, &#x27;&quot;&#x27;: &#x27;&amp;quot;&#x27;, &quot;&#x27;&quot;: &#x27;&amp;#39;&#x27; }[c];
  });
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function debounce(fn, ms) { var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms || 350); }; }

var LS = {
  get: function (k, d) {
    try { var v = localStorage.getItem(&#x27;lyhub_&#x27; + k); return v == null ? d : JSON.parse(v); }
    catch (e) { return d; }
  },
  set: function (k, v) {
    try { localStorage.setItem(&#x27;lyhub_&#x27; + k, JSON.stringify(v)); } catch (e) {}
    /* 🆕 v2.3.2 自動雲推送：任何 LS.set 都觸發防抖（系統 key 除外） */
    if (k !== &#x27;__last_sync&#x27; &amp;&amp; k !== &#x27;notif_sent&#x27; &amp;&amp; k !== &#x27;__changelog&#x27; &amp;&amp; k !== &#x27;cross_notifs&#x27; &amp;&amp; k !== &#x27;device_id&#x27; &amp;&amp; k.indexOf(&#x27;__seen_&#x27;) !== 0) {
      _lastChangeKey = k;
      autoSyncSchedule();
    }
  },
  del: function (k) { try { localStorage.removeItem(&#x27;lyhub_&#x27; + k); } catch (e) {} },
  keys: function () {
    var out = [];
    for (var i = 0; i &lt; localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k &amp;&amp; k.indexOf(&#x27;lyhub_&#x27;) === 0) out.push(k.slice(6));
    }
    return out;
  }
};

/* 🆕 v2.3.2 自動雲推送（防抖 3 秒；需已設定 token + gist_id） */
var _autoSyncTimer = null, _autoSyncing = false, _lastChangeKey = &#x27;&#x27;;
function changeLabel(key) {
  var map = {
    todos: &#x27;待辦事項&#x27;, timetable: &#x27;課表&#x27;, funds: &#x27;資助申請&#x27;, jobs: &#x27;求職追蹤&#x27;,
    wie: &#x27;WIE 實習&#x27;, exchk: &#x27;交換材料&#x27;, diary_anniv: &#x27;紀念日&#x27;, regs: &#x27;學分進度&#x27;,
    announcement: &#x27;公告&#x27;, fix_dl: &#x27;學校日程&#x27;, fix_dday: &#x27;D-Day&#x27;,
    bf_announcement: &#x27;公告（Austin）&#x27;, bf_fix_dl: &#x27;學校日程（Austin）&#x27;, bf_fix_dday: &#x27;D-Day（Austin）&#x27;,
    theme: &#x27;主題&#x27;,
    media_name_ly: &#x27;自媒體名稱&#x27;, media_name_bf: &#x27;自媒體名稱&#x27;
  };
  if (map[key]) return map[key];
  if (key.indexOf(&#x27;media_&#x27;) === 0) return &#x27;自媒體素材&#x27;;
  if (key.indexOf(&#x27;diary_&#x27;) === 0) return &#x27;日記&#x27;;
  if (key.indexOf(&#x27;ly_&#x27;) === 0 || key.indexOf(&#x27;bf_&#x27;) === 0) return &#x27;個人檔案&#x27;;
  return &#x27;Dashboard 數據&#x27;;
}
function autoSyncSchedule() {
  if (!LS.get(&#x27;gh_token&#x27;, &#x27;&#x27;) || !LS.get(&#x27;gist_id&#x27;, &#x27;&#x27;) || !LS.get(&#x27;auto_pull&#x27;, false)) return;
  clearTimeout(_autoSyncTimer);
  _autoSyncTimer = setTimeout(function () {
    if (_autoSyncing) return;
    _autoSyncing = true;
    var msg = changeLabel(_lastChangeKey);
    var body = gistBody();
    body.files[GIST_FILE] = { content: JSON.stringify(syncPayload(msg)) };
    ghFetch(&#x27;PATCH&#x27;, &#x27;/gists/&#x27; + gistId(), body).then(function () {
      LS.set(&#x27;__last_sync&#x27;, new Date().toISOString());
      renderSyncStatus();
      _autoSyncing = false;
    }).catch(function () { _autoSyncing = false; });
  }, 3000);
}

function pad2(n) { return (n &lt; 10 ? &#x27;0&#x27; : &#x27;&#x27;) + n; }
function todayStr() {
  var d = new Date();
  return d.getFullYear() + &#x27;-&#x27; + pad2(d.getMonth() + 1) + &#x27;-&#x27; + pad2(d.getDate());
}
function daysUntil(ds) {
  if (!ds) return null;
  try {
    var p = ds.split(&#x27;-&#x27;).map(Number);
    var t = new Date(p[0], p[1] - 1, p[2]);
    var n = new Date(); n = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    return Math.round((t - n) / 86400000);
  } catch (e) { return null; }
}
function fmtD(ds) {
  if (!ds) return &#x27;—&#x27;;
  var p = String(ds).split(&#x27;-&#x27;);
  return (+p[0]) + &#x27;/&#x27; + (+p[1]) + &#x27;/&#x27; + (+p[2]);
}
var WEEK_ZH = [&#x27;日&#x27;, &#x27;一&#x27;, &#x27;二&#x27;, &#x27;三&#x27;, &#x27;四&#x27;, &#x27;五&#x27;, &#x27;六&#x27;];
function fmtFull(d) {
  return d.getFullYear() + &#x27;/&#x27; + (d.getMonth() + 1) + &#x27;/&#x27; + d.getDate() + &#x27;（週&#x27; + WEEK_ZH[d.getDay()] + &#x27;）&#x27;;
}
function daysBadge(ds) {
  var n = daysUntil(ds);
  if (n == null) return &#x27;&#x27;;
  if (n &lt; 0) return &#x27;已過 &#x27; + Math.abs(n) + &#x27; 天&#x27;;
  if (n === 0) return &#x27;就是今天！&#x27;;
  return &#x27;剩 &#x27; + n + &#x27; 天&#x27;;
}
function urgencyInfo(ds) {
  var n = daysUntil(ds);
  if (n == null) return { cls: &#x27;ok&#x27;, label: &#x27;未設截止&#x27; };
  if (n &lt; 0) return { cls: &#x27;urg&#x27;, label: &#x27;逾期 &#x27; + Math.abs(n) + &#x27; 天&#x27; };
  if (n &lt;= 7) return { cls: &#x27;urg&#x27;, label: &#x27;⚠️ &#x27; + n + &#x27; 天&#x27; };
  if (n &lt;= 30) return { cls: &#x27;warn&#x27;, label: n + &#x27; 天&#x27; };
  return { cls: &#x27;ok&#x27;, label: n + &#x27; 天&#x27; };
}

/* 確認 Modal（Promise） */
var _confirmResolve = null;
function showConfirm(msg) {
  $id(&#x27;confirmMsg&#x27;).textContent = msg;
  $id(&#x27;confirmModal&#x27;).hidden = false;
  return new Promise(function (res) { _confirmResolve = res; });
}
function _confirmDone(v) {
  $id(&#x27;confirmModal&#x27;).hidden = true;
  if (_confirmResolve) { _confirmResolve(v); _confirmResolve = null; }
}

/* 下載文本 */
function downloadText(name, content, mime) {
  var blob = new Blob([content], { type: (mime || &#x27;text/plain&#x27;) + &#x27;;charset=utf-8&#x27; });
  var a = document.createElement(&#x27;a&#x27;);
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 600);
}

/* ==================== 全域狀態 ==================== */
var ACCT = LS.get(&#x27;acct&#x27;, &#x27;ly&#x27;);          // &#x27;ly&#x27; | &#x27;bf&#x27;
var PAGE = &#x27;dashboard&#x27;;

/* ==================== 固定資料 ==================== */
var FIX = {};

/* LY 重要日程（來源：Academic Registry + SHTM 通告） */
FIX.lyDeadlines = [
  { t: &#x27;Mock 選科開始（09:00）&#x27;, d: &#x27;2026-08-17&#x27; },
  { t: &#x27;正式選科開始（10:00）&#x27;, d: &#x27;2026-08-21&#x27; },
  { t: &#x27;正式選科結束（23:59）&#x27;, d: &#x27;2026-08-25&#x27; },
  { t: &#x27;開學前調整開始（10:30）&#x27;, d: &#x27;2026-08-28&#x27; },
  { t: &#x27;🚨 WIE 學分轉移 (AR41C) 截止&#x27;, d: &#x27;2026-08-31&#x27; },
  { t: &#x27;Semester 1 開課&#x27;, d: &#x27;2026-08-31&#x27; },
  { t: &#x27;開學前調整結束（23:59）&#x27;, d: &#x27;2026-08-30&#x27; },
  { t: &#x27;🚨 SHTM 交換計劃申請截止（13:00）&#x27;, d: &#x27;2026-09-03&#x27; },
  { t: &#x27;Add / Drop 結束（23:59）&#x27;, d: &#x27;2026-09-12&#x27; },
  { t: &#x27;交換計劃面試（至 9/8）&#x27;, d: &#x27;2026-09-07&#x27; },
  { t: &#x27;TSFS / NLSFT 申請截止&#x27;, d: &#x27;2026-09-25&#x27; }
];

/* 學術日曆重點（學習進度頁） */
FIX.calendar = [
  { t: &#x27;科目時間表發布&#x27;, d: &#x27;2026-07-27&#x27; },
  { t: &#x27;Mock 選科&#x27;, d: &#x27;2026-08-17&#x27; },
  { t: &#x27;正式選科&#x27;, d: &#x27;2026-08-21&#x27; },
  { t: &#x27;開學前調整&#x27;, d: &#x27;2026-08-28&#x27; },
  { t: &#x27;Sem 1 開課 · WIE 學分轉移截止&#x27;, d: &#x27;2026-08-31&#x27; },
  { t: &#x27;Add / Drop 期&#x27;, d: &#x27;2026-08-31&#x27; },
  { t: &#x27;SHTM 交換計劃申請截止&#x27;, d: &#x27;2026-09-03&#x27; },
  { t: &#x27;交換計劃面試&#x27;, d: &#x27;2026-09-07&#x27; },
  { t: &#x27;TSFS / NLSFT 截止&#x27;, d: &#x27;2026-09-25&#x27; }
];

/* 預設時間表（2026/27 Sem 1 · 可點擊編輯） */
FIX.timetable = [
  { d: 0, t: 10, subj: &#x27;HTM3201 酒店營運管理&#x27;, room: &#x27;QT308&#x27; },
  { d: 0, t: 11, subj: &#x27;HTM3201 酒店營運管理&#x27;, room: &#x27;QT308&#x27; },
  { d: 1, t: 14, subj: &#x27;HTM3212 餐飲管理&#x27;, room: &#x27;FG301&#x27; },
  { d: 2, t: 9,  subj: &#x27;HTM3301 旅遊市場學&#x27;, room: &#x27;TU101&#x27; },
  { d: 2, t: 10, subj: &#x27;HTM3301 旅遊市場學&#x27;, room: &#x27;TU101&#x27; },
  { d: 3, t: 15, subj: &#x27;HTM3402 酒店財務管理&#x27;, room: &#x27;GH201&#x27; },
  { d: 4, t: 11, subj: &#x27;GE3401 通識&#x27;, room: &#x27;CORE S509&#x27; },
  { d: 4, t: 16, subj: &#x27;HTM3201 導修 Tutorial&#x27;, room: &#x27;QT201&#x27; }
];

/* 預設科目（學習進度 · Sem 1） */
FIX.studySubjects = [
  { code: &#x27;HTM3201&#x27;, name: &#x27;酒店營運管理&#x27;, progress: 0 },
  { code: &#x27;HTM3212&#x27;, name: &#x27;餐飲管理&#x27;, progress: 0 },
  { code: &#x27;HTM3301&#x27;, name: &#x27;旅遊市場學&#x27;, progress: 0 },
  { code: &#x27;HTM3402&#x27;, name: &#x27;酒店財務管理&#x27;, progress: 0 },
  { code: &#x27;GE3401&#x27;, name: &#x27;通識&#x27;, progress: 0 }
];

/* BF 重要日程（Non-JUPAS 2027/28 · 預計，以各大學官方公佈為準） */
FIX.bfDeadlines = [
  { t: &#x27;HKCC Year 2 上學期開學&#x27;, d: &#x27;2026-09-07&#x27; },
  { t: &#x27;IELTS 報名（建議，目標 12 月應考）&#x27;, d: &#x27;2026-10-15&#x27; },
  { t: &#x27;PolyU Non-JUPAS 2027/28 開放申請（預計）&#x27;, d: &#x27;2026-09-28&#x27; },
  { t: &#x27;CityU Senior Year 開放申請（預計）&#x27;, d: &#x27;2026-10-01&#x27; },
  { t: &#x27;推薦人確認 + 邀請推薦信（建議）&#x27;, d: &#x27;2026-12-01&#x27; },
  { t: &#x27;Personal Statement 完成稿（建議）&#x27;, d: &#x27;2027-01-05&#x27; },
  { t: &#x27;PolyU Non-JUPAS 截止（預計）&#x27;, d: &#x27;2027-01-15&#x27; },
  { t: &#x27;CityU Non-JUPAS 截止（預計）&#x27;, d: &#x27;2027-01-15&#x27; },
  { t: &#x27;HKMU Non-JUPAS 截止（預計）&#x27;, d: &#x27;2027-07-31&#x27; }
];

/* BF 預載科目（HKCC · Statistics and Data Science · 12 科 33 學分） */
FIX.bfSubjects = [
  { id: &#x27;f1&#x27;,  code: &#x27;MATH1014&#x27;, name: &#x27;微積分 I&#x27;,            cr: 3, type: &#x27;必修&#x27;, term: &#x27;2025/26 S1&#x27;, exp: &#x27;A&#x27;,  act: &#x27;A&#x27;,  status: &#x27;已完成&#x27;, prog: 100 },
  { id: &#x27;f2&#x27;,  code: &#x27;STA1001&#x27;,  name: &#x27;統計學導論&#x27;,          cr: 3, type: &#x27;必修&#x27;, term: &#x27;2025/26 S1&#x27;, exp: &#x27;A&#x27;,  act: &#x27;A&#x27;,  status: &#x27;已完成&#x27;, prog: 100 },
  { id: &#x27;f3&#x27;,  code: &#x27;COMP1016&#x27;, name: &#x27;程式設計導論（Python）&#x27;, cr: 3, type: &#x27;必修&#x27;, term: &#x27;2025/26 S1&#x27;, exp: &#x27;A&#x27;, act: &#x27;A&#x27;,  status: &#x27;已完成&#x27;, prog: 100 },
  { id: &#x27;f4&#x27;,  code: &#x27;ENG1001&#x27;,  name: &#x27;學術英語 I&#x27;,          cr: 3, type: &#x27;必修&#x27;, term: &#x27;2025/26 S1&#x27;, exp: &#x27;A-&#x27;, act: &#x27;A-&#x27;, status: &#x27;已完成&#x27;, prog: 100 },
  { id: &#x27;f5&#x27;,  code: &#x27;GES1001&#x27;,  name: &#x27;通識：社會科學&#x27;,      cr: 3, type: &#x27;必修&#x27;, term: &#x27;2025/26 S1&#x27;, exp: &#x27;A-&#x27;, act: &#x27;A-&#x27;, status: &#x27;已完成&#x27;, prog: 100 },
  { id: &#x27;f6&#x27;,  code: &#x27;STA1002&#x27;,  name: &#x27;機率與分佈&#x27;,          cr: 3, type: &#x27;必修&#x27;, term: &#x27;2025/26 S2&#x27;, exp: &#x27;A-&#x27;, act: &#x27;A-&#x27;, status: &#x27;已完成&#x27;, prog: 100 },
  { id: &#x27;f7&#x27;,  code: &#x27;MATH1015&#x27;, name: &#x27;微積分 II&#x27;,           cr: 3, type: &#x27;必修&#x27;, term: &#x27;2025/26 S2&#x27;, exp: &#x27;A-&#x27;, act: &#x27;A-&#x27;, status: &#x27;已完成&#x27;, prog: 100 },
  { id: &#x27;f8&#x27;,  code: &#x27;COMP2017&#x27;, name: &#x27;資料庫導論&#x27;,          cr: 3, type: &#x27;必修&#x27;, term: &#x27;2025/26 S2&#x27;, exp: &#x27;A-&#x27;, act: &#x27;A-&#x27;, status: &#x27;已完成&#x27;, prog: 100 },
  { id: &#x27;f9&#x27;,  code: &#x27;ENG1002&#x27;,  name: &#x27;學術英語 II&#x27;,         cr: 3, type: &#x27;必修&#x27;, term: &#x27;2025/26 S2&#x27;, exp: &#x27;A-&#x27;, act: &#x27;A-&#x27;, status: &#x27;已完成&#x27;, prog: 100 },
  { id: &#x27;f10&#x27;, code: &#x27;STA2011&#x27;,  name: &#x27;應用迴歸分析&#x27;,        cr: 2, type: &#x27;必修&#x27;, term: &#x27;2025/26 S2&#x27;, exp: &#x27;A-&#x27;, act: &#x27;A-&#x27;, status: &#x27;已完成&#x27;, prog: 100 },
  { id: &#x27;f11&#x27;, code: &#x27;MM1011&#x27;,   name: &#x27;線性代數導論&#x27;,        cr: 2, type: &#x27;必修&#x27;, term: &#x27;2025/26 S2&#x27;, exp: &#x27;A&#x27;,  act: &#x27;A&#x27;,  status: &#x27;已完成&#x27;, prog: 100 },
  { id: &#x27;f12&#x27;, code: &#x27;GES1002&#x27;,  name: &#x27;通識：數據素養&#x27;,      cr: 2, type: &#x27;選修&#x27;, term: &#x27;2025/26 S2&#x27;, exp: &#x27;A-&#x27;, act: &#x27;A-&#x27;, status: &#x27;已完成&#x27;, prog: 100 }
];

/* BF Non-JUPAS 院校庫（PolyU 為官方歷年平均參考，其餘為估算） */
FIX.programs = [
  { key: &#x27;p1&#x27;, uni: &#x27;PolyU&#x27;,  name: &#x27;BSc (Hons) Data Science and Analytics&#x27;,            field: &#x27;數據科學&#x27;,   avg: 3.61, min: 3.40, src: &#x27;官方&#x27;, pros: &#x27;課程完全對口 · 涵蓋 ML / 大數據 · PolyU 品牌強&#x27;, cons: &#x27;競爭激烈 · 高 GPA 申請者多&#x27; },
  { key: &#x27;p2&#x27;, uni: &#x27;PolyU&#x27;,  name: &#x27;BSc (Hons) Financial Technology and AI&#x27;,            field: &#x27;金融科技×AI&#x27;, avg: 3.74, min: 3.50, src: &#x27;官方&#x27;, pros: &#x27;出路廣（金融+科技）· 薪資高&#x27;, cons: &#x27;歷年平均 GPA 最高 · 屬衝刺課程&#x27; },
  { key: &#x27;p3&#x27;, uni: &#x27;PolyU&#x27;,  name: &#x27;BSc (Hons) Computing and Artificial Intelligence&#x27;,  field: &#x27;計算機×AI&#x27;,  avg: 3.48, min: 3.30, src: &#x27;官方&#x27;, pros: &#x27;AI 熱門方向 · 課程新&#x27;, cons: &#x27;編程要求高 · 需作品集加分&#x27; },
  { key: &#x27;p4&#x27;, uni: &#x27;CityU&#x27;,  name: &#x27;BSc (Hons) Data Science&#x27;,                           field: &#x27;數據科學&#x27;,   avg: 3.40, min: 3.20, src: &#x27;估算&#x27;, pros: &#x27;名額相對多 · 課程實用&#x27;, cons: &#x27;非官方數據 · 需到官網核實&#x27; },
  { key: &#x27;p5&#x27;, uni: &#x27;CityU&#x27;,  name: &#x27;BSc (Hons) Computer Science&#x27;,                       field: &#x27;計算機&#x27;,     avg: 3.45, min: 3.25, src: &#x27;估算&#x27;, pros: &#x27;計算機基礎扎實 · 轉碼友好&#x27;, cons: &#x27;競爭大 · 數學要求高&#x27; },
  { key: &#x27;p6&#x27;, uni: &#x27;CityU&#x27;,  name: &#x27;BSc (Hons) Computing Mathematics&#x27;,                  field: &#x27;計算數學&#x27;,   avg: 3.20, min: 3.00, src: &#x27;估算&#x27;, pros: &#x27;門檻較低 · 統計背景有優勢&#x27;, cons: &#x27;出路偏精算 / 研究&#x27; },
  { key: &#x27;p7&#x27;, uni: &#x27;HKUST&#x27;,  name: &#x27;BSc (Hons) Data Science and Technology&#x27;,            field: &#x27;數據科學&#x27;,   avg: 3.85, min: 3.65, src: &#x27;估算&#x27;, pros: &#x27;全港最頂級 · 校譽極高&#x27;, cons: &#x27;Senior Year 名額極少 · 屬高風險衝刺&#x27; },
  { key: &#x27;p8&#x27;, uni: &#x27;HKMU&#x27;,   name: &#x27;BSc (Hons) Data Science and Business Analytics&#x27;,    field: &#x27;數據×商業&#x27;,  avg: 2.90, min: 2.50, src: &#x27;估算&#x27;, pros: &#x27;門檻低 · 保底之選 · 收生友善&#x27;, cons: &#x27;校譽較弱 · 需靠個人努力補足&#x27; },
  { key: &#x27;p9&#x27;, uni: &#x27;HKMU&#x27;,   name: &#x27;BSc (Hons) Computing Studies&#x27;,                      field: &#x27;計算機&#x27;,     avg: 2.70, min: 2.40, src: &#x27;估算&#x27;, pros: &#x27;保底課程 · 銜接 IT 行業&#x27;, cons: &#x27;課程深度一般&#x27; },
  { key: &#x27;p10&#x27;, uni: &#x27;HSUHK&#x27;, name: &#x27;BSc (Hons) Data Science and Business Analytics&#x27;,    field: &#x27;數據×商業&#x27;,  avg: 3.10, min: 2.80, src: &#x27;估算&#x27;, pros: &#x27;私大中口碑好 · 商科資源多&#x27;, cons: &#x27;學費較高 · 認受性中等&#x27; }
];

/* BF 申請材料預設 */
FIX.bfMaterials = [
  { id: &#x27;m1&#x27;, name: &#x27;HKCC 正式成績表（Transcript）&#x27;, status: &#x27;已完成&#x27;, note: &#x27;需向 HKCC AR 申請並直接寄送各大學&#x27;, link: &#x27;&#x27; },
  { id: &#x27;m2&#x27;, name: &#x27;CV（英文）&#x27;, status: &#x27;未開始&#x27;, note: &#x27;一頁式 · 突出 GPA / 程式 / 專案&#x27;, link: &#x27;&#x27; },
  { id: &#x27;m3&#x27;, name: &#x27;Personal Statement&#x27;, status: &#x27;未開始&#x27;, note: &#x27;500–800 字 · 每校客製化&#x27;, link: &#x27;&#x27; },
  { id: &#x27;m4&#x27;, name: &#x27;推薦信 #1（學術）&#x27;, status: &#x27;未開始&#x27;, note: &#x27;邀請統計 / 數學講師&#x27;, link: &#x27;&#x27; },
  { id: &#x27;m5&#x27;, name: &#x27;推薦信 #2&#x27;, status: &#x27;未開始&#x27;, note: &#x27;講師或導師&#x27;, link: &#x27;&#x27; },
  { id: &#x27;m6&#x27;, name: &#x27;證件相（白色背景）&#x27;, status: &#x27;未開始&#x27;, note: &#x27;電子版 · 符合各校規格&#x27;, link: &#x27;&#x27; }
];

/* BF CV 行動清單預設 */
FIX.bfCvActions = [
  { t: &#x27;整理 Year 1–2 所有科目成績與重點項目&#x27;, done: false },
  { t: &#x27;完成一個 Python / R 數據分析專案並放上 GitHub&#x27;, done: false },
  { t: &#x27;學習 SQL 基礎（完成一個線上課程）&#x27;, done: false },
  { t: &#x27;製作 Data Visualization 作品（Tableau / Power BI）&#x27;, done: false },
  { t: &#x27;撰寫 CV 初稿（一頁英文版）&#x27;, done: false },
  { t: &#x27;請講師審閱 CV 並修改兩輪&#x27;, done: false }
];

/* BF 求職渠道預設 */
FIX.bfChannels = [
  { t: &#x27;LinkedIn 香港（數據岗實習）&#x27;, done: false },
  { t: &#x27;JobsDB · CTgoodjobs（Data Analyst）&#x27;, done: false },
  { t: &#x27;HKCC Career Center / PolyU Job Board&#x27;, done: false },
  { t: &#x27;公司官網 Career 頁（銀行 MT / 科企）&#x27;, done: false },
  { t: &#x27;內推：學長姐 / 講師介紹&#x27;, done: false }
];

/* 交換計劃文件清單預設 */
FIX.exCheck = [
  { t: &#x27;Course Selection Form&#x27;, done: false },
  { t: &#x27;Supporting Statement（400–500 字）&#x27;, done: false },
  { t: &#x27;Updated CV in English&#x27;, done: false },
  { t: &#x27;Latest Academic Transcript（全頁掃描）&#x27;, done: false },
  { t: &#x27;English Proficiency Test（如有）&#x27;, done: false },
  { t: &#x27;Passport-style Photo（600W × 800H px）&#x27;, done: false }
];

/* ==================== 預設個人檔案 ==================== */
var DEF_LY = { name: &#x27;Lok Yi, Chan（陳樂怡）&#x27;, school: &#x27;香港理工大學 PolyU&#x27;, year: &#x27;Year 3（HKCC Asso 升讀）&#x27;, major: &#x27;SHTM 酒店及旅遊業管理學院&#x27;, gpa: &#x27;&#x27;, targetGpa: &#x27;&#x27;, note: &#x27;&#x27; };
var DEF_BF = { name: &#x27;Austin（XIE Haojun）&#x27;, sid: &#x27;25203655A&#x27;, school: &#x27;PolyU HKCC（西九龍校園）&#x27;, year: &#x27;Year 2（來年 Year 3）&#x27;, major: &#x27;Statistics and Data Science&#x27;, gpa: 3.78, target: 3.80, note: &#x27;成績表姓名為 XIE Haojun，日常稱 Austin。&#x27; };

/* ==================== 導航 / 帳號 ==================== */
function goPage(target, opts) {
  PAGE = target;
  $qa(&#x27;.page&#x27;).forEach(function (p) { p.classList.remove(&#x27;active&#x27;); });
  var pg = $id(&#x27;page-&#x27; + target);
  if (pg) pg.classList.add(&#x27;active&#x27;);
  $qa(&#x27;.nav-item&#x27;).forEach(function (n) {
    n.classList.toggle(&#x27;active&#x27;, n.getAttribute(&#x27;data-target&#x27;) === target);
  });
  var nav = $q(&#x27;.nav-item[data-target=&quot;&#x27; + target + &#x27;&quot;]&#x27;);
  if (nav) {
    var label = nav.querySelector(&#x27;span:last-child&#x27;);
    if ($id(&#x27;pageTitle&#x27;)) $id(&#x27;pageTitle&#x27;).textContent = label ? label.textContent : &#x27;&#x27;;
  }
  if ($id(&#x27;aiContextPage&#x27;)) {
    $id(&#x27;aiContextPage&#x27;).textContent = ($id(&#x27;pageTitle&#x27;) || {}).textContent || &#x27;&#x27;;
    if (window.LokiAI &amp;&amp; window.LokiAI.renderQuick) window.LokiAI.renderQuick();
  }
  if (!(opts &amp;&amp; opts.keepSidebar)) closeSidebar();
  window.scrollTo({ top: 0, behavior: &#x27;smooth&#x27; });
}

function switchAcct(a) {
  ACCT = a; LS.set(&#x27;acct&#x27;, a);
  $qa(&#x27;.acct-btn&#x27;).forEach(function (b) { b.classList.toggle(&#x27;active&#x27;, b.getAttribute(&#x27;data-acct&#x27;) === a); });
  $qa(&#x27;[data-account]&#x27;).forEach(function (el) {
    var a = el.getAttribute(&#x27;data-account&#x27;);
    el.style.display = (a === &#x27;shared&#x27; || a === ACCT) ? &#x27;&#x27; : &#x27;none&#x27;;
  });
  renderSidebarIdentity();
  goPage(a === &#x27;ly&#x27; ? &#x27;dashboard&#x27; : &#x27;bf_dash&#x27;, { keepSidebar: false });
  renderAll();
  syncContentAdmin(); /* 🆕 v2.3.6：內容管理編輯器按新賬號重載 */
}

function renderSidebarIdentity() {
  if (ACCT === &#x27;ly&#x27;) {
    var p = LS.get(&#x27;ly_profile&#x27;, DEF_LY);
    if ($id(&#x27;sbAvatar&#x27;)) $id(&#x27;sbAvatar&#x27;).textContent = &#x27;LY&#x27;;
    if ($id(&#x27;sbName&#x27;)) $id(&#x27;sbName&#x27;).textContent = p.name || &#x27;Lok Yi, Chan&#x27;;
    if ($id(&#x27;sbMeta&#x27;)) $id(&#x27;sbMeta&#x27;).textContent = &#x27;PolyU · SHTM · Year 3&#x27;;
    if ($id(&#x27;sbId&#x27;)) $id(&#x27;sbId&#x27;).textContent = &#x27;26017276D&#x27;;
    if ($id(&#x27;sbMail&#x27;)) $id(&#x27;sbMail&#x27;).style.display = &#x27;&#x27;;
  } else {
    var b = LS.get(&#x27;bf_profile&#x27;, DEF_BF);
    var nm = (b.name || &#x27;Austin&#x27;).trim();
    var ini = nm.replace(/[^\x00-\x7F]/g, &#x27;&#x27;).split(/[\s(]+/).filter(Boolean).map(function (w) { return w[0]; }).join(&#x27;&#x27;).slice(0, 2).toUpperCase() || &#x27;AX&#x27;;
    if ($id(&#x27;sbAvatar&#x27;)) $id(&#x27;sbAvatar&#x27;).textContent = ini;
    if ($id(&#x27;sbName&#x27;)) $id(&#x27;sbName&#x27;).textContent = nm;
    if ($id(&#x27;sbMeta&#x27;)) $id(&#x27;sbMeta&#x27;).textContent = &#x27;PolyU HKCC · Stat &amp; Data Sci&#x27;;
    if ($id(&#x27;sbId&#x27;)) $id(&#x27;sbId&#x27;).textContent = b.sid || &#x27;25203655A&#x27;;
    if ($id(&#x27;sbMail&#x27;)) $id(&#x27;sbMail&#x27;).style.display = &#x27;none&#x27;;
  }
}

function openSidebar() {
  $id(&#x27;sidebar&#x27;).classList.add(&#x27;open&#x27;);
  var mask = $id(&#x27;sidebarMask&#x27;);
  if (mask) mask.classList.add(&#x27;show&#x27;);
}
function closeSidebar() {
  $id(&#x27;sidebar&#x27;).classList.remove(&#x27;open&#x27;);
  var mask = $id(&#x27;sidebarMask&#x27;);
  if (mask) mask.classList.remove(&#x27;show&#x27;);
}

/* ==================== 時鐘 ==================== */
function tickClock() {
  var d = new Date();
  var s = pad2(d.getHours()) + &#x27;:&#x27; + pad2(d.getMinutes()) + &#x27;:&#x27; + pad2(d.getSeconds()) + &#x27; · &#x27; + fmtFull(d);
  if ($id(&#x27;clock&#x27;)) $id(&#x27;clock&#x27;).textContent = s;
}

/* ==================== 通用渲染小工具 ==================== */
function delBtn(fn) {
  var b = document.createElement(&#x27;button&#x27;);
  b.className = &#x27;row-del&#x27;; b.title = &#x27;刪除&#x27;; b.innerHTML = &#x27;🗑&#x27;;
  b.onclick = function (e) { e.stopPropagation(); fn(); };
  return b;
}
function toast(msg) {
  var t = document.createElement(&#x27;div&#x27;);
  t.textContent = msg;
  t.style.cssText = &#x27;position:fixed;left:50%;transform:translateX(-50%);bottom:86px;background:#111827;color:#fff;padding:9px 18px;border-radius:999px;font-size:13px;font-weight:600;z-index:200;box-shadow:0 8px 24px rgba(0,0,0,.3);opacity:0;transition:opacity .25s;&#x27;;
  document.body.appendChild(t);
  requestAnimationFrame(function () { t.style.opacity = &#x27;1&#x27;; });
  setTimeout(function () { t.style.opacity = &#x27;0&#x27;; setTimeout(function () { t.remove(); }, 300); }, 2200);
}

/* 綁定輸入框 → 狀態 */
function bindInput(id, storeKey, field, after) {
  var el = $id(id); if (!el) return;
  var load = function () { el.value = LS.get(storeKey, {})[field] != null ? LS.get(storeKey, {})[field] : &#x27;&#x27;; };
  load();
  el.addEventListener(&#x27;input&#x27;, debounce(function () {
    var o = LS.get(storeKey, {});
    o[field] = el.type === &#x27;number&#x27; ? (el.value === &#x27;&#x27; ? &#x27;&#x27; : Number(el.value)) : el.value;
    LS.set(storeKey, o);
    if (after) after(o);
  }, 300));
}

/* ============================================================
   模塊 1：Dashboard（Lok Yi）
   ============================================================ */
function renderDashboard() {
  var d = new Date();
  if ($id(&#x27;todayDate&#x27;)) $id(&#x27;todayDate&#x27;).textContent = fmtFull(d);
  if ($id(&#x27;dashHello&#x27;)) $id(&#x27;dashHello&#x27;).textContent = &#x27;Hi Lok Yi 👋&#x27;;

  var todos = LS.get(&#x27;todos&#x27;, []);
  var jobs = LS.get(&#x27;jobs&#x27;, []);
  var vers = LS.get(&#x27;versions&#x27;, []);
  if ($id(&#x27;statTodo&#x27;)) $id(&#x27;statTodo&#x27;).textContent = todos.filter(function (t) { return !t.done; }).length;
  if ($id(&#x27;statDone&#x27;)) $id(&#x27;statDone&#x27;).textContent = todos.filter(function (t) { return t.done; }).length;
  if ($id(&#x27;statJobs&#x27;)) $id(&#x27;statJobs&#x27;).textContent = jobs.length;
  if ($id(&#x27;statResume&#x27;)) $id(&#x27;statResume&#x27;).textContent = vers.length;

  /* 緊急 / 即將到期 */
  var items = [];
  getDl(&#x27;ly&#x27;).forEach(function (x) { items.push({ t: x.t, d: x.d, src: &#x27;日程&#x27; }); });
  todos.filter(function (t) { return !t.done &amp;&amp; t.due; }).forEach(function (t) { items.push({ t: &#x27;📋 &#x27; + t.t, d: t.due, src: &#x27;待辦&#x27; }); });
  items.forEach(function (x) { x.n = daysUntil(x.d); });
  var urg = items.filter(function (x) { return x.n != null &amp;&amp; x.n &gt;= 0 &amp;&amp; x.n &lt;= 7; }).sort(function (a, b) { return a.n - b.n; });
  var soon = items.filter(function (x) { return x.n != null &amp;&amp; x.n &gt; 7 &amp;&amp; x.n &lt;= 30; }).sort(function (a, b) { return a.n - b.n; });

  function html(list, emptyMsg) {
    if (!list.length) return &#x27;&lt;div class=&quot;empty-tip&quot;&gt;&#x27; + emptyMsg + &#x27;&lt;/div&gt;&#x27;;
    return list.map(function (x) {
      var cls = x.n &lt;= 7 ? &#x27;urg&#x27; : &#x27;warn&#x27;;
      var day = x.n === 0 ? &#x27;今天！&#x27; : x.n + &#x27; 天後&#x27;;
      return &#x27;&lt;div class=&quot;alert-item &#x27; + cls + &#x27;&quot;&gt;&lt;span&gt;&#x27; + esc(x.t) + &#x27; &lt;b style=&quot;font-size:11px;color:#9ca3af&quot;&gt;(&#x27; + fmtD(x.d) + &#x27;)&lt;/b&gt;&lt;/span&gt;&lt;span class=&quot;days&quot;&gt;&#x27; + day + &#x27;&lt;/span&gt;&lt;/div&gt;&#x27;;
    }).join(&#x27;&#x27;);
  }
  if ($id(&#x27;urgentList&#x27;)) $id(&#x27;urgentList&#x27;).innerHTML = html(urg, &#x27;🎉 7 日內無緊急事項&#x27;);
  if ($id(&#x27;soonList&#x27;)) $id(&#x27;soonList&#x27;).innerHTML = html(soon, &#x27;30 日內無其他待辦&#x27;);

  /* 個人資訊 */
  var p = LS.get(&#x27;ly_profile&#x27;, DEF_LY);
  if ($id(&#x27;dashName&#x27;)) $id(&#x27;dashName&#x27;).textContent = p.name || &#x27;—&#x27;;
  if ($id(&#x27;dashMajor&#x27;)) $id(&#x27;dashMajor&#x27;).textContent = p.major || &#x27;—&#x27;;
  if ($id(&#x27;dashYear&#x27;)) $id(&#x27;dashYear&#x27;).textContent = p.year || &#x27;—&#x27;;
  if ($id(&#x27;dashSchool&#x27;)) $id(&#x27;dashSchool&#x27;).textContent = p.school || &#x27;—&#x27;;
  if ($id(&#x27;dashGpa&#x27;)) $id(&#x27;dashGpa&#x27;).textContent = p.gpa || &#x27;—&#x27;;
  if ($id(&#x27;dashTargetGpa&#x27;)) $id(&#x27;dashTargetGpa&#x27;).textContent = p.targetGpa || &#x27;—&#x27;;
  if ($id(&#x27;dashNote&#x27;)) $id(&#x27;dashNote&#x27;).textContent = p.note || &#x27;—&#x27;;

  var wie = LS.get(&#x27;wie&#x27;, { req: 960, done: 0 });
  if ($id(&#x27;wieReqText&#x27;)) $id(&#x27;wieReqText&#x27;).textContent = wie.req + &#x27; 小時&#x27;;
  if ($id(&#x27;wieDoneText&#x27;)) $id(&#x27;wieDoneText&#x27;).textContent = (wie.done || 0) + &#x27; 小時&#x27;;

  var reg = LS.get(&#x27;reg&#x27;, { target: 120 });
  if ($id(&#x27;totalCrText&#x27;)) $id(&#x27;totalCrText&#x27;).textContent = (reg.target || 120) + &#x27; 學分&#x27;;
  if ($id(&#x27;doneCrText&#x27;)) $id(&#x27;doneCrText&#x27;).textContent = (reg.done || 0) + &#x27; 學分&#x27;;
}

/* ============================================================
   模塊 2：REG &amp; 學分管理
   ============================================================ */
function renderReg() {
  var r = LS.get(&#x27;reg&#x27;, { done: 0, ge: 0, major: 0, elec: 0, xge: 6, target: 120 });
  [&#x27;done&#x27;, &#x27;ge&#x27;, &#x27;major&#x27;, &#x27;elec&#x27;, &#x27;xge&#x27;, &#x27;target&#x27;].forEach(function (f) {
    var el = $id(&#x27;cr&#x27; + f.charAt(0).toUpperCase() + f.slice(1)); if (!el) return;
    if (document.activeElement !== el) el.value = r[f] != null ? r[f] : (f === &#x27;target&#x27; ? 120 : (f === &#x27;xge&#x27; ? 6 : 0));
  });
  var pct = Math.min(100, Math.round(((r.done || 0) / (r.target || 120)) * 100));
  if ($id(&#x27;crBar&#x27;)) $id(&#x27;crBar&#x27;).style.width = pct + &#x27;%&#x27;;

  /* 科目資料庫 */
  var subs = LS.get(&#x27;subjects&#x27;, []);
  if ($id(&#x27;subTbody&#x27;)) {
    $id(&#x27;subTbody&#x27;).innerHTML = subs.length ? subs.map(function (s, i) {
      return &#x27;&lt;tr&gt;&lt;td&gt;&lt;b&gt;&#x27; + esc(s.code) + &#x27;&lt;/b&gt;&lt;/td&gt;&lt;td&gt;&#x27; + esc(s.name) + &#x27;&lt;/td&gt;&lt;td&gt;&#x27; + esc(s.grade || &#x27;—&#x27;) + &#x27;&lt;/td&gt;&lt;td&gt;&#x27; + (s.note ? &#x27;&lt;a href=&quot;&#x27; + esc(s.note) + &#x27;&quot; target=&quot;_blank&quot; rel=&quot;noopener&quot;&gt;🔗 連結&lt;/a&gt;&#x27; : &#x27;—&#x27;) + &#x27;&lt;/td&gt;&lt;td&gt;&lt;/td&gt;&lt;/tr&gt;&#x27;;
    }).join(&#x27;&#x27;) + &#x27;&#x27; : &#x27;&lt;tr&gt;&lt;td colspan=&quot;5&quot; class=&quot;empty-tip&quot;&gt;尚未新增科目（例：HTM3201）&lt;/td&gt;&lt;/tr&gt;&#x27;;
    var rows = $id(&#x27;subTbody&#x27;).querySelectorAll(&#x27;tr&#x27;);
    subs.forEach(function (s, i) {
      if (rows[i]) rows[i].appendChild(delBtnCell(function () {
        subs.splice(i, 1); LS.set(&#x27;subjects&#x27;, subs); renderReg();
      }));
    });
  }

  /* 畢業路徑 */
  var sim = LS.get(&#x27;sim&#x27;, []);
  if ($id(&#x27;simList&#x27;)) {
    $id(&#x27;simList&#x27;).innerHTML = sim.length ? sim.map(function (s, i) {
      return &#x27;&lt;li&gt;&lt;span&gt;🗓 &lt;b&gt;&#x27; + esc(s.yr) + &#x27;&lt;/b&gt; · &#x27; + esc(s.list) + &#x27;&lt;/span&gt;&lt;/li&gt;&#x27;;
    }).join(&#x27;&#x27;) : &#x27;&lt;li class=&quot;empty-tip&quot; style=&quot;background:none;padding:8px 4px&quot;&gt;尚未加入計劃&lt;/li&gt;&#x27;;
    var lis = $id(&#x27;simList&#x27;).querySelectorAll(&#x27;li&#x27;);
    sim.forEach(function (s, i) {
      if (lis[i]) lis[i].appendChild(delBtnCell(function () { sim.splice(i, 1); LS.set(&#x27;sim&#x27;, sim); renderReg(); }));
    });
  }
}
function delBtnCell(fn) { var td = document.createElement(&#x27;td&#x27;); td.appendChild(delBtn(fn)); return td; }

function initReg() {
  [&#x27;crDone&#x27;, &#x27;crGE&#x27;, &#x27;crMajor&#x27;, &#x27;crElec&#x27;, &#x27;crXGE&#x27;, &#x27;crTarget&#x27;].forEach(function (id) {
    var el = $id(id); if (!el) return;
    el.addEventListener(&#x27;input&#x27;, debounce(function () {
      var r = LS.get(&#x27;reg&#x27;, {});
      var map = { crDone: &#x27;done&#x27;, crGE: &#x27;ge&#x27;, crMajor: &#x27;major&#x27;, crElec: &#x27;elec&#x27;, crXGE: &#x27;xge&#x27;, crTarget: &#x27;target&#x27; };
      r[map[id]] = el.value === &#x27;&#x27; ? 0 : Number(el.value);
      LS.set(&#x27;reg&#x27;, r); renderReg(); renderDashboard();
    }, 250));
  });
  if ($id(&#x27;addSubBtn&#x27;)) $id(&#x27;addSubBtn&#x27;).onclick = function () {
    var c = $id(&#x27;subCode&#x27;).value.trim(), n = $id(&#x27;subName&#x27;).value.trim();
    if (!c || !n) { toast(&#x27;請填寫科目編號和名稱&#x27;); return; }
    var subs = LS.get(&#x27;subjects&#x27;, []);
    subs.push({ code: c, name: n, grade: $id(&#x27;subGrade&#x27;).value.trim(), note: &#x27;&#x27; });
    LS.set(&#x27;subjects&#x27;, subs);
    $id(&#x27;subCode&#x27;).value = $id(&#x27;subName&#x27;).value = $id(&#x27;subGrade&#x27;).value = &#x27;&#x27;;
    renderReg(); toast(&#x27;已新增 &#x27; + c);
  };
  if ($id(&#x27;addSimBtn&#x27;)) $id(&#x27;addSimBtn&#x27;).onclick = function () {
    var y = $id(&#x27;simYr&#x27;).value.trim(), l = $id(&#x27;subList&#x27;).value.trim();
    if (!y || !l) { toast(&#x27;請填寫學期和科目&#x27;); return; }
    var sim = LS.get(&#x27;sim&#x27;, []);
    sim.push({ yr: y, list: l });
    LS.set(&#x27;sim&#x27;, sim);
    $id(&#x27;simYr&#x27;).value = $id(&#x27;subList&#x27;).value = &#x27;&#x27;;
    renderReg(); toast(&#x27;已加入畢業路徑計劃&#x27;);
  };
}

/* ============================================================
   模塊 3：WIE
   ============================================================ */
function renderWie() {
  var wie = LS.get(&#x27;wie&#x27;, { req: 960, done: 0, due: &#x27;&#x27; });
  if (document.activeElement !== $id(&#x27;wieReq&#x27;)) $id(&#x27;wieReq&#x27;).value = wie.req || 960;
  if (document.activeElement !== $id(&#x27;wieDone&#x27;)) $id(&#x27;wieDone&#x27;).value = wie.done || 0;
  if (document.activeElement !== $id(&#x27;wieDue&#x27;)) $id(&#x27;wieDue&#x27;).value = wie.due || &#x27;&#x27;;
  var pct = Math.min(100, Math.round(((wie.done || 0) / (wie.req || 960)) * 100));
  if ($id(&#x27;wieBar&#x27;)) $id(&#x27;wieBar&#x27;).style.width = pct + &#x27;%&#x27;;

  var n = daysUntil(&#x27;2026-08-31&#x27;);
  if ($id(&#x27;ctDays&#x27;)) $id(&#x27;ctDays&#x27;).textContent = n == null ? &#x27;&#x27; : (n &lt; 0 ? &#x27;已過期&#x27; : &#x27;⚠️ 剩 &#x27; + n + &#x27; 天&#x27;);

  var list = LS.get(&#x27;interns&#x27;, []);
  if ($id(&#x27;intTbody&#x27;)) {
    $id(&#x27;intTbody&#x27;).innerHTML = list.length ? list.map(function (s) {
      return &#x27;&lt;tr&gt;&lt;td&gt;&lt;b&gt;&#x27; + esc(s.pos) + &#x27;&lt;/b&gt;&lt;/td&gt;&lt;td&gt;&#x27; + esc(s.co) + &#x27;&lt;/td&gt;&lt;td&gt;&#x27; + fmtD(s.start) + &#x27;&lt;/td&gt;&lt;td&gt;&#x27; + fmtD(s.end) + &#x27;&lt;/td&gt;&lt;td&gt;&#x27; + esc(s.hr || &#x27;—&#x27;) + &#x27;&lt;/td&gt;&lt;td&gt;&lt;/td&gt;&lt;/tr&gt;&#x27;;
    }).join(&#x27;&#x27;) : &#x27;&lt;tr&gt;&lt;td colspan=&quot;6&quot; class=&quot;empty-tip&quot;&gt;尚未新增實習記錄&lt;/td&gt;&lt;/tr&gt;&#x27;;
    var rows = $id(&#x27;intTbody&#x27;).querySelectorAll(&#x27;tr&#x27;);
    list.forEach(function (s, i) {
      if (rows[i]) rows[i].appendChild(delBtnCell(function () { list.splice(i, 1); LS.set(&#x27;interns&#x27;, list); renderWie(); }));
    });
  }
  if ($id(&#x27;intNotes&#x27;)) { var v = LS.get(&#x27;wie_notes&#x27;, &#x27;&#x27;); if (document.activeElement !== $id(&#x27;intNotes&#x27;)) $id(&#x27;intNotes&#x27;).value = v; }
}
function initWie() {
  [&#x27;wieReq&#x27;, &#x27;wieDone&#x27;, &#x27;wieDue&#x27;].forEach(function (id) {
    var el = $id(id); if (!el) return;
    el.addEventListener(&#x27;input&#x27;, debounce(function () {
      var w = LS.get(&#x27;wie&#x27;, {});
      if (id === &#x27;wieDue&#x27;) w.due = el.value;
      else w[id === &#x27;wieReq&#x27; ? &#x27;req&#x27; : &#x27;done&#x27;] = el.value === &#x27;&#x27; ? 0 : Number(el.value);
      LS.set(&#x27;wie&#x27;, w); renderWie(); renderDashboard();
    }, 250));
  });
  if ($id(&#x27;addIntBtn&#x27;)) $id(&#x27;addIntBtn&#x27;).onclick = function () {
    var p = $id(&#x27;intPos&#x27;).value.trim(), c = $id(&#x27;intCo&#x27;).value.trim();
    if (!p || !c) { toast(&#x27;請填寫崗位和公司&#x27;); return; }
    var list = LS.get(&#x27;interns&#x27;, []);
    list.push({ pos: p, co: c, start: $id(&#x27;intStart&#x27;).value, end: $id(&#x27;intEnd&#x27;).value, hr: $id(&#x27;intHr&#x27;).value });
    LS.set(&#x27;interns&#x27;, list);
    [&#x27;intPos&#x27;, &#x27;intCo&#x27;, &#x27;intStart&#x27;, &#x27;intEnd&#x27;, &#x27;intHr&#x27;].forEach(function (i) { $id(i).value = &#x27;&#x27;; });
    renderWie(); toast(&#x27;已新增實習記錄&#x27;);
    /* 自動累加 WIE 工時 */
    var h = Number($id(&#x27;intHr&#x27;).value) || 0;
    if (h &gt; 0) toast(&#x27;提示：記得更新上方「已完成工時」&#x27;);
  };
  if ($id(&#x27;intNotes&#x27;)) $id(&#x27;intNotes&#x27;).addEventListener(&#x27;input&#x27;, debounce(function () { LS.set(&#x27;wie_notes&#x27;, $id(&#x27;intNotes&#x27;).value); }, 400));
}

/* ============================================================
   模塊 4：Exchange
   ============================================================ */
function renderExchange() {
  var n = daysUntil(&#x27;2026-09-03&#x27;);
  if ($id(&#x27;exDays&#x27;)) $id(&#x27;exDays&#x27;).textContent = n == null ? &#x27;&#x27; : (n &lt; 0 ? &#x27;已截止&#x27; : &#x27;⚠️ 剩 &#x27; + n + &#x27; 天&#x27;);

  var chk = LS.get(&#x27;exchk&#x27;, FIX.exCheck.slice());
  if ($id(&#x27;exCheckList&#x27;)) {
    $id(&#x27;exCheckList&#x27;).innerHTML = chk.map(function (c, i) {
      return &#x27;&lt;li class=&quot;&#x27; + (c.done ? &#x27;done&#x27; : &#x27;&#x27;) + &#x27;&quot;&gt;&lt;input type=&quot;checkbox&quot; data-i=&quot;&#x27; + i + &#x27;&quot; &#x27; + (c.done ? &#x27;checked&#x27; : &#x27;&#x27;) + &#x27; /&gt;&lt;span&gt;&#x27; + esc(c.t) + &#x27;&lt;/span&gt;&lt;button class=&quot;row-del&quot; data-del=&quot;&#x27; + i + &#x27;&quot; style=&quot;margin-left:auto&quot;&gt;🗑&lt;/button&gt;&lt;/li&gt;&#x27;;
    }).join(&#x27;&#x27;);
    $qa(&#x27;#exCheckList input[type=checkbox]&#x27;).forEach(function (cb) {
      cb.onchange = function () { var a = LS.get(&#x27;exchk&#x27;, []); a[+cb.dataset.i].done = cb.checked; LS.set(&#x27;exchk&#x27;, a); renderExchange(); };
    });
    $qa(&#x27;#exCheckList .row-del&#x27;).forEach(function (b) {
      b.onclick = function () { var a = LS.get(&#x27;exchk&#x27;, []); a.splice(+b.dataset.del, 1); LS.set(&#x27;exchk&#x27;, a); renderExchange(); };
    });
  }
  var sch = LS.get(&#x27;exschools&#x27;, []);
  if ($id(&#x27;exTbody&#x27;)) {
    $id(&#x27;exTbody&#x27;).innerHTML = sch.length ? sch.map(function (s) {
      return &#x27;&lt;tr&gt;&lt;td&gt;&lt;b&gt;&#x27; + esc(s.s) + &#x27;&lt;/b&gt;&lt;/td&gt;&lt;td&gt;&#x27; + esc(s.gpa || &#x27;—&#x27;) + &#x27;&lt;/td&gt;&lt;td&gt;&#x27; + esc(s.lang || &#x27;—&#x27;) + &#x27;&lt;/td&gt;&lt;td&gt;&#x27; + esc(s.note || &#x27;—&#x27;) + &#x27;&lt;/td&gt;&lt;td&gt;&lt;/td&gt;&lt;/tr&gt;&#x27;;
    }).join(&#x27;&#x27;) : &#x27;&lt;tr&gt;&lt;td colspan=&quot;5&quot; class=&quot;empty-tip&quot;&gt;尚未新增心儀院校（例：EHL 瑞士）&lt;/td&gt;&lt;/tr&gt;&#x27;;
    var rows = $id(&#x27;exTbody&#x27;).querySelectorAll(&#x27;tr&#x27;);
    sch.forEach(function (s, i) {
      if (rows[i]) rows[i].appendChild(delBtnCell(function () { sch.splice(i, 1); LS.set(&#x27;exschools&#x27;, sch); renderExchange(); }));
    });
  }
}
function initExchange() {
  if ($id(&#x27;addExChkBtn&#x27;)) $id(&#x27;addExChkBtn&#x27;).onclick = function () {
    var v = $id(&#x27;exChkInput&#x27;).value.trim(); if (!v) return;
    var a = LS.get(&#x27;exchk&#x27;, []); a.push({ t: v, done: false }); LS.set(&#x27;exchk&#x27;, a);
    $id(&#x27;exChkInput&#x27;).value = &#x27;&#x27;; renderExchange();
  };
  if ($id(&#x27;addExBtn&#x27;)) $id(&#x27;addExBtn&#x27;).onclick = function () {
    var s = $id(&#x27;exSchool&#x27;).value.trim(); if (!s) { toast(&#x27;請填寫學校名稱&#x27;); return; }
    var a = LS.get(&#x27;exschools&#x27;, []);
    a.push({ s: s, gpa: $id(&#x27;exGPA&#x27;).value.trim(), lang: $id(&#x27;exLang&#x27;).value.trim(), note: $id(&#x27;exNote&#x27;).value.trim() });
    LS.set(&#x27;exschools&#x27;, a);
    [&#x27;exSchool&#x27;, &#x27;exGPA&#x27;, &#x27;exLang&#x27;, &#x27;exNote&#x27;].forEach(function (i) { $id(i).value = &#x27;&#x27;; });
    renderExchange(); toast(&#x27;已新增院校&#x27;);
  };
}

/* ============================================================
   模塊 5：政府資助
   ============================================================ */
function renderFunding() {
  var st = LS.get(&#x27;fund_status&#x27;, {});
  $qa(&#x27;.status-sel&#x27;).forEach(function (sel) {
    var k = sel.getAttribute(&#x27;data-key&#x27;);
    if (st[k] &amp;&amp; document.activeElement !== sel) sel.value = st[k];
    sel.onchange = function () { var o = LS.get(&#x27;fund_status&#x27;, {}); o[k] = sel.value; LS.set(&#x27;fund_status&#x27;, o); toast(&#x27;已記錄狀態：&#x27; + sel.value); };
  });
  var list = LS.get(&#x27;funds&#x27;, []);
  if ($id(&#x27;fnTbody&#x27;)) {
    $id(&#x27;fnTbody&#x27;).innerHTML = list.length ? list.map(function (f, i) {
      var u = urgencyInfo(f.due);
      return &#x27;&lt;tr&gt;&lt;td&gt;&lt;b&gt;&#x27; + esc(f.name) + &#x27;&lt;/b&gt;&lt;/td&gt;&lt;td class=&quot;&#x27; + (u.cls === &#x27;urg&#x27; ? &#x27;red&#x27; : &#x27;&#x27;) + &#x27;&quot;&gt;&#x27; + fmtD(f.due) + &#x27;&lt;/td&gt;&lt;td&gt;&#x27; + esc(f.doc || &#x27;—&#x27;) + &#x27;&lt;/td&gt;&lt;td&gt;&#x27; +
        &#x27;&lt;select data-i=&quot;&#x27; + i + &#x27;&quot;&gt;&lt;option&gt;未開始&lt;/option&gt;&lt;option&gt;準備中&lt;/option&gt;&lt;option&gt;已遞交&lt;/option&gt;&lt;option&gt;已批核&lt;/option&gt;&lt;/select&gt;&lt;/td&gt;&lt;td&gt;&lt;/td&gt;&lt;/tr&gt;&#x27;;
    }).join(&#x27;&#x27;) : &#x27;&lt;tr&gt;&lt;td colspan=&quot;5&quot; class=&quot;empty-tip&quot;&gt;尚未新增自訂資助項目&lt;/td&gt;&lt;/tr&gt;&#x27;;
    var sels = $id(&#x27;fnTbody&#x27;).querySelectorAll(&#x27;select&#x27;);
    sels.forEach(function (sel) {
      var i = +sel.getAttribute(&#x27;data-i&#x27;);
      if (list[i].status) sel.value = list[i].status;
      sel.onchange = function () { var a = LS.get(&#x27;funds&#x27;, []); a[i].status = sel.value; LS.set(&#x27;funds&#x27;, a); };
    });
    var rows = $id(&#x27;fnTbody&#x27;).querySelectorAll(&#x27;tr&#x27;);
    list.forEach(function (f, i) {
      if (rows[i]) rows[i].appendChild(delBtnCell(function () { list.splice(i, 1); LS.set(&#x27;funds&#x27;, list); renderFunding(); }));
    });
  }
}
function initFunding() {
  if ($id(&#x27;addFnBtn&#x27;)) $id(&#x27;addFnBtn&#x27;).onclick = function () {
    var n = $id(&#x27;fnName&#x27;).value.trim(); if (!n) { toast(&#x27;請填寫資助名稱&#x27;); return; }
    var a = LS.get(&#x27;funds&#x27;, []);
    a.push({ name: n, due: $id(&#x27;fnDue&#x27;).value, doc: $id(&#x27;fnDoc&#x27;).value.trim(), status: &#x27;未開始&#x27; });
    LS.set(&#x27;funds&#x27;, a);
    $id(&#x27;fnName&#x27;).value = $id(&#x27;fnDue&#x27;).value = $id(&#x27;fnDoc&#x27;).value = &#x27;&#x27;;
    renderFunding(); toast(&#x27;已新增資助項目&#x27;);
  };
}

/* ============================================================
   模塊 6：簡歷生成器
   ============================================================ */
var RESUME_FIELDS = [&#x27;rName&#x27;, &#x27;rPhone&#x27;, &#x27;rEmail&#x27;, &#x27;rSchool&#x27;, &#x27;rGPA&#x27;, &#x27;rLang&#x27;, &#x27;rIntro&#x27;, &#x27;rExp&#x27;, &#x27;rProj&#x27;, &#x27;rSkill&#x27;, &#x27;rExtra&#x27;];
var RESUME_TPL = &#x27;intern&#x27;;

function resumeData() {
  var r = LS.get(&#x27;resume&#x27;, {});
  return {
    name: r.rName || &#x27;Lok Yi, Chan&#x27;,
    phone: r.rPhone || &#x27;&#x27;,
    email: r.rEmail || &#x27;26017276d@connect.polyu.hk&#x27;,
    school: r.rSchool || &#x27;The Hong Kong Polytechnic University · SHTM (Year 3)&#x27;,
    gpa: r.rGPA || &#x27;&#x27;,
    lang: r.rLang || &#x27;Cantonese (Native), Mandarin (Fluent), English (Fluent)&#x27;,
    intro: r.rIntro || &#x27;&#x27;, exp: r.rExp || &#x27;&#x27;, proj: r.rProj || &#x27;&#x27;,
    skill: r.rSkill || &#x27;&#x27;, extra: r.rExtra || &#x27;&#x27;
  };
}
function buildResume(tpl) {
  var d = resumeData();
  var L = [];
  var hr = &#x27;──────────────────────────────&#x27;;
  function sec(t) { L.push(&#x27;&#x27;, t.toUpperCase(), hr); }
  L.push(d.name);
  var contact = [d.phone, d.email].filter(Boolean).join(&#x27; · &#x27;);
  if (contact) L.push(contact);
  L.push(d.school + (d.gpa ? &#x27; · GPA &#x27; + d.gpa : &#x27;&#x27;));

  if (tpl === &#x27;intern&#x27;) {
    L.push(&#x27;&#x27;, &#x27;OBJECTIVE&#x27;, hr);
    L.push(d.intro || &#x27;Seeking a marketing / event management internship where I can apply my hospitality training, creative planning and photography skills.&#x27;);
    if (d.exp) { sec(&#x27;Experience&#x27;); d.exp.split(&#x27;\n&#x27;).filter(Boolean).forEach(function (x) { L.push(&#x27;• &#x27; + x.trim()); }); }
    if (d.proj) { sec(&#x27;Projects&#x27;); d.proj.split(&#x27;\n&#x27;).filter(Boolean).forEach(function (x) { L.push(&#x27;• &#x27; + x.trim()); }); }
    if (d.skill) { sec(&#x27;Skills&#x27;); L.push(d.skill.split(/[,，\n]/).map(function (s) { return s.trim(); }).filter(Boolean).join(&#x27; · &#x27;)); }
    if (d.extra) { sec(&#x27;Activities &amp; Awards&#x27;); d.extra.split(&#x27;\n&#x27;).filter(Boolean).forEach(function (x) { L.push(&#x27;• &#x27; + x.trim()); }); }
    sec(&#x27;Languages&#x27;); L.push(d.lang);
  } else if (tpl === &#x27;exchange&#x27;) {
    L.push(&#x27;&#x27;, &#x27;PERSONAL STATEMENT — STUDENT EXCHANGE APPLICATION&#x27;, hr);
    L.push(d.intro || &#x27;As a Year 3 SHTM student, I am eager to broaden my horizon through the exchange programme, experiencing hospitality education in a different culture.&#x27;);
    if (d.exp) { sec(&#x27;Relevant Experience&#x27;); d.exp.split(&#x27;\n&#x27;).filter(Boolean).forEach(function (x) { L.push(&#x27;• &#x27; + x.trim()); }); }
    if (d.proj) { sec(&#x27;Coursework &amp; Projects&#x27;); d.proj.split(&#x27;\n&#x27;).filter(Boolean).forEach(function (x) { L.push(&#x27;• &#x27; + x.trim()); }); }
    if (d.skill) { sec(&#x27;Skills &amp; Interests&#x27;); L.push(d.skill.split(/[,，\n]/).map(function (s) { return s.trim(); }).filter(Boolean).join(&#x27; · &#x27;)); }
    if (d.extra) { sec(&#x27;Extracurricular&#x27;); d.extra.split(&#x27;\n&#x27;).filter(Boolean).forEach(function (x) { L.push(&#x27;• &#x27; + x.trim()); }); }
    sec(&#x27;Languages&#x27;); L.push(d.lang);
  } else if (tpl === &#x27;fund&#x27;) {
    L.push(&#x27;&#x27;, &#x27;FINANCIAL ASSISTANCE APPLICATION — SUMMARY&#x27;, hr);
    L.push(&#x27;此版本用於 TSFS / NLSFT / PolyU FA 等資助申請的自我介紹與家庭狀況補充說明。&#x27;);
    if (d.intro) { L.push(&#x27;&#x27;, &#x27;自我介紹&#x27;, hr); L.push(d.intro); }
    if (d.exp) { sec(&#x27;Part-time / Work Experience（收入證明相關）&#x27;); d.exp.split(&#x27;\n&#x27;).filter(Boolean).forEach(function (x) { L.push(&#x27;• &#x27; + x.trim()); }); }
    if (d.extra) { sec(&#x27;Other Information&#x27;); d.extra.split(&#x27;\n&#x27;).filter(Boolean).forEach(function (x) { L.push(&#x27;• &#x27; + x.trim()); }); }
    sec(&#x27;Contact&#x27;); L.push(d.email + (d.phone ? &#x27; · &#x27; + d.phone : &#x27;&#x27;));
  } else {
    L.push(&#x27;&#x27;, &#x27;PERSONAL STATEMENT — MSc IN NEW MEDIA (CUHK)&#x27;, hr);
    L.push(d.intro || &#x27;With a hospitality management background and hands-on experience in content creation and photography, I aspire to become a new media professional.&#x27;);
    if (d.exp) { sec(&#x27;Experience&#x27;); d.exp.split(&#x27;\n&#x27;).filter(Boolean).forEach(function (x) { L.push(&#x27;• &#x27; + x.trim()); }); }
    if (d.proj) { sec(&#x27;Portfolio &amp; Projects&#x27;); d.proj.split(&#x27;\n&#x27;).filter(Boolean).forEach(function (x) { L.push(&#x27;• &#x27; + x.trim()); }); }
    if (d.skill) { sec(&#x27;Skills&#x27;); L.push(d.skill.split(/[,，\n]/).map(function (s) { return s.trim(); }).filter(Boolean).join(&#x27; · &#x27;)); }
    if (d.extra) { sec(&#x27;Activities &amp; Awards&#x27;); d.extra.split(&#x27;\n&#x27;).filter(Boolean).forEach(function (x) { L.push(&#x27;• &#x27; + x.trim()); }); }
    sec(&#x27;Languages&#x27;); L.push(d.lang);
  }
  L.push(&#x27;&#x27;, &#x27;（生成時間：&#x27; + fmtFull(new Date()) + &#x27;）&#x27;);
  return L.join(&#x27;\n&#x27;);
}
function renderResume() {
  var r = LS.get(&#x27;resume&#x27;, {});
  RESUME_FIELDS.forEach(function (f) {
    var el = $id(f); if (!el) return;
    if (document.activeElement !== el) el.value = r[f] || &#x27;&#x27;;
  });
  var vers = LS.get(&#x27;versions&#x27;, []);
  if ($id(&#x27;verList&#x27;)) {
    $id(&#x27;verList&#x27;).innerHTML = vers.length ? vers.map(function (v) {
      return &#x27;&lt;li&gt;&lt;span&gt;📄 &lt;b&gt;&#x27; + esc(v.name) + &#x27;&lt;/b&gt;&lt;br&gt;&lt;span style=&quot;font-size:11px;color:#9ca3af&quot;&gt;&#x27; + v.ts + &#x27; · &#x27; + v.tpl + &#x27;&lt;/span&gt;&lt;/span&gt;&lt;/li&gt;&#x27;;
    }).join(&#x27;&#x27;) : &#x27;&lt;li class=&quot;empty-tip&quot; style=&quot;background:none;padding:8px 4px&quot;&gt;尚未儲存版本&lt;/li&gt;&#x27;;
    var lis = $id(&#x27;verList&#x27;).querySelectorAll(&#x27;li&#x27;);
    vers.forEach(function (v, i) {
      if (!lis[i]) return;
      var load = document.createElement(&#x27;button&#x27;); load.className = &#x27;ghost&#x27;; load.textContent = &#x27;載入&#x27;; load.style.padding = &#x27;4px 10px&#x27;;
      load.onclick = function () { if ($id(&#x27;resumeOut&#x27;)) $id(&#x27;resumeOut&#x27;).value = v.content; toast(&#x27;已載入版本：&#x27; + v.name); };
      var del = delBtn(function () { vers.splice(i, 1); LS.set(&#x27;versions&#x27;, vers); renderResume(); });
      lis[i].appendChild(load); lis[i].appendChild(del);
    });
  }
}
function initResume() {
  RESUME_FIELDS.forEach(function (f) {
    var el = $id(f); if (!el) return;
    el.addEventListener(&#x27;input&#x27;, debounce(function () {
      var r = LS.get(&#x27;resume&#x27;, {}); r[f] = el.value; LS.set(&#x27;resume&#x27;, r);
    }, 350));
  });
  $qa(&#x27;.tab[data-tpl]&#x27;).forEach(function (t) {
    t.onclick = function () {
      $qa(&#x27;.tab[data-tpl]&#x27;).forEach(function (x) { x.classList.remove(&#x27;active&#x27;); });
      t.classList.add(&#x27;active&#x27;);
      RESUME_TPL = t.getAttribute(&#x27;data-tpl&#x27;);
      var r = LS.get(&#x27;resume&#x27;, {}); r.tpl = RESUME_TPL; LS.set(&#x27;resume&#x27;, r);
    };
  });
  var savedTpl = LS.get(&#x27;resume&#x27;, {}).tpl;
  if (savedTpl) {
    RESUME_TPL = savedTpl;
    $qa(&#x27;.tab[data-tpl]&#x27;).forEach(function (x) { x.classList.toggle(&#x27;active&#x27;, x.getAttribute(&#x27;data-tpl&#x27;) === savedTpl); });
  }
  if ($id(&#x27;genResumeBtn&#x27;)) $id(&#x27;genResumeBtn&#x27;).onclick = function () {
    if ($id(&#x27;resumeOut&#x27;)) $id(&#x27;resumeOut&#x27;).value = buildResume(RESUME_TPL);
    toast(&#x27;已生成「&#x27; + ({ intern: &#x27;求職實習版&#x27;, exchange: &#x27;交換申請版&#x27;, fund: &#x27;資助申請版&#x27;, cuhk: &#x27;升學申請版&#x27; }[RESUME_TPL]) + &#x27;」簡歷&#x27;);
  };
  if ($id(&#x27;copyResumeBtn&#x27;)) $id(&#x27;copyResumeBtn&#x27;).onclick = function () {
    var txt = ($id(&#x27;resumeOut&#x27;) || {}).value || &#x27;&#x27;;
    if (!txt) { toast(&#x27;請先按「生成簡歷」&#x27;); return; }
    if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { toast(&#x27;已複製到剪貼板 ✓&#x27;); });
    else { $id(&#x27;resumeOut&#x27;).select(); document.execCommand(&#x27;copy&#x27;); toast(&#x27;已複製&#x27;); }
  };
  if ($id(&#x27;dlResumeBtn&#x27;)) $id(&#x27;dlResumeBtn&#x27;).onclick = function () {
    var txt = ($id(&#x27;resumeOut&#x27;) || {}).value || &#x27;&#x27;;
    if (!txt) { toast(&#x27;請先按「生成簡歷」&#x27;); return; }
    downloadText(&#x27;LokYi_Resume_&#x27; + RESUME_TPL + &#x27;_&#x27; + todayStr() + &#x27;.txt&#x27;, txt);
  };
  if ($id(&#x27;saveVerBtn&#x27;)) $id(&#x27;saveVerBtn&#x27;).onclick = function () {
    var txt = ($id(&#x27;resumeOut&#x27;) || {}).value || &#x27;&#x27;;
    if (!txt) { toast(&#x27;請先生成簡歷&#x27;); return; }
    var vers = LS.get(&#x27;versions&#x27;, []);
    var d = new Date();
    vers.push({ name: RESUME_TPL + &#x27;-&#x27; + pad2(d.getMonth() + 1) + &#x27;/&#x27; + pad2(d.getDate()) + &#x27; #&#x27; + (vers.length + 1), ts: fmtFull(d) + &#x27; &#x27; + pad2(d.getHours()) + &#x27;:&#x27; + pad2(d.getMinutes()), tpl: RESUME_TPL, content: txt });
    LS.set(&#x27;versions&#x27;, vers); renderResume(); renderDashboard(); toast(&#x27;已儲存版本 ✓&#x27;);
  };

  /* AI 內聯生成（本地模板） */
  $qa(&#x27;.ai-inline-btn[data-ai]&#x27;).forEach(function (btn) {
    btn.onclick = function () {
      var f = btn.getAttribute(&#x27;data-ai&#x27;), el = $id(f); if (!el) return;
      var d = resumeData();
      if (f === &#x27;rIntro&#x27;) {
        el.value = &#x27;香港理工大學 SHTM Year 3 學生，主修酒店及旅遊業管理，熟悉市場營銷、活動策劃與旅遊行程設計，兼具攝影與新媒體內容製作經驗。曾於 HKCC 修畢副學士課程並成功升讀學位課程，具備跨文化溝通能力（粵語、普通話、英語流利）。希望將酒店業的服務思維與新媒體的創意結合，未來目標攻讀 CUHK 新媒體碩士，成為兼具內容創作與品牌行銷能力的專業人士。&#x27;;
      } else if (f === &#x27;rExp&#x27;) {
        var base = el.value.split(&#x27;\n&#x27;).filter(Boolean);
        el.value = (base.length ? base : [&#x27;Marketing Intern | （公司名） | 2025 | 支援社交媒體內容策劃，製作圖文及短影片，提升帳號互動率&#x27;, &#x27;Event Assistant | （活動名稱） | 2025 | 協助活動流程安排、賓客接待與現場攝影記錄&#x27;, &#x27;Part-time | （機構） | 2024–現在 | 負責客戶溝通與行程規劃，累積服務業實戰經驗&#x27;]).map(function (x) {
          return x.replace(/负责/g, &#x27;負責&#x27;).replace(/负责/g, &#x27;統籌&#x27;);
        }).join(&#x27;\n&#x27;);
      } else if (f === &#x27;rProj&#x27;) {
        el.value = el.value || &#x27;• 旅遊行程規劃專案：為目標客群設計 3 日 2 夜深度遊行程，結合攝影打卡點與本地文化體驗\n• 課堂市場營銷企劃：完成品牌推廣方案，包括市場分析、定位與社交媒體投放策略\n• 個人攝影作品集：經營個人社交平台，累積內容策劃與後期製作經驗&#x27;;
      } else if (f === &#x27;rSkill&#x27;) {
        el.value = &#x27;Adobe Photoshop / Lightroom, 手機短影音剪輯（CapCut / Premiere Pro 基礎）, 社交媒體內容策劃與數據分析, 活動策劃與執行, 旅遊行程設計, 中英粵三語文案&#x27;;
      } else if (f === &#x27;rExtra&#x27;) {
        el.value = el.value || &#x27;• 個人社交 IP 經營（攝影 / 旅遊內容）\n• 校園活動協辦\n• HKCC 副學士畢業並成功升讀 PolyU 學位課程&#x27;;
      }
      var r = LS.get(&#x27;resume&#x27;, {}); r[f] = el.value; LS.set(&#x27;resume&#x27;, r);
      toast(&#x27;✨ 已生成，可自行修改&#x27;);
    };
  });
}

/* ============================================================
   模塊 7：求職追蹤
   ============================================================ */
function renderJobs() {
  var list = LS.get(&#x27;jobs&#x27;, []);
  if ($id(&#x27;jobTbody&#x27;)) {
    $id(&#x27;jobTbody&#x27;).innerHTML = list.length ? list.map(function (j) {
      var stColor = { &#x27;已投遞&#x27;: &#x27;&#x27;, &#x27;面試中&#x27;: &#x27;color:#d97706;font-weight:700&#x27;, &#x27;已 Offer&#x27;: &#x27;color:#059669;font-weight:700&#x27;, &#x27;已拒&#x27;: &#x27;color:#9ca3af&#x27; }[j.status] || &#x27;&#x27;;
      return &#x27;&lt;tr&gt;&lt;td&gt;&lt;b&gt;&#x27; + esc(j.co) + &#x27;&lt;/b&gt;&lt;/td&gt;&lt;td&gt;&#x27; + esc(j.pos) + &#x27;&lt;/td&gt;&lt;td&gt;&#x27; + fmtD(j.date) + &#x27;&lt;/td&gt;&lt;td style=&quot;&#x27; + stColor + &#x27;&quot;&gt;&#x27; + esc(j.status) + &#x27;&lt;/td&gt;&lt;td&gt;&#x27; + fmtD(j.int) + &#x27;&lt;/td&gt;&lt;td style=&quot;font-size:12px&quot;&gt;&#x27; + esc(j.note || &#x27;—&#x27;) + &#x27;&lt;/td&gt;&lt;td&gt;&lt;/td&gt;&lt;/tr&gt;&#x27;;
    }).join(&#x27;&#x27;) : &#x27;&lt;tr&gt;&lt;td colspan=&quot;7&quot; class=&quot;empty-tip&quot;&gt;尚未投遞記錄&lt;/td&gt;&lt;/tr&gt;&#x27;;
    var rows = $id(&#x27;jobTbody&#x27;).querySelectorAll(&#x27;tr&#x27;);
    list.forEach(function (j, i) {
      if (rows[i]) rows[i].appendChild(delBtnCell(function () { list.splice(i, 1); LS.set(&#x27;jobs&#x27;, list); renderJobs(); renderDashboard(); }));
    });
  }
  if ($id(&#x27;interviewLib&#x27;)) { var v = LS.get(&#x27;interview_lib&#x27;, &#x27;&#x27;); if (document.activeElement !== $id(&#x27;interviewLib&#x27;)) $id(&#x27;interviewLib&#x27;).value = v; }
}
function initJobs() {
  if ($id(&#x27;addJobBtn&#x27;)) $id(&#x27;addJobBtn&#x27;).onclick = function () {
    var c = $id(&#x27;jobCo&#x27;).value.trim(), p = $id(&#x27;jobPos&#x27;).value.trim();
    if (!c || !p) { toast(&#x27;請填寫公司和崗位&#x27;); return; }
    var list = LS.get(&#x27;jobs&#x27;, []);
    list.push({ co: c, pos: p, date: $id(&#x27;jobDate&#x27;).value, status: $id(&#x27;jobStatus&#x27;).value, int: ($id(&#x27;jobInt&#x27;) || {}).value || &#x27;&#x27;, note: ($id(&#x27;jobNote&#x27;) || {}).value || &#x27;&#x27; });
    LS.set(&#x27;jobs&#x27;, list);
    [&#x27;jobCo&#x27;, &#x27;jobPos&#x27;, &#x27;jobDate&#x27;, &#x27;jobInt&#x27;, &#x27;jobNote&#x27;].forEach(function (i) { if ($id(i)) $id(i).value = &#x27;&#x27;; });
    renderJobs(); renderDashboard(); toast(&#x27;已記錄投遞 ✓&#x27;);
  };
  if ($id(&#x27;interviewLib&#x27;)) $id(&#x27;interviewLib&#x27;).addEventListener(&#x27;input&#x27;, debounce(function () { LS.set(&#x27;interview_lib&#x27;, $id(&#x27;interviewLib&#x27;).value); }, 400));
}

/* ============================================================
   模塊 9：待辦 &amp; 提醒
   ============================================================ */
function renderTodos() {
  var list = LS.get(&#x27;todos&#x27;, []);
  if ($id(&#x27;tdTbody&#x27;)) {
    $id(&#x27;tdTbody&#x27;).innerHTML = list.length ? list.map(function (t, i) {
      var u = urgencyInfo(t.due);
      return &#x27;&lt;tr&gt;&lt;td&gt;&lt;b&gt;&#x27; + esc(t.t) + &#x27;&lt;/b&gt;&lt;/td&gt;&lt;td&gt;&#x27; + esc(t.cat || &#x27;—&#x27;) + &#x27;&lt;/td&gt;&lt;td&gt;&#x27; + fmtD(t.due) + &#x27;&lt;/td&gt;&#x27; +
        &#x27;&lt;td&gt;&lt;span class=&quot;strategy-pill &#x27; + (u.cls === &#x27;urg&#x27; ? &#x27;s-reach&#x27; : u.cls === &#x27;warn&#x27; ? &#x27;s-mid&#x27; : &#x27;s-safe&#x27;) + &#x27;&quot;&gt;&#x27; + u.label + &#x27;&lt;/span&gt;&lt;/td&gt;&#x27; +
        &#x27;&lt;td&gt;&lt;input type=&quot;checkbox&quot; data-i=&quot;&#x27; + i + &#x27;&quot; &#x27; + (t.done ? &#x27;checked&#x27; : &#x27;&#x27;) + &#x27; /&gt;&lt;/td&gt;&lt;td&gt;&lt;/td&gt;&lt;/tr&gt;&#x27;;
    }).join(&#x27;&#x27;) : &#x27;&lt;tr&gt;&lt;td colspan=&quot;6&quot; class=&quot;empty-tip&quot;&gt;沒有待辦事項，太優秀了 🎉&lt;/td&gt;&lt;/tr&gt;&#x27;;
    $qa(&#x27;#tdTbody input[type=checkbox]&#x27;).forEach(function (cb) {
      cb.onchange = function () {
        var a = LS.get(&#x27;todos&#x27;, []);
        a[+cb.getAttribute(&#x27;data-i&#x27;)].done = cb.checked;
        LS.set(&#x27;todos&#x27;, a); renderTodos(); renderDashboard();
      };
    });
    var rows = $id(&#x27;tdTbody&#x27;).querySelectorAll(&#x27;tr&#x27;);
    list.forEach(function (t, i) {
      if (rows[i]) rows[i].appendChild(delBtnCell(function () { list.splice(i, 1); LS.set(&#x27;todos&#x27;, list); renderTodos(); renderDashboard(); }));
    });
  }
}
function initTodos() {
  if ($id(&#x27;addTdBtn&#x27;)) $id(&#x27;addTdBtn&#x27;).onclick = function () {
    var t = $id(&#x27;tdTitle&#x27;).value.trim(); if (!t) { toast(&#x27;請填寫事項&#x27;); return; }
    var a = LS.get(&#x27;todos&#x27;, []);
    a.push({ t: t, cat: $id(&#x27;tdCat&#x27;).value, due: $id(&#x27;tdDue&#x27;).value, done: false });
    LS.set(&#x27;todos&#x27;, a);
    $id(&#x27;tdTitle&#x27;).value = &#x27;&#x27;; $id(&#x27;tdDue&#x27;).value = &#x27;&#x27;;
    renderTodos(); renderDashboard(); toast(&#x27;已新增待辦 ✓&#x27;);
  };
  if ($id(&#x27;exportTodoBtn&#x27;)) $id(&#x27;exportTodoBtn&#x27;).onclick = function () {
    var a = LS.get(&#x27;todos&#x27;, []);
    var lines = [&#x27;📋 我的待辦 · &#x27; + fmtFull(new Date()), &#x27;&#x27;];
    a.sort(function (x, y) { return (x.due || &#x27;9999&#x27;).localeCompare(y.due || &#x27;9999&#x27;); }).forEach(function (t) {
      lines.push((t.done ? &#x27;[x] &#x27; : &#x27;[ ] &#x27;) + t.t + (t.due ? &#x27;（截止 &#x27; + fmtD(t.due) + &#x27;）&#x27; : &#x27;&#x27;) + &#x27; · &#x27; + (t.cat || &#x27;&#x27;));
    });
    if (!a.length) lines.push(&#x27;（目前沒有待辦）&#x27;);
    if ($id(&#x27;exportOut&#x27;)) $id(&#x27;exportOut&#x27;).textContent = lines.join(&#x27;\n&#x27;);
  };
  /* 🆕 v2.3.1 智慧生成待辦 */
  if ($id(&#x27;autoTdBtn&#x27;)) $id(&#x27;autoTdBtn&#x27;).onclick = renderAutoTd;
}

/* ============================================================
   🆕 v2.3.1 智慧生成待辦：掃描 Dashboard 截止日期 / 報名事項
   來源：學校日程 · 交換材料清單 · 資助申請 · 求職面試 · WIE 時數
   ============================================================ */
function autoTdCat(t) {
  if (/交換/.test(t)) return &#x27;交換計劃&#x27;;
  if (/WIE/.test(t)) return &#x27;WIE 實習&#x27;;
  if (/TSFS|NLSFT|資助/.test(t)) return &#x27;資助申請&#x27;;
  if (/選科|Add \/ Drop|調整|Semester|開學/.test(t)) return &#x27;學業&#x27;;
  if (/面試/.test(t)) return &#x27;求職&#x27;;
  return &#x27;學業&#x27;;
}
function autoTodoCandidates() {
  var out = [], today = todayStr();
  function add(autoId, t, cat, due, src) { out.push({ autoId: autoId, t: t, cat: cat, due: due, src: src }); }
  /* 1. 學校日程（截止 / 報名 / 選科類；排除「開課」等純事件） */
  getDl(&#x27;ly&#x27;).forEach(function (x) {
    if (!x.d || x.d &lt; today) return;
    if (/開課/.test(x.t)) return;
    add(&#x27;dl:&#x27; + x.t + &#x27;:&#x27; + x.d, x.t, autoTdCat(x.t), x.d, &#x27;Dashboard · 學校日程&#x27;);
  });
  /* 2. 交換計劃材料（未勾選 → 掛申請截止日前完成） */
  var exDue = &#x27;2026-09-03&#x27;;
  if (exDue &gt;= today) LS.get(&#x27;exchk&#x27;, FIX.exCheck.slice()).forEach(function (c) {
    if (!c.done) add(&#x27;ex:&#x27; + c.t, &#x27;交換申請：準備 &#x27; + c.t, &#x27;交換計劃&#x27;, exDue, &#x27;Dashboard · 交換材料清單&#x27;);
  });
  /* 3. 資助申請（未開始 / 準備中） */
  LS.get(&#x27;funds&#x27;, []).forEach(function (f) {
    if (!f.due || f.due &lt; today) return;
    if (f.status === &#x27;已遞交&#x27; || f.status === &#x27;已批核&#x27;) return;
    add(&#x27;fn:&#x27; + f.name + &#x27;:&#x27; + f.due, &#x27;遞交「&#x27; + f.name + &#x27;」申請&#x27;, &#x27;資助申請&#x27;, f.due, &#x27;Dashboard · 資助申請&#x27;);
  });
  /* 4. 求職面試（面試中且有面試日期） */
  LS.get(&#x27;jobs&#x27;, []).forEach(function (j) {
    if (!j.int || j.int &lt; today) return;
    if (j.status !== &#x27;面試中&#x27;) return;
    add(&#x27;job:&#x27; + (j.co || &#x27;&#x27;) + (j.pos || &#x27;&#x27;) + &#x27;:&#x27; + j.int, &#x27;準備 &#x27; + (j.co || &#x27;&#x27;) + &#x27;·&#x27; + (j.pos || &#x27;&#x27;) + &#x27; 面試&#x27;, &#x27;求職&#x27;, j.int, &#x27;Dashboard · 求職追蹤&#x27;);
  });
  /* 5. WIE 時數（未達標且有截止日） */
  var wie = LS.get(&#x27;wie&#x27;, { req: 960, done: 0, due: &#x27;&#x27; });
  if (wie.due &amp;&amp; wie.due &gt;= today &amp;&amp; (wie.done || 0) &lt; (wie.req || 960)) {
    add(&#x27;wie:hours&#x27;, &#x27;WIE 時數達標（尚欠 &#x27; + ((wie.req || 960) - (wie.done || 0)) + &#x27; 小時）&#x27;, &#x27;WIE 實習&#x27;, wie.due, &#x27;Dashboard · WIE 進度&#x27;);
  }
  /* 去重：已存在（含已完成）的 autoId 或同名事項不再生成 */
  var exist = {};
  LS.get(&#x27;todos&#x27;, []).forEach(function (t) {
    if (t.autoId) exist[t.autoId] = 1;
    exist[&#x27;T:&#x27; + t.t] = 1;
  });
  return out.filter(function (c) { return !exist[c.autoId] &amp;&amp; !exist[&#x27;T:&#x27; + c.t]; })
            .sort(function (a, b) { return (a.due || &#x27;9999&#x27;).localeCompare(b.due || &#x27;9999&#x27;); });
}
function renderAutoTd() {
  var box = $id(&#x27;autoTdBox&#x27;); if (!box) return;
  var list = autoTodoCandidates();
  if (!list.length) {
    box.hidden = false;
    box.innerHTML = &#x27;&lt;div class=&quot;atd-head&quot;&gt;🤖 智慧掃描完成 — 沒有新的待辦需要生成 🎉&lt;br&gt;&lt;span class=&quot;atd-sub&quot;&gt;Dashboard 內的截止 / 報名事項都已在待辦清單內&lt;/span&gt;&lt;/div&gt;&#x27;;
    return;
  }
  box.hidden = false;
  box.innerHTML = &#x27;&lt;div class=&quot;atd-head&quot;&gt;🤖 從 Dashboard 掃描到 &lt;b&gt;&#x27; + list.length + &#x27;&lt;/b&gt; 項截止 / 報名事項&lt;span class=&quot;atd-sub&quot;&gt;已自動按截止日排序 · 取消勾選可排除&lt;/span&gt;&lt;/div&gt;&#x27; +
    list.map(function (c, i) {
      var u = urgencyInfo(c.due);
      return &#x27;&lt;label class=&quot;atd-row&quot;&gt;&lt;input type=&quot;checkbox&quot; data-ai=&quot;&#x27; + i + &#x27;&quot; checked /&gt;&#x27; +
        &#x27;&lt;span class=&quot;atd-t&quot;&gt;&#x27; + esc(c.t) + &#x27;&lt;/span&gt;&#x27; +
        &#x27;&lt;span class=&quot;atd-tag&quot;&gt;&#x27; + esc(c.cat) + &#x27;&lt;/span&gt;&#x27; +
        &#x27;&lt;span class=&quot;atd-due&quot;&gt;&#x27; + fmtD(c.due) + &#x27; · &#x27; + u.label + &#x27;&lt;/span&gt;&#x27; +
        &#x27;&lt;span class=&quot;atd-src&quot;&gt;&#x27; + esc(c.src) + &#x27;&lt;/span&gt;&lt;/label&gt;&#x27;;
    }).join(&#x27;&#x27;) +
    &#x27;&lt;div class=&quot;atd-acts&quot;&gt;&lt;button class=&quot;primary&quot; id=&quot;autoTdAdd&quot;&gt;☑ 加入所選（&#x27; + list.length + &#x27;）&lt;/button&gt;&#x27; +
    &#x27;&lt;button class=&quot;ghost&quot; id=&quot;autoTdCancel&quot;&gt;取消&lt;/button&gt;&lt;/div&gt;&#x27;;
  $id(&#x27;autoTdAdd&#x27;).onclick = function () {
    var picked = $qa(&#x27;#autoTdBox input[data-ai]&#x27;).filter(function (cb) { return cb.checked; })
      .map(function (cb) { return list[+cb.getAttribute(&#x27;data-ai&#x27;)]; });
    if (!picked.length) { toast(&#x27;請先勾選至少一項&#x27;); return; }
    var a = LS.get(&#x27;todos&#x27;, []);
    picked.forEach(function (c) { a.push({ t: c.t, cat: c.cat, due: c.due, done: false, autoId: c.autoId }); });
    LS.set(&#x27;todos&#x27;, a);
    box.hidden = true; box.innerHTML = &#x27;&#x27;;
    renderTodos(); renderDashboard(); renderCalendar();
    toast(&#x27;已加入 &#x27; + picked.length + &#x27; 項待辦 ✓&#x27;);
  };
  $id(&#x27;autoTdCancel&#x27;).onclick = function () { box.hidden = true; box.innerHTML = &#x27;&#x27;; };
}

/* ============================================================
   模塊 10：資源筆記庫
   ============================================================ */
function renderLibrary() {
  var bk = LS.get(&#x27;bookmarks&#x27;, []);
  if ($id(&#x27;bkTbody&#x27;)) {
    $id(&#x27;bkTbody&#x27;).innerHTML = bk.length ? bk.map(function (b) {
      return &#x27;&lt;tr&gt;&lt;td&gt;&lt;b&gt;&#x27; + esc(b.n) + &#x27;&lt;/b&gt;&lt;/td&gt;&lt;td&gt;&lt;a href=&quot;&#x27; + esc(b.u) + &#x27;&quot; target=&quot;_blank&quot; rel=&quot;noopener&quot;&gt;🔗 開啟&lt;/a&gt;&lt;/td&gt;&lt;td&gt;&#x27; + esc(b.tag || &#x27;—&#x27;) + &#x27;&lt;/td&gt;&lt;td&gt;&lt;/td&gt;&lt;/tr&gt;&#x27;;
    }).join(&#x27;&#x27;) : &#x27;&lt;tr&gt;&lt;td colspan=&quot;4&quot; class=&quot;empty-tip&quot;&gt;尚未收藏連結&lt;/td&gt;&lt;/tr&gt;&#x27;;
    var rows = $id(&#x27;bkTbody&#x27;).querySelectorAll(&#x27;tr&#x27;);
    bk.forEach(function (b, i) {
      if (rows[i]) rows[i].appendChild(delBtnCell(function () { bk.splice(i, 1); LS.set(&#x27;bookmarks&#x27;, bk); renderLibrary(); }));
    });
  }
  var docs = LS.get(&#x27;docs&#x27;, []);
  if ($id(&#x27;docTbody&#x27;)) {
    $id(&#x27;docTbody&#x27;).innerHTML = docs.length ? docs.map(function (d) {
      return &#x27;&lt;tr&gt;&lt;td&gt;&lt;b&gt;&#x27; + esc(d.n) + &#x27;&lt;/b&gt;&lt;/td&gt;&lt;td&gt;&#x27; + esc(d.loc) + &#x27;&lt;/td&gt;&lt;td&gt;&lt;/td&gt;&lt;/tr&gt;&#x27;;
    }).join(&#x27;&#x27;) : &#x27;&lt;tr&gt;&lt;td colspan=&quot;3&quot; class=&quot;empty-tip&quot;&gt;尚未記錄文件位置&lt;/td&gt;&lt;/tr&gt;&#x27;;
    var rows2 = $id(&#x27;docTbody&#x27;).querySelectorAll(&#x27;tr&#x27;);
    docs.forEach(function (d, i) {
      if (rows2[i]) rows2[i].appendChild(delBtnCell(function () { docs.splice(i, 1); LS.set(&#x27;docs&#x27;, docs); renderLibrary(); }));
    });
  }
  if ($id(&#x27;noteArea&#x27;)) { var v = LS.get(&#x27;notes&#x27;, &#x27;&#x27;); if (document.activeElement !== $id(&#x27;noteArea&#x27;)) $id(&#x27;noteArea&#x27;).value = v; }
}
function initLibrary() {
  if ($id(&#x27;addBkBtn&#x27;)) $id(&#x27;addBkBtn&#x27;).onclick = function () {
    var n = $id(&#x27;bkName&#x27;).value.trim(), u = $id(&#x27;bkURL&#x27;).value.trim();
    if (!n || !u) { toast(&#x27;請填寫名稱和連結&#x27;); return; }
    var a = LS.get(&#x27;bookmarks&#x27;, []);
    a.push({ n: n, u: u, tag: $id(&#x27;bkTag&#x27;).value.trim() });
    LS.set(&#x27;bookmarks&#x27;, a);
    $id(&#x27;bkName&#x27;).value = $id(&#x27;bkURL&#x27;).value = $id(&#x27;bkTag&#x27;).value = &#x27;&#x27;;
    renderLibrary(); toast(&#x27;已收藏 ✓&#x27;);
  };
  if ($id(&#x27;addDocBtn&#x27;)) $id(&#x27;addDocBtn&#x27;).onclick = function () {
    var n = $id(&#x27;docName&#x27;).value.trim(), l = $id(&#x27;docLoc&#x27;).value.trim();
    if (!n || !l) { toast(&#x27;請填寫文件名和位置&#x27;); return; }
    var a = LS.get(&#x27;docs&#x27;, []);
    a.push({ n: n, loc: l });
    LS.set(&#x27;docs&#x27;, a);
    $id(&#x27;docName&#x27;).value = $id(&#x27;docLoc&#x27;).value = &#x27;&#x27;;
    renderLibrary(); toast(&#x27;已記錄 ✓&#x27;);
  };
  if ($id(&#x27;noteArea&#x27;)) $id(&#x27;noteArea&#x27;).addEventListener(&#x27;input&#x27;, debounce(function () { LS.set(&#x27;notes&#x27;, $id(&#x27;noteArea&#x27;).value); }, 400));
}

/* ============================================================
   模塊 11：社交 IP
   ============================================================ */
function renderIp() {
  var list = LS.get(&#x27;ip&#x27;, []);
  if ($id(&#x27;ipList&#x27;)) {
    $id(&#x27;ipList&#x27;).innerHTML = list.length ? list.map(function (x) {
      var u = x.u || &#x27;#&#x27;;
      return &#x27;&lt;div class=&quot;ip-card&quot;&gt;&lt;a href=&quot;&#x27; + esc(u) + &#x27;&quot; target=&quot;_blank&quot; rel=&quot;noopener&quot; style=&quot;text-decoration:none&quot;&gt;&lt;div class=&quot;ip-n&quot;&gt;🔗 &#x27; + esc(x.n) + &#x27;&lt;/div&gt;&lt;div class=&quot;ip-u&quot;&gt;&#x27; + esc(u) + &#x27;&lt;/div&gt;&lt;span class=&quot;ai-chip&quot;&gt;前往主頁 →&lt;/span&gt;&lt;/a&gt;&lt;/div&gt;&#x27;;
    }).join(&#x27;&#x27;) : &#x27;&lt;div class=&quot;empty-tip&quot; style=&quot;grid-column:1/-1&quot;&gt;尚未加入平台（例：Instagram、小紅書、YouTube）&lt;/div&gt;&#x27;;
    var cards = $id(&#x27;ipList&#x27;).querySelectorAll(&#x27;.ip-card&#x27;);
    list.forEach(function (x, i) {
      if (!cards[i]) return;
      cards[i].appendChild(delBtn(function () { list.splice(i, 1); LS.set(&#x27;ip&#x27;, list); renderIp(); }));
    });
  }
  var stats = LS.get(&#x27;ipstats&#x27;, []);
  if ($id(&#x27;ipStatTbody&#x27;)) {
    $id(&#x27;ipStatTbody&#x27;).innerHTML = stats.length ? stats.map(function (s) {
      return &#x27;&lt;tr&gt;&lt;td&gt;&lt;b&gt;&#x27; + esc(s.p) + &#x27;&lt;/b&gt;&lt;/td&gt;&lt;td&gt;&#x27; + esc(s.f) + &#x27;&lt;/td&gt;&lt;td&gt;&#x27; + fmtD(s.d) + &#x27;&lt;/td&gt;&lt;td&gt;&lt;/td&gt;&lt;/tr&gt;&#x27;;
    }).join(&#x27;&#x27;) : &#x27;&lt;tr&gt;&lt;td colspan=&quot;4&quot; class=&quot;empty-tip&quot;&gt;尚未記錄數據&lt;/td&gt;&lt;/tr&gt;&#x27;;
    var rows = $id(&#x27;ipStatTbody&#x27;).querySelectorAll(&#x27;tr&#x27;);
    stats.forEach(function (s, i) {
      if (rows[i]) rows[i].appendChild(delBtnCell(function () { stats.splice(i, 1); LS.set(&#x27;ipstats&#x27;, stats); renderIp(); }));
    });
  }
  if ($id(&#x27;ipPlan&#x27;)) { var v = LS.get(&#x27;ipplan&#x27;, &#x27;&#x27;); if (document.activeElement !== $id(&#x27;ipPlan&#x27;)) $id(&#x27;ipPlan&#x27;).value = v; }
}
function initIp() {
  if ($id(&#x27;addIpBtn&#x27;)) $id(&#x27;addIpBtn&#x27;).onclick = function () {
    var n = $id(&#x27;ipName&#x27;).value.trim(); if (!n) { toast(&#x27;請填寫平台名&#x27;); return; }
    var a = LS.get(&#x27;ip&#x27;, []);
    a.push({ n: n, u: $id(&#x27;ipURL&#x27;).value.trim() });
    LS.set(&#x27;ip&#x27;, a);
    $id(&#x27;ipName&#x27;).value = $id(&#x27;ipURL&#x27;).value = &#x27;&#x27;;
    renderIp(); toast(&#x27;已加入 ✓&#x27;);
  };
  if ($id(&#x27;addIpStatBtn&#x27;)) $id(&#x27;addIpStatBtn&#x27;).onclick = function () {
    var p = $id(&#x27;ipStatPlat&#x27;).value.trim(); if (!p) { toast(&#x27;請填寫平台&#x27;); return; }
    var a = LS.get(&#x27;ipstats&#x27;, []);
    a.push({ p: p, f: $id(&#x27;ipStatFollowers&#x27;).value.trim(), d: $id(&#x27;ipStatDate&#x27;).value });
    LS.set(&#x27;ipstats&#x27;, a);
    $id(&#x27;ipStatPlat&#x27;).value = $id(&#x27;ipStatFollowers&#x27;).value = $id(&#x27;ipStatDate&#x27;).value = &#x27;&#x27;;
    renderIp(); toast(&#x27;已記錄 ✓&#x27;);
  };
  if ($id(&#x27;ipPlan&#x27;)) $id(&#x27;ipPlan&#x27;).addEventListener(&#x27;input&#x27;, debounce(function () { LS.set(&#x27;ipplan&#x27;, $id(&#x27;ipPlan&#x27;).value); }, 400));
}

/* ============================================================
   模塊 12：學習進度追蹤
   ============================================================ */
function studySubjects() { return LS.get(&#x27;study_subjects&#x27;, JSON.parse(JSON.stringify(FIX.studySubjects))); }

function renderStudy() {
  /* 時間表 */
  var tt = LS.get(&#x27;timetable&#x27;, { slots: FIX.timetable.slice() });
  var days = [&#x27;一&#x27;, &#x27;二&#x27;, &#x27;三&#x27;, &#x27;四&#x27;, &#x27;五&#x27;];
  var times = [9, 10, 11, 12, 14, 15, 16, 17];
  var grid = $id(&#x27;timetableGrid&#x27;);
  if (grid) {
    var html = &#x27;&lt;div class=&quot;tt-cell head&quot; style=&quot;grid-column:1&quot;&gt;&lt;/div&gt;&#x27;;
    days.forEach(function (d) { html += &#x27;&lt;div class=&quot;tt-cell head&quot;&gt;&#x27; + d + &#x27;&lt;/div&gt;&#x27;; });
    times.forEach(function (t) {
      html += &#x27;&lt;div class=&quot;tt-cell time&quot;&gt;&#x27; + pad2(t) + &#x27;:00&lt;/div&gt;&#x27;;
      days.forEach(function (d, di) {
        var slot = (tt.slots || []).filter(function (s) { return s.d === di &amp;&amp; s.t === t; })[0];
        html += slot
          ? &#x27;&lt;div class=&quot;tt-cell filled&quot; data-d=&quot;&#x27; + di + &#x27;&quot; data-t=&quot;&#x27; + t + &#x27;&quot; title=&quot;點擊編輯&quot;&gt;&lt;b&gt;&#x27; + esc(slot.subj) + &#x27;&lt;/b&gt;&lt;span class=&quot;tt-room&quot;&gt;&#x27; + esc(slot.room || &#x27;&#x27;) + &#x27;&lt;/span&gt;&lt;/div&gt;&#x27;
          : &#x27;&lt;div class=&quot;tt-cell&quot; data-d=&quot;&#x27; + di + &#x27;&quot; data-t=&quot;&#x27; + t + &#x27;&quot; title=&quot;點擊新增&quot;&gt;＋&lt;/div&gt;&#x27;;
      });
    });
    grid.innerHTML = html;
    $qa(&#x27;#timetableGrid .tt-cell[data-d]&#x27;).forEach(function (cell) {
      cell.onclick = function () {
        var d = +cell.getAttribute(&#x27;data-d&#x27;), t = +cell.getAttribute(&#x27;data-t&#x27;);
        var slots = LS.get(&#x27;timetable&#x27;, {}).slots || [];
        var idx = slots.findIndex(function (s) { return s.d === d &amp;&amp; s.t === t; });
        var cur = idx &gt;= 0 ? slots[idx] : null;
        var v = prompt(&#x27;編輀課堂（格式：科目｜課室；留空並確定 = 刪除）&#x27;, cur ? (cur.subj + &#x27;|&#x27; + (cur.room || &#x27;&#x27;)) : &#x27;&#x27;);
        if (v === null) return;
        v = v.trim();
        if (!v) { if (idx &gt;= 0) slots.splice(idx, 1); }
        else {
          var parts = v.split(/[|｜]/);
          var obj = { d: d, t: t, subj: parts[0].trim(), room: (parts[1] || &#x27;&#x27;).trim() };
          if (idx &gt;= 0) slots[idx] = obj; else slots.push(obj);
        }
        LS.set(&#x27;timetable&#x27;, { slots: slots }); renderStudy();
      };
    });
  }

  /* 學術日曆 */
  if ($id(&#x27;calendarList&#x27;)) {
    var cal = FIX.calendar.map(function (c) {
      var n = daysUntil(c.d);
      return { t: c.t, d: c.d, n: n };
    }).filter(function (c) { return c.n == null || c.n &gt;= -30; });
    $id(&#x27;calendarList&#x27;).innerHTML = cal.map(function (c) {
      var badge = c.n &lt; 0 ? &#x27;已過&#x27; : c.n === 0 ? &#x27;今天&#x27; : c.n + &#x27; 天後&#x27;;
      return &#x27;&lt;div class=&quot;cal-item&quot;&gt;&lt;span class=&quot;c-date&quot;&gt;&#x27; + fmtD(c.d) + &#x27;&lt;/span&gt;&lt;span&gt;&#x27; + esc(c.t) + &#x27;&lt;/span&gt;&lt;span class=&quot;c-days&quot;&gt;&#x27; + badge + &#x27;&lt;/span&gt;&lt;/div&gt;&#x27;;
    }).join(&#x27;&#x27;);
  }

  /* 科目進度 */
  var subs = studySubjects();
  var topics = LS.get(&#x27;study_topics&#x27;, []);
  if ($id(&#x27;subjectGrid&#x27;)) {
    $id(&#x27;subjectGrid&#x27;).innerHTML = subs.map(function (s, i) {
      var ts = topics.filter(function (t) { return t.subj === s.code; }).slice(-3).reverse();
      return &#x27;&lt;div class=&quot;subject-card&quot;&gt;&lt;div class=&quot;s-code&quot;&gt;&#x27; + esc(s.code) + &#x27;&lt;/div&gt;&lt;div class=&quot;s-name&quot;&gt;&#x27; + esc(s.name) + &#x27;&lt;/div&gt;&#x27; +
        &#x27;&lt;div class=&quot;progress&quot; style=&quot;margin:6px 0 2px&quot;&gt;&lt;div class=&quot;bar&quot; style=&quot;width:&#x27; + (s.progress || 0) + &#x27;%&quot;&gt;&lt;/div&gt;&lt;/div&gt;&#x27; +
        &#x27;&lt;div style=&quot;font-size:11px;color:#6b7280&quot;&gt;&#x27; + (s.progress || 0) + &#x27;% 完成&lt;/div&gt;&#x27; +
        (ts.length ? &#x27;&lt;div class=&quot;s-topics&quot;&gt;&#x27; + ts.map(function (t) { return &#x27;• &#x27; + esc(t.topic) + (t.date ? &#x27;（&#x27; + fmtD(t.date) + &#x27;）&#x27; : &#x27;&#x27;); }).join(&#x27;&lt;br&gt;&#x27;) + &#x27;&lt;/div&gt;&#x27; : &#x27;&#x27;) + &#x27;&lt;/div&gt;&#x27;;
    }).join(&#x27;&#x27;);
  }
  /* 下拉選單 */
  [&#x27;spSubject&#x27;, &#x27;matSubject&#x27;, &#x27;planSubject&#x27;].forEach(function (id) {
    var sel = $id(id); if (!sel) return;
    sel.innerHTML = subs.map(function (s) { return &#x27;&lt;option value=&quot;&#x27; + esc(s.code) + &#x27;&quot;&gt;&#x27; + esc(s.code) + &#x27; · &#x27; + esc(s.name) + &#x27;&lt;/option&gt;&#x27;; }).join(&#x27;&#x27;);
  });

  /* 材料 */
  renderMaterials();

  /* 學習計劃 */
  var plans = LS.get(&#x27;study_plans&#x27;, []);
  if ($id(&#x27;planList&#x27;)) {
    var typeLbl = { preview: &#x27;📖 預習&#x27;, review: &#x27;🔁 復習&#x27;, practice: &#x27;✏️ 練習&#x27;, revision: &#x27;🧠 溫習&#x27; };
    $id(&#x27;planList&#x27;).innerHTML = plans.length ? plans.map(function (p, i) {
      var u = urgencyInfo(p.date);
      return &#x27;&lt;div class=&quot;plan-item &#x27; + (p.done ? &#x27;done&#x27; : &#x27;&#x27;) + &#x27;&quot;&gt;&lt;input type=&quot;checkbox&quot; data-i=&quot;&#x27; + i + &#x27;&quot; &#x27; + (p.done ? &#x27;checked&#x27; : &#x27;&#x27;) + &#x27; style=&quot;width:16px;height:16px;accent-color:#83001A&quot; /&gt;&#x27; +
        &#x27;&lt;div&gt;&lt;div class=&quot;p-title&quot;&gt;&#x27; + (typeLbl[p.type] || &#x27;&#x27;) + &#x27; &#x27; + esc(p.title) + &#x27;&lt;/div&gt;&lt;div class=&quot;p-sub&quot;&gt;&#x27; + esc(p.subj || &#x27;&#x27;) + (p.date ? &#x27; · &#x27; + fmtD(p.date) : &#x27;&#x27;) + (p.dur ? &#x27; · 約 &#x27; + p.dur + &#x27; 分鐘&#x27; : &#x27;&#x27;) + &#x27;&lt;/div&gt;&lt;/div&gt;&#x27; +
        &#x27;&lt;div class=&quot;p-right&quot;&gt;&lt;span class=&quot;p-badge &#x27; + u.cls + &#x27;&quot;&gt;&#x27; + u.label + &#x27;&lt;/span&gt;&lt;/div&gt;&lt;/div&gt;&#x27;;
    }).join(&#x27;&#x27;) : &#x27;&lt;div class=&quot;empty-tip&quot;&gt;尚未安排學習計劃&lt;/div&gt;&#x27;;
    $qa(&#x27;#planList input[type=checkbox]&#x27;).forEach(function (cb) {
      cb.onchange = function () { var a = LS.get(&#x27;study_plans&#x27;, []); a[+cb.getAttribute(&#x27;data-i&#x27;)].done = cb.checked; LS.set(&#x27;study_plans&#x27;, a); renderStudy(); };
    });
    var items = $id(&#x27;planList&#x27;).querySelectorAll(&#x27;.plan-item&#x27;);
    plans.forEach(function (p, i) {
      if (items[i]) {
        var del = delBtn(function () { plans.splice(i, 1); LS.set(&#x27;study_plans&#x27;, plans); renderStudy(); });
        var right = items[i].querySelector(&#x27;.p-right&#x27;); if (right) right.appendChild(del);
      }
    });
  }
}
function initStudy() {
  if ($id(&#x27;addTopicBtn&#x27;)) $id(&#x27;addTopicBtn&#x27;).onclick = function () {
    var code = $id(&#x27;spSubject&#x27;).value;
    var topic = $id(&#x27;spTopic&#x27;).value.trim();
    if (!topic) { toast(&#x27;請填寫主題&#x27;); return; }
    var topics = LS.get(&#x27;study_topics&#x27;, []);
    topics.push({ subj: code, topic: topic, date: $id(&#x27;spDate&#x27;).value, progress: Number($id(&#x27;spProgress&#x27;).value) || null });
    LS.set(&#x27;study_topics&#x27;, topics);
    var subs = studySubjects();
    var s = subs.filter(function (x) { return x.code === code; })[0];
    if (s) {
      var pr = Number($id(&#x27;spProgress&#x27;).value);
      if (pr &gt;= 0 &amp;&amp; pr != null &amp;&amp; !isNaN(pr)) s.progress = Math.max(s.progress || 0, Math.min(100, pr));
      LS.set(&#x27;study_subjects&#x27;, subs);
    }
    $id(&#x27;spTopic&#x27;).value = &#x27;&#x27;; $id(&#x27;spDate&#x27;).value = &#x27;&#x27;; $id(&#x27;spProgress&#x27;).value = &#x27;&#x27;;
    renderStudy(); toast(&#x27;已更新進度 ✓&#x27;);
  };
  if ($id(&#x27;addPlanBtn&#x27;)) $id(&#x27;addPlanBtn&#x27;).onclick = function () {
    var title = $id(&#x27;planTitle&#x27;).value.trim(); if (!title) { toast(&#x27;請填寫計劃內容&#x27;); return; }
    var a = LS.get(&#x27;study_plans&#x27;, []);
    a.push({ subj: $id(&#x27;planSubject&#x27;).value, type: $id(&#x27;planType&#x27;).value, title: title, date: $id(&#x27;planDate&#x27;).value, dur: $id(&#x27;planDuration&#x27;).value, done: false });
    LS.set(&#x27;study_plans&#x27;, a);
    $id(&#x27;planTitle&#x27;).value = &#x27;&#x27;; $id(&#x27;planDate&#x27;).value = &#x27;&#x27;; $id(&#x27;planDuration&#x27;).value = &#x27;&#x27;;
    renderStudy(); toast(&#x27;已加入學習計劃 ✓&#x27;);
  };
  if ($id(&#x27;addMatBtn&#x27;)) $id(&#x27;addMatBtn&#x27;).onclick = function () {
    var f = ($id(&#x27;matFile&#x27;) || {}).files;
    if (!f || !f.length) { toast(&#x27;請選擇檔案&#x27;); return; }
    var file = f[0];
    idbAdd({
      id: uid(), subject: $id(&#x27;matSubject&#x27;).value, type: $id(&#x27;matType&#x27;).value.trim() || &#x27;其他&#x27;,
      name: file.name, size: file.size, note: $id(&#x27;matNote&#x27;).value.trim(), date: todayStr(), blob: file
    }).then(function () {
      $id(&#x27;matFile&#x27;).value = &#x27;&#x27;; $id(&#x27;matType&#x27;).value = &#x27;&#x27;; $id(&#x27;matNote&#x27;).value = &#x27;&#x27;;
      renderMaterials(); toast(&#x27;已上傳至本機 IndexedDB ✓&#x27;);
    }).catch(function (e) { toast(&#x27;上傳失敗：&#x27; + e); });
  };
}

/* ---- IndexedDB（課堂材料） ---- */
function idbOpen() {
  return new Promise(function (res, rej) {
    var rq = indexedDB.open(&#x27;lyhub_materials&#x27;, 1);
    rq.onupgradeneeded = function (e) {
      var db = e.target.result;
      if (!db.objectStoreNames.contains(&#x27;files&#x27;)) db.createObjectStore(&#x27;files&#x27;, { keyPath: &#x27;id&#x27; });
    };
    rq.onsuccess = function (e) { res(e.target.result); };
    rq.onerror = function (e) { rej(e.target.error); };
  });
}
function idbTx(mode) {
  return idbOpen().then(function (db) {
    return db.transaction(&#x27;files&#x27;, mode).objectStore(&#x27;files&#x27;);
  });
}
function idbAdd(rec) { return idbTx(&#x27;readwrite&#x27;).then(function (st) { return new Promise(function (res, rej) { var r = st.put(rec); r.onsuccess = res; r.onerror = function () { rej(r.error); }; }); }); }
function idbAll() { return idbTx(&#x27;readonly&#x27;).then(function (st) { return new Promise(function (res, rej) { var r = st.getAll(); r.onsuccess = function () { res(r.result || []); }; r.onerror = function () { rej(r.error); }; }); }); }
function idbDel(id) { return idbTx(&#x27;readwrite&#x27;).then(function (st) { st.delete(id); }); }

function renderMaterials() {
  if (!$id(&#x27;matList&#x27;)) return;
  idbAll().then(function (list) {
    list = list.filter(function (m) { return m.id &amp;&amp; /^(tt_file|media_|diary_)/.test(m.id) === false; });
    if (!list.length) { $id(&#x27;matList&#x27;).innerHTML = &#x27;&lt;div class=&quot;empty-tip&quot;&gt;尚未上傳材料（PPT / 練習 / 筆記）&lt;/div&gt;&#x27;; return; }
    list.sort(function (a, b) { return (b.date || &#x27;&#x27;).localeCompare(a.date || &#x27;&#x27;); });
    var icons = { ppt: &#x27;📊&#x27;, pdf: &#x27;📄&#x27;, doc: &#x27;📝&#x27;, xls: &#x27;📈&#x27;, other: &#x27;📎&#x27; };
    $id(&#x27;matList&#x27;).innerHTML = list.map(function (m) {
      var ic = m.name.match(/\.pptx?$/i) ? icons.ppt : m.name.match(/\.pdf$/i) ? icons.pdf : m.name.match(/\.(docx?|txt|md)$/i) ? icons.doc : m.name.match(/\.xlsx?$/i) ? icons.xls : icons.other;
      var sz = m.size &gt; 1048576 ? (m.size / 1048576).toFixed(1) + &#x27; MB&#x27; : Math.max(1, Math.round(m.size / 1024)) + &#x27; KB&#x27;;
      return &#x27;&lt;div class=&quot;mat-item&quot; data-id=&quot;&#x27; + esc(m.id) + &#x27;&quot;&gt;&lt;span class=&quot;m-ico&quot;&gt;&#x27; + ic + &#x27;&lt;/span&gt;&#x27; +
        &#x27;&lt;div&gt;&lt;div class=&quot;m-name&quot;&gt;&#x27; + esc(m.name) + &#x27;&lt;/div&gt;&lt;div class=&quot;m-sub&quot;&gt;&#x27; + esc(m.subject || &#x27;&#x27;) + &#x27; · &#x27; + esc(m.type) + &#x27; · &#x27; + sz + (m.note ? &#x27; · &#x27; + esc(m.note) : &#x27;&#x27;) + &#x27;&lt;/div&gt;&lt;/div&gt;&#x27; +
        &#x27;&lt;div class=&quot;m-acts&quot;&gt;&lt;/div&gt;&lt;/div&gt;&#x27;;
    }).join(&#x27;&#x27;);
    list.forEach(function (m) {
      var row = $q(&#x27;#matList .mat-item[data-id=&quot;&#x27; + m.id + &#x27;&quot;]&#x27;); if (!row) return;
      var acts = row.querySelector(&#x27;.m-acts&#x27;);
      var dl = document.createElement(&#x27;button&#x27;); dl.className = &#x27;ghost&#x27;; dl.textContent = &#x27;⬇️ 下載&#x27;; dl.style.padding = &#x27;4px 10px&#x27;;
      dl.onclick = function () {
        var url = URL.createObjectURL(m.blob);
        var a = document.createElement(&#x27;a&#x27;); a.href = url; a.download = m.name; a.click();
        setTimeout(function () { URL.revokeObjectURL(url); }, 800);
      };
      var del = delBtn(function () { idbDel(m.id).then(renderMaterials); });
      acts.appendChild(dl); acts.appendChild(del);
    });
  }).catch(function () {
    $id(&#x27;matList&#x27;).innerHTML = &#x27;&lt;div class=&quot;empty-tip&quot;&gt;（此瀏覽器不支援 IndexedDB）&lt;/div&gt;&#x27;;
  });
}

/* ============================================================
   模塊 13：個人檔案（Lok Yi）
   ============================================================ */
function renderLyProfile() {
  var p = LS.get(&#x27;ly_profile&#x27;, DEF_LY);
  if ($id(&#x27;lyPfName&#x27;)) $id(&#x27;lyPfName&#x27;).value = p.name || &#x27;&#x27;;
  if ($id(&#x27;lyPfSchool&#x27;)) $id(&#x27;lyPfSchool&#x27;).value = p.school || &#x27;&#x27;;
  if ($id(&#x27;lyPfYear&#x27;)) $id(&#x27;lyPfYear&#x27;).value = p.year || &#x27;&#x27;;
  if ($id(&#x27;lyPfMajor&#x27;)) $id(&#x27;lyPfMajor&#x27;).value = p.major || &#x27;&#x27;;
  if ($id(&#x27;lyPfGpa&#x27;)) $id(&#x27;lyPfGpa&#x27;).value = p.gpa || &#x27;&#x27;;
  if ($id(&#x27;lyPfTargetGpa&#x27;)) $id(&#x27;lyPfTargetGpa&#x27;).value = p.targetGpa || &#x27;&#x27;;
  if ($id(&#x27;lyPfNote&#x27;)) $id(&#x27;lyPfNote&#x27;).value = p.note || &#x27;&#x27;;
}
function initLyProfile() {
  if ($id(&#x27;lyPfSaveBtn&#x27;)) $id(&#x27;lyPfSaveBtn&#x27;).onclick = function () {
    var p = {
      name: $id(&#x27;lyPfName&#x27;).value.trim() || DEF_LY.name,
      school: $id(&#x27;lyPfSchool&#x27;).value.trim(),
      year: $id(&#x27;lyPfYear&#x27;).value.trim(),
      major: $id(&#x27;lyPfMajor&#x27;).value.trim(),
      gpa: $id(&#x27;lyPfGpa&#x27;).value,
      targetGpa: $id(&#x27;lyPfTargetGpa&#x27;).value,
      note: $id(&#x27;lyPfNote&#x27;).value.trim()
    };
    LS.set(&#x27;ly_profile&#x27;, p);
    renderDashboard(); renderSidebarIdentity(); toast(&#x27;個人檔案已儲存 ✓&#x27;);
  };
}

/* ============================================================
   BF 模塊 1：男友總覽
   ============================================================ */
function bfProfile() { return LS.get(&#x27;bf_profile&#x27;, DEF_BF); }
function strategyOf(gpa, avg) {
  var diff = gpa - avg;
  if (diff &gt;= 0.15) return { k: &#x27;safe&#x27;, t: &#x27;保&#x27; };
  if (diff &gt;= -0.10) return { k: &#x27;mid&#x27;, t: &#x27;穩&#x27; };
  return { k: &#x27;reach&#x27;, t: &#x27;衝&#x27; };
}

function renderBfDash() {
  var p = bfProfile();
  var d = new Date();
  if ($id(&#x27;bfHello&#x27;)) $id(&#x27;bfHello&#x27;).textContent = &#x27;Hi Austin 👋&#x27;;
  if ($id(&#x27;bfTodayDate&#x27;)) $id(&#x27;bfTodayDate&#x27;).textContent = fmtFull(d);
  if ($id(&#x27;bfStatGpa&#x27;)) $id(&#x27;bfStatGpa&#x27;).textContent = p.gpa || &#x27;—&#x27;;
  if ($id(&#x27;bfStatTarget&#x27;)) $id(&#x27;bfStatTarget&#x27;).textContent = p.target || &#x27;—&#x27;;

  var subs = LS.get(&#x27;bf_subjects&#x27;, null);
  if (!subs) { subs = JSON.parse(JSON.stringify(FIX.bfSubjects)); LS.set(&#x27;bf_subjects&#x27;, subs); }
  var doneCr = subs.filter(function (s) { return s.status === &#x27;已完成&#x27;; }).reduce(function (a, s) { return a + (s.cr || 0); }, 0);
  if ($id(&#x27;bfStatCredits&#x27;)) $id(&#x27;bfStatCredits&#x27;).textContent = doneCr;

  /* 下一個截止日 */
  var tl = bfAllTimeline();
  var upcoming = tl.filter(function (x) { var n = daysUntil(x.d); return n != null &amp;&amp; n &gt;= 0; }).sort(function (a, b) { return daysUntil(a.d) - daysUntil(b.d); });
  if ($id(&#x27;bfStatDeadline&#x27;)) $id(&#x27;bfStatDeadline&#x27;).textContent = upcoming.length ? daysUntil(upcoming[0].d) : &#x27;—&#x27;;

  /* 個人檔案卡 */
  if ($id(&#x27;bfProfileCard&#x27;)) {
    $id(&#x27;bfProfileCard&#x27;).innerHTML =
      &#x27;&lt;div class=&quot;kv&quot;&gt;&lt;span&gt;姓名&lt;/span&gt;&lt;b&gt;&#x27; + esc(p.name) + &#x27;&lt;/b&gt;&lt;/div&gt;&#x27; +
      &#x27;&lt;div class=&quot;kv&quot;&gt;&lt;span&gt;學生編號&lt;/span&gt;&lt;b&gt;&#x27; + esc(p.sid || &#x27;—&#x27;) + &#x27;&lt;/b&gt;&lt;/div&gt;&#x27; +
      &#x27;&lt;div class=&quot;kv&quot;&gt;&lt;span&gt;現就讀院校&lt;/span&gt;&lt;b&gt;&#x27; + esc(p.school || &#x27;—&#x27;) + &#x27;&lt;/b&gt;&lt;/div&gt;&#x27; +
      &#x27;&lt;div class=&quot;kv&quot;&gt;&lt;span&gt;學年&lt;/span&gt;&lt;b&gt;&#x27; + esc(p.year || &#x27;—&#x27;) + &#x27;&lt;/b&gt;&lt;/div&gt;&#x27; +
      &#x27;&lt;div class=&quot;kv&quot;&gt;&lt;span&gt;主修課程&lt;/span&gt;&lt;b&gt;&#x27; + esc(p.major || &#x27;—&#x27;) + &#x27;&lt;/b&gt;&lt;/div&gt;&#x27; +
      &#x27;&lt;div class=&quot;kv&quot;&gt;&lt;span&gt;當前 GPA&lt;/span&gt;&lt;b&gt;&#x27; + esc(p.gpa || &#x27;—&#x27;) + &#x27;&lt;/b&gt;&lt;/div&gt;&#x27; +
      &#x27;&lt;div class=&quot;kv&quot;&gt;&lt;span&gt;目標 GPA&lt;/span&gt;&lt;b&gt;&#x27; + esc(p.target || &#x27;—&#x27;) + &#x27;&lt;/b&gt;&lt;/div&gt;&#x27; +
      (p.note ? &#x27;&lt;div class=&quot;kv&quot;&gt;&lt;span&gt;備註&lt;/span&gt;&lt;b&gt;&#x27; + esc(p.note) + &#x27;&lt;/b&gt;&lt;/div&gt;&#x27; : &#x27;&#x27;);
  }

  if (document.activeElement !== $id(&#x27;bfGpaInput&#x27;)) $id(&#x27;bfGpaInput&#x27;).value = p.gpa || &#x27;&#x27;;
  if (document.activeElement !== $id(&#x27;bfTargetInput&#x27;)) $id(&#x27;bfTargetInput&#x27;).value = p.target || &#x27;&#x27;;

  /* 錄取評估 */
  if ($id(&#x27;bfRiskBox&#x27;)) {
    var gpa = Number(p.gpa) || 0;
    var rows = FIX.programs.map(function (pr) {
      var diff = gpa - pr.avg;
      var pct = Math.max(5, Math.min(95, Math.round(50 + diff * 160)));
      return { pr: pr, pct: pct, diff: diff };
    }).sort(function (a, b) { return b.pct - a.pct; });
    $id(&#x27;bfRiskBox&#x27;).innerHTML =
      &#x27;&lt;div style=&quot;font-size:12.5px;font-weight:700;margin:4px 0 8px&quot;&gt;📈 以當前 GPA &#x27; + gpa.toFixed(2) + &#x27; 計算的錄取機會評估&lt;/div&gt;&#x27; +
      rows.map(function (r) {
        return &#x27;&lt;div class=&quot;risk-item&quot;&gt;&lt;span style=&quot;min-width:0;flex:1&quot;&gt;&lt;b&gt;&#x27; + esc(r.pr.uni) + &#x27;&lt;/b&gt; · &#x27; + esc(r.pr.name) + &#x27;&lt;/span&gt;&#x27; +
          &#x27;&lt;div class=&quot;risk-bar&quot;&gt;&lt;div class=&quot;risk-fill&quot; style=&quot;width:&#x27; + r.pct + &#x27;%&quot;&gt;&lt;/div&gt;&lt;/div&gt;&#x27; +
          &#x27;&lt;span class=&quot;risk-pct&quot;&gt;&#x27; + r.pct + &#x27;%&lt;/span&gt;&lt;/div&gt;&#x27;;
      }).join(&#x27;&#x27;) +
      &#x27;&lt;div class=&quot;src&quot;&gt;評估僅供參考：以歷年平均 GPA 差值推算，實際錄取視乎面試、個人陳述及其他成就。&#x27; + (gpa &lt; 3.7 ? &#x27;建議 Year 2 保持 GPA 3.8+ 以擴大選擇。&#x27; : &#x27;當前 GPA 有競爭力，衝刺課程亦值得報名。&#x27;) + &#x27;&lt;/div&gt;&#x27;;
  }

  /* 學分進度 */
  var comp = subs.filter(function (s) { return s.type === &#x27;必修&#x27; &amp;&amp; s.status === &#x27;已完成&#x27;; }).reduce(function (a, s) { return a + (s.cr || 0); }, 0);
  var elec = subs.filter(function (s) { return s.type === &#x27;選修&#x27; &amp;&amp; s.status === &#x27;已完成&#x27;; }).reduce(function (a, s) { return a + (s.cr || 0); }, 0);
  if ($id(&#x27;bfCompBar&#x27;)) $id(&#x27;bfCompBar&#x27;).style.width = Math.min(100, Math.round(comp / 42 * 100)) + &#x27;%&#x27;;
  if ($id(&#x27;bfCompText&#x27;)) $id(&#x27;bfCompText&#x27;).textContent = comp + &#x27; / 42 學分&#x27;;
  if ($id(&#x27;bfElecBar&#x27;)) $id(&#x27;bfElecBar&#x27;).style.width = Math.min(100, Math.round(elec / 21 * 100)) + &#x27;%&#x27;;
  if ($id(&#x27;bfElecText&#x27;)) $id(&#x27;bfElecText&#x27;).textContent = elec + &#x27; / 21 學分&#x27;;
}

function initBfDash() {
  if ($id(&#x27;bfGpaSaveBtn&#x27;)) $id(&#x27;bfGpaSaveBtn&#x27;).onclick = function () {
    var p = bfProfile();
    p.gpa = Number($id(&#x27;bfGpaInput&#x27;).value) || p.gpa;
    p.target = Number($id(&#x27;bfTargetInput&#x27;).value) || p.target;
    LS.set(&#x27;bf_profile&#x27;, p);
    renderBfDash(); renderBfSubjects(); renderBfPrograms(); toast(&#x27;已儲存並重新評估 ✓&#x27;);
  };
}

/* ============================================================
   BF 模塊 2：科目進度追蹤
   ============================================================ */
function renderBfSubjects() {
  var subs = LS.get(&#x27;bf_subjects&#x27;, null);
  if (!subs) { subs = JSON.parse(JSON.stringify(FIX.bfSubjects)); LS.set(&#x27;bf_subjects&#x27;, subs); }
  if ($id(&#x27;bfSubTbody&#x27;)) {
    $id(&#x27;bfSubTbody&#x27;).innerHTML = subs.map(function (s, i) {
      return &#x27;&lt;tr&gt;&lt;td&gt;&lt;b&gt;&#x27; + esc(s.code) + &#x27;&lt;/b&gt;&lt;/td&gt;&lt;td&gt;&#x27; + esc(s.name) + &#x27;&lt;/td&gt;&lt;td&gt;&#x27; + s.cr + &#x27;&lt;/td&gt;&lt;td&gt;&#x27; + esc(s.type) + &#x27;&lt;/td&gt;&lt;td&gt;&#x27; + esc(s.term) + &#x27;&lt;/td&gt;&#x27; +
        &#x27;&lt;td&gt;&#x27; + esc(s.exp || &#x27;—&#x27;) + &#x27;&lt;/td&gt;&lt;td&gt;&#x27; + esc(s.act || &#x27;—&#x27;) + &#x27;&lt;/td&gt;&#x27; +
        &#x27;&lt;td&gt;&lt;select data-status=&quot;&#x27; + i + &#x27;&quot;&gt;&lt;option&#x27; + (s.status === &#x27;修讀中&#x27; ? &#x27; selected&#x27; : &#x27;&#x27;) + &#x27;&gt;修讀中&lt;/option&gt;&lt;option&#x27; + (s.status === &#x27;已完成&#x27; ? &#x27; selected&#x27; : &#x27;&#x27;) + &#x27;&gt;已完成&lt;/option&gt;&lt;option&#x27; + (s.status === &#x27;計劃&#x27; ? &#x27; selected&#x27; : &#x27;&#x27;) + &#x27;&gt;計劃&lt;/option&gt;&lt;/select&gt;&lt;/td&gt;&#x27; +
        &#x27;&lt;td style=&quot;min-width:90px&quot;&gt;&lt;div class=&quot;progress&quot; style=&quot;margin:0;height:7px&quot;&gt;&lt;div class=&quot;bar&quot; style=&quot;width:&#x27; + (s.prog || 0) + &#x27;%&quot;&gt;&lt;/div&gt;&lt;/div&gt;&lt;span style=&quot;font-size:10px;color:#9ca3af&quot;&gt;&#x27; + (s.prog || 0) + &#x27;%&lt;/span&gt;&lt;/td&gt;&#x27; +
        &#x27;&lt;td&gt;&lt;/td&gt;&lt;/tr&gt;&#x27;;
    }).join(&#x27;&#x27;);
    $qa(&#x27;#bfSubTbody select[data-status]&#x27;).forEach(function (sel) {
      sel.onchange = function () {
        var a = LS.get(&#x27;bf_subjects&#x27;, []);
        a[+sel.getAttribute(&#x27;data-status&#x27;)].status = sel.value;
        if (sel.value === &#x27;已完成&#x27;) a[+sel.getAttribute(&#x27;data-status&#x27;)].prog = 100;
        LS.set(&#x27;bf_subjects&#x27;, a); renderBfSubjects(); renderBfDash();
      };
    });
    var rows = $id(&#x27;bfSubTbody&#x27;).querySelectorAll(&#x27;tr&#x27;);
    subs.forEach(function (s, i) {
      if (rows[i]) rows[i].appendChild(delBtnCell(function () {
        subs.splice(i, 1); LS.set(&#x27;bf_subjects&#x27;, subs); renderBfSubjects(); renderBfDash();
      }));
    });
  }
  var done = subs.filter(function (s) { return s.status === &#x27;已完成&#x27;; });
  var doneCr = done.reduce(function (a, s) { return a + (s.cr || 0); }, 0);
  var compCr = done.filter(function (s) { return s.type === &#x27;必修&#x27;; }).reduce(function (a, s) { return a + (s.cr || 0); }, 0);
  var elecCr = done.filter(function (s) { return s.type === &#x27;選修&#x27;; }).reduce(function (a, s) { return a + (s.cr || 0); }, 0);
  if ($id(&#x27;bfSumDone&#x27;)) $id(&#x27;bfSumDone&#x27;).textContent = doneCr;
  if ($id(&#x27;bfSumComp&#x27;)) $id(&#x27;bfSumComp&#x27;).textContent = compCr;
  if ($id(&#x27;bfSumElec&#x27;)) $id(&#x27;bfSumElec&#x27;).textContent = elecCr;
}
function initBfSubjects() {
  if ($id(&#x27;bfAddSubBtn&#x27;)) $id(&#x27;bfAddSubBtn&#x27;).onclick = function () {
    var code = $id(&#x27;bfSubCode&#x27;).value.trim(), name = $id(&#x27;bfSubTitle&#x27;).value.trim();
    if (!code || !name) { toast(&#x27;請填寫科目編號和名稱&#x27;); return; }
    var a = LS.get(&#x27;bf_subjects&#x27;, []);
    a.push({ id: uid(), code: code, name: name, cr: Number($id(&#x27;bfSubCr&#x27;).value) || 3, type: $id(&#x27;bfSubType&#x27;).value, term: $id(&#x27;bfSubTerm&#x27;).value.trim(), exp: $id(&#x27;bfSubExpGrade&#x27;).value.trim(), act: &#x27;&#x27;, status: $id(&#x27;bfSubStatus&#x27;).value, prog: Number($id(&#x27;bfSubProgress&#x27;).value) || 0 });
    LS.set(&#x27;bf_subjects&#x27;, a);
    [&#x27;bfSubCode&#x27;, &#x27;bfSubTitle&#x27;, &#x27;bfSubCr&#x27;, &#x27;bfSubTerm&#x27;, &#x27;bfSubExpGrade&#x27;, &#x27;bfSubProgress&#x27;].forEach(function (i) { $id(i).value = &#x27;&#x27;; });
    renderBfSubjects(); renderBfDash(); toast(&#x27;已新增科目 ✓&#x27;);
  };
}

/* ============================================================
   BF 模塊 3：Non-JUPAS 院校庫
   ============================================================ */
function bfProgMeta() { return LS.get(&#x27;bf_progmeta&#x27;, {}); }
function renderBfPrograms() {
  var p = bfProfile();
  var gpa = Number(p.gpa) || 0;
  var kw = ($id(&#x27;bfProgFilter&#x27;) || {}).value || &#x27;&#x27;;
  kw = kw.trim().toLowerCase();
  var stg = ($id(&#x27;bfProgStrategy&#x27;) || {}).value || &#x27;&#x27;;
  var meta = bfProgMeta();

  var list = FIX.programs.filter(function (pr) {
    if (kw &amp;&amp; (pr.uni + pr.name + pr.field).toLowerCase().indexOf(kw) &lt; 0) return false;
    var st = strategyOf(gpa, pr.avg);
    var m = meta[pr.key] || {};
    if (stg === &#x27;收藏&#x27; &amp;&amp; !m.fav) return false;
    if (stg === &#x27;已標記申請&#x27; &amp;&amp; !m.applied) return false;
    if ((stg === &#x27;保&#x27; || stg === &#x27;穩&#x27; || stg === &#x27;衝&#x27;) &amp;&amp; st.t !== stg) return false;
    return true;
  });

  if ($id(&#x27;bfProgTbody&#x27;)) {
    $id(&#x27;bfProgTbody&#x27;).innerHTML = list.length ? list.map(function (pr) {
      var st = strategyOf(gpa, pr.avg);
      var m = meta[pr.key] || {};
      return &#x27;&lt;tr&gt;&lt;td&gt;&lt;b&gt;&#x27; + esc(pr.uni) + &#x27;&lt;/b&gt;&lt;/td&gt;&#x27; +
        &#x27;&lt;td&gt;&#x27; + esc(pr.name) + &#x27;&lt;br&gt;&lt;span style=&quot;font-size:10.5px;color:#9ca3af&quot;&gt;&#x27; + (pr.src === &#x27;官方&#x27; ? &#x27;官方歷年平均（2025 入學）&#x27; : &#x27;⚠️ 估算（非官方）&#x27;) + &#x27;&lt;/span&gt;&lt;/td&gt;&#x27; +
        &#x27;&lt;td&gt;&#x27; + esc(pr.field) + &#x27;&lt;/td&gt;&#x27; +
        &#x27;&lt;td&gt;最低 ~&#x27; + pr.min.toFixed(2) + &#x27;&lt;br&gt;平均 &lt;b&gt;&#x27; + pr.avg.toFixed(2) + &#x27;&lt;/b&gt;&lt;/td&gt;&#x27; +
        &#x27;&lt;td class=&quot;pros-cons&quot;&gt;✓ &#x27; + esc(pr.pros) + &#x27;&lt;br&gt;✗ &#x27; + esc(pr.cons) + &#x27;&lt;/td&gt;&#x27; +
        &#x27;&lt;td&gt;&lt;span class=&quot;strategy-pill s-&#x27; + st.k + &#x27;&quot;&gt;&#x27; + st.t + &#x27;&lt;/span&gt;&lt;/td&gt;&#x27; +
        &#x27;&lt;td style=&quot;white-space:nowrap&quot;&gt;&lt;button class=&quot;fav-btn&quot; data-fav=&quot;&#x27; + pr.key + &#x27;&quot; title=&quot;收藏&quot;&gt;&#x27; + (m.fav ? &#x27;⭐&#x27; : &#x27;☆&#x27;) + &#x27;&lt;/button&gt;&#x27; +
        &#x27;&lt;button class=&quot;fav-btn&quot; data-applied=&quot;&#x27; + pr.key + &#x27;&quot; title=&quot;標記申請&quot;&gt;&#x27; + (m.applied ? &#x27;📌&#x27; : &#x27;📍&#x27;) + &#x27;&lt;/button&gt;&#x27; +
        &#x27;&lt;button class=&quot;fav-btn&quot; data-note=&quot;&#x27; + pr.key + &#x27;&quot; title=&quot;備註&quot;&gt;💬&lt;/button&gt;&lt;/td&gt;&lt;/tr&gt;&#x27;;
    }).join(&#x27;&#x27;) : &#x27;&lt;tr&gt;&lt;td colspan=&quot;7&quot; class=&quot;empty-tip&quot;&gt;沒有符合條件的課程&lt;/td&gt;&lt;/tr&gt;&#x27;;

    $qa(&#x27;#bfProgTbody [data-fav]&#x27;).forEach(function (b) {
      b.onclick = function () {
        var k = b.getAttribute(&#x27;data-fav&#x27;), mt = bfProgMeta();
        mt[k] = mt[k] || {}; mt[k].fav = !mt[k].fav; LS.set(&#x27;bf_progmeta&#x27;, mt);
        renderBfPrograms(); renderBfFav();
      };
    });
    $qa(&#x27;#bfProgTbody [data-applied]&#x27;).forEach(function (b) {
      b.onclick = function () {
        var k = b.getAttribute(&#x27;data-applied&#x27;), mt = bfProgMeta();
        mt[k] = mt[k] || {}; mt[k].applied = !mt[k].applied; LS.set(&#x27;bf_progmeta&#x27;, mt);
        renderBfPrograms(); renderBfFav();
      };
    });
    $qa(&#x27;#bfProgTbody [data-note]&#x27;).forEach(function (b) {
      b.onclick = function () {
        var k = b.getAttribute(&#x27;data-note&#x27;), mt = bfProgMeta();
        mt[k] = mt[k] || {};
        var v = prompt(&#x27;備註（例：已開戶 / 已寄成績表 / 面試日期…）&#x27;, mt[k].note || &#x27;&#x27;);
        if (v === null) return;
        mt[k].note = v.trim(); LS.set(&#x27;bf_progmeta&#x27;, mt); renderBfFav();
      };
    });
  }
  renderBfFav();
}
function renderBfFav() {
  if (!$id(&#x27;bfFavBox&#x27;)) return;
  var meta = bfProgMeta();
  var picks = FIX.programs.filter(function (pr) { var m = meta[pr.key] || {}; return m.fav || m.applied || m.note; });
  if (!picks.length) { $id(&#x27;bfFavBox&#x27;).innerHTML = &#x27;&lt;div class=&quot;empty-tip&quot;&gt;在上方表格點 ⭐ 收藏 或 📍 標記申請，這裡會顯示你的清單與備註。&lt;/div&gt;&#x27;; return; }
  $id(&#x27;bfFavBox&#x27;).innerHTML = picks.map(function (pr) {
    var m = meta[pr.key] || {};
    return &#x27;&lt;div class=&quot;plan-item&quot;&gt;&lt;div&gt;&lt;div class=&quot;p-title&quot;&gt;&#x27; + (m.applied ? &#x27;📌 &#x27; : m.fav ? &#x27;⭐ &#x27; : &#x27;&#x27;) + esc(pr.uni) + &#x27; · &#x27; + esc(pr.name) + &#x27;&lt;/div&gt;&#x27; +
      (m.note ? &#x27;&lt;div class=&quot;p-sub&quot;&gt;💬 &#x27; + esc(m.note) + &#x27;&lt;/div&gt;&#x27; : &#x27;&#x27;) + &#x27;&lt;/div&gt;&lt;/div&gt;&#x27;;
  }).join(&#x27;&#x27;);
}
function initBfPrograms() {
  if ($id(&#x27;bfProgFilter&#x27;)) $id(&#x27;bfProgFilter&#x27;).addEventListener(&#x27;input&#x27;, debounce(renderBfPrograms, 200));
  if ($id(&#x27;bfProgStrategy&#x27;)) $id(&#x27;bfProgStrategy&#x27;).addEventListener(&#x27;change&#x27;, renderBfPrograms);
}

/* ============================================================
   BF 模塊 4：申請材料管理
   ============================================================ */
function renderBfMaterials() {
  var list = LS.get(&#x27;bf_materials&#x27;, null);
  if (!list) { list = JSON.parse(JSON.stringify(FIX.bfMaterials)); LS.set(&#x27;bf_materials&#x27;, list); }
  if ($id(&#x27;bfMatTbody&#x27;)) {
    $id(&#x27;bfMatTbody&#x27;).innerHTML = list.map(function (m, i) {
      return &#x27;&lt;tr&gt;&lt;td&gt;&lt;b&gt;&#x27; + esc(m.name) + &#x27;&lt;/b&gt;&lt;/td&gt;&#x27; +
        &#x27;&lt;td&gt;&lt;select data-st=&quot;&#x27; + i + &#x27;&quot;&gt;&lt;option&gt;未開始&lt;/option&gt;&lt;option&gt;草稿中&lt;/option&gt;&lt;option&gt;已完成&lt;/option&gt;&lt;option&gt;已提交&lt;/option&gt;&lt;/select&gt;&lt;/td&gt;&#x27; +
        &#x27;&lt;td style=&quot;font-size:11.5px;color:#9ca3af&quot;&gt;&#x27; + esc(m.updated || &#x27;—&#x27;) + &#x27;&lt;/td&gt;&#x27; +
        &#x27;&lt;td&gt;&lt;input data-nt=&quot;&#x27; + i + &#x27;&quot; value=&quot;&#x27; + esc(m.note || &#x27;&#x27;) + &#x27;&quot; placeholder=&quot;備註&quot; style=&quot;min-width:150px&quot; /&gt;&lt;/td&gt;&#x27; +
        &#x27;&lt;td&gt;&lt;input data-lk=&quot;&#x27; + i + &#x27;&quot; value=&quot;&#x27; + esc(m.link || &#x27;&#x27;) + &#x27;&quot; placeholder=&quot;雲端連結（可選）&quot; style=&quot;min-width:150px&quot; /&gt;&lt;/td&gt;&#x27; +
        &#x27;&lt;td&gt;&lt;button class=&quot;ghost&quot; data-save=&quot;&#x27; + i + &#x27;&quot; style=&quot;padding:4px 10px&quot;&gt;💾&lt;/button&gt;&lt;/td&gt;&#x27; +
        &#x27;&lt;td&gt;&lt;/td&gt;&lt;/tr&gt;&#x27;;
    }).join(&#x27;&#x27;);
    $qa(&#x27;#bfMatTbody select[data-st]&#x27;).forEach(function (s) {
      var i = +s.getAttribute(&#x27;data-st&#x27;);
      if (list[i].status) s.value = list[i].status;
    });
    $qa(&#x27;#bfMatTbody [data-save]&#x27;).forEach(function (b) {
      b.onclick = function () {
        var i = +b.getAttribute(&#x27;data-save&#x27;);
        var a = LS.get(&#x27;bf_materials&#x27;, []);
        a[i].status = $q(&#x27;#bfMatTbody select[data-st=&quot;&#x27; + i + &#x27;&quot;]&#x27;).value;
        a[i].note = $q(&#x27;#bfMatTbody [data-nt=&quot;&#x27; + i + &#x27;&quot;]&#x27;).value.trim();
        a[i].link = $q(&#x27;#bfMatTbody [data-lk=&quot;&#x27; + i + &#x27;&quot;]&#x27;).value.trim();
        a[i].updated = fmtFull(new Date());
        LS.set(&#x27;bf_materials&#x27;, a); renderBfMaterials(); toast(&#x27;已儲存 ✓&#x27;);
      };
    });
    var rows = $id(&#x27;bfMatTbody&#x27;).querySelectorAll(&#x27;tr&#x27;);
    list.forEach(function (m, i) {
      if (rows[i]) rows[i].appendChild(delBtnCell(function () { list.splice(i, 1); LS.set(&#x27;bf_materials&#x27;, list); renderBfMaterials(); }));
    });
  }
}
function initBfMaterials() {
  if ($id(&#x27;bfAddMatBtn&#x27;)) $id(&#x27;bfAddMatBtn&#x27;).onclick = function () {
    var n = $id(&#x27;bfMatNewName&#x27;).value.trim(); if (!n) { toast(&#x27;請填寫材料名稱&#x27;); return; }
    var a = LS.get(&#x27;bf_materials&#x27;, []);
    a.push({ id: uid(), name: n, status: &#x27;未開始&#x27;, note: &#x27;&#x27;, link: &#x27;&#x27;, updated: &#x27;&#x27; });
    LS.set(&#x27;bf_materials&#x27;, a);
    $id(&#x27;bfMatNewName&#x27;).value = &#x27;&#x27;;
    renderBfMaterials(); toast(&#x27;已新增材料 ✓&#x27;);
  };
}

/* ============================================================
   BF 模塊 5：CV 實時改善建議
   ============================================================ */
function renderBfCv() {
  var c = LS.get(&#x27;bf_cv&#x27;, {});
  [&#x27;bfCvGpa&#x27;, &#x27;bfCvTarget&#x27;, &#x27;bfCvComp&#x27;, &#x27;bfCvIntern&#x27;, &#x27;bfCvSkills&#x27;].forEach(function (id) {
    var el = $id(id); if (!el) return;
    if (document.activeElement !== el) el.value = c[id] || &#x27;&#x27;;
  });
  var acts = LS.get(&#x27;bf_cvactions&#x27;, null);
  if (!acts) { acts = JSON.parse(JSON.stringify(FIX.bfCvActions)); LS.set(&#x27;bf_cvactions&#x27;, acts); }
  if ($id(&#x27;bfCvActionList&#x27;)) {
    $id(&#x27;bfCvActionList&#x27;).innerHTML = acts.map(function (a, i) {
      return &#x27;&lt;li class=&quot;&#x27; + (a.done ? &#x27;done&#x27; : &#x27;&#x27;) + &#x27;&quot;&gt;&lt;input type=&quot;checkbox&quot; data-i=&quot;&#x27; + i + &#x27;&quot; &#x27; + (a.done ? &#x27;checked&#x27; : &#x27;&#x27;) + &#x27; /&gt;&lt;span&gt;&#x27; + esc(a.t) + &#x27;&lt;/span&gt;&lt;/li&gt;&#x27;;
    }).join(&#x27;&#x27;);
    $qa(&#x27;#bfCvActionList input&#x27;).forEach(function (cb) {
      cb.onchange = function () { var a = LS.get(&#x27;bf_cvactions&#x27;, []); a[+cb.getAttribute(&#x27;data-i&#x27;)].done = cb.checked; LS.set(&#x27;bf_cvactions&#x27;, a); renderBfCv(); };
    });
  }
}
function initBfCv() {
  [&#x27;bfCvGpa&#x27;, &#x27;bfCvTarget&#x27;, &#x27;bfCvComp&#x27;, &#x27;bfCvIntern&#x27;, &#x27;bfCvSkills&#x27;].forEach(function (id) {
    var el = $id(id); if (!el) return;
    el.addEventListener(&#x27;input&#x27;, debounce(function () { var c = LS.get(&#x27;bf_cv&#x27;, {}); c[id] = el.value; LS.set(&#x27;bf_cv&#x27;, c); }, 300));
  });
  if ($id(&#x27;bfCvSaveBtn&#x27;)) $id(&#x27;bfCvSaveBtn&#x27;).onclick = function () { toast(&#x27;輸入已儲存 ✓&#x27;); };
  if ($id(&#x27;bfCvGenBtn&#x27;)) $id(&#x27;bfCvGenBtn&#x27;).onclick = function () {
    var gpa = Number($id(&#x27;bfCvGpa&#x27;).value) || 3.78;
    var target = $id(&#x27;bfCvTarget&#x27;).value || &#x27;數據科學 / AI 相關學位&#x27;;
    var comp = $id(&#x27;bfCvComp&#x27;).value.trim();
    var intern = $id(&#x27;bfCvIntern&#x27;).value.trim();
    var skills = $id(&#x27;bfCvSkills&#x27;).value.trim();
    var out = [];

    out.push({ t: &#x27;GPA 與學術表現&#x27;, d: (gpa &gt;= 3.7 ? &#x27;✅ GPA &#x27; + gpa.toFixed(2) + &#x27; 屬第一梯隊：放在 CV 第一行，並標註「Cumulative GPA」與學分數。可爭取 Dean\&#x27;s List / 校長嘉許狀（如適用）。&#x27; : &#x27;⚠️ GPA &#x27; + gpa.toFixed(2) + &#x27; 尚可：放在教育欄，以「Major GPA」或趨勢呈現（如 Year GPA 上升），用專案經歷補足。&#x27;) });
    out.push({ t: &#x27;目標課程對接&#x27;, d: &#x27;針對「&#x27; + target + &#x27;」：CV 技能欄應涵蓋 Python / R / SQL / 統計建模，並在 Personal Statement 呼應課程核心模組。&#x27; });
    out.push({ t: &#x27;比賽 / 競賽經歷&#x27;, d: comp ? &#x27;已填寫 ✓ 建議以「動作 + 工具 + 結果」格式重寫每條，例如：「運用 Python 建立 X 模型，將 Y 提升 Z%」。&#x27; : &#x27;⚠️ 未填寫：建議 Year 2 參加至少 1 個數據比賽（Kaggle / 校內 Hackathon / 統計案例賽），這是 Senior Year 申請的最大加分項。&#x27; });
    out.push({ t: &#x27;實習 / 專案經歷&#x27;, d: intern ? &#x27;已填寫 ✓ 每條經歷控制在 2–3 行，突出數據量、技術棧與量化成果。&#x27; : &#x27;⚠️ 未填寫：即使沒有正式實習，也可列課堂專案（EDA、迴歸建模、資料視覺化）並上傳 GitHub，招生官非常看重。&#x27; });
    out.push({ t: &#x27;技能清單&#x27;, d: skills ? &#x27;目前技能：&#x27; + esc(skills) + &#x27;。建議補上 SQL 與一個 BI 工具（Tableau / Power BI），這是數據職位 JD 出現率最高的兩項。&#x27; : &#x27;⚠️ 未填寫：建議列出 Python、R、Excel（樞紐分析）、SQL（學習中）、Git/GitHub，並標註熟練度。&#x27; });
    out.push({ t: &#x27;語言與證書&#x27;, d: &#x27;如有 IELTS / TOEFL 成績或 MOOC 證書（Coursera、edX），集中在「Certifications」一欄列出。&#x27; });
    out.push({ t: &#x27;格式建議&#x27;, d: &#x27;一頁 A4、Arial/Calibri 10.5–11pt、倒序排列、PDF 提交；檔名格式：XIE_Haojun_CV.pdf。&#x27; });

    if ($id(&#x27;bfCvSugList&#x27;)) {
      $id(&#x27;bfCvSugList&#x27;).innerHTML = out.map(function (o) {
        return &#x27;&lt;div class=&quot;plan-item&quot;&gt;&lt;div&gt;&lt;div class=&quot;p-title&quot;&gt;💡 &#x27; + o.t + &#x27;&lt;/div&gt;&lt;div class=&quot;p-sub&quot;&gt;&#x27; + o.d + &#x27;&lt;/div&gt;&lt;/div&gt;&lt;/div&gt;&#x27;;
      }).join(&#x27;&#x27;);
    }
    toast(&#x27;✨ 已生成 &#x27; + out.length + &#x27; 項建議&#x27;);
  };
  if ($id(&#x27;bfCvAddActionBtn&#x27;)) $id(&#x27;bfCvAddActionBtn&#x27;).onclick = function () {
    var v = $id(&#x27;bfCvActionInput&#x27;).value.trim(); if (!v) return;
    var a = LS.get(&#x27;bf_cvactions&#x27;, []);
    a.push({ t: v, done: false });
    LS.set(&#x27;bf_cvactions&#x27;, a);
    $id(&#x27;bfCvActionInput&#x27;).value = &#x27;&#x27;;
    renderBfCv();
  };
}

/* ============================================================
   BF 模塊 6：申請時間節點倒計時
   ============================================================ */
function bfAllTimeline() {
  var custom = LS.get(&#x27;bf_timeline_custom&#x27;, []);
  var base = LS.get(&#x27;bf_fix_dl&#x27;, null);
  return ((base &amp;&amp; base.length) ? base : FIX.bfDeadlines).concat(custom);
}
function renderBfTimeline() {
  var list = bfAllTimeline().map(function (x) { x.n = daysUntil(x.d); return x; });
  list.sort(function (a, b) { return (a.n == null ? 9999 : a.n) - (b.n == null ? 9999 : b.n); });
  if ($id(&#x27;bfTimelineList&#x27;)) {
    $id(&#x27;bfTimelineList&#x27;).innerHTML = list.map(function (x) {
      var u = urgencyInfo(x.d);
      return &#x27;&lt;div class=&quot;plan-item&quot;&gt;&lt;div&gt;&lt;div class=&quot;p-title&quot;&gt;&#x27; + (x.custom ? &#x27;📍 &#x27; : &#x27;&#x27;) + esc(x.t) + &#x27;&lt;/div&gt;&lt;div class=&quot;p-sub&quot;&gt;&#x27; + fmtD(x.d) + &#x27;&lt;/div&gt;&lt;/div&gt;&#x27; +
        &#x27;&lt;div class=&quot;p-right&quot;&gt;&lt;span class=&quot;p-badge &#x27; + u.cls + &#x27;&quot;&gt;&#x27; + u.label + &#x27;&lt;/span&gt;&#x27; + (x.custom ? &#x27;&lt;button class=&quot;row-del&quot; data-custom=&quot;&#x27; + esc(x.t) + &#x27;&quot;&gt;🗑&lt;/button&gt;&#x27; : &#x27;&#x27;) + &#x27;&lt;/div&gt;&lt;/div&gt;&#x27;;
    }).join(&#x27;&#x27;);
    $qa(&#x27;#bfTimelineList [data-custom]&#x27;).forEach(function (b) {
      b.onclick = function () {
        var customs = LS.get(&#x27;bf_timeline_custom&#x27;, []);
        customs = customs.filter(function (c) { return c.t !== b.getAttribute(&#x27;data-custom&#x27;); });
        LS.set(&#x27;bf_timeline_custom&#x27;, customs);
        renderBfTimeline(); renderBfDash();
      };
    });
  }
}
function initBfTimeline() {
  if ($id(&#x27;bfAddTlBtn&#x27;)) $id(&#x27;bfAddTlBtn&#x27;).onclick = function () {
    var t = $id(&#x27;bfTlTitle&#x27;).value.trim(), d = $id(&#x27;bfTlDate&#x27;).value;
    if (!t || !d) { toast(&#x27;請填寫事項和日期&#x27;); return; }
    var a = LS.get(&#x27;bf_timeline_custom&#x27;, []);
    a.push({ t: t, d: d, custom: 1 });
    LS.set(&#x27;bf_timeline_custom&#x27;, a);
    $id(&#x27;bfTlTitle&#x27;).value = &#x27;&#x27;; $id(&#x27;bfTlDate&#x27;).value = &#x27;&#x27;;
    renderBfTimeline(); renderBfDash(); toast(&#x27;已新增倒計時 ✓&#x27;);
  };
}

/* ============================================================
   BF 模塊 8：職業規劃
   ============================================================ */
function renderBfCareer() {
  var c = LS.get(&#x27;bf_career&#x27;, {});
  if ($id(&#x27;bfCarGoal&#x27;) &amp;&amp; document.activeElement !== $id(&#x27;bfCarGoal&#x27;)) $id(&#x27;bfCarGoal&#x27;).value = c.goal || &#x27;&#x27;;
  if ($id(&#x27;bfCarIndustry&#x27;) &amp;&amp; document.activeElement !== $id(&#x27;bfCarIndustry&#x27;)) $id(&#x27;bfCarIndustry&#x27;).value = c.industry || &#x27;&#x27;;
  if ($id(&#x27;bfCarPositions&#x27;) &amp;&amp; document.activeElement !== $id(&#x27;bfCarPositions&#x27;)) $id(&#x27;bfCarPositions&#x27;).value = c.positions || &#x27;&#x27;;
  if ($id(&#x27;bfSkillNow&#x27;) &amp;&amp; document.activeElement !== $id(&#x27;bfSkillNow&#x27;)) $id(&#x27;bfSkillNow&#x27;).value = (c.skills || {}).now || &#x27;&#x27;;
  if ($id(&#x27;bfSkillGap&#x27;) &amp;&amp; document.activeElement !== $id(&#x27;bfSkillGap&#x27;)) $id(&#x27;bfSkillGap&#x27;).value = (c.skills || {}).gap || &#x27;&#x27;;
  if ($id(&#x27;bfSkillPlan&#x27;) &amp;&amp; document.activeElement !== $id(&#x27;bfSkillPlan&#x27;)) $id(&#x27;bfSkillPlan&#x27;).value = (c.skills || {}).plan || &#x27;&#x27;;

  var ch = LS.get(&#x27;bf_channels&#x27;, null);
  if (!ch) { ch = JSON.parse(JSON.stringify(FIX.bfChannels)); LS.set(&#x27;bf_channels&#x27;, ch); }
  if ($id(&#x27;bfChannelList&#x27;)) {
    $id(&#x27;bfChannelList&#x27;).innerHTML = ch.map(function (x, i) {
      return &#x27;&lt;li class=&quot;&#x27; + (x.done ? &#x27;done&#x27; : &#x27;&#x27;) + &#x27;&quot;&gt;&lt;input type=&quot;checkbox&quot; data-i=&quot;&#x27; + i + &#x27;&quot; &#x27; + (x.done ? &#x27;checked&#x27; : &#x27;&#x27;) + &#x27; /&gt;&lt;span&gt;&#x27; + esc(x.t) + &#x27;&lt;/span&gt;&lt;/li&gt;&#x27;;
    }).join(&#x27;&#x27;);
    $qa(&#x27;#bfChannelList input&#x27;).forEach(function (cb) {
      cb.onchange = function () { var a = LS.get(&#x27;bf_channels&#x27;, []); a[+cb.getAttribute(&#x27;data-i&#x27;)].done = cb.checked; LS.set(&#x27;bf_channels&#x27;, a); renderBfCareer(); };
    });
  }
  var jobs = LS.get(&#x27;bf_jobs&#x27;, []);
  if ($id(&#x27;bfJobTbody&#x27;)) {
    $id(&#x27;bfJobTbody&#x27;).innerHTML = jobs.length ? jobs.map(function (j) {
      return &#x27;&lt;tr&gt;&lt;td&gt;&lt;b&gt;&#x27; + esc(j.co) + &#x27;&lt;/b&gt;&lt;/td&gt;&lt;td&gt;&#x27; + esc(j.pos) + &#x27;&lt;/td&gt;&lt;td&gt;&#x27; + fmtD(j.date) + &#x27;&lt;/td&gt;&lt;td&gt;&#x27; + esc(j.status) + &#x27;&lt;/td&gt;&lt;td style=&quot;font-size:12px&quot;&gt;&#x27; + esc(j.note || &#x27;—&#x27;) + &#x27;&lt;/td&gt;&lt;td&gt;&lt;/td&gt;&lt;/tr&gt;&#x27;;
    }).join(&#x27;&#x27;) : &#x27;&lt;tr&gt;&lt;td colspan=&quot;6&quot; class=&quot;empty-tip&quot;&gt;尚未有投遞記錄&lt;/td&gt;&lt;/tr&gt;&#x27;;
    var rows = $id(&#x27;bfJobTbody&#x27;).querySelectorAll(&#x27;tr&#x27;);
    jobs.forEach(function (j, i) {
      if (rows[i]) rows[i].appendChild(delBtnCell(function () { jobs.splice(i, 1); LS.set(&#x27;bf_jobs&#x27;, jobs); renderBfCareer(); }));
    });
  }
}
function initBfCareer() {
  if ($id(&#x27;bfCarSaveBtn&#x27;)) $id(&#x27;bfCarSaveBtn&#x27;).onclick = function () {
    var c = LS.get(&#x27;bf_career&#x27;, {});
    c.goal = $id(&#x27;bfCarGoal&#x27;).value.trim();
    c.industry = $id(&#x27;bfCarIndustry&#x27;).value.trim();
    c.positions = $id(&#x27;bfCarPositions&#x27;).value.trim();
    LS.set(&#x27;bf_career&#x27;, c); toast(&#x27;職業規劃已儲存 ✓&#x27;);
  };
  if ($id(&#x27;bfSkillSaveBtn&#x27;)) $id(&#x27;bfSkillSaveBtn&#x27;).onclick = function () {
    var c = LS.get(&#x27;bf_career&#x27;, {});
    c.skills = { now: $id(&#x27;bfSkillNow&#x27;).value, gap: $id(&#x27;bfSkillGap&#x27;).value, plan: $id(&#x27;bfSkillPlan&#x27;).value };
    LS.set(&#x27;bf_career&#x27;, c); toast(&#x27;技能檢查已儲存 ✓&#x27;);
  };
  if ($id(&#x27;bfAddJobBtn&#x27;)) $id(&#x27;bfAddJobBtn&#x27;).onclick = function () {
    var co = $id(&#x27;bfJobCo&#x27;).value.trim(), pos = $id(&#x27;bfJobPos&#x27;).value.trim();
    if (!co || !pos) { toast(&#x27;請填寫公司和職位&#x27;); return; }
    var a = LS.get(&#x27;bf_jobs&#x27;, []);
    a.push({ co: co, pos: pos, date: $id(&#x27;bfJobDate&#x27;).value, status: $id(&#x27;bfJobStatus&#x27;).value, note: $id(&#x27;bfJobNote&#x27;).value.trim() });
    LS.set(&#x27;bf_jobs&#x27;, a);
    [&#x27;bfJobCo&#x27;, &#x27;bfJobPos&#x27;, &#x27;bfJobDate&#x27;, &#x27;bfJobNote&#x27;].forEach(function (i) { $id(i).value = &#x27;&#x27;; });
    renderBfCareer(); toast(&#x27;已記錄 ✓&#x27;);
  };
}

/* ============================================================
   BF 模塊 9：更新個人檔案
   ============================================================ */
function renderBfProfile() {
  var p = bfProfile();
  if ($id(&#x27;bfPfName&#x27;)) $id(&#x27;bfPfName&#x27;).value = p.name || &#x27;&#x27;;
  if ($id(&#x27;bfPfSid&#x27;)) $id(&#x27;bfPfSid&#x27;).value = p.sid || &#x27;&#x27;;
  if ($id(&#x27;bfPfSchool&#x27;)) $id(&#x27;bfPfSchool&#x27;).value = p.school || &#x27;&#x27;;
  if ($id(&#x27;bfPfYear&#x27;)) $id(&#x27;bfPfYear&#x27;).value = p.year || &#x27;&#x27;;
  if ($id(&#x27;bfPfMajor&#x27;)) $id(&#x27;bfPfMajor&#x27;).value = p.major || &#x27;&#x27;;
  if ($id(&#x27;bfPfGpa&#x27;)) $id(&#x27;bfPfGpa&#x27;).value = p.gpa || &#x27;&#x27;;
  if ($id(&#x27;bfPfTargetGpa&#x27;)) $id(&#x27;bfPfTargetGpa&#x27;).value = p.target || &#x27;&#x27;;
  if ($id(&#x27;bfPfNote&#x27;)) $id(&#x27;bfPfNote&#x27;).value = p.note || &#x27;&#x27;;
}
function initBfProfile() {
  if ($id(&#x27;bfPfSaveBtn&#x27;)) $id(&#x27;bfPfSaveBtn&#x27;).onclick = function () {
    var p = bfProfile();
    p.name = $id(&#x27;bfPfName&#x27;).value.trim() || p.name;
    p.sid = $id(&#x27;bfPfSid&#x27;).value.trim();
    p.school = $id(&#x27;bfPfSchool&#x27;).value.trim();
    p.year = $id(&#x27;bfPfYear&#x27;).value.trim();
    p.major = $id(&#x27;bfPfMajor&#x27;).value.trim();
    p.gpa = $id(&#x27;bfPfGpa&#x27;).value ? Number($id(&#x27;bfPfGpa&#x27;).value) : &#x27;&#x27;;
    p.target = $id(&#x27;bfPfTargetGpa&#x27;).value ? Number($id(&#x27;bfPfTargetGpa&#x27;).value) : &#x27;&#x27;;
    p.note = $id(&#x27;bfPfNote&#x27;).value.trim();
    LS.set(&#x27;bf_profile&#x27;, p);
    renderBfDash(); renderBfPrograms(); renderSidebarIdentity(); toast(&#x27;男友檔案已儲存 ✓&#x27;);
  };
}

/* ============================================================
   通知中心
   ============================================================ */
function collectNotifs() {
  var items = [];
  if (ACCT === &#x27;ly&#x27;) {
    getDl(&#x27;ly&#x27;).forEach(function (x) { items.push({ id: &#x27;lyfix&#x27; + x.d + x.t, t: x.t, d: x.d, tag: &#x27;日程&#x27; }); });
    LS.get(&#x27;todos&#x27;, []).forEach(function (t) { if (!t.done &amp;&amp; t.due) items.push({ id: &#x27;todo&#x27; + t.t, t: &#x27;📋 &#x27; + t.t, d: t.due, tag: &#x27;待辦&#x27; }); });
  } else {
    bfAllTimeline().forEach(function (x) { items.push({ id: &#x27;bffix&#x27; + x.d + x.t, t: x.t, d: x.d, tag: &#x27;申請&#x27; }); });
  }
  items.forEach(function (x) { x.n = daysUntil(x.d); });
  return items.filter(function (x) { return x.n != null &amp;&amp; x.n &gt;= -7 &amp;&amp; x.n &lt;= 45; })
    .sort(function (a, b) { return a.n - b.n; });
}
function renderNotifs() {
  var items = collectNotifs();
  var urgCount = items.filter(function (x) { return x.n &gt;= 0 &amp;&amp; x.n &lt;= 7; }).length;
  /* 🆕 v2.3.3 跨設備通知也計入未讀 */
  var crossNotifs = LS.get(&#x27;cross_notifs&#x27;, []);
  var unreadCross = crossNotifs.filter(function (c) { return !c.read; }).length;
  var totalUrg = urgCount + unreadCross;
  if ($id(&#x27;bellBadge&#x27;)) {
    $id(&#x27;bellBadge&#x27;).hidden = totalUrg === 0;
    $id(&#x27;bellBadge&#x27;).textContent = totalUrg;
  }
  if ($id(&#x27;notifList&#x27;)) {
    var crossHtml = &#x27;&#x27;;
    if (crossNotifs.length) {
      crossHtml = &#x27;&lt;div class=&quot;cross-notif-section&quot;&gt;&lt;div class=&quot;cross-notif-head&quot;&gt;📱 跨設備動態&lt;/div&gt;&#x27; +
        crossNotifs.slice(0, 5).map(function (c) {
          if (c.online) {
            return &#x27;&lt;div class=&quot;notif-item cross&#x27; + (c.read ? &#x27;&#x27; : &#x27; unread&#x27;) + &#x27;&quot;&gt;&lt;span class=&quot;n-ico&quot;&gt;👋&lt;/span&gt;&#x27; +
              &#x27;&lt;div&gt;&lt;div class=&quot;n-title&quot;&gt;&#x27; + esc(c.device) + &#x27; 上線了&lt;/div&gt;&#x27; +
              &#x27;&lt;div class=&quot;n-sub&quot;&gt;&#x27; + esc(c.msg || &#x27;&#x27;) + (c.time ? &#x27; · &#x27; + esc(c.time) : &#x27;&#x27;) + &#x27;&lt;/div&gt;&lt;/div&gt;&lt;/div&gt;&#x27;;
          }
          return &#x27;&lt;div class=&quot;notif-item cross&#x27; + (c.read ? &#x27;&#x27; : &#x27; unread&#x27;) + &#x27;&quot;&gt;&lt;span class=&quot;n-ico&quot;&gt;📱&lt;/span&gt;&#x27; +
            &#x27;&lt;div&gt;&lt;div class=&quot;n-title&quot;&gt;&#x27; + esc(c.device) + &#x27; 更新了 &#x27; + esc(c.msg) + &#x27;&lt;/div&gt;&#x27; +
            &#x27;&lt;div class=&quot;n-sub&quot;&gt;&#x27; + esc(c.time || &#x27;&#x27;) + &#x27;&lt;/div&gt;&lt;/div&gt;&lt;/div&gt;&#x27;;
        }).join(&#x27;&#x27;) + &#x27;&lt;/div&gt;&#x27;;
      /* 標記已讀 */
      var marked = crossNotifs.map(function (c) { c.read = true; return c; });
      LS.set(&#x27;cross_notifs&#x27;, marked);
    }
    $id(&#x27;notifList&#x27;).innerHTML = crossHtml + (items.length ? items.map(function (x) {
      var cls = x.n &lt; 0 ? &#x27;ok&#x27; : x.n &lt;= 7 ? &#x27;urg&#x27; : &#x27;warn&#x27;;
      var lbl = x.n &lt; 0 ? &#x27;已過&#x27; : x.n === 0 ? &#x27;今天&#x27; : x.n + &#x27; 天&#x27;;
      return &#x27;&lt;div class=&quot;notif-item&quot;&gt;&lt;span class=&quot;n-ico&quot;&gt;&#x27; + (x.n &lt;= 7 ? &#x27;🚨&#x27; : &#x27;📆&#x27;) + &#x27;&lt;/span&gt;&#x27; +
        &#x27;&lt;div&gt;&lt;div class=&quot;n-title&quot;&gt;&#x27; + esc(x.t) + &#x27;&lt;/div&gt;&lt;div class=&quot;n-sub&quot;&gt;&#x27; + x.tag + &#x27; · &#x27; + fmtD(x.d) + &#x27;&lt;/div&gt;&lt;/div&gt;&#x27; +
        &#x27;&lt;span class=&quot;n-days &#x27; + cls + &#x27;&quot;&gt;&#x27; + lbl + &#x27;&lt;/span&gt;&lt;/div&gt;&#x27;;
    }).join(&#x27;&#x27;) : &#x27;&lt;div class=&quot;empty-tip&quot; style=&quot;padding:14px&quot;&gt;📭 暫無即將到期的提醒&lt;/div&gt;&#x27;);
  }
}
function maybeBrowserNotify() {
  if (!(&#x27;Notification&#x27; in window) || Notification.permission !== &#x27;granted&#x27;) return;
  var today = todayStr();
  var sent = LS.get(&#x27;notif_sent&#x27;, {});
  var items = collectNotifs().filter(function (x) { return x.n &gt;= 0 &amp;&amp; x.n &lt;= 3 &amp;&amp; sent[x.id] !== today; });
  if (!items.length) return;
  items.slice(0, 3).forEach(function (x) {
    try {
      new Notification(&#x27;Lok Yi Hub 提醒&#x27;, { body: (x.n === 0 ? &#x27;今天到期：&#x27; : x.n + &#x27; 天後到期：&#x27;) + x.t, icon: &#x27;icons/icon-192.png&#x27;, tag: x.id });
    } catch (e) {}
    sent[x.id] = today;
  });
  LS.set(&#x27;notif_sent&#x27;, sent);
}
function initNotifUI() {
  if ($id(&#x27;bellBtn&#x27;)) $id(&#x27;bellBtn&#x27;).onclick = function () {
    var p = $id(&#x27;notifPanel&#x27;);
    p.hidden = !p.hidden;
    if (!p.hidden) renderNotifs();
  };
  if ($id(&#x27;closeNotifBtn&#x27;)) $id(&#x27;closeNotifBtn&#x27;).onclick = function () { $id(&#x27;notifPanel&#x27;).hidden = true; };
  if ($id(&#x27;enableNotifBtn&#x27;)) $id(&#x27;enableNotifBtn&#x27;).onclick = function () {
    if (!(&#x27;Notification&#x27; in window)) { toast(&#x27;此瀏覽器不支援通知&#x27;); return; }
    Notification.requestPermission().then(function (r) {
      toast(r === &#x27;granted&#x27; ? &#x27;🔔 通知已啟用！&#x27; : &#x27;未啟用（可稍後在瀏覽器設定開啟）&#x27;);
      if (r === &#x27;granted&#x27;) maybeBrowserNotify();
    });
  };
}

/* ============================================================
   Loki AI 助手（本地知識庫）
   ============================================================ */
var LOKI_KB = [
  { k: [&#x27;tsfs&#x27;, &#x27;資助&#x27;, &#x27;grant&#x27;, &#x27;入息審查&#x27;], a: &#x27;📑 TSFS（專上學生資助計劃）2026/27 截止 2026/9/25：Grant $52,450–$91,150 + Loan 上限 $58,200，需家庭入息審查。文件可到 SAO 簡報會（8/25、8/28、9/2）了解，經 POSS 系統登記。&#x27; },
  { k: [&#x27;nlsft&#x27;, &#x27;貸款&#x27;, &#x27;免入息&#x27;], a: &#x27;💰 NLSFT（免入息審查貸款）：行政費 $365，利率約 2.173% p.a.，同樣 9/25 截止。不需入息審查，全家可申。&#x27; },
  { k: [&#x27;wie&#x27;, &#x27;實習&#x27;, &#x27;學分轉移&#x27;, &#x27;ar41c&#x27;], a: &#x27;💼 WIE 學分轉移（Senior Year 適用）：截止 2026/8/31，經 eStudent 提交 AR41C。資格：5 年內、酒店/旅遊相關、≥3 個月或 480 小時（含兼職）。文件：① Sub-degree 成績單 ② 機構證明 ③ Pre-entry Internship Work Record。查詢：ada.au@polyu.edu.hk / 3400-2201。&#x27; },
  { k: [&#x27;exchange&#x27;, &#x27;交換&#x27;], a: &#x27;✈️ SHTM 交換計劃（2026/27 Sem 2）：申請截止 2026/9/3（四）13:00（Qualtrics），面試 9/7–9/8。文件：Course Selection Form、Supporting Statement（400–500 字）、英文 CV、成績單、語言成績（如有）、證件相 600×800。&#x27; },
  { k: [&#x27;選科&#x27;, &#x27;reg&#x27;, &#x27;add/drop&#x27;, &#x27;add drop&#x27;, &#x27;報名&#x27;], a: &#x27;📚 2026/27 Sem 1 選科：Mock 8/17–8/20 → 正式選科 8/21 10:00 – 8/25 23:59 → 開學前調整 8/28–8/30 → Add/Drop 8/31–9/12。AR 熱線：2766 5599 / 5191 / 5172。&#x27; },
  { k: [&#x27;cuhk&#x27;, &#x27;新媒體&#x27;, &#x27;碩士&#x27;, &#x27;升學&#x27;, &#x27;msc&#x27;], a: &#x27;🎓 CUHK MSc in New Media：需學士學位 + IELTS ≥ 6.5 / TOEFL ≥ 79 + SOP + 推薦信 ×2。9 月開放申請，優先輪約 12 月初截止（滾動取錄）。建議 10 月起準備 SOP 與作品集。&#x27; },
  { k: [&#x27;cv&#x27;, &#x27;簡歷&#x27;, &#x27;resume&#x27;], a: &#x27;📝 到「簡歷生成器」選好模板（求職/交換/資助/升學）→ 填資料 → 按「✨ AI 生成」按鈕輔助 → 生成 → 複製或下載。所有版本都存在本機。&#x27; },
  { k: [&#x27;deadline&#x27;, &#x27;截止&#x27;, &#x27;日程&#x27;, &#x27;重要&#x27;], a: &#x27;🚨 最近的大事：WIE 學分轉移 8/31 截止 → 交換申請 9/3 13:00 截止 → TSFS/NLSFT 9/25 截止。詳情看右上 🔔 通知中心。&#x27; },
  { k: [&#x27;ielts&#x27;, &#x27;英文&#x27;, &#x27;託福&#x27;, &#x27;toefl&#x27;], a: &#x27;🗣 語言：CUHK 新媒體碩士要求 IELTS ≥ 6.5 / TOEFL ≥ 79。建議 2026 年 12 月前應考，預留二刷時間。&#x27; },
  { k: [&#x27;gpa&#x27;], a: &#x27;📈 GPA 資料：Lok Yi 在「更新個人檔案」記錄；Austin（男友帳號）當前 3.78 / 目標 3.80，Sem1 3.86 · Sem2 3.72，已修 33/63 學分。&#x27; },
  { k: [&#x27;non-jupas&#x27;, &#x27;non jupas&#x27;, &#x27;senior year&#x27;, &#x27;院校&#x27;, &#x27;報校&#x27;], a: &#x27;🎓 Austin 的 Non-JUPAS（2027/28）：建議 6–8 個課程「衝穩保」組合，12 月前遞交佔優。詳情看「Non-JUPAS 院校庫」與「報名操作說明書」，或問我「錄取機會」。&#x27; },
  { k: [&#x27;錄取&#x27;, &#x27;機會&#x27;, &#x27;評估&#x27;], a: function () {
      var p = bfProfile(); var gpa = Number(p.gpa) || 0;
      var top = FIX.programs.map(function (pr) {
        var pct = Math.max(5, Math.min(95, Math.round(50 + (gpa - pr.avg) * 160)));
        return { n: pr.uni + &#x27; &#x27; + pr.name, pct: pct };
      }).sort(function (a, b) { return b.pct - a.pct; }).slice(0, 4);
      return &#x27;📊 以 GPA &#x27; + gpa.toFixed(2) + &#x27; 評估（僅供參考）：\n&#x27; + top.map(function (x) { return &#x27;• &#x27; + x.n + &#x27;：約 &#x27; + x.pct + &#x27;%&#x27;; }).join(&#x27;\n&#x27;) + &#x27;\n完整列表看「男友總覽 → 錄取評估」。&#x27;;
    } },
  { k: [&#x27;通知&#x27;, &#x27;提醒&#x27;], a: &#x27;🔔 點右上角 🔔 開通知中心 → 按「啟用瀏覽器通知」，3 天內到期的事會推送提醒。&#x27; },
  { k: [&#x27;安裝&#x27;, &#x27;app&#x27;, &#x27;pwa&#x27;, &#x27;手機&#x27;], a: &#x27;📲 手機打開本站 → Safari「加入主畫面」或 Chrome「安裝應用程式」，即可像 App 一樣全螢幕使用，離線也能開。&#x27; },
  { k: [&#x27;備份&#x27;, &#x27;匯出&#x27;, &#x27;export&#x27;, &#x27;資料&#x27;], a: &#x27;💾 所有資料存在瀏覽器本機。側邊欄「⬇️ 匯出所有資料」可下載 JSON 備份；換手機前記得先匯出！&#x27; },
  { k: [&#x27;求職&#x27;, &#x27;兼職&#x27;, &#x27;工作&#x27;, &#x27;招聘&#x27;], a: &#x27;🔍 求職入口：PolyU Job Board、LinkedIn、JobsDB、CTgoodjobs、Indeed、HospitalityNet… 都在「實習兼職搜尋」頁。&#x27; },
  { k: [&#x27;你好&#x27;, &#x27;hi&#x27;, &#x27;hello&#x27;, &#x27;hi loki&#x27;, &#x27;在做什麼&#x27;], a: &#x27;你好呀 👋 我是 Loki，你的專屬助手。可以問我：WIE 點申請學分轉移？TSFS 截止幾時？交換要什麼文件？Austin 錄取機會？&#x27; }
];

var LOKI_QUICK = {
  dashboard: [&#x27;🚨 最近有什麼大事？&#x27;, &#x27;📑 TSFS 怎麼申請？&#x27;, &#x27;教你安裝成 App&#x27;],
  reg: [&#x27;📚 選科時間是？&#x27;, &#x27;還差多少學分？&#x27;],
  wie: [&#x27;💼 WIE 學分轉移文件？&#x27;, &#x27;⏳ 距離截止還有幾天？&#x27;],
  exchange: [&#x27;✈️ 交換申請要什麼文件？&#x27;, &#x27;什麼時候面試？&#x27;],
  funding: [&#x27;📑 TSFS vs NLSFT？&#x27;, &#x27;簡報會怎麼登記？&#x27;],
  resume: [&#x27;📝 幫我寫個人簡介&#x27;, &#x27;簡歷有哪 4 個模板？&#x27;],
  jobs: [&#x27;🔍 有哪些求職網站？&#x27;, &#x27;怎麼追蹤投遞狀態？&#x27;],
  career: [&#x27;🎓 CUHK 新媒體碩士要求？&#x27;, &#x27;🎯 我該走哪個方向？&#x27;],
  study: [&#x27;📅 本週時間表？&#x27;, &#x27;怎麼上傳課堂 PPT？&#x27;],
  todos: [&#x27;✅ 最近緊急待辦？&#x27;, &#x27;怎麼匯出待辦？&#x27;],
  library: [&#x27;📎 怎麼收藏連結？&#x27;],
  ip: [&#x27;🎥 怎麼建立我的 IP 頁？&#x27;],
  ly_profile_edit: [&#x27;💾 資料存在哪裡？&#x27;],
  bf_dash: [&#x27;📊 錄取機會評估&#x27;, &#x27;🎯 目標課程建議&#x27;],
  bf_subjects: [&#x27;📚 我已完成多少學分？&#x27;, &#x27;➕ 怎麼新增科目？&#x27;],
  bf_nonjupas: [&#x27;🎓 衝穩保怎麼選？&#x27;, &#x27;⭐ 怎麼收藏課程？&#x27;],
  bf_materials: [&#x27;📎 需要準備什麼材料？&#x27;],
  bf_cv_suggestions: [&#x27;📝 CV 怎麼改善？&#x27;, &#x27;💡 需要學 SQL 嗎？&#x27;],
  bf_timeline: [&#x27;⏰ 下一個截止日？&#x27;, &#x27;IELTS 什麼時候考？&#x27;],
  bf_guide: [&#x27;📘 報名流程第一步？&#x27;, &#x27;💰 報名費多少？&#x27;],
  bf_career: [&#x27;🏦 金融數據崗好嗎？&#x27;, &#x27;📡 求職渠道？&#x27;],
  bf_profile_edit: [&#x27;💾 資料存在哪裡？&#x27;]
};

function lokiAnswer(q) {
  q = q.toLowerCase();
  var best = null, bestScore = 0;
  LOKI_KB.forEach(function (e) {
    var score = 0;
    e.k.forEach(function (kw) { if (q.indexOf(kw.toLowerCase()) &gt;= 0) score += kw.length; });
    if (score &gt; bestScore) { bestScore = score; best = e; }
  });
  if (best) return typeof best.a === &#x27;function&#x27; ? best.a() : best.a;
  /* 頁面上下文提示 */
  var ctx = {
    dashboard: &#x27;你在 Dashboard，可問我「最近有什麼大事」或「TSFS 截止日」。&#x27;,
    reg: &#x27;你在 REG 學分管理，可問「選科時間」「畢業學分」。&#x27;,
    wie: &#x27;你在 WIE 頁，可問「學分轉移文件」「截止倒數」。&#x27;,
    exchange: &#x27;你在交換計劃頁，可問「申請文件」「面試時間」。&#x27;,
    funding: &#x27;你在資助頁，可問「TSFS 和 NLSFT 分別」。&#x27;,
    resume: &#x27;你在簡歷生成器，可問「4 個模板分別」。&#x27;,
    bf_dash: &#x27;你在男友總覽，可問「錄取機會評估」。&#x27;
  }[PAGE];
  return &#x27;🤔 這題我還在學習…\n試試問：WIE 學分轉移、TSFS 截止、交換文件、CUHK 新媒體、Austin 錄取機會、怎樣安裝 App。\n&#x27; + (ctx ? &#x27;\n（提示：&#x27; + ctx + &#x27;）&#x27; : &#x27;&#x27;);
}

/* ---- 🆕 v2.3：Loki 智能鏈（內部數據 → 外部檢索 Wikipedia → 兜底） ---- */
function lokiInternalData(q) {
  q = q.toLowerCase();
  function has() { for (var i = 0; i &lt; arguments.length; i++) { if (q.indexOf(arguments[i]) &gt;= 0) return true; } return false; }
  /* 今日課堂 */
  if (has(&#x27;今日課&#x27;, &#x27;今天有什麼課&#x27;, &#x27;時間表&#x27;, &#x27;課表&#x27;, &#x27;明天有什麼課&#x27;, &#x27;上課&#x27;)) {
    var tt = LS.get(&#x27;timetable&#x27;, { slots: FIX.timetable.slice() });
    var dow = (new Date().getDay() + 6) % 7;
    var list = (tt.slots || []).filter(function (s) { return s.d === dow; }).sort(function (a, b) { return a.t - b.t; });
    return &#x27;📅 今日（週&#x27; + &#x27;一二三四五&#x27;[dow] + &#x27;）共有 &#x27; + list.length + &#x27; 節課：\n&#x27; +
      (list.map(function (s) { return &#x27;· &#x27; + pad2(s.t) + &#x27;:00 &#x27; + s.subj + (s.room ? &#x27;（&#x27; + s.room + &#x27;）&#x27; : &#x27;&#x27;); }).join(&#x27;\n&#x27;) || &#x27;（無課 🎉）&#x27;) +
      &#x27;\n\n💡 時間表不對？到「學習進度追蹤」頁上傳最新課表即可自動更新。&#x27;;
  }
  /* 待辦 */
  if (has(&#x27;待辦&#x27;, &#x27;todo&#x27;, &#x27;要做&#x27;)) {
    var todos = LS.get(&#x27;todos&#x27;, []).filter(function (t) { return !t.done; });
    return &#x27;✅ 你有 &#x27; + todos.length + &#x27; 項未完成待辦：\n&#x27; +
      (todos.slice(0, 8).map(function (t) { return &#x27;· &#x27; + t.t + (t.due ? &#x27;（&#x27; + daysBadge(t.due) + &#x27;）&#x27; : &#x27;&#x27;); }).join(&#x27;\n&#x27;) || &#x27;（全部完成 🎉）&#x27;);
  }
  /* GPA */
  if (has(&#x27;gpa&#x27;)) {
    var pf = LS.get(&#x27;ly_profile&#x27;, {});
    var gp = LS.get(&#x27;bf_gpacalc&#x27;, []);
    var lines = [];
    if (pf.gpa) lines.push(&#x27;· Lok Yi 當前 GPA：&#x27; + pf.gpa + (pf.target_gpa ? &#x27;（目標 &#x27; + pf.target_gpa + &#x27;）&#x27; : &#x27;&#x27;));
    if (gp.length) {
      var cr = 0, pt = 0;
      gp.forEach(function (r) { if (+r.cr &gt; 0 &amp;&amp; GPASCALE[r.g] != null) { cr += +r.cr; pt += +r.cr * GPASCALE[r.g]; } });
      if (cr) lines.push(&#x27;· Austin 模擬 GPA：&#x27; + (pt / cr).toFixed(2) + &#x27; / 4.3（&#x27; + cr + &#x27; 學分）&#x27;);
    }
    return lines.length ? &#x27;📈 GPA 概況：\n&#x27; + lines.join(&#x27;\n&#x27;) : &#x27;📈 尚未記錄 GPA — 到「更新個人檔案」輸入當前 GPA，Austin 可用「科目進度」頁的 GPA 計算器。&#x27;;
  }
  /* 倒數/截止 */
  if (has(&#x27;倒數&#x27;, &#x27;截止&#x27;, &#x27;deadline&#x27;, &#x27;大事&#x27;, &#x27;重要日程&#x27;)) {
    var dlForLoki = ACCT === &#x27;bf&#x27; ? bfAllTimeline() : getDl(&#x27;ly&#x27;);
    var items = dlForLoki.map(function (x) { x.n = daysUntil(x.d); return x; })
      .filter(function (x) { return x.n != null &amp;&amp; x.n &gt;= 0; }).sort(function (a, b) { return a.n - b.n; }).slice(0, 5);
    return &#x27;⏰ 最近的重要節點：\n&#x27; + items.map(function (x) { return &#x27;· &#x27; + fmtD(x.d) + &#x27;（&#x27; + daysBadge(x.d) + &#x27;）&#x27; + x.t; }).join(&#x27;\n&#x27;);
  }
  /* 求職 */
  if (has(&#x27;投遞&#x27;, &#x27;求職進度&#x27;, &#x27;面試&#x27;)) {
    var jobs = LS.get(&#x27;jobs&#x27;, []);
    return &#x27;🔍 求職追蹤：共投遞 &#x27; + jobs.length + &#x27; 個崗位&#x27; +
      (jobs.length ? &#x27;\n&#x27; + jobs.slice(0, 6).map(function (j) { return &#x27;· &#x27; + j.co + &#x27; &#x27; + j.pos + &#x27;（&#x27; + (j.status || &#x27;&#x27;) + (j.int ? &#x27; · 面試 &#x27; + fmtD(j.int) : &#x27;&#x27;) + &#x27;）&#x27;; }).join(&#x27;\n&#x27;) : &#x27;（暫無記錄）&#x27;);
  }
  /* 科目進度 */
  if (has(&#x27;科目進度&#x27;, &#x27;學分&#x27;)) {
    var subs = LS.get(&#x27;bf_subjects&#x27;, []);
    var done = subs.filter(function (s) { return s.status === &#x27;已完成&#x27;; }).length;
    return &#x27;📚 Austin 已修讀 &#x27; + subs.length + &#x27; 科（已完成 &#x27; + done + &#x27; 科）。Lok Yi 的科目在「REG &amp; 學分管理」查看。&#x27;;
  }
  /* 日記 */
  if (has(&#x27;日記&#x27;, &#x27;纪念日&#x27;, &#x27;在一起&#x27;)) {
    var anniv = LS.get(&#x27;diary_anniv&#x27;, &#x27;&#x27;);
    if (anniv) {
      var n = daysUntil(anniv);
      return &#x27;📔 我們在一起已 &#x27; + Math.abs(n) + &#x27; 天（紀念日 &#x27; + fmtD(anniv) + &#x27;）。到「共同日記」看看你們的時光軸吧！&#x27;;
    }
    return &#x27;📔 到「我們的共同日記」設定紀念日後，我可以告訴你們在一起多少天。&#x27;;
  }
  return null;
}
/* 專有名詞內置詞庫（離線可答 · 不依賴網絡） */
var LOKI_TERMS = [
  { k: [&#x27;swot&#x27;], a: &#x27;SWOT 分析：S=優勢(Strengths)、W=劣勢(Weaknesses)、O=機會(Opportunities)、T=威脅(Threats)。求職／報告／商業分析常用框架，寫 CV 或面試分析案例時很加分。&#x27; },
  { k: [&#x27;seo&#x27;], a: &#x27;SEO（Search Engine Optimization）搜尋引擎優化：讓內容在搜尋結果排更前的技術。小紅書的「關鍵詞佈局」就是社交平台版 SEO — 標題核心詞前置、正文埋詞、標籤強化。&#x27; },
  { k: [&#x27;ctr&#x27;], a: &#x27;CTR（Click-Through Rate）點擊率 = 點擊數 ÷ 曝光數。封面+標題決定 CTR，是小紅書筆記能否被點開的關鍵。&#x27; },
  { k: [&#x27;roi&#x27;], a: &#x27;ROI（Return on Investment）投資回報率 =（收益 − 成本）÷ 成本 × 100%。&#x27; },
  { k: [&#x27;kol&#x27;, &#x27;koc&#x27;], a: &#x27;KOL（Key Opinion Leader）關鍵意見領袖＝大V；KOC（Key Opinion Consumer）關鍵意見消費者＝真實感更強的素人買家。品牌現在更愛投 KOC — 真實、轉化高、成本低。&#x27; },
  { k: [&#x27;完播率&#x27;, &#x27;完播&#x27;], a: &#x27;完播率 = 看完人數 ÷ 播放人數。抖音第一權重指標，≥30% 才有望晉級更大流量池；前 3 秒鉤子直接決定完播率。&#x27; },
  { k: [&#x27;私域&#x27;, &#x27;公域&#x27;], a: &#x27;公域流量：平台分發的流量（推薦頁、搜索）；私域流量：自己能反覆觸達的用戶（粉絲群、微信、社群）。運營終極目標是「公域引流 → 私域沉澱」。&#x27; },
  { k: [&#x27;種草&#x27;], a: &#x27;種草：透過真實分享激發別人購買／體驗慾望的內容方式；「草」=想買的慾望。小紅書核心內容生態。&#x27; },
  { k: [&#x27;用戶畫像&#x27;, &#x27;使用者畫像&#x27;], a: &#x27;用戶畫像（User Persona）：演算法根據行為（觀看、停留、互動）為每個用戶打的興趣標籤集合。抖音推薦 = 用戶畫像 × 內容標籤 雙向匹配。&#x27; },
  { k: [&#x27;長尾&#x27;], a: &#x27;長尾流量（Long-tail）：發布很久仍持續從搜索進來的流量。小紅書優質筆記 6-12 個月仍有搜索流量；抖音爆發期只有 24-72 小時。&#x27; },
  { k: [&#x27;流量池&#x27;], a: &#x27;流量池：抖音的分級賽馬機制 — 初始池 200-500 曝光 → 數據達標（完播&gt;30%、互動&gt;3%）晉級中池 1K-5K → 大池 1萬-10萬 → 爆款池 10萬+。每級都是「晉級考試」。&#x27; },
  { k: [&#x27;non-jupas&#x27;], a: &#x27;Non-JUPAS：大學聯招以外的副學士/高級文憑/海外生升學通道。Austin 走的就是 HKCC Year 2 → PolyU Non-JUPAS 2027/28。&#x27; },
  { k: [&#x27;ielts&#x27;], a: &#x27;IELTS 雅思：英語能力試，滿分 9.0。Non-JUPAS 升學通常要 6.0-6.5+；Austin 目標 12 月應考。&#x27; },
  { k: [&#x27;wie &#x27;], a: &#x27;WIE（Work-Integrated Education）工作綜合學習：PolyU SHTM 必修，需完成指定實習時數。已有全職工作經驗可申請學分轉移（AR41C 表格），Lok Yi 截止 2026-08-31。&#x27; },
  { k: [&#x27;tsfs&#x27;, &#x27;nlsft&#x27;], a: &#x27;TSFS / NLSFT：香港政府學生資助計劃（免入息審查貸款／資助）。申請截止 2026-09-25，記得準備入息證明文件。&#x27; },
  { k: [&#x27;gpa&#x27;], a: &#x27;GPA（Grade Point Average）平均績點：加權計算的成績指標。PolyU 4.3 制（A+=4.3）；HKCC 也是 4.3 制。升學看 CGPA（累計 GPA）。&#x27; }
];
function wikiFetchTimeout(url, ms) {
  var ctl = (&#x27;AbortController&#x27; in window) ? new AbortController() : null;
  var t = ctl ? setTimeout(function () { ctl.abort(); }, ms || 5000) : null;
  var p = fetch(url, ctl ? { signal: ctl.signal } : undefined);
  if (ctl) p = p.catch(function (e) { throw e; }).then(function (r) { clearTimeout(t); return r; }, function (e) { clearTimeout(t); throw e; });
  return p;
}
function wikiSearch(q) {
  var clean = q.replace(/[?？!！。,.，、]/g, &#x27; &#x27;).replace(/\s+/g, &#x27; &#x27;).trim();
  if (!clean) return Promise.resolve(null);
  var u1 = &#x27;https://zh.wikipedia.org/w/api.php?action=query&amp;format=json&amp;origin=*&amp;list=search&amp;srlimit=1&amp;srsearch=&#x27; + encodeURIComponent(clean);
  return wikiFetchTimeout(u1, 5000).then(function (r) { return r.json(); }).then(function (d) {
    var hit = d &amp;&amp; d.query &amp;&amp; d.query.search &amp;&amp; d.query.search[0];
    if (!hit) return null;
    var title = hit.title;
    var u2 = &#x27;https://zh.wikipedia.org/w/api.php?action=query&amp;format=json&amp;origin=*&amp;prop=extracts&amp;exintro=1&amp;explaintext=1&amp;redirects=1&amp;titles=&#x27; + encodeURIComponent(title);
    return wikiFetchTimeout(u2, 5000).then(function (r) { return r.json(); }).then(function (d2) {
      var pages = d2.query &amp;&amp; d2.query.pages;
      var pid = pages ? Object.keys(pages)[0] : null;
      var ext = pid &amp;&amp; pages[pid].extract ? pages[pid].extract : &#x27;&#x27;;
      if (!ext) return { title: title, sum: &#x27;&#x27;, url: &#x27;https://zh.wikipedia.org/wiki/&#x27; + encodeURIComponent(title) };
      var sum = ext.replace(/\s+/g, &#x27; &#x27;).trim().slice(0, 320);
      return { title: title, sum: sum, url: &#x27;https://zh.wikipedia.org/wiki/&#x27; + encodeURIComponent(title) };
    });
  }).catch(function () { return null; });
}
function lokiSmartAnswer(q) {
  return new Promise(function (resolve) {
    var inner = lokiInternalData(q);
    /* 內置專有名詞詞庫 */
    var low = q.toLowerCase();
    var term = null;
    LOKI_TERMS.forEach(function (e) {
      e.k.forEach(function (kw) {
        if (!term &amp;&amp; low.indexOf(kw) &gt;= 0) term = e.a;
      });
    });
    wikiSearch(q).then(function (wk) {
      var parts = [];
      if (inner) parts.push(inner);
      if (term &amp;&amp; wk) parts.push(&#x27;📖 &lt;b&gt;名詞解釋&lt;/b&gt;\n&#x27; + term);
      else if (term) parts.push(&#x27;📖 &lt;b&gt;名詞解釋&lt;/b&gt;\n&#x27; + term);
      if (wk) {
        parts.push(&#x27;🌐 &lt;b&gt;外部知識（維基百科）&lt;/b&gt;\n「&#x27; + wk.title + &#x27;」：&#x27; + (wk.sum || &#x27;（摘要暫缺）&#x27;) +
          (wk.sum.length &gt;= 320 ? &#x27;…&#x27; : &#x27;&#x27;) + &#x27;\n📖 完整內容：&lt;a href=&quot;&#x27; + wk.url + &#x27;&quot; target=&quot;_blank&quot; rel=&quot;noopener&quot;&gt;&#x27; + wk.url + &#x27;&lt;/a&gt;&#x27;);
      }
      if (!parts.length) {
        resolve(&#x27;🤔 內部和外部都查不到「&#x27; + esc(q.slice(0, 30)) + &#x27;」…\n試試換個說法，或問我：今日課堂、待辦、GPA、倒數、WIE、TSFS、交換；也可以直接問專有名詞（如 SWOT、SEO、完播率、流量池、私域流量），我會先查內置詞庫，再聯網維基百科給你解釋＋來源鏈接。（聯網檢索需要網絡可以訪問 Wikipedia）&#x27;);
        return;
      }
      var src = inner ? &#x27;內部資料&#x27; : &#x27;&#x27;;
      if (term) src += (src ? &#x27; + &#x27; : &#x27;&#x27;) + &#x27;內置詞庫&#x27;;
      if (wk) src += (src ? &#x27; + &#x27; : &#x27;&#x27;) + &#x27;外部檢索&#x27;;
      resolve(&#x27;✨ 綜合回答（&#x27; + src + &#x27;）：\n\n&#x27; + parts.join(&#x27;\n\n&#x27;) +
        (wk ? &#x27;&#x27; : &#x27;\n\nℹ️（外部檢索暫時不可用 — 網絡需能訪問 Wikipedia；上面是內置知識的回答）&#x27;));
    });
  });
}

function initLoki() {
  var msgs = $id(&#x27;aiMessages&#x27;);
  function addMsg(text, who) {
    var m = document.createElement(&#x27;div&#x27;);
    m.className = &#x27;msg &#x27; + (who || &#x27;bot&#x27;);
    m.textContent = text;
    msgs.appendChild(m);
    msgs.scrollTop = msgs.scrollHeight;
  }
  function addMsgHTML(html, typing) {
    var m = document.createElement(&#x27;div&#x27;);
    m.className = &#x27;msg bot&#x27; + (typing ? &#x27; typing&#x27; : &#x27;&#x27;);
    m.innerHTML = html;
    msgs.appendChild(m);
    msgs.scrollTop = msgs.scrollHeight;
    return m;
  }
  function replaceLastMsg(html) {
    var all = msgs.querySelectorAll(&#x27;.msg.bot&#x27;);
    var last = all[all.length - 1];
    if (last) { last.classList.remove(&#x27;typing&#x27;); last.innerHTML = html; }
    else addMsgHTML(html);
    msgs.scrollTop = msgs.scrollHeight;
  }
  function ask(q) {
    addMsg(q, &#x27;user&#x27;);
    var local = lokiAnswer(q);
    if (local &amp;&amp; local.indexOf(&#x27;還在學習&#x27;) &lt; 0) {
      setTimeout(function () { addMsg(local, &#x27;bot&#x27;); }, 420);
      return;
    }
    addMsgHTML(&#x27;🔎 正在查閱你的資料與外部知識…&#x27;, true);
    lokiSmartAnswer(q).then(function (ans) {
      setTimeout(function () { replaceLastMsg(ans); }, 300);
    }).catch(function () {
      replaceLastMsg(&#x27;❌ 查閱失敗（網絡問題？），請稍後再試&#x27;);
    });
  }
  window.LokiAI = {
    toggle: function () {
      var p = $id(&#x27;aiPanel&#x27;);
      if (p.hidden) { window.LokiAI.show(); } else { window.LokiAI.hide(); }
    },
    show: function () {
      $id(&#x27;aiPanel&#x27;).hidden = false;
      $id(&#x27;aiLauncher&#x27;).classList.add(&#x27;is-hidden&#x27;);
      if (!msgs.childElementCount) {
        addMsg(&#x27;Hi Lok Yi 👋 我是 Loki，你的專屬助手。\n已載入你的課程、申請、倒計時資料，直接問我任何問題！&#x27;, &#x27;bot&#x27;);
      }
      window.LokiAI.renderQuick();
      setTimeout(function () { if ($id(&#x27;aiInput&#x27;)) $id(&#x27;aiInput&#x27;).focus(); }, 120);
    },
    hide: function () {
      $id(&#x27;aiPanel&#x27;).hidden = true;
      $id(&#x27;aiLauncher&#x27;).classList.remove(&#x27;is-hidden&#x27;);
    },
    renderQuick: function () {
      var chips = LOKI_QUICK[PAGE] || [&#x27;🚨 最近有什麼大事？&#x27;];
      if ($id(&#x27;aiQuick&#x27;)) {
        $id(&#x27;aiQuick&#x27;).innerHTML = chips.map(function (c) {
          return &#x27;&lt;button class=&quot;ai-chip&quot; data-q=&quot;&#x27; + esc(c) + &#x27;&quot;&gt;&#x27; + esc(c) + &#x27;&lt;/button&gt;&#x27;;
        }).join(&#x27;&#x27;);
        $qa(&#x27;#aiQuick .ai-chip&#x27;).forEach(function (b) {
          b.onclick = function () { ask(b.getAttribute(&#x27;data-q&#x27;)); };
        });
      }
    },
    ask: ask
  };

  if ($id(&#x27;aiSendBtn&#x27;)) $id(&#x27;aiSendBtn&#x27;).onclick = function () {
    var v = $id(&#x27;aiInput&#x27;).value.trim();
    if (!v) return;
    $id(&#x27;aiInput&#x27;).value = &#x27;&#x27;;
    ask(v);
  };
  if ($id(&#x27;aiInput&#x27;)) {
    $id(&#x27;aiInput&#x27;).addEventListener(&#x27;keydown&#x27;, function (e) {
      if (e.key === &#x27;Enter&#x27; &amp;&amp; !e.shiftKey) {
        e.preventDefault();
        $id(&#x27;aiSendBtn&#x27;).click();
      }
    });
  }
}

/* ============================================================
   🆕 v2.1 新功能：深色模式 / 匯入備份 / 全域搜尋 / D-Day 倒數 /
   月曆總覽 / GPA 計算器 / 簡歷列印
   ============================================================ */

/* ---- 1. 深色模式 ---- */
function applyTheme(mode) {
  var root = document.documentElement;
  var dark;
  if (mode === &#x27;auto&#x27;) {
    dark = !!(window.matchMedia &amp;&amp; window.matchMedia(&#x27;(prefers-color-scheme: dark)&#x27;).matches);
  } else {
    dark = (mode === &#x27;dark&#x27;);
  }
  root.setAttribute(&#x27;data-theme&#x27;, dark ? &#x27;dark&#x27; : &#x27;light&#x27;);
  var btn = $id(&#x27;themeBtn&#x27;);
  if (btn) btn.textContent = dark ? &#x27;☀️&#x27; : &#x27;🌙&#x27;;
  var meta = document.querySelector(&#x27;meta[name=&quot;theme-color&quot;]&#x27;);
  if (meta) meta.setAttribute(&#x27;content&#x27;, dark ? &#x27;#151a23&#x27; : &#x27;#83001A&#x27;);
}
function initTheme() {
  applyTheme(LS.get(&#x27;theme&#x27;, &#x27;auto&#x27;));
  if ($id(&#x27;themeBtn&#x27;)) $id(&#x27;themeBtn&#x27;).onclick = function () {
    var next = document.documentElement.getAttribute(&#x27;data-theme&#x27;) === &#x27;dark&#x27; ? &#x27;light&#x27; : &#x27;dark&#x27;;
    LS.set(&#x27;theme&#x27;, next);
    applyTheme(next);
    toast(next === &#x27;dark&#x27; ? &#x27;🌙 已切換至深色模式&#x27; : &#x27;🌤 已切換至淺色模式&#x27;);
  };
  if (window.matchMedia) {
    try {
      var mq = window.matchMedia(&#x27;(prefers-color-scheme: dark)&#x27;);
      var h = function () { if (LS.get(&#x27;theme&#x27;, &#x27;auto&#x27;) === &#x27;auto&#x27;) applyTheme(&#x27;auto&#x27;); };
      if (mq.addEventListener) mq.addEventListener(&#x27;change&#x27;, h);
      else if (mq.addListener) mq.addListener(h);
    } catch (e) {}
  }
}

/* ---- 2. 匯入備份（與「匯出所有資料」配套） ---- */
function initImport() {
  var btn = $id(&#x27;importBtn&#x27;), file = $id(&#x27;importFile&#x27;);
  if (!btn || !file) return;
  btn.onclick = function () { file.click(); };
  file.onchange = function () {
    var f = file.files &amp;&amp; file.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      var data = null;
      try { data = JSON.parse(r.result); } catch (e) {}
      if (!data || typeof data !== &#x27;object&#x27; || Array.isArray(data)) { toast(&#x27;❌ 不是有效的備份 JSON 檔&#x27;); return; }
      delete data.__export_time;
      var keys = Object.keys(data);
      if (!keys.length) { toast(&#x27;❌ 備份檔內沒有資料&#x27;); return; }
      showConfirm(&#x27;備份包含 &#x27; + keys.length + &#x27; 項資料（兩個帳號的資料都會還原）。\n匯入會覆蓋現有同名資料，確定繼續嗎？&#x27;).then(function (ok) {
        if (!ok) return;
        keys.forEach(function (k) { LS.set(k, data[k]); });
        toast(&#x27;✅ 匯入成功，正在重新載入…&#x27;);
        setTimeout(function () { location.reload(); }, 900);
      });
    };
    r.onerror = function () { toast(&#x27;❌ 讀取檔案失敗&#x27;); };
    r.readAsText(f, &#x27;utf-8&#x27;);
    file.value = &#x27;&#x27;;
  };
}

/* ---- 3. 全域搜尋（跨模組） ---- */
function collectSearchItems() {
  var out = [];
  function push(text, sub, page, acct) {
    text = String(text == null ? &#x27;&#x27; : text).trim();
    if (!text) return;
    out.push({ text: text, sub: sub, page: page, acct: acct, kw: (text + &#x27; &#x27; + sub).toLowerCase() });
  }
  LS.get(&#x27;todos&#x27;, []).forEach(function (t) { push(t.t, &#x27;✅ 待辦 · &#x27; + (t.cat || &#x27;&#x27;) + (t.due ? &#x27; · &#x27; + fmtD(t.due) : &#x27;&#x27;), &#x27;todos&#x27;, &#x27;ly&#x27;); });
  LS.get(&#x27;subs&#x27;, []).forEach(function (s) { push((s.code || &#x27;&#x27;) + &#x27; &#x27; + (s.name || &#x27;&#x27;), &#x27;📚 科目資料庫 · &#x27; + (s.grade || &#x27;&#x27;), &#x27;reg&#x27;, &#x27;ly&#x27;); });
  LS.get(&#x27;jobs&#x27;, []).forEach(function (j) { push((j.co || &#x27;&#x27;) + &#x27; · &#x27; + (j.pos || &#x27;&#x27;), &#x27;🔍 求職追蹤 · &#x27; + (j.status || &#x27;&#x27;), &#x27;jobs&#x27;, &#x27;ly&#x27;); });
  LS.get(&#x27;bookmarks&#x27;, []).forEach(function (b) { push((b.n || &#x27;&#x27;) + &#x27; — &#x27; + (b.u || &#x27;&#x27;), &#x27;📎 收藏連結 · &#x27; + (b.tag || &#x27;&#x27;), &#x27;library&#x27;, &#x27;ly&#x27;); });
  LS.get(&#x27;docs&#x27;, []).forEach(function (d) { push((d.n || &#x27;&#x27;) + &#x27; — &#x27; + (d.loc || &#x27;&#x27;), &#x27;📂 文檔位置&#x27;, &#x27;library&#x27;, &#x27;ly&#x27;); });
  LS.get(&#x27;interns&#x27;, []).forEach(function (s) { push((s.pos || &#x27;&#x27;) + &#x27; · &#x27; + (s.co || &#x27;&#x27;), &#x27;💼 實習記錄&#x27;, &#x27;wie&#x27;, &#x27;ly&#x27;); });
  LS.get(&#x27;funds&#x27;, []).forEach(function (f) { push(f.name || &#x27;&#x27;, &#x27;📑 資助申請 · &#x27; + (f.due ? fmtD(f.due) : &#x27;&#x27;), &#x27;funding&#x27;, &#x27;ly&#x27;); });
  LS.get(&#x27;bf_subjects&#x27;, []).forEach(function (s) { push((s.code || &#x27;&#x27;) + &#x27; &#x27; + (s.name || &#x27;&#x27;), &quot;📚 Austin 科目 · &quot; + (s.status || &#x27;&#x27;), &#x27;bf_subjects&#x27;, &#x27;bf&#x27;); });
  LS.get(&#x27;bf_timeline_custom&#x27;, []).forEach(function (x) { push(x.t, &#x27;⏰ Austin 自訂倒數 · &#x27; + fmtD(x.d), &#x27;bf_timeline&#x27;, &#x27;bf&#x27;); });
  getDl(&#x27;ly&#x27;).forEach(function (x) { push(x.t, &#x27;🗓 固定日程 · &#x27; + fmtD(x.d), &#x27;calendar&#x27;, &#x27;ly&#x27;); });
  getDl(&#x27;bf&#x27;).forEach(function (x) { push(x.t, &#x27;🗓 固定日程 · &#x27; + fmtD(x.d), &#x27;bf_timeline&#x27;, &#x27;bf&#x27;); });
  return out;
}
function initSearch() {
  var inp = $id(&#x27;gsearchInput&#x27;), drop = $id(&#x27;gsearchDrop&#x27;);
  if (!inp || !drop) return;
  inp.addEventListener(&#x27;input&#x27;, debounce(function () {
    var q = inp.value.trim().toLowerCase();
    if (!q) { drop.hidden = true; drop.innerHTML = &#x27;&#x27;; return; }
    var hits = collectSearchItems().filter(function (x) { return x.kw.indexOf(q) &gt;= 0; }).slice(0, 12);
    drop.innerHTML = hits.length
      ? hits.map(function (x, i) {
          return &#x27;&lt;div class=&quot;gs-item&quot; data-i=&quot;&#x27; + i + &#x27;&quot; data-acct=&quot;&#x27; + x.acct + &#x27;&quot; data-page=&quot;&#x27; + x.page + &#x27;&quot;&gt;&#x27; +
                 &#x27;&lt;div class=&quot;gs-t&quot;&gt;&#x27; + esc(x.text) + &#x27;&lt;/div&gt;&lt;div class=&quot;gs-s&quot;&gt;&#x27; + esc(x.sub) + &#x27; · &#x27; + (x.acct === &#x27;bf&#x27; ? &#x27;男友帳號&#x27; : &#x27;我的帳號&#x27;) + &#x27;&lt;/div&gt;&lt;/div&gt;&#x27;;
        }).join(&#x27;&#x27;)
      : &#x27;&lt;div class=&quot;gs-empty&quot;&gt;找不到與「&#x27; + esc(inp.value.trim()) + &#x27;」相關的內容&lt;/div&gt;&#x27;;
    drop.hidden = false;
    $qa(&#x27;.gs-item&#x27;, drop).forEach(function (el) {
      el.onclick = function () {
        if (el.getAttribute(&#x27;data-acct&#x27;) !== ACCT) switchAcct(el.getAttribute(&#x27;data-acct&#x27;));
        goPage(el.getAttribute(&#x27;data-page&#x27;));
        drop.hidden = true; inp.value = &#x27;&#x27;; inp.blur();
      };
    });
  }, 160));
  inp.addEventListener(&#x27;focus&#x27;, function () { if (inp.value.trim()) inp.dispatchEvent(new Event(&#x27;input&#x27;)); });
  inp.addEventListener(&#x27;keydown&#x27;, function (e) { if (e.key === &#x27;Escape&#x27;) { drop.hidden = true; inp.blur(); } });
  document.addEventListener(&#x27;click&#x27;, function (e) {
    var w = $id(&#x27;gsearchWrap&#x27;);
    if (w &amp;&amp; !w.contains(e.target)) drop.hidden = true;
  });
}

/* ---- 4. D-Day 重大節點倒數 ---- */
FIX.ddayLy = [
  { icon: &#x27;📚&#x27;, t: &#x27;正式選科結束&#x27;, d: &#x27;2026-08-25&#x27; },
  { icon: &#x27;🚨&#x27;, t: &#x27;WIE 學分轉移截止&#x27;, d: &#x27;2026-08-31&#x27; },
  { icon: &#x27;🏫&#x27;, t: &#x27;Sem 1 開課&#x27;, d: &#x27;2026-08-31&#x27; },
  { icon: &#x27;✈️&#x27;, t: &#x27;交換計劃申請截止&#x27;, d: &#x27;2026-09-03&#x27; },
  { icon: &#x27;💬&#x27;, t: &#x27;交換計劃面試&#x27;, d: &#x27;2026-09-07&#x27; },
  { icon: &#x27;📑&#x27;, t: &#x27;TSFS / NLSFT 截止&#x27;, d: &#x27;2026-09-25&#x27; },
  { icon: &#x27;🎓&#x27;, t: &#x27;CUHK 碩士優先輪（約）&#x27;, d: &#x27;2026-12-01&#x27; }
];
/* 🆕 v2.3.6：Austin 的 D-Day 出廠預設 */
FIX.ddayBf = [
  { icon: &#x27;🏫&#x27;, t: &#x27;HKCC Year 2 開學&#x27;,          d: &#x27;2026-09-07&#x27; },
  { icon: &#x27;📝&#x27;, t: &#x27;PolyU Non-JUPAS 開放申請&#x27;,   d: &#x27;2026-09-28&#x27; },
  { icon: &#x27;📝&#x27;, t: &#x27;CityU 開放申請&#x27;,             d: &#x27;2026-10-01&#x27; },
  { icon: &#x27;🗣&#x27;, t: &#x27;IELTS 應考（目標）&#x27;,         d: &#x27;2026-12-20&#x27; },
  { icon: &#x27;🚨&#x27;, t: &#x27;PolyU Non-JUPAS 截止&#x27;,       d: &#x27;2027-01-15&#x27; },
  { icon: &#x27;🚨&#x27;, t: &#x27;CityU Non-JUPAS 截止&#x27;,       d: &#x27;2027-01-15&#x27; }
];
function renderDDay() {
  function ddayHtml(list) {
    var items = list.map(function (x) { return { icon: x.icon, t: x.t, d: x.d, n: daysUntil(x.d) }; })
      .filter(function (x) { return x.n != null &amp;&amp; x.n &gt;= 0; })
      .sort(function (a, b) { return a.n - b.n; })
      .slice(0, 6);
    return items.length
      ? items.map(function (x) {
          return &#x27;&lt;div class=&quot;dday-card&#x27; + (x.n &lt;= 7 ? &#x27; urg&#x27; : &#x27;&#x27;) + &#x27;&quot; title=&quot;&#x27; + esc(x.t) + &#x27;&quot;&gt;&#x27; +
                 &#x27;&lt;div class=&quot;dday-icon&quot;&gt;&#x27; + x.icon + &#x27;&lt;/div&gt;&#x27; +
                 &#x27;&lt;div class=&quot;dday-num&quot;&gt;&#x27; + (x.n === 0 ? &#x27;今&#x27; : x.n) + &#x27;&lt;/div&gt;&#x27; +
                 &#x27;&lt;div class=&quot;dday-lbl&quot;&gt;天&lt;/div&gt;&#x27; +
                 &#x27;&lt;div class=&quot;dday-t&quot;&gt;&#x27; + esc(x.t) + &#x27;&lt;/div&gt;&#x27; +
                 &#x27;&lt;div class=&quot;dday-d&quot;&gt;&#x27; + fmtD(x.d) + &#x27;&lt;/div&gt;&lt;/div&gt;&#x27;;
        }).join(&#x27;&#x27;)
      : &#x27;&lt;div class=&quot;empty-tip&quot;&gt;目前沒有未來的重大節點 🎉&lt;/div&gt;&#x27;;
  }
  var b1 = $id(&#x27;ddayRow&#x27;);   if (b1) b1.innerHTML = ddayHtml(getDd(&#x27;ly&#x27;));
  var b2 = $id(&#x27;bfDdayRow&#x27;); if (b2) b2.innerHTML = ddayHtml(getDd(&#x27;bf&#x27;));
}

/* ---- 5. 月曆總覽 ---- */
var CALYM = null; /* 當前顯示年月 &#x27;YYYY-MM&#x27; */
function calEventsAll() {
  var ev = [];
  getDl(&#x27;ly&#x27;).forEach(function (x) { ev.push({ d: x.d, t: x.t, src: &#x27;🗓 學校日程&#x27; }); });
  LS.get(&#x27;todos&#x27;, []).forEach(function (t) { if (t.due &amp;&amp; !t.done) ev.push({ d: t.due, t: &#x27;📋 &#x27; + t.t, src: &#x27;✅ 待辦 · &#x27; + (t.cat || &#x27;&#x27;) }); });
  LS.get(&#x27;funds&#x27;, []).forEach(function (f) { if (f.due) ev.push({ d: f.due, t: &#x27;📑 &#x27; + (f.name || &#x27;資助申請&#x27;), src: &#x27;資助截止&#x27; }); });
  LS.get(&#x27;jobs&#x27;, []).forEach(function (j) { if (j.int) ev.push({ d: j.int, t: &#x27;💼 面試 · &#x27; + (j.co || &#x27;&#x27;) + &#x27; &#x27; + (j.pos || &#x27;&#x27;), src: &#x27;求職面試&#x27; }); });
  return ev;
}
function shiftYM(ym, delta) {
  var y = +ym.slice(0, 4), m = +ym.slice(5, 7) + delta;
  if (m &lt; 1) { m = 12; y--; }
  if (m &gt; 12) { m = 1; y++; }
  return y + &#x27;-&#x27; + pad2(m);
}
function calDateTitle(ds) {
  var p = String(ds).split(&#x27;-&#x27;).map(Number);
  var d = new Date(p[0], p[1] - 1, p[2]);
  return (p[0]) + &#x27;/&#x27; + (p[1]) + &#x27;/&#x27; + (p[2]) + &#x27;（週&#x27; + WEEK_ZH[d.getDay()] + &#x27;）&#x27;;
}
function renderCalendar(ym) {
  var grid = $id(&#x27;calGrid&#x27;);
  if (!grid) return;
  if (!ym) ym = CALYM || todayStr().slice(0, 7);
  CALYM = ym;
  var y = +ym.slice(0, 4), m = +ym.slice(5, 7);
  var startDow = new Date(y, m - 1, 1).getDay(); /* 0 = 週日 */
  var daysInMonth = new Date(y, m, 0).getDate();
  var evs = {};
  calEventsAll().forEach(function (e) { (evs[e.d] = evs[e.d] || []).push(e); });
  var html = WEEK_ZH.map(function (w) { return &#x27;&lt;div class=&quot;cal-dow&quot;&gt;&#x27; + w + &#x27;&lt;/div&gt;&#x27;; }).join(&#x27;&#x27;);
  var i;
  for (i = 0; i &lt; startDow; i++) html += &#x27;&lt;div class=&quot;cal-cell mute&quot;&gt;&lt;/div&gt;&#x27;;
  var today = todayStr();
  for (var d = 1; d &lt;= daysInMonth; d++) {
    var ds = y + &#x27;-&#x27; + pad2(m) + &#x27;-&#x27; + pad2(d);
    var list = evs[ds] || [];
    var urg = list.some(function (e) { return e.t.indexOf(&#x27;🚨&#x27;) &gt;= 0 || e.t.indexOf(&#x27;截止&#x27;) &gt;= 0; });
    html += &#x27;&lt;div class=&quot;cal-cell&#x27; + (ds === today ? &#x27; today&#x27; : &#x27;&#x27;) + &#x27;&quot; data-d=&quot;&#x27; + ds + &#x27;&quot; title=&quot;&#x27; + esc(list.map(function (e) { return e.t; }).join(&#x27;\n&#x27;)) + &#x27;&quot;&gt;&#x27; +
            &#x27;&lt;span class=&quot;cal-dnum&quot;&gt;&#x27; + d + &#x27;&lt;/span&gt;&#x27; +
            (list.length ? &#x27;&lt;span class=&quot;cal-dot&#x27; + (urg ? &#x27; urg&#x27; : &#x27;&#x27;) + &#x27;&quot;&gt;&lt;/span&gt;&lt;span class=&quot;cal-cnt&quot;&gt;&#x27; + list.length + &#x27;&lt;/span&gt;&#x27; : &#x27;&#x27;) +
            &#x27;&lt;/div&gt;&#x27;;
  }
  grid.innerHTML = html;
  if ($id(&#x27;calTitle&#x27;)) $id(&#x27;calTitle&#x27;).textContent = y + &#x27; 年 &#x27; + m + &#x27; 月&#x27;;
  $qa(&#x27;#calGrid .cal-cell[data-d]&#x27;).forEach(function (c) {
    c.onclick = function () {
      $qa(&#x27;#calGrid .cal-cell&#x27;).forEach(function (x) { x.classList.remove(&#x27;sel&#x27;); });
      c.classList.add(&#x27;sel&#x27;);
      renderCalDay(c.getAttribute(&#x27;data-d&#x27;));
    };
  });
  renderCalUpcoming();
}
function renderCalDay(ds) {
  var box = $id(&#x27;calDayList&#x27;);
  if (!box) return;
  if ($id(&#x27;calDayTitle&#x27;)) $id(&#x27;calDayTitle&#x27;).textContent = calDateTitle(ds);
  var evs = calEventsAll().filter(function (e) { return e.d === ds; });
  box.innerHTML = evs.length
    ? evs.map(function (e) {
        return &#x27;&lt;div class=&quot;plan-item&quot;&gt;&lt;div&gt;&lt;div class=&quot;p-title&quot;&gt;&#x27; + esc(e.t) + &#x27;&lt;/div&gt;&lt;div class=&quot;p-sub&quot;&gt;&#x27; + esc(e.src) + &#x27;&lt;/div&gt;&lt;/div&gt;&#x27; +
               &#x27;&lt;div class=&quot;p-right&quot;&gt;&lt;span class=&quot;p-badge &#x27; + urgencyInfo(ds).cls + &#x27;&quot;&gt;&#x27; + daysBadge(ds) + &#x27;&lt;/span&gt;&lt;/div&gt;&lt;/div&gt;&#x27;;
      }).join(&#x27;&#x27;)
    : &#x27;&lt;div class=&quot;empty-tip&quot;&gt;此日沒有事項&lt;/div&gt;&#x27;;
}
function renderCalUpcoming() {
  var box = $id(&#x27;calUpcoming&#x27;);
  if (!box) return;
  var all = calEventsAll().map(function (e) { e.n = daysUntil(e.d); return e; })
    .filter(function (e) { return e.n != null &amp;&amp; e.n &gt;= 0 &amp;&amp; e.n &lt;= 30; })
    .sort(function (a, b) { return a.n - b.n; });
  box.innerHTML = all.length
    ? all.map(function (e) {
        var u = urgencyInfo(e.d);
        return &#x27;&lt;div class=&quot;plan-item&quot;&gt;&lt;div&gt;&lt;div class=&quot;p-title&quot;&gt;&#x27; + esc(e.t) + &#x27;&lt;/div&gt;&lt;div class=&quot;p-sub&quot;&gt;&#x27; + esc(e.src) + &#x27; · &#x27; + fmtD(e.d) + &#x27;&lt;/div&gt;&lt;/div&gt;&#x27; +
               &#x27;&lt;div class=&quot;p-right&quot;&gt;&lt;span class=&quot;p-badge &#x27; + u.cls + &#x27;&quot;&gt;&#x27; + u.label + &#x27;&lt;/span&gt;&lt;/div&gt;&lt;/div&gt;&#x27;;
      }).join(&#x27;&#x27;)
    : &#x27;&lt;div class=&quot;empty-tip&quot;&gt;未來 30 日內沒有待辦事項 🎉&lt;/div&gt;&#x27;;
}
function initCalendar() {
  var prev = $id(&#x27;calPrev&#x27;), next = $id(&#x27;calNext&#x27;), todayBtn = $id(&#x27;calToday&#x27;);
  if (prev) prev.onclick = function () { renderCalendar(shiftYM(CALYM || todayStr().slice(0, 7), -1)); };
  if (next) next.onclick = function () { renderCalendar(shiftYM(CALYM || todayStr().slice(0, 7), 1)); };
  if (todayBtn) todayBtn.onclick = function () {
    renderCalendar(todayStr().slice(0, 7));
    var td = $qa(&#x27;#calGrid .cal-cell&#x27;).filter(function (c) { return c.getAttribute(&#x27;data-d&#x27;) === todayStr(); })[0];
    if (td) td.click(); else renderCalDay(todayStr());
  };
}

/* ---- 6. GPA 計算器（Austin · 4.3 制） ---- */
var GPASCALE = { &#x27;A+&#x27;: 4.3, &#x27;A&#x27;: 4.0, &#x27;A-&#x27;: 3.7, &#x27;B+&#x27;: 3.3, &#x27;B&#x27;: 3.0, &#x27;B-&#x27;: 2.7, &#x27;C+&#x27;: 2.3, &#x27;C&#x27;: 2.0, &#x27;C-&#x27;: 1.7, &#x27;D&#x27;: 1.0, &#x27;F&#x27;: 0 };
function updateGpaResult() {
  var rows = LS.get(&#x27;bf_gpacalc&#x27;, []);
  var totalCr = 0, totalPt = 0, has = false;
  rows.forEach(function (r) {
    var cr = +r.cr;
    if (cr &gt; 0 &amp;&amp; GPASCALE[r.g] != null) { totalCr += cr; totalPt += cr * GPASCALE[r.g]; has = true; }
  });
  var gpa = totalCr ? (totalPt / totalCr).toFixed(2) : null;
  if ($id(&#x27;gpaResult&#x27;)) $id(&#x27;gpaResult&#x27;).innerHTML = has ? &#x27;&lt;b&gt;&#x27; + gpa + &#x27;&lt;/b&gt; / 4.3 &lt;span style=&quot;font-size:12px;color:var(--mut)&quot;&gt;（&#x27; + totalCr + &#x27; 學分加權）&lt;/span&gt;&#x27; : &#x27;— / 4.3&#x27;;
  if ($id(&#x27;gpaHint&#x27;)) {
    var h = &#x27;加入科目後自動計算加權 GPA&#x27;;
    if (has) {
      var g = +gpa;
      h = g &gt;= 3.8 ? &#x27;🌟 保持這水平 — 衝刺課程（Computing &amp; AI 等）也穩！&#x27;
        : g &gt;= 3.5 ? &#x27;👍 不錯 — 距 3.8 還差 &#x27; + (3.8 - g).toFixed(2) + &#x27;，約每科升一級&#x27;
        : &#x27;💪 加把勁 — 多修高學分必修科並衝 A / A+&#x27;;
    }
    $id(&#x27;gpaHint&#x27;).textContent = h;
  }
}
function renderGpaCalc() {
  var box = $id(&#x27;gpaRows&#x27;);
  if (!box) return;
  var rows = LS.get(&#x27;bf_gpacalc&#x27;, []);
  box.innerHTML = rows.length
    ? rows.map(function (r, i) {
        var opts = Object.keys(GPASCALE).map(function (g) { return &#x27;&lt;option value=&quot;&#x27; + g + &#x27;&quot;&#x27; + (r.g === g ? &#x27; selected&#x27; : &#x27;&#x27;) + &#x27;&gt;&#x27; + g + &#x27;&lt;/option&gt;&#x27;; }).join(&#x27;&#x27;);
        return &#x27;&lt;div class=&quot;gpa-row&quot;&gt;&#x27; +
               &#x27;&lt;input value=&quot;&#x27; + esc(r.n || &#x27;&#x27;) + &#x27;&quot; placeholder=&quot;科目（例：STA2011）&quot; data-gi=&quot;&#x27; + i + &#x27;&quot; data-gf=&quot;n&quot; /&gt;&#x27; +
               &#x27;&lt;input type=&quot;number&quot; min=&quot;0&quot; max=&quot;9&quot; step=&quot;0.5&quot; value=&quot;&#x27; + (r.cr != null &amp;&amp; r.cr !== &#x27;&#x27; ? r.cr : &#x27;&#x27;) + &#x27;&quot; placeholder=&quot;學分&quot; data-gi=&quot;&#x27; + i + &#x27;&quot; data-gf=&quot;cr&quot; /&gt;&#x27; +
               &#x27;&lt;select data-gi=&quot;&#x27; + i + &#x27;&quot; data-gf=&quot;g&quot;&gt;&#x27; + opts + &#x27;&lt;/select&gt;&#x27; +
               &#x27;&lt;button class=&quot;row-del&quot; data-gdel=&quot;&#x27; + i + &#x27;&quot; title=&quot;刪除&quot;&gt;🗑&lt;/button&gt;&lt;/div&gt;&#x27;;
      }).join(&#x27;&#x27;)
    : &#x27;&lt;div class=&quot;empty-tip&quot;&gt;尚未加入科目 — 點「＋ 新增科目」開始模擬&lt;/div&gt;&#x27;;
  $qa(&#x27;#gpaRows [data-gi]&#x27;).forEach(function (el) {
    var handler = function () {
      var rows2 = LS.get(&#x27;bf_gpacalc&#x27;, []);
      var i2 = +el.getAttribute(&#x27;data-gi&#x27;), f = el.getAttribute(&#x27;data-gf&#x27;);
      rows2[i2][f] = el.value;
      LS.set(&#x27;bf_gpacalc&#x27;, rows2);
      if (el.tagName === &#x27;SELECT&#x27;) renderGpaCalc(); else updateGpaResult();
    };
    if (el.tagName === &#x27;SELECT&#x27;) el.addEventListener(&#x27;change&#x27;, handler);
    else el.addEventListener(&#x27;input&#x27;, debounce(handler, 300));
  });
  $qa(&#x27;#gpaRows [data-gdel]&#x27;).forEach(function (b) {
    b.onclick = function () {
      var rows2 = LS.get(&#x27;bf_gpacalc&#x27;, []);
      rows2.splice(+b.getAttribute(&#x27;data-gdel&#x27;), 1);
      LS.set(&#x27;bf_gpacalc&#x27;, rows2);
      renderGpaCalc();
    };
  });
  updateGpaResult();
}
function initGpaCalc() {
  var add = $id(&#x27;addGpaRowBtn&#x27;);
  if (!add) return;
  add.onclick = function () {
    var rows = LS.get(&#x27;bf_gpacalc&#x27;, []);
    rows.push({ n: &#x27;&#x27;, cr: &#x27;&#x27;, g: &#x27;A&#x27; });
    LS.set(&#x27;bf_gpacalc&#x27;, rows);
    renderGpaCalc();
  };
}

/* ---- 7. 簡歷列印 / 存 PDF ---- */
function initPrintResume() {
  var b = $id(&#x27;printResumeBtn&#x27;);
  if (!b) return;
  b.onclick = function () {
    var txt = ($id(&#x27;resumeOut&#x27;) || {}).value || &#x27;&#x27;;
    if (!txt.trim()) { toast(&#x27;請先生成簡歷再列印&#x27;); return; }
    var w = window.open(&#x27;&#x27;, &#x27;_blank&#x27;);
    if (!w) { toast(&#x27;請允許彈出視窗以使用列印功能&#x27;); return; }
    var safe = txt.replace(/[&amp;&lt;&gt;]/g, function (c) { return { &#x27;&amp;&#x27;: &#x27;&amp;amp;&#x27;, &#x27;&lt;&#x27;: &#x27;&amp;lt;&#x27;, &#x27;&gt;&#x27;: &#x27;&amp;gt;&#x27; }[c]; });
    w.document.write(&#x27;&lt;html&gt;&lt;head&gt;&lt;meta charset=&quot;utf-8&quot;&gt;&lt;title&gt;Resume — Lok Yi Chan&lt;/title&gt;&#x27; +
      &#x27;&lt;style&gt;body{font-family:Arial,&quot;Noto Sans TC&quot;,sans-serif;white-space:pre-wrap;padding:36px 40px;font-size:13px;line-height:1.75;color:#111}@media print{body{padding:16px 8px}}&lt;/style&gt;&#x27; +
      &#x27;&lt;/head&gt;&lt;body&gt;&#x27; + safe + &#x27;&lt;/body&gt;&lt;/html&gt;&#x27;);
    w.document.close();
    setTimeout(function () { try { w.focus(); w.print(); } catch (e) {} }, 350);
  };
}

/* ============================================================
   🆕 v2.2 新功能：內容管理中心 + GitHub Gist 跨裝置雲同步
   ============================================================ */

/* ---- 固定內容覆蓋機制（出廠預設 ←→ App 內編輯） ---- */
/* ---- 固定內容覆蓋機制（🆕 v2.3.6：按賬號獨立 · 出廠預設 ←→ App 內編輯）---- */
/* 出廠預設：FIX.lyDeadlines / FIX.bfDeadlines / FIX.ddayLy / FIX.ddayBf 保持原樣（永遠是預設值，不再被覆蓋） */
function dlKey()  { return ACCT === &#x27;bf&#x27; ? &#x27;bf_fix_dl&#x27;       : &#x27;fix_dl&#x27;; }
function ddKey()  { return ACCT === &#x27;bf&#x27; ? &#x27;bf_fix_dday&#x27;     : &#x27;fix_dday&#x27;; }
function annKey() { return ACCT === &#x27;bf&#x27; ? &#x27;bf_announcement&#x27; : &#x27;announcement&#x27;; }
/* getDl(acct)/getDd(acct)：讀指定賬號的生效列表；無編輯記錄時回落出廠預設 */
function getDl(acct) {
  acct = acct || ACCT;
  var v = LS.get(acct === &#x27;bf&#x27; ? &#x27;bf_fix_dl&#x27; : &#x27;fix_dl&#x27;, null);
  return (v &amp;&amp; typeof v.length === &#x27;number&#x27; &amp;&amp; v.length) ? v : (acct === &#x27;bf&#x27; ? FIX.bfDeadlines : FIX.lyDeadlines);
}
function getDd(acct) {
  acct = acct || ACCT;
  var v = LS.get(acct === &#x27;bf&#x27; ? &#x27;bf_fix_dday&#x27; : &#x27;fix_dday&#x27;, null);
  return (v &amp;&amp; typeof v.length === &#x27;number&#x27; &amp;&amp; v.length) ? v : (acct === &#x27;bf&#x27; ? FIX.ddayBf : FIX.ddayLy);
}
function getAnn(acct) { return LS.get((acct || ACCT) === &#x27;bf&#x27; ? &#x27;bf_announcement&#x27; : &#x27;announcement&#x27;, &#x27;&#x27;); }
function saveDl(list) { LS.set(dlKey(), list); }
function saveDd(list) { LS.set(ddKey(), list); }

/* ---- 公告 ---- */
function renderAnnouncement() {
  var c1 = $id(&#x27;annCard&#x27;), b1 = $id(&#x27;annBox&#x27;);
  if (c1 &amp;&amp; b1) { var v1 = getAnn(&#x27;ly&#x27;); b1.textContent = v1; c1.hidden = !v1.trim(); }
  var c2 = $id(&#x27;bfAnnCard&#x27;), b2 = $id(&#x27;bfAnnBox&#x27;);
  if (c2 &amp;&amp; b2) { var v2 = getAnn(&#x27;bf&#x27;); b2.textContent = v2; c2.hidden = !v2.trim(); }
}

/* ---- 內容管理：日程編輯器 ---- */
function renderCmDl() {
  var box = $id(&#x27;cmDlRows&#x27;);
  if (!box) return;
  var list = getDl(ACCT);
  box.innerHTML = list.length ? list.map(function (x, i) {
    return &#x27;&lt;div class=&quot;cm-row&quot;&gt;&#x27; +
      &#x27;&lt;input value=&quot;&#x27; + esc(x.t) + &#x27;&quot; data-ci=&quot;&#x27; + i + &#x27;&quot; data-cf=&quot;t&quot; data-ck=&quot;dl&quot; placeholder=&quot;標題&quot; /&gt;&#x27; +
      &#x27;&lt;input type=&quot;date&quot; value=&quot;&#x27; + esc(x.d) + &#x27;&quot; data-ci=&quot;&#x27; + i + &#x27;&quot; data-cf=&quot;d&quot; data-ck=&quot;dl&quot; /&gt;&#x27; +
      &#x27;&lt;button class=&quot;row-del&quot; data-cdel=&quot;&#x27; + i + &#x27;&quot; data-ck=&quot;dl&quot; title=&quot;刪除&quot;&gt;🗑&lt;/button&gt;&lt;/div&gt;&#x27;;
  }).join(&#x27;&#x27;) : &#x27;&lt;div class=&quot;empty-tip&quot;&gt;暫無日程 — 於下方新增&lt;/div&gt;&#x27;;
  bindCmRows(box, &#x27;dl&#x27;, function (list2) { saveDl(list2); renderAll(); });
}
/* ---- 內容管理：D-Day 編輯器 ---- */
function renderCmDd() {
  var box = $id(&#x27;cmDdRows&#x27;);
  if (!box) return;
  var list = getDd(ACCT);
  box.innerHTML = list.length ? list.map(function (x, i) {
    return &#x27;&lt;div class=&quot;cm-row cm-row-dd&quot;&gt;&#x27; +
      &#x27;&lt;input value=&quot;&#x27; + esc(x.icon) + &#x27;&quot; data-ci=&quot;&#x27; + i + &#x27;&quot; data-cf=&quot;icon&quot; data-ck=&quot;dd&quot; placeholder=&quot;🎯&quot; /&gt;&#x27; +
      &#x27;&lt;input value=&quot;&#x27; + esc(x.t) + &#x27;&quot; data-ci=&quot;&#x27; + i + &#x27;&quot; data-cf=&quot;t&quot; data-ck=&quot;dd&quot; placeholder=&quot;標題&quot; /&gt;&#x27; +
      &#x27;&lt;input type=&quot;date&quot; value=&quot;&#x27; + esc(x.d) + &#x27;&quot; data-ci=&quot;&#x27; + i + &#x27;&quot; data-cf=&quot;d&quot; data-ck=&quot;dd&quot; /&gt;&#x27; +
      &#x27;&lt;button class=&quot;row-del&quot; data-cdel=&quot;&#x27; + i + &#x27;&quot; data-ck=&quot;dd&quot; title=&quot;刪除&quot;&gt;🗑&lt;/button&gt;&lt;/div&gt;&#x27;;
  }).join(&#x27;&#x27;) : &#x27;&lt;div class=&quot;empty-tip&quot;&gt;暫無 D-Day 節點&lt;/div&gt;&#x27;;
  bindCmRows(box, &#x27;dd&#x27;, function (list2) { saveDd(list2); renderDDay(); });
}
function bindCmRows(box, kind, afterSave) {
  $qa(&#x27;input[data-ci]&#x27;, box).forEach(function (inp) {
    var h = function () {
      var list2 = JSON.parse(JSON.stringify(kind === &#x27;dl&#x27; ? getDl(ACCT) : getDd(ACCT)));
      var i = +inp.getAttribute(&#x27;data-ci&#x27;);
      list2[i][inp.getAttribute(&#x27;data-cf&#x27;)] = inp.value;
      if (kind === &#x27;dl&#x27;) saveDl(list2); else saveDd(list2);
      afterSave();
    };
    inp.addEventListener(&#x27;change&#x27;, h);
  });
  $qa(&#x27;[data-cdel]&#x27;, box).forEach(function (b) {
    b.onclick = function () {
      var k = b.getAttribute(&#x27;data-ck&#x27;);
      var list2 = JSON.parse(JSON.stringify(k === &#x27;dl&#x27; ? getDl(ACCT) : getDd(ACCT)));
      list2.splice(+b.getAttribute(&#x27;data-cdel&#x27;), 1);
      if (k === &#x27;dl&#x27;) saveDl(list2); else saveDd(list2);
      if (k === &#x27;dl&#x27;) renderAll(); else renderDDay();
      if (k === &#x27;dl&#x27;) renderCmDl(); else renderCmDd();
    };
  });
}
function initContent() {
  if ($id(&#x27;annSaveBtn&#x27;)) $id(&#x27;annSaveBtn&#x27;).onclick = function () {
    LS.set(annKey(), ($id(&#x27;annText&#x27;) || {}).value || &#x27;&#x27;);
    renderAnnouncement(); toast(&#x27;公告已儲存 ✓&#x27;);
  };
  if ($id(&#x27;annClearBtn&#x27;)) $id(&#x27;annClearBtn&#x27;).onclick = function () {
    LS.set(annKey(), &#x27;&#x27;);
    if ($id(&#x27;annText&#x27;)) $id(&#x27;annText&#x27;).value = &#x27;&#x27;;
    renderAnnouncement(); toast(&#x27;公告已清除&#x27;);
  };
  if ($id(&#x27;annText&#x27;)) { $id(&#x27;annText&#x27;).value = getAnn(ACCT); }
  if ($id(&#x27;cmDlAddBtn&#x27;)) $id(&#x27;cmDlAddBtn&#x27;).onclick = function () {
    var t = $id(&#x27;cmDlTitle&#x27;).value.trim(), d = $id(&#x27;cmDlDate&#x27;).value;
    if (!t || !d) { toast(&#x27;請填寫標題和日期&#x27;); return; }
    var list2 = JSON.parse(JSON.stringify(getDl(ACCT)));
    list2.push({ t: t, d: d });
    saveDl(list2);
    $id(&#x27;cmDlTitle&#x27;).value = &#x27;&#x27;; $id(&#x27;cmDlDate&#x27;).value = &#x27;&#x27;;
    renderAll(); renderCmDl(); toast(&#x27;已新增日程 ✓&#x27;);
  };
  if ($id(&#x27;cmDdAddBtn&#x27;)) $id(&#x27;cmDdAddBtn&#x27;).onclick = function () {
    var ic = ($id(&#x27;cmDdIcon&#x27;).value.trim() || &#x27;🎯&#x27;), t = $id(&#x27;cmDdTitle&#x27;).value.trim(), d = $id(&#x27;cmDdDate&#x27;).value;
    if (!t || !d) { toast(&#x27;請填寫標題和日期&#x27;); return; }
    var list2 = JSON.parse(JSON.stringify(getDd(ACCT)));
    list2.push({ icon: ic, t: t, d: d });
    saveDd(list2);
    $id(&#x27;cmDdIcon&#x27;).value = &#x27;&#x27;; $id(&#x27;cmDdTitle&#x27;).value = &#x27;&#x27;; $id(&#x27;cmDdDate&#x27;).value = &#x27;&#x27;;
    renderDDay(); renderCmDd(); toast(&#x27;已新增 D-Day 節點 ✓&#x27;);
  };
  if ($id(&#x27;cmResetFixBtn&#x27;)) $id(&#x27;cmResetFixBtn&#x27;).onclick = function () {
    showConfirm(&#x27;確定還原「&#x27; + (ACCT === &#x27;bf&#x27; ? &#x27;Austin&#x27; : &#x27;Lok Yi&#x27;) + &#x27;」的出廠日程 + D-Day 節點嗎？\n（你的其他資料：待辦、履歷、科目等全部保留）&#x27;).then(function (ok) {
      if (!ok) return;
      LS.del(dlKey()); LS.del(ddKey());
      renderAll(); renderCmDl(); renderCmDd(); renderDDay(); toast(&#x27;已還原預設內容 ✓&#x27;);
    });
  };
}
/* 🆕 v2.3.6：切賬號時重填內容管理編輯器（防止顯示舊賬號數據） */
function syncContentAdmin() {
  var el = $id(&#x27;annText&#x27;); if (el) el.value = getAnn(ACCT);
  renderCmDl(); renderCmDd();
}

/* ---- ☁️ GitHub Gist 跨裝置雲同步 ---- */
var GIST_FILE = &#x27;lyhub-data.json&#x27;;
function ghToken() { return LS.get(&#x27;gh_token&#x27;, &#x27;&#x27;); }
function gistId() { return LS.get(&#x27;gist_id&#x27;, &#x27;&#x27;); }
function syncPayload(changeMsg) {
  var data = {};
  LS.keys().forEach(function (k) {
    if (k === &#x27;notif_sent&#x27; || k === &#x27;gh_token&#x27; || k === &#x27;gist_id&#x27; || k === &#x27;__changelog&#x27; || k === &#x27;device_id&#x27;) return;
    if (k.indexOf(&#x27;__seen_&#x27;) === 0) return; /* 🆕 v2.3.5 上線偵測記錄，僅本機使用 */
    data[k] = LS.get(k, null);
  });
  data.__sync_time = new Date().toISOString();
  data.device_id = deviceId();
  if (changeMsg) {
    data.__changelog = { device: deviceLabel(), time: data.__sync_time, msg: changeMsg, dev_id: deviceId() };
  } else if (LS.get(&#x27;__changelog&#x27;, null)) {
    data.__changelog = LS.get(&#x27;__changelog&#x27;, null);
  }
  return data;
}
function deviceId() {
  var id = LS.get(&#x27;device_id&#x27;, &#x27;&#x27;);
  if (!id) { id = &#x27;dev_&#x27; + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); LS.set(&#x27;device_id&#x27;, id); }
  return id;
}
function deviceLabel() {
  var ua = navigator.userAgent;
  var isMobile = /Mobi|Android|iPhone|iPad/i.test(ua);
  var os = /iPhone|iPad/.test(ua) ? &#x27;iOS&#x27; : /Android/.test(ua) ? &#x27;Android&#x27; : /Mac/.test(ua) ? &#x27;Mac&#x27; : /Windows/.test(ua) ? &#x27;Windows&#x27; : &#x27;未知&#x27;;
  return os + (isMobile ? &#x27;手機&#x27; : &#x27;電腦&#x27;);
}
/* 🆕 v2.3.5 上線通知：presence.json 獨立文件（與主數據 lyhub-data.json 分開，互不覆蓋） */
var PRESENCE_FILE = &#x27;presence.json&#x27;;
function pushPresence() {
  if (!ghToken() || !gistId()) return;
  ghFetch(&#x27;GET&#x27;, &#x27;/gists/&#x27; + gistId()).then(function (g) {
    var pres = {};
    var f = g.files &amp;&amp; g.files[PRESENCE_FILE];
    if (f &amp;&amp; f.content) { try { pres = JSON.parse(f.content) || {}; } catch (e) { pres = {}; } }
    /* 清掉超過 1 天的舊記錄，保持文件小巧 */
    var dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    Object.keys(pres).forEach(function (did) {
      if (!pres[did] || Date.parse(pres[did].ts || &#x27;&#x27;) &lt; dayAgo) delete pres[did];
    });
    pres[deviceId()] = { label: deviceLabel(), ts: new Date().toISOString() };
    var body = { files: {} };
    body.files[PRESENCE_FILE] = { content: JSON.stringify(pres) };
    return ghFetch(&#x27;PATCH&#x27;, &#x27;/gists/&#x27; + gistId(), body);
  }).catch(function () { /* 靜默失敗：上線打卡失敗不影響使用 */ });
}
function checkPresence(g) {
  /* 輪詢時順便解析 presence.json：其他設備 5 分鐘內上線過 → 彈通知 */
  var f = g.files &amp;&amp; g.files[PRESENCE_FILE];
  if (!f || !f.content) return;
  var pres = null;
  try { pres = JSON.parse(f.content); } catch (e) { return; }
  if (!pres) return;
  var now = Date.now();
  Object.keys(pres).forEach(function (did) {
    if (did === deviceId()) return; /* 跳過自己 */
    var p = pres[did];
    var ts = p &amp;&amp; p.ts ? Date.parse(p.ts) : 0;
    if (!ts || now - ts &gt; 5 * 60 * 1000) return; /* 超過 5 分鐘不算「剛上線」 */
    var seenKey = &#x27;__seen_&#x27; + did;
    var seen = LS.get(seenKey, 0);
    if (typeof seen === &#x27;string&#x27;) seen = Date.parse(seen) || 0;
    if (ts &gt; seen) {
      LS.set(seenKey, new Date(ts).toISOString());
      var timeStr = new Date(ts).toLocaleTimeString(&#x27;zh-HK&#x27;, { hour: &#x27;2-digit&#x27;, minute: &#x27;2-digit&#x27; });
      addCrossDeviceNotif(p.label || &#x27;其他設備&#x27;, &#x27;剛剛上線 👋&#x27;, timeStr, true);
    }
  });
}
function applySyncData(data, silent) {
  if (!data || typeof data !== &#x27;object&#x27;) { toast(&#x27;❌ 雲端資料格式錯誤&#x27;); return false; }
  var remoteChange = data.__changelog || null;
  var remoteDevId = data.device_id || &#x27;&#x27;;
  delete data.__sync_time;
  delete data.__changelog;
  delete data.device_id;
  var keys = Object.keys(data);
  keys.forEach(function (k) { LS.set(k, data[k]); });
  LS.set(&#x27;__last_sync&#x27;, new Date().toISOString());
  if (remoteChange) LS.set(&#x27;__changelog&#x27;, remoteChange);
  if (!silent) toast(&#x27;✅ 已拉取 &#x27; + keys.length + &#x27; 項雲端資料，重新載入…&#x27;);
  /* 🆕 v2.3.3 跨設備變更通知：如果是其他設備的變更，彈通知 */
  if (remoteChange &amp;&amp; remoteDevId &amp;&amp; remoteDevId !== deviceId()) {
    var msg = remoteChange.msg || &#x27;Dashboard 已更新&#x27;;
    var devName = remoteChange.device || &#x27;其他設備&#x27;;
    var timeStr = remoteChange.time ? new Date(remoteChange.time).toLocaleTimeString(&#x27;zh-HK&#x27;, { hour: &#x27;2-digit&#x27;, minute: &#x27;2-digit&#x27; }) : &#x27;&#x27;;
    addCrossDeviceNotif(devName, msg, timeStr);
  }
  return true;
}
function addCrossDeviceNotif(devName, msg, timeStr, isOnline) {
  /* 寫入通知面板 */
  var log = LS.get(&#x27;cross_notifs&#x27;, []);
  log.unshift({ device: devName, msg: msg, time: timeStr, ts: Date.now(), online: !!isOnline });
  log = log.slice(0, 20);
  LS.set(&#x27;cross_notifs&#x27;, log);
  renderNotifs();
  /* 瀏覽器通知 */
  if (&#x27;Notification&#x27; in window &amp;&amp; Notification.permission === &#x27;granted&#x27;) {
    try {
      var title = isOnline ? &#x27;👋 &#x27; + devName + &#x27; 剛剛上線&#x27; : &#x27;📱 &#x27; + devName + &#x27; 更新了 Dashboard&#x27;;
      new Notification(title, { body: msg + (timeStr ? &#x27;（&#x27; + timeStr + &#x27;）&#x27; : &#x27;&#x27;), icon: &#x27;icons/icon-192.png&#x27;, tag: &#x27;cross_&#x27; + Date.now() });
    } catch (e) {}
  }
  toast((isOnline ? &#x27;👋 &#x27; : &#x27;📱 &#x27;) + devName + (isOnline ? &#x27;：剛剛上線&#x27; : &#x27; 更新了：&#x27; + msg));
}
function ghFetch(method, path, body) {
  return fetch(&#x27;https://api.github.com&#x27; + path, {
    method: method,
    headers: {
      &#x27;Authorization&#x27;: &#x27;token &#x27; + ghToken(),
      &#x27;Accept&#x27;: &#x27;application/vnd.github+json&#x27;,
      &#x27;Content-Type&#x27;: &#x27;application/json&#x27;
    },
    body: body ? JSON.stringify(body) : undefined
  }).then(function (r) {
    if (r.status === 401 || r.status === 403) throw new Error(&#x27;Token 無效或已過期（&#x27; + r.status + &#x27;）&#x27;);
    if (!r.ok) throw new Error(&#x27;GitHub API &#x27; + r.status);
    return r.json();
  });
}
function gistBody() {
  return { description: &#x27;Lok Yi Hub · 雲端資料備份（私密）&#x27;, public: false,
    files: {} };
}
function renderSyncStatus(msg) {
  var el = $id(&#x27;syncStatus&#x27;);
  if (!el) return;
  if (msg) { el.textContent = msg; return; }
  var parts = [];
  parts.push(ghToken() ? &#x27;🔑 Token：已設定&#x27; : &#x27;🔑 Token：未設定&#x27;);
  parts.push(gistId() ? &#x27;☁️ Gist：&#x27; + gistId() : &#x27;☁️ Gist：未建立&#x27;);
  var last = LS.get(&#x27;__last_sync&#x27;, &#x27;&#x27;);
  parts.push(&#x27;🕒 最後同步：&#x27; + (last ? last.replace(&#x27;T&#x27;, &#x27; &#x27;).slice(0, 16) : &#x27;從未&#x27;));
  el.textContent = parts.join(&#x27;  ·  &#x27;);
}
function initSync() {
  if ($id(&#x27;ghToken&#x27;)) $id(&#x27;ghToken&#x27;).value = ghToken() ? &#x27;·已設定（重新輸入可覆蓋）&#x27; : &#x27;&#x27;;
  if ($id(&#x27;gistIdInput&#x27;)) $id(&#x27;gistIdInput&#x27;).value = gistId();
  if ($id(&#x27;autoPullChk&#x27;)) {
    $id(&#x27;autoPullChk&#x27;).checked = !!LS.get(&#x27;auto_pull&#x27;, false);
    $id(&#x27;autoPullChk&#x27;).onchange = function () {
      LS.set(&#x27;auto_pull&#x27;, $id(&#x27;autoPullChk&#x27;).checked);
      toast($id(&#x27;autoPullChk&#x27;).checked ? &#x27;已開啟自動同步&#x27; : &#x27;已關閉自動同步&#x27;);
    };
  }
  if ($id(&#x27;ghTokenSaveBtn&#x27;)) $id(&#x27;ghTokenSaveBtn&#x27;).onclick = function () {
    var v = ($id(&#x27;ghToken&#x27;).value || &#x27;&#x27;).trim();
    if (!v || v.indexOf(&#x27;·已設定&#x27;) === 0) { toast(&#x27;Token 未變更&#x27;); return; }
    LS.set(&#x27;gh_token&#x27;, v);
    $id(&#x27;ghToken&#x27;).value = &#x27;·已設定（重新輸入可覆蓋）&#x27;;
    renderSyncStatus(); toast(&#x27;Token 已儲存 ✓&#x27;);
  };
  if ($id(&#x27;gistBindBtn&#x27;)) $id(&#x27;gistBindBtn&#x27;).onclick = function () {
    var v = ($id(&#x27;gistIdInput&#x27;).value || &#x27;&#x27;).trim();
    if (!v) { toast(&#x27;請輸入 Gist ID&#x27;); return; }
    LS.set(&#x27;gist_id&#x27;, v);
    renderSyncStatus(); toast(&#x27;已綁定 Gist ✓（可立即拉取）&#x27;);
  };
  if ($id(&#x27;gistCreateBtn&#x27;)) $id(&#x27;gistCreateBtn&#x27;).onclick = function () {
    if (!ghToken()) { toast(&#x27;請先儲存 GitHub Token&#x27;); return; }
    renderSyncStatus(&#x27;⏳ 正在建立雲端備份…&#x27;);
    var body = gistBody();
    body.files[GIST_FILE] = { content: JSON.stringify(syncPayload()) };
    ghFetch(&#x27;POST&#x27;, &#x27;/gists&#x27;, body).then(function (g) {
      LS.set(&#x27;gist_id&#x27;, g.id);
      LS.set(&#x27;__last_sync&#x27;, new Date().toISOString());
      if ($id(&#x27;gistIdInput&#x27;)) $id(&#x27;gistIdInput&#x27;).value = g.id;
      renderSyncStatus();
      toast(&#x27;🆕 雲端備份已建立，Gist ID：&#x27; + g.id);
    }).catch(function (e) { renderSyncStatus(); toast(&#x27;❌ &#x27; + e.message); });
  };
  if ($id(&#x27;gistPushBtn&#x27;)) $id(&#x27;gistPushBtn&#x27;).onclick = function () {
    if (!ghToken()) { toast(&#x27;請先儲存 GitHub Token&#x27;); return; }
    if (!gistId()) { toast(&#x27;尚未建立雲端備份，請先點「建立雲端備份」&#x27;); return; }
    renderSyncStatus(&#x27;⏳ 正在推送…&#x27;);
    var body = gistBody();
    body.files[GIST_FILE] = { content: JSON.stringify(syncPayload()) };
    ghFetch(&#x27;PATCH&#x27;, &#x27;/gists/&#x27; + gistId(), body).then(function () {
      LS.set(&#x27;__last_sync&#x27;, new Date().toISOString());
      renderSyncStatus(); toast(&#x27;⬆️ 已推送至雲端 ✓&#x27;);
    }).catch(function (e) { renderSyncStatus(); toast(&#x27;❌ &#x27; + e.message); });
  };
  if ($id(&#x27;gistPullBtn&#x27;)) $id(&#x27;gistPullBtn&#x27;).onclick = function () {
    if (!ghToken()) { toast(&#x27;請先儲存 GitHub Token&#x27;); return; }
    if (!gistId()) { toast(&#x27;請先綁定 Gist ID&#x27;); return; }
    renderSyncStatus(&#x27;⏳ 正在拉取…&#x27;);
    ghFetch(&#x27;GET&#x27;, &#x27;/gists/&#x27; + gistId()).then(function (g) {
      var f = g.files &amp;&amp; g.files[GIST_FILE];
      if (!f) { renderSyncStatus(); toast(&#x27;❌ 此 Gist 沒有 &#x27; + GIST_FILE); return; }
      var data = null;
      try { data = JSON.parse(f.content); } catch (e) {}
      if (!data) { renderSyncStatus(); toast(&#x27;❌ 雲端資料解析失敗&#x27;); return; }
      showConfirm(&#x27;拉取會覆蓋本機全部資料（以雲端為準）。\n確定繼續嗎？&#x27;).then(function (ok) {
        if (!ok) { renderSyncStatus(); return; }
        if (applySyncData(data)) setTimeout(function () { location.reload(); }, 800);
      });
    }).catch(function (e) { renderSyncStatus(); toast(&#x27;❌ &#x27; + e.message); });
  };
  renderSyncStatus();
  /* 🆕 v2.3.3 自動同步：啟動時 + 每 30 秒定時輪詢；🆕 v2.3.5 啟動時上線打卡 */
  if (LS.get(&#x27;auto_pull&#x27;, false) &amp;&amp; ghToken() &amp;&amp; gistId()) {
    pushPresence();
    autoPullCheck();
    setInterval(autoPullCheck, 30000);
    /* 每 5 分鐘刷新一次自己的上線時間（保持「在線」狀態） */
    setInterval(pushPresence, 5 * 60 * 1000);
  }
}
function autoPullCheck() {
  if (!LS.get(&#x27;auto_pull&#x27;, false) || !ghToken() || !gistId()) return;
  if (_autoSyncing) return; /* 正在推送中，跳過本次輪詢 */
  ghFetch(&#x27;GET&#x27;, &#x27;/gists/&#x27; + gistId()).then(function (g) {
    /* 🆕 v2.3.5 先檢查有沒有其他設備剛上線 */
    checkPresence(g);
    var f = g.files &amp;&amp; g.files[GIST_FILE];
    if (!f) return;
    var remote = null;
    try { remote = JSON.parse(f.content); } catch (e) { return; }
    var rt = remote &amp;&amp; remote.__sync_time ? Date.parse(remote.__sync_time) : 0;
    var lt = LS.get(&#x27;__last_sync&#x27;, &#x27;&#x27;) ? Date.parse(LS.get(&#x27;__last_sync&#x27;, &#x27;&#x27;)) : 0;
    if (rt &gt; lt) {
      var remoteDevId = remote.device_id || &#x27;&#x27;;
      var isOtherDevice = remoteDevId &amp;&amp; remoteDevId !== deviceId();
      if (applySyncData(remote, true)) {
        if (isOtherDevice) {
          /* 其他設備的變更 — 已在 applySyncData 裡彈通知，這裡只刷新 UI */
          renderAll(); renderTodayClasses();
          if (typeof renderCalendar === &#x27;function&#x27;) renderCalendar();
        } else {
          /* 自己其他設備的變更 — 靜默刷新 */
          renderAll(); renderTodayClasses();
          if (typeof renderCalendar === &#x27;function&#x27;) renderCalendar();
          toast(&#x27;☁️ 已同步其他設備的最新資料&#x27;);
        }
      }
    }
  }).catch(function () {});
}

/* ---- 8. 安裝教學 Modal ---- */
function initHelp() {
  var b = $id(&#x27;helpBtn&#x27;), m = $id(&#x27;helpModal&#x27;);
  if (!b || !m) return;
  b.onclick = function () { m.hidden = false; };
  var c = $id(&#x27;helpCloseBtn&#x27;);
  if (c) c.onclick = function () { m.hidden = true; };
  m.addEventListener(&#x27;click&#x27;, function (e) { if (e.target === m) m.hidden = true; });
  document.addEventListener(&#x27;keydown&#x27;, function (e) { if (e.key === &#x27;Escape&#x27; &amp;&amp; !m.hidden) m.hidden = true; });
}

/* ============================================================
   🆕 v2.3 新功能：課表上傳自動更新 / 今日課堂速覽 /
   Loki 三級智能應答（內部數據 + 外部檢索）/ 自媒體運營 / 共同日記
   ============================================================ */

/* ---- 1. 課表上傳（圖片/PDF → IndexedDB &#x27;tt_file&#x27;；粘貼文本 → 解析成 slots） ---- */
function ttRenderPreview(rec) {
  var box = $id(&#x27;ttPreview&#x27;), inner = $id(&#x27;ttPreviewBox&#x27;);
  if (!box) return;
  if (!rec) { box.hidden = true; if ($id(&#x27;timetableGrid&#x27;)) $id(&#x27;timetableGrid&#x27;).style.display = &#x27;&#x27;; return; }
  box.hidden = false;
  var url = URL.createObjectURL(rec.blob);
  inner.innerHTML = rec.type.indexOf(&#x27;pdf&#x27;) &gt;= 0
    ? &#x27;&lt;embed src=&quot;&#x27; + url + &#x27;&quot; type=&quot;application/pdf&quot; class=&quot;tt-embed&quot; /&gt;&#x27;
    : &#x27;&lt;img src=&quot;&#x27; + url + &#x27;&quot; class=&quot;tt-img&quot; alt=&quot;時間表&quot; /&gt;&#x27;;
  if ($id(&#x27;timetableGrid&#x27;)) $id(&#x27;timetableGrid&#x27;).style.display = &#x27;none&#x27;;
  if ($id(&#x27;ttViewBtn&#x27;)) $id(&#x27;ttViewBtn&#x27;).onclick = function () {
    window.open(url, &#x27;_blank&#x27;);
  };
  URL.revokeObjectURL /* keep url alive in embed/img until re-render */();
}
function ttLoadFile() {
  if (!idbOpen) return Promise.resolve(null);
  return idbTx(&#x27;readonly&#x27;).then(function (st) {
    return new Promise(function (res) {
      var r = st.get(&#x27;tt_file&#x27;);
      r.onsuccess = function () { res(r.result || null); };
      r.onerror = function () { res(null); };
    });
  }).catch(function () { return null; });
}
function ttSaveFile(file) {
  idbAdd({ id: &#x27;tt_file&#x27;, name: file.name, type: file.type || &#x27;image&#x27;, size: file.size, date: todayStr(), blob: file })
    .then(function () { ttRefresh(); toast(&#x27;✅ 最新時間表已上傳，全站自動更新&#x27;); })
    .catch(function () { toast(&#x27;❌ 上傳失敗（不支援 IndexedDB？）&#x27;); });
  /* 🆕 v2.3.2 自動 OCR：圖片/PDF 上傳後自動抓取科目資訊 */
  if (file.type &amp;&amp; file.type.indexOf(&#x27;image&#x27;) === 0) {
    ttOcrFile(file);
  } else if (file.type &amp;&amp; file.type.indexOf(&#x27;pdf&#x27;) === 0) {
    ttOcrPdf(file);
  }
}
/* 🆕 v2.3.2 OCR 引擎：圖片 → 文字 → ttParseText → 自動填入 slots */
function ttOcrStatus(msg) {
  var el = $id(&#x27;ttOcrStatus&#x27;);
  if (el) { el.textContent = msg; el.hidden = !msg; }
}
function ttOcrFile(file) {
  if (typeof Tesseract === &#x27;undefined&#x27;) { ttOcrStatus(&#x27;&#x27;); return; }
  ttOcrStatus(&#x27;🤖 OCR 識別中…（首次載入需下載中英文語言包，約 10-20 秒）&#x27;);
  Tesseract.recognize(file, &#x27;chi_tra+eng&#x27;, {
    logger: function (m) {
      if (m.status === &#x27;recognizing text&#x27;) ttOcrStatus(&#x27;🤖 OCR 識別中… &#x27; + Math.round(m.progress * 100) + &#x27;%&#x27;);
    }
  }).then(function (res) {
    ttOcrStatus(&#x27;&#x27;);
    var text = res.data.text || &#x27;&#x27;;
    if (text.trim()) ttOcrApply(text, file.name);
    else toast(&#x27;⚠️ OCR 未識別到文字，可手動粘貼到文字框解析&#x27;);
  }).catch(function () {
    ttOcrStatus(&#x27;&#x27;); toast(&#x27;⚠️ OCR 識別失敗，可手動粘貼文字解析&#x27;);
  });
}
function ttOcrPdf(file) {
  if (typeof pdfjsLib === &#x27;undefined&#x27;) {
    ttOcrStatus(&#x27;🤖 PDF 正在載入引擎…&#x27;);
    var s = document.createElement(&#x27;script&#x27;);
    s.src = &#x27;https://cdn.jsdelivr.net/npm/pdfjs-dist@3/build/pdf.min.js&#x27;;
    s.onload = function () {
      pdfjsLib.GlobalWorkerOptions.workerSrc = &#x27;https://cdn.jsdelivr.net/npm/pdfjs-dist@3/build/pdf.worker.min.js&#x27;;
      ttOcrPdf(file);
    };
    document.head.appendChild(s);
    return;
  }
  ttOcrStatus(&#x27;🤖 PDF 解析中…&#x27;);
  var reader = new FileReader();
  reader.onload = function () {
    pdfjsLib.getDocument({ data: new Uint8Array(reader.result) }).promise.then(function (pdf) {
      var all = [], n = pdf.numPages, done = 0;
      for (var i = 1; i &lt;= n; i++) {
        (function (pno) {
          pdf.getPage(pno).then(function (page) {
            return page.getTextContent();
          }).then(function (tc) {
            all.push(tc.items.map(function (it) { return it.str; }).join(&#x27; &#x27;));
            done++;
            if (done === n) { ttOcrStatus(&#x27;&#x27;); ttOcrApply(all.join(&#x27;\n&#x27;), file.name); }
          }).catch(function () { done++; if (done === n) { ttOcrStatus(&#x27;&#x27;); if (all.join(&#x27;&#x27;).trim()) ttOcrApply(all.join(&#x27;\n&#x27;), file.name); } });
        })(i);
      }
    }).catch(function () { ttOcrStatus(&#x27;&#x27;); toast(&#x27;⚠️ PDF 解析失敗，可手動粘貼文字&#x27;); });
  };
  reader.readAsArrayBuffer(file);
}
function ttOcrApply(text, srcName) {
  var slots = ttParseText(text);
  if (!slots.length) {
    toast(&#x27;⚠️ OCR 已識別文字但解析不到課堂（需含「星期+時間」格式）&#x27;);
    ttOcrStatus(&#x27;⚠️ 已識別文字但解析不到課堂 — 可手動粘貼到下方文字框修正&#x27;);
    if ($id(&#x27;ttPaste&#x27;)) $id(&#x27;ttPaste&#x27;).value = text;
    return;
  }
  showConfirm(&#x27;🤖 從「&#x27; + srcName + &#x27;」自動識別到 &#x27; + slots.length + &#x27; 節課：\n&#x27; +
    slots.slice(0, 6).map(function (s) { return &#x27;  &#x27; + &#x27;一二三四五&#x27;[s.d] + &#x27; &#x27; + pad2(s.t) + &#x27;:00 &#x27; + s.subj + (s.room ? &#x27; &#x27; + s.room : &#x27;&#x27;); }).join(&#x27;\n&#x27;) +
    (slots.length &gt; 6 ? &#x27;\n  …等共 &#x27; + slots.length + &#x27; 節&#x27; : &#x27;&#x27;) +
    &#x27;\n\n取代現有時間表？（仍可在表格中手動微調）&#x27;).then(function (ok) {
    if (!ok) {
      if ($id(&#x27;ttPaste&#x27;)) $id(&#x27;ttPaste&#x27;).value = text;
      ttOcrStatus(&#x27;已取消自動填入 — 識別文字已放到下方文字框供你修正&#x27;);
      return;
    }
    LS.set(&#x27;timetable&#x27;, { slots: slots });
    ttOcrStatus(&#x27;✅ 自動識別並填入 &#x27; + slots.length + &#x27; 節課&#x27;);
    ttRefresh(); renderStudy(); renderTodayClasses();
    toast(&#x27;🤖 已自動填入 &#x27; + slots.length + &#x27; 節課 ✓&#x27;);
  });
}
function ttRefresh() {
  ttLoadFile().then(function (rec) {
    ttRenderPreview(rec);
    if ($id(&#x27;ttSrc&#x27;)) $id(&#x27;ttSrc&#x27;).textContent = rec ? &#x27;（已上傳 &#x27; + fmtD(rec.date) + &#x27; 版 ✓）&#x27; : &#x27;（預設版 · 可上傳更新）&#x27;;
  });
}
/* 粘貼文本 → slots 解析器（支援：星期 + 時間 + 科目 + 課室，順序不限） */
function ttParseText(txt) {
  var dayMap = { &#x27;monday&#x27;: 0, &#x27;mon&#x27;: 0, &#x27;一&#x27;: 0, &#x27;週一&#x27;: 0, &#x27;星期一&#x27;: 0, &#x27;tuesday&#x27;: 1, &#x27;tue&#x27;: 1, &#x27;二&#x27;: 1, &#x27;週二&#x27;: 1, &#x27;星期二&#x27;: 1, &#x27;wednesday&#x27;: 2, &#x27;wed&#x27;: 2, &#x27;三&#x27;: 2, &#x27;週三&#x27;: 2, &#x27;星期三&#x27;: 2, &#x27;thursday&#x27;: 3, &#x27;thu&#x27;: 3, &#x27;四&#x27;: 3, &#x27;週四&#x27;: 3, &#x27;星期四&#x27;: 3, &#x27;friday&#x27;: 4, &#x27;fri&#x27;: 4, &#x27;五&#x27;: 4, &#x27;週五&#x27;: 4, &#x27;星期五&#x27;: 4 };
  var lines = txt.split(/\n+/).map(function (l) { return l.trim(); }).filter(Boolean);
  var slots = [];
  lines.forEach(function (line) {
    var low = line.toLowerCase();
    var d = null;
    Object.keys(dayMap).forEach(function (k) {
      if (d === null &amp;&amp; low.indexOf(k.toLowerCase()) &gt;= 0) d = dayMap[k];
    });
    if (d === null) return;
    /* 先取第一個時間作為起始（無論是範圍 10:00-11:00 還是單點 10:00） */
    var hm = line.match(/(\d{1,2})\s*[:：]\s*(\d{2})/);
    if (!hm) return;
    var t = +hm[1];
    if (t &lt; 8 || t &gt; 20) return;
    /* 剝離所有時間（含範圍）+ 星期詞 + 分隔符 */
    var rest = line.replace(/\d{1,2}\s*[:：]\s*\d{2}\s*[-–~至到-]\s*\d{1,2}\s*[:：]\s*\d{2}/g, &#x27; &#x27;)
      .replace(/\d{1,2}\s*[:：]\s*\d{2}/g, &#x27; &#x27;)
      .replace(/(星期|週)?[一二三四五六日]|monday|tuesday|wednesday|thursday|friday|mon|tue|wed|thu|fri/gi, &#x27; &#x27;)
      .replace(/[|｜,，、\-–—]/g, &#x27; &#x27;)
      .replace(/\s{2,}/g, &#x27; &#x27;).trim();
    var parts = rest.split(/\s+/).filter(Boolean);
    var subj, room = &#x27;&#x27;;
    if (parts.length &gt; 1) {
      var last = parts[parts.length - 1];
      var lastIsRoom = /[0-9]/.test(last) || (/^[A-Z]{2,}/.test(last) &amp;&amp; last.length &lt;= 8);
      if (lastIsRoom) { subj = parts.slice(0, -1).join(&#x27; &#x27;); room = last; }
      else subj = parts.join(&#x27; &#x27;);
    } else subj = parts[0] || &#x27;&#x27;;
    subj = subj.replace(/^[-–—\s]+/, &#x27;&#x27;).replace(/[-–—\s]+$/, &#x27;&#x27;).trim();
    if (subj &amp;&amp; subj.length &gt; 1) slots.push({ d: d, t: t, subj: subj, room: room });
  });
  return slots;
}
function initTimetableUpload() {
  var up = $id(&#x27;ttUploadBtn&#x27;), fin = $id(&#x27;ttFile&#x27;);
  if (!up || !fin) return;
  up.onclick = function () { fin.click(); };
  fin.onchange = function () {
    var f = fin.files &amp;&amp; fin.files[0];
    if (f) ttSaveFile(f);
    fin.value = &#x27;&#x27;;
  };
  if ($id(&#x27;ttParseBtn&#x27;)) $id(&#x27;ttParseBtn&#x27;).onclick = function () {
    var v = ($id(&#x27;ttPaste&#x27;) || {}).value || &#x27;&#x27;;
    var slots = ttParseText(v);
    if (!slots.length) { toast(&#x27;解析不到課堂 — 每行要有「星期 + 時間」，例：Mon 10:00 HTM3201 QT308&#x27;); return; }
    showConfirm(&#x27;解析到 &#x27; + slots.length + &#x27; 節課，取代現有表格？（可在表格中繼續微調）&#x27;).then(function (ok) {
      if (!ok) return;
      LS.set(&#x27;timetable&#x27;, { slots: slots });
      $id(&#x27;ttPaste&#x27;).value = &#x27;&#x27;;
      ttRefresh(); renderStudy(); toast(&#x27;✅ 已更新 &#x27; + slots.length + &#x27; 節課&#x27;);
    });
  };
  if ($id(&#x27;ttDelBtn&#x27;)) $id(&#x27;ttDelBtn&#x27;).onclick = function () {
    showConfirm(&#x27;移除上傳的時間表，還原為可編輯表格？&#x27;).then(function (ok) {
      if (!ok) return;
      idbDel(&#x27;tt_file&#x27;).then(function () { ttRefresh(); toast(&#x27;已還原&#x27;); });
    });
  };
  if ($id(&#x27;ttResetBtn&#x27;)) $id(&#x27;ttResetBtn&#x27;).onclick = function () {
    showConfirm(&#x27;還原出廠預設時間表？（上傳的圖片版也一併移除）&#x27;).then(function (ok) {
      if (!ok) return;
      LS.set(&#x27;timetable&#x27;, { slots: JSON.parse(JSON.stringify(FIX.timetable)) });
      idbDel(&#x27;tt_file&#x27;).then(function () { ttRefresh(); renderStudy(); toast(&#x27;已還原預設 ✓&#x27;); });
    });
  };
  ttRefresh();
}
/* ---- Dashboard：今日 &amp; 明日課堂 ---- */
function renderTodayClasses() {
  var box = $id(&#x27;todayClasses&#x27;);
  if (!box) return;
  var tt = LS.get(&#x27;timetable&#x27;, { slots: FIX.timetable.slice() });
  var slots = tt.slots || [];
  var now = new Date();
  var dow = (now.getDay() + 6) % 7; /* 0=一 */
  function daySlots(d) {
    return slots.filter(function (s) { return s.d === d; }).sort(function (a, b) { return a.t - b.t; });
  }
  var html = [[&#x27;今日&#x27;, daySlots(dow)], [&#x27;明日&#x27;, daySlots((dow + 1) % 7)]].map(function (pair) {
    var label = pair[0], list = pair[1];
    return &#x27;&lt;div class=&quot;tc-col&quot;&gt;&lt;div class=&quot;tc-day&quot;&gt;&#x27; + label + &#x27;（週&#x27; + &#x27;一二三四五六日&#x27;[(label === &#x27;今日&#x27; ? dow : (dow + 1) % 7)] + &#x27;）&lt;/div&gt;&#x27; +
      (list.length
        ? list.map(function (s) {
            var past = label === &#x27;今日&#x27; &amp;&amp; s.t &lt;= now.getHours();
            return &#x27;&lt;div class=&quot;tc-item&#x27; + (past ? &#x27; past&#x27; : &#x27;&#x27;) + &#x27;&quot;&gt;&lt;span class=&quot;tc-time&quot;&gt;&#x27; + pad2(s.t) + &#x27;:00&lt;/span&gt;&lt;b&gt;&#x27; + esc(s.subj) + &#x27;&lt;/b&gt;&lt;span class=&quot;tc-room&quot;&gt;&#x27; + esc(s.room || &#x27;&#x27;) + (past ? &#x27; · 已完成&#x27; : &#x27;&#x27;) + &#x27;&lt;/span&gt;&lt;/div&gt;&#x27;;
          }).join(&#x27;&#x27;)
        : &#x27;&lt;div class=&quot;empty-tip&quot;&gt;沒有課堂 🎉&lt;/div&gt;&#x27;) + &#x27;&lt;/div&gt;&#x27;;
  }).join(&#x27;&#x27;);
  box.innerHTML = &#x27;&lt;div class=&quot;tc-grid&quot;&gt;&#x27; + html + &#x27;&lt;/div&gt;&#x27; +
    &#x27;&lt;div class=&quot;form-row&quot; style=&quot;margin-top:10px&quot;&gt;&lt;button class=&quot;ghost&quot; onclick=&quot;goPage(\&#x27;study\&#x27;)&quot;&gt;📅 前往上傳最新課表&lt;/button&gt;&lt;/div&gt;&#x27;;
}

/* ---- 3. 自媒體運營（基於《雙平臺流量分發機制調研報告》規則引擎） ---- */
var MEDIA_KB = {
  coreWords: [&#x27;深港通勤&#x27;, &#x27;旅行&#x27;, &#x27;川西自駕&#x27;, &#x27;生活美學&#x27;, &#x27;通勤日常&#x27;, &#x27;深港兩地&#x27;, &#x27;HK上學&#x27;, &#x27;生活vlog&#x27;, &#x27;美食日常&#x27;, &#x27;治癒系生活&#x27;, &#x27;學習日常&#x27;, &#x27;IELTS備考&#x27;, &#x27;香港生活&#x27;],
  modWords: { heal: [&#x27;治癒系&#x27;, &#x27;質感生活&#x27;, &#x27;慢生活&#x27;, &#x27;儀式感&#x27;], howto: [&#x27;攻略&#x27;, &#x27;乾貨&#x27;, &#x27;指南&#x27;, &#x27;避坑&#x27;], emo: [&#x27;破防&#x27;, &#x27;淚目&#x27;, &#x27;真實&#x27;, &#x27;溫柔&#x27;], sell: [&#x27;種草&#x27;, &#x27;好物&#x27;, &#x27;打卡&#x27;, &#x27;推薦&#x27;] },
  emotionWords: [&#x27;解壓&#x27;, &#x27;週末&#x27;, &#x27;治癒日常&#x27;, &#x27;儀式感生活&#x27;, &#x27;慢生活日常&#x27;],
  longtail: [&#x27;深港通勤攻略&#x27;, &#x27;川西自駕路線&#x27;, &#x27;深港通關日常&#x27;, &#x27;HK探店&#x27;, &#x27;香港留學日常&#x27;, &#x27;IELTS 7分攻略&#x27;],
  broadTags: { xhs: [&#x27;#生活記錄&#x27;, &#x27;#旅行&#x27;, &#x27;#美食日常&#x27;, &#x27;#vlog&#x27;, &#x27;#學習日常&#x27;], dy: [&#x27;#生活&#x27;, &#x27;#旅行&#x27;, &#x27;#vlog&#x27;, &#x27;#治愈系&#x27;] },
  goldenHours: {
    xhs: [{ s: 20, e: 22, w: &#x27;晚高峰（最活躍）&#x27; }, { s: 12, e: 13.5, w: &#x27;午休峰&#x27; }, { s: 7, e: 9, w: &#x27;早高峰&#x27; }],
    dy: [{ s: 19, e: 22, w: &#x27;晚間黃金（最具爆發力）&#x27; }, { s: 12, e: 13.5, w: &#x27;午休峰&#x27; }, { s: 22, e: 25, w: &#x27;深夜活躍&#x27; }]
  },
  styles: {
    heal: { name: &#x27;治癒日常&#x27;, xhsT: [&#x27;{topic}｜{mod}的日常片段&#x27;, &#x27;記錄{topic}的一天｜{emo}&#x27;, &#x27;{topic}，是平凡日子裡的光✨&#x27;], dyT: [&#x27;{topic}的最後3秒，我看了十遍&#x27;, &#x27;你絕對想不到，{topic}可以這麼治癒&#x27;], body: &#x27;{scene}\n\n{topic}的日子，最治癒的是這些小瞬間。慢下來，把生活過成自己喜歡的樣子。\n\n你們的{topic}日常是怎樣的？評論區聊聊👇&#x27; },
    howto: { name: &#x27;乾貨攻略&#x27;, xhsT: [&#x27;{topic}超全攻略｜看完這篇就夠了&#x27;, &#x27;{topic}避坑指南｜{n}個必知重點&#x27;, &#x27;第一次{topic}？這篇收藏就對了&#x27;], dyT: [&#x27;{topic}的{N}個坑，我替你踩完了&#x27;, &#x27;30秒帶你看懂{topic}&#x27;], body: &#x27;{scene}\n\n這篇整理{topic}的全部重點：\n1️⃣ 核心資訊與時間安排\n2️⃣ 必帶物品與注意事項\n3️⃣ 省時省錢小技巧\n\n🌟 先收藏，用的時候找得到。有問題評論區問我～&#x27; },
    emo: { name: &#x27;情感共鳴&#x27;, xhsT: [&#x27;{topic}的第{n}天，我學會了這件事&#x27;, &#x27;原來{topic}，藏著這麼多情緒&#x27;, &#x27;寫給也在{topic}的你&#x27;], dyT: [&#x27;{topic}這件事，我瞞了很久&#x27;, &#x27;如果人生重來，我還會選{topic}嗎&#x27;], body: &#x27;{scene}\n\n{topic}的日子有高有低，但每次回頭看，都是成長。\n原來所謂堅持，就是一天一天慢慢走。\n\n把這篇送給同在路上的你 🤍&#x27; },
    sell: { name: &#x27;種草推薦&#x27;, xhsT: [&#x27;{topic}好去處｜{mod}打卡清單&#x27;, &#x27;不允許你還不知道這個{topic}！&#x27;, &#x27;{topic}｜{n}個值得專程去的地方&#x27;], dyT: [&#x27;這個{topic}，我願意去一百次&#x27;, &#x27;刷到就是緣分！{topic}寶藏攻略&#x27;], body: &#x27;{scene}\n\n{topic}真的太值得了！\n📍 亮點一：畫面質感直接拉滿\n📍 亮點二：隨手一拍都是大片\n📍 亮點三：完整攻略我放這了\n\n🌲 收藏起來，下次直接照著去！&#x27; }
  },
  scenes: { heal: &#x27;又是被平凡日子治癒的一天。&#x27;, howto: &#x27;很多朋友問我{topic}怎麼安排，這篇一次講清楚。&#x27;, emo: &#x27;今天想認真聊聊{topic}。&#x27;, sell: &#x27;最近被問爆的{topic}，終於整理好了！&#x27; }
};
function mediaNextGolden(platform) {
  var now = new Date();
  var cur = now.getHours() + now.getMinutes() / 60;
  var list = MEDIA_KB.goldenHours[platform];
  for (var i = 0; i &lt; list.length; i++) {
    if (cur &lt; list[i].s) {
      return &#x27;今天 &#x27; + Math.floor(list[i].s) + &#x27;:00（&#x27; + list[i].w + &#x27;）&#x27;;
    }
  }
  return &#x27;明天 &#x27; + Math.floor(list[0].s) + &#x27;:00（&#x27; + list[0].w + &#x27;）&#x27;;
}
function mediaGenCopy(topic, platform, styleKey, accName) {
  var st = MEDIA_KB.styles[styleKey] || MEDIA_KB.styles.heal;
  var mods = MEDIA_KB.modWords[styleKey] || MEDIA_KB.modWords.heal;
  function fill(tpl, n) {
    return tpl.replace(/\{topic\}/g, topic)
      .replace(/\{mod\}/g, mods[n % mods.length])
      .replace(/\{emo\}/g, MEDIA_KB.emotionWords[n % MEDIA_KB.emotionWords.length])
      .replace(/\{n\}/g, String(3 + (n * 2) % 7))
      .replace(/\{N\}/g, String(3 + (n * 2) % 5));
  }
  var titles = (platform === &#x27;dy&#x27; ? st.dyT : st.xhsT).map(function (t, i) { return fill(t, i); });
  var scene = (MEDIA_KB.scenes[styleKey] || MEDIA_KB.scenes.heal).replace(/\{topic\}/g, topic);
  var body = st.body.replace(/\{scene\}/g, scene).replace(/\{topic\}/g, topic);
  /* 三級標籤：泛詞2 + 長尾2-3 + 專屬1 */
  var lt = MEDIA_KB.longtail.filter(function (w) { return topic &amp;&amp; (w.indexOf(topic.slice(0, 2)) &gt;= 0 || topic.indexOf(w.slice(0, 2)) &gt;= 0); });
  var tags = (platform === &#x27;xhs&#x27;
    ? [&#x27;#&#x27; + topic, &#x27;#&#x27; + topic + &#x27;攻略&#x27;, &#x27;#&#x27; + (mods[0] || &#x27;治癒系&#x27;)]
    : [&#x27;#&#x27; + topic, &#x27;#&#x27; + (mods[0] || &#x27;治愈系&#x27;)])
    .concat(lt.length ? lt.slice(0, 2).map(function (w) { return &#x27;#&#x27; + w; }) : (platform === &#x27;xhs&#x27; ? [&#x27;#生活記錄&#x27;, &#x27;#香港生活&#x27;] : [&#x27;#生活&#x27;, &#x27;#旅行記錄&#x27;]))
    .concat(MEDIA_KB.broadTags[platform].slice(0, platform === &#x27;xhs&#x27; ? 3 : 2))
    .concat([&#x27;#&#x27; + (accName || &#x27;日常食光機&#x27;)]);
  if (platform === &#x27;dy&#x27; &amp;&amp; tags.length &gt; 5) tags = tags.slice(0, 5);
  return {
    titles: titles, body: body, tags: tags,
    time: mediaNextGolden(platform),
    cta: platform === &#x27;xhs&#x27; ? &#x27;🌟 引導「收藏起來」— 小紅書收藏率權重最高（≥5% 合格）&#x27; : &#x27;🌟 引導「轉發給朋友」— 抖音轉發率權重最高（≥0.5% 合格），結尾加金句落版&#x27;,
    tips: platform === &#x27;xhs&#x27;
      ? [&#x27;標題核心詞「&#x27; + topic + &#x27;」已前置 ✓（12-20 字最佳）&#x27;, &#x27;正文前 80 字已含核心詞 ✓（系統判定賽道的節點）&#x27;, &#x27;封面加文字「&#x27; + topic + &#x27; Day N」— 會被 OCR 識別參與搜索&#x27;, &#x27;發布時間建議 19:00-22:00（晚高峰），週末下午 14-18 也適合生活類&#x27;]
      : [&#x27;前 3 秒鉤子：視覺衝擊畫面或懸念字幕（決定完播率）&#x27;, &#x27;節奏卡點剪輯 + 熱門音樂，影片 15-30 秒最佳&#x27;, &#x27;結尾金句落版 + 評論引導（評論率 ≥0.5% 合格）&#x27;, &#x27;發布時間建議 19:00-22:00；與小紅書錯峰 1 小時發布&#x27;]
  };
}
function mediaSuggest(hasVideo, hasImage, copy, platform) {
  var out = [];
  if (copy) {
    var t0 = copy.titles[0] || &#x27;&#x27;;
    if (t0.length &gt; 22) out.push([&#x27;P0&#x27;, &#x27;標題 &#x27; + t0.length + &#x27; 字偏長 — 小紅書 12-20 字最佳，核心詞務必在前 8 字內&#x27;]);
    if (platform === &#x27;xhs&#x27; &amp;&amp; copy.tags.length &lt; 3) out.push([&#x27;P0&#x27;, &#x27;標籤少於 3 個會識別不全 — 建議 3-10 個三級組合（泛詞+長尾+專屬）&#x27;]);
    if (platform === &#x27;xhs&#x27; &amp;&amp; copy.tags.length &gt; 10) out.push([&#x27;P0&#x27;, &#x27;標籤超過 10 個有堆砌降權風險 — 刪到 5-8 個&#x27;]);
    if (platform === &#x27;dy&#x27; &amp;&amp; copy.tags.length &gt; 5) out.push([&#x27;P1&#x27;, &#x27;抖音標籤 3-5 個即可 — 重點是前 3 秒鉤子不是標籤&#x27;]);
    out.push([&#x27;P0&#x27;, platform === &#x27;dy&#x27; ? &#x27;檢查前 3 秒：是否最強畫面開頭？（完播率 ≥30% 才能晉級流量池）&#x27; : &#x27;檢查正文前 80 字：第一句是否直接出現核心詞（避免「今天給大家分享」開頭）&#x27;]);
  }
  if (hasVideo) {
    out.push([&#x27;P0&#x27;, platform === &#x27;dy&#x27; ? &#x27;影片建議 15-30 秒 + 卡點剪輯 — 抖音完播率是第一權重&#x27; : &#x27;影片節奏可中等，重點拍完整記錄 — 小紅書看重內容完整與可收藏性&#x27;]);
    out.push([&#x27;P1&#x27;, &#x27;加字幕：語音會被 ASR 識別成關鍵詞參與推薦，字幕能強化&#x27;]);
  }
  if (hasImage) {
    out.push([&#x27;P1&#x27;, platform === &#x27;xhs&#x27; ? &#x27;封面加大字標題（與標題關鍵詞呼應）— 封面文字會被 OCR 識別參與搜索&#x27; : &#x27;首圖做成視覺衝擊封面（大字+高對比）— 決定點開率&#x27;]);
    out.push([&#x27;P2&#x27;, &#x27;圖片保持同一濾鏡風格，強化賬號視覺記憶&#x27;]);
  }
  if (!hasVideo &amp;&amp; !hasImage) out.push([&#x27;P1&#x27;, &#x27;尚未上傳素材 — 上傳後我會針對素材類型給更具體的畫面建議&#x27;]);
  out.push([&#x27;P2&#x27;, &#x27;黃金時段發布：小紅書 19:00-22:00 ／ 抖音 20:00-22:00（雙平臺錯峰 1 小時）&#x27;]);
  out.push([&#x27;P2&#x27;, &#x27;同一素材做兩個版本：小紅書版重關鍵詞佈局，抖音版重 3 秒鉤子 — 不要一稿兩發&#x27;]);
  return out;
}
function initMediaPage(p, acct, platforms) {
  var P = function (id) { return $id(p + id); };
  var mediaKey = &#x27;media_name_&#x27; + acct;
  var lastCopy = null;
  function mediaRecords() {
    return idbAll().then(function (list) {
      return list.filter(function (m) { return m.id &amp;&amp; m.id.indexOf(&#x27;media_&#x27; + acct + &#x27;_&#x27;) === 0; })
        .sort(function (a, b) { return (b.date || &#x27;&#x27;).localeCompare(a.date || &#x27;&#x27;); });
    }).catch(function () { return []; });
  }
  function refreshName() {
    var n = LS.get(mediaKey, platforms.length &gt; 1 ? &#x27;日常食光機&#x27; : &#x27;小紅書賬號&#x27;);
    if (P(&#x27;Name&#x27;)) P(&#x27;Name&#x27;).value = n;
    var accEl = $id(acct === &#x27;ly&#x27; ? &#x27;mediaAccName&#x27; : &#x27;bfMediaAccName&#x27;);
    if (accEl) accEl.textContent = n;
    return n;
  }
  function renderOut(copy, platform) {
    var box = P(&#x27;Out&#x27;);
    if (!box) return;
    if (!copy) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML =
      &#x27;&lt;div class=&quot;gen-sec&quot;&gt;&lt;div class=&quot;gen-lbl&quot;&gt;📌 標題（三選一 · 核心詞已前置）&lt;/div&gt;&#x27; +
      copy.titles.map(function (t, i) { return &#x27;&lt;div class=&quot;gen-title&quot;&gt;&#x27; + (i + 1) + &#x27;. &#x27; + esc(t) + &#x27; &lt;span class=&quot;gen-len&quot;&gt;&#x27; + t.length + &#x27;字&lt;/span&gt;&lt;/div&gt;&#x27;; }).join(&#x27;&#x27;) + &#x27;&lt;/div&gt;&#x27; +
      &#x27;&lt;div class=&quot;gen-sec&quot;&gt;&lt;div class=&quot;gen-lbl&quot;&gt;📝 正文（前 80 字已埋核心詞）&lt;/div&gt;&lt;div class=&quot;gen-body&quot;&gt;&#x27; + esc(copy.body).replace(/\n/g, &#x27;&lt;br&gt;&#x27;) + &#x27;&lt;/div&gt;&lt;/div&gt;&#x27; +
      &#x27;&lt;div class=&quot;gen-sec&quot;&gt;&lt;div class=&quot;gen-lbl&quot;&gt;#️⃣ 標籤（&#x27; + copy.tags.length + &#x27; 個 · &#x27; + (platform === &#x27;xhs&#x27; ? &#x27;三級組合：泛詞+長尾+專屬&#x27; : &#x27;抖音精準 3-5 個&#x27;) + &#x27;）&lt;/div&gt;&lt;div class=&quot;gen-tags&quot;&gt;&#x27; + copy.tags.map(esc).join(&#x27; &#x27;) + &#x27;&lt;/div&gt;&lt;/div&gt;&#x27; +
      &#x27;&lt;div class=&quot;gen-sec&quot;&gt;&lt;div class=&quot;gen-lbl&quot;&gt;⏰ 建議發布時間&lt;/div&gt;&lt;div class=&quot;gen-time&quot;&gt;&#x27; + esc(copy.time) + &#x27;&lt;/div&gt;&lt;/div&gt;&#x27; +
      &#x27;&lt;div class=&quot;gen-sec&quot;&gt;&lt;div class=&quot;gen-lbl&quot;&gt;&#x27; + copy.cta + &#x27;&lt;/div&gt;&lt;ul class=&quot;gen-tips&quot;&gt;&#x27; + copy.tips.map(function (t) { return &#x27;&lt;li&gt;&#x27; + esc(t) + &#x27;&lt;/li&gt;&#x27;; }).join(&#x27;&#x27;) + &#x27;&lt;/ul&gt;&lt;/div&gt;&#x27; +
      &#x27;&lt;div class=&quot;form-row&quot; style=&quot;margin-top:8px&quot;&gt;&lt;button class=&quot;primary&quot; id=&quot;&#x27; + p + &#x27;CopyBtn&quot;&gt;📋 複製全部文案&lt;/button&gt;&lt;/div&gt;&#x27;;
    var cp = $id(p + &#x27;CopyBtn&#x27;);
    if (cp) cp.onclick = function () {
      var txt = copy.titles.map(function (t, i) { return &#x27;標題&#x27; + (i + 1) + &#x27;：&#x27; + t; }).join(&#x27;\n&#x27;) + &#x27;\n\n&#x27; + copy.body + &#x27;\n\n&#x27; + copy.tags.join(&#x27; &#x27;) + &#x27;\n\n發布時間：&#x27; + copy.time;
      if (navigator.clipboard &amp;&amp; navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(function () { toast(&#x27;文案已複製 ✓&#x27;); });
      } else {
        var ta = document.createElement(&#x27;textarea&#x27;); ta.value = txt; document.body.appendChild(ta);
        ta.select(); try { document.execCommand(&#x27;copy&#x27;); toast(&#x27;文案已複製 ✓&#x27;); } catch (e) { toast(&#x27;複製失敗，請手動選取&#x27;); }
        ta.remove();
      }
    };
  }
  function renderGrid() {
    var grid = P(&#x27;Grid&#x27;);
    if (!grid) return;
    mediaRecords().then(function (list) {
      if (!list.length) { grid.innerHTML = &#x27;&lt;div class=&quot;empty-tip&quot;&gt;尚未上傳素材 — 照片／影片都存在本機 IndexedDB&lt;/div&gt;&#x27;; return; }
      grid.innerHTML = list.map(function (m) {
        var isVid = (m.type || &#x27;&#x27;).indexOf(&#x27;video&#x27;) === 0;
        return &#x27;&lt;div class=&quot;media-cell&quot; data-mid=&quot;&#x27; + esc(m.id) + &#x27;&quot;&gt;&#x27; +
          &#x27;&lt;label class=&quot;media-pick&quot;&gt;&lt;input type=&quot;checkbox&quot; data-mid=&quot;&#x27; + esc(m.id) + &#x27;&quot; /&gt;&lt;span&gt;選&lt;/span&gt;&lt;/label&gt;&#x27; +
          &#x27;&lt;div class=&quot;media-thumb&quot; data-mid=&quot;&#x27; + esc(m.id) + &#x27;&quot;&gt;&#x27; + (isVid ? &#x27;▶️&#x27; : &#x27;🖼&#x27;) + &#x27;&lt;/div&gt;&#x27; +
          &#x27;&lt;div class=&quot;media-name&quot;&gt;&#x27; + esc(m.name.slice(0, 18)) + &#x27;&lt;/div&gt;&#x27; +
          &#x27;&lt;div class=&quot;media-meta&quot;&gt;&#x27; + (isVid ? &#x27;影片&#x27; : &#x27;圖片&#x27;) + &#x27; · &#x27; + (m.size &gt; 1048576 ? (m.size / 1048576).toFixed(1) + &#x27;MB&#x27; : Math.max(1, Math.round(m.size / 1024)) + &#x27;KB&#x27;) + &#x27;&lt;/div&gt;&#x27; +
          &#x27;&lt;button class=&quot;row-del&quot; data-mdel=&quot;&#x27; + esc(m.id) + &#x27;&quot; title=&quot;刪除&quot;&gt;🗑&lt;/button&gt;&lt;/div&gt;&#x27;;
      }).join(&#x27;&#x27;);
      $qa(&#x27;#&#x27; + grid.id + &#x27; .media-thumb&#x27;).forEach(function (th) {
        th.onclick = function () {
          mediaRecords().then(function (list) {
            var m = list.filter(function (x) { return x.id === th.getAttribute(&#x27;data-mid&#x27;); })[0];
            if (m) window.open(URL.createObjectURL(m.blob), &#x27;_blank&#x27;);
          });
        };
      });
      $qa(&#x27;#&#x27; + grid.id + &#x27; [data-mdel]&#x27;).forEach(function (b) {
        b.onclick = function () {
          idbDel(b.getAttribute(&#x27;data-mdel&#x27;)).then(renderGrid);
          toast(&#x27;素材已刪除&#x27;);
        };
      });
    });
  }
  function pickedMedia() {
    var ids = $qa(&#x27;#&#x27; + (P(&#x27;Grid&#x27;) || {}).id + &#x27; .media-pick input:checked&#x27;).map(function (c) { return c.getAttribute(&#x27;data-mid&#x27;); });
    return mediaRecords().then(function (list) { return list.filter(function (m) { return ids.indexOf(m.id) &gt;= 0; }); });
  }
  var accName = refreshName();
  if (P(&#x27;NameBtn&#x27;)) P(&#x27;NameBtn&#x27;).onclick = function () {
    LS.set(mediaKey, (P(&#x27;Name&#x27;).value || &#x27;&#x27;).trim() || &#x27;日常食光機&#x27;);
    refreshName(); toast(&#x27;賬號名已儲存 ✓&#x27;);
  };
  if (P(&#x27;UploadBtn&#x27;)) P(&#x27;UploadBtn&#x27;).onclick = function () { P(&#x27;FileIn&#x27;).click(); };
  if (P(&#x27;FileIn&#x27;)) P(&#x27;FileIn&#x27;).onchange = function () {
    var fs = Array.prototype.slice.call(P(&#x27;FileIn&#x27;).files || []);
    if (!fs.length) return;
    var chain = Promise.resolve();
    fs.forEach(function (f) {
      chain = chain.then(function () {
        return idbAdd({ id: &#x27;media_&#x27; + acct + &#x27;_&#x27; + uid(), name: f.name, type: f.type, size: f.size, date: todayStr(), blob: f });
      });
    });
    chain.then(function () { P(&#x27;FileIn&#x27;).value = &#x27;&#x27;; renderGrid(); toast(&#x27;已上傳 &#x27; + fs.length + &#x27; 個素材 ✓&#x27;); })
      .catch(function () { toast(&#x27;上傳失敗（檔案太大或瀏覽器不支援）&#x27;); });
  };
  if (P(&#x27;GenBtn&#x27;)) P(&#x27;GenBtn&#x27;).onclick = function () {
    var topic = (P(&#x27;Topic&#x27;).value || &#x27;&#x27;).trim();
    if (!topic) { toast(&#x27;請輸入主題／關鍵詞&#x27;); return; }
    var platform = P(&#x27;Plat&#x27;) ? P(&#x27;Plat&#x27;).value : &#x27;xhs&#x27;;
    var style = P(&#x27;Style&#x27;).value;
    lastCopy = mediaGenCopy(topic, platform, style, LS.get(mediaKey, &#x27;&#x27;));
    lastCopy.platform = platform;
    renderOut(lastCopy, platform);
    toast(&#x27;✨ 已生成 — 標題/正文/標籤/時段均按「&#x27; + (platform === &#x27;xhs&#x27; ? &#x27;小紅書&#x27; : &#x27;抖音&#x27;) + &#x27;」流量規則優化&#x27;);
  };
  if (P(&#x27;SugBtn&#x27;)) P(&#x27;SugBtn&#x27;).onclick = function () {
    pickedMedia().then(function (sel) {
      var hasVid = sel.some(function (m) { return (m.type || &#x27;&#x27;).indexOf(&#x27;video&#x27;) === 0; });
      var hasImg = sel.some(function (m) { return (m.type || &#x27;&#x27;).indexOf(&#x27;image&#x27;) === 0; });
      var platform = lastCopy ? lastCopy.platform : (P(&#x27;Plat&#x27;) ? P(&#x27;Plat&#x27;).value : &#x27;xhs&#x27;);
      var items = mediaSuggest(hasVid, hasImg, lastCopy, platform);
      var box = P(&#x27;SugOut&#x27;);
      if (!box) return;
      box.innerHTML = items.map(function (x) {
        return &#x27;&lt;div class=&quot;sug-item &#x27; + (x[0] === &#x27;P0&#x27; ? &#x27;p0&#x27; : x[0] === &#x27;P1&#x27; ? &#x27;p1&#x27; : &#x27;p2&#x27;) + &#x27;&quot;&gt;&lt;span class=&quot;sug-pri&quot;&gt;&#x27; + x[0] + &#x27;&lt;/span&gt;&#x27; + esc(x[1]) + &#x27;&lt;/div&gt;&#x27;;
      }).join(&#x27;&#x27;);
    });
  };
  renderGrid();
}

/* ---- 4. 共同日記（兩人共用 · IndexedDB &#x27;diary_&#x27; 前綴） ---- */
var DIARY_MOODS = [&#x27;😊&#x27;, &#x27;🥰&#x27;, &#x27;😂&#x27;, &#x27;😭&#x27;, &#x27;😤&#x27;, &#x27;😴&#x27;, &#x27;🤒&#x27;, &#x27;🥳&#x27;, &#x27;😔&#x27;, &#x27;🔥&#x27;];
var diaryPendingFiles = [];
function diaryRecords() {
  return idbAll().then(function (list) {
    return list.filter(function (m) { return m.id &amp;&amp; m.id.indexOf(&#x27;diary_&#x27;) === 0; })
      .sort(function (a, b) { return (b.date || &#x27;&#x27;).localeCompare(a.date || &#x27;&#x27;); });
  }).catch(function () { return []; });
}
function renderDiary() {
  /* 統計 */
  diaryRecords().then(function (list) {
    var statsEl = $id(&#x27;diaryStats&#x27;);
    var anniv = LS.get(&#x27;diary_anniv&#x27;, &#x27;&#x27;);
    var days = anniv ? Math.abs(daysUntil(anniv)) + 1 : 0;
    var mediaCount = 0;
    list.forEach(function (e) { mediaCount += (e.files || []).length; });
    if (statsEl) statsEl.textContent = (days ? &#x27;在一起第 &#x27; + days + &#x27; 天&#x27; : &#x27;未設定紀念日&#x27;) + &#x27; · 已記錄 &#x27; + list.length + &#x27; 天 · &#x27; + mediaCount + &#x27; 個瞬間&#x27;;
    if ($id(&#x27;diaryAnniv&#x27;)) $id(&#x27;diaryAnniv&#x27;).value = anniv;
    /* 時間軸 */
    var box = $id(&#x27;diaryList&#x27;);
    if (!box) return;
    if (!list.length) { box.innerHTML = &#x27;&lt;div class=&quot;empty-tip&quot;&gt;還沒有日記 — 從上面寫下今天的第一篇吧 📔&lt;/div&gt;&#x27;; return; }
    box.innerHTML = list.map(function (e) {
      var p = String(e.date).split(&#x27;-&#x27;).map(Number);
      var wd = new Date(p[0], p[1] - 1, p[2]).getDay();
      var medias = (e.files || []).map(function (f, i) {
        var isVid = (f.type || &#x27;&#x27;).indexOf(&#x27;video&#x27;) === 0;
        return &#x27;&lt;div class=&quot;diary-media&quot; data-eid=&quot;&#x27; + esc(e.id) + &#x27;&quot; data-fi=&quot;&#x27; + i + &#x27;&quot;&gt;&#x27; + (isVid ? &#x27;&lt;span class=&quot;dm-play&quot;&gt;▶️&lt;/span&gt;&#x27; : &#x27;&#x27;) + &#x27;&lt;img alt=&quot;&quot; data-eid=&quot;&#x27; + esc(e.id) + &#x27;&quot; data-fi=&quot;&#x27; + i + &#x27;&quot; /&gt;&lt;/div&gt;&#x27;;
      }).join(&#x27;&#x27;);
      return &#x27;&lt;div class=&quot;diary-entry&quot; data-eid=&quot;&#x27; + esc(e.id) + &#x27;&quot;&gt;&#x27; +
        &#x27;&lt;div class=&quot;de-head&quot;&gt;&lt;span class=&quot;de-date&quot;&gt;📖 &#x27; + fmtD(e.date) + &#x27;（週&#x27; + WEEK_ZH[wd] + &#x27;）&lt;/span&gt;&lt;span class=&quot;de-mood&quot;&gt;&#x27; + (e.mood || &#x27;😊&#x27;) + &#x27;&lt;/span&gt;&lt;/div&gt;&#x27; +
        (e.text ? &#x27;&lt;div class=&quot;de-text&quot;&gt;&#x27; + esc(e.text).replace(/\n/g, &#x27;&lt;br&gt;&#x27;) + &#x27;&lt;/div&gt;&#x27; : &#x27;&#x27;) +
        (medias ? &#x27;&lt;div class=&quot;de-media-grid&quot;&gt;&#x27; + medias + &#x27;&lt;/div&gt;&#x27; : &#x27;&#x27;) +
        &#x27;&lt;div class=&quot;de-acts&quot;&gt;&lt;button class=&quot;ghost&quot; data-dpush=&quot;&#x27; + esc(e.id) + &#x27;&quot; style=&quot;padding:4px 12px&quot;&gt;📣 推送到自媒體素材庫&lt;/button&gt;&#x27; +
        &#x27;&lt;button class=&quot;row-del&quot; data-ddel=&quot;&#x27; + esc(e.id) + &#x27;&quot;&gt;🗑&lt;/button&gt;&lt;/div&gt;&lt;/div&gt;&#x27;;
    }).join(&#x27;&#x27;);
    /* 填充縮略圖 */
    list.forEach(function (e) {
      (e.files || []).forEach(function (f, i) {
        var img = $q(&#x27;#diaryList img[data-eid=&quot;&#x27; + e.id + &#x27;&quot;][data-fi=&quot;&#x27; + i + &#x27;&quot;]&#x27;);
        if (img &amp;&amp; (f.type || &#x27;&#x27;).indexOf(&#x27;image&#x27;) === 0) {
          var url = URL.createObjectURL(f.blob);
          img.onload = function () { URL.revokeObjectURL(url); };
          img.src = url;
        } else if (img) {
          img.closest(&#x27;.diary-media&#x27;).classList.add(&#x27;is-video&#x27;);
        }
      });
    });
    /* 事件 */
    $qa(&#x27;#diaryList [data-dpush]&#x27;).forEach(function (b) {
      b.onclick = function () {
        var eid = b.getAttribute(&#x27;data-dpush&#x27;);
        var entry = list.filter(function (x) { return x.id === eid; })[0];
        if (!entry || !(entry.files || []).length) { toast(&#x27;這篇日記沒有照片/影片可推送&#x27;); return; }
        showConfirm(&#x27;把這篇日記的 &#x27; + entry.files.length + &#x27; 個素材，推送到 Lok Yi 的自媒體素材庫？&#x27;).then(function (ok) {
          if (!ok) return;
          var chain = Promise.resolve();
          entry.files.forEach(function (f) {
            chain = chain.then(function () {
              return idbAdd({ id: &#x27;media_ly_&#x27; + uid(), name: f.name || &#x27;diary&#x27;, type: f.type, size: f.blob.size, date: todayStr(), blob: f.blob });
            });
          });
          chain.then(function () { toast(&#x27;✅ 已推送 &#x27; + entry.files.length + &#x27; 個素材到「自媒體運營」&#x27;); })
            .catch(function () { toast(&#x27;推送失敗&#x27;); });
        });
      };
    });
    $qa(&#x27;#diaryList [data-ddel]&#x27;).forEach(function (b) {
      b.onclick = function () {
        showConfirm(&#x27;確定刪除這篇日記？（含照片/影片，無法復原）&#x27;).then(function (ok) {
          if (!ok) return;
          idbDel(b.getAttribute(&#x27;data-ddel&#x27;)).then(function () { renderDiary(); toast(&#x27;已刪除&#x27;); });
        });
      };
    });
    $qa(&#x27;#diaryList .diary-media&#x27;).forEach(function (m) {
      m.onclick = function () {
        var eid = m.getAttribute(&#x27;data-eid&#x27;), fi = +m.getAttribute(&#x27;data-fi&#x27;);
        var entry = list.filter(function (x) { return x.id === eid; })[0];
        if (entry &amp;&amp; entry.files &amp;&amp; entry.files[fi]) {
          window.open(URL.createObjectURL(entry.files[fi].blob), &#x27;_blank&#x27;);
        }
      };
    });
  });
}
function initDiary() {
  if ($id(&#x27;diaryDate&#x27;)) $id(&#x27;diaryDate&#x27;).value = todayStr();
  var moodRow = $id(&#x27;diaryMood&#x27;);
  if (moodRow &amp;&amp; !moodRow.childElementCount) {
    moodRow.innerHTML = DIARY_MOODS.map(function (m, i) {
      return &#x27;&lt;button class=&quot;mood-btn&#x27; + (i === 0 ? &#x27; active&#x27; : &#x27;&#x27;) + &#x27;&quot; data-mood=&quot;&#x27; + m + &#x27;&quot;&gt;&#x27; + m + &#x27;&lt;/button&gt;&#x27;;
    }).join(&#x27;&#x27;);
    $qa(&#x27;#diaryMood .mood-btn&#x27;).forEach(function (b) {
      b.onclick = function () {
        $qa(&#x27;#diaryMood .mood-btn&#x27;).forEach(function (x) { x.classList.remove(&#x27;active&#x27;); });
        b.classList.add(&#x27;active&#x27;);
      };
    });
  }
  function renderPending() {
    var box = $id(&#x27;diaryPending&#x27;);
    if (!box) return;
    box.innerHTML = diaryPendingFiles.length
      ? &#x27;&lt;span class=&quot;src&quot; style=&quot;margin:0&quot;&gt;待加入：&#x27; + diaryPendingFiles.length + &#x27; 個檔案&lt;/span&gt;&#x27;
      : &#x27;&#x27;;
  }
  if ($id(&#x27;diaryUploadBtn&#x27;)) $id(&#x27;diaryUploadBtn&#x27;).onclick = function () { $id(&#x27;diaryFileIn&#x27;).click(); };
  if ($id(&#x27;diaryFileIn&#x27;)) $id(&#x27;diaryFileIn&#x27;).onchange = function () {
    var fs = Array.prototype.slice.call($id(&#x27;diaryFileIn&#x27;).files || []);
    fs.forEach(function (f) { diaryPendingFiles.push({ name: f.name, type: f.type, blob: f }); });
    $id(&#x27;diaryFileIn&#x27;).value = &#x27;&#x27;;
    renderPending();
  };
  if ($id(&#x27;diaryAnnivBtn&#x27;)) $id(&#x27;diaryAnnivBtn&#x27;).onclick = function () {
    LS.set(&#x27;diary_anniv&#x27;, ($id(&#x27;diaryAnniv&#x27;).value || &#x27;&#x27;).trim());
    renderDiary(); toast(&#x27;紀念日已儲存 ✓&#x27;);
  };
  if ($id(&#x27;diarySaveBtn&#x27;)) $id(&#x27;diarySaveBtn&#x27;).onclick = function () {
    var d = ($id(&#x27;diaryDate&#x27;).value || &#x27;&#x27;).trim();
    var t = ($id(&#x27;diaryText&#x27;).value || &#x27;&#x27;).trim();
    if (!d) { toast(&#x27;請選擇日期&#x27;); return; }
    if (!t &amp;&amp; !diaryPendingFiles.length) { toast(&#x27;寫點字或加入照片吧&#x27;); return; }
    var mood = ($q(&#x27;#diaryMood .mood-btn.active&#x27;) || {}).getAttribute ? $q(&#x27;#diaryMood .mood-btn.active&#x27;).getAttribute(&#x27;data-mood&#x27;) : &#x27;😊&#x27;;
    var rec = { id: &#x27;diary_&#x27; + uid(), date: d, mood: mood, text: t, files: diaryPendingFiles };
    idbAdd(rec).then(function () {
      diaryPendingFiles = [];
      $id(&#x27;diaryText&#x27;).value = &#x27;&#x27;;
      renderPending(); renderDiary();
      toast(&#x27;📔 日記已寫入&#x27;);
    }).catch(function () { toast(&#x27;儲存失敗（檔案太大？）&#x27;); });
  };
  renderDiary();
}

/* ============================================================
   匯出 / 重設 / PWA 安裝
   ============================================================ */
function initGlobal() {
  if ($id(&#x27;exportAllBtn&#x27;)) $id(&#x27;exportAllBtn&#x27;).onclick = function () {
    var data = {};
    LS.keys().forEach(function (k) {
      if (k === &#x27;notif_sent&#x27;) return;
      data[k] = LS.get(k, null);
    });
    data.__export_time = new Date().toISOString();
    downloadText(&#x27;LokYiHub_backup_&#x27; + todayStr() + &#x27;.json&#x27;, JSON.stringify(data, null, 2), &#x27;application/json&#x27;);
    toast(&#x27;已匯出全部資料（JSON）✓&#x27;);
  };
  if ($id(&#x27;resetDataBtn&#x27;)) $id(&#x27;resetDataBtn&#x27;).onclick = function () {
    showConfirm(&#x27;確定要清除「&#x27; + (ACCT === &#x27;ly&#x27; ? &#x27;Lok Yi&#x27; : &#x27;Austin&#x27;) + &#x27;」帳號在本機的所有資料嗎？\n（另一帳號不受影響；建議先匯出備份）&#x27;).then(function (ok) {
      if (!ok) return;
      LS.keys().forEach(function (k) {
        if (ACCT === &#x27;ly&#x27; &amp;&amp; k.indexOf(&#x27;bf_&#x27;) !== 0) LS.del(k);
        if (ACCT === &#x27;bf&#x27; &amp;&amp; (k.indexOf(&#x27;bf_&#x27;) === 0 || k === &#x27;acct&#x27;)) LS.del(k);
      });
      if (ACCT === &#x27;bf&#x27;) LS.set(&#x27;acct&#x27;, &#x27;ly&#x27;);
      toast(&#x27;已重設，重新載入…&#x27;);
      setTimeout(function () { location.reload(); }, 800);
    });
  };
  $id(&#x27;confirmOkBtn&#x27;).onclick = function () { _confirmDone(true); };
  $id(&#x27;confirmCancelBtn&#x27;).onclick = function () { _confirmDone(false); };

  var deferredPrompt = null;
  window.addEventListener(&#x27;beforeinstallprompt&#x27;, function (e) {
    e.preventDefault();
    deferredPrompt = e;
    if ($id(&#x27;installBtn&#x27;)) $id(&#x27;installBtn&#x27;).hidden = false;
  });
  if ($id(&#x27;installBtn&#x27;)) $id(&#x27;installBtn&#x27;).onclick = function () {
    if (!deferredPrompt) { toast(&#x27;請用瀏覽器選單 →「加入主畫面 / 安裝應用程式」&#x27;); return; }
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function () { deferredPrompt = null; $id(&#x27;installBtn&#x27;).hidden = true; });
  };
  window.addEventListener(&#x27;appinstalled&#x27;, function () { toast(&#x27;🎉 已安裝！可從主畫面直接開啟&#x27;); });

  if (&#x27;serviceWorker&#x27; in navigator &amp;&amp; (location.protocol === &#x27;https:&#x27; || location.hostname === &#x27;localhost&#x27; || location.hostname === &#x27;127.0.0.1&#x27;)) {
    navigator.serviceWorker.register(&#x27;sw.js&#x27;).catch(function () {});
  }
}

/* ============================================================
   總渲染 &amp; 初始化
   ============================================================ */
function renderAll() {
  renderDashboard(); renderReg(); renderWie(); renderExchange(); renderFunding();
  renderResume(); renderJobs(); renderTodos(); renderLibrary(); renderIp(); renderStudy();
  renderLyProfile();
  renderBfDash(); renderBfSubjects(); renderBfPrograms(); renderBfMaterials();
  renderBfCv(); renderBfTimeline(); renderBfCareer(); renderBfProfile();
  renderNotifs();
  /* 🆕 v2.1 */
  renderDDay(); renderCalendar(); renderGpaCalc();
  /* 🆕 v2.2 */
  renderAnnouncement();
  /* 🆕 v2.3 */
  renderTodayClasses();
}

document.addEventListener(&#x27;DOMContentLoaded&#x27;, function () {
  /* 側欄遮罩（手機） */
  var mask = document.createElement(&#x27;div&#x27;);
  mask.id = &#x27;sidebarMask&#x27;; mask.className = &#x27;sidebar-mask&#x27;;
  mask.onclick = closeSidebar;
  document.body.appendChild(mask);

  if ($id(&#x27;menuBtn&#x27;)) $id(&#x27;menuBtn&#x27;).onclick = openSidebar;

  $qa(&#x27;.nav-item&#x27;).forEach(function (n) {
    n.addEventListener(&#x27;click&#x27;, function (e) {
      e.preventDefault();
      goPage(n.getAttribute(&#x27;data-target&#x27;));
    });
  });
  $qa(&#x27;.acct-btn&#x27;).forEach(function (b) {
    b.addEventListener(&#x27;click&#x27;, function () {
      if (b.getAttribute(&#x27;data-acct&#x27;) !== ACCT) switchAcct(b.getAttribute(&#x27;data-acct&#x27;));
    });
  });

  initReg(); initWie(); initExchange(); initFunding(); initResume(); initJobs();
  initTodos(); initLibrary(); initIp(); initStudy(); initLyProfile();
  initBfDash(); initBfSubjects(); initBfPrograms(); initBfMaterials();
  initBfCv(); initBfTimeline(); initBfCareer(); initBfProfile();
  initNotifUI(); initLoki(); initGlobal();
  /* 🆕 v2.1 */
  initTheme(); initImport(); initSearch(); initCalendar(); initGpaCalc(); initPrintResume();
  /* 🆕 v2.2 */
  initContent(); initSync(); renderCmDl(); renderCmDd();
  initHelp();
  /* 🆕 v2.3 */
  initTimetableUpload(); initMediaPage(&#x27;media&#x27;, &#x27;ly&#x27;, [&#x27;xhs&#x27;, &#x27;dy&#x27;]);
  initMediaPage(&#x27;bfMedia&#x27;, &#x27;bf&#x27;, [&#x27;xhs&#x27;]); initDiary();

  /* 初始帳號顯示 */
  $qa(&#x27;.acct-btn&#x27;).forEach(function (b) { b.classList.toggle(&#x27;active&#x27;, b.getAttribute(&#x27;data-acct&#x27;) === ACCT); });
  $qa(&#x27;[data-account]&#x27;).forEach(function (el) {
    var a = el.getAttribute(&#x27;data-account&#x27;);
    el.style.display = (a === &#x27;shared&#x27; || a === ACCT) ? &#x27;&#x27; : &#x27;none&#x27;;
  });
  renderSidebarIdentity();
  renderAll();
  renderCalDay(todayStr()); /* 🆕 v2.1：月曆預設顯示今天事項 */
  goPage(ACCT === &#x27;ly&#x27; ? &#x27;dashboard&#x27; : &#x27;bf_dash&#x27;, { keepSidebar: true });

  tickClock(); setInterval(tickClock, 1000);
  setInterval(renderNotifs, 60000);
  setInterval(maybeBrowserNotify, 300000);
  setTimeout(maybeBrowserNotify, 4000);
  /* 每分鐘刷新倒數 */
  setInterval(function () {
    if ($id(&#x27;ctDays&#x27;)) { var n = daysUntil(&#x27;2026-08-31&#x27;); $id(&#x27;ctDays&#x27;).textContent = n &lt; 0 ? &#x27;已過期&#x27; : &#x27;⚠️ 剩 &#x27; + n + &#x27; 天&#x27;; }
    if ($id(&#x27;exDays&#x27;)) { var m = daysUntil(&#x27;2026-09-03&#x27;); $id(&#x27;exDays&#x27;).textContent = m &lt; 0 ? &#x27;已截止&#x27; : &#x27;⚠️ 剩 &#x27; + m + &#x27; 天&#x27;; }
  }, 60000);
});

window.addEventListener(&#x27;error&#x27;, function (e) {
  console.warn(&#x27;[LokYiHub]&#x27;, e.message);
});
})();

