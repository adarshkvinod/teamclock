import { S, EMPLOYEE_ROLES, TASK_TYPES, TYPES } from "./state.js";
import { esc, user, tname, active, dur, hrs, worked, day, weekStart, tstate, getFormattedDate, cur, pTasks, pSessions, pname, pcolor, projectMembers } from "./utils.js";

export function getPageTitle(tab) {
  switch (tab) {
    case "projects": return "Projects";
    case "dashboard": return "Productivity Report";
    case "tasks": return "Tasks & Deadlines";
    case "track": return "Time Tracker";
    case "sheet": return S.projectId ? "Weekly Timesheets" : "All Timesheets";
    case "members": return "Project Members";
    case "team": return "Team Directory";
    default: return "Overview";
  }
}

const ICONS = {
  projects: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  dashboard: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
  tasks: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  track: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  sheet: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  members: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  back: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>'
};

const navItem = (tab, label, icon = tab) => `
  <li class="nav-item">
    <button data-t="${tab}" class="${S.tab === tab ? "active" : ""}">
      <svg viewBox="0 0 24 24">${ICONS[icon]}</svg>
      <span>${label}</span>
    </button>
  </li>`;

export function avatarStack(users, max = 4) {
  const extra = users.length - max;
  return `
    <div class="avatar-stack">
      ${users.slice(0, max).map((u) => `<span class="mini-avatar" title="${esc(u.name)}">${esc(u.name.charAt(0).toUpperCase())}</span>`).join("")}
      ${extra > 0 ? `<span class="mini-avatar more">+${extra}</span>` : ""}
    </div>`;
}

