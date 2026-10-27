const TYPES = ["Designer", "Project Manager", "Marketing", "Developer", "DevOps"];
const S = { users: [], tasks: [], sessions: [], me: null, tab: null, ready: 0 };
let TOK = null, charts = [];

async function API(m, p, b) {
  const r = await fetch("/api" + p, {
    method: m,
    headers: {
      "Content-Type": "application/json",
      ...(TOK ? { Authorization: "Bearer " + TOK } : {})
    },
    body: b ? JSON.stringify(b) : undefined
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 401 && TOK) logout();
    throw { message: j.error || "Request failed" };
  }
  return j;
}

const db = {
  doc: (p) => {
    const [c, i] = p.split("/"), u = `/${c}/${i}`;
    return {
      set: (d) => API("PUT", u, d).then(load),
      update: (d) => API("PATCH", u, d).then(load),
      delete: () => API("DELETE", u).then(load)
    };
  }
};

async function load() {
  if (!TOK) return;
  const j = await API("GET", "/data");
  Object.assign(S, j, { ready: 7 });
  if (!user(S.me)) return logout();
  render();
}

function logout() {
  TOK = null;
  S.me = null;
  S.tab = null;
  S.users = [];
  try {
    localStorage.removeItem("tc_tok");
    localStorage.removeItem("tc_me");
  } catch (e) {}
  render();
}

async function auth(p, b) {
  const j = await API("POST", p, b);
  TOK = j.token;
  S.me = j.id;
  S.tab = null;
  try {
    localStorage.setItem("tc_tok", TOK);
    localStorage.setItem("tc_me", j.id);
  } catch (e) {}
  await load();
}

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => "id" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

const hrs = (ms) => (ms / 36e5).toFixed(1);
const dur = (ms) => {
  ms = Math.max(0, ms);
  const s = Math.floor(ms / 1e3);
  return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((x) => String(x).padStart(2, "0")).join(":");
};
const day = (t) => {
  const d = new Date(t);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};
const weekStart = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
};
const worked = (s) => (s.end || Date.now()) - s.start - (s.breaks || []).reduce((a, b) => a + ((b.e || s.end || Date.now()) - b.s), 0);
const user = (id) => S.users.find((u) => u.id === id);
const tname = (id) => S.tasks.find((t) => t.id === id)?.title || "–";
const active = (id) => S.sessions.find((s) => s.uid === id && !s.end);

function tstate(t) {
  if (t.status === "Done") return ["Done", "done"];
  const d = new Date(t.deadline + "T23:59:59").getTime();
  if (d < Date.now()) return ["Overdue", "over"];
  if (d - Date.now() < 864e5 * 2) return ["Due soon", "soon"];
  return ["On track", "track"];
}

function getFormattedDate() {
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  return new Date().toLocaleDateString('en-US', options);
}

async function init() {
  try {
    TOK = localStorage.getItem("tc_tok");
    S.me = localStorage.getItem("tc_me");
  } catch (e) {}

  try {
    S.needsSetup = (await API("GET", "/state")).needsSetup;
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
    try { await load(); } catch (e) {}
  }
  render();
  setInterval(tick, 1000);
}

function tick() {
  const e = $("#sidebarTimer");
  if (!e) return;
  const s = active(S.me);
  if (s) e.textContent = dur(worked(s));
}

/* ================= RENDERING ================= */

