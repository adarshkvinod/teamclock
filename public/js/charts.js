import { S } from "./state.js";
import { worked, user, pSessions } from "./utils.js";

let barChartInstance = null;
let donutChartInstance = null;

export function clearCharts() {
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