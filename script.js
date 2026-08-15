/* ============================================================
   Lok Yi Hub · script.js
   學生綜合管理平台（Lok Yi + Austin 雙帳號）
   資料儲存：localStorage（lyhub_ 前綴）+ IndexedDB（課堂材料）
   ============================================================ */
(function () {
'use strict';

/* ==================== 工具 ==================== */
var $id = function (i) { return document.getElementById(i); };
var $q  = function (s, r) { return (r || document).querySelector(s); };
var $qa = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function debounce(fn, ms) { var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms || 350); }; }

var LS = {
  get: function (k, d) {
    try { var v = localStorage.getItem('lyhub_' + k); return v == null ? d : JSON.parse(v); }
    catch (e) { return d; }
  },
  set: function (k, v) { try { localStorage.setItem('lyhub_' + k, JSON.stringify(v)); } catch (e) {} },
  del: function (k) { try { localStorage.removeItem('lyhub_' + k); } catch (e) {} },
  keys: function () {
    var out = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf('lyhub_') === 0) out.push(k.slice(6));
    }
    return out;
  }
};

function pad2(n) { return (n < 10 ? '0' : '') + n; }
function todayStr() {
  var d = new Date();
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}
function daysUntil(ds) {
  if (!ds) return null;
  try {
    var p = ds.split('-').map(Number);
    var t = new Date(p[0], p[1] - 1, p[2]);
    var n = new Date(); n = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    return Math.round((t - n) / 86400000);
  } catch (e) { return null; }
}
function fmtD(ds) {
  if (!ds) return '—';
  var p = String(ds).split('-');
  return (+p[0]) + '/' + (+p[1]) + '/' + (+p[2]);
}
var WEEK_ZH = ['日', '一', '二', '三', '四', '五', '六'];
function fmtFull(d) {
  return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate() + '（週' + WEEK_ZH[d.getDay()] + '）';
}
function daysBadge(ds) {
  var n = daysUntil(ds);
  if (n == null) return '';
  if (n < 0) return '已過 ' + Math.abs(n) + ' 天';
  if (n === 0) return '就是今天！';
  return '剩 ' + n + ' 天';
}
function urgencyInfo(ds) {
  var n = daysUntil(ds);
  if (n == null) return { cls: 'ok', label: '未設截止' };
  if (n < 0) return { cls: 'urg', label: '逾期 ' + Math.abs(n) + ' 天' };
  if (n <= 7) return { cls: 'urg', label: '⚠️ ' + n + ' 天' };
  if (n <= 30) return { cls: 'warn', label: n + ' 天' };
  return { cls: 'ok', label: n + ' 天' };
}

/* 確認 Modal（Promise） */
var _confirmResolve = null;
function showConfirm(msg) {
  $id('confirmMsg').textContent = msg;
  $id('confirmModal').hidden = false;
  return new Promise(function (res) { _confirmResolve = res; });
}
function _confirmDone(v) {
  $id('confirmModal').hidden = true;
  if (_confirmResolve) { _confirmResolve(v); _confirmResolve = null; }
}

