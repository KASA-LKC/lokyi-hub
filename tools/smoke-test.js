/* 冒煙測試：用 jsdom 載入 index.html，執行 script.js，捕獲執行時錯誤 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const dir = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(dir, 'script.js'), 'utf8');

const errors = [];
const warns = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + (e.message || e)));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));
vc.on('warn', (...a) => warns.push('console.warn: ' + a.join(' ')));

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'http://localhost/',
  virtualConsole: vc,
  resources: undefined,
  beforeParse(window) {
    // Canvas / 網絡相關 stub
    window.fetch = () => Promise.reject(new Error('offline-stub'));
    window.scrollTo = () => {};
    window.scroll = () => {};
    window.Element.prototype.scrollIntoView = window.Element.prototype.scrollIntoView || (() => {});
    window.matchMedia = window.matchMedia || (q => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
    window.Notification = { permission: 'default', requestPermission: () => Promise.resolve('default') };
    if (!window.HTMLCanvasElement.prototype.getContext) {
      window.HTMLCanvasElement.prototype.getContext = () => null;
    }
  }
});

const w = dom.window;
// 注入 script.js（繞過外部 script 載入）
try {
  const s = w.document.createElement('script');
  s.textContent = js;
  w.document.body.appendChild(s);
} catch (e) {
  errors.push('inject: ' + e.message);
}

// 觸發 DOMContentLoaded 已在 jsdom 內自動完成；這裡等待微任務
setTimeout(() => {
  const d = w.document;
  const checks = [];
  function chk(name, cond, extra) { checks.push({ name, ok: !!cond, extra: extra || '' }); }

  chk('無執行時錯誤', errors.length === 0, errors.join(' | '));
  chk('版本標籤 v2.3.13', (d.getElementById('verTag') || {}).textContent === 'v2.3.13', (d.getElementById('verTag') || {}).textContent);
  chk('page-info 存在', !!d.getElementById('page-info'));
  chk('page-canvas 存在', !!d.getElementById('page-canvas'));
  chk('page-bf_info 存在', !!d.getElementById('page-bf_info'));
  chk('canvasToken input 存在', !!d.getElementById('canvasToken'));
  chk('saveCanvasBtn 已綁定 onclick', !!(d.getElementById('saveCanvasBtn') || {}).onclick);
  chk('syncCanvasBtn 已綁定 onclick', !!(d.getElementById('syncCanvasBtn') || {}).onclick);
  chk('clearCanvasBtn 已綁定 onclick', !!(d.getElementById('clearCanvasBtn') || {}).onclick);
  chk('canvasPaste textarea 存在', !!d.getElementById('canvasPaste'));
  chk('canvasParseBtn 已綁定 onclick', !!(d.getElementById('canvasParseBtn') || {}).onclick);
  chk('canvasManualClearBtn 已綁定 onclick', !!(d.getElementById('canvasManualClearBtn') || {}).onclick);
  chk('saveAdvisorBtn 已綁定 onclick', !!(d.getElementById('saveAdvisorBtn') || {}).onclick);
  chk('lgSave 已綁定 onclick', !!(d.getElementById('lgSave') || {}).onclick);
  chk('lgTogglePwd 已綁定 onclick', !!(d.getElementById('lgTogglePwd') || {}).onclick);

  // 所有 target=_blank 必須有 rel=noopener
  const blanks = [...d.querySelectorAll('a[target="_blank"]')];
  const bad = blanks.filter(a => !(a.getAttribute('rel') || '').includes('noopener'));
  chk('全部 target=_blank 含 rel=noopener (' + blanks.length + ' 個)', bad.length === 0, bad.map(a => a.getAttribute('href')).join(', '));

  // Canvas 渲染（未連接狀態）
  chk('canvasCourses 有初始內容', (d.getElementById('canvasCourses') || { innerHTML: '' }).innerHTML.length > 0);

  // 導航數目
  chk('導航項 33 個', d.querySelectorAll('.nav-item').length === 33, String(d.querySelectorAll('.nav-item').length));
  chk('page-outlook 存在', !!d.getElementById('page-outlook'));
  chk('outlookConnectBtn 已綁定 onclick', !!(d.getElementById('outlookConnectBtn') && d.getElementById('outlookConnectBtn').onclick));
  chk('outlookSyncCalBtn 已綁定 onclick', !!(d.getElementById('outlookSyncCalBtn') && d.getElementById('outlookSyncCalBtn').onclick));
  chk('outlookSyncMailBtn 已綁定 onclick', !!(d.getElementById('outlookSyncMailBtn') && d.getElementById('outlookSyncMailBtn').onclick));
  chk('icsFile input 存在', !!d.getElementById('icsFile'));
  chk('mailPaste textarea 存在', !!d.getElementById('mailPaste'));
  chk('icsImportBtn 已綁定 onclick', !!(d.getElementById('icsImportBtn') && d.getElementById('icsImportBtn').onclick));
  chk('mailParseBtn 已綁定 onclick', !!(d.getElementById('mailParseBtn') && d.getElementById('mailParseBtn').onclick));

  // 🆕 v2.3.12 記事本功能斷言
  (function () {
    var nt = d.getElementById('notesTitleLy'), nb = d.getElementById('notesBodyLy'), nn = d.getElementById('notesNewLy');
    chk('記事本 LY 元素齊全', !!(nt && nb && nn));
    if (nn) {
      nn.click();
      nt.value = '測試筆記'; if (nt.oninput) nt.oninput();
      nb.value = 'hello body'; if (nb.oninput) nb.oninput();
      var saved = (function () { try { return JSON.parse(d.defaultView.localStorage.getItem('lyhub_notes') || '[]'); } catch (e) { return []; } })();
      chk('記事本 LY 新增後寫入 localStorage', saved.length === 1 && saved[0].title === '測試筆記', 'len=' + saved.length);
      chk('記事本 LY 列表渲染 1 則', d.querySelectorAll('#notesListLy .notes-item').length === 1, String(d.querySelectorAll('#notesListLy .notes-item').length));
  // 🆕 v2.3.13 材料預覽 Modal 斷言
  chk('材料預覽 Modal 存在', !!d.getElementById('matPreviewModal'));
  chk('材料預覽下載/開啟按鈕存在', !!(d.getElementById('matPreviewDownload') && d.getElementById('matPreviewOpen')));
    }
  })();

  let fail = 0;
  checks.forEach(c => {
    if (!c.ok) fail++;
    console.log((c.ok ? '  PASS  ' : '  FAIL  ') + c.name + (c.extra && !c.ok ? '  ->  ' + c.extra : ''));
  });
  console.log('\n結果：' + (checks.length - fail) + '/' + checks.length + ' 通過');
  if (warns.length) console.log('\n警告（' + warns.length + '）：\n' + warns.slice(0, 8).join('\n'));
  process.exit(fail ? 1 : 0);
}, 800);
