# Lok Yi Hub — Canvas & Outlook 連接完整教程（自動 + 手動）

> 版本：v2.3.11（本地 commit `611090b`，尚未 push；remote 暫為 v2.3.9 `d752117`）
> 適用：開 dashboard 後，左側 menu 有「🎨 Canvas 連接」同「📧 Outlook 連接」兩頁。
> 開 dashboard 方法：瀏覽器開 `http://localhost:8899/`（若未開，喺 lokyi-hub 資料夾跑 `python3 -m http.server 8899`）。

---

## 先講重點（非常重要）

你而家想要 **Canvas + Outlook 都自動連接**。但實測證實：

- **Canvas 自動**：學校禁咗學生自己開 API Token（`+ New Access Token` 變灰，寫住「administrators have chosen to limit your ability to generate your own access token」）。
- **Outlook 自動**：學生 account 入唔到 Entra admin center，即係註冊唔到 App，亦攞唔到 admin consent 讀你嘅郵件 / 行事曆。

**結論**：兩個自動連接都要 **PolyU ITS 批准**先啱。下面的 PART A / PART B 就係「點寫信問 ITS 批」+「批咗之後點連」。手動匯入（PART C）係後備，唔使批都用得。

| 功能 | 自動方式 | 需要學校批准？ | 目前最實際做法 |
|---|---|---|---|
| **Canvas（自動）** | 個人 API Token | ✅ 要（ITS 代開 / 批權） | 問 ITS → 批咗貼 token |
| **Canvas（手動）** | 貼 Assignments 文字 | ❌ 唔使 | 後備，隨時用 |
| **Outlook（自動）** | Entra App + admin consent | ✅ 要 | 問 ITS → 批咗貼 client/tenant id |
| **Outlook（手動）** | .ics + 郵件貼上 | ❌ 唔使 | 後備，隨時用 |

---

# PART A ｜ Canvas 自動連接（問 ITS 批 → 啟用）

## A1 — 發申請信畀 PolyU ITS

> 你之前已經 send 過一封去 IT Online ServiceDesk。如果仲未收到回覆，可以照下面呢封再 send 一次（直接 copy 貼落 email / ServiceDesk form 都得）。

**收件人（揀一個）：**
- IT Online ServiceDesk 網頁 form：https://www.polyu.edu.hk/its/ （搵「ServiceDesk / Report a problem」）
- 或者直接 email（試多個 CC 保險）：`servicedesk@polyu.edu.hk` / `helpdesk@polyu.edu.hk` / `it.service@polyu.edu.hk`
- ⚠️ 唔好用 `itsupport@polyu.edu.hk`（之前試過 bounce，地址唔存在）

**Subject：**
`Request for Canvas Personal Access Token for Student Personal Dashboard (SID: 26017276D)`

**Email 內容（copy 貼）：**
```
Dear PolyU ITS / Canvas Administrator,

I am writing to request assistance with generating a Canvas API access token for my personal academic dashboard.

When I navigate to Canvas → Account → Settings → Approved Integrations and click "+ New Access Token", I receive:
"Your Canvas administrators have chosen to limit your ability to generate your own access token. Please reach out to your Canvas administrators to have them generate an access token on your behalf."

I am a student (Student ID: 26017276D) and would like to use the token to access ONLY my own Canvas data (enrolled courses, assignments, due dates) through a personal dashboard I am building. The token will be stored locally on my device and will NOT be shared with any third-party service.

Could you please either:
1. Generate a personal access token on my behalf, or
2. Advise on the official process for students to obtain API access for personal academic tools?

Thank you for your time and assistance.

Best regards,
Lok Yi Chan
Student ID: 26017276D
Email: 26017276d@connect.polyu.edu.hk
```

## A2 — 批咗之後：攞 Token + 喺 dashboard 連接

1. ITS 回覆通常會畀你一條 token 字串（例如 `12345~abcdef...`），或叫你去某個地方攞。**即刻複製**。
2. 開 dashboard（`http://localhost:8899/`），左側 menu 撳 **「🎨 Canvas 連接」**。
3. 第一格 input（placeholder 寫「Canvas API Token…」）貼上 token。
4. 撳 **「💾 儲存 & 連接」**（淨填唔撳唔算）。
5. 系統自動同步，頂部「狀態」變做「已儲存 Token…」。

