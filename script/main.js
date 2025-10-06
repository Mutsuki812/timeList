const EXCEL_URL = "./files/timeList.xlsx";
let lang = "zh"; // early language

const WEEKDAY_ZH = ["日", "一", "二", "三", "四", "五", "六"];
const WEEKDAY_JP = ["日", "月", "火", "水", "木", "金", "土"];

// 自動判定使用者時區
function detectLangByTimezone() {
  const timezoneOffset = -new Date().getTimezoneOffset() / 60;
  lang = timezoneOffset === 9 ? "jp" : "zh";
  document.getElementById("langBtn").textContent =
    lang === "zh" ? "日本サーバーに切り替え" : "切換到台灣伺服器";
}

// 語言切換按鈕
document.getElementById("langBtn").addEventListener("click", () => {
  lang = lang === "zh" ? "jp" : "zh";
  document.getElementById("langBtn").textContent =
    lang === "zh" ? "日本サーバーに切り替え" : "切換到台灣伺服器";

  updateLangText();
  getTodayLabel();
  loadTasks();
});

// 語言說明文字
function updateLangText() {
  const langText = document.getElementById("langText");
  if (lang === "zh") {
    langText.innerHTML = "・時間為系統出字提示的時間。<br>" +
      "・儀式：出字提示後、等待10分鐘出怪。<br>" +
      "・水月/白青野王：出字提示後、等待5分鐘出王。";
  } else {
    langText.innerHTML = "・時間は予兆が出る時間。<br>" +
      "・怪しい儀式：予兆提示後、10分ほど、ボスが出ます。<br>" +
      "・水月/白青FB：予兆提示後、5分ほど、ボスが出ます。";
  }
}

// 取得當前時間 (依伺服器時區)
function getNowBySVR() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const offset = (lang === "zh" ? 8 : 9) * 60 * 60000;
  return new Date(utc + offset);
}

// 顯示今天日期
function getTodayLabel() {
  const now = getNowBySVR();
  const label = lang === "zh" ? WEEKDAY_ZH[now.getDay()] : WEEKDAY_JP[now.getDay()];
  document.getElementById("today").textContent =
    `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}（${label}）`;
}

