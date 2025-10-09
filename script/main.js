/* ==========================
   ====== 設定 & 資料 ======
   ========================== */
const EXCEL_URL = "./files/timeList.xlsx";
const SHEET_NAME = "timeList";

const TASK_TYPES = [
  { key: "gishiki", labelZh: "可疑的儀式", labelJp: "怪しい儀式", color: "#7a4171", offsetMin: 10 },
  { key: "mizuki", labelZh: "水月野王", labelJp: "水月FB", color: "#1e50a2", offsetMin: 5 },
  { key: "shirao", labelZh: "白青野王", labelJp: "白青FB", color: "#7b8d42", offsetMin: 5 },
];

const REPORTTASK_TYPES = [
  { key: "gishiki", labelZh: "可疑的儀式", labelJp: "怪しい儀式" },
  { key: "mizuki", labelZh: "水月野王", labelJp: "水月FB" },
  { key: "shirao", labelZh: "白青野王", labelJp: "白青FB" },
  { key: "other", labelZh: "其他", labelJp: "その他" },
];

const REPORT_TYPES = {
  default: [
    { value: "date_report", labelZh: "時間回報", labelJp: "時間報告" },
    { value: "other", labelZh: "其他", labelJp: "その他" },
  ],
  otherOnly: [
    { value: "other", labelZh: "其他", labelJp: "その他" },
  ]
};

const REPORT_STORAGE_KEY = "myReports";

/* ==========================
   ====== 語系判定 & 切換 ======
   ========================== */
let lang = "zh";

function detectLangByTimezone() {
  const timezoneOffset = -new Date().getTimezoneOffset() / 60;
  lang = timezoneOffset === 9 ? "jp" : "zh";
  document.getElementById("langBtn").textContent = lang === "zh" ? "日本鯖切替" : "切換到台服";
}

document.getElementById("langBtn").addEventListener("click", () => {
  lang = lang === "zh" ? "jp" : "zh";
  document.getElementById("langBtn").textContent = lang === "zh" ? "日本鯖切替" : "切換到台服";

  updateTopTime();
  loadTasksAndRender();
  updateLangText();
  updateReportTaskOptions();
  updateReportTypeOptions();
  updateReportCommentPlaceholder();
});

detectLangByTimezone();

/* ==========================
   ====== 時間處理函數 ======
   ========================== */
function getNowBySVR() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const offset = (lang === "zh" ? 8 : 9) * 60 * 60000;
  return new Date(utc + offset);
}

function formatDateLabel(d) {
  const yrs = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const wdZh = ["日","一","二","三","四","五","六"];
  const wdJp = ["日","月","火","水","木","金","土"];
  const w = lang === "zh" ? wdZh[d.getDay()] : wdJp[d.getDay()];
  return `${yrs}/${m}/${day}（${w}）`;
}

function updateTopTime() {
  const now = getNowBySVR();
  document.getElementById("dateLabel").textContent = formatDateLabel(now);

  const locale = lang === "zh" ? "zh-TW" : "ja-JP";
  const options = { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" };
  const timeStr = now.toLocaleTimeString(locale, options);

  document.getElementById("timeBox").innerHTML = `
    <span class="timeLabel">${lang === "zh" ? "台灣時間" : "日本時間"}</span>
    <span class="timeValue">${timeStr}</span>
  `;
}

setInterval(updateTopTime, 1000);
updateTopTime();

function timeStringToDateToday(timeStr) {
  const now = getNowBySVR();
  const [h, m] = (timeStr || "--:--").split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
}

function shouldShowRemaining() {
  const h = getNowBySVR().getHours();
  return !(h >= 21);
}


// 語言說明文字
function updateLangText() {
  // 取得或建立 langText 區塊
  let langText = document.querySelector(".langText");
  if (!langText) {
    langText = document.createElement("div");
    langText.className = "langText";
    document.body.appendChild(langText);
  }
  if (lang === "zh") {
    langText.innerHTML =
      "・時間為系統出字提示的時間。<br>" +
      "・儀式：出字提示後、等待10分鐘出怪。<br>" +
      "・野王：出字提示後、等待  5分鐘出王。";
  } else {
    langText.innerHTML =
      "・表の時間＝予兆が出る時間<br>" +
      "・怪しい儀式 ：予兆後、約10分でボス出現<br>" +
      "・水月/白青FB：予兆後、約 5分でボス出現";
  }
}





/* ==========================
   ====== Excel 讀取 ======
   ========================== */
async function loadExcel() {
  try {
    const res = await fetch(EXCEL_URL);
    const buf = await res.arrayBuffer();
    const workbook = XLSX.read(buf, { type: "array" });
    let sheet = workbook.Sheets[SHEET_NAME] || workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet);
  } catch (err) {
    console.error("Excel 讀取失敗：", err);
    return [];
  }
}

/* ==========================
   ====== 任務列表 ======
   ========================== */
async function loadTasksAndRender() {
  const rows = await loadExcel();
  renderAllGroups(rows);
}

