import { S, TASK_TYPES, TYPES, PRIORITIES } from "./state.js";
import { API, db } from "./api.js";
import { toast } from "./toast.js";
import { esc, user, hrs, uid, active, initial, ago, richText, prio, PRIORITY_CLASS, sprintsOf, sprint, tstate, projectMembers, project as projectById } from "./utils.js";
import { activityItems } from "./views-extra.js";

let state = null; // { id, detail, root }

const sel = (id, options, value, disabled = false) =>
  `<select id="${id}" class="td-select" ${disabled ? "disabled" : ""}>${options
    .map((o) => `<option value="${esc(o.val)}" ${String(o.val) === String(value ?? "") ? "selected" : ""}>${esc(o.label)}</option>`)
    .join("")}</select>`;

export function closeTaskDrawer() {
  if (!state) return;
  const { root } = state;
  root.classList.remove("open");
  setTimeout(() => root.remove(), 180);
  document.removeEventListener("keydown", onKey);
  state = null;
}
const onKey = (e) => {
  if (e.key === "Escape" && !document.querySelector(".tc-modal-overlay.open, .confirm-overlay.open")) closeTaskDrawer();
};

export async function openTaskDrawer(taskId) {
  if (!S.tasks.find((t) => t.id === taskId)) return;
  closeTaskDrawer();

  const root = document.createElement("div");
  root.className = "td-overlay";
  root.innerHTML = '<aside class="td-panel" role="dialog" aria-label="Task details"><div class="td-loading">Loading…</div></aside>';
  document.body.appendChild(root);
  requestAnimationFrame(() => root.classList.add("open"));
  root.addEventListener("mousedown", (e) => {
    if (e.target === root) closeTaskDrawer();
  });
  document.addEventListener("keydown", onKey);

  state = { id: taskId, root, detail: { comments: [], activity: [], timeMs: 0, byUser: [] } };
  paint();
  await refresh();
}

async function refresh() {
  if (!state) return;
  const id = state.id;
  try {
    const d = await API("GET", `/tasks/${id}/detail`);
    if (state && state.id === id) {
      state.detail = d;
      paint();
    }
  } catch (e) {}
}

// Save helper: runs the update, then repaints with fresh data
async function save(payload, okMsg) {
  try {
    await db.doc("tasks/" + state.id).update(payload);
    if (okMsg) toast.success(okMsg);
    await refresh();
  } catch (e) {
    toast.error(e.message || "Couldn't save changes");
    paint();
  }
}