/* 下載文本 */
function downloadText(name, content, mime) {
  var blob = new Blob([content], { type: (mime || 'text/plain') + ';charset=utf-8' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 600);
}

/* ==================== 全域狀態 ==================== */
var ACCT = LS.get('acct', 'ly');          // 'ly' | 'bf'
var PAGE = 'dashboard';

/* ==================== 固定資料 ==================== */
var FIX = {};

/* LY 重要日程（來源：Academic Registry + SHTM 通告） */
FIX.lyDeadlines = [
  { t: 'Mock 選科開始（09:00）', d: '2026-08-17' },
  { t: '正式選科開始（10:00）', d: '2026-08-21' },
  { t: '正式選科結束（23:59）', d: '2026-08-25' },
  { t: '開學前調整開始（10:30）', d: '2026-08-28' },
  { t: '🚨 WIE 學分轉移 (AR41C) 截止', d: '2026-08-31' },
  { t: 'Semester 1 開課', d: '2026-08-31' },
  { t: '開學前調整結束（23:59）', d: '2026-08-30' },
  { t: '🚨 SHTM 交換計劃申請截止（13:00）', d: '2026-09-03' },
  { t: 'Add / Drop 結束（23:59）', d: '2026-09-12' },
  { t: '交換計劃面試（至 9/8）', d: '2026-09-07' },
  { t: 'TSFS / NLSFT 申請截止', d: '2026-09-25' }
];

/* 學術日曆重點（學習進度頁） */
FIX.calendar = [
  { t: '科目時間表發布', d: '2026-07-27' },
  { t: 'Mock 選科', d: '2026-08-17' },
  { t: '正式選科', d: '2026-08-21' },
  { t: '開學前調整', d: '2026-08-28' },
  { t: 'Sem 1 開課 · WIE 學分轉移截止', d: '2026-08-31' },
  { t: 'Add / Drop 期', d: '2026-08-31' },
  { t: 'SHTM 交換計劃申請截止', d: '2026-09-03' },
  { t: '交換計劃面試', d: '2026-09-07' },
  { t: 'TSFS / NLSFT 截止', d: '2026-09-25' }
];

/* 預設時間表（2026/27 Sem 1 · 可點擊編輯） */
FIX.timetable = [
  { d: 0, t: 10, subj: 'HTM3201 酒店營運管理', room: 'QT308' },
  { d: 0, t: 11, subj: 'HTM3201 酒店營運管理', room: 'QT308' },
  { d: 1, t: 14, subj: 'HTM3212 餐飲管理', room: 'FG301' },
  { d: 2, t: 9,  subj: 'HTM3301 旅遊市場學', room: 'TU101' },
  { d: 2, t: 10, subj: 'HTM3301 旅遊市場學', room: 'TU101' },
  { d: 3, t: 15, subj: 'HTM3402 酒店財務管理', room: 'GH201' },
  { d: 4, t: 11, subj: 'GE3401 通識', room: 'CORE S509' },
  { d: 4, t: 16, subj: 'HTM3201 導修 Tutorial', room: 'QT201' }
];

/* 預設科目（學習進度 · Sem 1） */
FIX.studySubjects = [
  { code: 'HTM3201', name: '酒店營運管理', progress: 0 },
  { code: 'HTM3212', name: '餐飲管理', progress: 0 },
  { code: 'HTM3301', name: '旅遊市場學', progress: 0 },
  { code: 'HTM3402', name: '酒店財務管理', progress: 0 },
  { code: 'GE3401', name: '通識', progress: 0 }
];

/* BF 重要日程（Non-JUPAS 2027/28 · 預計，以各大學官方公佈為準） */
FIX.bfDeadlines = [
  { t: 'HKCC Year 2 上學期開學', d: '2026-09-07' },
  { t: 'IELTS 報名（建議，目標 12 月應考）', d: '2026-10-15' },
  { t: 'PolyU Non-JUPAS 2027/28 開放申請（預計）', d: '2026-09-28' },
  { t: 'CityU Senior Year 開放申請（預計）', d: '2026-10-01' },
  { t: '推薦人確認 + 邀請推薦信（建議）', d: '2026-12-01' },
  { t: 'Personal Statement 完成稿（建議）', d: '2027-01-05' },
  { t: 'PolyU Non-JUPAS 截止（預計）', d: '2027-01-15' },
  { t: 'CityU Non-JUPAS 截止（預計）', d: '2027-01-15' },
  { t: 'HKMU Non-JUPAS 截止（預計）', d: '2027-07-31' }
];

/* BF 預載科目（HKCC · Statistics and Data Science · 12 科 33 學分） */
FIX.bfSubjects = [
  { id: 'f1',  code: 'MATH1014', name: '微積分 I',            cr: 3, type: '必修', term: '2025/26 S1', exp: 'A',  act: 'A',  status: '已完成', prog: 100 },
  { id: 'f2',  code: 'STA1001',  name: '統計學導論',          cr: 3, type: '必修', term: '2025/26 S1', exp: 'A',  act: 'A',  status: '已完成', prog: 100 },
  { id: 'f3',  code: 'COMP1016', name: '程式設計導論（Python）', cr: 3, type: '必修', term: '2025/26 S1', exp: 'A', act: 'A',  status: '已完成', prog: 100 },
  { id: 'f4',  code: 'ENG1001',  name: '學術英語 I',          cr: 3, type: '必修', term: '2025/26 S1', exp: 'A-', act: 'A-', status: '已完成', prog: 100 },
  { id: 'f5',  code: 'GES1001',  name: '通識：社會科學',      cr: 3, type: '必修', term: '2025/26 S1', exp: 'A-', act: 'A-', status: '已完成', prog: 100 },
  { id: 'f6',  code: 'STA1002',  name: '機率與分佈',          cr: 3, type: '必修', term: '2025/26 S2', exp: 'A-', act: 'A-', status: '已完成', prog: 100 },
  { id: 'f7',  code: 'MATH1015', name: '微積分 II',           cr: 3, type: '必修', term: '2025/26 S2', exp: 'A-', act: 'A-', status: '已完成', prog: 100 },
  { id: 'f8',  code: 'COMP2017', name: '資料庫導論',          cr: 3, type: '必修', term: '2025/26 S2', exp: 'A-', act: 'A-', status: '已完成', prog: 100 },
  { id: 'f9',  code: 'ENG1002',  name: '學術英語 II',         cr: 3, type: '必修', term: '2025/26 S2', exp: 'A-', act: 'A-', status: '已完成', prog: 100 },
  { id: 'f10', code: 'STA2011',  name: '應用迴歸分析',        cr: 2, type: '必修', term: '2025/26 S2', exp: 'A-', act: 'A-', status: '已完成', prog: 100 },
  { id: 'f11', code: 'MM1011',   name: '線性代數導論',        cr: 2, type: '必修', term: '2025/26 S2', exp: 'A',  act: 'A',  status: '已完成', prog: 100 },
  { id: 'f12', code: 'GES1002',  name: '通識：數據素養',      cr: 2, type: '選修', term: '2025/26 S2', exp: 'A-', act: 'A-', status: '已完成', prog: 100 }
];

/* BF Non-JUPAS 院校庫（PolyU 為官方歷年平均參考，其餘為估算） */
FIX.programs = [
  { key: 'p1', uni: 'PolyU',  name: 'BSc (Hons) Data Science and Analytics',            field: '數據科學',   avg: 3.61, min: 3.40, src: '官方', pros: '課程完全對口 · 涵蓋 ML / 大數據 · PolyU 品牌強', cons: '競爭激烈 · 高 GPA 申請者多' },
  { key: 'p2', uni: 'PolyU',  name: 'BSc (Hons) Financial Technology and AI',            field: '金融科技×AI', avg: 3.74, min: 3.50, src: '官方', pros: '出路廣（金融+科技）· 薪資高', cons: '歷年平均 GPA 最高 · 屬衝刺課程' },
  { key: 'p3', uni: 'PolyU',  name: 'BSc (Hons) Computing and Artificial Intelligence',  field: '計算機×AI',  avg: 3.48, min: 3.30, src: '官方', pros: 'AI 熱門方向 · 課程新', cons: '編程要求高 · 需作品集加分' },
  { key: 'p4', uni: 'CityU',  name: 'BSc (Hons) Data Science',                           field: '數據科學',   avg: 3.40, min: 3.20, src: '估算', pros: '名額相對多 · 課程實用', cons: '非官方數據 · 需到官網核實' },
  { key: 'p5', uni: 'CityU',  name: 'BSc (Hons) Computer Science',                       field: '計算機',     avg: 3.45, min: 3.25, src: '估算', pros: '計算機基礎扎實 · 轉碼友好', cons: '競爭大 · 數學要求高' },
  { key: 'p6', uni: 'CityU',  name: 'BSc (Hons) Computing Mathematics',                  field: '計算數學',   avg: 3.20, min: 3.00, src: '估算', pros: '門檻較低 · 統計背景有優勢', cons: '出路偏精算 / 研究' },
  { key: 'p7', uni: 'HKUST',  name: 'BSc (Hons) Data Science and Technology',            field: '數據科學',   avg: 3.85, min: 3.65, src: '估算', pros: '全港最頂級 · 校譽極高', cons: 'Senior Year 名額極少 · 屬高風險衝刺' },
  { key: 'p8', uni: 'HKMU',   name: 'BSc (Hons) Data Science and Business Analytics',    field: '數據×商業',  avg: 2.90, min: 2.50, src: '估算', pros: '門檻低 · 保底之選 · 收生友善', cons: '校譽較弱 · 需靠個人努力補足' },
  { key: 'p9', uni: 'HKMU',   name: 'BSc (Hons) Computing Studies',                      field: '計算機',     avg: 2.70, min: 2.40, src: '估算', pros: '保底課程 · 銜接 IT 行業', cons: '課程深度一般' },
  { key: 'p10', uni: 'HSUHK', name: 'BSc (Hons) Data Science and Business Analytics',    field: '數據×商業',  avg: 3.10, min: 2.80, src: '估算', pros: '私大中口碑好 · 商科資源多', cons: '學費較高 · 認受性中等' }
];

/* BF 申請材料預設 */
FIX.bfMaterials = [
  { id: 'm1', name: 'HKCC 正式成績表（Transcript）', status: '已完成', note: '需向 HKCC AR 申請並直接寄送各大學', link: '' },
  { id: 'm2', name: 'CV（英文）', status: '未開始', note: '一頁式 · 突出 GPA / 程式 / 專案', link: '' },
  { id: 'm3', name: 'Personal Statement', status: '未開始', note: '500–800 字 · 每校客製化', link: '' },
  { id: 'm4', name: '推薦信 #1（學術）', status: '未開始', note: '邀請統計 / 數學講師', link: '' },
  { id: 'm5', name: '推薦信 #2', status: '未開始', note: '講師或導師', link: '' },
  { id: 'm6', name: '證件相（白色背景）', status: '未開始', note: '電子版 · 符合各校規格', link: '' }
];

/* BF CV 行動清單預設 */
FIX.bfCvActions = [
  { t: '整理 Year 1–2 所有科目成績與重點項目', done: false },
  { t: '完成一個 Python / R 數據分析專案並放上 GitHub', done: false },
  { t: '學習 SQL 基礎（完成一個線上課程）', done: false },
  { t: '製作 Data Visualization 作品（Tableau / Power BI）', done: false },
  { t: '撰寫 CV 初稿（一頁英文版）', done: false },
  { t: '請講師審閱 CV 並修改兩輪', done: false }
];

/* BF 求職渠道預設 */
FIX.bfChannels = [
  { t: 'LinkedIn 香港（數據岗實習）', done: false },
  { t: 'JobsDB · CTgoodjobs（Data Analyst）', done: false },
  { t: 'HKCC Career Center / PolyU Job Board', done: false },
  { t: '公司官網 Career 頁（銀行 MT / 科企）', done: false },
  { t: '內推：學長姐 / 講師介紹', done: false }
];

/* 交換計劃文件清單預設 */
FIX.exCheck = [
  { t: 'Course Selection Form', done: false },
  { t: 'Supporting Statement（400–500 字）', done: false },
  { t: 'Updated CV in English', done: false },
  { t: 'Latest Academic Transcript（全頁掃描）', done: false },
  { t: 'English Proficiency Test（如有）', done: false },
  { t: 'Passport-style Photo（600W × 800H px）', done: false }
];

/* ==================== 預設個人檔案 ==================== */
var DEF_LY = { name: 'Lok Yi, Chan（陳樂怡）', school: '香港理工大學 PolyU', year: 'Year 3（HKCC Asso 升讀）', major: 'SHTM 酒店及旅遊業管理學院', gpa: '', targetGpa: '', note: '' };
var DEF_BF = { name: 'Austin（XIE Haojun）', sid: '25203655A', school: 'PolyU HKCC（西九龍校園）', year: 'Year 2（來年 Year 3）', major: 'Statistics and Data Science', gpa: 3.78, target: 3.80, note: '成績表姓名為 XIE Haojun，日常稱 Austin。' };

/* ==================== 導航 / 帳號 ==================== */
function goPage(target, opts) {
  PAGE = target;
  $qa('.page').forEach(function (p) { p.classList.remove('active'); });
  var pg = $id('page-' + target);
  if (pg) pg.classList.add('active');
  $qa('.nav-item').forEach(function (n) {
    n.classList.toggle('active', n.getAttribute('data-target') === target);
  });
  var nav = $q('.nav-item[data-target="' + target + '"]');
  if (nav) {
    var label = nav.querySelector('span:last-child');
    if ($id('pageTitle')) $id('pageTitle').textContent = label ? label.textContent : '';
  }
  if ($id('aiContextPage')) {
    $id('aiContextPage').textContent = ($id('pageTitle') || {}).textContent || '';
    if (window.LokiAI && window.LokiAI.renderQuick) window.LokiAI.renderQuick();
  }
  if (!(opts && opts.keepSidebar)) closeSidebar();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function switchAcct(a) {
  ACCT = a; LS.set('acct', a);
  $qa('.acct-btn').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-acct') === a); });
  $qa('[data-account]').forEach(function (el) {
    el.style.display = (el.getAttribute('data-account') === a) ? '' : 'none';
  });
  renderSidebarIdentity();
  goPage(a === 'ly' ? 'dashboard' : 'bf_dash', { keepSidebar: false });
  renderAll();
}

function renderSidebarIdentity() {
  if (ACCT === 'ly') {
    var p = LS.get('ly_profile', DEF_LY);
    if ($id('sbAvatar')) $id('sbAvatar').textContent = 'LY';
    if ($id('sbName')) $id('sbName').textContent = p.name || 'Lok Yi, Chan';
    if ($id('sbMeta')) $id('sbMeta').textContent = 'PolyU · SHTM · Year 3';
    if ($id('sbId')) $id('sbId').textContent = '26017276D';
    if ($id('sbMail')) $id('sbMail').style.display = '';
  } else {
    var b = LS.get('bf_profile', DEF_BF);
    var nm = (b.name || 'Austin').trim();
    var ini = nm.replace(/[^\x00-\x7F]/g, '').split(/[\s(]+/).filter(Boolean).map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase() || 'AX';
    if ($id('sbAvatar')) $id('sbAvatar').textContent = ini;
    if ($id('sbName')) $id('sbName').textContent = nm;
    if ($id('sbMeta')) $id('sbMeta').textContent = 'PolyU HKCC · Stat & Data Sci';
    if ($id('sbId')) $id('sbId').textContent = b.sid || '25203655A';
    if ($id('sbMail')) $id('sbMail').style.display = 'none';
  }
}

function openSidebar() {
  $id('sidebar').classList.add('open');
  var mask = $id('sidebarMask');
  if (mask) mask.classList.add('show');
}
function closeSidebar() {
  $id('sidebar').classList.remove('open');
  var mask = $id('sidebarMask');
  if (mask) mask.classList.remove('show');
}

/* ==================== 時鐘 ==================== */
function tickClock() {
  var d = new Date();
  var s = pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds()) + ' · ' + fmtFull(d);
  if ($id('clock')) $id('clock').textContent = s;
}

/* ==================== 通用渲染小工具 ==================== */
function delBtn(fn) {
  var b = document.createElement('button');
  b.className = 'row-del'; b.title = '刪除'; b.innerHTML = '🗑';
  b.onclick = function (e) { e.stopPropagation(); fn(); };
  return b;
}
function toast(msg) {
  var t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:86px;background:#111827;color:#fff;padding:9px 18px;border-radius:999px;font-size:13px;font-weight:600;z-index:200;box-shadow:0 8px 24px rgba(0,0,0,.3);opacity:0;transition:opacity .25s;';
  document.body.appendChild(t);
  requestAnimationFrame(function () { t.style.opacity = '1'; });
  setTimeout(function () { t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 300); }, 2200);
}

/* 綁定輸入框 → 狀態 */
function bindInput(id, storeKey, field, after) {
  var el = $id(id); if (!el) return;
  var load = function () { el.value = LS.get(storeKey, {})[field] != null ? LS.get(storeKey, {})[field] : ''; };
  load();
  el.addEventListener('input', debounce(function () {
    var o = LS.get(storeKey, {});
    o[field] = el.type === 'number' ? (el.value === '' ? '' : Number(el.value)) : el.value;
    LS.set(storeKey, o);
    if (after) after(o);
  }, 300));
}

/* ============================================================
   模塊 1：Dashboard（Lok Yi）
   ============================================================ */
function renderDashboard() {
  var d = new Date();
  if ($id('todayDate')) $id('todayDate').textContent = fmtFull(d);
  if ($id('dashHello')) $id('dashHello').textContent = 'Hi Lok Yi 👋';

  var todos = LS.get('todos', []);
  var jobs = LS.get('jobs', []);
  var vers = LS.get('versions', []);
  if ($id('statTodo')) $id('statTodo').textContent = todos.filter(function (t) { return !t.done; }).length;
  if ($id('statDone')) $id('statDone').textContent = todos.filter(function (t) { return t.done; }).length;
  if ($id('statJobs')) $id('statJobs').textContent = jobs.length;
  if ($id('statResume')) $id('statResume').textContent = vers.length;

  /* 緊急 / 即將到期 */
  var items = [];
  FIX.lyDeadlines.forEach(function (x) { items.push({ t: x.t, d: x.d, src: '日程' }); });
  todos.filter(function (t) { return !t.done && t.due; }).forEach(function (t) { items.push({ t: '📋 ' + t.t, d: t.due, src: '待辦' }); });
  items.forEach(function (x) { x.n = daysUntil(x.d); });
  var urg = items.filter(function (x) { return x.n != null && x.n >= 0 && x.n <= 7; }).sort(function (a, b) { return a.n - b.n; });
  var soon = items.filter(function (x) { return x.n != null && x.n > 7 && x.n <= 30; }).sort(function (a, b) { return a.n - b.n; });

  function html(list, emptyMsg) {
    if (!list.length) return '<div class="empty-tip">' + emptyMsg + '</div>';
    return list.map(function (x) {
      var cls = x.n <= 7 ? 'urg' : 'warn';
      var day = x.n === 0 ? '今天！' : x.n + ' 天後';
      return '<div class="alert-item ' + cls + '"><span>' + esc(x.t) + ' <b style="font-size:11px;color:#9ca3af">(' + fmtD(x.d) + ')</b></span><span class="days">' + day + '</span></div>';
    }).join('');
  }
  if ($id('urgentList')) $id('urgentList').innerHTML = html(urg, '🎉 7 日內無緊急事項');
  if ($id('soonList')) $id('soonList').innerHTML = html(soon, '30 日內無其他待辦');

  /* 個人資訊 */
  var p = LS.get('ly_profile', DEF_LY);
  if ($id('dashName')) $id('dashName').textContent = p.name || '—';
  if ($id('dashMajor')) $id('dashMajor').textContent = p.major || '—';
  if ($id('dashYear')) $id('dashYear').textContent = p.year || '—';
  if ($id('dashSchool')) $id('dashSchool').textContent = p.school || '—';
  if ($id('dashGpa')) $id('dashGpa').textContent = p.gpa || '—';
  if ($id('dashTargetGpa')) $id('dashTargetGpa').textContent = p.targetGpa || '—';
  if ($id('dashNote')) $id('dashNote').textContent = p.note || '—';

  var wie = LS.get('wie', { req: 960, done: 0 });
  if ($id('wieReqText')) $id('wieReqText').textContent = wie.req + ' 小時';
  if ($id('wieDoneText')) $id('wieDoneText').textContent = (wie.done || 0) + ' 小時';

  var reg = LS.get('reg', { target: 120 });
  if ($id('totalCrText')) $id('totalCrText').textContent = (reg.target || 120) + ' 學分';
  if ($id('doneCrText')) $id('doneCrText').textContent = (reg.done || 0) + ' 學分';
}

/* ============================================================
   模塊 2：REG & 學分管理
   ============================================================ */
function renderReg() {
  var r = LS.get('reg', { done: 0, ge: 0, major: 0, elec: 0, xge: 6, target: 120 });
  ['done', 'ge', 'major', 'elec', 'xge', 'target'].forEach(function (f) {
    var el = $id('cr' + f.charAt(0).toUpperCase() + f.slice(1)); if (!el) return;
    if (document.activeElement !== el) el.value = r[f] != null ? r[f] : (f === 'target' ? 120 : (f === 'xge' ? 6 : 0));
  });
  var pct = Math.min(100, Math.round(((r.done || 0) / (r.target || 120)) * 100));
  if ($id('crBar')) $id('crBar').style.width = pct + '%';

  /* 科目資料庫 */
  var subs = LS.get('subjects', []);
  if ($id('subTbody')) {
    $id('subTbody').innerHTML = subs.length ? subs.map(function (s, i) {
      return '<tr><td><b>' + esc(s.code) + '</b></td><td>' + esc(s.name) + '</td><td>' + esc(s.grade || '—') + '</td><td>' + (s.note ? '<a href="' + esc(s.note) + '" target="_blank" rel="noopener">🔗 連結</a>' : '—') + '</td><td></td></tr>';
    }).join('') + '' : '<tr><td colspan="5" class="empty-tip">尚未新增科目（例：HTM3201）</td></tr>';
    var rows = $id('subTbody').querySelectorAll('tr');
    subs.forEach(function (s, i) {
      if (rows[i]) rows[i].appendChild(delBtnCell(function () {
        subs.splice(i, 1); LS.set('subjects', subs); renderReg();
      }));
    });
  }

  /* 畢業路徑 */
  var sim = LS.get('sim', []);
  if ($id('simList')) {
    $id('simList').innerHTML = sim.length ? sim.map(function (s, i) {
      return '<li><span>🗓 <b>' + esc(s.yr) + '</b> · ' + esc(s.list) + '</span></li>';
    }).join('') : '<li class="empty-tip" style="background:none;padding:8px 4px">尚未加入計劃</li>';
    var lis = $id('simList').querySelectorAll('li');
    sim.forEach(function (s, i) {
      if (lis[i]) lis[i].appendChild(delBtnCell(function () { sim.splice(i, 1); LS.set('sim', sim); renderReg(); }));
    });
  }
}
function delBtnCell(fn) { var td = document.createElement('td'); td.appendChild(delBtn(fn)); return td; }

function initReg() {
  ['crDone', 'crGE', 'crMajor', 'crElec', 'crXGE', 'crTarget'].forEach(function (id) {
    var el = $id(id); if (!el) return;
    el.addEventListener('input', debounce(function () {
      var r = LS.get('reg', {});
      var map = { crDone: 'done', crGE: 'ge', crMajor: 'major', crElec: 'elec', crXGE: 'xge', crTarget: 'target' };
      r[map[id]] = el.value === '' ? 0 : Number(el.value);
      LS.set('reg', r); renderReg(); renderDashboard();
    }, 250));
  });
  if ($id('addSubBtn')) $id('addSubBtn').onclick = function () {
    var c = $id('subCode').value.trim(), n = $id('subName').value.trim();
    if (!c || !n) { toast('請填寫科目編號和名稱'); return; }
    var subs = LS.get('subjects', []);
    subs.push({ code: c, name: n, grade: $id('subGrade').value.trim(), note: '' });
    LS.set('subjects', subs);
    $id('subCode').value = $id('subName').value = $id('subGrade').value = '';
    renderReg(); toast('已新增 ' + c);
  };
  if ($id('addSimBtn')) $id('addSimBtn').onclick = function () {
    var y = $id('simYr').value.trim(), l = $id('subList').value.trim();
    if (!y || !l) { toast('請填寫學期和科目'); return; }
    var sim = LS.get('sim', []);
    sim.push({ yr: y, list: l });
    LS.set('sim', sim);
    $id('simYr').value = $id('subList').value = '';
    renderReg(); toast('已加入畢業路徑計劃');
  };
}

/* ============================================================
   模塊 3：WIE
   ============================================================ */
function renderWie() {
  var wie = LS.get('wie', { req: 960, done: 0, due: '' });
  if (document.activeElement !== $id('wieReq')) $id('wieReq').value = wie.req || 960;
  if (document.activeElement !== $id('wieDone')) $id('wieDone').value = wie.done || 0;
  if (document.activeElement !== $id('wieDue')) $id('wieDue').value = wie.due || '';
  var pct = Math.min(100, Math.round(((wie.done || 0) / (wie.req || 960)) * 100));
  if ($id('wieBar')) $id('wieBar').style.width = pct + '%';

  var n = daysUntil('2026-08-31');
  if ($id('ctDays')) $id('ctDays').textContent = n == null ? '' : (n < 0 ? '已過期' : '⚠️ 剩 ' + n + ' 天');

  var list = LS.get('interns', []);
  if ($id('intTbody')) {
    $id('intTbody').innerHTML = list.length ? list.map(function (s) {
      return '<tr><td><b>' + esc(s.pos) + '</b></td><td>' + esc(s.co) + '</td><td>' + fmtD(s.start) + '</td><td>' + fmtD(s.end) + '</td><td>' + esc(s.hr || '—') + '</td><td></td></tr>';
    }).join('') : '<tr><td colspan="6" class="empty-tip">尚未新增實習記錄</td></tr>';
    var rows = $id('intTbody').querySelectorAll('tr');
    list.forEach(function (s, i) {
      if (rows[i]) rows[i].appendChild(delBtnCell(function () { list.splice(i, 1); LS.set('interns', list); renderWie(); }));
    });
  }
  if ($id('intNotes')) { var v = LS.get('wie_notes', ''); if (document.activeElement !== $id('intNotes')) $id('intNotes').value = v; }
}
function initWie() {
  ['wieReq', 'wieDone', 'wieDue'].forEach(function (id) {
    var el = $id(id); if (!el) return;
    el.addEventListener('input', debounce(function () {
      var w = LS.get('wie', {});
      if (id === 'wieDue') w.due = el.value;
      else w[id === 'wieReq' ? 'req' : 'done'] = el.value === '' ? 0 : Number(el.value);
      LS.set('wie', w); renderWie(); renderDashboard();
    }, 250));
  });
  if ($id('addIntBtn')) $id('addIntBtn').onclick = function () {
    var p = $id('intPos').value.trim(), c = $id('intCo').value.trim();
    if (!p || !c) { toast('請填寫崗位和公司'); return; }
    var list = LS.get('interns', []);
    list.push({ pos: p, co: c, start: $id('intStart').value, end: $id('intEnd').value, hr: $id('intHr').value });
    LS.set('interns', list);
    ['intPos', 'intCo', 'intStart', 'intEnd', 'intHr'].forEach(function (i) { $id(i).value = ''; });
    renderWie(); toast('已新增實習記錄');
    /* 自動累加 WIE 工時 */
    var h = Number($id('intHr').value) || 0;
    if (h > 0) toast('提示：記得更新上方「已完成工時」');
  };
  if ($id('intNotes')) $id('intNotes').addEventListener('input', debounce(function () { LS.set('wie_notes', $id('intNotes').value); }, 400));
}

/* ============================================================
   模塊 4：Exchange
   ============================================================ */
function renderExchange() {
  var n = daysUntil('2026-09-03');
  if ($id('exDays')) $id('exDays').textContent = n == null ? '' : (n < 0 ? '已截止' : '⚠️ 剩 ' + n + ' 天');

  var chk = LS.get('exchk', FIX.exCheck.slice());
  if ($id('exCheckList')) {
    $id('exCheckList').innerHTML = chk.map(function (c, i) {
      return '<li class="' + (c.done ? 'done' : '') + '"><input type="checkbox" data-i="' + i + '" ' + (c.done ? 'checked' : '') + ' /><span>' + esc(c.t) + '</span><button class="row-del" data-del="' + i + '" style="margin-left:auto">🗑</button></li>';
    }).join('');
    $qa('#exCheckList input[type=checkbox]').forEach(function (cb) {
      cb.onchange = function () { var a = LS.get('exchk', []); a[+cb.dataset.i].done = cb.checked; LS.set('exchk', a); renderExchange(); };
    });
    $qa('#exCheckList .row-del').forEach(function (b) {
      b.onclick = function () { var a = LS.get('exchk', []); a.splice(+b.dataset.del, 1); LS.set('exchk', a); renderExchange(); };
    });
  }
  var sch = LS.get('exschools', []);
  if ($id('exTbody')) {
    $id('exTbody').innerHTML = sch.length ? sch.map(function (s) {
      return '<tr><td><b>' + esc(s.s) + '</b></td><td>' + esc(s.gpa || '—') + '</td><td>' + esc(s.lang || '—') + '</td><td>' + esc(s.note || '—') + '</td><td></td></tr>';
    }).join('') : '<tr><td colspan="5" class="empty-tip">尚未新增心儀院校（例：EHL 瑞士）</td></tr>';
    var rows = $id('exTbody').querySelectorAll('tr');
    sch.forEach(function (s, i) {
      if (rows[i]) rows[i].appendChild(delBtnCell(function () { sch.splice(i, 1); LS.set('exschools', sch); renderExchange(); }));
    });
  }
}
function initExchange() {
  if ($id('addExChkBtn')) $id('addExChkBtn').onclick = function () {
    var v = $id('exChkInput').value.trim(); if (!v) return;
    var a = LS.get('exchk', []); a.push({ t: v, done: false }); LS.set('exchk', a);
    $id('exChkInput').value = ''; renderExchange();
  };
  if ($id('addExBtn')) $id('addExBtn').onclick = function () {
    var s = $id('exSchool').value.trim(); if (!s) { toast('請填寫學校名稱'); return; }
    var a = LS.get('exschools', []);
    a.push({ s: s, gpa: $id('exGPA').value.trim(), lang: $id('exLang').value.trim(), note: $id('exNote').value.trim() });
    LS.set('exschools', a);
    ['exSchool', 'exGPA', 'exLang', 'exNote'].forEach(function (i) { $id(i).value = ''; });
    renderExchange(); toast('已新增院校');
  };
}

/* ============================================================
   模塊 5：政府資助
   ============================================================ */
function renderFunding() {
  var st = LS.get('fund_status', {});
  $qa('.status-sel').forEach(function (sel) {
    var k = sel.getAttribute('data-key');
    if (st[k] && document.activeElement !== sel) sel.value = st[k];
    sel.onchange = function () { var o = LS.get('fund_status', {}); o[k] = sel.value; LS.set('fund_status', o); toast('已記錄狀態：' + sel.value); };
  });
  var list = LS.get('funds', []);
  if ($id('fnTbody')) {
    $id('fnTbody').innerHTML = list.length ? list.map(function (f, i) {
      var u = urgencyInfo(f.due);
      return '<tr><td><b>' + esc(f.name) + '</b></td><td class="' + (u.cls === 'urg' ? 'red' : '') + '">' + fmtD(f.due) + '</td><td>' + esc(f.doc || '—') + '</td><td>' +
        '<select data-i="' + i + '"><option>未開始</option><option>準備中</option><option>已遞交</option><option>已批核</option></select></td><td></td></tr>';
    }).join('') : '<tr><td colspan="5" class="empty-tip">尚未新增自訂資助項目</td></tr>';
    var sels = $id('fnTbody').querySelectorAll('select');
    sels.forEach(function (sel) {
      var i = +sel.getAttribute('data-i');
      if (list[i].status) sel.value = list[i].status;
      sel.onchange = function () { var a = LS.get('funds', []); a[i].status = sel.value; LS.set('funds', a); };
    });
    var rows = $id('fnTbody').querySelectorAll('tr');
    list.forEach(function (f, i) {
      if (rows[i]) rows[i].appendChild(delBtnCell(function () { list.splice(i, 1); LS.set('funds', list); renderFunding(); }));
    });
  }
}
function initFunding() {
  if ($id('addFnBtn')) $id('addFnBtn').onclick = function () {
    var n = $id('fnName').value.trim(); if (!n) { toast('請填寫資助名稱'); return; }
    var a = LS.get('funds', []);
    a.push({ name: n, due: $id('fnDue').value, doc: $id('fnDoc').value.trim(), status: '未開始' });
    LS.set('funds', a);
    $id('fnName').value = $id('fnDue').value = $id('fnDoc').value = '';
    renderFunding(); toast('已新增資助項目');
  };
}

/* ============================================================
   模塊 6：簡歷生成器
   ============================================================ */
var RESUME_FIELDS = ['rName', 'rPhone', 'rEmail', 'rSchool', 'rGPA', 'rLang', 'rIntro', 'rExp', 'rProj', 'rSkill', 'rExtra'];
var RESUME_TPL = 'intern';

function resumeData() {
  var r = LS.get('resume', {});
  return {
    name: r.rName || 'Lok Yi, Chan',
    phone: r.rPhone || '',
    email: r.rEmail || '26017276d@connect.polyu.hk',
    school: r.rSchool || 'The Hong Kong Polytechnic University · SHTM (Year 3)',
    gpa: r.rGPA || '',
    lang: r.rLang || 'Cantonese (Native), Mandarin (Fluent), English (Fluent)',
    intro: r.rIntro || '', exp: r.rExp || '', proj: r.rProj || '',
    skill: r.rSkill || '', extra: r.rExtra || ''
  };
}
function buildResume(tpl) {
  var d = resumeData();
  var L = [];
  var hr = '──────────────────────────────';
  function sec(t) { L.push('', t.toUpperCase(), hr); }
  L.push(d.name);
  var contact = [d.phone, d.email].filter(Boolean).join(' · ');
  if (contact) L.push(contact);
  L.push(d.school + (d.gpa ? ' · GPA ' + d.gpa : ''));

  if (tpl === 'intern') {
    L.push('', 'OBJECTIVE', hr);
    L.push(d.intro || 'Seeking a marketing / event management internship where I can apply my hospitality training, creative planning and photography skills.');
    if (d.exp) { sec('Experience'); d.exp.split('\n').filter(Boolean).forEach(function (x) { L.push('• ' + x.trim()); }); }
    if (d.proj) { sec('Projects'); d.proj.split('\n').filter(Boolean).forEach(function (x) { L.push('• ' + x.trim()); }); }
    if (d.skill) { sec('Skills'); L.push(d.skill.split(/[,，\n]/).map(function (s) { return s.trim(); }).filter(Boolean).join(' · ')); }
    if (d.extra) { sec('Activities & Awards'); d.extra.split('\n').filter(Boolean).forEach(function (x) { L.push('• ' + x.trim()); }); }
    sec('Languages'); L.push(d.lang);
  } else if (tpl === 'exchange') {
    L.push('', 'PERSONAL STATEMENT — STUDENT EXCHANGE APPLICATION', hr);
    L.push(d.intro || 'As a Year 3 SHTM student, I am eager to broaden my horizon through the exchange programme, experiencing hospitality education in a different culture.');
    if (d.exp) { sec('Relevant Experience'); d.exp.split('\n').filter(Boolean).forEach(function (x) { L.push('• ' + x.trim()); }); }
    if (d.proj) { sec('Coursework & Projects'); d.proj.split('\n').filter(Boolean).forEach(function (x) { L.push('• ' + x.trim()); }); }
    if (d.skill) { sec('Skills & Interests'); L.push(d.skill.split(/[,，\n]/).map(function (s) { return s.trim(); }).filter(Boolean).join(' · ')); }
    if (d.extra) { sec('Extracurricular'); d.extra.split('\n').filter(Boolean).forEach(function (x) { L.push('• ' + x.trim()); }); }
    sec('Languages'); L.push(d.lang);
  } else if (tpl === 'fund') {
    L.push('', 'FINANCIAL ASSISTANCE APPLICATION — SUMMARY', hr);
    L.push('此版本用於 TSFS / NLSFT / PolyU FA 等資助申請的自我介紹與家庭狀況補充說明。');
    if (d.intro) { L.push('', '自我介紹', hr); L.push(d.intro); }
    if (d.exp) { sec('Part-time / Work Experience（收入證明相關）'); d.exp.split('\n').filter(Boolean).forEach(function (x) { L.push('• ' + x.trim()); }); }
    if (d.extra) { sec('Other Information'); d.extra.split('\n').filter(Boolean).forEach(function (x) { L.push('• ' + x.trim()); }); }
    sec('Contact'); L.push(d.email + (d.phone ? ' · ' + d.phone : ''));
  } else {
    L.push('', 'PERSONAL STATEMENT — MSc IN NEW MEDIA (CUHK)', hr);
    L.push(d.intro || 'With a hospitality management background and hands-on experience in content creation and photography, I aspire to become a new media professional.');
    if (d.exp) { sec('Experience'); d.exp.split('\n').filter(Boolean).forEach(function (x) { L.push('• ' + x.trim()); }); }
    if (d.proj) { sec('Portfolio & Projects'); d.proj.split('\n').filter(Boolean).forEach(function (x) { L.push('• ' + x.trim()); }); }
    if (d.skill) { sec('Skills'); L.push(d.skill.split(/[,，\n]/).map(function (s) { return s.trim(); }).filter(Boolean).join(' · ')); }
    if (d.extra) { sec('Activities & Awards'); d.extra.split('\n').filter(Boolean).forEach(function (x) { L.push('• ' + x.trim()); }); }
    sec('Languages'); L.push(d.lang);
  }
  L.push('', '（生成時間：' + fmtFull(new Date()) + '）');
  return L.join('\n');
}
function renderResume() {
  var r = LS.get('resume', {});
  RESUME_FIELDS.forEach(function (f) {
    var el = $id(f); if (!el) return;
    if (document.activeElement !== el) el.value = r[f] || '';
  });
  var vers = LS.get('versions', []);
  if ($id('verList')) {
    $id('verList').innerHTML = vers.length ? vers.map(function (v) {
      return '<li><span>📄 <b>' + esc(v.name) + '</b><br><span style="font-size:11px;color:#9ca3af">' + v.ts + ' · ' + v.tpl + '</span></span></li>';
    }).join('') : '<li class="empty-tip" style="background:none;padding:8px 4px">尚未儲存版本</li>';
    var lis = $id('verList').querySelectorAll('li');
    vers.forEach(function (v, i) {
      if (!lis[i]) return;
      var load = document.createElement('button'); load.className = 'ghost'; load.textContent = '載入'; load.style.padding = '4px 10px';
      load.onclick = function () { if ($id('resumeOut')) $id('resumeOut').value = v.content; toast('已載入版本：' + v.name); };
      var del = delBtn(function () { vers.splice(i, 1); LS.set('versions', vers); renderResume(); });
      lis[i].appendChild(load); lis[i].appendChild(del);
    });
  }
}
function initResume() {
  RESUME_FIELDS.forEach(function (f) {
    var el = $id(f); if (!el) return;
    el.addEventListener('input', debounce(function () {
      var r = LS.get('resume', {}); r[f] = el.value; LS.set('resume', r);
    }, 350));
  });
  $qa('.tab[data-tpl]').forEach(function (t) {
    t.onclick = function () {
      $qa('.tab[data-tpl]').forEach(function (x) { x.classList.remove('active'); });
      t.classList.add('active');
      RESUME_TPL = t.getAttribute('data-tpl');
      var r = LS.get('resume', {}); r.tpl = RESUME_TPL; LS.set('resume', r);
    };
  });
  var savedTpl = LS.get('resume', {}).tpl;
  if (savedTpl) {
    RESUME_TPL = savedTpl;
    $qa('.tab[data-tpl]').forEach(function (x) { x.classList.toggle('active', x.getAttribute('data-tpl') === savedTpl); });
  }
  if ($id('genResumeBtn')) $id('genResumeBtn').onclick = function () {
    if ($id('resumeOut')) $id('resumeOut').value = buildResume(RESUME_TPL);
    toast('已生成「' + ({ intern: '求職實習版', exchange: '交換申請版', fund: '資助申請版', cuhk: '升學申請版' }[RESUME_TPL]) + '」簡歷');
  };
  if ($id('copyResumeBtn')) $id('copyResumeBtn').onclick = function () {
    var txt = ($id('resumeOut') || {}).value || '';
    if (!txt) { toast('請先按「生成簡歷」'); return; }
    if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { toast('已複製到剪貼板 ✓'); });
    else { $id('resumeOut').select(); document.execCommand('copy'); toast('已複製'); }
  };
  if ($id('dlResumeBtn')) $id('dlResumeBtn').onclick = function () {
    var txt = ($id('resumeOut') || {}).value || '';
    if (!txt) { toast('請先按「生成簡歷」'); return; }
    downloadText('LokYi_Resume_' + RESUME_TPL + '_' + todayStr() + '.txt', txt);
  };
  if ($id('saveVerBtn')) $id('saveVerBtn').onclick = function () {
    var txt = ($id('resumeOut') || {}).value || '';
    if (!txt) { toast('請先生成簡歷'); return; }
    var vers = LS.get('versions', []);
    var d = new Date();
    vers.push({ name: RESUME_TPL + '-' + pad2(d.getMonth() + 1) + '/' + pad2(d.getDate()) + ' #' + (vers.length + 1), ts: fmtFull(d) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()), tpl: RESUME_TPL, content: txt });
    LS.set('versions', vers); renderResume(); renderDashboard(); toast('已儲存版本 ✓');
  };

  /* AI 內聯生成（本地模板） */
  $qa('.ai-inline-btn[data-ai]').forEach(function (btn) {
    btn.onclick = function () {
      var f = btn.getAttribute('data-ai'), el = $id(f); if (!el) return;
      var d = resumeData();
      if (f === 'rIntro') {
        el.value = '香港理工大學 SHTM Year 3 學生，主修酒店及旅遊業管理，熟悉市場營銷、活動策劃與旅遊行程設計，兼具攝影與新媒體內容製作經驗。曾於 HKCC 修畢副學士課程並成功升讀學位課程，具備跨文化溝通能力（粵語、普通話、英語流利）。希望將酒店業的服務思維與新媒體的創意結合，未來目標攻讀 CUHK 新媒體碩士，成為兼具內容創作與品牌行銷能力的專業人士。';
      } else if (f === 'rExp') {
        var base = el.value.split('\n').filter(Boolean);
        el.value = (base.length ? base : ['Marketing Intern | （公司名） | 2025 | 支援社交媒體內容策劃，製作圖文及短影片，提升帳號互動率', 'Event Assistant | （活動名稱） | 2025 | 協助活動流程安排、賓客接待與現場攝影記錄', 'Part-time | （機構） | 2024–現在 | 負責客戶溝通與行程規劃，累積服務業實戰經驗']).map(function (x) {
          return x.replace(/负责/g, '負責').replace(/负责/g, '統籌');
        }).join('\n');
      } else if (f === 'rProj') {
        el.value = el.value || '• 旅遊行程規劃專案：為目標客群設計 3 日 2 夜深度遊行程，結合攝影打卡點與本地文化體驗\n• 課堂市場營銷企劃：完成品牌推廣方案，包括市場分析、定位與社交媒體投放策略\n• 個人攝影作品集：經營個人社交平台，累積內容策劃與後期製作經驗';
      } else if (f === 'rSkill') {
        el.value = 'Adobe Photoshop / Lightroom, 手機短影音剪輯（CapCut / Premiere Pro 基礎）, 社交媒體內容策劃與數據分析, 活動策劃與執行, 旅遊行程設計, 中英粵三語文案';
      } else if (f === 'rExtra') {
        el.value = el.value || '• 個人社交 IP 經營（攝影 / 旅遊內容）\n• 校園活動協辦\n• HKCC 副學士畢業並成功升讀 PolyU 學位課程';
      }
      var r = LS.get('resume', {}); r[f] = el.value; LS.set('resume', r);
      toast('✨ 已生成，可自行修改');
    };
  });
}

