import { S, EMPLOYEE_ROLES, TASK_TYPES, TYPES } from "./state.js";
import { esc, user, tname, active, dur, hrs, worked, day, weekStart, tstate, getFormattedDate } from "./utils.js";

export function getPageTitle(tab) {
  switch (tab) {
    case "dashboard": return "Productivity Report";
    case "tasks": return "Tasks & Deadlines";
    case "track": return "Time Tracker";
    case "sheet": return "Weekly Timesheets";
    case "team": return "Team Directory";
    default: return "Overview";
  }
}

export function layoutView(me, currentContent) {
  const adm = me.role === "admin";
  const s = active(me.id);

  return `
    <div class="dashboard-layout">
      <aside class="sidebar">
        <div>
          <div class="brand-wrapper">
            <div class="brand-badge">T</div>
            <div class="brand-title">TeamClock</div>
          </div>

          <div class="nav-section-label">Menu</div>
          <ul class="nav-menu">
            <li class="nav-item">
              <button data-t="dashboard" class="${S.tab === "dashboard" ? "active" : ""}">
                <svg viewBox="0 0 24 24"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
                <span>Dashboard</span>
              </button>
            </li>
            <li class="nav-item">
              <button data-t="tasks" class="${S.tab === "tasks" ? "active" : ""}">
                <svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                <span>Tasks &amp; Deadlines</span>
              </button>
            </li>
            <li class="nav-item">
              <button data-t="track" class="${S.tab === "track" ? "active" : ""}">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span>Time Tracker</span>
              </button>
            </li>
            <li class="nav-item">
              <button data-t="sheet" class="${S.tab === "sheet" ? "active" : ""}">
                <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                <span>Timesheets</span>
              </button>
            </li>
          </ul>

          ${adm ? `
            <div class="nav-section-label">Management</div>
            <ul class="nav-menu">
              <li class="nav-item">
                <button data-t="team" class="${S.tab === "team" ? "active" : ""}">
                  <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  <span>Team Members</span>
                </button>
              </li>
            </ul>
          ` : ""}
        </div>

        <div class="sidebar-live-widget">
          <div class="widget-status">
            <span class="pulse-dot ${s ? "" : "offline"}"></span>
            <span>${s ? "Current Shift Active" : "Currently Offline"}</span>
          </div>
          <div class="timer-digits" id="sidebarTimer">${s ? dur(worked(s)) : "00:00:00"}</div>
          ${s
            ? `<button class="btn-sidebar-clock btn-out" id="sideBtnClockOut">Clock Out</button>`
            : `<button class="btn-sidebar-clock" id="sideBtnClockIn">Start Shift</button>`
          }
        </div>
      </aside>

      <main class="main-wrapper">
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
                <div class="user-role">${adm ? "Admin Officer" : esc(me.workType || "Employee")}</div>
              </div>
              <button class="btn-logout" id="out" title="Logout">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              </button>
            </div>
          </div>
        </header>

        ${currentContent}
      </main>
    </div>
  `;
}