function renderAllGroups(rows) {
  const container = document.getElementById("taskContainer");
  container.innerHTML = "";

  const now = getNowBySVR();
  const currentHour = now.getHours();
  const currentWeekZh = ["日","一","二","三","四","五","六"][now.getDay()];
  const currentWeekJp = ["日","月","火","水","木","金","土"][now.getDay()];

  TASK_TYPES.forEach(type => {
    const list = rows
      .filter(r => (r["Week-zh"] === currentWeekZh || r["Week-jp"] === currentWeekJp) && r[`${type.key}-time`])
      .map(r => ({ 
        time: r[`${type.key}-time`], 
        zh: r[`${type.key}-zh`] || "", 
        jp: r[`${type.key}-jp`] || "" 
      }))
      .sort((a,b) => {
        const ha = parseInt(a.time.split(":")[0]) * 60 + parseInt(a.time.split(":")[1]||0);
        const hb = parseInt(b.time.split(":")[0]) * 60 + parseInt(b.time.split(":")[1]||0);
        return ha - hb;
      });

    const currentItem = list.find(item => parseInt(item.time.split(":")[0]) === currentHour) || null;
    const nextItems = list.filter(item => {
      const h = parseInt(item.time.split(":")[0]);
      return h === currentHour + 1 || h === currentHour + 2;
    });
    const remainingItems = list.filter(item => parseInt(item.time.split(":")[0]) > currentHour + 2);

    const group = document.createElement("div");
    group.className = `group ${type.key}`;

    // --- 當前任務 ---
    const curRow = document.createElement("div");
    curRow.className = `taskRow ${type.key} current`;
    const curTimeText = currentItem?.time || "--:--";
    const curContent = currentItem ? (lang==="zh"?currentItem.zh:currentItem.jp) : "-------";
    curRow.innerHTML = `
      <div class="col-type">${lang === "zh" ? type.labelZh : type.labelJp}</div>
      <div class="col-time">${curTimeText}</div>
      <div class="col-content">${curContent}</div>
    `;

    if (currentItem) {
      const tDate = timeStringToDateToday(currentItem.time);
      if (tDate && getNowBySVR().getTime() > tDate.getTime() + type.offsetMin * 60000) {
        curRow.querySelectorAll(".col-time, .col-content").forEach(el => el.classList.add("gray"));
      }
    } else {
      curRow.querySelectorAll(".col-time, .col-content").forEach(el => el.classList.add("row-gray"));
    }

    group.appendChild(curRow);

    // --- 當前任務以外的任務整體 ---
    const wrapper = document.createElement("div");
    wrapper.className = "taskWrapper";

    // --- 接下來兩小時 ---
    if (nextItems.length > 0) {
      const nextRow = document.createElement("div");
      nextRow.className = "taskRow";
      nextRow.innerHTML = `
        <div class="placeholder"></div>
        <div class="col-time">${nextItems.map(n => n.time).join("<br>")}</div>
        <div class="col-content">${nextItems.map(n => (lang==="zh"?n.zh:n.jp)).join("<br>")}</div>
      `;
      nextRow.querySelectorAll(".col-time, .col-content").forEach(el => el.classList.add("row-gray"));
      wrapper.appendChild(nextRow);
    }

    // --- 剩餘任務 ---
    const remWrapper = document.createElement("div");
    remWrapper.className = "remainingContainer";
    remainingItems.forEach(r => {
      const row = document.createElement("div");
      row.className = "taskRow";
      row.innerHTML = `
        <div class="placeholder"></div>
        <div class="col-time">${r.time}</div>
        <div class="col-content">${lang === "zh" ? r.zh : r.jp}</div>
      `;
      row.querySelectorAll(".col-time, .col-content").forEach(el => el.classList.add("row-gray"));
      remWrapper.appendChild(row);
    });
    wrapper.appendChild(remWrapper);

    // --- 其他按鈕 ---
    const footer = document.createElement("div");
    footer.className = "groupFooter";
    const btn = document.createElement("button");
    btn.className = "showBtn";
    btn.textContent = lang === "zh" ? "其他時間 ▼" : "その他 ▼";

    footer.appendChild(btn);

    wrapper.appendChild(footer);

    group.appendChild(wrapper);

    // 21:00 之後隱藏按鈕
    const nowHour = getNowBySVR().getHours();
    if (nowHour >= 21) {
      btn.style.display = "none";
    }

// --- 按鈕點擊事件 ---
btn.addEventListener("click", () => {
  if (!shouldShowRemaining()) return; // 晚上21:00後不動作
  const isOpen = remWrapper.classList.contains("open");

  // 關閉其他展開的容器
  document.querySelectorAll(".remainingContainer.open").forEach(el =>
    el.classList.remove("open")
  );
  document.querySelectorAll(".groupFooter .showBtn").forEach(b =>
    b.textContent = lang === "zh" ? "其他時間 ▼" : "その他 ▼"
  );

  // 切換顯示狀態
  if (!isOpen && remainingItems.length > 0) {
    remWrapper.classList.add("open");
    btn.textContent = lang === "zh" ? "關閉 ▲" : "閉じる ▲";
  } else {
    remWrapper.classList.remove("open");
    btn.textContent = lang === "zh" ? "其他時間 ▼" : "その他 ▼";
  }
});

container.appendChild(group);
    
  });
}

