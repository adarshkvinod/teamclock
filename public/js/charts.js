import { S, TYPES } from "./state.js";
import { day, hrs, worked, weekStart } from "./utils.js";

let activeCharts = [];

export function clearCharts() {
  activeCharts.forEach((c) => c.destroy());
  activeCharts = [];
}

export function drawDashboardCharts() {
  clearCharts();

  // 1. Daily Activity Bar Chart
  const days = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    return day(d);
  });

  const dailyHours = days.map((d) =>
    +hrs(S.sessions.filter((x) => day(x.start) === d).reduce((a, b) => a + worked(b), 0))
  );

  const ctxBar = document.getElementById("barChartDaily");
  if (ctxBar) {
    activeCharts.push(
      new Chart(ctxBar, {
        type: "bar",
        data: {
          labels: days.map((d) => new Date(d).toLocaleDateString([], { weekday: "short" })),
          datasets: [
            {
              label: "Hours Logged",
              data: dailyHours,
              backgroundColor: "#073b28",
              hoverBackgroundColor: "#10b981",
              borderRadius: 8,
              barThickness: 28
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
      })
    );
  }

  // 2. Roles Distribution Doughnut Chart
  const ctxDonut = document.getElementById("donutChartRoles");
  if (ctxDonut) {
    const ws = weekStart(),
      wkS = S.sessions.filter((x) => (x.end || Date.now()) >= ws);
    const dataByRole = TYPES.map((t) => +hrs(wkS.filter((x) => x.type === t).reduce((a, b) => a + worked(b), 0)));

    activeCharts.push(
      new Chart(ctxDonut, {
        type: "doughnut",
        data: {
          labels: TYPES,
          datasets: [
            {
              data: dataByRole.every((v) => v === 0) ? [1, 1, 1, 1, 1] : dataByRole,
              backgroundColor: ["#073b28", "#10b981", "#34d399", "#065f46", "#6ee7b7"],
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
      })
    );
  }
}