/* ============================================================
   模塊 7：求職追蹤
   ============================================================ */
function renderJobs() {
  var list = LS.get('jobs', []);
  if ($id('jobTbody')) {
    $id('jobTbody').innerHTML = list.length ? list.map(function (j) {
      var stColor = { '已投遞': '', '面試中': 'color:#d97706;font-weight:700', '已 Offer': 'color:#059669;font-weight:700', '已拒': 'color:#9ca3af' }[j.status] || '';
      return '<tr><td><b>' + esc(j.co) + '</b></td><td>' + esc(j.pos) + '</td><td>' + fmtD(j.date) + '</td><td style="' + stColor + '">' + esc(j.status) + '</td><td>' + fmtD(j.int) + '</td><td style="font-size:12px">' + esc(j.note || '—') + '</td><td></td></tr>';
    }).join('') : '<tr><td colspan="7" class="empty-tip">尚未投遞記錄</td></tr>';
    var rows = $id('jobTbody').querySelectorAll('tr');
    list.forEach(function (j, i) {
      if (rows[i]) rows[i].appendChild(delBtnCell(function () { list.splice(i, 1); LS.set('jobs', list); renderJobs(); renderDashboard(); }));
    });
  }
  if ($id('interviewLib')) { var v = LS.get('interview_lib', ''); if (document.activeElement !== $id('interviewLib')) $id('interviewLib').value = v; }
}
function initJobs() {
  if ($id('addJobBtn')) $id('addJobBtn').onclick = function () {
    var c = $id('jobCo').value.trim(), p = $id('jobPos').value.trim();
    if (!c || !p) { toast('請填寫公司和崗位'); return; }
    var list = LS.get('jobs', []);
    list.push({ co: c, pos: p, date: $id('jobDate').value, status: $id('jobStatus').value, int: ($id('jobInt') || {}).value || '', note: ($id('jobNote') || {}).value || '' });
    LS.set('jobs', list);
    ['jobCo', 'jobPos', 'jobDate', 'jobInt', 'jobNote'].forEach(function (i) { if ($id(i)) $id(i).value = ''; });
    renderJobs(); renderDashboard(); toast('已記錄投遞 ✓');
  };
  if ($id('interviewLib')) $id('interviewLib').addEventListener('input', debounce(function () { LS.set('interview_lib', $id('interviewLib').value); }, 400));
}

/* ============================================================
   模塊 9：待辦 & 提醒
   ============================================================ */
function renderTodos() {
  var list = LS.get('todos', []);
  if ($id('tdTbody')) {
    $id('tdTbody').innerHTML = list.length ? list.map(function (t, i) {
      var u = urgencyInfo(t.due);
      return '<tr><td><b>' + esc(t.t) + '</b></td><td>' + esc(t.cat || '—') + '</td><td>' + fmtD(t.due) + '</td>' +
        '<td><span class="strategy-pill ' + (u.cls === 'urg' ? 's-reach' : u.cls === 'warn' ? 's-mid' : 's-safe') + '">' + u.label + '</span></td>' +
        '<td><input type="checkbox" data-i="' + i + '" ' + (t.done ? 'checked' : '') + ' /></td><td></td></tr>';
    }).join('') : '<tr><td colspan="6" class="empty-tip">沒有待辦事項，太優秀了 🎉</td></tr>';
    $qa('#tdTbody input[type=checkbox]').forEach(function (cb) {
      cb.onchange = function () {
        var a = LS.get('todos', []);
        a[+cb.getAttribute('data-i')].done = cb.checked;
        LS.set('todos', a); renderTodos(); renderDashboard();
      };
    });
    var rows = $id('tdTbody').querySelectorAll('tr');
    list.forEach(function (t, i) {
      if (rows[i]) rows[i].appendChild(delBtnCell(function () { list.splice(i, 1); LS.set('todos', list); renderTodos(); renderDashboard(); }));
    });
  }
}
function initTodos() {
  if ($id('addTdBtn')) $id('addTdBtn').onclick = function () {
    var t = $id('tdTitle').value.trim(); if (!t) { toast('請填寫事項'); return; }
    var a = LS.get('todos', []);
    a.push({ t: t, cat: $id('tdCat').value, due: $id('tdDue').value, done: false });
    LS.set('todos', a);
    $id('tdTitle').value = ''; $id('tdDue').value = '';
    renderTodos(); renderDashboard(); toast('已新增待辦 ✓');
  };
  if ($id('exportTodoBtn')) $id('exportTodoBtn').onclick = function () {
    var a = LS.get('todos', []);
    var lines = ['📋 我的待辦 · ' + fmtFull(new Date()), ''];
    a.sort(function (x, y) { return (x.due || '9999').localeCompare(y.due || '9999'); }).forEach(function (t) {
      lines.push((t.done ? '[x] ' : '[ ] ') + t.t + (t.due ? '（截止 ' + fmtD(t.due) + '）' : '') + ' · ' + (t.cat || ''));
    });
    if (!a.length) lines.push('（目前沒有待辦）');
    if ($id('exportOut')) $id('exportOut').textContent = lines.join('\n');
  };
}

/* ============================================================
   模塊 10：資源筆記庫
   ============================================================ */
function renderLibrary() {
  var bk = LS.get('bookmarks', []);
  if ($id('bkTbody')) {
    $id('bkTbody').innerHTML = bk.length ? bk.map(function (b) {
      return '<tr><td><b>' + esc(b.n) + '</b></td><td><a href="' + esc(b.u) + '" target="_blank" rel="noopener">🔗 開啟</a></td><td>' + esc(b.tag || '—') + '</td><td></td></tr>';
    }).join('') : '<tr><td colspan="4" class="empty-tip">尚未收藏連結</td></tr>';
    var rows = $id('bkTbody').querySelectorAll('tr');
    bk.forEach(function (b, i) {
      if (rows[i]) rows[i].appendChild(delBtnCell(function () { bk.splice(i, 1); LS.set('bookmarks', bk); renderLibrary(); }));
    });
  }
  var docs = LS.get('docs', []);
  if ($id('docTbody')) {
    $id('docTbody').innerHTML = docs.length ? docs.map(function (d) {
      return '<tr><td><b>' + esc(d.n) + '</b></td><td>' + esc(d.loc) + '</td><td></td></tr>';
    }).join('') : '<tr><td colspan="3" class="empty-tip">尚未記錄文件位置</td></tr>';
    var rows2 = $id('docTbody').querySelectorAll('tr');
    docs.forEach(function (d, i) {
      if (rows2[i]) rows2[i].appendChild(delBtnCell(function () { docs.splice(i, 1); LS.set('docs', docs); renderLibrary(); }));
    });
  }
  if ($id('noteArea')) { var v = LS.get('notes', ''); if (document.activeElement !== $id('noteArea')) $id('noteArea').value = v; }
}
function initLibrary() {
  if ($id('addBkBtn')) $id('addBkBtn').onclick = function () {
    var n = $id('bkName').value.trim(), u = $id('bkURL').value.trim();
    if (!n || !u) { toast('請填寫名稱和連結'); return; }
    var a = LS.get('bookmarks', []);
    a.push({ n: n, u: u, tag: $id('bkTag').value.trim() });
    LS.set('bookmarks', a);
    $id('bkName').value = $id('bkURL').value = $id('bkTag').value = '';
    renderLibrary(); toast('已收藏 ✓');
  };
  if ($id('addDocBtn')) $id('addDocBtn').onclick = function () {
    var n = $id('docName').value.trim(), l = $id('docLoc').value.trim();
    if (!n || !l) { toast('請填寫文件名和位置'); return; }
    var a = LS.get('docs', []);
    a.push({ n: n, loc: l });
    LS.set('docs', a);
    $id('docName').value = $id('docLoc').value = '';
    renderLibrary(); toast('已記錄 ✓');
  };
  if ($id('noteArea')) $id('noteArea').addEventListener('input', debounce(function () { LS.set('notes', $id('noteArea').value); }, 400));
}

/* ============================================================
   模塊 11：社交 IP
   ============================================================ */
