# Lok Yi Hub — Canvas & Outlook 連接詳細步驟

> 版本：v2.3.10（本地 commit `a4c2c57`，尚未 push）
> 適用：開 dashboard 後，左側 menu 有「🎨 Canvas 連接」同「📧 Outlook 連接」兩頁。
> 開 dashboard 方法：瀏覽器開 `http://localhost:8899/`（若未開，喺 lokyi-hub 資料夾跑 `python3 -m http.server 8899`）。

---

## 先講重點

| 功能 | 連接方式 | 需要學校批准？ | 目前狀態 |
|---|---|---|---|
| **Canvas（自動）** | 個人 API Token（自己開） | ✅ 要（PolyU Canvas admin 禁咗學生自開） | ⛔ 卡住 |
| **Canvas（手動）** | 貼上 Canvas Assignments / To Do 文字 | ❌ 唔使 | ⛳ 後備方案（見 PART 3） |
| **Outlook（自動）** | Entra ID App + admin 同意 | ✅ 要 | ⛔ PolyU 學生通常冇權，卡住 |
| **Outlook（手動）** | 匯出 .ics + 貼郵件文字 | ❌ 唔使 | ✅ 可以直接用（後備方案） |

**結論**：Canvas 同 Outlook 都係學校鎖咗自動 API，兩個都做手動匯入。

---

# PART 1 ｜ Canvas 自動連接（目前 PolyU 已鎖）

> ⚠️ 2026-08-29 實測：PolyU Canvas 顯示「Your Canvas administrators have chosen to limit your ability to generate your own access token」，即係**學生冇權自己開 token**。現有 integration token 亦**冇顯示可複製嘅 token 字串**，所以 dashboard 用唔到。下面 Step 1–3 暫時做唔到，請直接睇 **PART 3 手動匯入**。

### Step 1 — 去 canvas.polyu.edu.hk 攞 Token（已被學校禁用）
1. 瀏覽器開 https://canvas.polyu.edu.hk ，用學校 account 登入。
2. 右上角撳**你個頭像**（個人相 /  initials）→ 點 **Settings**。
3. 落去 **Approved Integrations** 個區。
4. 若見到 `+ New Access Token` 掣變灰 / 撳唔到，即係學校禁咗。滑鼠移上去會顯示：「Your Canvas administrators have chosen to limit your ability to generate your own access token.」。
5. 若你見到現有 token，撳 **details** 檢查：若頁面**冇顯示**長串 token 字串，代表佢係 LTI 整合 token，dashboard 用唔到。

### Step 2 — 貼落 dashboard 並連接（自動路徑暫時不可行）
1. 返 dashboard，左側 menu 撳 **「🎨 Canvas 連接」**。
2. 第一格 input（placeholder 寫「Canvas API Token（喺 Canvas → Account → Settings → Approved Integrations 攞）」）貼上 Step 1 複製嘅 Token。
3. 撳 **「💾 儲存 & 連接」**（呢粒掣先會儲存，淨填唔撳唔算）。
4. 系統會自動同步，頂部「狀態」會變做「已儲存 Token…」。

### Step 3 — 確認連到
- 撳 **「🔄 立即同步」** 再確認一次。
- 下面兩張卡會出內容：
  - **📚 我嘅 Canvas 課程** → 出 📘 你嘅課程名（例如 HTM 3025…）
  - **⏰ 即將到期作業 / 考試** → 出 📝 作業名 + 截止日期
- 見到呢啲即係**成功**。

### Canvas 注意位
- Token 只存在你部機 browser（localStorage `lyhub_canvasToken`），唔會上傳任何 server。
- 兩粒方格預設剔咗：
  - **「到期前 2 日自動通知提醒」** → 要瀏覽器允許通知先收到彈窗
  - **「同步時自動加入待辦清單」** → 作業自動入「待辦 / DDL」page
- 想斷開：撳 **「🗑 清除 Token」**（會問一次確認）。
- 若學校禁咗開 token，請改用 **PART 3 手動匯入**。

---

# PART 3 ｜ Canvas 手動匯入（學校禁 Token 時用）

