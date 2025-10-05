const EXCEL_URL = "./files/timeList.xlsx";
let lang = "zh"; // early language

const WEEKDAY_ZH = ["日", "一", "二", "三", "四", "五", "六"];
const WEEKDAY_JP = ["日", "月", "火", "水", "木", "金", "土"];

// language btn
document.getElementById("langBtn").addEventListener("click", () => {
  lang = lang === "zh" ? "jp" : "zh";
  document.getElementById("langBtn").textContent = lang === "zh" ? "日本語に切り替え" : "切換到中文";
  updateLangText();
  loadTasks();
});

function updateLangText() {
  const langText = document.getElementById("langText");
  if (lang === "zh") {
    langText.innerHTML = "・時間為系統出字提示的時間。<br>・儀式：系統提示後、等待10分鐘出怪。<br>・水月/白青野王：系統提示後、等待5分鐘出王。";
  } else {
    langText.innerHTML = "・時間は予兆が出る時間。<br>・怪しい儀式：システムが予兆提示後、10分ほど、ボスが出ます。<br>・水月/白青FB：システムが予兆提示後、5分ほど、ボスが出ます。";
  }
}

function getTodayLabel() {
  const now = new Date();
  const label = lang === "zh" ? WEEKDAY_ZH[now.getDay()] : WEEKDAY_JP[now.getDay()];
  document.getElementById("today").textContent =
    `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()} （${label}）`;
}


async function loadTasks() {
  const now = new Date();
  getTodayLabel();
  try {
    const res = await fetch(EXCEL_URL);
    const buf = await res.arrayBuffer();
    const workbook = XLSX.read(buf, { type: "array" });
    const sheet = workbook.Sheets["timeList"];
    const data = XLSX.utils.sheet_to_json(sheet);

    const currentHour = now.getHours().toString().padStart(2, "0");
    const currentWeekZh = WEEKDAY_ZH[now.getDay()];
    const currentWeekJp = WEEKDAY_JP[now.getDay()];

    // week
    const rows = data.filter(row =>
      (row["Week-zh"] === currentWeekZh || row["Week-jp"] === currentWeekJp)
    );

    // task
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

      const task = rows.find(row => {
        const t = row[timeCol];
        return t && t.startsWith(currentHour);
      });

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${lang === "zh" ? type.labelZh : type.labelJp}</td>
        <td>${task ? task[timeCol] : "--:--"}</td>
        <td>${task ? task[textCol] : (lang === "zh" ? "尚未有數據" : "データなし")}</td>
      `;
      tbody.appendChild(tr);
    });

  } catch (err) {
      `<tr><td colspan="3">${lang === "zh" ? "讀取失敗" : "読み込み失敗"}</td></tr>`;
    document.getElementById("taskBody").innerHTML =
      `<tr><td colspan="3">讀取失敗</td></tr>`;
  }
}

updateLangText();
loadTasks();

// Hourly alignment update
const now = new Date();
const msToNextHour = (60 - now.getMinutes()) * 60 * 1000 - now.getSeconds() * 1000;
setTimeout(() => {
  loadTasks();
  setInterval(loadTasks, 60 * 60 * 1000);
}, msToNextHour);