function renderIp() {
  var list = LS.get('ip', []);
  if ($id('ipList')) {
    $id('ipList').innerHTML = list.length ? list.map(function (x) {
      var u = x.u || '#';
      return '<div class="ip-card"><a href="' + esc(u) + '" target="_blank" rel="noopener" style="text-decoration:none"><div class="ip-n">🔗 ' + esc(x.n) + '</div><div class="ip-u">' + esc(u) + '</div><span class="ai-chip">前往主頁 →</span></a></div>';
    }).join('') : '<div class="empty-tip" style="grid-column:1/-1">尚未加入平台（例：Instagram、小紅書、YouTube）</div>';
    var cards = $id('ipList').querySelectorAll('.ip-card');
    list.forEach(function (x, i) {
      if (!cards[i]) return;
      cards[i].appendChild(delBtn(function () { list.splice(i, 1); LS.set('ip', list); renderIp(); }));
    });
  }
  var stats = LS.get('ipstats', []);
  if ($id('ipStatTbody')) {
    $id('ipStatTbody').innerHTML = stats.length ? stats.map(function (s) {
      return '<tr><td><b>' + esc(s.p) + '</b></td><td>' + esc(s.f) + '</td><td>' + fmtD(s.d) + '</td><td></td></tr>';
    }).join('') : '<tr><td colspan="4" class="empty-tip">尚未記錄數據</td></tr>';
    var rows = $id('ipStatTbody').querySelectorAll('tr');
    stats.forEach(function (s, i) {
      if (rows[i]) rows[i].appendChild(delBtnCell(function () { stats.splice(i, 1); LS.set('ipstats', stats); renderIp(); }));
    });
  }
  if ($id('ipPlan')) { var v = LS.get('ipplan', ''); if (document.activeElement !== $id('ipPlan')) $id('ipPlan').value = v; }
}
function initIp() {
  if ($id('addIpBtn')) $id('addIpBtn').onclick = function () {
    var n = $id('ipName').value.trim(); if (!n) { toast('請填寫平台名'); return; }
    var a = LS.get('ip', []);
    a.push({ n: n, u: $id('ipURL').value.trim() });
    LS.set('ip', a);
    $id('ipName').value = $id('ipURL').value = '';
    renderIp(); toast('已加入 ✓');
  };
  if ($id('addIpStatBtn')) $id('addIpStatBtn').onclick = function () {
    var p = $id('ipStatPlat').value.trim(); if (!p) { toast('請填寫平台'); return; }
    var a = LS.get('ipstats', []);
    a.push({ p: p, f: $id('ipStatFollowers').value.trim(), d: $id('ipStatDate').value });
    LS.set('ipstats', a);
    $id('ipStatPlat').value = $id('ipStatFollowers').value = $id('ipStatDate').value = '';
    renderIp(); toast('已記錄 ✓');
  };
  if ($id('ipPlan')) $id('ipPlan').addEventListener('input', debounce(function () { LS.set('ipplan', $id('ipPlan').value); }, 400));
}

/* ============================================================
   模塊 12：學習進度追蹤
   ============================================================ */
function studySubjects() { return LS.get('study_subjects', JSON.parse(JSON.stringify(FIX.studySubjects))); }

function renderStudy() {
  /* 時間表 */
  var tt = LS.get('timetable', { slots: FIX.timetable.slice() });
  var days = ['一', '二', '三', '四', '五'];
  var times = [9, 10, 11, 12, 14, 15, 16, 17];
  var grid = $id('timetableGrid');
  if (grid) {
    var html = '<div class="tt-cell head" style="grid-column:1"></div>';
    days.forEach(function (d) { html += '<div class="tt-cell head">' + d + '</div>'; });
    times.forEach(function (t) {
      html += '<div class="tt-cell time">' + pad2(t) + ':00</div>';
      days.forEach(function (d, di) {
        var slot = (tt.slots || []).filter(function (s) { return s.d === di && s.t === t; })[0];
        html += slot
          ? '<div class="tt-cell filled" data-d="' + di + '" data-t="' + t + '" title="點擊編輯"><b>' + esc(slot.subj) + '</b><span class="tt-room">' + esc(slot.room || '') + '</span></div>'
          : '<div class="tt-cell" data-d="' + di + '" data-t="' + t + '" title="點擊新增">＋</div>';
      });
    });
    grid.innerHTML = html;
    $qa('#timetableGrid .tt-cell[data-d]').forEach(function (cell) {
      cell.onclick = function () {
        var d = +cell.getAttribute('data-d'), t = +cell.getAttribute('data-t');
        var slots = LS.get('timetable', {}).slots || [];
        var idx = slots.findIndex(function (s) { return s.d === d && s.t === t; });
        var cur = idx >= 0 ? slots[idx] : null;
        var v = prompt('編輀課堂（格式：科目｜課室；留空並確定 = 刪除）', cur ? (cur.subj + '|' + (cur.room || '')) : '');
        if (v === null) return;
        v = v.trim();
        if (!v) { if (idx >= 0) slots.splice(idx, 1); }
        else {
          var parts = v.split(/[|｜]/);
          var obj = { d: d, t: t, subj: parts[0].trim(), room: (parts[1] || '').trim() };
          if (idx >= 0) slots[idx] = obj; else slots.push(obj);
        }
        LS.set('timetable', { slots: slots }); renderStudy();
      };
    });
  }

  /* 學術日曆 */
  if ($id('calendarList')) {
    var cal = FIX.calendar.map(function (c) {
      var n = daysUntil(c.d);
      return { t: c.t, d: c.d, n: n };
    }).filter(function (c) { return c.n == null || c.n >= -30; });
    $id('calendarList').innerHTML = cal.map(function (c) {
      var badge = c.n < 0 ? '已過' : c.n === 0 ? '今天' : c.n + ' 天後';
      return '<div class="cal-item"><span class="c-date">' + fmtD(c.d) + '</span><span>' + esc(c.t) + '</span><span class="c-days">' + badge + '</span></div>';
    }).join('');
  }

  /* 科目進度 */
  var subs = studySubjects();
  var topics = LS.get('study_topics', []);
  if ($id('subjectGrid')) {
    $id('subjectGrid').innerHTML = subs.map(function (s, i) {
      var ts = topics.filter(function (t) { return t.subj === s.code; }).slice(-3).reverse();
      return '<div class="subject-card"><div class="s-code">' + esc(s.code) + '</div><div class="s-name">' + esc(s.name) + '</div>' +
        '<div class="progress" style="margin:6px 0 2px"><div class="bar" style="width:' + (s.progress || 0) + '%"></div></div>' +
        '<div style="font-size:11px;color:#6b7280">' + (s.progress || 0) + '% 完成</div>' +
        (ts.length ? '<div class="s-topics">' + ts.map(function (t) { return '• ' + esc(t.topic) + (t.date ? '（' + fmtD(t.date) + '）' : ''); }).join('<br>') + '</div>' : '') + '</div>';
    }).join('');
  }
  /* 下拉選單 */
  ['spSubject', 'matSubject', 'planSubject'].forEach(function (id) {
    var sel = $id(id); if (!sel) return;
    sel.innerHTML = subs.map(function (s) { return '<option value="' + esc(s.code) + '">' + esc(s.code) + ' · ' + esc(s.name) + '</option>'; }).join('');
  });

  /* 材料 */
  renderMaterials();

  /* 學習計劃 */
  var plans = LS.get('study_plans', []);
  if ($id('planList')) {
    var typeLbl = { preview: '📖 預習', review: '🔁 復習', practice: '✏️ 練習', revision: '🧠 溫習' };
    $id('planList').innerHTML = plans.length ? plans.map(function (p, i) {
      var u = urgencyInfo(p.date);
      return '<div class="plan-item ' + (p.done ? 'done' : '') + '"><input type="checkbox" data-i="' + i + '" ' + (p.done ? 'checked' : '') + ' style="width:16px;height:16px;accent-color:#83001A" />' +
        '<div><div class="p-title">' + (typeLbl[p.type] || '') + ' ' + esc(p.title) + '</div><div class="p-sub">' + esc(p.subj || '') + (p.date ? ' · ' + fmtD(p.date) : '') + (p.dur ? ' · 約 ' + p.dur + ' 分鐘' : '') + '</div></div>' +
        '<div class="p-right"><span class="p-badge ' + u.cls + '">' + u.label + '</span></div></div>';
    }).join('') : '<div class="empty-tip">尚未安排學習計劃</div>';
    $qa('#planList input[type=checkbox]').forEach(function (cb) {
      cb.onchange = function () { var a = LS.get('study_plans', []); a[+cb.getAttribute('data-i')].done = cb.checked; LS.set('study_plans', a); renderStudy(); };
    });
    var items = $id('planList').querySelectorAll('.plan-item');
    plans.forEach(function (p, i) {
      if (items[i]) {
        var del = delBtn(function () { plans.splice(i, 1); LS.set('study_plans', plans); renderStudy(); });
        var right = items[i].querySelector('.p-right'); if (right) right.appendChild(del);
      }
    });
  }
}
function initStudy() {
  if ($id('addTopicBtn')) $id('addTopicBtn').onclick = function () {
    var code = $id('spSubject').value;
    var topic = $id('spTopic').value.trim();
    if (!topic) { toast('請填寫主題'); return; }
    var topics = LS.get('study_topics', []);
    topics.push({ subj: code, topic: topic, date: $id('spDate').value, progress: Number($id('spProgress').value) || null });
    LS.set('study_topics', topics);
    var subs = studySubjects();
    var s = subs.filter(function (x) { return x.code === code; })[0];
    if (s) {
      var pr = Number($id('spProgress').value);
      if (pr >= 0 && pr != null && !isNaN(pr)) s.progress = Math.max(s.progress || 0, Math.min(100, pr));
      LS.set('study_subjects', subs);
    }
    $id('spTopic').value = ''; $id('spDate').value = ''; $id('spProgress').value = '';
    renderStudy(); toast('已更新進度 ✓');
  };
  if ($id('addPlanBtn')) $id('addPlanBtn').onclick = function () {
    var title = $id('planTitle').value.trim(); if (!title) { toast('請填寫計劃內容'); return; }
    var a = LS.get('study_plans', []);
    a.push({ subj: $id('planSubject').value, type: $id('planType').value, title: title, date: $id('planDate').value, dur: $id('planDuration').value, done: false });
    LS.set('study_plans', a);
    $id('planTitle').value = ''; $id('planDate').value = ''; $id('planDuration').value = '';
    renderStudy(); toast('已加入學習計劃 ✓');
  };
  if ($id('addMatBtn')) $id('addMatBtn').onclick = function () {
    var f = ($id('matFile') || {}).files;
    if (!f || !f.length) { toast('請選擇檔案'); return; }
    var file = f[0];
    idbAdd({
      id: uid(), subject: $id('matSubject').value, type: $id('matType').value.trim() || '其他',
      name: file.name, size: file.size, note: $id('matNote').value.trim(), date: todayStr(), blob: file
    }).then(function () {
      $id('matFile').value = ''; $id('matType').value = ''; $id('matNote').value = '';
      renderMaterials(); toast('已上傳至本機 IndexedDB ✓');
    }).catch(function (e) { toast('上傳失敗：' + e); });
  };
}

/* ---- IndexedDB（課堂材料） ---- */
function idbOpen() {
  return new Promise(function (res, rej) {
    var rq = indexedDB.open('lyhub_materials', 1);
    rq.onupgradeneeded = function (e) {
      var db = e.target.result;
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'id' });
    };
    rq.onsuccess = function (e) { res(e.target.result); };
    rq.onerror = function (e) { rej(e.target.error); };
  });
}
function idbTx(mode) {
  return idbOpen().then(function (db) {
    return db.transaction('files', mode).objectStore('files');
  });
}
function idbAdd(rec) { return idbTx('readwrite').then(function (st) { return new Promise(function (res, rej) { var r = st.put(rec); r.onsuccess = res; r.onerror = function () { rej(r.error); }; }); }); }
function idbAll() { return idbTx('readonly').then(function (st) { return new Promise(function (res, rej) { var r = st.getAll(); r.onsuccess = function () { res(r.result || []); }; r.onerror = function () { rej(r.error); }; }); }); }
function idbDel(id) { return idbTx('readwrite').then(function (st) { st.delete(id); }); }

function renderMaterials() {
  if (!$id('matList')) return;
  idbAll().then(function (list) {
    if (!list.length) { $id('matList').innerHTML = '<div class="empty-tip">尚未上傳材料（PPT / 練習 / 筆記）</div>'; return; }
    list.sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
    var icons = { ppt: '📊', pdf: '📄', doc: '📝', xls: '📈', other: '📎' };
    $id('matList').innerHTML = list.map(function (m) {
      var ic = m.name.match(/\.pptx?$/i) ? icons.ppt : m.name.match(/\.pdf$/i) ? icons.pdf : m.name.match(/\.(docx?|txt|md)$/i) ? icons.doc : m.name.match(/\.xlsx?$/i) ? icons.xls : icons.other;
      var sz = m.size > 1048576 ? (m.size / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(m.size / 1024)) + ' KB';
      return '<div class="mat-item" data-id="' + esc(m.id) + '"><span class="m-ico">' + ic + '</span>' +
        '<div><div class="m-name">' + esc(m.name) + '</div><div class="m-sub">' + esc(m.subject || '') + ' · ' + esc(m.type) + ' · ' + sz + (m.note ? ' · ' + esc(m.note) : '') + '</div></div>' +
        '<div class="m-acts"></div></div>';
    }).join('');
    list.forEach(function (m) {
      var row = $q('#matList .mat-item[data-id="' + m.id + '"]'); if (!row) return;
      var acts = row.querySelector('.m-acts');
      var dl = document.createElement('button'); dl.className = 'ghost'; dl.textContent = '⬇️ 下載'; dl.style.padding = '4px 10px';
      dl.onclick = function () {
        var url = URL.createObjectURL(m.blob);
        var a = document.createElement('a'); a.href = url; a.download = m.name; a.click();
        setTimeout(function () { URL.revokeObjectURL(url); }, 800);
      };
      var del = delBtn(function () { idbDel(m.id).then(renderMaterials); });
      acts.appendChild(dl); acts.appendChild(del);
    });
  }).catch(function () {
    $id('matList').innerHTML = '<div class="empty-tip">（此瀏覽器不支援 IndexedDB）</div>';
  });
}

/* ============================================================
   模塊 13：個人檔案（Lok Yi）
   ============================================================ */
function renderLyProfile() {
  var p = LS.get('ly_profile', DEF_LY);
  if ($id('lyPfName')) $id('lyPfName').value = p.name || '';
  if ($id('lyPfSchool')) $id('lyPfSchool').value = p.school || '';
  if ($id('lyPfYear')) $id('lyPfYear').value = p.year || '';
  if ($id('lyPfMajor')) $id('lyPfMajor').value = p.major || '';
  if ($id('lyPfGpa')) $id('lyPfGpa').value = p.gpa || '';
  if ($id('lyPfTargetGpa')) $id('lyPfTargetGpa').value = p.targetGpa || '';
  if ($id('lyPfNote')) $id('lyPfNote').value = p.note || '';
}
function initLyProfile() {
  if ($id('lyPfSaveBtn')) $id('lyPfSaveBtn').onclick = function () {
    var p = {
      name: $id('lyPfName').value.trim() || DEF_LY.name,
      school: $id('lyPfSchool').value.trim(),
      year: $id('lyPfYear').value.trim(),
      major: $id('lyPfMajor').value.trim(),
      gpa: $id('lyPfGpa').value,
      targetGpa: $id('lyPfTargetGpa').value,
      note: $id('lyPfNote').value.trim()
    };
    LS.set('ly_profile', p);
    renderDashboard(); renderSidebarIdentity(); toast('個人檔案已儲存 ✓');
  };
}

/* ============================================================
   BF 模塊 1：男友總覽
   ============================================================ */
function bfProfile() { return LS.get('bf_profile', DEF_BF); }
function strategyOf(gpa, avg) {
  var diff = gpa - avg;
  if (diff >= 0.15) return { k: 'safe', t: '保' };
  if (diff >= -0.10) return { k: 'mid', t: '穩' };
  return { k: 'reach', t: '衝' };
}

function renderBfDash() {
  var p = bfProfile();
  var d = new Date();
  if ($id('bfHello')) $id('bfHello').textContent = 'Hi Austin 👋';
  if ($id('bfTodayDate')) $id('bfTodayDate').textContent = fmtFull(d);
  if ($id('bfStatGpa')) $id('bfStatGpa').textContent = p.gpa || '—';
  if ($id('bfStatTarget')) $id('bfStatTarget').textContent = p.target || '—';

  var subs = LS.get('bf_subjects', null);
  if (!subs) { subs = JSON.parse(JSON.stringify(FIX.bfSubjects)); LS.set('bf_subjects', subs); }
  var doneCr = subs.filter(function (s) { return s.status === '已完成'; }).reduce(function (a, s) { return a + (s.cr || 0); }, 0);
  if ($id('bfStatCredits')) $id('bfStatCredits').textContent = doneCr;

  /* 下一個截止日 */
  var tl = bfAllTimeline();
  var upcoming = tl.filter(function (x) { var n = daysUntil(x.d); return n != null && n >= 0; }).sort(function (a, b) { return daysUntil(a.d) - daysUntil(b.d); });
  if ($id('bfStatDeadline')) $id('bfStatDeadline').textContent = upcoming.length ? daysUntil(upcoming[0].d) : '—';

  /* 個人檔案卡 */
  if ($id('bfProfileCard')) {
    $id('bfProfileCard').innerHTML =
      '<div class="kv"><span>姓名</span><b>' + esc(p.name) + '</b></div>' +
      '<div class="kv"><span>學生編號</span><b>' + esc(p.sid || '—') + '</b></div>' +
      '<div class="kv"><span>現就讀院校</span><b>' + esc(p.school || '—') + '</b></div>' +
      '<div class="kv"><span>學年</span><b>' + esc(p.year || '—') + '</b></div>' +
      '<div class="kv"><span>主修課程</span><b>' + esc(p.major || '—') + '</b></div>' +
      '<div class="kv"><span>當前 GPA</span><b>' + esc(p.gpa || '—') + '</b></div>' +
      '<div class="kv"><span>目標 GPA</span><b>' + esc(p.target || '—') + '</b></div>' +
      (p.note ? '<div class="kv"><span>備註</span><b>' + esc(p.note) + '</b></div>' : '');
  }

  if (document.activeElement !== $id('bfGpaInput')) $id('bfGpaInput').value = p.gpa || '';
  if (document.activeElement !== $id('bfTargetInput')) $id('bfTargetInput').value = p.target || '';

  /* 錄取評估 */
  if ($id('bfRiskBox')) {
    var gpa = Number(p.gpa) || 0;
    var rows = FIX.programs.map(function (pr) {
      var diff = gpa - pr.avg;
      var pct = Math.max(5, Math.min(95, Math.round(50 + diff * 160)));
      return { pr: pr, pct: pct, diff: diff };
    }).sort(function (a, b) { return b.pct - a.pct; });
    $id('bfRiskBox').innerHTML =
      '<div style="font-size:12.5px;font-weight:700;margin:4px 0 8px">📈 以當前 GPA ' + gpa.toFixed(2) + ' 計算的錄取機會評估</div>' +
      rows.map(function (r) {
        return '<div class="risk-item"><span style="min-width:0;flex:1"><b>' + esc(r.pr.uni) + '</b> · ' + esc(r.pr.name) + '</span>' +
          '<div class="risk-bar"><div class="risk-fill" style="width:' + r.pct + '%"></div></div>' +
          '<span class="risk-pct">' + r.pct + '%</span></div>';
      }).join('') +
      '<div class="src">評估僅供參考：以歷年平均 GPA 差值推算，實際錄取視乎面試、個人陳述及其他成就。' + (gpa < 3.7 ? '建議 Year 2 保持 GPA 3.8+ 以擴大選擇。' : '當前 GPA 有競爭力，衝刺課程亦值得報名。') + '</div>';
  }

  /* 學分進度 */
  var comp = subs.filter(function (s) { return s.type === '必修' && s.status === '已完成'; }).reduce(function (a, s) { return a + (s.cr || 0); }, 0);
  var elec = subs.filter(function (s) { return s.type === '選修' && s.status === '已完成'; }).reduce(function (a, s) { return a + (s.cr || 0); }, 0);
  if ($id('bfCompBar')) $id('bfCompBar').style.width = Math.min(100, Math.round(comp / 42 * 100)) + '%';
  if ($id('bfCompText')) $id('bfCompText').textContent = comp + ' / 42 學分';
  if ($id('bfElecBar')) $id('bfElecBar').style.width = Math.min(100, Math.round(elec / 21 * 100)) + '%';
  if ($id('bfElecText')) $id('bfElecText').textContent = elec + ' / 21 學分';
}

