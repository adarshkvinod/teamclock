import { S } from "./state.js";
import { worked, user, pSessions, pTasks, sprint, sprintsOf, day, cur } from "./utils.js";
import { reportData } from "./views-extra.js";

let barChartInstance = null;
let donutChartInstance = null;

let extraCharts = [];

export function clearCharts() {
  extraCharts.forEach((c) => c.destroy());
  extraCharts = [];
  if (barChartInstance) {
    barChartInstance.destroy();
    barChartInstance = null;
  }
  if (donutChartInstance) {
    donutChartInstance.destroy();
    donutChartInstance = null;
  }
}

export function drawDashboardCharts(days = 7) {
  clearCharts();

  if (typeof Chart === "undefined") return;

  const barCanvas = document.getElementById("barChartDaily");
  const donutCanvas = document.getElementById("donutChartRoles");
  if (!barCanvas || !donutCanvas) return;

  const me = user(S.me);
  const adm = me?.role === "admin";

  // Filter sessions: Admin gets all, Employee gets only their own
  const projectSessions = pSessions();
  const targetSessions = adm
    ? projectSessions
    : projectSessions.filter((s) => s.uid === S.me);

  // 1. Daily Working Hours Bar Chart
  const labels = [];
  const dataPoints = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const dayStart = d.getTime();
    const dayEnd = dayStart + 86400000;

    const dayName = d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
    labels.push(dayName);

    const daySessions = targetSessions.filter(
      (s) => s.start >= dayStart && s.start < dayEnd
    );
    const dayHours = daySessions.reduce((acc, s) => acc + worked(s), 0) / 36e5;
    dataPoints.push(parseFloat(dayHours.toFixed(1)));
  }

  barChartInstance = new Chart(barCanvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: adm ? "Team Hours" : "My Hours",
          data: dataPoints,
          backgroundColor: "#073b28",
          hoverBackgroundColor: "#10b981",
          borderRadius: 6,
          maxBarThickness: 32
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#0f1713",
          titleColor: "#ffffff",
          bodyColor: "#ffffff",
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: (ctx) => ` ${ctx.parsed.y} hrs`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "#798293", font: { size: 11, family: "Plus Jakarta Sans" } }
        },
        y: {
          beginAtZero: true,
          grid: { color: "#f1f5f9" },
          ticks: { color: "#798293", font: { size: 11, family: "Plus Jakarta Sans" } }
        }
      }
    }
  });

  // 2. Role / Category Donut Chart
  const categoryHours = {};
  targetSessions.forEach((s) => {
    const type = s.type || "General";
    categoryHours[type] = (categoryHours[type] || 0) + worked(s);
  });

  const donutLabels = Object.keys(categoryHours);
  const donutData = donutLabels.map((k) =>
    parseFloat((categoryHours[k] / 36e5).toFixed(1))
  );

  const themePalette = [
    "#073b28",
    "#10b981",
    "#34d399",
    "#059669",
    "#a7f3d0",
    "#6ee7b7",
    "#064e3b"
  ];

  donutChartInstance = new Chart(donutCanvas, {
    type: "doughnut",
    data: {
      labels: donutLabels.length ? donutLabels : ["No Data"],
      datasets: [
        {
          data: donutData.length ? donutData : [1],
          backgroundColor: donutData.length
            ? themePalette.slice(0, donutLabels.length)
            : ["#e2e8f0"],
          borderWidth: 2,
          borderColor: "#ffffff"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "74%",
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#0f1713",
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${ctx.raw} hrs`
          }
        }
      }
    }
  });
}

// ================= SPRINT + REPORT CHARTS =================
const PALETTE = ["#073b28", "#10b981", "#0ea5e9", "#f59e0b", "#a78bfa", "#f472b6", "#64748b", "#34d399", "#ef4444"];

function make(id, cfg) {
  const el = document.getElementById(id);
  if (!el || typeof Chart === "undefined") return null;
  const chart = new Chart(el, cfg);
  extraCharts.push(chart);
  return chart;
}

const base = { responsive: true, maintainAspectRatio: false };
const shortDate = (d) => new Date(d + "T00:00:00").toLocaleDateString([], { month: "short", day: "numeric" });

export function drawSprintCharts() {
  if (typeof Chart === "undefined") return;

  const cv = document.getElementById("burndownChart");
  const sp = cv && sprint(cv.dataset.sprint);
  if (sp) {
    const tasks = pTasks().filter((t) => t.sprintId === sp.id);
    const scope = Math.max(sp.committed || 0, tasks.length);

    const days = [];
    for (let d = new Date(sp.start + "T00:00:00"), i = 0; day(d.getTime()) <= sp.end && i < 90; d = new Date(d.getTime() + 864e5), i++) {
      days.push(day(d.getTime()));
    }
    const today = day(Date.now());
    const n = Math.max(days.length - 1, 1);

    make("burndownChart", {
      type: "line",
      data: {
        labels: days.map(shortDate),
        datasets: [
          { label: "Ideal", data: days.map((_, i) => Math.round(scope * (1 - i / n) * 10) / 10), borderColor: "#cbd5e1", borderDash: [6, 6], pointRadius: 0, tension: 0 },
          {
            label: "Remaining tasks",
            data: days.map((d) => (d > today ? null : scope - tasks.filter((t) => t.doneAt && day(t.doneAt) <= d).length)),
            borderColor: "#10b981",
            backgroundColor: "rgba(16,185,129,0.12)",
            fill: true,
            tension: 0.25,
            pointRadius: 3
          }
        ]
      },
      options: { ...base, plugins: { legend: { position: "bottom" } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
    });
  }

  const done = sprintsOf().filter((s) => s.status === "completed");
  if (done.length) {
    make("velocityChart", {
      type: "bar",
      data: {
        labels: done.map((s) => s.name),
        datasets: [
          { label: "Committed", data: done.map((s) => s.committed || 0), backgroundColor: "#d1fae5", borderRadius: 6 },
          { label: "Completed", data: done.map((s) => s.doneCount || 0), backgroundColor: "#10b981", borderRadius: 6 }
        ]
      },
      options: { ...base, plugins: { legend: { position: "bottom" } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
    });
  }
}

export function drawReportCharts() {
  if (typeof Chart === "undefined" || !document.getElementById("rpStatus")) return;
  const me = user(S.me);
  const adm = me?.role === "admin";
  const r = reportData(adm, me);

  // tasks by status
  const st = ["To do", "In progress", "Done"].map((s) => r.tasks.filter((t) => t.status === s).length);
  make("rpStatus", {
    type: "doughnut",
    data: { labels: ["To do", "In progress", "Done"], datasets: [{ data: st, backgroundColor: ["#94a3b8", "#0ea5e9", "#10b981"], borderWidth: 0 }] },
    options: { ...base, cutout: "62%", plugins: { legend: { position: "right" } } }
  });

  // hours by category
  const cat = {};
  r.sessions.forEach((x) => (cat[x.type] = (cat[x.type] || 0) + worked(x) / 36e5));
  const catKeys = Object.keys(cat);
  make("rpHoursCat", {
    type: "doughnut",
    data: { labels: catKeys.length ? catKeys : ["No time logged"], datasets: [{ data: catKeys.length ? catKeys.map((k) => Math.round(cat[k] * 10) / 10) : [1], backgroundColor: catKeys.length ? PALETTE : ["#e2e8f0"], borderWidth: 0 }] },
    options: { ...base, cutout: "62%", plugins: { legend: { position: "right" } } }
  });

  // hours by member (admin) / my hours per day (employee)
  if (adm) {
    make("rpHoursMember", {
      type: "bar",
      data: { labels: r.rows.map((x) => x.m.name.split(" ")[0]), datasets: [{ label: "Hours", data: r.rows.map((x) => Math.round((x.ms / 36e5) * 10) / 10), backgroundColor: "#10b981", borderRadius: 6 }] },
      options: { ...base, indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }
    });
  } else {
    const span = Math.min(S.reportRange || 30, 30);
    const labels = [];
    const data = [];
    for (let i = span - 1; i >= 0; i--) {
      const k = day(Date.now() - i * 864e5);
      labels.push(shortDate(k));
      data.push(Math.round(r.sessions.filter((x) => day(x.start) === k).reduce((a, x) => a + worked(x), 0) / 36e4) / 10);
    }
    make("rpHoursMember", {
      type: "bar",
      data: { labels, datasets: [{ label: "Hours", data, backgroundColor: "#10b981", borderRadius: 6 }] },
      options: { ...base, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
  }

  // tasks completed per week (last 8 weeks)
  const weeks = [];
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  for (let i = 7; i >= 0; i--) {
    const from = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - i * 7).getTime();
    weeks.push({ from, to: from + 7 * 864e5 });
  }
  make("rpWeekly", {
    type: "bar",
    data: {
      labels: weeks.map((w) => shortDate(day(w.from))),
      datasets: [{ label: "Completed", data: weeks.map((w) => r.tasks.filter((t) => t.doneAt && t.doneAt >= w.from && t.doneAt < w.to).length), backgroundColor: "#073b28", borderRadius: 6 }]
    },
    options: { ...base, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
  });
}