> Canvas 自動 token 被 PolyU 禁咗，就用呢個。全部喺你部機 browser 處理，唔上傳任何 server。對應 dashboard 版本 **v2.3.11**。

### Step 1 — 去 Canvas 複製作業文字
1. 開 https://canvas.polyu.edu.hk → 用學校 account 登入。
2. 入你其中一科 → 左側 **Assignments**，或者個人 Dashboard 嘅 **To Do** 區。
3. 用滑鼠**全選嗰科嘅作業清單**（`Cmd+A` / `Ctrl+A`），或者逐個 assignment 咁：
   - 最理想係連埋 **課程名 + 作業名 + Due 日期** 一齊複製
   - 例如：
     ```
     HTM 3025 Analysing and Interpreting Research
     Assignment 1: Research Proposal
     Due Sep 10 at 11:59pm
     ```
4. 複製（`Cmd+C`）。

### Step 2 — 貼落 dashboard 並解析
1. 返 dashboard，左側 menu 撳 **「🎨 Canvas 連接」**。
2. 落到新增嘅 **「📥 手動匯入」** 卡，喺大格（placeholder 寫「將 Canvas 作業內容貼埋呢度…」）貼上（`Cmd+V`）。
3. **確保「自動加入待辦 / DDL」方格剔咗**。
4. 撳 **「🔍 解析 Canvas 內容」**。
5. 見到「✅ 解析到 N 項作業，已加入 M 項待辦」→ 上面 **「⏰ 即將到期作業 / 考試」** 出晒，相關嘅自動入「待辦 / DDL」page。

### Canvas 手動匯入注意位
- **一次過貼幾科都得**：用**空白行**分隔每個作業。
- **日期格式支援**：`Sep 10`、`Sep 10, 2026`、`Sep 10 at 11:59pm`、`2026-09-10`、`10/09/2026` 都讀到；無年份會自動補（過咗今年嘅當明年）。
- **課程碼支援**：`HTM 3025`、`HTM3025`、`ENGL1A28`、`COMP1001` 等 PolyU 格式都認到。
- **無截止日期嘅會跳過**（唔入 DDL），例如純課程介紹。
- **想清走**：撳「🗑 清除手動匯入」（會問一次確認）。
- **新作業要重貼**：手動匯入唔會自動更新，收到新 assignment 就再貼一次（會自動去重）。

---

# PART 2 ｜ Outlook 連接

## 2A 自動路徑（先試，通常 PolyU 會擋）

> 只有當你成功喺 PolyU Entra ID 註冊到 App 並獲 admin 同意才用到。大部分學生 account 入到 entra.microsoft.com 會被禁。試完發現唔得，直接跳去 **2B**。

1. 瀏覽器開 https://entra.microsoft.com ，用學校 account 登入。
2. 左手邊 **Identity → Applications → App registrations** → **＋ New registration**。
3. Name 填 `Lok Yi Hub`；Account types 揀 **Accounts in this organizational directory only (PolyU only)**。
4. Redirect URI：Platform 揀 **Single-page application (SPA)**，value 填你開 dashboard 個網址（例如 `http://localhost:8899/`）。
5. 撳 **Register** → 抄低 **Application (client) ID** 同 **Directory (tenant) ID**。
6. 個 App 頁 → **API permissions** → **＋ Add a permission** → Microsoft Graph → Delegated：
   - 加 `Calendars.Read`（讀日程）
   - 加 `Mail.Read`（讀郵件）
7. 若列表寫「Admin consent required：Yes」→ 要 PolyU IT 撳 **Grant admin consent**，學生通常冇權。
8. 返 dashboard「📧 Outlook 連接」頁：
   - 第一格貼 **client ID**
   - 第二格貼 **tenant ID**（**唔可以留空**）
   - 撳 **「🔗 連接 Outlook」** → 彈 Microsoft 登入窗 → 用學校 account 授權
   - 撳 **「📅 同步行事曆」** / **「✉️ 同步郵件資訊」**