function initBfDash() {
  if ($id('bfGpaSaveBtn')) $id('bfGpaSaveBtn').onclick = function () {
    var p = bfProfile();
    p.gpa = Number($id('bfGpaInput').value) || p.gpa;
    p.target = Number($id('bfTargetInput').value) || p.target;
    LS.set('bf_profile', p);
    renderBfDash(); renderBfSubjects(); renderBfPrograms(); toast('已儲存並重新評估 ✓');
  };
}

/* ============================================================
   BF 模塊 2：科目進度追蹤
   ============================================================ */
function renderBfSubjects() {
  var subs = LS.get('bf_subjects', null);
  if (!subs) { subs = JSON.parse(JSON.stringify(FIX.bfSubjects)); LS.set('bf_subjects', subs); }
  if ($id('bfSubTbody')) {
    $id('bfSubTbody').innerHTML = subs.map(function (s, i) {
      return '<tr><td><b>' + esc(s.code) + '</b></td><td>' + esc(s.name) + '</td><td>' + s.cr + '</td><td>' + esc(s.type) + '</td><td>' + esc(s.term) + '</td>' +
        '<td>' + esc(s.exp || '—') + '</td><td>' + esc(s.act || '—') + '</td>' +
        '<td><select data-status="' + i + '"><option' + (s.status === '修讀中' ? ' selected' : '') + '>修讀中</option><option' + (s.status === '已完成' ? ' selected' : '') + '>已完成</option><option' + (s.status === '計劃' ? ' selected' : '') + '>計劃</option></select></td>' +
        '<td style="min-width:90px"><div class="progress" style="margin:0;height:7px"><div class="bar" style="width:' + (s.prog || 0) + '%"></div></div><span style="font-size:10px;color:#9ca3af">' + (s.prog || 0) + '%</span></td>' +
        '<td></td></tr>';
    }).join('');
    $qa('#bfSubTbody select[data-status]').forEach(function (sel) {
      sel.onchange = function () {
        var a = LS.get('bf_subjects', []);
        a[+sel.getAttribute('data-status')].status = sel.value;
        if (sel.value === '已完成') a[+sel.getAttribute('data-status')].prog = 100;
        LS.set('bf_subjects', a); renderBfSubjects(); renderBfDash();
      };
    });
    var rows = $id('bfSubTbody').querySelectorAll('tr');
    subs.forEach(function (s, i) {
      if (rows[i]) rows[i].appendChild(delBtnCell(function () {
        subs.splice(i, 1); LS.set('bf_subjects', subs); renderBfSubjects(); renderBfDash();
      }));
    });
  }
  var done = subs.filter(function (s) { return s.status === '已完成'; });
  var doneCr = done.reduce(function (a, s) { return a + (s.cr || 0); }, 0);
  var compCr = done.filter(function (s) { return s.type === '必修'; }).reduce(function (a, s) { return a + (s.cr || 0); }, 0);
  var elecCr = done.filter(function (s) { return s.type === '選修'; }).reduce(function (a, s) { return a + (s.cr || 0); }, 0);
  if ($id('bfSumDone')) $id('bfSumDone').textContent = doneCr;
  if ($id('bfSumComp')) $id('bfSumComp').textContent = compCr;
  if ($id('bfSumElec')) $id('bfSumElec').textContent = elecCr;
}
function initBfSubjects() {
  if ($id('bfAddSubBtn')) $id('bfAddSubBtn').onclick = function () {
    var code = $id('bfSubCode').value.trim(), name = $id('bfSubTitle').value.trim();
    if (!code || !name) { toast('請填寫科目編號和名稱'); return; }
    var a = LS.get('bf_subjects', []);
    a.push({ id: uid(), code: code, name: name, cr: Number($id('bfSubCr').value) || 3, type: $id('bfSubType').value, term: $id('bfSubTerm').value.trim(), exp: $id('bfSubExpGrade').value.trim(), act: '', status: $id('bfSubStatus').value, prog: Number($id('bfSubProgress').value) || 0 });
    LS.set('bf_subjects', a);
    ['bfSubCode', 'bfSubTitle', 'bfSubCr', 'bfSubTerm', 'bfSubExpGrade', 'bfSubProgress'].forEach(function (i) { $id(i).value = ''; });
    renderBfSubjects(); renderBfDash(); toast('已新增科目 ✓');
  };
}

/* ============================================================
   BF 模塊 3：Non-JUPAS 院校庫
   ============================================================ */
function bfProgMeta() { return LS.get('bf_progmeta', {}); }
function renderBfPrograms() {
  var p = bfProfile();
  var gpa = Number(p.gpa) || 0;
  var kw = ($id('bfProgFilter') || {}).value || '';
  kw = kw.trim().toLowerCase();
  var stg = ($id('bfProgStrategy') || {}).value || '';
  var meta = bfProgMeta();

  var list = FIX.programs.filter(function (pr) {
    if (kw && (pr.uni + pr.name + pr.field).toLowerCase().indexOf(kw) < 0) return false;
    var st = strategyOf(gpa, pr.avg);
    var m = meta[pr.key] || {};
    if (stg === '收藏' && !m.fav) return false;
    if (stg === '已標記申請' && !m.applied) return false;
    if ((stg === '保' || stg === '穩' || stg === '衝') && st.t !== stg) return false;
    return true;
  });

  if ($id('bfProgTbody')) {
    $id('bfProgTbody').innerHTML = list.length ? list.map(function (pr) {
      var st = strategyOf(gpa, pr.avg);
      var m = meta[pr.key] || {};
      return '<tr><td><b>' + esc(pr.uni) + '</b></td>' +
        '<td>' + esc(pr.name) + '<br><span style="font-size:10.5px;color:#9ca3af">' + (pr.src === '官方' ? '官方歷年平均（2025 入學）' : '⚠️ 估算（非官方）') + '</span></td>' +
        '<td>' + esc(pr.field) + '</td>' +
        '<td>最低 ~' + pr.min.toFixed(2) + '<br>平均 <b>' + pr.avg.toFixed(2) + '</b></td>' +
        '<td class="pros-cons">✓ ' + esc(pr.pros) + '<br>✗ ' + esc(pr.cons) + '</td>' +
        '<td><span class="strategy-pill s-' + st.k + '">' + st.t + '</span></td>' +
        '<td style="white-space:nowrap"><button class="fav-btn" data-fav="' + pr.key + '" title="收藏">' + (m.fav ? '⭐' : '☆') + '</button>' +
        '<button class="fav-btn" data-applied="' + pr.key + '" title="標記申請">' + (m.applied ? '📌' : '📍') + '</button>' +
        '<button class="fav-btn" data-note="' + pr.key + '" title="備註">💬</button></td></tr>';
    }).join('') : '<tr><td colspan="7" class="empty-tip">沒有符合條件的課程</td></tr>';

    $qa('#bfProgTbody [data-fav]').forEach(function (b) {
      b.onclick = function () {
        var k = b.getAttribute('data-fav'), mt = bfProgMeta();
        mt[k] = mt[k] || {}; mt[k].fav = !mt[k].fav; LS.set('bf_progmeta', mt);
        renderBfPrograms(); renderBfFav();
      };
    });
    $qa('#bfProgTbody [data-applied]').forEach(function (b) {
      b.onclick = function () {
        var k = b.getAttribute('data-applied'), mt = bfProgMeta();
        mt[k] = mt[k] || {}; mt[k].applied = !mt[k].applied; LS.set('bf_progmeta', mt);
        renderBfPrograms(); renderBfFav();
      };
    });
    $qa('#bfProgTbody [data-note]').forEach(function (b) {
      b.onclick = function () {
        var k = b.getAttribute('data-note'), mt = bfProgMeta();
        mt[k] = mt[k] || {};
        var v = prompt('備註（例：已開戶 / 已寄成績表 / 面試日期…）', mt[k].note || '');
        if (v === null) return;
        mt[k].note = v.trim(); LS.set('bf_progmeta', mt); renderBfFav();
      };
    });
  }
  renderBfFav();
}
function renderBfFav() {
  if (!$id('bfFavBox')) return;
  var meta = bfProgMeta();
  var picks = FIX.programs.filter(function (pr) { var m = meta[pr.key] || {}; return m.fav || m.applied || m.note; });
  if (!picks.length) { $id('bfFavBox').innerHTML = '<div class="empty-tip">在上方表格點 ⭐ 收藏 或 📍 標記申請，這裡會顯示你的清單與備註。</div>'; return; }
  $id('bfFavBox').innerHTML = picks.map(function (pr) {
    var m = meta[pr.key] || {};
    return '<div class="plan-item"><div><div class="p-title">' + (m.applied ? '📌 ' : m.fav ? '⭐ ' : '') + esc(pr.uni) + ' · ' + esc(pr.name) + '</div>' +
      (m.note ? '<div class="p-sub">💬 ' + esc(m.note) + '</div>' : '') + '</div></div>';
  }).join('');
}
function initBfPrograms() {
  if ($id('bfProgFilter')) $id('bfProgFilter').addEventListener('input', debounce(renderBfPrograms, 200));
  if ($id('bfProgStrategy')) $id('bfProgStrategy').addEventListener('change', renderBfPrograms);
}

/* ============================================================
   BF 模塊 4：申請材料管理
   ============================================================ */
function renderBfMaterials() {
  var list = LS.get('bf_materials', null);
  if (!list) { list = JSON.parse(JSON.stringify(FIX.bfMaterials)); LS.set('bf_materials', list); }
  if ($id('bfMatTbody')) {
    $id('bfMatTbody').innerHTML = list.map(function (m, i) {
      return '<tr><td><b>' + esc(m.name) + '</b></td>' +
        '<td><select data-st="' + i + '"><option>未開始</option><option>草稿中</option><option>已完成</option><option>已提交</option></select></td>' +
        '<td style="font-size:11.5px;color:#9ca3af">' + esc(m.updated || '—') + '</td>' +
        '<td><input data-nt="' + i + '" value="' + esc(m.note || '') + '" placeholder="備註" style="min-width:150px" /></td>' +
        '<td><input data-lk="' + i + '" value="' + esc(m.link || '') + '" placeholder="雲端連結（可選）" style="min-width:150px" /></td>' +
        '<td><button class="ghost" data-save="' + i + '" style="padding:4px 10px">💾</button></td>' +
        '<td></td></tr>';
    }).join('');
    $qa('#bfMatTbody select[data-st]').forEach(function (s) {
      var i = +s.getAttribute('data-st');
      if (list[i].status) s.value = list[i].status;
    });
    $qa('#bfMatTbody [data-save]').forEach(function (b) {
      b.onclick = function () {
        var i = +b.getAttribute('data-save');
        var a = LS.get('bf_materials', []);
        a[i].status = $q('#bfMatTbody select[data-st="' + i + '"]').value;
        a[i].note = $q('#bfMatTbody [data-nt="' + i + '"]').value.trim();
        a[i].link = $q('#bfMatTbody [data-lk="' + i + '"]').value.trim();
        a[i].updated = fmtFull(new Date());
        LS.set('bf_materials', a); renderBfMaterials(); toast('已儲存 ✓');
      };
    });
    var rows = $id('bfMatTbody').querySelectorAll('tr');
    list.forEach(function (m, i) {
      if (rows[i]) rows[i].appendChild(delBtnCell(function () { list.splice(i, 1); LS.set('bf_materials', list); renderBfMaterials(); }));
    });
  }
}
function initBfMaterials() {
  if ($id('bfAddMatBtn')) $id('bfAddMatBtn').onclick = function () {
    var n = $id('bfMatNewName').value.trim(); if (!n) { toast('請填寫材料名稱'); return; }
    var a = LS.get('bf_materials', []);
    a.push({ id: uid(), name: n, status: '未開始', note: '', link: '', updated: '' });
    LS.set('bf_materials', a);
    $id('bfMatNewName').value = '';
    renderBfMaterials(); toast('已新增材料 ✓');
  };
}

/* ============================================================
   BF 模塊 5：CV 實時改善建議
   ============================================================ */
function renderBfCv() {
  var c = LS.get('bf_cv', {});
  ['bfCvGpa', 'bfCvTarget', 'bfCvComp', 'bfCvIntern', 'bfCvSkills'].forEach(function (id) {
    var el = $id(id); if (!el) return;
    if (document.activeElement !== el) el.value = c[id] || '';
  });
  var acts = LS.get('bf_cvactions', null);
  if (!acts) { acts = JSON.parse(JSON.stringify(FIX.bfCvActions)); LS.set('bf_cvactions', acts); }
  if ($id('bfCvActionList')) {
    $id('bfCvActionList').innerHTML = acts.map(function (a, i) {
      return '<li class="' + (a.done ? 'done' : '') + '"><input type="checkbox" data-i="' + i + '" ' + (a.done ? 'checked' : '') + ' /><span>' + esc(a.t) + '</span></li>';
    }).join('');
    $qa('#bfCvActionList input').forEach(function (cb) {
      cb.onchange = function () { var a = LS.get('bf_cvactions', []); a[+cb.getAttribute('data-i')].done = cb.checked; LS.set('bf_cvactions', a); renderBfCv(); };
    });
  }
}
function initBfCv() {
  ['bfCvGpa', 'bfCvTarget', 'bfCvComp', 'bfCvIntern', 'bfCvSkills'].forEach(function (id) {
    var el = $id(id); if (!el) return;
    el.addEventListener('input', debounce(function () { var c = LS.get('bf_cv', {}); c[id] = el.value; LS.set('bf_cv', c); }, 300));
  });
  if ($id('bfCvSaveBtn')) $id('bfCvSaveBtn').onclick = function () { toast('輸入已儲存 ✓'); };
  if ($id('bfCvGenBtn')) $id('bfCvGenBtn').onclick = function () {
    var gpa = Number($id('bfCvGpa').value) || 3.78;
    var target = $id('bfCvTarget').value || '數據科學 / AI 相關學位';
    var comp = $id('bfCvComp').value.trim();
    var intern = $id('bfCvIntern').value.trim();
    var skills = $id('bfCvSkills').value.trim();
    var out = [];

    out.push({ t: 'GPA 與學術表現', d: (gpa >= 3.7 ? '✅ GPA ' + gpa.toFixed(2) + ' 屬第一梯隊：放在 CV 第一行，並標註「Cumulative GPA」與學分數。可爭取 Dean\'s List / 校長嘉許狀（如適用）。' : '⚠️ GPA ' + gpa.toFixed(2) + ' 尚可：放在教育欄，以「Major GPA」或趨勢呈現（如 Year GPA 上升），用專案經歷補足。') });
    out.push({ t: '目標課程對接', d: '針對「' + target + '」：CV 技能欄應涵蓋 Python / R / SQL / 統計建模，並在 Personal Statement 呼應課程核心模組。' });
    out.push({ t: '比賽 / 競賽經歷', d: comp ? '已填寫 ✓ 建議以「動作 + 工具 + 結果」格式重寫每條，例如：「運用 Python 建立 X 模型，將 Y 提升 Z%」。' : '⚠️ 未填寫：建議 Year 2 參加至少 1 個數據比賽（Kaggle / 校內 Hackathon / 統計案例賽），這是 Senior Year 申請的最大加分項。' });
    out.push({ t: '實習 / 專案經歷', d: intern ? '已填寫 ✓ 每條經歷控制在 2–3 行，突出數據量、技術棧與量化成果。' : '⚠️ 未填寫：即使沒有正式實習，也可列課堂專案（EDA、迴歸建模、資料視覺化）並上傳 GitHub，招生官非常看重。' });
    out.push({ t: '技能清單', d: skills ? '目前技能：' + esc(skills) + '。建議補上 SQL 與一個 BI 工具（Tableau / Power BI），這是數據職位 JD 出現率最高的兩項。' : '⚠️ 未填寫：建議列出 Python、R、Excel（樞紐分析）、SQL（學習中）、Git/GitHub，並標註熟練度。' });
    out.push({ t: '語言與證書', d: '如有 IELTS / TOEFL 成績或 MOOC 證書（Coursera、edX），集中在「Certifications」一欄列出。' });
    out.push({ t: '格式建議', d: '一頁 A4、Arial/Calibri 10.5–11pt、倒序排列、PDF 提交；檔名格式：XIE_Haojun_CV.pdf。' });

    if ($id('bfCvSugList')) {
      $id('bfCvSugList').innerHTML = out.map(function (o) {
        return '<div class="plan-item"><div><div class="p-title">💡 ' + o.t + '</div><div class="p-sub">' + o.d + '</div></div></div>';
      }).join('');
    }
    toast('✨ 已生成 ' + out.length + ' 項建議');
  };
  if ($id('bfCvAddActionBtn')) $id('bfCvAddActionBtn').onclick = function () {
    var v = $id('bfCvActionInput').value.trim(); if (!v) return;
    var a = LS.get('bf_cvactions', []);
    a.push({ t: v, done: false });
    LS.set('bf_cvactions', a);
    $id('bfCvActionInput').value = '';
    renderBfCv();
  };
}

/* ============================================================
   BF 模塊 6：申請時間節點倒計時
   ============================================================ */
function bfAllTimeline() {
  var custom = LS.get('bf_timeline_custom', []);
  return FIX.bfDeadlines.concat(custom);
}
function renderBfTimeline() {
  var list = bfAllTimeline().map(function (x) { x.n = daysUntil(x.d); return x; });
  list.sort(function (a, b) { return (a.n == null ? 9999 : a.n) - (b.n == null ? 9999 : b.n); });
  if ($id('bfTimelineList')) {
    $id('bfTimelineList').innerHTML = list.map(function (x) {
      var u = urgencyInfo(x.d);
      return '<div class="plan-item"><div><div class="p-title">' + (x.custom ? '📍 ' : '') + esc(x.t) + '</div><div class="p-sub">' + fmtD(x.d) + '</div></div>' +
        '<div class="p-right"><span class="p-badge ' + u.cls + '">' + u.label + '</span>' + (x.custom ? '<button class="row-del" data-custom="' + esc(x.t) + '">🗑</button>' : '') + '</div></div>';
    }).join('');
    $qa('#bfTimelineList [data-custom]').forEach(function (b) {
      b.onclick = function () {
        var customs = LS.get('bf_timeline_custom', []);
        customs = customs.filter(function (c) { return c.t !== b.getAttribute('data-custom'); });
        LS.set('bf_timeline_custom', customs);
        renderBfTimeline(); renderBfDash();
      };
    });
  }
}
function initBfTimeline() {
  if ($id('bfAddTlBtn')) $id('bfAddTlBtn').onclick = function () {
    var t = $id('bfTlTitle').value.trim(), d = $id('bfTlDate').value;
    if (!t || !d) { toast('請填寫事項和日期'); return; }
    var a = LS.get('bf_timeline_custom', []);
    a.push({ t: t, d: d, custom: 1 });
    LS.set('bf_timeline_custom', a);
    $id('bfTlTitle').value = ''; $id('bfTlDate').value = '';
    renderBfTimeline(); renderBfDash(); toast('已新增倒計時 ✓');
  };
}