export function layoutView(me, currentContent) {
  const adm = me.role === "admin";
  const s = active(me.id);
  const p = cur();

  const menu = p
    ? `
      <div class="project-switcher">
        <button type="button" class="btn-all-projects" id="btnAllProjects" title="Back to all projects">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${ICONS.back}</svg>
          <span>All Projects</span>
        </button>
        <div class="project-switcher-current">
          <div class="project-avatar sm" style="background:${pcolor(p.id)}">${esc(p.name.charAt(0).toUpperCase())}</div>
          <div class="project-switcher-text">
            <div class="ps-name">${esc(p.name)}</div>
            <div class="ps-sub">${p.status === "archived" ? "Archived" : "Active"} · ${projectMembers(p).length} members</div>
          </div>
        </div>
      </div>

      <div class="nav-section-label">Project</div>
      <ul class="nav-menu">
        ${navItem("dashboard", "Dashboard")}
        ${navItem("tasks", "Tasks &amp; Deadlines")}
        ${navItem("track", "Time Tracker")}
        ${navItem("sheet", "Timesheets")}
        ${navItem("members", "Members")}
      </ul>`
    : `
      <div class="nav-section-label">Menu</div>
      <ul class="nav-menu">
        ${navItem("projects", "Projects")}
        ${navItem("sheet", "All Timesheets")}
      </ul>`;

  return `
    <div class="dashboard-layout">
      <aside class="sidebar">
        <div>
          <div class="brand-wrapper">
            <div class="brand-badge">T</div>
            <div class="brand-title">TeamClock</div>
          </div>

          ${menu}

          ${adm ? `
            <div class="nav-section-label">Management</div>
            <ul class="nav-menu">
              ${navItem("team", "Team Members", "members")}
            </ul>
          ` : ""}
        </div>

        <div class="sidebar-live-widget">
          <div class="widget-status">
            <span class="pulse-dot ${s ? "" : "offline"}"></span>
            <span>${s ? "Current Shift Active" : "Currently Offline"}</span>
          </div>
          <div class="timer-digits" id="sidebarTimer">${s ? dur(worked(s)) : "00:00:00"}</div>
          ${s ? `<div class="widget-project">${esc(pname(s.projectId))}</div>` : ""}
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
            <p>${p ? `<strong>${esc(p.name)}</strong> · ` : ""}${getFormattedDate()}</p>
          </div>
          <div class="topbar-actions">
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

function projectBanner(p) {
  if (!p) return "";
  const members = projectMembers(p);
  const dates = p.start || p.end ? `${p.start || "…"} → ${p.end || "…"}` : "";
  return `
    <div class="project-banner">
      <div class="project-avatar" style="background:${pcolor(p.id)}">${esc(p.name.charAt(0).toUpperCase())}</div>
      <div class="project-banner-main">
        <div class="project-banner-title">
          <h2>${esc(p.name)}</h2>
          <span class="tag-status ${p.status === "archived" ? "soon" : "done"}">${p.status === "archived" ? "Archived" : "Active"}</span>
        </div>
        ${p.description ? `<p>${esc(p.description)}</p>` : ""}
        <div class="project-banner-meta">
          ${dates ? `<span>${esc(dates)}</span>` : ""}
          <span>${members.length} member${members.length === 1 ? "" : "s"}</span>
        </div>
      </div>
      ${avatarStack(members, 5)}
    </div>`;
}

export function dashboardView(me) {
  const adm = me?.role === "admin";
  const ws = weekStart();

  const projectSessions = pSessions();
  const projectTasks = pTasks();

  const relevantSessions = adm
    ? projectSessions
    : projectSessions.filter((x) => x.uid === me?.id);

  const relevantTasks = adm
    ? projectTasks
    : projectTasks.filter((t) => t.assignee === me?.id);

  const wkS = relevantSessions.filter((x) => (x.end || Date.now()) >= ws);
  const totalHours = wkS.reduce((a, x) => a + worked(x), 0);

  const doneTasks = relevantTasks.filter((t) => t.status === "Done").length;
  const overdueTasks = relevantTasks.filter((t) => tstate(t)[1] === "over").length;
  const categories = TASK_TYPES || TYPES;

  const activeWorkers = projectSessions.filter((x) => !x.end);
  const clockedInCount = activeWorkers.length;

  const myActiveSession = active(me?.id);
  const isClockedIn = Boolean(myActiveSession);
  const myPendingTasks = relevantTasks.filter((t) => t.status !== "Done");

  return `
    ${projectBanner(cur())}
    <div class="dashboard-grid">
      <div class="grid-col-main">
        <div class="kpi-matrix">
          <div class="kpi-card kpi-card-pine">
            <div class="kpi-header">
              <div class="kpi-icon-pill">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <span class="growth-badge positive">${adm ? "+14.2%" : "This Week"}</span>
            </div>
            <div>
              <div class="kpi-label">${adm ? "Total Team Working Hours" : "My Working Hours"}</div>
              <div class="kpi-value-row">
                <span class="kpi-big-number">${hrs(totalHours)} h</span>
                <span class="kpi-caption">${adm ? "Across all employees" : "Logged this week"}</span>
              </div>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-header">
              <div class="kpi-icon-pill">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
              </div>
              <span class="growth-badge ${adm ? "subtle" : isClockedIn ? "positive" : "subtle"}">
                ${adm ? "Live" : isClockedIn ? "Active" : "Offline"}
              </span>
            </div>
            <div>
              <div class="kpi-label">${adm ? "Clocked In Now" : "Current Shift Status"}</div>
              <div class="kpi-value-row">
                <span class="kpi-big-number" style="${!adm ? "font-size: 22px;" : ""}">
                  ${adm ? clockedInCount : isClockedIn ? "Clocked In" : "Offline"}
                </span>
                <span class="kpi-caption">
                  ${adm ? "Active team members" : isClockedIn ? dur(worked(myActiveSession)) : "Ready to start shift"}
                </span>
              </div>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-header">
              <div class="kpi-icon-pill">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <span class="growth-badge positive">
                ${relevantTasks.length ? Math.round((doneTasks / relevantTasks.length) * 100) : 0}%
              </span>
            </div>
            <div>
              <div class="kpi-label">${adm ? "Tasks Completed" : "My Completed Tasks"}</div>
              <div class="kpi-value-row">
                <span class="kpi-big-number">${doneTasks}</span>
                <span class="kpi-caption">Of ${relevantTasks.length} ${adm ? "total tasks" : "assigned to me"}</span>
              </div>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-header">
              <div class="kpi-icon-pill">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <span class="growth-badge ${overdueTasks ? "negative" : "subtle"}">
                ${overdueTasks} Overdue
              </span>
            </div>
            <div>
              <div class="kpi-label">${adm ? "Pending Deadlines" : "My Overdue Tasks"}</div>
              <div class="kpi-value-row">
                <span class="kpi-big-number">${overdueTasks}</span>
                <span class="kpi-caption">${overdueTasks ? "Requires action" : "All tasks on track"}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="chart-card">
          <div class="card-header-row">
            <div>
              <h3>${adm ? "Team Working Hours Activity" : "My Working Hours Activity"}</h3>
              <p id="chartRangeSubtitle">${adm ? "Daily team hours logged across the last 7 days" : "Your daily hours logged across the last 7 days"}</p>
            </div>
            <div class="chart-filter-dropdown" id="chartFilterDropdown">
              <button type="button" class="chart-filter-btn" id="chartFilterBtn">
                <span id="chartFilterLabel">Last 7 days</span>
                <svg class="chart-filter-chevron" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <div class="chart-filter-menu">
                <button type="button" class="chart-filter-opt active" data-days="7">
                  <span>Last 7 days</span>
                  <svg class="opt-check" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                </button>
                <button type="button" class="chart-filter-opt" data-days="14">
                  <span>Last 14 days</span>
                </button>
                <button type="button" class="chart-filter-opt" data-days="30">
                  <span>Last 30 days</span>
                </button>
              </div>
            </div>
          </div>
          <div class="chart-canvas-wrap">
            <canvas id="barChartDaily"></canvas>
          </div>
        </div>
      </div>

      <div class="grid-col-side">
        <div class="sage-summary-card">
          <div>
            <div class="card-header-row" style="margin-bottom: 8px;">
              <div>
                <h3>${adm ? "Role Statistics" : "My Work Focus"}</h3>
                <p>${adm ? "Hours logged by category (Team)" : "Your hours logged by category"}</p>
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
          ${adm ? `
            <div class="card-header-row" style="margin-bottom: 12px;">
              <div>
                <h3>Team Clocked In</h3>
                <p style="color: var(--text-muted); font-size: 12px; margin-top: 2px;">Real-time active shifts</p>
              </div>
              <span class="growth-badge subtle">${activeWorkers.length} Active</span>
            </div>
            <div class="worker-pill-list">
              ${activeWorkers.length
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
                        <span class="tag-status track" data-worker-timer="${w.id || w._id}">${dur(worked(w))}</span>
                      </div>
                    `
                  )
                  .join("")
                : `
                  <div class="my-tasks-empty">
                    <div class="empty-state-badge">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                      </svg>
                    </div>
                    <h4>Nobody Clocked In</h4>
                    <p>No team members are currently on shift.</p>
                  </div>
                `
              }
            </div>
          ` : `
            <div class="card-header-row" style="margin-bottom: 12px;">
              <div>
                <h3>My Active Tasks</h3>
                <p style="color: var(--text-muted); font-size: 12px; margin-top: 2px;">Tasks awaiting completion</p>
              </div>
              <span class="growth-badge ${myPendingTasks.length ? "subtle" : "positive"}">
                ${myPendingTasks.length ? `${myPendingTasks.length} Pending` : "All Done"}
              </span>
            </div>

            <div class="my-tasks-container">
              ${myPendingTasks.length
                ? `
                  <div class="my-tasks-list">
                    ${myPendingTasks.slice(0, 4).map((t) => {
                      const [lbl, cls] = tstate(t);
                      const isProgress = t.status === "In progress";
                      return `
                        <div class="my-task-card ${isProgress ? "is-in-progress" : ""}">
                          <div class="my-task-header">
                            <span class="my-task-title">${esc(t.title)}</span>
                            <span class="tag-status ${cls}">${lbl}</span>
                          </div>
                          <div class="my-task-meta-row">
                            <span class="meta-pill meta-type">
                              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                              ${esc(t.type || "General")}
                            </span>
                            <span class="meta-pill meta-deadline">
                              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                              ${t.deadline}
                            </span>
                          </div>
                        </div>
                      `;
                    }).join("")}
                  </div>
                  <div class="my-tasks-footer">
                    <button type="button" class="btn-view-all-tasks" data-t="tasks">
                      <span>Go to Tasks &amp; Deadlines</span>
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                  </div>
                `
                : `
                  <div class="my-tasks-empty">
                    <div class="empty-state-badge">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </div>
                    <h4>No Pending Tasks</h4>
                    <p>You are all caught up with your deadlines.</p>
                  </div>
                `
              }
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}