## A3 — 確認連到
- 撳 **「🔄 立即同步」** 再確認一次。
- 下面兩張卡出內容即成功：
  - **📚 我嘅 Canvas 課程** → 📘 課程名（例如 HTM 3025…）
  - **⏰ 即將到期作業 / 考試** → 📝 作業名 + 截止日期
- Token 只存你部機 browser（localStorage `lyhub_canvasToken`），唔上傳。
- 想斷開：撳 **「🗑 清除 Token」**。

---

# PART B ｜ Outlook 自動連接（問 ITS 批 → 啟用）

## B1 — 發申請信畀 PolyU ITS

> Outlook 自動需要喺 Entra ID 註冊一個 App 並獲 admin consent。學生冇權，所以要 ITS 幫手。Copy 下面呢封 send 去同一個 IT Online ServiceDesk / email。

**Subject：**
`Request for Microsoft Entra App Registration & Admin Consent for Student Personal Dashboard (Outlook Calendar/Email) — SID: 26017276D`

**Email 內容（copy 貼）：**
```
Dear PolyU ITS / Microsoft 365 Administrator,

I am a student (Student ID: 26017276D) building a personal academic dashboard to manage my class schedule and deadlines. I would like it to read my own PolyU Outlook calendar and emails via the Microsoft Graph API, using browser-based OAuth (MSAL).

To do this, I need one of the following:
1. Permission to register an application in Microsoft Entra ID (Single-tenant, PolyU only), OR
2. An administrator to register the app and grant admin consent for these delegated permissions (which only access my own mailbox/calendar):
   - Calendars.Read
   - Mail.Read

The app uses the Authorization Code flow with PKCE (SPA redirect), stores all tokens locally in the user's browser, and sends no data to any third-party server. It will only ever read my own data.

Could you please advise whether this is possible, or if PolyU has an official process for student app registration / admin consent? If you register the app on my behalf, please share the Application (client) ID and Directory (tenant) ID so I can complete the connection in my dashboard.

Thank you for your time and assistance.

Best regards,
Lok Yi Chan
Student ID: 26017276D
Email: 26017276d@connect.polyu.edu.hk
```

## B2 — 批咗之後：註冊 App / 攞 ID + 喺 dashboard 連接

**情況一：ITS 幫你註冊好 App，直接畀你 client ID + tenant ID**
1. 開 dashboard，左側 menu 撳 **「📧 Outlook 連接」**。
2. 第一格 input（placeholder 寫「Entra ID 應用程式 (client) ID」）貼 **client ID**。
3. 第二格 input（placeholder 寫「Tenant ID（留空用 common）」）貼 **tenant ID**（**唔可以留空**，因為係 PolyU 單一租戶 App）。
4. 確保 **「自動加入待辦」** 同 **「到期前通知」** 方格剔咗。
5. 撳 **「🔗 連接 Outlook」** → 彈 Microsoft 登入窗 → 用學校 account 授權。
6. 見「✅ 已連接」即成功。

**情況二：ITS 開咗權限，你自已註冊 App**
1. 瀏覽器開 https://entra.microsoft.com ，用學校 account 登入。
2. 左手邊 **Identity → Applications → App registrations** → **＋ New registration**。
3. Name 填 `Lok Yi Hub`；Account types 揀 **Accounts in this organizational directory only (PolyU only)**。
4. Redirect URI：Platform 揀 **Single-page application (SPA)**，value 填你開 dashboard 個網址（例如 `http://localhost:8899/`）。撳 Add URI 再加 `http://localhost:8899/index.html`。
5. 撳 **Register** → 抄低 **Application (client) ID** 同 **Directory (tenant) ID**。
6. 個 App 頁 → **API permissions** → **＋ Add a permission** → Microsoft Graph → Delegated：加 `Calendars.Read` 同 `Mail.Read` → 撳 **Grant admin consent for PolyU**（呢下通常要 admin 權，所以先要 ITS 批）。
7. 返 dashboard「📧 Outlook 連接」，照情況一步驟 2–6 貼 ID 連接。

## B3 — 確認連到 + 同步
- 撳 **「📅 同步行事曆」**（未來 4 個月嘅改堂 / 考試 / 活動；考試測驗自動入 DDL）。
- 撳 **「✉️ 同步郵件資訊」**（掃 80 封，搵 assignment / test / exam / exchange / club / notes 入待辦）。
- 見到「✅ 已連接：…」同下面 list 有嘢即成功。