/* ============================================================
   BF 模塊 8：職業規劃
   ============================================================ */
function renderBfCareer() {
  var c = LS.get('bf_career', {});
  if ($id('bfCarGoal') && document.activeElement !== $id('bfCarGoal')) $id('bfCarGoal').value = c.goal || '';
  if ($id('bfCarIndustry') && document.activeElement !== $id('bfCarIndustry')) $id('bfCarIndustry').value = c.industry || '';
  if ($id('bfCarPositions') && document.activeElement !== $id('bfCarPositions')) $id('bfCarPositions').value = c.positions || '';
  if ($id('bfSkillNow') && document.activeElement !== $id('bfSkillNow')) $id('bfSkillNow').value = (c.skills || {}).now || '';
  if ($id('bfSkillGap') && document.activeElement !== $id('bfSkillGap')) $id('bfSkillGap').value = (c.skills || {}).gap || '';
  if ($id('bfSkillPlan') && document.activeElement !== $id('bfSkillPlan')) $id('bfSkillPlan').value = (c.skills || {}).plan || '';

  var ch = LS.get('bf_channels', null);
  if (!ch) { ch = JSON.parse(JSON.stringify(FIX.bfChannels)); LS.set('bf_channels', ch); }
  if ($id('bfChannelList')) {
    $id('bfChannelList').innerHTML = ch.map(function (x, i) {
      return '<li class="' + (x.done ? 'done' : '') + '"><input type="checkbox" data-i="' + i + '" ' + (x.done ? 'checked' : '') + ' /><span>' + esc(x.t) + '</span></li>';
    }).join('');
    $qa('#bfChannelList input').forEach(function (cb) {
      cb.onchange = function () { var a = LS.get('bf_channels', []); a[+cb.getAttribute('data-i')].done = cb.checked; LS.set('bf_channels', a); renderBfCareer(); };
    });
  }
  var jobs = LS.get('bf_jobs', []);
  if ($id('bfJobTbody')) {
    $id('bfJobTbody').innerHTML = jobs.length ? jobs.map(function (j) {
      return '<tr><td><b>' + esc(j.co) + '</b></td><td>' + esc(j.pos) + '</td><td>' + fmtD(j.date) + '</td><td>' + esc(j.status) + '</td><td style="font-size:12px">' + esc(j.note || '—') + '</td><td></td></tr>';
    }).join('') : '<tr><td colspan="6" class="empty-tip">尚未有投遞記錄</td></tr>';
    var rows = $id('bfJobTbody').querySelectorAll('tr');
    jobs.forEach(function (j, i) {
      if (rows[i]) rows[i].appendChild(delBtnCell(function () { jobs.splice(i, 1); LS.set('bf_jobs', jobs); renderBfCareer(); }));
    });
  }
}
function initBfCareer() {
  if ($id('bfCarSaveBtn')) $id('bfCarSaveBtn').onclick = function () {
    var c = LS.get('bf_career', {});
    c.goal = $id('bfCarGoal').value.trim();
    c.industry = $id('bfCarIndustry').value.trim();
    c.positions = $id('bfCarPositions').value.trim();
    LS.set('bf_career', c); toast('職業規劃已儲存 ✓');
  };
  if ($id('bfSkillSaveBtn')) $id('bfSkillSaveBtn').onclick = function () {
    var c = LS.get('bf_career', {});
    c.skills = { now: $id('bfSkillNow').value, gap: $id('bfSkillGap').value, plan: $id('bfSkillPlan').value };
    LS.set('bf_career', c); toast('技能檢查已儲存 ✓');
  };
  if ($id('bfAddJobBtn')) $id('bfAddJobBtn').onclick = function () {
    var co = $id('bfJobCo').value.trim(), pos = $id('bfJobPos').value.trim();
    if (!co || !pos) { toast('請填寫公司和職位'); return; }
    var a = LS.get('bf_jobs', []);
    a.push({ co: co, pos: pos, date: $id('bfJobDate').value, status: $id('bfJobStatus').value, note: $id('bfJobNote').value.trim() });
    LS.set('bf_jobs', a);
    ['bfJobCo', 'bfJobPos', 'bfJobDate', 'bfJobNote'].forEach(function (i) { $id(i).value = ''; });
    renderBfCareer(); toast('已記錄 ✓');
  };
}

/* ============================================================
   BF 模塊 9：更新個人檔案
   ============================================================ */
function renderBfProfile() {
  var p = bfProfile();
  if ($id('bfPfName')) $id('bfPfName').value = p.name || '';
  if ($id('bfPfSid')) $id('bfPfSid').value = p.sid || '';
  if ($id('bfPfSchool')) $id('bfPfSchool').value = p.school || '';
  if ($id('bfPfYear')) $id('bfPfYear').value = p.year || '';
  if ($id('bfPfMajor')) $id('bfPfMajor').value = p.major || '';
  if ($id('bfPfGpa')) $id('bfPfGpa').value = p.gpa || '';
  if ($id('bfPfTargetGpa')) $id('bfPfTargetGpa').value = p.target || '';
  if ($id('bfPfNote')) $id('bfPfNote').value = p.note || '';
}
function initBfProfile() {
  if ($id('bfPfSaveBtn')) $id('bfPfSaveBtn').onclick = function () {
    var p = bfProfile();
    p.name = $id('bfPfName').value.trim() || p.name;
    p.sid = $id('bfPfSid').value.trim();
    p.school = $id('bfPfSchool').value.trim();
    p.year = $id('bfPfYear').value.trim();
    p.major = $id('bfPfMajor').value.trim();
    p.gpa = $id('bfPfGpa').value ? Number($id('bfPfGpa').value) : '';
    p.target = $id('bfPfTargetGpa').value ? Number($id('bfPfTargetGpa').value) : '';
    p.note = $id('bfPfNote').value.trim();
    LS.set('bf_profile', p);
    renderBfDash(); renderBfPrograms(); renderSidebarIdentity(); toast('男友檔案已儲存 ✓');
  };
}

/* ============================================================
   通知中心
   ============================================================ */
function collectNotifs() {
  var items = [];
  if (ACCT === 'ly') {
    FIX.lyDeadlines.forEach(function (x) { items.push({ id: 'lyfix' + x.d + x.t, t: x.t, d: x.d, tag: '日程' }); });
    LS.get('todos', []).forEach(function (t) { if (!t.done && t.due) items.push({ id: 'todo' + t.t, t: '📋 ' + t.t, d: t.due, tag: '待辦' }); });
  } else {
    bfAllTimeline().forEach(function (x) { items.push({ id: 'bffix' + x.d + x.t, t: x.t, d: x.d, tag: '申請' }); });
  }
  items.forEach(function (x) { x.n = daysUntil(x.d); });
  return items.filter(function (x) { return x.n != null && x.n >= -7 && x.n <= 45; })
    .sort(function (a, b) { return a.n - b.n; });
}
function renderNotifs() {
  var items = collectNotifs();
  var urgCount = items.filter(function (x) { return x.n >= 0 && x.n <= 7; }).length;
  if ($id('bellBadge')) {
    $id('bellBadge').hidden = urgCount === 0;
    $id('bellBadge').textContent = urgCount;
  }
  if ($id('notifList')) {
    $id('notifList').innerHTML = items.length ? items.map(function (x) {
      var cls = x.n < 0 ? 'ok' : x.n <= 7 ? 'urg' : 'warn';
      var lbl = x.n < 0 ? '已過' : x.n === 0 ? '今天' : x.n + ' 天';
      return '<div class="notif-item"><span class="n-ico">' + (x.n <= 7 ? '🚨' : '📆') + '</span>' +
        '<div><div class="n-title">' + esc(x.t) + '</div><div class="n-sub">' + x.tag + ' · ' + fmtD(x.d) + '</div></div>' +
        '<span class="n-days ' + cls + '">' + lbl + '</span></div>';
    }).join('') : '<div class="empty-tip" style="padding:14px">📭 暫無即將到期的提醒</div>';
  }
}
function maybeBrowserNotify() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  var today = todayStr();
  var sent = LS.get('notif_sent', {});
  var items = collectNotifs().filter(function (x) { return x.n >= 0 && x.n <= 3 && sent[x.id] !== today; });
  if (!items.length) return;
  items.slice(0, 3).forEach(function (x) {
    try {
      new Notification('Lok Yi Hub 提醒', { body: (x.n === 0 ? '今天到期：' : x.n + ' 天後到期：') + x.t, icon: 'icons/icon-192.png', tag: x.id });
    } catch (e) {}
    sent[x.id] = today;
  });
  LS.set('notif_sent', sent);
}
function initNotifUI() {
  if ($id('bellBtn')) $id('bellBtn').onclick = function () {
    var p = $id('notifPanel');
    p.hidden = !p.hidden;
    if (!p.hidden) renderNotifs();
  };
  if ($id('closeNotifBtn')) $id('closeNotifBtn').onclick = function () { $id('notifPanel').hidden = true; };
  if ($id('enableNotifBtn')) $id('enableNotifBtn').onclick = function () {
    if (!('Notification' in window)) { toast('此瀏覽器不支援通知'); return; }
    Notification.requestPermission().then(function (r) {
      toast(r === 'granted' ? '🔔 通知已啟用！' : '未啟用（可稍後在瀏覽器設定開啟）');
      if (r === 'granted') maybeBrowserNotify();
    });
  };
}

/* ============================================================
   Loki AI 助手（本地知識庫）
   ============================================================ */
var LOKI_KB = [
  { k: ['tsfs', '資助', 'grant', '入息審查'], a: '📑 TSFS（專上學生資助計劃）2026/27 截止 2026/9/25：Grant $52,450–$91,150 + Loan 上限 $58,200，需家庭入息審查。文件可到 SAO 簡報會（8/25、8/28、9/2）了解，經 POSS 系統登記。' },
  { k: ['nlsft', '貸款', '免入息'], a: '💰 NLSFT（免入息審查貸款）：行政費 $365，利率約 2.173% p.a.，同樣 9/25 截止。不需入息審查，全家可申。' },
  { k: ['wie', '實習', '學分轉移', 'ar41c'], a: '💼 WIE 學分轉移（Senior Year 適用）：截止 2026/8/31，經 eStudent 提交 AR41C。資格：5 年內、酒店/旅遊相關、≥3 個月或 480 小時（含兼職）。文件：① Sub-degree 成績單 ② 機構證明 ③ Pre-entry Internship Work Record。查詢：ada.au@polyu.edu.hk / 3400-2201。' },
  { k: ['exchange', '交換'], a: '✈️ SHTM 交換計劃（2026/27 Sem 2）：申請截止 2026/9/3（四）13:00（Qualtrics），面試 9/7–9/8。文件：Course Selection Form、Supporting Statement（400–500 字）、英文 CV、成績單、語言成績（如有）、證件相 600×800。' },
  { k: ['選科', 'reg', 'add/drop', 'add drop', '報名'], a: '📚 2026/27 Sem 1 選科：Mock 8/17–8/20 → 正式選科 8/21 10:00 – 8/25 23:59 → 開學前調整 8/28–8/30 → Add/Drop 8/31–9/12。AR 熱線：2766 5599 / 5191 / 5172。' },
  { k: ['cuhk', '新媒體', '碩士', '升學', 'msc'], a: '🎓 CUHK MSc in New Media：需學士學位 + IELTS ≥ 6.5 / TOEFL ≥ 79 + SOP + 推薦信 ×2。9 月開放申請，優先輪約 12 月初截止（滾動取錄）。建議 10 月起準備 SOP 與作品集。' },
  { k: ['cv', '簡歷', 'resume'], a: '📝 到「簡歷生成器」選好模板（求職/交換/資助/升學）→ 填資料 → 按「✨ AI 生成」按鈕輔助 → 生成 → 複製或下載。所有版本都存在本機。' },
  { k: ['deadline', '截止', '日程', '重要'], a: '🚨 最近的大事：WIE 學分轉移 8/31 截止 → 交換申請 9/3 13:00 截止 → TSFS/NLSFT 9/25 截止。詳情看右上 🔔 通知中心。' },
  { k: ['ielts', '英文', '託福', 'toefl'], a: '🗣 語言：CUHK 新媒體碩士要求 IELTS ≥ 6.5 / TOEFL ≥ 79。建議 2026 年 12 月前應考，預留二刷時間。' },
  { k: ['gpa'], a: '📈 GPA 資料：Lok Yi 在「更新個人檔案」記錄；Austin（男友帳號）當前 3.78 / 目標 3.80，Sem1 3.86 · Sem2 3.72，已修 33/63 學分。' },
  { k: ['non-jupas', 'non jupas', 'senior year', '院校', '報校'], a: '🎓 Austin 的 Non-JUPAS（2027/28）：建議 6–8 個課程「衝穩保」組合，12 月前遞交佔優。詳情看「Non-JUPAS 院校庫」與「報名操作說明書」，或問我「錄取機會」。' },
  { k: ['錄取', '機會', '評估'], a: function () {
      var p = bfProfile(); var gpa = Number(p.gpa) || 0;
      var top = FIX.programs.map(function (pr) {
        var pct = Math.max(5, Math.min(95, Math.round(50 + (gpa - pr.avg) * 160)));
        return { n: pr.uni + ' ' + pr.name, pct: pct };
      }).sort(function (a, b) { return b.pct - a.pct; }).slice(0, 4);
      return '📊 以 GPA ' + gpa.toFixed(2) + ' 評估（僅供參考）：\n' + top.map(function (x) { return '• ' + x.n + '：約 ' + x.pct + '%'; }).join('\n') + '\n完整列表看「男友總覽 → 錄取評估」。';
    } },
  { k: ['通知', '提醒'], a: '🔔 點右上角 🔔 開通知中心 → 按「啟用瀏覽器通知」，3 天內到期的事會推送提醒。' },
  { k: ['安裝', 'app', 'pwa', '手機'], a: '📲 手機打開本站 → Safari「加入主畫面」或 Chrome「安裝應用程式」，即可像 App 一樣全螢幕使用，離線也能開。' },
  { k: ['備份', '匯出', 'export', '資料'], a: '💾 所有資料存在瀏覽器本機。側邊欄「⬇️ 匯出所有資料」可下載 JSON 備份；換手機前記得先匯出！' },
  { k: ['求職', '兼職', '工作', '招聘'], a: '🔍 求職入口：PolyU Job Board、LinkedIn、JobsDB、CTgoodjobs、Indeed、HospitalityNet… 都在「實習兼職搜尋」頁。' },
  { k: ['你好', 'hi', 'hello', 'hi loki', '在做什麼'], a: '你好呀 👋 我是 Loki，你的專屬助手。可以問我：WIE 點申請學分轉移？TSFS 截止幾時？交換要什麼文件？Austin 錄取機會？' }
];

var LOKI_QUICK = {
  dashboard: ['🚨 最近有什麼大事？', '📑 TSFS 怎麼申請？', '教你安裝成 App'],
  reg: ['📚 選科時間是？', '還差多少學分？'],
  wie: ['💼 WIE 學分轉移文件？', '⏳ 距離截止還有幾天？'],
  exchange: ['✈️ 交換申請要什麼文件？', '什麼時候面試？'],
  funding: ['📑 TSFS vs NLSFT？', '簡報會怎麼登記？'],
  resume: ['📝 幫我寫個人簡介', '簡歷有哪 4 個模板？'],
  jobs: ['🔍 有哪些求職網站？', '怎麼追蹤投遞狀態？'],
  career: ['🎓 CUHK 新媒體碩士要求？', '🎯 我該走哪個方向？'],
  study: ['📅 本週時間表？', '怎麼上傳課堂 PPT？'],
  todos: ['✅ 最近緊急待辦？', '怎麼匯出待辦？'],
  library: ['📎 怎麼收藏連結？'],
  ip: ['🎥 怎麼建立我的 IP 頁？'],
  ly_profile_edit: ['💾 資料存在哪裡？'],
  bf_dash: ['📊 錄取機會評估', '🎯 目標課程建議'],
  bf_subjects: ['📚 我已完成多少學分？', '➕ 怎麼新增科目？'],
  bf_nonjupas: ['🎓 衝穩保怎麼選？', '⭐ 怎麼收藏課程？'],
  bf_materials: ['📎 需要準備什麼材料？'],
  bf_cv_suggestions: ['📝 CV 怎麼改善？', '💡 需要學 SQL 嗎？'],
  bf_timeline: ['⏰ 下一個截止日？', 'IELTS 什麼時候考？'],
  bf_guide: ['📘 報名流程第一步？', '💰 報名費多少？'],
  bf_career: ['🏦 金融數據崗好嗎？', '📡 求職渠道？'],
  bf_profile_edit: ['💾 資料存在哪裡？']
};

function lokiAnswer(q) {
  q = q.toLowerCase();
  var best = null, bestScore = 0;
  LOKI_KB.forEach(function (e) {
    var score = 0;
    e.k.forEach(function (kw) { if (q.indexOf(kw.toLowerCase()) >= 0) score += kw.length; });
    if (score > bestScore) { bestScore = score; best = e; }
  });
  if (best) return typeof best.a === 'function' ? best.a() : best.a;
  /* 頁面上下文提示 */
  var ctx = {
    dashboard: '你在 Dashboard，可問我「最近有什麼大事」或「TSFS 截止日」。',
    reg: '你在 REG 學分管理，可問「選科時間」「畢業學分」。',
    wie: '你在 WIE 頁，可問「學分轉移文件」「截止倒數」。',
    exchange: '你在交換計劃頁，可問「申請文件」「面試時間」。',
    funding: '你在資助頁，可問「TSFS 和 NLSFT 分別」。',
    resume: '你在簡歷生成器，可問「4 個模板分別」。',
    bf_dash: '你在男友總覽，可問「錄取機會評估」。'
  }[PAGE];
  return '🤔 這題我還在學習…\n試試問：WIE 學分轉移、TSFS 截止、交換文件、CUHK 新媒體、Austin 錄取機會、怎樣安裝 App。\n' + (ctx ? '\n（提示：' + ctx + '）' : '');
}