export function tasksView(adm, me) {
  const project = cur();
  const archived = project?.status === "archived";
  const emps = projectMembers(project); // only people on this project can be assigned
  const allTasks = pTasks();
  
  // Scoped to current employee (or all for admin)
  const ts = (adm ? allTasks : allTasks.filter((t) => t.assignee === me?.id)).sort(
    (a, b) => a.deadline.localeCompare(b.deadline)
  );
  
  const categories = TASK_TYPES || TYPES;
  const defaultCategory = categories[0] || "Mobile App Development";
  const defaultEmpId = emps.length ? emps[0].id : "";
  const defaultEmpLabel = emps.length
    ? `${emps[0].name} (${emps[0].workType || "Employee"})`
    : "Select Assignee...";

  if (!S.taskViewMode) S.taskViewMode = "kanban";
  const isKanban = S.taskViewMode === "kanban";

  const getStatusClass = (status) => {
    if (status === "Done") return "done";
    if (status === "In progress") return "progress";
    return "todo";
  };

  const columns = [
    { title: "To Do", key: "To do", dotColor: "#64748b" },
    { title: "In Progress", key: "In progress", dotColor: "#0ea5e9" },
    { title: "Done", key: "Done", dotColor: "#10b981" }
  ];

  return `
    <div class="full-width-card">
      ${archived ? `
        <div class="project-notice">This project is archived. New tasks can't be created, but you can still review everything.</div>
      ` : ""}
      ${adm && !archived ? `
        <h3 style="margin-bottom: 6px;">Assign New Task</h3>
        <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 18px;">Set task title, category, assignee, and deadline for <strong>${esc(project?.name || "this project")}</strong></p>
        
        <div class="form-grid-3">
          <div class="input-group">
            <label>Task Title</label>
            <input id="nt" placeholder="e.g. Implement user authentication flow">
          </div>

          <div class="input-group">
            <label>Task Category</label>
            <div class="custom-select-wrap">
              <input type="hidden" id="ntype" value="${esc(defaultCategory)}">
              <button type="button" class="custom-select-trigger">
                <span class="custom-select-label">${esc(defaultCategory)}</span>
                <svg class="custom-select-chevron" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <div class="custom-select-menu">
                ${categories.map((t, idx) => `
                  <button type="button" class="custom-select-opt ${idx === 0 ? "selected" : ""}" data-val="${esc(t)}">
                    <span>${esc(t)}</span>${idx === 0 ? `<svg class="opt-check" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>` : ""}
                  </button>
                `).join("")}
              </div>
            </div>
          </div>

          <div class="input-group">
            <label>Assignee</label>
            <div class="custom-select-wrap">
              <input type="hidden" id="na" value="${esc(defaultEmpId)}">
              <button type="button" class="custom-select-trigger">
                <span class="custom-select-label">${esc(defaultEmpLabel)}</span>
                <svg class="custom-select-chevron" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <div class="custom-select-menu">
                ${emps.length ? emps.map((u, idx) => {
                  const isSel = idx === 0;
                  const label = `${u.name} (${u.workType || "Employee"})`;
                  return `
                    <button type="button" class="custom-select-opt ${isSel ? "selected" : ""}" data-val="${esc(u.id)}">
                      <span>${esc(label)}</span>${isSel ? `<svg class="opt-check" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>` : ""}
                    </button>
                  `;
                }).join("") : `<div class="custom-select-empty">No employees in this project yet. Add members in the Members tab.</div>`}
              </div>
            </div>
          </div>

          <div class="input-group">
            <label>Deadline</label>
            <div class="custom-datepicker-wrap" id="deadlinePickerWrap">
              <input type="hidden" id="nd" value="${day(Date.now())}">
              <button type="button" class="custom-datepicker-trigger" id="deadlinePickerBtn">
                <span class="custom-datepicker-label" id="ndLabel">${day(Date.now())}</span>
                <svg class="custom-datepicker-icon" viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
              </button>
              <div class="custom-datepicker-menu" id="deadlinePickerMenu"></div>
            </div>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 28px;">
          <button class="btn-primary" id="ac">Create Task</button>
          <span class="err" id="te" style="color: var(--accent-red); font-size: 12px;"></span>
        </div>
      ` : ""}

      <div class="tasks-header-bar">
        <div>
          <h3>${adm ? "Team Tasks & Deadlines" : "My Assigned Tasks"} (${ts.length})</h3>
          <p style="color: var(--text-muted); font-size: 13px; margin-top: 2px;">
            ${adm ? "Manage, track, and update all team task states" : "Drag or move your assigned tasks across workflow stages"}
          </p>
        </div>
        <div class="view-switcher-pill">
          <button type="button" class="btn-view-mode ${isKanban ? "active" : ""}" data-view-mode="kanban">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2"><rect width="6" height="18" x="3" y="3" rx="1"/><rect width="6" height="12" x="15" y="3" rx="1"/></svg>
            <span>Kanban Board</span>
          </button>
          <button type="button" class="btn-view-mode ${!isKanban ? "active" : ""}" data-view-mode="table">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 3h18v18H3zM3 9h18M3 15h18M9 3v18"/></svg>
            <span>Table View</span>
          </button>
        </div>
      </div>

      ${isKanban ? `
        <!-- ================= KANBAN BOARD ================= -->
        <div class="kanban-board">
          ${columns.map((col) => {
            const colTasks = ts.filter((t) => (t.status || "To do") === col.key);
            return `
              <div class="kanban-column" data-col-status="${col.key}">
                <div class="kanban-column-header">
                  <div class="kanban-column-title">
                    <span class="status-dot" style="background: ${col.dotColor};"></span>
                    <span>${col.title}</span>
                  </div>
                  <span class="kanban-count-badge">${colTasks.length}</span>
                </div>

                <div class="kanban-column-body" data-status-col="${col.key}">
                  ${colTasks.length ? colTasks.map((t) => {
                    const [lbl, cls] = tstate(t);
                    return `
                      <div class="kanban-card" data-task-id="${t.id}">
                        <div class="kanban-card-top">
                          <span class="growth-badge subtle">${esc(t.type || "General")}</span>
                          <span class="tag-status ${cls}">${lbl}</span>
                        </div>

                        <div class="kanban-card-title">${esc(t.title)}</div>

                        <div class="kanban-card-meta">
                          <div class="meta-pill meta-deadline">
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                            ${t.deadline}
                          </div>
                          ${adm ? `
                            <div class="meta-pill meta-assignee" title="Assignee">
                              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                              ${esc(user(t.assignee)?.name || "Unassigned")}
                            </div>
                          ` : ""}
                        </div>

                        <div class="kanban-card-footer">
                          <div class="kanban-quick-actions">
                            ${col.key !== "To do" ? `
                              <button type="button" class="btn-kanban-shift" data-move-task="${t.id}" data-move-to="To do" title="Move to To do">
                                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                                <span>To do</span>
                              </button>
                            ` : ""}
                            ${col.key !== "In progress" ? `
                              <button type="button" class="btn-kanban-shift" data-move-task="${t.id}" data-move-to="In progress" title="Move to In progress">
                                <span>In progress</span>
                              </button>
                            ` : ""}
                            ${col.key !== "Done" ? `
                              <button type="button" class="btn-kanban-shift" data-move-task="${t.id}" data-move-to="Done" title="Move to Done">
                                <span>Done</span>
                                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                              </button>
                            ` : ""}
                          </div>
                          ${adm ? `
                            <button class="btn-action-del-card" data-dt="${t.id}" title="Delete Task">
                              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                          ` : ""}
                        </div>
                      </div>
                    `;
                  }).join("") : `
                    <div class="kanban-column-empty">
                      <span>No tasks in ${col.title.toLowerCase()}</span>
                    </div>
                  `}
                </div>
              </div>
            `;
          }).join("")}
        </div>
      ` : `
        <!-- ================= TABLE VIEW ================= -->
        <div style="overflow-x: auto; margin-top: 14px;">
          <table class="styled-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Category</th>
                ${adm ? "<th>Assignee</th>" : ""}
                <th>Deadline</th>
                <th>Status</th>
                <th>State</th>
                ${adm ? "<th>Action</th>" : ""}
              </tr>
            </thead>
            <tbody>
              ${ts.length ? ts.map((t) => {
                const [lbl, cls] = tstate(t);
                const currentClass = getStatusClass(t.status);
                return `
                  <tr>
                    <td style="font-weight: 600;">${esc(t.title)}</td>
                    <td><span class="growth-badge subtle">${esc(t.type || "General")}</span></td>
                    ${adm ? `<td>${esc(user(t.assignee)?.name || "Unassigned")}</td>` : ""}
                    <td>${t.deadline}</td>
                    <td>
                      <div class="status-dropdown" data-task-id="${t.id}">
                        <button type="button" class="status-dropdown-trigger status-trigger-${currentClass}">
                          <span class="status-dot"></span>
                          <span class="status-label-text">${esc(t.status)}</span>
                          <svg class="status-chevron" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
                        </button>
                        <div class="status-dropdown-menu">
                          ${["To do", "In progress", "Done"].map((opt) => {
                            const optClass = getStatusClass(opt);
                            const isSelected = opt === t.status;
                            return `
                              <button type="button" class="status-option-btn ${isSelected ? "selected" : ""}" data-status-val="${opt}">
                                <span class="status-dot status-trigger-${optClass}"></span>
                                <span>${opt}</span>
                                ${isSelected ? `<svg class="check-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>` : ""}
                              </button>
                            `;
                          }).join("")}
                        </div>
                      </div>
                    </td>
                    <td><span class="tag-status ${cls}">${lbl}</span></td>${adm ? `<td><button class="btn-action-del" data-dt="${t.id}">Delete</button></td>` : ""}
                  </tr>
                `;
              }).join("") : '<tr><td colspan="7" style="text-align: center; color: var(--text-light);">No tasks found.</td></tr>'}
            </tbody>
          </table>
        </div>
      `}
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
          ${availableRoles.map((role) => `
            <label class="role-checkbox-pill">
              <input type="checkbox" name="empRole" value="${esc(role)}">
              <span class="role-pill-content">
                <svg class="check-svg" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                ${esc(role)}
              </span>
            </label>
          `).join("")}
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
              <th>Projects</th>
              <th>Shift Status</th>
              <th>Manage</th>
            </tr>
          </thead>
          <tbody>
            ${emps.length
              ? emps.map((u) => {
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
                      <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                        ${(S.projects || []).filter((p) => (p.members || []).includes(u.id)).map((p) => `<span class="growth-badge subtle">${esc(p.name)}</span>`).join("") || '<span style="color: var(--text-light);">–</span>'}
                      </div>
                    </td>
                    <td>
                      ${active(u.id)
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
              }).join("")
              : '<tr><td colspan="6" style="text-align: center; color: var(--text-light);">No employees registered yet.</td></tr>'
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
  const mine = pTasks().filter((t) => t.assignee === me.id && t.status !== "Done");
  const categories = TASK_TYPES || TYPES;
  const project = cur();

  if (!s && project?.status === "archived") {
    return `
      <div class="full-width-card" style="max-width: 600px; margin: 0 auto;">
        <h2 style="font-size: 20px; font-weight: 800; margin-bottom: 6px;">Shift Workstation</h2>
        <div class="project-notice">${esc(project.name)} is archived, so new shifts can't be started on it.</div>
      </div>`;
  }

  return `
    <div class="full-width-card" style="max-width: 600px; margin: 0 auto;">
      <h2 style="font-size: 20px; font-weight: 800; margin-bottom: 6px;">Shift Workstation</h2>
      <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 24px;">Track your time, select working task, and take breaks</p>
      ${s ? "" : `<div class="track-project-chip">Clocking in to <strong>${esc(project?.name || "")}</strong></div>`}

      ${s
        ? `
          <div style="background: var(--bg-app); border-radius: var(--radius-lg); padding: 24px; text-align: center; margin-bottom: 20px;">
            <div style="color: var(--text-muted); font-size: 13px; font-weight: 600;">Clocked in as ${esc(s.type)} · ${esc(pname(s.projectId))}</div>
            <div style="font-size: 48px; font-weight: 800; color: var(--primary-pine); margin: 8px 0;" id="tm">${dur(worked(s))}</div>
            <div style="color: var(--text-light); font-size: 12px;">Active Task: ${esc(tname(s.taskId))}</div>
          </div>
          <div style="display: flex; gap: 12px;">
            ${b
              ? '<button class="btn-primary" id="bk" style="flex:1; background:var(--accent-amber);">Resume Work</button>'
              : '<button class="select-filter" id="bk" style="flex:1;">Take a Break</button>'
            }
            <button class="btn-action-del" id="co" style="flex:1; padding: 12px; font-size: 14px;">End Shift (Clock Out)</button>
          </div>
        `
        : `
          <div class="input-group" style="margin-bottom: 16px;">
            <label>Work Type / Category</label>
            <div class="custom-select-wrap">
              <input type="hidden" id="wt" value="${esc(categories[0] || 'Mobile App Development')}">
              <button type="button" class="custom-select-trigger">
                <span class="custom-select-label">${esc(categories[0] || 'Mobile App Development')}</span>
                <svg class="custom-select-chevron" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <div class="custom-select-menu">
                ${categories.map((t, idx) => `
                  <button type="button" class="custom-select-opt ${idx === 0 ? "selected" : ""}" data-val="${esc(t)}">
                    <span>${esc(t)}</span>${idx === 0 ? `<svg class="opt-check" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>` : ""}
                  </button>
                `).join("")}
              </div>
            </div>
          </div>

          <div class="input-group" style="margin-bottom: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <label style="margin-bottom: 0;">Working on Task (Optional)</label>
              <button type="button" id="btnToggleTaskMode" class="btn-task-toggle">
                ✏️ Type custom task
              </button>
            </div>

            <div id="taskSelectWrap">
              <div class="custom-select-wrap">
                <input type="hidden" id="wk" value="">
                <button type="button" class="custom-select-trigger">
                  <span class="custom-select-label">– General Work / No specific task –</span>
                  <svg class="custom-select-chevron" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                <div class="custom-select-menu">
                  <button type="button" class="custom-select-opt selected" data-val="">
                    <span>– General Work / No specific task –</span>
                    <svg class="opt-check" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                  </button>
                  ${mine.map((t) => `
                    <button type="button" class="custom-select-opt" data-val="${esc(t.id)}">
                      <span>${esc(t.title)}</span>
                    </button>
                  `).join("")}
                  <button type="button" class="custom-select-opt opt-custom-action" data-val="__custom__">
                    <span>✏️ Custom task (type manually)...</span>
                  </button>
                </div>
              </div>
            </div>

            <div id="taskCustomWrap" style="display: none; margin-top: 6px;">
              <input id="customWk" type="text" placeholder="e.g. Client call, Team standup, Quick bug fix...">
            </div>
          </div>

          <button class="btn-primary" id="ci" style="width: 100%; padding: 14px; font-size: 15px;">Start Work Shift</button>
        `
      }
    </div>
  `;
}

export function sheetView(adm, me) {
  const ws = weekStart();
  const base = pSessions();
  const showProj = !S.projectId; // the all-projects view needs a Project column
  const rows = (adm ? base : base.filter((x) => x.uid === me.id && x.start >= ws)).sort(
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
              ${showProj ? "<th>Project</th>" : ""}
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
            ${rows.length
              ? rows.map((x) => `
                <tr>
                  ${adm ? `<td style="font-weight: 600;">${esc(user(x.uid)?.name || "Unknown")}</td>` : ""}
                  ${showProj ? `<td>${esc(pname(x.projectId))}</td>` : ""}
                  <td>${day(x.start)}</td>
                  <td><span class="growth-badge subtle">${esc(x.type)}</span></td>
                  <td>${esc(tname(x.taskId))}</td>
                  <td>${new Date(x.start).toLocaleTimeString([], { timeStyle: "short" })}</td>
                  <td>${x.end ? new Date(x.end).toLocaleTimeString([], { timeStyle: "short" }) : '<span class="tag-status track">Active</span>'}</td>
                  <td>${Math.round((x.breaks || []).reduce((a, b) => a + ((b.e || Date.now()) - b.s), 0) / 6e4)} min</td>
                  <td style="font-weight: 700;">${hrs(worked(x))} h</td>
                </tr>
              `).join("")
              : `<tr><td colspan="${showProj ? 9 : 8}" style="text-align: center; color: var(--text-light);">No time entries found.</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </div>
  `;
}

const pill = (name, value, label, checked) => `
  <label class="role-checkbox-pill">
    <input type="checkbox" name="${name}" value="${esc(value)}" ${checked ? "checked" : ""}>
    <span class="role-pill-content">${esc(label)}</span>
  </label>`;

export function projectsView(adm, me) {
  const wk = weekStart();
  const all = S.projects || [];
  const live = all.filter((p) => p.status !== "archived");
  const archived = all.filter((p) => p.status === "archived");
  const emps = S.users.filter((u) => u.role !== "admin");

  const sessions = adm ? S.sessions : S.sessions.filter((x) => x.uid === me.id);
  const openTasks = S.tasks.filter((t) => t.status !== "Done").length;
  const overdue = S.tasks.filter((t) => tstate(t)[1] === "over").length;
  const weekHours = sessions.filter((x) => (x.end || Date.now()) >= wk).reduce((a, x) => a + worked(x), 0);

  const card = (p) => {
    const ts = S.tasks.filter((t) => t.projectId === p.id);
    const done = ts.filter((t) => t.status === "Done").length;
    const late = ts.filter((t) => tstate(t)[1] === "over").length;
    const pct = ts.length ? Math.round((done / ts.length) * 100) : 0;
    const hours = sessions
      .filter((x) => x.projectId === p.id && (x.end || Date.now()) >= wk)
      .reduce((a, x) => a + worked(x), 0);
    const members = projectMembers(p);
    const live = S.sessions.filter((x) => x.projectId === p.id && !x.end).length;

    return `
      <div class="project-card ${p.status === "archived" ? "is-archived" : ""}" data-open-project="${esc(p.id)}" role="button" tabindex="0">
        <div class="project-card-top">
          <div class="project-avatar" style="background:${pcolor(p.id)}">${esc(p.name.charAt(0).toUpperCase())}</div>
          <div class="project-card-title">
            <h3>${esc(p.name)}</h3>
            <span class="project-card-sub">${p.status === "archived" ? "Archived" : live ? `${live} clocked in now` : "Active"}</span>
          </div>
          ${late ? `<span class="tag-status over">${late} overdue</span>` : ""}
        </div>

        <p class="project-card-desc">${p.description ? esc(p.description) : "No description"}</p>

        <div class="project-progress">
          <div class="project-progress-meta">
            <span>${adm ? "Tasks" : "My tasks"}</span>
            <span>${done}/${ts.length} done</span>
          </div>
          <div class="project-progress-bar"><span style="width:${pct}%"></span></div>
        </div>

        <div class="project-card-foot">
          <div class="project-card-stats">
            <span title="Hours this week">${hrs(hours)} h this week</span>
          </div>
          ${avatarStack(members, 4)}
        </div>
      </div>`;
  };

  return `
    <div class="projects-kpis">
      <div class="kpi-card kpi-card-pine">
        <div class="kpi-label">Active Projects</div>
        <div class="kpi-value-row"><span class="kpi-big-number">${live.length}</span><span class="kpi-caption">${adm ? "Across the team" : "You are part of"}</span></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">${adm ? "Open Tasks" : "My Open Tasks"}</div>
        <div class="kpi-value-row"><span class="kpi-big-number">${openTasks}</span><span class="kpi-caption">All projects</span></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Overdue</div>
        <div class="kpi-value-row"><span class="kpi-big-number">${overdue}</span><span class="kpi-caption">${overdue ? "Requires action" : "All on track"}</span></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">${adm ? "Team Hours" : "My Hours"}</div>
        <div class="kpi-value-row"><span class="kpi-big-number">${hrs(weekHours)} h</span><span class="kpi-caption">This week</span></div>
      </div>
    </div>

    <div class="projects-head">
      <div>
        <h3>${adm ? "All Projects" : "My Projects"} (${live.length})</h3>
        <p>Open a project to see its own dashboard, tasks, time tracker and timesheets</p>
      </div>
      ${adm ? `<button type="button" class="btn-primary" id="btnNewProject">${S.showProjForm ? "Close" : "+ New Project"}</button>` : ""}
    </div>

    ${adm && S.showProjForm ? `
      <div class="full-width-card">
        <h3 style="margin-bottom: 6px;">Create Project</h3>
        <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 18px;">Name it, then pick who works on it. You can change members any time.</p>

        <div class="form-grid-3">
          <div class="input-group">
            <label>Project Name</label>
            <input id="pn" maxlength="80" placeholder="e.g. Docbook">
          </div>
          <div class="input-group">
            <label>Start Date (optional)</label>
            <input id="ps" type="date">
          </div>
          <div class="input-group">
            <label>End Date (optional)</label>
            <input id="pe" type="date">
          </div>
        </div>

        <div class="input-group" style="margin-bottom: 16px;">
          <label>Description (optional)</label>
          <input id="pd" maxlength="300" placeholder="What is this project about?">
        </div>

        <div class="input-group" style="margin-bottom: 20px;">
          <label>Members</label>
          <div class="role-selector-group">
            ${emps.length
              ? emps.map((u) => pill("projMember", u.id, u.name, false)).join("")
              : '<span style="color: var(--text-muted); font-size: 13px;">No employees yet. Add them in Team Members first.</span>'}
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 12px;">
          <button class="btn-primary" id="pc">Create Project</button>
          <button class="select-filter" id="pcCancel" type="button">Cancel</button>
        </div>
      </div>
    ` : ""}

    ${live.length
      ? `<div class="projects-grid">${live.map(card).join("")}</div>`
      : `
        <div class="full-width-card projects-empty">
          <h4>${adm ? "No projects yet" : "You haven't been added to a project yet"}</h4>
          <p>${adm ? "Create your first project to start organising tasks and time by project." : "Ask your admin to add you to a project."}</p>
        </div>`}

    ${archived.length ? `
      <div class="projects-head" style="margin-top: 8px;">
        <div><h3>Archived (${archived.length})</h3><p>Read-only history. ${adm ? "Restore a project from its Members tab." : ""}</p></div>
      </div>
      <div class="projects-grid">${archived.map(card).join("")}</div>
    ` : ""}
  `;
}

export function membersView(adm, me) {
  const p = cur();
  if (!p) return "";

  const emps = S.users.filter((u) => u.role !== "admin");
  const members = projectMembers(p);
  const isArchived = p.status === "archived";

  const rows = members.map((u) => {
    const mine = S.tasks.filter((t) => t.projectId === p.id && t.assignee === u.id);
    const open = mine.filter((t) => t.status !== "Done").length;
    const ms = S.sessions.filter((x) => x.projectId === p.id && x.uid === u.id);
    const roles = u.roles && u.roles.length ? u.roles : u.workType ? u.workType.split(",").map((r) => r.trim()) : [];
    return `
      <tr>
        <td style="font-weight: 600;">${esc(u.name)}</td>
        <td><div style="display: flex; flex-wrap: wrap; gap: 4px;">${roles.map((r) => `<span class="growth-badge subtle">${esc(r)}</span>`).join("")}</div></td>
        ${adm ? `<td>${open} open / ${mine.length}</td><td>${hrs(ms.reduce((a, x) => a + worked(x), 0))} h</td>` : ""}
        <td>${active(u.id)?.projectId === p.id ? '<span class="tag-status done">Clocked In</span>' : '<span class="tag-status" style="background:#f1f5f9; color:#64748b;">Offline</span>'}</td>
      </tr>`;
  });

  return `
    ${isArchived ? `<div class="full-width-card"><div class="project-notice">This project is archived and read-only. ${adm ? "Restore it below to continue working." : ""}</div></div>` : ""}

    <div class="full-width-card">
      <h3 style="margin-bottom: 6px;">Project Details</h3>
      ${adm ? `
        <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 18px;">Name, description and timeline</p>
        <div class="form-grid-3">
          <div class="input-group"><label>Project Name</label><input id="pdName" maxlength="80" value="${esc(p.name)}"></div>
          <div class="input-group"><label>Start Date</label><input id="pdStart" type="date" value="${esc(p.start || "")}"></div>
          <div class="input-group"><label>End Date</label><input id="pdEnd" type="date" value="${esc(p.end || "")}"></div>
        </div>
        <div class="input-group" style="margin-bottom: 18px;"><label>Description</label><input id="pdDesc" maxlength="300" value="${esc(p.description || "")}" placeholder="What is this project about?"></div>
        <button class="btn-primary" id="pdSave">Save Details</button>
      ` : `
        <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 8px;">${p.description ? esc(p.description) : "No description"}</p>
        <p style="font-size: 13px;"><strong>Timeline:</strong> ${p.start || p.end ? `${esc(p.start || "…")} → ${esc(p.end || "…")}` : "Not set"}</p>
      `}
    </div>

    <div class="full-width-card">
      <h3 style="margin-bottom: 6px;">Members (${members.length})</h3>
      ${adm ? `
        <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 18px;">Only selected employees can see this project, get tasks in it, and clock in to it</p>
        <div class="role-selector-group" style="margin-bottom: 18px;">
          ${emps.length
            ? emps.map((u) => pill("memMember", u.id, u.name, (p.members || []).includes(u.id))).join("")
            : '<span style="color: var(--text-muted); font-size: 13px;">No employees yet. Add them in Team Members first.</span>'}
        </div>
        <button class="btn-primary" id="memSave">Save Members</button>
      ` : `<p style="color: var(--text-muted); font-size: 13px;">People working on this project</p>`}

      <div style="overflow-x: auto;">
        <table class="styled-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Roles</th>
              ${adm ? "<th>Tasks</th><th>Hours Logged</th>" : ""}
              <th>Shift</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length ? rows.join("") : `<tr><td colspan="${adm ? 5 : 3}" style="text-align: center; color: var(--text-light);">No members yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>

    ${adm ? `
      <div class="full-width-card">
        <h3 style="margin-bottom: 6px;">${isArchived ? "Restore Project" : "Archive or Delete"}</h3>
        <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 18px;">
          ${isArchived
            ? "Restoring makes the project active again for tasks and time tracking."
            : "Archiving keeps all tasks and time entries but stops new tasks and shifts. Deleting is only possible for projects with no tasks or time entries."}
        </p>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <button class="select-filter" id="pArchive" type="button">${isArchived ? "Restore Project" : "Archive Project"}</button>
          <button class="btn-action-del" id="pDelete" type="button" style="padding: 10px 16px;">Delete Project</button>
        </div>
      </div>
    ` : ""}
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