function paint() {
  if (!state) return;
  const t = S.tasks.find((x) => x.id === state.id);
  const panel = state.root.querySelector(".td-panel");
  if (!t) {
    closeTaskDrawer();
    return;
  }

  // Keep what's being typed in the comment box while we repaint
  const draft = panel.querySelector("#tdComment")?.value || "";

  const me = user(S.me);
  const adm = me.role === "admin";
  const proj = projectById(t.projectId);
  const archived = proj?.status === "archived";
  const manage = !archived && (adm || (t.createdBy === me.id && t.assignee === me.id));
  const mine = !archived && t.assignee === me.id;
  const edit = manage || mine;
  const members = projectMembers(proj);
  const sps = sprintsOf(t.projectId).filter((s) => s.status !== "completed");
  const cur = t.sprintId ? sprint(t.sprintId) : null;
  const subs = t.subtasks || [];
  const [lbl, cls] = tstate(t);
  const p = prio(t);
  const d = state.detail;
  const est = t.estimate || 0;
  const loggedH = d.timeMs / 36e5;
  const pct = est ? Math.min(100, Math.round((loggedH / est) * 100)) : 0;
  const running = active(me.id);

  panel.innerHTML = `
    <div class="td-head">
      <div class="td-crumb">${esc(proj?.name || "Project")} <span>·</span> <span class="tag-status ${cls}">${lbl}</span></div>
      <button type="button" class="td-close" data-td-close aria-label="Close">&times;</button>
    </div>

    <div class="td-body">
      ${manage
        ? `<input id="tdTitle" class="td-title-input" maxlength="200" value="${esc(t.title)}">`
        : `<h2 class="td-title">${esc(t.title)}</h2>`}

      <div class="td-status-row">
        <label>Status</label>
        ${sel("tdStatus", ["To do", "In progress", "Done"].map((s) => ({ val: s, label: s })), t.status, !edit)}
        ${mine && t.status !== "Done" ? `<button type="button" class="select-filter" id="tdStart" ${running ? 'disabled title="You are already clocked in"' : ""}>▶ Start timer</button>` : ""}
      </div>

      <div class="td-grid">
        <div><label>Priority</label>${manage ? sel("tdPriority", PRIORITIES.map((x) => ({ val: x, label: x })), p) : `<span class="prio-chip prio-${PRIORITY_CLASS[p]}">${p}</span>`}</div>
        <div><label>Assignee</label>${adm && !archived ? sel("tdAssignee", members.map((m) => ({ val: m.id, label: m.name })), t.assignee) : `<span>${esc(user(t.assignee)?.name || "–")}</span>`}</div>
        <div><label>Sprint</label>${manage ? sel("tdSprint", [{ val: "", label: "Backlog" }, ...sps.map((s) => ({ val: s.id, label: s.name }))], t.sprintId || "") : cur ? `<span class="sprint-chip ${cur.status}">${esc(cur.name)}</span>` : "<span>Backlog</span>"}</div>
        <div><label>Deadline</label>${manage ? `<input id="tdDeadline" type="date" class="td-input" value="${esc(t.deadline)}">` : `<span>${esc(t.deadline)}</span>`}</div>
        <div><label>Category</label>${manage ? sel("tdType", (TASK_TYPES || TYPES).map((x) => ({ val: x, label: x })), t.type) : `<span>${esc(t.type || "General")}</span>`}</div>
        <div><label>Estimate (h)</label>${manage ? `<input id="tdEstimate" type="number" min="0" max="1000" step="0.5" class="td-input" value="${est || ""}">` : `<span>${est ? est + "h" : "–"}</span>`}</div>
      </div>

      <div class="td-section">
        <label>Labels</label>
        ${edit ? `<input id="tdLabels" class="td-input" placeholder="comma separated" maxlength="120" value="${esc((t.labels || []).join(", "))}">`
          : `<div class="card-chips">${(t.labels || []).map((l) => `<span class="label-chip">${esc(l)}</span>`).join("") || "<span class='muted-note'>None</span>"}</div>`}
      </div>

      <div class="td-section">
        <label>Description</label>
        ${edit ? `<textarea id="tdDesc" class="td-textarea" rows="4" maxlength="2000" placeholder="Add details…">${esc(t.description || "")}</textarea>`
          : `<div class="td-desc">${t.description ? richText(t.description) : "<span class='muted-note'>No description.</span>"}</div>`}
      </div>

      ${edit ? `<div class="td-save-row"><button type="button" class="btn-primary" id="tdSave">Save changes</button></div>` : ""}

      <div class="td-section">
        <label>Time logged</label>
        <div class="td-time">
          <b>${hrs(d.timeMs)} h</b>${est ? ` of ${est}h estimated` : ""}
          ${est ? `<div class="project-progress-bar"><span style="width:${pct}%;${loggedH > est ? "background:var(--accent-red)" : ""}"></span></div>` : ""}
          ${d.byUser.length ? `<div class="td-time-users">${d.byUser.map((x) => `<span><i class="mini-avatar xs">${esc(initial(user(x.uid)?.name))}</i> ${esc((user(x.uid)?.name || "–").split(" ")[0])} · ${hrs(x.ms)}h</span>`).join("")}</div>` : '<p class="muted-note">No time tracked on this task yet.</p>'}
        </div>
      </div>

      <div class="td-section">
        <label>Checklist ${subs.length ? `<em>${subs.filter((s) => s.done).length}/${subs.length}</em>` : ""}</label>
        ${subs.length ? `<div class="project-progress-bar" style="margin-bottom:10px;"><span style="width:${Math.round((subs.filter((s) => s.done).length / subs.length) * 100)}%"></span></div>` : ""}
        <div class="td-subtasks">
          ${subs.map((s) => `
            <div class="td-sub ${s.done ? "done" : ""}">
              <label class="td-check"><input type="checkbox" data-sub-toggle="${esc(s.id)}" ${s.done ? "checked" : ""} ${edit ? "" : "disabled"}><span>${esc(s.title)}</span></label>
              ${edit ? `<button type="button" class="td-x" data-sub-del="${esc(s.id)}" title="Remove">&times;</button>` : ""}
            </div>`).join("") || (edit ? "" : "<span class='muted-note'>No checklist items.</span>")}
        </div>
        ${edit ? `<div class="td-add-row"><input id="tdSubNew" class="td-input" maxlength="120" placeholder="Add a checklist item…"><button type="button" class="select-filter" id="tdSubAdd">Add</button></div>` : ""}
      </div>

      <div class="td-section">
        <label>Comments (${d.comments.length})</label>
        <div class="td-comments">
          ${d.comments.map((c) => `
            <div class="td-comment">
              <span class="mini-avatar">${esc(initial(user(c.uid)?.name))}</span>
              <div>
                <div class="td-c-head"><b>${esc(user(c.uid)?.name || "Someone")}</b><small>${ago(c.at)}</small>
                  ${c.uid === me.id || adm ? `<button type="button" class="td-x" data-comment-del="${esc(c.id)}" title="Delete">&times;</button>` : ""}</div>
                <div class="td-c-body">${richText(c.text)}</div>
              </div>
            </div>`).join("") || "<p class='muted-note'>No comments yet. Start the conversation.</p>"}
        </div>
        <div class="td-composer">
          <textarea id="tdComment" class="td-textarea" rows="2" maxlength="1000" placeholder="Write a comment… use @username to mention"></textarea>
          <div class="td-composer-row">
            <div class="mention-row">${members.concat(S.users.filter((u) => u.role === "admin")).filter((u) => u.id !== me.id && u.username).slice(0, 8).map((u) => `<button type="button" class="mention-chip" data-td-mention="${esc(u.username)}">@${esc(u.username)}</button>`).join("")}</div>
            <button type="button" class="btn-primary" id="tdPost">Comment</button>
          </div>
        </div>
      </div>

      <div class="td-section">
        <label>Activity</label>
        <div class="activity-list">${activityItems(d.activity)}</div>
      </div>

      ${manage ? `<div class="td-danger"><button type="button" class="btn-action-del" id="tdDelete">Delete task</button></div>` : ""}
    </div>`;

  const ta = panel.querySelector("#tdComment");
  if (ta) ta.value = draft;
  bind(panel, t, me, adm);
}