function initLoki() {
  var msgs = $id('aiMessages');
  function addMsg(text, who) {
    var m = document.createElement('div');
    m.className = 'msg ' + (who || 'bot');
    m.textContent = text;
    msgs.appendChild(m);
    msgs.scrollTop = msgs.scrollHeight;
  }
  function ask(q) {
    addMsg(q, 'user');
    setTimeout(function () {
      addMsg(lokiAnswer(q), 'bot');
    }, 420);
  }
  window.LokiAI = {
    toggle: function () {
      var p = $id('aiPanel');
      if (p.hidden) { window.LokiAI.show(); } else { window.LokiAI.hide(); }
    },
    show: function () {
      $id('aiPanel').hidden = false;
      $id('aiLauncher').classList.add('is-hidden');
      if (!msgs.childElementCount) {
        addMsg('Hi Lok Yi 👋 我是 Loki，你的專屬助手。\n已載入你的課程、申請、倒計時資料，直接問我任何問題！', 'bot');
      }
      window.LokiAI.renderQuick();
      setTimeout(function () { if ($id('aiInput')) $id('aiInput').focus(); }, 120);
    },
    hide: function () {
      $id('aiPanel').hidden = true;
      $id('aiLauncher').classList.remove('is-hidden');
    },
    renderQuick: function () {
      var chips = LOKI_QUICK[PAGE] || ['🚨 最近有什麼大事？'];
      if ($id('aiQuick')) {
        $id('aiQuick').innerHTML = chips.map(function (c) {
          return '<button class="ai-chip" data-q="' + esc(c) + '">' + esc(c) + '</button>';
        }).join('');
        $qa('#aiQuick .ai-chip').forEach(function (b) {
          b.onclick = function () { ask(b.getAttribute('data-q')); };
        });
      }
    },
    ask: ask
  };

  if ($id('aiSendBtn')) $id('aiSendBtn').onclick = function () {
    var v = $id('aiInput').value.trim();
    if (!v) return;
    $id('aiInput').value = '';
    ask(v);
  };
  if ($id('aiInput')) {
    $id('aiInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        $id('aiSendBtn').click();
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
  if (mode === 'auto') {
    dark = !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  } else {
    dark = (mode === 'dark');
  }
  root.setAttribute('data-theme', dark ? 'dark' : 'light');
  var btn = $id('themeBtn');
  if (btn) btn.textContent = dark ? '☀️' : '🌙';
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#151a23' : '#83001A');
}
function initTheme() {
  applyTheme(LS.get('theme', 'auto'));
  if ($id('themeBtn')) $id('themeBtn').onclick = function () {
    var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    LS.set('theme', next);
    applyTheme(next);
    toast(next === 'dark' ? '🌙 已切換至深色模式' : '🌤 已切換至淺色模式');
  };
  if (window.matchMedia) {
    try {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var h = function () { if (LS.get('theme', 'auto') === 'auto') applyTheme('auto'); };
      if (mq.addEventListener) mq.addEventListener('change', h);
      else if (mq.addListener) mq.addListener(h);
    } catch (e) {}
  }
}

/* ---- 2. 匯入備份（與「匯出所有資料」配套） ---- */
function initImport() {
  var btn = $id('importBtn'), file = $id('importFile');
  if (!btn || !file) return;
  btn.onclick = function () { file.click(); };
  file.onchange = function () {
    var f = file.files && file.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      var data = null;
      try { data = JSON.parse(r.result); } catch (e) {}
      if (!data || typeof data !== 'object' || Array.isArray(data)) { toast('❌ 不是有效的備份 JSON 檔'); return; }
      delete data.__export_time;
      var keys = Object.keys(data);
      if (!keys.length) { toast('❌ 備份檔內沒有資料'); return; }
      showConfirm('備份包含 ' + keys.length + ' 項資料（兩個帳號的資料都會還原）。\n匯入會覆蓋現有同名資料，確定繼續嗎？').then(function (ok) {
        if (!ok) return;
        keys.forEach(function (k) { LS.set(k, data[k]); });
        toast('✅ 匯入成功，正在重新載入…');
        setTimeout(function () { location.reload(); }, 900);
      });
    };
    r.onerror = function () { toast('❌ 讀取檔案失敗'); };
    r.readAsText(f, 'utf-8');
    file.value = '';
  };
}

/* ---- 3. 全域搜尋（跨模組） ---- */
function collectSearchItems() {
  var out = [];
  function push(text, sub, page, acct) {
    text = String(text == null ? '' : text).trim();
    if (!text) return;
    out.push({ text: text, sub: sub, page: page, acct: acct, kw: (text + ' ' + sub).toLowerCase() });
  }
  LS.get('todos', []).forEach(function (t) { push(t.t, '✅ 待辦 · ' + (t.cat || '') + (t.due ? ' · ' + fmtD(t.due) : ''), 'todos', 'ly'); });
  LS.get('subs', []).forEach(function (s) { push((s.code || '') + ' ' + (s.name || ''), '📚 科目資料庫 · ' + (s.grade || ''), 'reg', 'ly'); });
  LS.get('jobs', []).forEach(function (j) { push((j.co || '') + ' · ' + (j.pos || ''), '🔍 求職追蹤 · ' + (j.status || ''), 'jobs', 'ly'); });
  LS.get('bookmarks', []).forEach(function (b) { push((b.n || '') + ' — ' + (b.u || ''), '📎 收藏連結 · ' + (b.tag || ''), 'library', 'ly'); });
  LS.get('docs', []).forEach(function (d) { push((d.n || '') + ' — ' + (d.loc || ''), '📂 文檔位置', 'library', 'ly'); });
  LS.get('interns', []).forEach(function (s) { push((s.pos || '') + ' · ' + (s.co || ''), '💼 實習記錄', 'wie', 'ly'); });
  LS.get('funds', []).forEach(function (f) { push(f.name || '', '📑 資助申請 · ' + (f.due ? fmtD(f.due) : ''), 'funding', 'ly'); });
  LS.get('bf_subjects', []).forEach(function (s) { push((s.code || '') + ' ' + (s.name || ''), "📚 Austin 科目 · " + (s.status || ''), 'bf_subjects', 'bf'); });
  LS.get('bf_timeline_custom', []).forEach(function (x) { push(x.t, '⏰ Austin 自訂倒數 · ' + fmtD(x.d), 'bf_timeline', 'bf'); });
  FIX.lyDeadlines.forEach(function (x) { push(x.t, '🗓 固定日程 · ' + fmtD(x.d), 'calendar', 'ly'); });
  return out;
}
function initSearch() {
  var inp = $id('gsearchInput'), drop = $id('gsearchDrop');
  if (!inp || !drop) return;
  inp.addEventListener('input', debounce(function () {
    var q = inp.value.trim().toLowerCase();
    if (!q) { drop.hidden = true; drop.innerHTML = ''; return; }
    var hits = collectSearchItems().filter(function (x) { return x.kw.indexOf(q) >= 0; }).slice(0, 12);
    drop.innerHTML = hits.length
      ? hits.map(function (x, i) {
          return '<div class="gs-item" data-i="' + i + '" data-acct="' + x.acct + '" data-page="' + x.page + '">' +
                 '<div class="gs-t">' + esc(x.text) + '</div><div class="gs-s">' + esc(x.sub) + ' · ' + (x.acct === 'bf' ? '男友帳號' : '我的帳號') + '</div></div>';
        }).join('')
      : '<div class="gs-empty">找不到與「' + esc(inp.value.trim()) + '」相關的內容</div>';
    drop.hidden = false;
    $qa('.gs-item', drop).forEach(function (el) {
      el.onclick = function () {
        if (el.getAttribute('data-acct') !== ACCT) switchAcct(el.getAttribute('data-acct'));
        goPage(el.getAttribute('data-page'));
        drop.hidden = true; inp.value = ''; inp.blur();
      };
    });
  }, 160));
  inp.addEventListener('focus', function () { if (inp.value.trim()) inp.dispatchEvent(new Event('input')); });
  inp.addEventListener('keydown', function (e) { if (e.key === 'Escape') { drop.hidden = true; inp.blur(); } });
  document.addEventListener('click', function (e) {
    var w = $id('gsearchWrap');
    if (w && !w.contains(e.target)) drop.hidden = true;
  });
}

/* ---- 4. D-Day 重大節點倒數 ---- */
var DDAY_FIX = [
  { icon: '📚', t: '正式選科結束', d: '2026-08-25' },
  { icon: '🚨', t: 'WIE 學分轉移截止', d: '2026-08-31' },
  { icon: '🏫', t: 'Sem 1 開課', d: '2026-08-31' },
  { icon: '✈️', t: '交換計劃申請截止', d: '2026-09-03' },
  { icon: '💬', t: '交換計劃面試', d: '2026-09-07' },
  { icon: '📑', t: 'TSFS / NLSFT 截止', d: '2026-09-25' },
  { icon: '🎓', t: 'CUHK 碩士優先輪（約）', d: '2026-12-01' }
];
function renderDDay() {
  var box = $id('ddayRow');
  if (!box) return;
  var items = DDAY_FIX.map(function (x) { return { icon: x.icon, t: x.t, d: x.d, n: daysUntil(x.d) }; })
    .filter(function (x) { return x.n != null && x.n >= 0; })
    .sort(function (a, b) { return a.n - b.n; })
    .slice(0, 6);
  box.innerHTML = items.length
    ? items.map(function (x) {
        return '<div class="dday-card' + (x.n <= 7 ? ' urg' : '') + '" title="' + esc(x.t) + '">' +
               '<div class="dday-icon">' + x.icon + '</div>' +
               '<div class="dday-num">' + (x.n === 0 ? '今' : x.n) + '</div>' +
               '<div class="dday-lbl">天</div>' +
               '<div class="dday-t">' + esc(x.t) + '</div>' +
               '<div class="dday-d">' + fmtD(x.d) + '</div></div>';
      }).join('')
    : '<div class="empty-tip">目前沒有未來的重大節點 🎉</div>';
}

/* ---- 5. 月曆總覽 ---- */
var CALYM = null; /* 當前顯示年月 'YYYY-MM' */
function calEventsAll() {
  var ev = [];
  FIX.lyDeadlines.forEach(function (x) { ev.push({ d: x.d, t: x.t, src: '🗓 學校日程' }); });
  LS.get('todos', []).forEach(function (t) { if (t.due && !t.done) ev.push({ d: t.due, t: '📋 ' + t.t, src: '✅ 待辦 · ' + (t.cat || '') }); });
  LS.get('funds', []).forEach(function (f) { if (f.due) ev.push({ d: f.due, t: '📑 ' + (f.name || '資助申請'), src: '資助截止' }); });
  LS.get('jobs', []).forEach(function (j) { if (j.int) ev.push({ d: j.int, t: '💼 面試 · ' + (j.co || '') + ' ' + (j.pos || ''), src: '求職面試' }); });
  return ev;
}
function shiftYM(ym, delta) {
  var y = +ym.slice(0, 4), m = +ym.slice(5, 7) + delta;
  if (m < 1) { m = 12; y--; }
  if (m > 12) { m = 1; y++; }
  return y + '-' + pad2(m);
}
function calDateTitle(ds) {
  var p = String(ds).split('-').map(Number);
  var d = new Date(p[0], p[1] - 1, p[2]);
  return (p[0]) + '/' + (p[1]) + '/' + (p[2]) + '（週' + WEEK_ZH[d.getDay()] + '）';
}
function renderCalendar(ym) {
  var grid = $id('calGrid');
  if (!grid) return;
  if (!ym) ym = CALYM || todayStr().slice(0, 7);
  CALYM = ym;
  var y = +ym.slice(0, 4), m = +ym.slice(5, 7);
  var startDow = new Date(y, m - 1, 1).getDay(); /* 0 = 週日 */
  var daysInMonth = new Date(y, m, 0).getDate();
  var evs = {};
  calEventsAll().forEach(function (e) { (evs[e.d] = evs[e.d] || []).push(e); });
  var html = WEEK_ZH.map(function (w) { return '<div class="cal-dow">' + w + '</div>'; }).join('');
  var i;
  for (i = 0; i < startDow; i++) html += '<div class="cal-cell mute"></div>';
  var today = todayStr();
  for (var d = 1; d <= daysInMonth; d++) {
    var ds = y + '-' + pad2(m) + '-' + pad2(d);
    var list = evs[ds] || [];
    var urg = list.some(function (e) { return e.t.indexOf('🚨') >= 0 || e.t.indexOf('截止') >= 0; });
    html += '<div class="cal-cell' + (ds === today ? ' today' : '') + '" data-d="' + ds + '" title="' + esc(list.map(function (e) { return e.t; }).join('\n')) + '">' +
            '<span class="cal-dnum">' + d + '</span>' +
            (list.length ? '<span class="cal-dot' + (urg ? ' urg' : '') + '"></span><span class="cal-cnt">' + list.length + '</span>' : '') +
            '</div>';
  }
  grid.innerHTML = html;
  if ($id('calTitle')) $id('calTitle').textContent = y + ' 年 ' + m + ' 月';
  $qa('#calGrid .cal-cell[data-d]').forEach(function (c) {
    c.onclick = function () {
      $qa('#calGrid .cal-cell').forEach(function (x) { x.classList.remove('sel'); });
      c.classList.add('sel');
      renderCalDay(c.getAttribute('data-d'));
    };
  });
  renderCalUpcoming();
}
function renderCalDay(ds) {
  var box = $id('calDayList');
  if (!box) return;
  if ($id('calDayTitle')) $id('calDayTitle').textContent = calDateTitle(ds);
  var evs = calEventsAll().filter(function (e) { return e.d === ds; });
  box.innerHTML = evs.length
    ? evs.map(function (e) {
        return '<div class="plan-item"><div><div class="p-title">' + esc(e.t) + '</div><div class="p-sub">' + esc(e.src) + '</div></div>' +
               '<div class="p-right"><span class="p-badge ' + urgencyInfo(ds).cls + '">' + daysBadge(ds) + '</span></div></div>';
      }).join('')
    : '<div class="empty-tip">此日沒有事項</div>';
}
function renderCalUpcoming() {
  var box = $id('calUpcoming');
  if (!box) return;
  var all = calEventsAll().map(function (e) { e.n = daysUntil(e.d); return e; })
    .filter(function (e) { return e.n != null && e.n >= 0 && e.n <= 30; })
    .sort(function (a, b) { return a.n - b.n; });
  box.innerHTML = all.length
    ? all.map(function (e) {
        var u = urgencyInfo(e.d);
        return '<div class="plan-item"><div><div class="p-title">' + esc(e.t) + '</div><div class="p-sub">' + esc(e.src) + ' · ' + fmtD(e.d) + '</div></div>' +
               '<div class="p-right"><span class="p-badge ' + u.cls + '">' + u.label + '</span></div></div>';
      }).join('')
    : '<div class="empty-tip">未來 30 日內沒有待辦事項 🎉</div>';
}
function initCalendar() {
  var prev = $id('calPrev'), next = $id('calNext'), todayBtn = $id('calToday');
  if (prev) prev.onclick = function () { renderCalendar(shiftYM(CALYM || todayStr().slice(0, 7), -1)); };
  if (next) next.onclick = function () { renderCalendar(shiftYM(CALYM || todayStr().slice(0, 7), 1)); };
  if (todayBtn) todayBtn.onclick = function () {
    renderCalendar(todayStr().slice(0, 7));
    var td = $qa('#calGrid .cal-cell').filter(function (c) { return c.getAttribute('data-d') === todayStr(); })[0];
    if (td) td.click(); else renderCalDay(todayStr());
  };
}

/* ---- 6. GPA 計算器（Austin · 4.3 制） ---- */
var GPASCALE = { 'A+': 4.3, 'A': 4.0, 'A-': 3.7, 'B+': 3.3, 'B': 3.0, 'B-': 2.7, 'C+': 2.3, 'C': 2.0, 'C-': 1.7, 'D': 1.0, 'F': 0 };
function updateGpaResult() {
  var rows = LS.get('bf_gpacalc', []);
  var totalCr = 0, totalPt = 0, has = false;
  rows.forEach(function (r) {
    var cr = +r.cr;
    if (cr > 0 && GPASCALE[r.g] != null) { totalCr += cr; totalPt += cr * GPASCALE[r.g]; has = true; }
  });
  var gpa = totalCr ? (totalPt / totalCr).toFixed(2) : null;
  if ($id('gpaResult')) $id('gpaResult').innerHTML = has ? '<b>' + gpa + '</b> / 4.3 <span style="font-size:12px;color:var(--mut)">（' + totalCr + ' 學分加權）</span>' : '— / 4.3';
  if ($id('gpaHint')) {
    var h = '加入科目後自動計算加權 GPA';
    if (has) {
      var g = +gpa;
      h = g >= 3.8 ? '🌟 保持這水平 — 衝刺課程（Computing & AI 等）也穩！'
        : g >= 3.5 ? '👍 不錯 — 距 3.8 還差 ' + (3.8 - g).toFixed(2) + '，約每科升一級'
        : '💪 加把勁 — 多修高學分必修科並衝 A / A+';
    }
    $id('gpaHint').textContent = h;
  }
}
function renderGpaCalc() {
  var box = $id('gpaRows');
  if (!box) return;
  var rows = LS.get('bf_gpacalc', []);
  box.innerHTML = rows.length
    ? rows.map(function (r, i) {
        var opts = Object.keys(GPASCALE).map(function (g) { return '<option value="' + g + '"' + (r.g === g ? ' selected' : '') + '>' + g + '</option>'; }).join('');
        return '<div class="gpa-row">' +
               '<input value="' + esc(r.n || '') + '" placeholder="科目（例：STA2011）" data-gi="' + i + '" data-gf="n" />' +
               '<input type="number" min="0" max="9" step="0.5" value="' + (r.cr != null && r.cr !== '' ? r.cr : '') + '" placeholder="學分" data-gi="' + i + '" data-gf="cr" />' +
               '<select data-gi="' + i + '" data-gf="g">' + opts + '</select>' +
               '<button class="row-del" data-gdel="' + i + '" title="刪除">🗑</button></div>';
      }).join('')
    : '<div class="empty-tip">尚未加入科目 — 點「＋ 新增科目」開始模擬</div>';
  $qa('#gpaRows [data-gi]').forEach(function (el) {
    var handler = function () {
      var rows2 = LS.get('bf_gpacalc', []);
      var i2 = +el.getAttribute('data-gi'), f = el.getAttribute('data-gf');
      rows2[i2][f] = el.value;
      LS.set('bf_gpacalc', rows2);
      if (el.tagName === 'SELECT') renderGpaCalc(); else updateGpaResult();
    };
    if (el.tagName === 'SELECT') el.addEventListener('change', handler);
    else el.addEventListener('input', debounce(handler, 300));
  });
  $qa('#gpaRows [data-gdel]').forEach(function (b) {
    b.onclick = function () {
      var rows2 = LS.get('bf_gpacalc', []);
      rows2.splice(+b.getAttribute('data-gdel'), 1);
      LS.set('bf_gpacalc', rows2);
      renderGpaCalc();
    };
  });
  updateGpaResult();
}
function initGpaCalc() {
  var add = $id('addGpaRowBtn');
  if (!add) return;
  add.onclick = function () {
    var rows = LS.get('bf_gpacalc', []);
    rows.push({ n: '', cr: '', g: 'A' });
    LS.set('bf_gpacalc', rows);
    renderGpaCalc();
  };
}

/* ---- 7. 簡歷列印 / 存 PDF ---- */
function initPrintResume() {
  var b = $id('printResumeBtn');
  if (!b) return;
  b.onclick = function () {
    var txt = ($id('resumeOut') || {}).value || '';
    if (!txt.trim()) { toast('請先生成簡歷再列印'); return; }
    var w = window.open('', '_blank');
    if (!w) { toast('請允許彈出視窗以使用列印功能'); return; }
    var safe = txt.replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; });
    w.document.write('<html><head><meta charset="utf-8"><title>Resume — Lok Yi Chan</title>' +
      '<style>body{font-family:Arial,"Noto Sans TC",sans-serif;white-space:pre-wrap;padding:36px 40px;font-size:13px;line-height:1.75;color:#111}@media print{body{padding:16px 8px}}</style>' +
      '</head><body>' + safe + '</body></html>');
    w.document.close();
    setTimeout(function () { try { w.focus(); w.print(); } catch (e) {} }, 350);
  };
}

