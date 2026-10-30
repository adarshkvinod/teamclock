// Event wiring for the team-collaboration features (filters, drawer, sprints, chat, reports, time entries…)
import { S, TASK_TYPES, TYPES, defaultFilters, saveProjectSelection } from "./state.js";
import { API, db, loadData } from "./api.js";
import { toast } from "./toast.js";
import { openModal } from "./modal.js";
import { bindBell, openProfile } from "./notifications.js";
import { openTaskDrawer } from "./taskDrawer.js";
import { bindChat, stopChat } from "./chat.js";
import { activityItems, reportData } from "./views-extra.js";
import {
  esc, uid, user, cur, pTasks, pname, sprintsOf, day, hrs, active, filterTasks, csvCell, downloadCsv, worked, sprint
} from "./utils.js";

const render = () => window.dispatchEvent(new CustomEvent("app:render"));
let globalsBound = false;

// ---- listeners that must exist exactly once (delegated on document)
function bindGlobals() {
  if (globalsBound) return;
  globalsBound = true;

  window.addEventListener("app:reload", () => loadData(false).catch(() => {}));

  // custom dropdown filters dispatch "change" on their hidden input
  document.addEventListener("change", (e) => {
    const el = e.target;
    if (!el.matches || !el.matches("input[data-filter]")) return;
    const key = el.dataset.filter;
    if (key === "reportRange") S.reportRange = Number(el.value) || 0;
    else if (key === "sheetRange") S.sheetRange = el.value;
    else if (key === "sheetEmp") S.sheetEmp = el.value;
    else S.tf[key] = el.value;
    render();
  });

  // open the task drawer from any task link / card
  document.addEventListener("click", (e) => {
    const link = e.target.closest("[data-open-task]");
    if (link) {
      openTaskDrawer(link.dataset.openTask);
      return;
    }
    const card = e.target.closest(".kanban-card");
    if (card && card.dataset.taskId && !card.classList.contains("kanban-card-floating")) {
      if (e.target.closest("button, a, input, select, textarea")) return;
      if (Date.now() - (S._dragEnd || 0) < 250) return; // the click that ends a drag
      openTaskDrawer(card.dataset.taskId);
    }
  });
}

const parseLabels = (v) => (v || "").split(",").map((x) => x.trim()).filter(Boolean);