// 每小時整點重新載入 Excel
function scheduleHourlyReload() {
  const now = getNowBySVR();
  const msToNextHour = (60 - now.getMinutes()) * 60000 - now.getSeconds() * 1000;
  setTimeout(() => {
    loadTasksAndRender();
    setInterval(loadTasksAndRender, 3600000);
  }, msToNextHour);
}

updateLangText();
loadTasksAndRender();
scheduleHourlyReload();

/* ==========================
   ====== 回報區域操作 ======
   ========================== */
const reportTaskTypeEl = document.getElementById("reportTaskType");
const reportTypeEl = document.getElementById("reportType");
const reportCommentEl = document.getElementById("reportComment");

const msgEl = document.getElementById("reportMessage");
const submitReportBtn = document.getElementById("submitReport");

const reportListEl = document.getElementById("reportList");
const clearReportsBtn = document.getElementById("clearReports");


function getTaskTypeLabelSingle(key) {
  const task = REPORTTASK_TYPES.find(t => t.key === key);
  return lang === "zh" ? task.labelZh : task.labelJp;
}

function getReportTypeLabelSingle(value, taskKey) {
  const types = ["gishiki","mizuki","shirao"].includes(taskKey)
    ? REPORT_TYPES.default
    : REPORT_TYPES.otherOnly;
  const type = types.find(t => t.value === value) || {labelZh:value,labelJp:value};
  return lang === "zh" ? type.labelZh : type.labelJp;
}

function updateReportTaskOptions() {
  reportTaskTypeEl.innerHTML = "";
  REPORTTASK_TYPES.forEach(task => {
    const opt = document.createElement("option");
    opt.value = task.key;
    opt.textContent = lang === "zh" ? task.labelZh : task.labelJp;
    reportTaskTypeEl.appendChild(opt);
  });
}

function updateReportTypeOptions() {
  const selectedTask = reportTaskTypeEl.value;
  const optionsToUse = ["gishiki","mizuki","shirao"].includes(selectedTask)
    ? REPORT_TYPES.default
    : REPORT_TYPES.otherOnly;
  reportTypeEl.innerHTML = "";
  optionsToUse.forEach(optData => {
    const opt = document.createElement("option");
    opt.value = optData.value;
    opt.textContent = lang === "zh" ? optData.labelZh : optData.labelJp;
    reportTypeEl.appendChild(opt);
  });
}

function updateReportCommentPlaceholder() {
  reportCommentEl.placeholder = lang === "zh" ? "10/08 19:26 地點 地點" : "10/08 19:26 場所 場所";
  submitReportBtn.textContent = lang === "zh" ? "送出" : "送信";
}

// 提醒顯示
function showMsg(text, color = "green", duration = 3000) {
  msgEl.textContent = text;
  msgEl.style.color = color;
  msgEl.style.fontSize = "0.8rem";
  setTimeout(() => { msgEl.textContent = ""; }, duration);
}

// ====== 建立單筆報告 DIV ======
function createReportDiv(report, isLatest = false) {
  const div = document.createElement("div");
  div.textContent = `[${report.time}] ${getTaskTypeLabelSingle(report.taskType)} ${getReportTypeLabelSingle(report.reportType, report.taskType)}⇒${report.comment}`;
  div.style.padding = "2px 0";
  div.style.color = isLatest ? "#777" : "#ddd";
  div.style.fontSize = "0.8rem";
  return div;
}

// ====== 顯示所有報告 ======
function renderReports() {
  const reports = JSON.parse(localStorage.getItem(REPORT_STORAGE_KEY)) || [];
  reportListEl.innerHTML = "";

  reports.sort((a, b) => new Date(b.time) - new Date(a.time));

  reports.forEach((r, index) => {
    const div = createReportDiv(r, index === 0);
    reportListEl.appendChild(div);
  });
}

// ====== 事件綁定 ======
reportTaskTypeEl.addEventListener("change", updateReportTypeOptions);

submitReportBtn.addEventListener("click", () => {
  const taskType = reportTaskTypeEl.value;
  const reportType = reportTypeEl.value;
  const comment = reportCommentEl.value.trim();

  if (!comment) {
    showMsg(lang === "zh" ? "請輸入內容" : "内容を入力してください", "red");
    return;
  }

  const time = new Date().toLocaleString();
  const newReport = { time, taskType, reportType, comment };

  const reports = JSON.parse(localStorage.getItem(REPORT_STORAGE_KEY)) || [];
  reports.push(newReport);
  localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(reports));

  renderReports();   // 直接刷新畫面，不再重複操作 DOM
  showMsg(lang === "zh" ? "回報內容已送出" : "送信完了", "green");
  reportCommentEl.value = "";
});

clearReportsBtn.addEventListener("click", () => {
  localStorage.removeItem(REPORT_STORAGE_KEY);
  reportListEl.innerHTML = "";
});


/* ===== 初始化 ===== */
updateReportTaskOptions();
updateReportTypeOptions();
updateReportCommentPlaceholder();
renderReports();