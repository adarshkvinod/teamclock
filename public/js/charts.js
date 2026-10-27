import { S, TASK_TYPES, TYPES } from "./state.js";
import { day, hrs, worked, weekStart } from "./utils.js";

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

let currentRangeDays = 7;

export function drawDashboardCharts(daysCount = currentRangeDays) {
  currentRangeDays = daysCount;

  const days = [...Array(daysCount)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (daysCount - 1) + i);
    return day(d);
  });

  const dailyHours = days.map((d) =>
    +hrs(S.sessions.filter((x) => day(x.start) === d).reduce((a, b) => a + worked(b), 0))
  );

  const categories = TASK_TYPES || TYPES;
  const ws = weekStart();
  const wkS = S.sessions.filter((x) => (x.end || Date.now()) >= ws);
  const dataByRole = categories.map((t) => +hrs(wkS.filter((x) => x.type === t).reduce((a, b) => a + worked(b), 0)));

  // 1. Daily Bar Chart
  const ctxBar = document.getElementById("barChartDaily");
  if (ctxBar) {
    if (barChartInstance) {
      barChartInstance.data.labels = days.map((d) =>
        new Date(d).toLocaleDateString([], { month: "short", day: "numeric" })
      );
      barChartInstance.data.datasets[0].data = dailyHours;
      barChartInstance.update("none");
    } else {
      barChartInstance = new Chart(ctxBar, {
        type: "bar",
        data: {
          labels: days.map((d) =>
            new Date(d).toLocaleDateString([], { month: "short", day: "numeric" })
          ),
          datasets: [
            {
              label: "Hours Logged",
              data: dailyHours,
              backgroundColor: "#073b28",
              hoverBackgroundColor: "#10b981",
              borderRadius: 8,
              barThickness: daysCount > 14 ? 14 : 26
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { font: { family: "Plus Jakarta Sans", weight: "600" } } },
            y: { grid: { color: "#f1f5f9" }, ticks: { font: { family: "Plus Jakarta Sans" } } }
          }
        }
      });
    }
  }

  // 2. Role Donut Chart
  const ctxDonut = document.getElementById("donutChartRoles");
  if (ctxDonut) {
    const donutData = dataByRole.every((v) => v === 0) ? Array(categories.length).fill(1) : dataByRole;
    if (donutChartInstance) {
      donutChartInstance.data.labels = categories;
      donutChartInstance.data.datasets[0].data = donutData;
      donutChartInstance.update("none");
    } else {
      donutChartInstance = new Chart(ctxDonut, {
        type: "doughnut",
        data: {
          labels: categories,
          datasets: [
            {
              data: donutData,
              backgroundColor: [
                "#073b28",
                "#0a4933",
                "#10b981",
                "#34d399",
                "#065f46",
                "#059669",
                "#6ee7b7",
                "#a7f3d0"
              ],
              borderWidth: 0
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "70%",
          plugins: { legend: { display: false } }
        }
      });
    }
  }
}