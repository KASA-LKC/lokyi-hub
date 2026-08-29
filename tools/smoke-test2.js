/* 冒煙測試 2：帳號獨立性 + Canvas 同步（mock fetch） */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const dir = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(dir, 'script.js'), 'utf8');

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + (e.message || e)));

/* mock Canvas API 回應 */
const MOCK_COURSES = [{ id: 111, name: 'HTM2019 Data Analysis', course_code: 'HTM2019' }];
const MOCK_ASSIGN = [{
  id: 9001,
  name: 'Assignment 1',
  due_at: new Date(Date.now() + 3 * 86400000).toISOString()
}];

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'http://localhost/',
  virtualConsole: vc,
  beforeParse(window) {
    window.scrollTo = () => {}; window.scroll = () => {};
    window.Element.prototype.scrollIntoView = window.Element.prototype.scrollIntoView || (() => {});
    window.matchMedia = window.matchMedia || (q => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
    window.Notification = { permission: 'default', requestPermission: () => Promise.resolve('default') };
    window.fetch = (url) => {
      if (typeof url === 'string' && url.indexOf('/courses?') >= 0) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(MOCK_COURSES) });
      if (typeof url === 'string' && url.indexOf('/assignments') >= 0) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(MOCK_ASSIGN) });
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve([]) });
    };
  }
});
const w = dom.window;
const s = w.document.createElement('script');
s.textContent = js;
w.document.body.appendChild(s);

setTimeout(() => {
  const d = w.document;
  const checks = [];
  const chk = (n, c, e) => checks.push({ name: n, ok: !!c, extra: e || '' });

  /* A. 導航到 canvas 頁（經點擊導航項，模擬真實操作） */
  var canvasNav = [].slice.call(d.querySelectorAll('.nav-item')).filter(function (n) { return n.getAttribute('data-target') === 'canvas'; })[0];
  canvasNav.click();
  chk('點擊導航後 page-canvas 顯示', d.getElementById('page-canvas').style.display !== 'none');

  /* B. 儲存 token 並同步 */
  d.getElementById('canvasToken').value = 'TEST_TOKEN_123';
  d.getElementById('saveCanvasBtn').click();

  setTimeout(() => {
    var storedTok = '';
    try { storedTok = JSON.parse(w.localStorage.getItem('lyhub_canvasToken')); } catch (e) { storedTok = w.localStorage.getItem('lyhub_canvasToken'); }
    chk('Canvas token 已寫入 localStorage', storedTok === 'TEST_TOKEN_123', String(w.localStorage.getItem('lyhub_canvasToken')));
    var st = (d.getElementById('canvasStatus') || {}).textContent || '';
    chk('同步成功（1 課程 / 1 作業）', /1\s*個課程/.test(st) && /1\s*項作業/.test(st), st.slice(0, 90));
    var asgHtml = (d.getElementById('canvasAssignments') || {}).innerHTML || '';
    chk('作業已渲染（Assignment 1）', asgHtml.indexOf('Assignment 1') >= 0);
    var cHtml = (d.getElementById('canvasCourses') || {}).innerHTML || '';
    chk('課程已渲染（HTM2019）', cHtml.indexOf('HTM2019') >= 0);

    /* C. 雙帳號獨立性：LY key 不得污染 BF scope */
    var keys = Object.keys(w.localStorage);
    var lyKeys = keys.filter(k => k.indexOf('lyhub_') === 0);
    chk('Canvas 相關 key 屬 LY scope（無 bf_ 污染）', lyKeys.indexOf('lyhub_canvasToken') >= 0 && keys.indexOf('lyhub_bf_canvasToken') < 0, keys.filter(k => /canvas/i.test(k)).join(','));

    /* D. 切換去 BF 帳號，Canvas 頁唔應該顯示 */
    var bfBtn = [].slice.call(d.querySelectorAll('.acct-btn')).filter(function (b) { return b.getAttribute('data-acct') === 'bf'; })[0];
    chk('BF 帳號切換按鈕存在', !!bfBtn);
    bfBtn && bfBtn.click();
    setTimeout(() => {
      chk('切換 BF 後 page-canvas 隱藏', d.getElementById('page-canvas').style.display === 'none');
      chk('切換 BF 後可導航去 page-bf_info', (function () {
        var nav = [].slice.call(d.querySelectorAll('.nav-item')).filter(function (n) { return n.getAttribute('data-target') === 'bf_info'; })[0];
        if (!nav) return false;
        nav.click();
        return d.getElementById('page-bf_info').style.display !== 'none';
      })());
      chk('無執行時錯誤', errors.length === 0, errors.join(' | '));

      var fail = 0;
      checks.forEach(c => { if (!c.ok) fail++; console.log((c.ok ? '  PASS  ' : '  FAIL  ') + c.name + (c.extra && !c.ok ? '  ->  ' + c.extra : '')); });
      console.log('\n結果：' + (checks.length - fail) + '/' + checks.length + ' 通過');
      process.exit(fail ? 1 : 0);
    }, 400);
  }, 600);
}, 800);