export function dashboardView() {
  const ws = weekStart(),
    wkS = S.sessions.filter((x) => (x.end || Date.now()) >= ws);
  const totalHours = wkS.reduce((a, x) => a + worked(x), 0);
  const clockedInCount = S.sessions.filter((x) => !x.end).length;
  const doneTasks = S.tasks.filter((t) => t.status === "Done").length;
  const overdueTasks = S.tasks.filter((t) => tstate(t)[1] === "over").length;
  const activeWorkers = S.sessions.filter((x) => !x.end);
  const categories = TASK_TYPES || TYPES;

  return `
    <div class="dashboard-grid">
      <div class="grid-col-main">
        <div class="kpi-matrix">
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

          <div class="kpi-card">
            <div class="kpi-header">
              <div class="kpi-icon-pill">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <span class="growth-badge positive">${S.tasks.length ? Math.round((doneTasks / S.tasks.length) * 100) : 0}%</span>
            </div>
            <div>
              <div class="kpi-label">Tasks Completed</div>
              <div class="kpi-value-row">
                <span class="kpi-big-number">${doneTasks}</span>
                <span class="kpi-caption">Of ${S.tasks.length} total tasks</span>
              </div>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-header">
              <div class="kpi-icon-pill">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <span class="growth-badge ${overdueTasks ? "negative" : "subtle"}">${overdueTasks} Overdue</span>
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

      <div class="grid-col-side">
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
            ${categories.map((type) => {
              const count = Math.round(wkS.filter((x) => x.type === type).reduce((a, b) => a + worked(b), 0) / 36e5);
              return `
                <div class="side-breakdown-item">
                  <span>${esc(type)}</span>
                  <span class="badge-stat">${count} hrs</span>
                </div>
              `;
            }).join("")}
          </div>
        </div>

        <div class="active-workers-card">
          <h3>Team Clocked In</h3>
          <p style="color: var(--text-muted); font-size: 12px; margin-top: 2px;">Real-time active shifts</p>
          <div class="worker-pill-list">
            ${
              activeWorkers.length
                ? activeWorkers
                    .map(
                      (w) => `
                <div class="worker-item-row">
                  <div class="worker-info-meta">
                    <span class="status-indicator"></span>
                    <div>
                      <div class="worker-name">${esc(user(w.uid)?.name || "Unknown")}</div>
                      <div class="worker-role">${esc(w.type)}</div>
                    </div>
                  </div>
                  <span class="tag-status track">${dur(worked(w))}</span>
                </div>
              `
                    )
                    .join("")
                : '<p style="color: var(--text-light); font-size: 12px; margin-top: 10px;">Nobody is currently clocked in.</p>'
            }
          </div>
        </div>
      </div>
    </div>
  `;
}