export function bindExtraEvents(me) {
  bindGlobals();
  const adm = me.role === "admin";
  const $ = (s) => document.querySelector(s);
  const on = (sel, fn) => {
    const el = $(sel);
    if (el) el.onclick = fn;
  };
  const all = (sel, fn) => document.querySelectorAll(sel).forEach(fn);

  bindBell();
  all("[data-profile]", (el) => (el.onclick = openProfile));

  // ================= navigation helpers =================
  all("[data-goto-tab]", (b) => (b.onclick = () => { S.tab = b.dataset.gotoTab; render(); }));
  all("[data-goto-project]", (b) => (b.onclick = () => {
    saveProjectSelection(me.id, b.dataset.gotoProject);
    S.tab = "tasks";
    render();
  }));
  all("[data-mytasks]", (b) => (b.onclick = () => { S.myTasksTab = b.dataset.mytasks; render(); }));

  // ================= task board: form, filters, views =================
  on("#btnNewTask", () => { S.showTaskForm = !S.showTaskForm; render(); });
  on("#btnCloseTaskForm", () => { S.showTaskForm = false; render(); });

  all("[data-filter-assignee]", (b) => (b.onclick = () => { S.tf.assignee = b.dataset.filterAssignee; render(); }));
  all("[data-filter-toggle]", (b) => (b.onclick = () => { S.tf[b.dataset.filterToggle] = !S.tf[b.dataset.filterToggle]; render(); }));
  on("#tfClear", () => { S.tf = defaultFilters(); render(); });

  const search = $("#tfSearch");
  if (search) {
    let t;
    search.oninput = () => {
      S.tf.q = search.value;
      clearTimeout(t);
      t = setTimeout(() => {
        const pos = search.selectionStart;
        render();
        const n = document.getElementById("tfSearch");
        if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} }
      }, 220);
    };
  }

  all("[data-cal-nav]", (b) => (b.onclick = () => {
    const now = new Date();
    const c = S.calT || { y: now.getFullYear(), m: now.getMonth() };
    const step = Number(b.dataset.calNav);
    const d = step === 0 ? now : new Date(c.y, c.m + step, 1);
    S.calT = { y: d.getFullYear(), m: d.getMonth() };
    render();
  }));

  all("[data-cal-day]", (b) => (b.onclick = () => {
    const k = b.dataset.calDay;
    const list = filterTasks(pTasks(), adm, me).filter((t) => t.deadline === k);
    openModal({
      title: `Due ${k}`,
      subtitle: `${list.length} tasks`,
      cancelText: "Close",
      confirmText: "",
      body: `<div class="due-list">${list.map((t) => `<button type="button" class="due-item" data-open-task="${t.id}"><span>${esc(t.title)}<small>${esc(user(t.assignee)?.name || "")}</small></span><span class="tag-status ${t.status === "Done" ? "done" : t.status === "In progress" ? "progress" : "todo"}">${esc(t.status)}</span></button>`).join("")}</div>`,
      onOpen: (root) => root.querySelectorAll("[data-open-task]").forEach((x) => x.addEventListener("click", () => root.querySelector("[data-modal-close]").click()))
    });
  }));

  // ---- create task (admin: any member, employee: self). Replaces the basic handler with the full field set.
  const ac = $("#ac");
  if (ac) {
    ac.onclick = async () => {
      const t = $("#nt").value.trim();
      const a = $("#na")?.value;
      const d = $("#nd")?.value;
      if (!t) { toast.warning("Please enter a task title.", "Title Required"); $("#nt").focus(); return; }
      if (!a) { toast.warning("Please select an assignee.", "Assignee Required"); return; }
      if (!d) { toast.warning("Please choose a deadline date.", "Deadline Required"); return; }

      ac.disabled = true;
      try {
        await db.doc("tasks/" + uid()).set({
          title: t,
          projectId: S.projectId,
          assignee: a,
          deadline: d,
          type: $("#ntype")?.value || (TASK_TYPES || TYPES)[0],
          priority: $("#np")?.value || "Medium",
          sprintId: $("#ns")?.value || null,
          estimate: $("#ne")?.value || 0,
          labels: parseLabels($("#nl")?.value),
          description: $("#ndesc")?.value.trim() || ""
        });
        toast.success(`Task "${t}" has been created.`, "Task Created");
      } catch (err) {
        toast.error(err.message || "Failed to create task");
      } finally {
        ac.disabled = false;
      }
    };
  }

  // ---- start a timer straight from a card
  all("[data-start-task]", (b) => (b.onclick = async (e) => {
    e.stopPropagation();
    const t = S.tasks.find((x) => x.id === b.dataset.startTask);
    if (!t) return;
    if (active(me.id)) { toast.warning("You're already clocked in. Clock out first.", "Shift Running"); return; }
    try {
      await db.doc("sessions/" + uid()).set({ uid: me.id, projectId: t.projectId, type: t.type || (TASK_TYPES || TYPES)[0], taskId: t.id, start: Date.now(), end: null, breaks: [] });
      toast.success(`Timer started on "${t.title}".`, "Shift Started");
    } catch (err) {
      toast.error(err.message || "Couldn't start the timer");
    }
  }));

  on("#btnTasksCsv", () => {
    const list = filterTasks(pTasks(), adm, me).sort((a, b) => a.deadline.localeCompare(b.deadline));
    const rows = [
      "Project,Task,Category,Priority,Status,Assignee,Sprint,Deadline,Estimate (h),Labels,Checklist,Created,Completed",
      ...list.map((t) => [
        pname(t.projectId), t.title, t.type, t.priority || "Medium", t.status, user(t.assignee)?.name,
        t.sprintId ? sprint(t.sprintId)?.name : "", t.deadline, t.estimate || "", (t.labels || []).join("; "),
        (t.subtasks || []).length ? `${t.subtasks.filter((s) => s.done).length}/${t.subtasks.length}` : "",
        t.created ? day(t.created) : "", t.doneAt ? day(t.doneAt) : ""
      ].map(csvCell).join(","))
    ];
    downloadCsv(`tasks_${(cur()?.name || "project").toLowerCase().replace(/[^a-z0-9]+/g, "_")}.csv`, rows);
  });

  // ================= sprints =================
  const sprintForm = (sp) => `
    <div class="input-group" style="margin-bottom:14px;"><label>Sprint name</label><input id="spName" maxlength="60" value="${esc(sp?.name || "")}" placeholder="e.g. Sprint 4"></div>
    <div class="input-group" style="margin-bottom:14px;"><label>Goal (optional)</label><input id="spGoal" maxlength="200" value="${esc(sp?.goal || "")}" placeholder="What should this sprint achieve?"></div>
    <div class="form-grid-3" style="margin-bottom:0;">
      <div class="input-group"><label>Start</label><input id="spStart" type="date" value="${esc(sp?.start || day(Date.now()))}"></div>
      <div class="input-group"><label>End</label><input id="spEnd" type="date" value="${esc(sp?.end || day(Date.now() + 13 * 864e5))}"></div>
    </div>`;
  const readSprint = (root) => ({
    name: root.querySelector("#spName").value.trim(),
    goal: root.querySelector("#spGoal").value.trim(),
    start: root.querySelector("#spStart").value,
    end: root.querySelector("#spEnd").value
  });

  on("#btnNewSprint", () => openModal({
    title: "New Sprint",
    subtitle: `in ${cur()?.name || ""}`,
    confirmText: "Create Sprint",
    body: sprintForm(),
    onSubmit: async (root) => {
      const v = readSprint(root);
      if (!v.name) throw new Error("Give the sprint a name");
      await db.doc("sprints/" + uid()).set({ projectId: S.projectId, ...v });
      toast.success(`Sprint "${v.name}" created.`);
    }
  }));

  all("[data-sprint-edit]", (b) => (b.onclick = () => {
    const sp = sprint(b.dataset.sprintEdit);
    if (!sp) return;
    openModal({
      title: "Edit Sprint",
      body: sprintForm(sp),
      onSubmit: async (root) => {
        await db.doc("sprints/" + sp.id).update(readSprint(root));
        toast.success("Sprint updated.");
      }
    });
  }));

  all("[data-sprint-start]", (b) => (b.onclick = async () => {
    const sp = sprint(b.dataset.sprintStart);
    if (!sp) return;
    const n = pTasks().filter((t) => t.sprintId === sp.id).length;
    const ok = await toast.confirm({ title: "Start Sprint", message: `Start "${sp.name}" with ${n} task${n === 1 ? "" : "s"}? Everyone on the project will be notified.`, confirmText: "Start Sprint", isDanger: false });
    if (!ok) return;
    try {
      await db.doc("sprints/" + sp.id).update({ status: "active" });
      toast.success(`"${sp.name}" is now active.`, "Sprint Started");
    } catch (err) {
      toast.error(err.message || "Couldn't start the sprint");
    }
  }));

  all("[data-sprint-complete]", (b) => (b.onclick = () => {
    const sp = sprint(b.dataset.sprintComplete);
    if (!sp) return;
    const st = pTasks().filter((t) => t.sprintId === sp.id);
    const open = st.filter((t) => t.status !== "Done").length;
    const targets = sprintsOf().filter((s) => s.status === "planned");
    openModal({
      title: `Complete ${sp.name}`,
      subtitle: `${st.length - open} of ${st.length} tasks are done`,
      confirmText: "Complete Sprint",
      body: open
        ? `<p class="muted-note" style="margin-bottom:12px;">${open} unfinished task${open === 1 ? "" : "s"} will move to:</p>
           <div class="input-group"><select id="spMove" class="td-select"><option value="backlog">Backlog</option>${targets.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select></div>`
        : '<p class="muted-note">Everything is done. Nice work! 🎉</p>',
      onSubmit: async (root) => {
        await db.doc("sprints/" + sp.id).update({ status: "completed", moveTo: root.querySelector("#spMove")?.value || "backlog" });
        toast.success(`"${sp.name}" completed.`, "Sprint Completed");
      }
    });
  }));

  all("[data-sprint-delete]", (b) => (b.onclick = async () => {
    const sp = sprint(b.dataset.sprintDelete);
    if (!sp) return;
    const ok = await toast.confirm({ title: "Delete Sprint", message: `Delete "${sp.name}"? Its tasks go back to the backlog.`, confirmText: "Delete", isDanger: true });
    if (!ok) return;
    try { await db.doc("sprints/" + sp.id).delete(); toast.info("Sprint deleted."); } catch (err) { toast.error(err.message || "Couldn't delete the sprint"); }
  }));

  all("[data-assign-sprint]", (sel) => (sel.onchange = async () => {
    try {
      await db.doc("tasks/" + sel.dataset.assignSprint).update({ sprintId: sel.value || null });
      toast.success(sel.value ? "Added to sprint." : "Moved to backlog.");
    } catch (err) {
      toast.error(err.message || "Couldn't update the task");
      render();
    }
  }));

  // ================= reports =================
  on("#btnReportCsv", () => {
    const r = reportData(adm, me);
    downloadCsv(`report_${(cur()?.name || "project").toLowerCase().replace(/[^a-z0-9]+/g, "_")}.csv`, [
      "Member,Open tasks,Done tasks,Overdue,Open estimate (h),Hours logged",
      ...r.rows.map((x) => [x.m.name, x.open, x.done, x.late, Math.round(x.est * 10) / 10, adm || x.m.id === me.id ? hrs(x.ms) : ""].map(csvCell).join(","))
    ]);
  });

  // ================= manual time entry =================
  on("#btnManualTime", () => {
    const tasks = pTasks().filter((t) => adm || t.assignee === me.id);
    const types = TASK_TYPES || TYPES;
    openModal({
      title: "Add Time Entry",
      subtitle: `Log work you forgot to clock in for · ${cur()?.name || ""}`,
      confirmText: "Add Entry",
      body: `
        <div class="input-group" style="margin-bottom:14px;"><label>Task</label>
          <select id="mtTask" class="td-select"><option value="">No specific task</option>${tasks.map((t) => `<option value="${t.id}" data-type="${esc(t.type || "")}">${esc(t.title)}</option>`).join("")}</select></div>
        <div class="input-group" style="margin-bottom:14px;"><label>Work type</label>
          <select id="mtType" class="td-select">${types.map((t) => `<option>${esc(t)}</option>`).join("")}</select></div>
        <div class="form-grid-3" style="margin-bottom:0;">
          <div class="input-group"><label>Date</label><input id="mtDate" type="date" value="${day(Date.now())}" max="${day(Date.now())}"></div>
          <div class="input-group"><label>Start</label><input id="mtStart" type="time" value="09:00"></div>
          <div class="input-group"><label>End</label><input id="mtEnd" type="time" value="10:00"></div>
          <div class="input-group"><label>Break (min)</label><input id="mtBreak" type="number" min="0" max="600" value="0"></div>
        </div>`,
      onOpen: (root) => {
        const taskSel = root.querySelector("#mtTask");
        taskSel.onchange = () => {
          const t = taskSel.selectedOptions[0]?.dataset.type;
          if (t) root.querySelector("#mtType").value = t;
        };
      },
      onSubmit: async (root) => {
        const date = root.querySelector("#mtDate").value;
        const start = new Date(`${date}T${root.querySelector("#mtStart").value}`).getTime();
        const end = new Date(`${date}T${root.querySelector("#mtEnd").value}`).getTime();
        if (!Number.isFinite(start) || !Number.isFinite(end)) throw new Error("Pick a date, start and end time");
        await API("POST", "/sessions/manual", {
          projectId: S.projectId,
          type: root.querySelector("#mtType").value,
          taskId: root.querySelector("#mtTask").value,
          start,
          end,
          breakMinutes: Number(root.querySelector("#mtBreak").value) || 0
        });
        await loadData(false);
        toast.success("Time entry added.", "Saved");
      }
    });
  });

  // ================= dashboard activity feed (loaded on demand) =================
  const feed = $("#activityFeed");
  if (feed) {
    const pid = feed.dataset.project;
    API("GET", `/projects/${pid}/activity`)
      .then((r) => {
        S.activity[pid] = r.activity;
        const el = document.getElementById("activityFeed");
        if (el && el.dataset.project === pid) el.innerHTML = activityItems(r.activity);
      })
      .catch(() => {});
  }

  // ================= chat =================
  if (S.tab === "chat") bindChat(me);
  else stopChat();
}
