// Team-collaboration views: task board, sprints, chat shell, reports, my tasks, dashboard extras.
import { S, TASK_TYPES, TYPES, PRIORITIES } from "./state.js";
import {
  esc, user, tstate, day, hrs, worked, weekStart, cur, pTasks, pSessions, pname, projectMembers, active,
  sprintsOf, sprint, activeSprint, initial, prio, PRIORITY_CLASS, customSelect, filterTasks, filtersActive,
  taskFilterWho, ago, openSubtasks, pcolor
} from "./utils.js";

const ICON = {
  cal: '<rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  check: '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  play: '<polygon points="5 3 19 12 5 21 5 3"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'
};
const svg = (name, size = 12, sw = 2.2) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${ICON[name]}</svg>`;

const miniAvatar = (u, cls = "") =>
  `<span class="mini-avatar ${cls}" title="${esc(u?.name || "Unassigned")}">${esc(initial(u?.name))}</span>`;

const daysBetween = (a, b) => Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 864e5);

const statusClass = (s) => (s === "Done" ? "done" : s === "In progress" ? "progress" : "todo");

// ---------------------------------------------------------------- task cards
export const canMoveTask = (t, me, adm) => adm || t.assignee === me.id;
export const canManageTask = (t, me, adm) => adm || (t.createdBy === me.id && t.assignee === me.id);

function quickActions(t) {
  const st = t.status || "To do";
  return `
    ${st !== "To do" ? `<button type="button" class="btn-kanban-shift" data-move-task="${t.id}" data-move-to="To do" title="Move to To do">
      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg><span>To do</span></button>` : ""}
    ${st !== "In progress" ? `<button type="button" class="btn-kanban-shift" data-move-task="${t.id}" data-move-to="In progress" title="Move to In progress"><span>In progress</span></button>` : ""}
    ${st !== "Done" ? `<button type="button" class="btn-kanban-shift" data-move-task="${t.id}" data-move-to="Done" title="Move to Done"><span>Done</span>
      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg></button>` : ""}`;
}

function taskCard(t, me, adm, archived) {
  const [lbl, cls] = tstate(t);
  const move = canMoveTask(t, me, adm);
  const manage = canManageTask(t, me, adm);
  const sp = t.sprintId ? sprint(t.sprintId) : null;
  const subs = t.subtasks || [];
  const subsDone = subs.filter((s) => s.done).length;
  const p = prio(t);
  const mine = t.assignee === me.id;
  const tracking = active(me.id)?.taskId === t.id;
  const a = user(t.assignee);

  return `
    <div class="kanban-card prio-${PRIORITY_CLASS[p]}" data-task-id="${t.id}" data-can-move="${move && !archived ? 1 : 0}">
      <div class="kanban-card-top">
        <span class="growth-badge subtle">${esc(t.type || "General")}</span>
        <span class="tag-status ${cls}">${lbl}</span>
      </div>

      <div class="kanban-card-title">${esc(t.title)}</div>

      <div class="card-chips">
        <span class="prio-chip prio-${PRIORITY_CLASS[p]}">${p}</span>
        ${sp ? `<span class="sprint-chip ${sp.status}" title="Sprint">${esc(sp.name)}</span>` : ""}
        ${(t.labels || []).slice(0, 3).map((l) => `<span class="label-chip">${esc(l)}</span>`).join("")}
        ${(t.labels || []).length > 3 ? `<span class="label-chip more">+${t.labels.length - 3}</span>` : ""}
      </div>

      <div class="kanban-card-meta">
        <div class="meta-pill meta-deadline">${svg("cal")} ${t.deadline}</div>
        <div class="meta-pill meta-assignee" title="Assignee">${miniAvatar(a, "xs")} ${esc((a?.name || "Unassigned").split(" ")[0])}</div>
        ${subs.length ? `<div class="meta-pill" title="Checklist">${svg("check")} ${subsDone}/${subs.length}</div>` : ""}
        ${t.estimate ? `<div class="meta-pill" title="Estimate">${svg("clock")} ${t.estimate}h</div>` : ""}
        ${tracking ? `<div class="meta-pill tracking-pill"><span class="pulse-dot"></span> Tracking</div>` : ""}
      </div>

      <div class="kanban-card-footer">
        <div class="kanban-quick-actions">
          ${move && !archived ? quickActions(t) : '<span class="readonly-note">View only</span>'}
        </div>
        <div class="card-icons">
          ${mine && t.status !== "Done" && !archived ? `<button class="btn-card-icon" data-start-task="${t.id}" title="Start timer on this task">${svg("play", 12)}</button>` : ""}
          ${manage && !archived ? `<button class="btn-action-del-card" data-dt="${t.id}" title="Delete Task">${svg("trash", 13, 2)}</button>` : ""}
        </div>
      </div>
    </div>`;
}

// ---------------------------------------------------------------- filters
function filterBar(adm, me, members, all) {
  const who = taskFilterWho(adm, me);
  const open = (uid) => all.filter((t) => t.assignee === uid && t.status !== "Done").length;
  const others = members.filter((m) => adm || m.id !== me.id);
  const sps = sprintsOf();
  const act = sps.find((s) => s.status === "active");

  const sprintOpts = [
    { val: "all", label: "All sprints" },
    ...(act ? [{ val: "active", label: `Active: ${act.name}` }] : []),
    { val: "backlog", label: "Backlog (no sprint)" },
    ...sps.map((s) => ({ val: s.id, label: `${s.name}${s.status === "completed" ? " ✓" : ""}` }))
  ];

  return `
    <div class="filter-bar">
      <div class="filter-people">
        <span class="filter-title">Team</span>
        <button type="button" class="person-chip ${who === "all" ? "active" : ""}" data-filter-assignee="all">Everyone <em>${all.filter((t) => t.status !== "Done").length}</em></button>
        ${!adm ? `<button type="button" class="person-chip ${who === me.id ? "active" : ""}" data-filter-assignee="${me.id}">${miniAvatar(me, "xs")} Me <em>${open(me.id)}</em></button>` : ""}
        ${others.map((m) => `
          <button type="button" class="person-chip ${who === m.id ? "active" : ""}" data-filter-assignee="${m.id}" title="${esc(m.name)}">
            ${miniAvatar(m, "xs")} ${esc(m.name.split(" ")[0])} <em>${open(m.id)}</em>
          </button>`).join("")}
      </div>

      <div class="filter-row">
        <div class="filter-search">
          ${svg("search", 15)}
          <input id="tfSearch" type="search" autocomplete="off" placeholder="Search tasks, labels, people…" value="${esc(S.tf.q)}">
        </div>
        <div class="filter-select">${customSelect({ data: "sprint", options: sprintOpts, value: S.tf.sprint })}</div>
        <div class="filter-select">${customSelect({ data: "priority", options: [{ val: "all", label: "Any priority" }, ...PRIORITIES.map((p) => ({ val: p, label: p }))], value: S.tf.priority })}</div>
        <div class="filter-select">${customSelect({ data: "type", options: [{ val: "all", label: "All categories" }, ...(TASK_TYPES || TYPES).map((t) => ({ val: t, label: t }))], value: S.tf.type })}</div>
        <button type="button" class="toggle-chip ${S.tf.overdue ? "active" : ""}" data-filter-toggle="overdue">Overdue only</button>
        ${filtersActive(adm, me) ? `<button type="button" class="link-btn" id="tfClear">Clear filters</button>` : ""}
      </div>
    </div>`;
}

// ---------------------------------------------------------------- create form
function taskForm(adm, me, project, members) {
  const categories = TASK_TYPES || TYPES;
  const sprints = sprintsOf().filter((s) => s.status !== "completed");
  const emps = members;
  const first = emps[0];
  const assigneeField = adm
    ? customSelect({
        id: "na",
        options: emps.map((u) => ({ val: u.id, label: `${u.name} (${u.workType || "Employee"})` })),
        value: first?.id
      }).replace("Nothing to choose", "No employees in this project yet. Add members in the Members tab.")
    : `<input type="hidden" id="na" value="${esc(me.id)}"><div class="static-field">${miniAvatar(me, "xs")} ${esc(me.name)} <span>(you)</span></div>`;

  return `
    <div class="task-form-panel">
      <h3 style="margin-bottom: 6px;">${adm ? "Assign New Task" : "Add a Task for Yourself"}</h3>
      <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 18px;">
        ${adm ? "Set the details, then assign" : "Create your own task"} in <strong>${esc(project?.name || "this project")}</strong>
      </p>

      <div class="form-grid-3">
        <div class="input-group"><label>Task Title</label><input id="nt" maxlength="200" placeholder="e.g. Implement user authentication flow"></div>
        <div class="input-group"><label>Task Category</label>${customSelect({ id: "ntype", options: categories.map((c) => ({ val: c, label: c })), value: categories[0] })}</div>
        <div class="input-group"><label>Assignee</label>${assigneeField}</div>
        <div class="input-group">
          <label>Deadline</label>
          <div class="custom-datepicker-wrap" id="deadlinePickerWrap">
            <input type="hidden" id="nd" value="${day(Date.now())}">
            <button type="button" class="custom-datepicker-trigger" id="deadlinePickerBtn">
              <span class="custom-datepicker-label" id="ndLabel">${day(Date.now())}</span>
              <svg class="custom-datepicker-icon" viewBox="0 0 24 24">${ICON.cal}</svg>
            </button>
            <div class="custom-datepicker-menu" id="deadlinePickerMenu"></div>
          </div>
        </div>
        <div class="input-group"><label>Priority</label>${customSelect({ id: "np", options: PRIORITIES.map((p) => ({ val: p, label: p })), value: "Medium" })}</div>
        <div class="input-group"><label>Sprint</label>${customSelect({ id: "ns", options: [{ val: "", label: "Backlog (no sprint)" }, ...sprints.map((s) => ({ val: s.id, label: `${s.name}${s.status === "active" ? " (active)" : ""}` }))], value: "" })}</div>
        <div class="input-group"><label>Estimate (hours)</label><input id="ne" type="number" min="0" max="1000" step="0.5" placeholder="e.g. 4"></div>
        <div class="input-group"><label>Labels (comma separated)</label><input id="nl" maxlength="120" placeholder="e.g. api, urgent-fix"></div>
      </div>

      <div class="input-group" style="margin-bottom: 16px;">
        <label>Description (optional)</label>
        <textarea id="ndesc" rows="3" maxlength="2000" placeholder="Add context, acceptance criteria, links…"></textarea>
      </div>

      <div style="display: flex; align-items: center; gap: 12px;">
        <button class="btn-primary" id="ac">Create Task</button>
        <button class="select-filter" id="btnCloseTaskForm" type="button">Close</button>
        <span class="err" id="te" style="color: var(--accent-red); font-size: 12px;"></span>
      </div>
    </div>`;
}

// ---------------------------------------------------------------- views
function boardView(list, me, adm, archived) {
  const columns = [
    { title: "To Do", key: "To do", dotColor: "#64748b" },
    { title: "In Progress", key: "In progress", dotColor: "#0ea5e9" },
    { title: "Done", key: "Done", dotColor: "#10b981" }
  ];
  return `
    <div class="kanban-board">
      ${columns.map((col) => {
        const colTasks = list.filter((t) => (t.status || "To do") === col.key);
        return `
          <div class="kanban-column" data-col-status="${col.key}">
            <div class="kanban-column-header">
              <div class="kanban-column-title"><span class="status-dot" style="background: ${col.dotColor};"></span><span>${col.title}</span></div>
              <span class="kanban-count-badge">${colTasks.length}</span>
            </div>
            <div class="kanban-column-body" data-status-col="${col.key}">
              ${colTasks.length
                ? colTasks.map((t) => taskCard(t, me, adm, archived)).join("")
                : `<div class="kanban-column-empty"><span>No tasks in ${col.title.toLowerCase()}</span></div>`}
            </div>
          </div>`;
      }).join("")}
    </div>`;
}

function tableView(list, me, adm, archived) {
  return `
    <div style="overflow-x: auto; margin-top: 14px;">
      <table class="styled-table">
        <thead>
          <tr><th>Task</th><th>Priority</th><th>Category</th><th>Assignee</th><th>Sprint</th><th>Deadline</th><th>Status</th><th>State</th><th>Action</th></tr>
        </thead>
        <tbody>
          ${list.length ? list.map((t) => {
            const [lbl, cls] = tstate(t);
            const move = canMoveTask(t, me, adm) && !archived;
            const sp = t.sprintId ? sprint(t.sprintId) : null;
            const p = prio(t);
            return `
              <tr>
                <td>
                  <button type="button" class="task-link" data-open-task="${t.id}">${esc(t.title)}</button>
                  ${(t.labels || []).length ? `<div class="card-chips" style="margin-top:4px;">${t.labels.slice(0, 4).map((l) => `<span class="label-chip">${esc(l)}</span>`).join("")}</div>` : ""}
                </td>
                <td><span class="prio-chip prio-${PRIORITY_CLASS[p]}">${p}</span></td>
                <td><span class="growth-badge subtle">${esc(t.type || "General")}</span></td>
                <td><div class="cell-user">${miniAvatar(user(t.assignee), "xs")} ${esc(user(t.assignee)?.name || "Unassigned")}</div></td>
                <td>${sp ? `<span class="sprint-chip ${sp.status}">${esc(sp.name)}</span>` : '<span style="color: var(--text-light);">–</span>'}</td>
                <td>${t.deadline}</td>
                <td>
                  ${move ? `
                  <div class="status-dropdown" data-task-id="${t.id}">
                    <button type="button" class="status-dropdown-trigger status-trigger-${statusClass(t.status)}">
                      <span class="status-dot"></span><span class="status-label-text">${esc(t.status)}</span>
                      <svg class="status-chevron" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    <div class="status-dropdown-menu">
                      ${["To do", "In progress", "Done"].map((opt) => `
                        <button type="button" class="status-option-btn ${opt === t.status ? "selected" : ""}" data-status-val="${opt}">
                          <span class="status-dot status-trigger-${statusClass(opt)}"></span><span>${opt}</span>
                          ${opt === t.status ? '<svg class="check-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>' : ""}
                        </button>`).join("")}
                    </div>
                  </div>` : `<span class="tag-status ${statusClass(t.status)}">${esc(t.status)}</span>`}
                </td>
                <td><span class="tag-status ${cls}">${lbl}</span></td>
                <td>${canManageTask(t, me, adm) && !archived ? `<button class="btn-action-del" data-dt="${t.id}">Delete</button>` : ""}</td>
              </tr>`;
          }).join("") : '<tr><td colspan="9" style="text-align: center; color: var(--text-light);">No tasks match.</td></tr>'}
        </tbody>
      </table>
    </div>`;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function calendarView(list) {
  const now = new Date();
  const { y, m } = S.calT || { y: now.getFullYear(), m: now.getMonth() };
  const first = new Date(y, m, 1);
  const lead = first.getDay();
  const pad = (n) => String(n).padStart(2, "0");
  const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayKey = key(now);

  const byDay = {};
  list.forEach((t) => (byDay[t.deadline] ||= []).push(t));

  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(y, m, 1 - lead + i);
    const k = key(d);
    const items = byDay[k] || [];
    cells.push(`
      <div class="cal-cell ${d.getMonth() !== m ? "out" : ""} ${k === todayKey ? "today" : ""}">
        <div class="cal-num">${d.getDate()}</div>
        ${items.slice(0, 3).map((t) => `
          <button type="button" class="cal-chip st-${statusClass(t.status)} prio-${PRIORITY_CLASS[prio(t)]}" data-open-task="${t.id}" title="${esc(t.title)} — ${esc(user(t.assignee)?.name || "")}">
            ${esc(t.title)}
          </button>`).join("")}
        ${items.length > 3 ? `<button type="button" class="cal-more" data-cal-day="${k}">+${items.length - 3} more</button>` : ""}
      </div>`);
  }

  return `
    <div class="cal-wrap">
      <div class="cal-head">
        <h4>${MONTHS[m]} ${y}</h4>
        <div class="cal-nav">
          <button type="button" class="select-filter" data-cal-nav="-1">‹</button>
          <button type="button" class="select-filter" data-cal-nav="0">Today</button>
          <button type="button" class="select-filter" data-cal-nav="1">›</button>
        </div>
      </div>
      <div class="cal-grid cal-dow">${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => `<div>${d}</div>`).join("")}</div>
      <div class="cal-grid">${cells.join("")}</div>
    </div>`;
}

export function tasksView(adm, me) {
  const project = cur();
  const archived = project?.status === "archived";
  const members = projectMembers(project);
  const all = pTasks();
  const list = filterTasks(all, adm, me).sort((a, b) => a.deadline.localeCompare(b.deadline));
  const mode = S.taskViewMode || "kanban";
  const act = activeSprint();

  let sprintStrip = "";
  if (act) {
    const st = all.filter((t) => t.sprintId === act.id);
    const done = st.filter((t) => t.status === "Done").length;
    const left = daysBetween(day(Date.now()), act.end);
    sprintStrip = `
      <div class="sprint-strip">
        <div><strong>${esc(act.name)}</strong> <span>· ${left >= 0 ? `${left} day${left === 1 ? "" : "s"} left` : `ended ${-left} day${left === -1 ? "" : "s"} ago`}</span></div>
        <div class="sprint-strip-bar"><span style="width:${st.length ? Math.round((done / st.length) * 100) : 0}%"></span></div>
        <div>${done}/${st.length} done</div>
        <button type="button" class="link-btn" data-goto-tab="sprints">Open sprint →</button>
      </div>`;
  }

  const modeBtn = (key, label, icon) => `
    <button type="button" class="btn-view-mode ${mode === key ? "active" : ""}" data-view-mode="${key}">${icon}<span>${label}</span></button>`;

  return `
    <div class="full-width-card">
      ${archived ? `<div class="project-notice">This project is archived. Tasks are read-only, but you can still review everything.</div>` : ""}

      <div class="tasks-header-bar">
        <div>
          <h3>Tasks &amp; Deadlines (${list.length}${list.length !== all.length ? ` of ${all.length}` : ""})</h3>
          <p style="color: var(--text-muted); font-size: 13px; margin-top: 2px;">
            ${adm ? "Manage, track, and update all team task states" : "Drag or move your own tasks across workflow stages. Click any card for details."}
          </p>
        </div>
        <div class="tasks-header-actions">
          <button type="button" class="select-filter" id="btnTasksCsv">Export CSV</button>
          ${!archived ? `<button type="button" class="btn-primary" id="btnNewTask">${S.showTaskForm ? "Close" : "+ New Task"}</button>` : ""}
          <div class="view-switcher-pill">
            ${modeBtn("kanban", "Board", '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2"><rect width="6" height="18" x="3" y="3" rx="1"/><rect width="6" height="12" x="15" y="3" rx="1"/></svg>')}
            ${modeBtn("table", "Table", '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 3h18v18H3zM3 9h18M3 15h18M9 3v18"/></svg>')}
            ${modeBtn("calendar", "Calendar", `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2">${ICON.cal}</svg>`)}
          </div>
        </div>
      </div>

      ${S.showTaskForm && !archived ? taskForm(adm, me, project, members) : ""}
      ${sprintStrip}
      ${filterBar(adm, me, members, all)}

      ${mode === "kanban" ? boardView(list, me, adm, archived) : mode === "calendar" ? calendarView(list) : tableView(list, me, adm, archived)}
    </div>`;
}

// ---------------------------------------------------------------- sprints
const sprintStats = (sp, tasks) => {
  const st = tasks.filter((t) => t.sprintId === sp.id);
  const done = st.filter((t) => t.status === "Done");
  return {
    st,
    done: done.length,
    total: st.length,
    est: st.reduce((a, t) => a + (t.estimate || 0), 0),
    pct: st.length ? Math.round((done.length / st.length) * 100) : 0
  };
};

const sprintTaskRows = (list) =>
  list.length
    ? `<div style="overflow-x:auto"><table class="styled-table compact"><thead><tr><th>Task</th><th>Assignee</th><th>Priority</th><th>Est.</th><th>Status</th></tr></thead><tbody>
      ${list.map((t) => `
        <tr>
          <td><button type="button" class="task-link" data-open-task="${t.id}">${esc(t.title)}</button></td>
          <td><div class="cell-user">${miniAvatar(user(t.assignee), "xs")} ${esc(user(t.assignee)?.name || "–")}</div></td>
          <td><span class="prio-chip prio-${PRIORITY_CLASS[prio(t)]}">${prio(t)}</span></td>
          <td>${t.estimate ? t.estimate + "h" : "–"}</td>
          <td><span class="tag-status ${statusClass(t.status)}">${esc(t.status)}</span></td>
        </tr>`).join("")}
      </tbody></table></div>`
    : '<p class="muted-note">No tasks in this sprint yet. Add tasks from the backlog below or from a task\'s details.</p>';

export function sprintsView(adm, me) {
  const project = cur();
  const archived = project?.status === "archived";
  const sps = sprintsOf();
  const act = sps.find((s) => s.status === "active");
  const planned = sps.filter((s) => s.status === "planned");
  const completed = sps.filter((s) => s.status === "completed").reverse();
  const tasks = pTasks();
  const backlog = tasks.filter((t) => !t.sprintId && t.status !== "Done").sort((a, b) => a.deadline.localeCompare(b.deadline));
  const assignable = sps.filter((s) => s.status !== "completed");
  const canEdit = adm && !archived;
  const today = day(Date.now());

  const assignSelect = (t) => `
    <select class="mini-select" data-assign-sprint="${t.id}">
      <option value="">Backlog</option>
      ${assignable.map((s) => `<option value="${s.id}" ${t.sprintId === s.id ? "selected" : ""}>${esc(s.name)}</option>`).join("")}
    </select>`;

  let activeCard = "";
  if (act) {
    const s = sprintStats(act, tasks);
    const left = daysBetween(today, act.end);
    activeCard = `
      <div class="full-width-card sprint-card active">
        <div class="sprint-card-head">
          <div>
            <div class="sprint-title"><h3>${esc(act.name)}</h3><span class="tag-status track">Active</span></div>
            <p class="muted-note">${esc(act.start)} → ${esc(act.end)} · ${left >= 0 ? `${left} day${left === 1 ? "" : "s"} left` : `ended ${-left} day${left === -1 ? "" : "s"} ago, complete it`}${act.goal ? ` · Goal: ${esc(act.goal)}` : ""}</p>
          </div>
          ${canEdit ? `<div class="sprint-actions">
            <button class="select-filter" data-sprint-edit="${act.id}">Edit</button>
            <button class="btn-primary" data-sprint-complete="${act.id}">Complete Sprint</button>
          </div>` : ""}
        </div>
        <div class="sprint-kpis">
          <div><b>${s.done}/${s.total}</b><span>tasks done</span></div>
          <div><b>${s.pct}%</b><span>complete</span></div>
          <div><b>${Math.round(s.est * 10) / 10}h</b><span>estimated</span></div>
          <div class="sprint-progress"><div class="project-progress-bar"><span style="width:${s.pct}%"></span></div></div>
        </div>
        <div class="chart-box"><canvas id="burndownChart" data-sprint="${act.id}"></canvas></div>
        ${sprintTaskRows(s.st)}
      </div>`;
  } else {
    activeCard = `
      <div class="full-width-card projects-empty">
        <h4>No active sprint</h4>
        <p>${planned.length ? (adm ? "Start one of the planned sprints below." : "Waiting for the admin to start a sprint.") : adm ? "Create a sprint, add tasks from the backlog, then start it." : "No sprints have been planned yet."}</p>
      </div>`;
  }

  const plannedCards = planned.map((sp) => {
    const s = sprintStats(sp, tasks);
    return `
      <div class="full-width-card sprint-card">
        <div class="sprint-card-head">
          <div>
            <div class="sprint-title"><h3>${esc(sp.name)}</h3><span class="tag-status todo">Planned</span></div>
            <p class="muted-note">${esc(sp.start)} → ${esc(sp.end)} · ${s.total} task${s.total === 1 ? "" : "s"} · ${Math.round(s.est * 10) / 10}h estimated${sp.goal ? ` · Goal: ${esc(sp.goal)}` : ""}</p>
          </div>
          ${canEdit ? `<div class="sprint-actions">
            <button class="select-filter" data-sprint-edit="${sp.id}">Edit</button>
            <button class="btn-action-del" data-sprint-delete="${sp.id}">Delete</button>
            <button class="btn-primary" data-sprint-start="${sp.id}" ${act ? 'disabled title="Complete the active sprint first"' : ""}>Start Sprint</button>
          </div>` : ""}
        </div>
        ${sprintTaskRows(s.st)}
      </div>`;
  }).join("");

  const completedCard = completed.length
    ? `
      <div class="full-width-card">
        <h3 style="margin-bottom:4px;">Completed Sprints</h3>
        <p class="muted-note" style="margin-bottom:12px;">Velocity shows tasks finished per sprint.</p>
        <div class="chart-box short"><canvas id="velocityChart"></canvas></div>
        <div style="overflow-x:auto"><table class="styled-table compact"><thead><tr><th>Sprint</th><th>Dates</th><th>Committed</th><th>Done</th><th>Carried over</th><th>Hours delivered</th><th>Completion</th></tr></thead><tbody>
          ${completed.map((sp) => `
            <tr>
              <td style="font-weight:600;">${esc(sp.name)}</td>
              <td>${esc(sp.start)} → ${esc(sp.end)}</td>
              <td>${sp.committed ?? 0}</td><td>${sp.doneCount ?? 0}</td><td>${sp.carriedOver ?? 0}</td><td>${sp.doneHours ?? 0}h</td>
              <td><span class="growth-badge ${(sp.doneCount || 0) >= (sp.committed || 1) ? "positive" : "subtle"}">${sp.committed ? Math.round(((sp.doneCount || 0) / sp.committed) * 100) : 0}%</span></td>
            </tr>`).join("")}
        </tbody></table></div>
      </div>`
    : "";

  return `
    ${archived ? `<div class="full-width-card"><div class="project-notice">This project is archived. Sprints are read-only.</div></div>` : ""}

    <div class="projects-head" style="padding-bottom:12px;">
      <div><h3>Sprints</h3><p>Plan work in time-boxed iterations, track the burndown, and review velocity</p></div>
      ${canEdit ? `<button type="button" class="btn-primary" id="btnNewSprint">+ New Sprint</button>` : ""}
    </div>

    ${activeCard}
    ${plannedCards}

    <div class="full-width-card">
      <h3 style="margin-bottom:4px;">Backlog (${backlog.length})</h3>
      <p class="muted-note" style="margin-bottom:12px;">Open tasks that aren't in a sprint yet. ${canEdit ? "Pick a sprint to plan them." : ""}</p>
      <div style="overflow-x:auto"><table class="styled-table compact"><thead><tr><th>Task</th><th>Assignee</th><th>Priority</th><th>Deadline</th><th>Est.</th>${canEdit ? "<th>Sprint</th>" : ""}</tr></thead><tbody>
        ${backlog.length ? backlog.map((t) => `
          <tr>
            <td><button type="button" class="task-link" data-open-task="${t.id}">${esc(t.title)}</button></td>
            <td><div class="cell-user">${miniAvatar(user(t.assignee), "xs")} ${esc(user(t.assignee)?.name || "–")}</div></td>
            <td><span class="prio-chip prio-${PRIORITY_CLASS[prio(t)]}">${prio(t)}</span></td>
            <td>${t.deadline}</td>
            <td>${t.estimate ? t.estimate + "h" : "–"}</td>
            ${canEdit ? `<td>${assignSelect(t)}</td>` : ""}
          </tr>`).join("") : `<tr><td colspan="${canEdit ? 6 : 5}" style="text-align:center;color:var(--text-light);">The backlog is empty.</td></tr>`}
      </tbody></table></div>
    </div>

    ${completedCard}`;
}

// ---------------------------------------------------------------- chat shell (messages are painted by chat.js)
export function chatView(me) {
  const project = cur();
  const members = projectMembers(project);
  const admins = S.users.filter((u) => u.role === "admin");
  const people = [...admins, ...members];
  const live = new Set(S.sessions.filter((x) => !x.end && x.projectId === project?.id).map((x) => x.uid));
  const archived = project?.status === "archived";

  return `
    <div class="chat-shell">
      <section class="chat-main">
        <div class="chat-head">
          <div><h3># ${esc(project?.name || "")}</h3><p>${people.length} people · project chat</p></div>
        </div>
        <div class="chat-messages" id="chatMessages"><div class="chat-loading">Loading messages…</div></div>
        <div class="chat-compose">
          ${archived ? `<div class="project-notice" style="margin:0;">This project is archived, so the chat is read-only.</div>` : `
          <div class="mention-row"><span>Mention:</span>${people.filter((u) => u.id !== me.id && u.username).map((u) => `<button type="button" class="mention-chip" data-mention="${esc(u.username)}">@${esc(u.username)}</button>`).join("")}</div>
          <div class="chat-input-row">
            <textarea id="chatInput" rows="1" maxlength="2000" placeholder="Message #${esc(project?.name || "")}… (Enter to send, Shift+Enter for a new line)"></textarea>
            <button type="button" class="btn-primary" id="chatSend">Send</button>
          </div>`}
        </div>
      </section>
      <aside class="chat-side">
        <h4>People</h4>
        ${people.map((u) => `
          <div class="chat-person">
            <span class="mini-avatar">${esc(initial(u.name))}</span>
            <div><b>${esc(u.name)}${u.id === me.id ? " (you)" : ""}</b><small>${u.role === "admin" ? "Admin" : esc(u.workType || "Employee")}</small></div>
            ${live.has(u.id) ? '<span class="online-dot" title="Clocked in"></span>' : ""}
          </div>`).join("")}
      </aside>
    </div>`;
}

// ---------------------------------------------------------------- reports
export const reportRangeMs = () => (S.reportRange ? S.reportRange * 864e5 : 0);

export function reportData(adm, me) {
  const from = S.reportRange ? Date.now() - reportRangeMs() : 0;
  const sessions = pSessions().filter((x) => x.start >= from && (adm || x.uid === me.id));
  const tasks = pTasks();
  const doneInRange = tasks.filter((t) => t.status === "Done" && t.doneAt && t.doneAt >= from);
  const onTime = doneInRange.filter((t) => day(t.doneAt) <= t.deadline).length;
  const today = day(Date.now());
  const overdue = tasks.filter((t) => t.status !== "Done" && t.deadline < today).length;
  const totalMs = sessions.reduce((a, x) => a + worked(x), 0);
  const members = projectMembers(cur());
  const rows = members.map((m) => {
    const mine = tasks.filter((t) => t.assignee === m.id);
    const ms = sessions.filter((x) => x.uid === m.id).reduce((a, x) => a + worked(x), 0);
    return {
      m,
      open: mine.filter((t) => t.status !== "Done").length,
      done: mine.filter((t) => t.status === "Done").length,
      late: mine.filter((t) => t.status !== "Done" && t.deadline < today).length,
      est: mine.filter((t) => t.status !== "Done").reduce((a, t) => a + (t.estimate || 0), 0),
      ms
    };
  });
  return { from, sessions, tasks, doneInRange, onTime, overdue, totalMs, rows };
}

export function reportsView(adm, me) {
  const r = reportData(adm, me);
  const rangeOpts = [{ val: 7, label: "Last 7 days" }, { val: 30, label: "Last 30 days" }, { val: 90, label: "Last 90 days" }, { val: 0, label: "All time" }];
  const rate = r.doneInRange.length ? Math.round((r.onTime / r.doneInRange.length) * 100) : null;

  return `
    <div class="projects-head" style="padding-bottom:8px;">
      <div><h3>Project Reports</h3><p>${adm ? "Time, delivery and workload for this project" : "Delivery for the team and your own logged hours"}</p></div>
      <div class="report-tools">
        <div class="filter-select" style="min-width:170px;">${customSelect({ data: "reportRange", options: rangeOpts, value: S.reportRange })}</div>
        <button type="button" class="select-filter" id="btnReportCsv">Export summary CSV</button>
      </div>
    </div>

    <div class="projects-kpis">
      <div class="kpi-card kpi-card-pine"><div class="kpi-label">${adm ? "Hours Logged" : "My Hours"}</div><div class="kpi-value-row"><span class="kpi-big-number">${hrs(r.totalMs)} h</span><span class="kpi-caption">${S.reportRange ? "In range" : "All time"}</span></div></div>
      <div class="kpi-card"><div class="kpi-label">Tasks Completed</div><div class="kpi-value-row"><span class="kpi-big-number">${r.doneInRange.length}</span><span class="kpi-caption">In range</span></div></div>
      <div class="kpi-card"><div class="kpi-label">On-time Delivery</div><div class="kpi-value-row"><span class="kpi-big-number">${rate === null ? "–" : rate + "%"}</span><span class="kpi-caption">${r.onTime}/${r.doneInRange.length} by deadline</span></div></div>
      <div class="kpi-card"><div class="kpi-label">Overdue Now</div><div class="kpi-value-row"><span class="kpi-big-number">${r.overdue}</span><span class="kpi-caption">${r.overdue ? "Needs attention" : "All on track"}</span></div></div>
    </div>

    <div class="reports-grid">
      <div class="full-width-card"><h4>Tasks by status</h4><div class="chart-box short"><canvas id="rpStatus"></canvas></div></div>
      <div class="full-width-card"><h4>Hours by category</h4><div class="chart-box short"><canvas id="rpHoursCat"></canvas></div></div>
      <div class="full-width-card"><h4>${adm ? "Hours by member" : "My hours per day"}</h4><div class="chart-box short"><canvas id="rpHoursMember"></canvas></div></div>
      <div class="full-width-card"><h4>Tasks completed per week</h4><div class="chart-box short"><canvas id="rpWeekly"></canvas></div></div>
    </div>

    <div class="full-width-card">
      <h3 style="margin-bottom:4px;">Team Summary</h3>
      <p class="muted-note" style="margin-bottom:12px;">${adm ? "Hours are for the selected range; tasks are current." : "Hours shown are only your own."}</p>
      <div style="overflow-x:auto"><table class="styled-table"><thead><tr><th>Member</th><th>Open</th><th>Done</th><th>Overdue</th><th>Open estimate</th><th>Hours logged</th></tr></thead><tbody>
        ${r.rows.length ? r.rows.map((x) => `
          <tr>
            <td><div class="cell-user">${miniAvatar(x.m, "xs")} ${esc(x.m.name)}</div></td>
            <td>${x.open}</td><td>${x.done}</td>
            <td>${x.late ? `<span class="tag-status over">${x.late}</span>` : 0}</td>
            <td>${Math.round(x.est * 10) / 10}h</td>
            <td>${adm || x.m.id === me.id ? hrs(x.ms) + " h" : "–"}</td>
          </tr>`).join("") : '<tr><td colspan="6" style="text-align:center;color:var(--text-light);">No members yet.</td></tr>'}
      </tbody></table></div>
    </div>`;
}

// ---------------------------------------------------------------- my tasks (across projects)
export function myTasksView(adm, me) {
  const mineAll = adm ? S.tasks : S.tasks.filter((t) => t.assignee === me.id);
  const tab = S.myTasksTab;
  const list = mineAll
    .filter((t) => (tab === "open" ? t.status !== "Done" : tab === "done" ? t.status === "Done" : true))
    .sort((a, b) => a.deadline.localeCompare(b.deadline));
  const count = (f) => mineAll.filter(f).length;
  const chip = (key, label, n) => `<button type="button" class="person-chip ${tab === key ? "active" : ""}" data-mytasks="${key}">${label} <em>${n}</em></button>`;

  return `
    <div class="full-width-card">
      <div class="tasks-header-bar">
        <div>
          <h3>${adm ? "All Tasks Across Projects" : "My Tasks Across Projects"}</h3>
          <p style="color: var(--text-muted); font-size: 13px; margin-top: 2px;">Everything assigned ${adm ? "in every project" : "to you"}, soonest deadline first. Click a task for details.</p>
        </div>
      </div>
      <div class="filter-people" style="margin-bottom:12px;">
        ${chip("open", "Open", count((t) => t.status !== "Done"))}${chip("done", "Done", count((t) => t.status === "Done"))}${chip("all", "All", mineAll.length)}
      </div>
      <div style="overflow-x:auto"><table class="styled-table"><thead><tr><th>Task</th><th>Project</th>${adm ? "<th>Assignee</th>" : ""}<th>Priority</th><th>Deadline</th><th>Status</th><th>State</th></tr></thead><tbody>
        ${list.length ? list.map((t) => {
          const [lbl, cls] = tstate(t);
          return `
            <tr>
              <td><button type="button" class="task-link" data-open-task="${t.id}">${esc(t.title)}</button></td>
              <td><button type="button" class="project-link" data-goto-project="${esc(t.projectId)}"><span class="dot" style="background:${pcolor(t.projectId)}"></span>${esc(pname(t.projectId))}</button></td>
              ${adm ? `<td>${esc(user(t.assignee)?.name || "–")}</td>` : ""}
              <td><span class="prio-chip prio-${PRIORITY_CLASS[prio(t)]}">${prio(t)}</span></td>
              <td>${t.deadline}</td>
              <td><span class="tag-status ${statusClass(t.status)}">${esc(t.status)}</span></td>
              <td><span class="tag-status ${cls}">${lbl}</span></td>
            </tr>`;
        }).join("") : `<tr><td colspan="${adm ? 7 : 6}" style="text-align:center;color:var(--text-light);">Nothing here. 🎉</td></tr>`}
      </tbody></table></div>
    </div>`;
}

// ---------------------------------------------------------------- dashboard extras
export function activityItems(list) {
  if (!list || !list.length) return '<p class="muted-note">No activity yet.</p>';
  return list
    .slice(0, 12)
    .map((a) => {
      const u = user(a.uid);
      return `
        <div class="activity-item">
          <span class="mini-avatar">${esc(initial(u?.name))}</span>
          <div><span><b>${esc(u?.name || "Someone")}</b> ${esc(a.text)}</span><small>${ago(a.at)}</small></div>
        </div>`;
    })
    .join("");
}

export function dashboardExtras(adm, me) {
  const project = cur();
  if (!project) return "";
  const tasks = pTasks();
  const members = projectMembers(project);
  const act = activeSprint();
  const today = day(Date.now());
  const soon = day(Date.now() + 7 * 864e5);

  let sprintCard;
  if (act) {
    const st = tasks.filter((t) => t.sprintId === act.id);
    const done = st.filter((t) => t.status === "Done").length;
    const pct = st.length ? Math.round((done / st.length) * 100) : 0;
    const left = daysBetween(today, act.end);
    sprintCard = `
      <h4>Active Sprint</h4>
      <div class="sprint-title"><b>${esc(act.name)}</b><span class="tag-status track">${left >= 0 ? left + "d left" : "ended"}</span></div>
      ${act.goal ? `<p class="muted-note">${esc(act.goal)}</p>` : ""}
      <div class="project-progress-meta" style="margin-top:12px;"><span>Progress</span><span>${done}/${st.length} done</span></div>
      <div class="project-progress-bar"><span style="width:${pct}%"></span></div>
      <button type="button" class="link-btn" style="margin-top:12px;" data-goto-tab="sprints">View sprint board →</button>`;
  } else {
    sprintCard = `<h4>Active Sprint</h4><p class="muted-note">No sprint is running.</p><button type="button" class="link-btn" data-goto-tab="sprints">${adm ? "Plan a sprint →" : "View sprints →"}</button>`;
  }

  const open = (uid) => tasks.filter((t) => t.assignee === uid && t.status !== "Done").length;
  const maxOpen = Math.max(1, ...members.map((m) => open(m.id)));
  const workload = members.length
    ? members.map((m) => `
        <div class="workload-row">
          <span class="wl-name">${esc(m.name.split(" ")[0])}</span>
          <div class="wl-bar"><span style="width:${(open(m.id) / maxOpen) * 100}%"></span></div>
          <span class="wl-n">${open(m.id)}</span>
        </div>`).join("")
    : '<p class="muted-note">No members yet.</p>';

  const mine = (t) => adm || t.assignee === me.id;
  const upcoming = tasks
    .filter((t) => t.status !== "Done" && t.deadline <= soon && mine(t))
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
    .slice(0, 6);

  return `
    <div class="dashboard-extra">
      <div class="extra-card">${sprintCard}</div>
      <div class="extra-card"><h4>Workload</h4><p class="muted-note" style="margin-bottom:10px;">Open tasks per person</p>${workload}</div>
      <div class="extra-card">
        <h4>Due this week</h4>
        ${upcoming.length ? upcoming.map((t) => {
          const [lbl, cls] = tstate(t);
          return `<button type="button" class="due-item" data-open-task="${t.id}"><span>${esc(t.title)}<small>${esc(user(t.assignee)?.name || "")} · ${t.deadline}</small></span><span class="tag-status ${cls}">${lbl}</span></button>`;
        }).join("") : '<p class="muted-note">Nothing due in the next 7 days. 🎉</p>'}
      </div>
      <div class="extra-card wide"><h4>Recent Activity</h4><div id="activityFeed" data-project="${esc(project.id)}">${activityItems(S.activity?.[project.id])}</div></div>
    </div>`;
}