function render() {
  charts.forEach((c) => c.destroy());
  charts = [];
  const me = user(S.me);
  if (!me) return S.needsSetup ? setupView() : loginView();

  const adm = me.role === "admin";
  if (!S.tab) S.tab = adm ? "dashboard" : "track";

  const s = active(me.id);

  $("#app").innerHTML = `
    <div class="dashboard-layout">
      <!-- SIDEBAR -->
      <aside class="sidebar">
        <div>
          <div class="brand-wrapper">
            <div class="brand-badge">T</div>
            <div class="brand-title">TeamClock</div>
          </div>

          <div class="nav-section-label">Menu</div>
          <ul class="nav-menu">
            <li class="nav-item">
              <button data-t="dashboard" class="${S.tab === 'dashboard' ? 'active' : ''}">
                <svg viewBox="0 0 24 24"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
                <span>Dashboard</span>
              </button>
            </li>
            <li class="nav-item">
              <button data-t="tasks" class="${S.tab === 'tasks' ? 'active' : ''}">
                <svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                <span>Tasks &amp; Deadlines</span>
              </button>
            </li>
            <li class="nav-item">
              <button data-t="track" class="${S.tab === 'track' ? 'active' : ''}">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span>Time Tracker</span>
              </button>
            </li>
            <li class="nav-item">
              <button data-t="sheet" class="${S.tab === 'sheet' ? 'active' : ''}">
                <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                <span>Timesheets</span>
              </button>
            </li>
          </ul>

          ${adm ? `
            <div class="nav-section-label">Management</div>
            <ul class="nav-menu">
              <li class="nav-item">
                <button data-t="team" class="${S.tab === 'team' ? 'active' : ''}">
                  <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  <span>Team Members</span>
                </button>
              </li>
            </ul>
          ` : ''}
        </div>

        <!-- Sidebar Live Shift Tracker Card -->
        <div class="sidebar-live-widget">
          <div class="widget-status">
            <span class="pulse-dot ${s ? '' : 'offline'}"></span>
            <span>${s ? 'Current Shift Active' : 'Currently Offline'}</span>
          </div>
          <div class="timer-digits" id="sidebarTimer">${s ? dur(worked(s)) : '00:00:00'}</div>
          ${s ? `
            <button class="btn-sidebar-clock btn-out" id="sideBtnClockOut">Clock Out</button>
          ` : `
            <button class="btn-sidebar-clock" id="sideBtnClockIn">Start Shift</button>
          `}
        </div>
      </aside>

      <!-- MAIN CONTENT -->
      <main class="main-wrapper">
        <!-- Top Bar Header -->
        <header class="topbar">
          <div class="page-headline">
            <h1>${getPageTitle(S.tab)}</h1>
            <p>${getFormattedDate()}</p>
          </div>
          <div class="topbar-actions">
            <div class="icon-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </div>
            <div class="icon-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            </div>
            <div class="user-pill">
              <div class="user-avatar">${esc(me.name.charAt(0))}</div>
              <div class="user-info">
                <div class="user-name">${esc(me.name)}</div>
                <div class="user-role">${adm ? 'Admin Officer' : esc(me.workType)}</div>
              </div>
              <button class="btn-logout" id="out" title="Logout">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              </button>
            </div>
          </div>
        </header>

        <!-- View Router -->
        ${renderCurrentView(me, adm)}
      </main>
    </div>
  `;

  bindEvents(me);
  if (S.tab === "dashboard") drawDashboardCharts();
}

function getPageTitle(tab) {
  switch(tab) {
    case 'dashboard': return 'Productivity Report';
    case 'tasks': return 'Tasks & Deadlines';
    case 'track': return 'Time Tracker';
    case 'sheet': return 'Weekly Timesheets';
    case 'team': return 'Team Directory';
    default: return 'Overview';
  }
}

function renderCurrentView(me, adm) {
  if (S.tab === "dashboard") return dashboardView();
  if (S.tab === "tasks") return tasksView(adm);
  if (S.tab === "track") return trackView(me);
  if (S.tab === "sheet") return sheetView(adm, me);
  if (S.tab === "team") return teamView();
  return dashboardView();
}

/* ================= VIEWS ================= */