**出錯對號入座**
- 彈「Need admin approval / 需要管理員批准」→ 即係 step 7 未批，搵 PolyU ITS 或放棄改用 2B。
- AADSTS50011 / redirect URI 唔匹配 → Entra 個 Redirect URI 要同你地址欄完全一樣。
- 見唔到 App registrations / 被拒 → PolyU 禁學生自註 App，直接用 2B。

## 2B 手動匯入（實際用嘅，學校唔批時）

> 全部喺你部機 browser 處理，唔使經 PolyU admin，唔上傳任何 server。

### Step 1 — 從 Outlook 匯出 .ics 檔

**方法一：Outlook 網頁版（最推薦）**
1. 開 https://outlook.office.com → 左下角撳 **Calendar**（或九宮格 → Calendar）。
2. 右上角 **設定齒輪** → **檢視所有 Outlook 設定**。
3. 左手邊 **行事曆** → **共用行事曆**。
4. **發佈行事曆** 區：第一個 dropdown 揀你個主日曆；第二個 dropdown 權限揀 **可檢視所有詳細資料**。
5. 撳 **發佈** → 出兩條 link（ICS / HTML）→ 複製 **ICS** 嗰條。
6. 新 tab 開 ICS link → 自動 download 一個 `.ics` 檔（例如 `calendar.ics`）。記低喺邊。

**方法二：Apple Calendar app（你而家開緊呢個）**
1. 左邊 sidebar 搵你個 PolyU 帳號下嘅 **Calendar**。
2. 對住佢 **right-click** → **輸出… / Export…** → 存成 `Calendar.ics`。
3. 若日曆係空嘅，export 出嚟都係空檔，要用方法一。

**方法三：Outlook 桌面 app**
1. 開 Outlook → Calendar → **File → Export → Export to a File**。
2. 揀 **iCalendar Format (.ics)** → 揀日曆 → Next → 揀 save 位置 → Finish。

### Step 2 — 匯入 .ics 落 dashboard
1. 返 dashboard「📧 Outlook 連接」→ 落去第二張卡 **「📥 手動匯入（學校未批 Entra App 時用）」**。
2. 撳 file input（顯示「未選擇檔案」）→ 揀 Step 1 嘅 `.ics`。
3. 撳 **「📥 匯入行事曆 (.ics)」**。
4. 見到「✅ 已匯入 N 項行事曆」→ 上面 **「📅 來自行事曆嘅事項（未來 4 個月）」** list 出晒啲 event；**考試 / 測驗會自動入「待辦 / DDL」**。

### Step 3 — 郵件手動貼上
1. 喺 Outlook 開一封重要 email（assignment deadline / 改堂通知 等）。
2. 全選（`Cmd+A`）→ 複製（`Cmd+C`）。
3. 返 dashboard「📧 Outlook 連接」→「📥 手動匯入」卡。
4. 喺個大格（placeholder 寫「將 Outlook 重要郵件內容貼埋呢度…」）貼上（`Cmd+V`）。幾封就一封一封貼，或之間留空白行。
5. 確保 **「自動加入待辦 / DDL」** 方格剔咗。
6. 撳 **「🔍 解析郵件內容」**。
7. 見到「✅ 搵到 N 封重要郵件，已加入 M 項待辦」→ 右邊 **「✉️ 郵件中的重要資訊」** list 出嚟，相關嘅自動入「待辦 / DDL」。

### Outlook 手動匯入注意位
- **.ics 係某一刻快照**：有新改堂 / 新日程，要重新 export + 重複 Step 2（會自動去重，唔會重複 count）。
- **郵件**：每次收到新重要 mail 就再貼一次。
- 想清走：撳「🚪 斷開」或清 browser 網站資料。

---

# 做完之後

- Canvas 係自動，連一次就搞掂，之後撳「🔄 立即同步」更新。
- Outlook 係手動，每次有新嘢要重複匯入。
- 兩樣資料都只存你部機 browser，唔上傳。

> 呢份指南對應嘅 dashboard 改動（v2.3.10，commit `a4c2c57`）仲未 push 上 GitHub，只喺你部機。想備份就再畀 PAT 或自己 `git push origin main`。