function bind(panel, t, me, adm) {
  const $q = (s) => panel.querySelector(s);
  panel.querySelectorAll("[data-td-close]").forEach((b) => (b.onclick = closeTaskDrawer));

  $q("#tdStatus")?.addEventListener("change", (e) => {
    if (e.target.value !== t.status) save({ status: e.target.value }, `Moved to "${e.target.value}".`);
  });

  $q("#tdSave")?.addEventListener("click", () => {
    const payload = {};
    if ($q("#tdTitle")) {
      const title = $q("#tdTitle").value.trim();
      if (!title) return toast.warning("Title can't be empty.");
      payload.title = title;
      payload.priority = $q("#tdPriority").value;
      payload.sprintId = $q("#tdSprint").value || null;
      payload.deadline = $q("#tdDeadline").value;
      payload.type = $q("#tdType").value;
      payload.estimate = $q("#tdEstimate").value || 0;
    }
    if ($q("#tdAssignee") && $q("#tdAssignee").value !== t.assignee) payload.assignee = $q("#tdAssignee").value;
    if ($q("#tdLabels")) payload.labels = $q("#tdLabels").value;
    if ($q("#tdDesc")) payload.description = $q("#tdDesc").value;
    save(payload, "Task updated.");
  });

  $q("#tdStart")?.addEventListener("click", async () => {
    try {
      await db.doc("sessions/" + uid()).set({
        uid: me.id,
        projectId: t.projectId,
        type: t.type || (TASK_TYPES || TYPES)[0],
        taskId: t.id,
        start: Date.now(),
        end: null,
        breaks: []
      });
      toast.success(`Timer started on "${t.title}".`, "Shift Started");
      paint();
    } catch (e) {
      toast.error(e.message || "Couldn't start the timer");
    }
  });

  // ---- checklist (saved immediately)
  const writeSubs = (fn) => save({ subtasks: fn((t.subtasks || []).map((s) => ({ ...s }))) });
  panel.querySelectorAll("[data-sub-toggle]").forEach((cb) => {
    cb.onchange = () => writeSubs((arr) => arr.map((s) => (s.id === cb.dataset.subToggle ? { ...s, done: cb.checked } : s)));
  });
  panel.querySelectorAll("[data-sub-del]").forEach((b) => {
    b.onclick = () => writeSubs((arr) => arr.filter((s) => s.id !== b.dataset.subDel));
  });
  const addSub = () => {
    const v = $q("#tdSubNew")?.value.trim();
    if (!v) return;
    writeSubs((arr) => [...arr, { id: uid(), title: v, done: false }]);
  };
  $q("#tdSubAdd")?.addEventListener("click", addSub);
  $q("#tdSubNew")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addSub();
    }
  });

  // ---- comments
  const post = async () => {
    const box = $q("#tdComment");
    const text = box.value.trim();
    if (!text) return;
    $q("#tdPost").disabled = true;
    try {
      await API("POST", `/tasks/${t.id}/comments`, { text });
      box.value = "";
      await refresh();
    } catch (e) {
      toast.error(e.message || "Couldn't post the comment");
      $q("#tdPost").disabled = false;
    }
  };
  $q("#tdPost")?.addEventListener("click", post);
  $q("#tdComment")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) post();
  });
  panel.querySelectorAll("[data-td-mention]").forEach((b) => {
    b.onclick = () => {
      const box = $q("#tdComment");
      box.value += (box.value && !/\s$/.test(box.value) ? " " : "") + "@" + b.dataset.tdMention + " ";
      box.focus();
    };
  });
  panel.querySelectorAll("[data-comment-del]").forEach((b) => {
    b.onclick = async () => {
      try {
        await API("DELETE", `/tasks/${t.id}/comments/${b.dataset.commentDel}`);
        await refresh();
      } catch (e) {
        toast.error(e.message || "Couldn't delete the comment");
      }
    };
  });

  $q("#tdDelete")?.addEventListener("click", async () => {
    const ok = await toast.confirm({ title: "Delete Task", message: `Permanently delete "${t.title}" and its comments?`, confirmText: "Delete", isDanger: true });
    if (!ok) return;
    try {
      await db.doc("tasks/" + t.id).delete();
      toast.info("Task deleted.");
      closeTaskDrawer();
    } catch (e) {
      toast.error(e.message || "Couldn't delete the task");
    }
  });
}