**出錯對號入座**
- 彈「Need admin approval / 需要管理員批准」→ admin consent 未批，搵 ITS。
- AADSTS50011 / redirect URI 唔匹配 → Entra 個 Redirect URI 要同你地址欄完全一樣。
- MSAL 載入失敗 → 檢查網絡、刷新再試。

---

# PART C ｜ 手動匯入（後備，學校未批時直接用，已做）

> 全部喺你部機 browser 處理，唔使經 PolyU admin，唔上傳任何 server。對應 dashboard v2.3.10（Outlook）+ v2.3.11（Canvas）。

## C1 — Canvas 手動匯入
1. 開 https://canvas.polyu.edu.hk → 入一科 → **Assignments**（或個人 Dashboard **To Do**）。
2. 全選作業清單（`Cmd+A`），最好連埋 **課程名 + 作業名 + Due 日期**（例：`HTM 3025 / Assignment 1: Research Proposal / Due Sep 10 at 11:59pm`），複製（`Cmd+C`）。
3. 返 dashboard「🎨 Canvas 連接」→ 落去 **「📥 手動匯入」** 卡，大格貼上（`Cmd+V`）。
4. 確保 **「自動加入待辦 / DDL」** 方格剔咗 → 撳 **「🔍 解析 Canvas 內容」**。
5. 見「✅ 解析到 N 項作業，已加入 M 項待辦」→ 上面「⏰ 即將到期作業 / 考試」出晒，相關自動入「待辦 / DDL」。
- 支援：`Sep 10` / `Sep 10, 2026` / `Sep 10 at 11:59pm` / `2026-09-10` / `10/09/2026`；課程碼 `HTM 3025` / `ENGL1A28` 等。無日期會跳過。新作業要重貼（自動去重）。

## C2 — Outlook 手動匯入（行事曆 .ics）
1. 匯出 `.ics`：Outlook 網頁版 → Calendar → 設定 → 檢視所有 Outlook 設定 → 行事曆 → 共用行事曆 → 發佈（權限揀「可檢視所有詳細資料」）→ 複製 ICS link → 新 tab 開佢 download。
   - 或 Apple Calendar app：對住你 PolyU 帳號下嘅 Calendar **right-click → 輸出…** → `Calendar.ics`。
   - 或 Outlook 桌面 app：Calendar → File → Export → Export to a File → iCalendar Format (.ics)。
2. 返 dashboard「📧 Outlook 連接」→「📥 手動匯入」卡 → 撳 file input 揀 `.ics` → 撳 **「📥 匯入行事曆 (.ics)」**。
3. 見「✅ 已匯入 N 項行事曆」→ 上面「📅 來自行事曆嘅事項」出晒；考試 / 測驗自動入 DDL。

## C3 — Outlook 手動匯入（郵件貼上）
1. Outlook 開一封重要 email（assignment deadline / 改堂通知）→ 全選（`Cmd+A`）→ 複製（`Cmd+C`）。
2. 返 dashboard「📧 Outlook 連接」→「📥 手動匯入」卡 → 大格貼上（`Cmd+V`）。幾封之間留空白行或一封一封貼。
3. 確保 **「自動加入待辦 / DDL」** 方格剔咗 → 撳 **「🔍 解析郵件內容」**。
4. 見「✅ 搵到 N 封重要郵件，已加入 M 項待辦」→ 右邊「✉️ 郵件中的重要資訊」出嚟，相關自動入「待辦 / DDL」。
- `.ics` 係快照，有新嘢要重 export 重匯入（自動去重）。想清走撳「🚪 斷開」。

---

# 做完之後

- **自動路徑**（批咗）：Canvas 連一次就搞掂，之後撳「🔄 立即同步」更新；Outlook 連一次後撳「📅 同步行事曆」/「✉️ 同步郵件資訊」更新。
- **手動路徑**（後備）：每次有新嘢要重複匯入。
- 兩樣資料都只存你部機 browser，唔上傳。
- 建議：兩封 ITS 申請信（PART A1 + PART B1）都 send 咗之後，等 1–3 個工作天睇回覆；期間用手動匯入（PART C）頂住。

> 呢份指南對應嘅 dashboard 改動（v2.3.10 `a4c2c57` + v2.3.11 `611090b`）仲未 push 上 GitHub，只喺你部機，remote 暫為 v2.3.9。想備份就再畀 PAT 或自己 `git push origin main`。