/* ============================================================
   🆕 v2.2 新功能：內容管理中心 + GitHub Gist 跨裝置雲同步
   ============================================================ */

/* ---- 固定內容覆蓋機制（出廠預設 ←→ App 內編輯） ---- */
var FIX_DL_ORIG = null, DDAY_FIX_ORIG = null;
function loadFixOverrides() {
  FIX_DL_ORIG = JSON.parse(JSON.stringify(FIX.lyDeadlines));
  DDAY_FIX_ORIG = JSON.parse(JSON.stringify(DDAY_FIX));
  var dl = LS.get('fix_dl', null);
  if (dl && typeof dl.length === 'number' && dl.length) FIX.lyDeadlines = dl;
  var dd = LS.get('fix_dday', null);
  if (dd && typeof dd.length === 'number' && dd.length) DDAY_FIX = dd;
}
function saveDl(list) { LS.set('fix_dl', list); FIX.lyDeadlines = list; }
function saveDd(list) { LS.set('fix_dday', list); DDAY_FIX = list; }

/* ---- 公告 ---- */
function renderAnnouncement() {
  var card = $id('annCard'), box = $id('annBox');
  if (!card || !box) return;
  var v = LS.get('announcement', '');
  box.textContent = v;
  card.hidden = !v.trim();
}

/* ---- 內容管理：日程編輯器 ---- */
function renderCmDl() {
  var box = $id('cmDlRows');
  if (!box) return;
  var list = FIX.lyDeadlines;
  box.innerHTML = list.length ? list.map(function (x, i) {
    return '<div class="cm-row">' +
      '<input value="' + esc(x.t) + '" data-ci="' + i + '" data-cf="t" data-ck="dl" placeholder="標題" />' +
      '<input type="date" value="' + esc(x.d) + '" data-ci="' + i + '" data-cf="d" data-ck="dl" />' +
      '<button class="row-del" data-cdel="' + i + '" data-ck="dl" title="刪除">🗑</button></div>';
  }).join('') : '<div class="empty-tip">暫無日程 — 於下方新增</div>';
  bindCmRows(box, 'dl', function (list2) { saveDl(list2); renderAll(); });
}
/* ---- 內容管理：D-Day 編輯器 ---- */
function renderCmDd() {
  var box = $id('cmDdRows');
  if (!box) return;
  var list = DDAY_FIX;
  box.innerHTML = list.length ? list.map(function (x, i) {
    return '<div class="cm-row cm-row-dd">' +
      '<input value="' + esc(x.icon) + '" data-ci="' + i + '" data-cf="icon" data-ck="dd" placeholder="🎯" />' +
      '<input value="' + esc(x.t) + '" data-ci="' + i + '" data-cf="t" data-ck="dd" placeholder="標題" />' +
      '<input type="date" value="' + esc(x.d) + '" data-ci="' + i + '" data-cf="d" data-ck="dd" />' +
      '<button class="row-del" data-cdel="' + i + '" data-ck="dd" title="刪除">🗑</button></div>';
  }).join('') : '<div class="empty-tip">暫無 D-Day 節點</div>';
  bindCmRows(box, 'dd', function (list2) { saveDd(list2); renderDDay(); });
}
function bindCmRows(box, kind, afterSave) {
  $qa('input[data-ci]', box).forEach(function (inp) {
    var h = function () {
      var list2 = JSON.parse(JSON.stringify(kind === 'dl' ? FIX.lyDeadlines : DDAY_FIX));
      var i = +inp.getAttribute('data-ci');
      list2[i][inp.getAttribute('data-cf')] = inp.value;
      if (kind === 'dl') saveDl(list2); else saveDd(list2);
      afterSave();
    };
    inp.addEventListener('change', h);
  });
  $qa('[data-cdel]', box).forEach(function (b) {
    b.onclick = function () {
      var k = b.getAttribute('data-ck');
      var list2 = JSON.parse(JSON.stringify(k === 'dl' ? FIX.lyDeadlines : DDAY_FIX));
      list2.splice(+b.getAttribute('data-cdel'), 1);
      if (k === 'dl') saveDl(list2); else saveDd(list2);
      if (k === 'dl') renderAll(); else renderDDay();
      if (k === 'dl') renderCmDl(); else renderCmDd();
    };
  });
}
function initContent() {
  if ($id('annSaveBtn')) $id('annSaveBtn').onclick = function () {
    LS.set('announcement', ($id('annText') || {}).value || '');
    renderAnnouncement(); toast('公告已儲存 ✓');
  };
  if ($id('annClearBtn')) $id('annClearBtn').onclick = function () {
    LS.set('announcement', '');
    if ($id('annText')) $id('annText').value = '';
    renderAnnouncement(); toast('公告已清除');
  };
  if ($id('annText')) { var av = LS.get('announcement', ''); $id('annText').value = av; }
  if ($id('cmDlAddBtn')) $id('cmDlAddBtn').onclick = function () {
    var t = $id('cmDlTitle').value.trim(), d = $id('cmDlDate').value;
    if (!t || !d) { toast('請填寫標題和日期'); return; }
    var list2 = JSON.parse(JSON.stringify(FIX.lyDeadlines));
    list2.push({ t: t, d: d });
    saveDl(list2);
    $id('cmDlTitle').value = ''; $id('cmDlDate').value = '';
    renderAll(); renderCmDl(); toast('已新增日程 ✓');
  };
  if ($id('cmDdAddBtn')) $id('cmDdAddBtn').onclick = function () {
    var ic = ($id('cmDdIcon').value.trim() || '🎯'), t = $id('cmDdTitle').value.trim(), d = $id('cmDdDate').value;
    if (!t || !d) { toast('請填寫標題和日期'); return; }
    var list2 = JSON.parse(JSON.stringify(DDAY_FIX));
    list2.push({ icon: ic, t: t, d: d });
    saveDd(list2);
    $id('cmDdIcon').value = ''; $id('cmDdTitle').value = ''; $id('cmDdDate').value = '';
    renderDDay(); renderCmDd(); toast('已新增 D-Day 節點 ✓');
  };
  if ($id('cmResetFixBtn')) $id('cmResetFixBtn').onclick = function () {
    showConfirm('確定還原「出廠日程 + D-Day 節點」嗎？\n（你的其他資料：待辦、履歷、科目等全部保留）').then(function (ok) {
      if (!ok) return;
      LS.del('fix_dl'); LS.del('fix_dday');
      FIX.lyDeadlines = JSON.parse(JSON.stringify(FIX_DL_ORIG));
      DDAY_FIX = JSON.parse(JSON.stringify(DDAY_FIX_ORIG));
      renderAll(); renderCmDl(); renderCmDd(); toast('已還原預設內容 ✓');
    });
  };
}

/* ---- ☁️ GitHub Gist 跨裝置雲同步 ---- */
var GIST_FILE = 'lyhub-data.json';
function ghToken() { return LS.get('gh_token', ''); }
function gistId() { return LS.get('gist_id', ''); }
function syncPayload() {
  var data = {};
  LS.keys().forEach(function (k) {
    if (k === 'notif_sent' || k === 'gh_token' || k === 'gist_id') return;
    data[k] = LS.get(k, null);
  });
  data.__sync_time = new Date().toISOString();
  return data;
}
function applySyncData(data, silent) {
  if (!data || typeof data !== 'object') { toast('❌ 雲端資料格式錯誤'); return false; }
  delete data.__sync_time;
  var keys = Object.keys(data);
  keys.forEach(function (k) { LS.set(k, data[k]); });
  LS.set('__last_sync', new Date().toISOString());
  if (!silent) toast('✅ 已拉取 ' + keys.length + ' 項雲端資料，重新載入…');
  return true;
}
function ghFetch(method, path, body) {
  return fetch('https://api.github.com' + path, {
    method: method,
    headers: {
      'Authorization': 'token ' + ghToken(),
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  }).then(function (r) {
    if (r.status === 401 || r.status === 403) throw new Error('Token 無效或已過期（' + r.status + '）');
    if (!r.ok) throw new Error('GitHub API ' + r.status);
    return r.json();
  });
}
function gistBody() {
  return { description: 'Lok Yi Hub · 雲端資料備份（私密）', public: false,
    files: {} };
}
function renderSyncStatus(msg) {
  var el = $id('syncStatus');
  if (!el) return;
  if (msg) { el.textContent = msg; return; }
  var parts = [];
  parts.push(ghToken() ? '🔑 Token：已設定' : '🔑 Token：未設定');
  parts.push(gistId() ? '☁️ Gist：' + gistId() : '☁️ Gist：未建立');
  var last = LS.get('__last_sync', '');
  parts.push('🕒 最後同步：' + (last ? last.replace('T', ' ').slice(0, 16) : '從未'));
  el.textContent = parts.join('  ·  ');
}
function initSync() {
  if ($id('ghToken')) $id('ghToken').value = ghToken() ? '·已設定（重新輸入可覆蓋）' : '';
  if ($id('gistIdInput')) $id('gistIdInput').value = gistId();
  if ($id('autoPullChk')) {
    $id('autoPullChk').checked = !!LS.get('auto_pull', false);
    $id('autoPullChk').onchange = function () {
      LS.set('auto_pull', $id('autoPullChk').checked);
      toast($id('autoPullChk').checked ? '已開啟自動同步' : '已關閉自動同步');
    };
  }
  if ($id('ghTokenSaveBtn')) $id('ghTokenSaveBtn').onclick = function () {
    var v = ($id('ghToken').value || '').trim();
    if (!v || v.indexOf('·已設定') === 0) { toast('Token 未變更'); return; }
    LS.set('gh_token', v);
    $id('ghToken').value = '·已設定（重新輸入可覆蓋）';
    renderSyncStatus(); toast('Token 已儲存 ✓');
  };
  if ($id('gistBindBtn')) $id('gistBindBtn').onclick = function () {
    var v = ($id('gistIdInput').value || '').trim();
    if (!v) { toast('請輸入 Gist ID'); return; }
    LS.set('gist_id', v);
    renderSyncStatus(); toast('已綁定 Gist ✓（可立即拉取）');
  };
  if ($id('gistCreateBtn')) $id('gistCreateBtn').onclick = function () {
    if (!ghToken()) { toast('請先儲存 GitHub Token'); return; }
    renderSyncStatus('⏳ 正在建立雲端備份…');
    var body = gistBody();
    body.files[GIST_FILE] = { content: JSON.stringify(syncPayload()) };
    ghFetch('POST', '/gists', body).then(function (g) {
      LS.set('gist_id', g.id);
      LS.set('__last_sync', new Date().toISOString());
      if ($id('gistIdInput')) $id('gistIdInput').value = g.id;
      renderSyncStatus();
      toast('🆕 雲端備份已建立，Gist ID：' + g.id);
    }).catch(function (e) { renderSyncStatus(); toast('❌ ' + e.message); });
  };
  if ($id('gistPushBtn')) $id('gistPushBtn').onclick = function () {
    if (!ghToken()) { toast('請先儲存 GitHub Token'); return; }
    if (!gistId()) { toast('尚未建立雲端備份，請先點「建立雲端備份」'); return; }
    renderSyncStatus('⏳ 正在推送…');
    var body = gistBody();
    body.files[GIST_FILE] = { content: JSON.stringify(syncPayload()) };
    ghFetch('PATCH', '/gists/' + gistId(), body).then(function () {
      LS.set('__last_sync', new Date().toISOString());
      renderSyncStatus(); toast('⬆️ 已推送至雲端 ✓');
    }).catch(function (e) { renderSyncStatus(); toast('❌ ' + e.message); });
  };
  if ($id('gistPullBtn')) $id('gistPullBtn').onclick = function () {
    if (!ghToken()) { toast('請先儲存 GitHub Token'); return; }
    if (!gistId()) { toast('請先綁定 Gist ID'); return; }
    renderSyncStatus('⏳ 正在拉取…');
    ghFetch('GET', '/gists/' + gistId()).then(function (g) {
      var f = g.files && g.files[GIST_FILE];
      if (!f) { renderSyncStatus(); toast('❌ 此 Gist 沒有 ' + GIST_FILE); return; }
      var data = null;
      try { data = JSON.parse(f.content); } catch (e) {}
      if (!data) { renderSyncStatus(); toast('❌ 雲端資料解析失敗'); return; }
      showConfirm('拉取會覆蓋本機全部資料（以雲端為準）。\n確定繼續嗎？').then(function (ok) {
        if (!ok) { renderSyncStatus(); return; }
        if (applySyncData(data)) setTimeout(function () { location.reload(); }, 800);
      });
    }).catch(function (e) { renderSyncStatus(); toast('❌ ' + e.message); });
  };
  renderSyncStatus();
  /* 自動同步：啟動時靜默檢查（僅當開啟了 auto_pull） */
  if (LS.get('auto_pull', false) && ghToken() && gistId()) {
    ghFetch('GET', '/gists/' + gistId()).then(function (g) {
      var f = g.files && g.files[GIST_FILE];
      if (!f) return;
      var remote = null;
      try { remote = JSON.parse(f.content); } catch (e) { return; }
      var rt = remote && remote.__sync_time ? Date.parse(remote.__sync_time) : 0;
      var lt = LS.get('__last_sync', '') ? Date.parse(LS.get('__last_sync', '')) : 0;
      if (rt > lt) {
        if (applySyncData(remote, true)) { toast('☁️ 已自動同步雲端最新資料'); setTimeout(function () { location.reload(); }, 600); }
      }
    }).catch(function () {});
  }
}

/* ---- 8. 安裝教學 Modal ---- */
function initHelp() {
  var b = $id('helpBtn'), m = $id('helpModal');
  if (!b || !m) return;
  b.onclick = function () { m.hidden = false; };
  var c = $id('helpCloseBtn');
  if (c) c.onclick = function () { m.hidden = true; };
  m.addEventListener('click', function (e) { if (e.target === m) m.hidden = true; });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !m.hidden) m.hidden = true; });
}

/* ============================================================
   匯出 / 重設 / PWA 安裝
   ============================================================ */
function initGlobal() {
  if ($id('exportAllBtn')) $id('exportAllBtn').onclick = function () {
    var data = {};
    LS.keys().forEach(function (k) {
      if (k === 'notif_sent') return;
      data[k] = LS.get(k, null);
    });
    data.__export_time = new Date().toISOString();
    downloadText('LokYiHub_backup_' + todayStr() + '.json', JSON.stringify(data, null, 2), 'application/json');
    toast('已匯出全部資料（JSON）✓');
  };
  if ($id('resetDataBtn')) $id('resetDataBtn').onclick = function () {
    showConfirm('確定要清除「' + (ACCT === 'ly' ? 'Lok Yi' : 'Austin') + '」帳號在本機的所有資料嗎？\n（另一帳號不受影響；建議先匯出備份）').then(function (ok) {
      if (!ok) return;
      LS.keys().forEach(function (k) {
        if (ACCT === 'ly' && k.indexOf('bf_') !== 0) LS.del(k);
        if (ACCT === 'bf' && (k.indexOf('bf_') === 0 || k === 'acct')) LS.del(k);
      });
      if (ACCT === 'bf') LS.set('acct', 'ly');
      toast('已重設，重新載入…');
      setTimeout(function () { location.reload(); }, 800);
    });
  };
  $id('confirmOkBtn').onclick = function () { _confirmDone(true); };
  $id('confirmCancelBtn').onclick = function () { _confirmDone(false); };

  var deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    if ($id('installBtn')) $id('installBtn').hidden = false;
  });
  if ($id('installBtn')) $id('installBtn').onclick = function () {
    if (!deferredPrompt) { toast('請用瀏覽器選單 →「加入主畫面 / 安裝應用程式」'); return; }
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function () { deferredPrompt = null; $id('installBtn').hidden = true; });
  };
  window.addEventListener('appinstalled', function () { toast('🎉 已安裝！可從主畫面直接開啟'); });

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
}

/* ============================================================
   總渲染 & 初始化
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
}

document.addEventListener('DOMContentLoaded', function () {
  /* 🆕 v2.2：先套用內容管理覆蓋（在所有 render 之前） */
  loadFixOverrides();

  /* 側欄遮罩（手機） */
  var mask = document.createElement('div');
  mask.id = 'sidebarMask'; mask.className = 'sidebar-mask';
  mask.onclick = closeSidebar;
  document.body.appendChild(mask);

  if ($id('menuBtn')) $id('menuBtn').onclick = openSidebar;

  $qa('.nav-item').forEach(function (n) {
    n.addEventListener('click', function (e) {
      e.preventDefault();
      goPage(n.getAttribute('data-target'));
    });
  });
  $qa('.acct-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      if (b.getAttribute('data-acct') !== ACCT) switchAcct(b.getAttribute('data-acct'));
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

  /* 初始帳號顯示 */
  $qa('.acct-btn').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-acct') === ACCT); });
  $qa('[data-account]').forEach(function (el) {
    el.style.display = (el.getAttribute('data-account') === ACCT) ? '' : 'none';
  });
  renderSidebarIdentity();
  renderAll();
  renderCalDay(todayStr()); /* 🆕 v2.1：月曆預設顯示今天事項 */
  goPage(ACCT === 'ly' ? 'dashboard' : 'bf_dash', { keepSidebar: true });

  tickClock(); setInterval(tickClock, 1000);
  setInterval(renderNotifs, 60000);
  setInterval(maybeBrowserNotify, 300000);
  setTimeout(maybeBrowserNotify, 4000);
  /* 每分鐘刷新倒數 */
  setInterval(function () {
    if ($id('ctDays')) { var n = daysUntil('2026-08-31'); $id('ctDays').textContent = n < 0 ? '已過期' : '⚠️ 剩 ' + n + ' 天'; }
    if ($id('exDays')) { var m = daysUntil('2026-09-03'); $id('exDays').textContent = m < 0 ? '已截止' : '⚠️ 剩 ' + m + ' 天'; }
  }, 60000);
});

window.addEventListener('error', function (e) {
  console.warn('[LokYiHub]', e.message);
});
})();