// 每秒更新時間顯示
setInterval(() => {
  const now = getNowBySVR();
  const el = document.getElementById("currentTime");
  const locale = lang === "zh" ? "zh-TW" : "ja-JP";
  const options = { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" };
  if (el) el.textContent = now.toLocaleTimeString(locale, options) +
    (lang === "zh" ? " 台灣時間 (UTC+8)" : " 日本時間 (UTC+9)");
}, 1000);

// 從 Excel 讀取任務
async function loadTasks() {
  const now = getNowBySVR();
  getTodayLabel();

  try {
    const res = await fetch(EXCEL_URL);
    const buf = await res.arrayBuffer();
    const workbook = XLSX.read(buf, { type: "array" });
    const sheet = workbook.Sheets["timeList"];
    const data = XLSX.utils.sheet_to_json(sheet);

    const currentHour = now.getHours();
    const currentWeekZh = WEEKDAY_ZH[now.getDay()];
    const currentWeekJp = WEEKDAY_JP[now.getDay()];

    const rows = data.filter(row =>
      (row["Week-zh"] === currentWeekZh || row["Week-jp"] === currentWeekJp)
    );

    const taskTypes = [
      { key: "ishiki", labelZh: "可疑的儀式", labelJp: "怪しい儀式" },
      { key: "mitsuki", labelZh: "水月野王", labelJp: "水月FB" },
      { key: "shirao", labelZh: "白青野王", labelJp: "白青FB" }
    ];

    const tbody = document.getElementById("taskBody");
    tbody.innerHTML = "";

    taskTypes.forEach(type => {
      const timeCol = `${type.key}-time`;
      const textCol = `${type.key}-${lang}`;

      const current = rows.find(r => parseInt(r[timeCol]?.split(":")[0]) === currentHour);
      const nextTasks = rows.filter(r => {
        const hour = parseInt(r[timeCol]?.split(":")[0]);
        return hour > currentHour && hour <= currentHour + 2;
      });

      // 當前任務列
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${lang === "zh" ? type.labelZh : type.labelJp}</td>
        <td>${current ? current[timeCol] : "--:--"}</td>
        <td>${current ? current[textCol] : (lang === "zh" ? "無任務" : "任務なし")}</td>
      `;
      tbody.appendChild(tr);

      // 接下來兩小時任務列
      if (nextTasks.length > 0) {
        const subTr = document.createElement("tr");
        const times = nextTasks.map(n => n[timeCol]).join("<br>");
        const texts = nextTasks.map(n => n[textCol]).join("<br>");
        subTr.innerHTML = `
          <td style="color:#999;">↳ ${lang === "zh" ? "接下來" : "次の予定"}</td>
          <td>${times}</td>
          <td>${texts}</td>
        `;
        tbody.appendChild(subTr);
      }

      // === 整日剩餘任務按鈕 ===
      const btnTr = document.createElement("tr");
      const btnLabel = lang === "zh" ? "整日時間 ▼" : "一日の予定 ▼";
      btnTr.innerHTML = `
        <td></td><td></td>
        <td class="showAllBtn" style="text-align:center;cursor:pointer;color:#007BFF;">${btnLabel}</td>`;
      tbody.appendChild(btnTr);

      btnTr.querySelector(".showAllBtn").addEventListener("click", (e) => {
        showRemainingDayTasks(rows, type.key, e.target, currentHour, nextTasks);
      });
    });

  } catch (err) {
    console.error("Excel 讀取錯誤：", err);
    document.getElementById("taskBody").innerHTML =
      `<tr><td colspan="3">${lang === "zh" ? "讀取失敗" : "読み込み失敗"}</td></tr>`;
  }
}

// 顯示整日剩餘任務 (排除已過/當前/接下來兩小時任務)
function showRemainingDayTasks(rows, taskKey, btnEl, currentHour, nextTasks) {
  const tbody = document.getElementById("taskBody");

  // 移除舊的展開列
  document.querySelectorAll(`.allTaskRow-${taskKey}`).forEach(r => r.remove());

  // 收起/展開切換
  const open = btnEl.dataset.open === "1";
  if (open) {
    btnEl.textContent = lang === "zh" ? "整日時間 ▼" : "一日の予定 ▼";
    btnEl.dataset.open = "0";
    return;
  }

  // 只顯示接下來兩小時任務之後的任務
  const maxNextHour = nextTasks.length > 0 ? Math.max(...nextTasks.map(t => parseInt(t[`${taskKey}-time`]))) : currentHour;
  const rest = rows.filter(r => {
    const hour = parseInt(r[`${taskKey}-time`]?.split(":")[0]);
    return hour > maxNextHour;
  });

  if (rest.length > 0) {
    const allTr = document.createElement("tr");
    allTr.classList.add(`allTaskRow-${taskKey}`);
    allTr.innerHTML = `
      <td style="color:#999;">↳ ${lang === "zh" ? "今日剩餘" : "残りの予定"}</td>
      <td>${rest.map(r => r[`${taskKey}-time`]).join("<br>")}</td>
      <td>${rest.map(r => r[`${taskKey}-${lang}`]).join("<br>")}</td>
    `;
    tbody.insertBefore(allTr, btnEl.closest("tr").nextSibling);
  }

  btnEl.textContent = lang === "zh" ? "收起 ▲" : "閉じる ▲";
  btnEl.dataset.open = "1";
}

// Initial load
detectLangByTimezone();
updateLangText();
loadTasks();

// 每小時整點重新載入
function scheduleHourlyReload() {
  const now = getNowBySVR();
  const msToNextHour = (60 - now.getMinutes()) * 60000 - now.getSeconds() * 1000;
  setTimeout(() => {
    loadTasks();
    setInterval(loadTasks, 3600000);
  }, msToNextHour);
}
scheduleHourlyReload();