function dashboardView() {
  const ws = weekStart(), wkS = S.sessions.filter(x => (x.end || Date.now()) >= ws);
  const totalHours = wkS.reduce((a, x) => a + worked(x), 0);
  const clockedInCount = S.sessions.filter(x => !x.end).length;
  const doneTasks = S.tasks.filter(t => t.status === "Done").length;
  const overdueTasks = S.tasks.filter(t => tstate(t)[1] === "over").length;
  const activeWorkers = S.sessions.filter(x => !x.end);

  return `
    <div class="dashboard-grid">
      <!-- Left 2-Columns: KPIs & Bar Chart -->
      <div class="grid-col-main">
        <!-- 4 KPI Cards (Matching screenshot layout) -->
        <div class="kpi-matrix">
          <!-- Card 1: Pine Green Accent Card -->
          <div class="kpi-card kpi-card-pine">
            <div class="kpi-header">
              <div class="kpi-icon-pill">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <span class="growth-badge positive">+14.2%</span>
            </div>
            <div>
              <div class="kpi-label">Total Working Hours</div>
              <div class="kpi-value-row">
                <span class="kpi-big-number">${hrs(totalHours)} h</span>
                <span class="kpi-caption">Hours vs Last Week</span>
              </div>
            </div>
          </div>

          <!-- Card 2: Active Now -->
          <div class="kpi-card">
            <div class="kpi-header">
              <div class="kpi-icon-pill">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
              </div>
              <span class="growth-badge subtle">Live</span>
            </div>
            <div>
              <div class="kpi-label">Clocked In Now</div>
              <div class="kpi-value-row">
                <span class="kpi-big-number">${clockedInCount}</span>
                <span class="kpi-caption">Active team members</span>
              </div>
            </div>
          </div>

          <!-- Card 3: Tasks Done -->
          <div class="kpi-card">
            <div class="kpi-header">
              <div class="kpi-icon-pill">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <span class="growth-badge positive">${S.tasks.length ? Math.round(doneTasks / S.tasks.length * 100) : 0}%</span>
            </div>
            <div>
              <div class="kpi-label">Tasks Completed</div>
              <div class="kpi-value-row">
                <span class="kpi-big-number">${doneTasks}</span>
                <span class="kpi-caption">Of ${S.tasks.length} total tasks</span>
              </div>
            </div>
          </div>

          <!-- Card 4: Overdue Tasks -->
          <div class="kpi-card">
            <div class="kpi-header">
              <div class="kpi-icon-pill">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <span class="growth-badge ${overdueTasks ? 'negative' : 'subtle'}">${overdueTasks} Overdue</span>
            </div>
            <div>
              <div class="kpi-label">Pending Deadlines</div>
              <div class="kpi-value-row">
                <span class="kpi-big-number">${overdueTasks}</span>
                <span class="kpi-caption">Requires action</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Main Chart Card (Matching Customer Habits / Activity) -->
        <div class="chart-card">
          <div class="card-header-row">
            <div>
              <h3>Working Hours Activity</h3>
              <p>Daily hours logged across the last 7 days</p>
            </div>
            <select class="select-filter">
              <option>Last 7 days</option>
            </select>
          </div>
          <div style="height: 270px;">
            <canvas id="barChartDaily"></canvas>
          </div>
        </div>
      </div>

      <!-- Right Column: Sage Statistic Card & Live Workers -->
      <div class="grid-col-side">
        <!-- Sage Card from reference image -->
        <div class="sage-summary-card">
          <div>
            <div class="card-header-row" style="margin-bottom: 8px;">
              <div>
                <h3>Role Statistics</h3>
                <p>Hours logged by category</p>
              </div>
              <span class="growth-badge positive">This Week</span>
            </div>
            <div style="height: 190px; margin: 10px 0;">
              <canvas id="donutChartRoles"></canvas>
            </div>
          </div>
          <div class="side-breakdown-list">
            ${TYPES.map(type => {
              const count = Math.round(wkS.filter(x => x.type === type).reduce((a, b) => a + worked(b), 0) / 36e5);
              return `
                <div class="side-breakdown-item">
                  <span>${esc(type)}</span>
                  <span class="badge-stat">${count} hrs</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Live Status Card -->
        <div class="active-workers-card">
          <h3>Team Clocked In</h3>
          <p style="color: var(--text-muted); font-size: 12px; margin-top: 2px;">Real-time active shifts</p>
          <div class="worker-pill-list">
            ${activeWorkers.length ? activeWorkers.map(w => `
              <div class="worker-item-row">
                <div class="worker-info-meta">
                  <span class="status-indicator"></span>
                  <div>
                    <div class="worker-name">${esc(user(w.uid)?.name || 'Unknown')}</div>
                    <div class="worker-role">${esc(w.type)}</div>
                  </div>
                </div>
                <span class="tag-status track">${dur(worked(w))}</span>
              </div>
            `).join('') : '<p style="color: var(--text-light); font-size: 12px; margin-top: 10px;">Nobody is currently clocked in.</p>'}
          </div>
        </div>
      </div>
    </div>
  `;
}

function tasksView(adm) {
  const emps = S.users.filter((u) => u.role !== "admin");
  const ts = [...S.tasks].sort((a, b) => a.deadline.localeCompare(b.deadline));

  return `
    <div class="full-width-card">
      ${adm ? `
        <h3 style="margin-bottom: 6px;">Assign New Task</h3>
        <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 18px;">Set task title, assign to an employee, and define deadline</p>
        <div class="form-grid-3">
          <div class="input-group">
            <label>Task Title</label>
            <input id="nt" placeholder="e.g. Design app onboarding flow">
          </div>
          <div class="input-group">
            <label>Assignee</label>
            <select id="na">
              ${emps.map(u => `<option value="${u.id}">${esc(u.name)} (${esc(u.workType)})</option>`).join('')}
            </select>
          </div>
          <div class="input-group">
            <label>Deadline</label>
            <input id="nd" type="date">
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 28px;">
          <button class="btn-primary" id="ac">Create Task</button>
          <span class="err" id="te" style="color: var(--accent-red); font-size: 12px;"></span>
        </div>
      ` : ''}

      <h3>All Tasks (${ts.length})</h3>
      <div style="overflow-x: auto;">
        <table class="styled-table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Assignee</th>
              <th>Deadline</th>
              <th>Status</th>
              <th>State</th>
              ${adm ? '<th>Action</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${ts.length ? ts.map(t => {
              const [lbl, cls] = tstate(t);
              return `
                <tr>
                  <td style="font-weight: 600;">${esc(t.title)}</td>
                  <td>${esc(user(t.assignee)?.name || 'Unassigned')}</td>
                  <td>${t.deadline}</td>
                  <td>
                    <select data-st="${t.id}" class="select-filter" style="width: auto;">
                      ${["To do", "In progress", "Done"].map(x => `<option ${x === t.status ? 'selected' : ''}>${x}</option>`).join('')}
                    </select>
                  </td>
                  <td><span class="tag-status ${cls}">${lbl}</span></td>
                  ${adm ? `<td><button class="btn-action-del" data-dt="${t.id}">Delete</button></td>` : ''}
                </tr>
              `;
            }).join('') : '<tr><td colspan="6" style="text-align: center; color: var(--text-light);">No tasks found.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function teamView() {
  const emps = S.users.filter((u) => u.role !== "admin");

  return `
    <div class="full-width-card">
      <h3 style="margin-bottom: 6px;">Create Employee Account</h3>
      <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 18px;">Add team members to enable time tracking and task assignment</p>
      
      <div class="form-grid-3">
        <div class="input-group">
          <label>Full Name</label>
          <input id="en" placeholder="e.g. Alex Morgan">
        </div>
        <div class="input-group">
          <label>Username</label>
          <input id="eu" placeholder="alex.m">
        </div>
        <div class="input-group">
          <label>Password</label>
          <input id="ep" type="text" placeholder="Min 4 characters">
        </div>
        <div class="input-group">
          <label>Work Role</label>
          <select id="et">
            ${TYPES.map(t => `<option>${t}</option>`).join('')}
          </select>
        </div>
      </div>

      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 32px;">
        <button class="btn-primary" id="ae">Register Employee</button>
        <span class="err" id="ee" style="color: var(--accent-red); font-size: 12px;"></span>
      </div>

      <h3>Active Team Directory (${emps.length})</h3>
      <div style="overflow-x: auto;">
        <table class="styled-table">
          <thead>
            <tr>
              <th>Employee Name</th>
              <th>Username</th>
              <th>Role</th>
              <th>Shift Status</th>
              <th>Manage</th>
            </tr>
          </thead>
          <tbody>
            ${emps.length ? emps.map(u => `
              <tr>
                <td style="font-weight: 600;">${esc(u.name)}</td>
                <td style="color: var(--text-muted);">${esc(u.username)}</td>
                <td><span class="growth-badge subtle">${esc(u.workType)}</span></td>
                <td>
                  ${active(u.id) ? '<span class="tag-status done">Clocked In</span>' : '<span class="tag-status" style="background:#f1f5f9; color:#64748b;">Offline</span>'}
                </td>
                <td>
                  <button class="select-filter" data-rp="${u.id}" style="margin-right: 6px;">Reset Password</button>
                  <button class="btn-action-del" data-du="${u.id}">Remove</button>
                </td>
              </tr>
            `).join('') : '<tr><td colspan="5" style="text-align: center; color: var(--text-light);">No employees registered yet.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function trackView(me) {
  const s = active(me.id), b = s && (s.breaks || []).find((x) => !x.e);
  const mine = S.tasks.filter((t) => t.assignee === me.id && t.status !== "Done");

  return `
    <div class="full-width-card" style="max-width: 600px; margin: 0 auto;">
      <h2 style="font-size: 20px; font-weight: 800; margin-bottom: 6px;">Shift Workstation</h2>
      <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 24px;">Track your time, select working task, and take breaks</p>

      ${s ? `
        <div style="background: var(--bg-app); border-radius: var(--radius-lg); padding: 24px; text-align: center; margin-bottom: 20px;">
          <div style="color: var(--text-muted); font-size: 13px; font-weight: 600;">Clocked in as ${esc(s.type)}</div>
          <div style="font-size: 48px; font-weight: 800; color: var(--primary-pine); margin: 8px 0;" id="tm">${dur(worked(s))}</div>
          <div style="color: var(--text-light); font-size: 12px;">Active Task: ${esc(tname(s.taskId))}</div>
        </div>
        <div style="display: flex; gap: 12px;">
          ${b ? '<button class="btn-primary" id="bk" style="flex:1; background:var(--accent-amber);">Resume Work</button>' : '<button class="select-filter" id="bk" style="flex:1;">Take a Break</button>'}
          <button class="btn-action-del" id="co" style="flex:1; padding: 12px; font-size: 14px;">End Shift (Clock Out)</button>
        </div>
      ` : `
        <div class="input-group" style="margin-bottom: 16px;">
          <label>Department / Work Type</label>
          <select id="wt">
            ${TYPES.map(t => `<option ${t === me.workType ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="input-group" style="margin-bottom: 24px;">
          <label>Working on Task (Optional)</label>
          <select id="wk">
            <option value="">– General Work / No specific task –</option>
            ${mine.map(t => `<option value="${t.id}">${esc(t.title)}</option>`).join('')}
          </select>
        </div>
        <button class="btn-primary" id="ci" style="width: 100%; padding: 14px; font-size: 15px;">Start Work Shift</button>
      `}
    </div>
  `;
}

function sheetView(adm, me) {
  const ws = weekStart();
  const rows = (adm ? S.sessions : S.sessions.filter(x => x.uid === me.id && x.start >= ws)).sort((a, b) => b.start - a.start);

  return `
    <div class="full-width-card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <div>
          <h3>${adm ? 'Master Timesheets' : 'My Weekly Timesheet'}</h3>
          <p style="color: var(--text-muted); font-size: 12px;">Records of completed work shifts and break hours</p>
        </div>
        <button class="btn-primary" id="csv">Export CSV</button>
      </div>

      <div style="overflow-x: auto;">
        <table class="styled-table">
          <thead>
            <tr>
              ${adm ? '<th>Employee</th>' : ''}
              <th>Date</th>
              <th>Work Type</th>
              <th>Task</th>
              <th>In</th>
              <th>Out</th>
              <th>Breaks</th>
              <th>Total Hours</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length ? rows.map(x => `
              <tr>
                ${adm ? `<td style="font-weight: 600;">${esc(user(x.uid)?.name || 'Unknown')}</td>` : ''}
                <td>${day(x.start)}</td>
                <td><span class="growth-badge subtle">${esc(x.type)}</span></td>
                <td>${esc(tname(x.taskId))}</td>
                <td>${new Date(x.start).toLocaleTimeString([], { timeStyle: "short" })}</td>
                <td>${x.end ? new Date(x.end).toLocaleTimeString([], { timeStyle: "short" }) : '<span class="tag-status track">Active</span>'}</td>
                <td>${Math.round((x.breaks || []).reduce((a, b) => a + ((b.e || Date.now()) - b.s), 0) / 6e4)} min</td>
                <td style="font-weight: 700;">${hrs(worked(x))} h</td>
              </tr>
            `).join('') : '<tr><td colspan="8" style="text-align: center; color: var(--text-light);">No time entries found.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/* ================= AUTH VIEWS ================= */

function loginView() {
  $("#app").innerHTML = `
    <div class="auth-wrapper">
      <div class="auth-card">
        <div class="auth-brand">
          <div class="brand-badge">T</div>
          <div class="brand-title">TeamClock</div>
        </div>
        <h2>Sign In</h2>
        <p>Enter your credentials to access your dashboard</p>
        <div class="input-group" style="margin-bottom: 14px;">
          <label>Username</label>
          <input id="lu" autocomplete="username">
        </div>
        <div class="input-group" style="margin-bottom: 14px;">
          <label>Password</label>
          <input id="lp" type="password" autocomplete="current-password">
        </div>
        <div id="le" style="color: var(--accent-red); font-size: 12.5px; min-height: 18px;"></div>
        <button class="btn-primary" id="lb">Log In</button>
      </div>
    </div>
  `;

  const go = async () => {
    try {
      await auth("/login", { username: $("#lu").value.trim().toLowerCase(), password: $("#lp").value });
    } catch (e) {
      $("#le").textContent = e.message;
    }
  };
  $("#lb").onclick = go;
  $("#lp").onkeydown = (e) => { if (e.key === "Enter") go(); };
  $("#lu").onkeydown = (e) => { if (e.key === "Enter") go(); };
}

function setupView() {
  $("#app").innerHTML = `
    <div class="auth-wrapper">
      <div class="auth-card">
        <div class="auth-brand">
          <div class="brand-badge">T</div>
          <div class="brand-title">TeamClock</div>
        </div>
        <h2>First-Time Setup</h2>
        <p>Create the initial Project Manager (Admin) account</p>
        <div class="input-group" style="margin-bottom: 14px;">
          <label>Full Name</label>
          <input id="sn" placeholder="e.g. John Doe">
        </div>
        <div class="input-group" style="margin-bottom: 14px;">
          <label>Admin Username</label>
          <input id="su" placeholder="admin">
        </div>
        <div class="input-group" style="margin-bottom: 14px;">
          <label>Password (4+ chars)</label>
          <input id="sp" type="password">
        </div>
        <div id="se" style="color: var(--accent-red); font-size: 12.5px; min-height: 18px;"></div>
        <button class="btn-primary" id="sb">Create Admin Profile</button>
      </div>
    </div>
  `;

  $("#sb").onclick = async () => {
    const n = $("#sn").value.trim(), u = $("#su").value.trim().toLowerCase(), p = $("#sp").value;
    if (!n || !u || p.length < 4) {
      $("#se").textContent = "Fill all fields (password 4+ characters).";
      return;
    }
    try {
      await auth("/setup", { name: n, username: u, password: p });
    } catch (e) {
      $("#se").textContent = e.message;
    }
  };
}

/* ================= CHARTS ================= */

function drawDashboardCharts() {
  // Chart 1: Bar Chart (matching customer habits styling)
  const days = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    return day(d);
  });

  const dailyHours = days.map(d => +hrs(S.sessions.filter(x => day(x.start) === d).reduce((a, b) => a + worked(b), 0)));

  const ctxBar = document.getElementById("barChartDaily");
  if (ctxBar) {
    charts.push(new Chart(ctxBar, {
      type: "bar",
      data: {
        labels: days.map(d => new Date(d).toLocaleDateString([], { weekday: 'short' })),
        datasets: [{
          label: "Hours Logged",
          data: dailyHours,
          backgroundColor: "#073b28",
          hoverBackgroundColor: "#10b981",
          borderRadius: 8,
          barThickness: 28
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { family: 'Plus Jakarta Sans', weight: '600' } } },
          y: { grid: { color: '#f1f5f9' }, ticks: { font: { family: 'Plus Jakarta Sans' } } }
        }
      }
    }));
  }

  // Chart 2: Donut Chart for Sage card
  const ctxDonut = document.getElementById("donutChartRoles");
  if (ctxDonut) {
    const ws = weekStart(), wkS = S.sessions.filter(x => (x.end || Date.now()) >= ws);
    const dataByRole = TYPES.map(t => +hrs(wkS.filter(x => x.type === t).reduce((a, b) => a + worked(b), 0)));

    charts.push(new Chart(ctxDonut, {
      type: "doughnut",
      data: {
        labels: TYPES,
        datasets: [{
          data: dataByRole.every(v => v === 0) ? [1, 1, 1, 1, 1] : dataByRole,
          backgroundColor: ["#073b28", "#10b981", "#34d399", "#065f46", "#6ee7b7"],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "70%",
        plugins: { legend: { display: false } }
      }
    }));
  }
}

/* ================= EVENT BINDINGS ================= */

function bindEvents(me) {
  // Navigation tabs
  document.querySelectorAll("[data-t]").forEach((b) => {
    b.onclick = () => {
      S.tab = b.dataset.t;
      render();
    };
  });

  const on = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };

  // Logout
  on("#out", () => {
    const s = active(S.me);
    if (s && !confirm("You are still clocked in. Log out anyway?")) return;
    logout();
  });

  // Sidebar live widget buttons
  on("#sideBtnClockIn", () => { S.tab = "track"; render(); });
  on("#sideBtnClockOut", async () => {
    const s = active(me.id);
    if (!s) return;
    const br = (s.breaks || []).map((b) => (b.e ? b : { ...b, e: Date.now() }));
    await db.doc("sessions/" + s.id).update({ end: Date.now(), breaks: br });
  });

  // Time tracker screen actions
  on("#ci", async () => {
    await db.doc("sessions/" + uid()).set({
      uid: me.id,
      type: $("#wt").value,
      taskId: $("#wk").value,
      start: Date.now(),
      end: null,
      breaks: []
    });
  });

  on("#co", async () => {
    const s = active(me.id);
    if (!s) return;
    const br = (s.breaks || []).map((b) => (b.e ? b : { ...b, e: Date.now() }));
    await db.doc("sessions/" + s.id).update({ end: Date.now(), breaks: br });
  });

  on("#bk", async () => {
    const s = active(me.id);
    if (!s) return;
    const br = [...(s.breaks || [])], o = br.find((x) => !x.e);
    if (o) o.e = Date.now();
    else br.push({ s: Date.now(), e: null });
    await db.doc("sessions/" + s.id).update({ breaks: br.map((x) => ({ ...x })) });
  });

  // Task actions
  on("#ac", async () => {
    const t = $("#nt").value.trim(), a = $("#na").value, d = $("#nd").value;
    if (!t || !a || !d) {
      $("#te").textContent = "All task fields are required.";
      return;
    }
    await db.doc("tasks/" + uid()).set({ title: t, assignee: a, deadline: d, status: "To do", created: Date.now() });
  });

  document.querySelectorAll("[data-st]").forEach(s => s.onchange = () => db.doc("tasks/" + s.dataset.st).update({ status: s.value }));
  document.querySelectorAll("[data-dt]").forEach(b => b.onclick = () => confirm("Delete task?") && db.doc("tasks/" + b.dataset.dt).delete());

  // Employee creation & actions
  on("#ae", async () => {
    const n = $("#en").value.trim(), u = $("#eu").value.trim().toLowerCase(), p = $("#ep").value;
    if (!n || !u || p.length < 4) {
      $("#ee").textContent = "Fill all fields (password 4+ chars).";
      return;
    }
    if (S.users.some(x => x.username === u)) {
      $("#ee").textContent = "Username already exists.";
      return;
    }
    await db.doc("users/" + uid()).set({ name: n, username: u, password: p, role: "employee", workType: $("#et").value });
    alert(`Employee created!\nUsername: ${u}\nPassword: ${p}`);
  });

  document.querySelectorAll("[data-rp]").forEach(b => b.onclick = async () => {
    const p = prompt("New password (4+ chars):");
    if (!p || p.length < 4) return;
    await db.doc("users/" + b.dataset.rp).update({ password: p });
    alert("Password updated!");
  });
  document.querySelectorAll("[data-du]").forEach(b => b.onclick = () => confirm("Remove employee?") && db.doc("users/" + b.dataset.du).delete());

  // Export CSV
  on("#csv", () => {
    const adm = me.role === "admin";
    const rows = (adm ? S.sessions : S.sessions.filter(x => x.uid === me.id && x.start >= weekStart())).sort((a, b) => b.start - a.start);
    const q = v => '"' + String(v ?? "").replace(/"/g, '""') + '"';
    const csv = [
      "Employee,Date,Work type,Task,Clock in,Clock out,Break minutes,Hours",
      ...rows.map(x => [
        user(x.uid)?.name,
        day(x.start),
        x.type,
        tname(x.taskId),
        new Date(x.start).toLocaleTimeString(),
        x.end ? new Date(x.end).toLocaleTimeString() : 'Active',
        Math.round((x.breaks || []).reduce((a, b) => a + ((b.e || Date.now()) - b.s), 0) / 6e4),
        hrs(worked(x))
      ].map(q).join(","))
    ].join("\n");

    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "teamclock_report.csv";
    a.click();
  });
}

init();