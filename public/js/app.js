import { S, TOK, loadTokenFromStorage, loadTokenStorage } from "./state.js";
import { $, dur, worked, active, user } from "./utils.js";
import { API, loadData } from "./api.js";
import { drawDashboardCharts, clearCharts } from "./charts.js";
import {
    layoutView,
    dashboardView,
    tasksView,
    teamView,
    trackView,
    sheetView,
    loginView,
    setupView
} from "./views.js";
import { bindEvents, bindAuthEvents } from "./events.js";

function tick() {
  // 1. Update personal shift timers (Workstation display & Sidebar widget)
  const s = active(S.me);
  if (s) {
    const currentDuration = dur(worked(s));
    const mainTimer = $("#tm");
    if (mainTimer) mainTimer.textContent = currentDuration;
    const sidebarTimer = $("#sidebarTimer");
    if (sidebarTimer) sidebarTimer.textContent = currentDuration;
  }

  // 2. Update all active employee timers in the "Team Clocked In" dashboard card
  document.querySelectorAll("[data-worker-timer]").forEach((el) => {
    const sessionId = el.dataset.workerTimer;
    const session = S.sessions.find((x) => (x.id || x._id) === sessionId);
    if (session && !session.end) {
      el.textContent = dur(worked(session));
    }
  });
}

function render() {
    clearCharts();
    const me = user(S.me);

    if (!me) {
        if (S.needsSetup) {
            $("#app").innerHTML = setupView();
            bindAuthEvents(true);
        } else {
            $("#app").innerHTML = loginView();
            bindAuthEvents(false);
        }
        return;
    }

    const adm = me.role === "admin";
    if (!S.tab) S.tab = adm ? "dashboard" : "track";

    let content = "";
    switch (S.tab) {
        case "dashboard": content = dashboardView(); break;
        case "tasks": content = tasksView(adm); break;
        case "team": content = teamView(); break;
        case "track": content = trackView(me); break;
        case "sheet": content = sheetView(adm, me); break;
        default: content = dashboardView();
    }

    $("#app").innerHTML = layoutView(me, content);
    bindEvents(me);

    if (S.tab === "dashboard") {
        drawDashboardCharts();
    }
}

// Global render trigger
window.addEventListener("app:render", render);

async function init() {
    if (typeof loadTokenFromStorage === "function") {
        loadTokenFromStorage();
    } else if (typeof loadTokenStorage === "function") {
        loadTokenStorage();
    }

    try {
        const state = await API("GET", "/state");
        S.needsSetup = state.needsSetup;
    } catch (e) {
        $("#app").innerHTML = `
      <div class="auth-wrapper">
        <div class="auth-card">
          <h2>Server Unreachable</h2>
          <p>Cannot reach the database. Please verify your MongoDB configuration.</p>
        </div>
      </div>`;
        return;
    }

    S.ready = 7;
    if (TOK) {
        try {
            await loadData();
        } catch (e) { }
    }

    render();
    // 1-second timer ticker (only updates timer numbers, does not re-render DOM)
    setInterval(tick, 1000);

    // Background poller: 15 seconds, background mode enabled, tab visibility check
    setInterval(() => {
        if (TOK && document.visibilityState === "visible") {
            loadData(true).catch(() => { });
        }
    }, 15000);
}

init();