export function tasksView(adm) {
  const emps = S.users.filter((u) => u.role !== "admin");
  const ts = [...S.tasks].sort((a, b) => a.deadline.localeCompare(b.deadline));
  const categories = TASK_TYPES || TYPES;

  const getStatusClass = (status) => {
    if (status === "Done") return "done";
    if (status === "In progress") return "progress";
    return "todo";
  };

  return `
    <div class="full-width-card">
      ${
        adm
          ? `
        <h3 style="margin-bottom: 6px;">Assign New Task</h3>
        <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 18px;">Set task title, category, assignee, and deadline</p>
        <div class="form-grid-3">
          <div class="input-group">
            <label>Task Title</label>
            <input id="nt" placeholder="e.g. Implement user authentication flow">
          </div>
          <div class="input-group">
            <label>Task Category</label>
            <select id="ntype">
              ${categories.map((t) => `<option value="${t}">${t}</option>`).join("")}
            </select>
          </div>
          <div class="input-group">
            <label>Assignee</label>
            <select id="na">
              ${emps.map((u) => `<option value="${u.id}">${esc(u.name)} (${esc(u.workType || "Employee")})</option>`).join("")}
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
      `
          : ""
      }

      <h3>All Tasks (${ts.length})</h3>
      <div style="overflow-x: auto;">
        <table class="styled-table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Category</th>
              <th>Assignee</th>
              <th>Deadline</th>
              <th>Status</th>
              <th>State</th>
              ${adm ? "<th>Action</th>" : ""}
            </tr>
          </thead>
          <tbody>
            ${
              ts.length
                ? ts
                    .map((t) => {
                      const [lbl, cls] = tstate(t);
                      const currentClass = getStatusClass(t.status);
                      return `
                  <tr>
                    <td style="font-weight: 600;">${esc(t.title)}</td>
                    <td><span class="growth-badge subtle">${esc(t.type || "General")}</span></td>
                    <td>${esc(user(t.assignee)?.name || "Unassigned")}</td>
                    <td>${t.deadline}</td>
                    <td>
                      <div class="status-dropdown" data-task-id="${t.id}">
                        <button type="button" class="status-dropdown-trigger status-trigger-${currentClass}">
                          <span class="status-dot"></span>
                          <span class="status-label-text">${esc(t.status)}</span>
                          <svg class="status-chevron" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
                        </button>
                        <div class="status-dropdown-menu">
                          ${["To do", "In progress", "Done"]
                            .map((opt) => {
                              const optClass = getStatusClass(opt);
                              const isSelected = opt === t.status;
                              return `
                                <button type="button" class="status-option-btn ${isSelected ? "selected" : ""}" data-status-val="${opt}">
                                  <span class="status-dot status-trigger-${optClass}"></span>
                                  <span>${opt}</span>
                                  ${
                                    isSelected
                                      ? `<svg class="check-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`
                                      : ""
                                  }
                                </button>
                              `;
                            })
                            .join("")}
                        </div>
                      </div>
                    </td>
                    <td><span class="tag-status ${cls}">${lbl}</span></td>${adm ? `<td><button class="btn-action-del" data-dt="${t.id}">Delete</button></td>` : ""}
                  </tr>
                `;
                    })
                    .join("")
                : '<tr><td colspan="7" style="text-align: center; color: var(--text-light);">No tasks found.</td></tr>'
            }
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function teamView() {
  const emps = S.users.filter((u) => u.role !== "admin");
  const availableRoles = EMPLOYEE_ROLES;

  return `
    <div class="full-width-card">
      <h3 style="margin-bottom: 6px;">Create Employee Account</h3>
      <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 18px;">Add team members and assign one or multiple roles</p>
      
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
      </div>

      <div class="input-group" style="margin-bottom: 20px;">
        <label>Assigned Roles (Click to select multiple)</label>
        <div class="role-selector-group">
          ${availableRoles.map(
            (role) => `
            <label class="role-checkbox-pill">
              <input type="checkbox" name="empRole" value="${esc(role)}">
              <span class="role-pill-content">
                <svg class="check-svg" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                ${esc(role)}
              </span>
            </label>
          `
          ).join("")}
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
              <th>Assigned Roles</th>
              <th>Shift Status</th>
              <th>Manage</th>
            </tr>
          </thead>
          <tbody>
            ${
              emps.length
                ? emps
                    .map((u) => {
                      const userRoles = u.roles && u.roles.length ? u.roles : (u.workType ? u.workType.split(",").map(r => r.trim()) : []);
                      return `
                <tr>
                  <td style="font-weight: 600;">${esc(u.name)}</td>
                  <td style="color: var(--text-muted);">${esc(u.username)}</td>
                  <td>
                    <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                      ${userRoles.map(r => `<span class="growth-badge subtle">${esc(r)}</span>`).join("")}
                    </div>
                  </td>
                  <td>
                    ${
                      active(u.id)
                        ? '<span class="tag-status done">Clocked In</span>'
                        : '<span class="tag-status" style="background:#f1f5f9; color:#64748b;">Offline</span>'
                    }
                  </td>
                  <td>
                    <button class="select-filter" data-edit-emp="${u.id}" style="margin-right: 6px;">Edit</button>
                    <button class="select-filter" data-rp="${u.id}" style="margin-right: 6px;">Reset Password</button>
                    <button class="btn-action-del" data-du="${u.id}">Remove</button>
                  </td>
                </tr>
              `;
                    })
                    .join("")
                : '<tr><td colspan="5" style="text-align: center; color: var(--text-light);">No employees registered yet.</td></tr>'
            }
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function trackView(me) {
  const s = active(me.id),
    b = s && (s.breaks || []).find((x) => !x.e);
  const mine = S.tasks.filter((t) => t.assignee === me.id && t.status !== "Done");
  const categories = TASK_TYPES || TYPES;

  return `
    <div class="full-width-card" style="max-width: 600px; margin: 0 auto;">
      <h2 style="font-size: 20px; font-weight: 800; margin-bottom: 6px;">Shift Workstation</h2>
      <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 24px;">Track your time, select working task, and take breaks</p>

      ${
        s
          ? `
        <div style="background: var(--bg-app); border-radius: var(--radius-lg); padding: 24px; text-align: center; margin-bottom: 20px;">
          <div style="color: var(--text-muted); font-size: 13px; font-weight: 600;">Clocked in as ${esc(s.type)}</div>
          <div style="font-size: 48px; font-weight: 800; color: var(--primary-pine); margin: 8px 0;" id="tm">${dur(worked(s))}</div>
          <div style="color: var(--text-light); font-size: 12px;">Active Task: ${esc(tname(s.taskId))}</div>
        </div>
        <div style="display: flex; gap: 12px;">
          ${
            b
              ? '<button class="btn-primary" id="bk" style="flex:1; background:var(--accent-amber);">Resume Work</button>'
              : '<button class="select-filter" id="bk" style="flex:1;">Take a Break</button>'
          }
          <button class="btn-action-del" id="co" style="flex:1; padding: 12px; font-size: 14px;">End Shift (Clock Out)</button>
        </div>
      `
          : `
        <div class="input-group" style="margin-bottom: 16px;">
          <label>Work Type / Category</label>
          <select id="wt">
            ${categories.map((t) => `<option value="${t}">${t}</option>`).join("")}
          </select>
        </div>
        <div class="input-group" style="margin-bottom: 24px;">
          <label>Working on Task (Optional)</label>
          <select id="wk">
            <option value="">– General Work / No specific task –</option>
            ${mine.map((t) => `<option value="${t.id}">${esc(t.title)}</option>`).join("")}
          </select>
        </div>
        <button class="btn-primary" id="ci" style="width: 100%; padding: 14px; font-size: 15px;">Start Work Shift</button>
      `
      }
    </div>
  `;
}

export function sheetView(adm, me) {
  const ws = weekStart();
  const rows = (adm ? S.sessions : S.sessions.filter((x) => x.uid === me.id && x.start >= ws)).sort(
    (a, b) => b.start - a.start
  );

  return `
    <div class="full-width-card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <div>
          <h3>${adm ? "Master Timesheets" : "My Weekly Timesheet"}</h3>
          <p style="color: var(--text-muted); font-size: 12px;">Records of completed work shifts and break hours</p>
        </div>
        <button class="btn-primary" id="csv">Export CSV</button>
      </div>

      <div style="overflow-x: auto;">
        <table class="styled-table">
          <thead>
            <tr>
              ${adm ? "<th>Employee</th>" : ""}
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
            ${
              rows.length
                ? rows
                    .map(
                      (x) => `
                <tr>
                  ${adm ? `<td style="font-weight: 600;">${esc(user(x.uid)?.name || "Unknown")}</td>` : ""}
                  <td>${day(x.start)}</td>
                  <td><span class="growth-badge subtle">${esc(x.type)}</span></td>
                  <td>${esc(tname(x.taskId))}</td>
                  <td>${new Date(x.start).toLocaleTimeString([], { timeStyle: "short" })}</td>
                  <td>${x.end ? new Date(x.end).toLocaleTimeString([], { timeStyle: "short" }) : '<span class="tag-status track">Active</span>'}</td>
                  <td>${Math.round((x.breaks || []).reduce((a, b) => a + ((b.e || Date.now()) - b.s), 0) / 6e4)} min</td>
                  <td style="font-weight: 700;">${hrs(worked(x))} h</td>
                </tr>
              `
                    )
                    .join("")
                : '<tr><td colspan="8" style="text-align: center; color: var(--text-light);">No time entries found.</td></tr>'
            }
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function loginView() {
  return `
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
}

export function setupView() {
  return `
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
}