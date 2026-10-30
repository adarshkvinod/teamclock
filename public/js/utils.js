import { S } from "./state.js";

export const $ = (s) => document.querySelector(s);

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));

export const uid = () => "id" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

export const hrs = (ms) => (ms / 36e5).toFixed(1);

export const dur = (ms) => {
  ms = Math.max(0, ms);
  const s = Math.floor(ms / 1e3);
  return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60]
    .map((x) => String(x).padStart(2, "0"))
    .join(":");
};

export const day = (t) => {
  const d = new Date(t);
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
};

export const weekStart = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
};

export const worked = (s) =>
  (s.end || Date.now()) - s.start - (s.breaks || []).reduce((a, b) => a + ((b.e || s.end || Date.now()) - b.s), 0);

export const user = (id) => S.users?.find((u) => u.id === id);

export const project = (id) => S.projects?.find((p) => p.id === id);

export const pname = (id) => (id ? project(id)?.name || "Former project" : "–");

// The project currently opened (null on the Projects home page)
export const cur = () => (S.projectId ? project(S.projectId) || null : null);

// Tasks / sessions limited to the opened project (everything when none is open)
export const pTasks = () => (S.projectId ? (S.tasks || []).filter((t) => t.projectId === S.projectId) : S.tasks || []);
export const pSessions = () =>
  S.projectId ? (S.sessions || []).filter((s) => s.projectId === S.projectId) : S.sessions || [];

// Employees who are members of a project
export const projectMembers = (p) =>
  (p?.members || []).map((id) => user(id)).filter((u) => u && u.role !== "admin");

// Stable accent colour per project, used for avatars
const PROJECT_COLORS = ["#073b28", "#0e7490", "#7c3aed", "#b45309", "#be123c", "#1d4ed8", "#047857", "#a21caf"];
export const pcolor = (id) => {
  let h = 0;
  for (const c of String(id || "")) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PROJECT_COLORS[h % PROJECT_COLORS.length];
};

export const tname = (id) => S.tasks?.find((t) => t.id === id)?.title || id || "–";

export const active = (id) => S.sessions?.find((s) => s.uid === id && !s.end);

export function tstate(t) {
  if (t.status === "Done") return ["Done", "done"];
  const d = new Date(t.deadline + "T23:59:59").getTime();
  if (d < Date.now()) return ["Overdue", "over"];
  if (d - Date.now() < 864e5 * 2) return ["Due soon", "soon"];
  return ["On track", "track"];
}

export function getFormattedDate() {
  const options = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
  return new Date().toLocaleDateString("en-US", options);
}

/**
 * Toggles loading state on any button element and freezes width to prevent layout jump.
 */
export function setButtonLoading(btn, isLoading) {
  if (!btn) return;
  if (isLoading) {
    btn.style.width = `${btn.offsetWidth}px`;
    btn.disabled = true;
    btn.classList.add("is-loading");
  } else {
    btn.style.width = "";
    btn.disabled = false;
    btn.classList.remove("is-loading");
  }
}

/**
 * Runs an async task with automatic button loading state and guaranteed cleanup.
 * @param {HTMLElement|string} btnOrSelector The button DOM node or CSS selector
 * @param {Function} asyncFn The async operation to execute
 */
export async function withLoading(btnOrSelector, asyncFn) {
  const btn = typeof btnOrSelector === "string" ? document.querySelector(btnOrSelector) : btnOrSelector;
  if (!btn || btn.disabled) return;

  setButtonLoading(btn, true);
  try {
    return await asyncFn();
  } finally {
    setButtonLoading(btn, false);
  }
}

// ================= TEAM FEATURES HELPERS =================
export const PRIORITY_CLASS = { Low: "low", Medium: "medium", High: "high", Urgent: "urgent" };
export const prio = (t) => t?.priority || "Medium";

export const sprintsOf = (projectId = S.projectId) =>
  (S.sprints || []).filter((s) => s.projectId === projectId).sort((a, b) => a.start.localeCompare(b.start));
export const sprint = (id) => (S.sprints || []).find((s) => s.id === id);
export const activeSprint = (projectId = S.projectId) => sprintsOf(projectId).find((s) => s.status === "active");

export const initial = (name) => String(name || "?").trim().charAt(0).toUpperCase() || "?";

// "5m ago", "2h ago", "Oct 12"
export const ago = (ts) => {
  const d = Date.now() - ts;
  if (d < 45e3) return "just now";
  if (d < 36e5) return Math.round(d / 6e4) + "m ago";
  if (d < 864e5) return Math.round(d / 36e5) + "h ago";
  if (d < 6048e5) return Math.round(d / 864e5) + "d ago";
  return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" });
};

export const clock = (ts) => new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

// Escape text, then highlight @mentions and keep line breaks
export const richText = (text) =>
  esc(text)
    .replace(/@([a-zA-Z0-9._-]{2,40})/g, (m, u) => {
      const hit = (S.users || []).find((x) => (x.username || "").toLowerCase() === u.toLowerCase());
      return hit ? `<span class="mention${hit.id === S.me ? " me" : ""}">@${u}</span>` : m;
    })
    .replace(/\n/g, "<br>");

export const openSubtasks = (t) => (t.subtasks || []).filter((s) => !s.done).length;

// Premium dropdown markup used across filters / forms. options: [{val,label}]
export const customSelect = ({ id = "", data = "", options, value, width = "" }) => {
  const cur = options.find((o) => String(o.val) === String(value)) || options[0] || { label: "", val: "" };
  const attrs = (id ? ` id="${id}"` : "") + (data ? ` data-filter="${data}"` : "");
  return `
    <div class="custom-select-wrap" ${width ? `style="min-width:${width}"` : ""}>
      <input type="hidden"${attrs} value="${esc(cur.val)}">
      <button type="button" class="custom-select-trigger">
        <span class="custom-select-label">${esc(cur.label)}</span>
        <svg class="custom-select-chevron" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="custom-select-menu">
        ${options
          .map((o) => {
            const sel = String(o.val) === String(cur.val);
            return `<button type="button" class="custom-select-opt ${sel ? "selected" : ""}" data-val="${esc(o.val)}"><span>${esc(o.label)}</span>${
              sel ? '<svg class="opt-check" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>' : ""
            }</button>`;
          })
          .join("") || '<div class="custom-select-empty">Nothing to choose</div>'}
      </div>
    </div>`;
};

// ---- Timesheet range / employee filtering shared by the table and the CSV export
export const rangeBounds = (range) => {
  const ws = weekStart();
  if (range === "lastweek") return [ws - 7 * 864e5, ws];
  if (range === "month") return [Date.now() - 30 * 864e5, Infinity];
  if (range === "all") return [0, Infinity];
  return [ws, Infinity];
};

export const sheetRangeValue = (adm) => S.sheetRange ?? (adm ? "all" : "week");

export const sheetRows = (adm, me) => {
  const [from, to] = rangeBounds(sheetRangeValue(adm));
  let rows = pSessions().filter((x) => x.start >= from && x.start < to);
  if (!adm) rows = rows.filter((x) => x.uid === me.id);
  else if (S.sheetEmp !== "all") rows = rows.filter((x) => x.uid === S.sheetEmp);
  return rows.sort((a, b) => b.start - a.start);
};

// ---- Task board filtering
export const taskFilterWho = (adm, me) => S.tf.assignee ?? (adm ? "all" : me.id);

export const filterTasks = (tasks, adm, me) => {
  const f = S.tf;
  const who = taskFilterWho(adm, me);
  const q = f.q.trim().toLowerCase();
  const today = day(Date.now());
  const active = activeSprint();

  return tasks.filter((t) => {
    if (who !== "all" && t.assignee !== who) return false;
    if (f.sprint === "backlog" && t.sprintId) return false;
    if (f.sprint === "active" && (!active || t.sprintId !== active.id)) return false;
    if (f.sprint !== "all" && f.sprint !== "backlog" && f.sprint !== "active" && t.sprintId !== f.sprint) return false;
    if (f.priority !== "all" && prio(t) !== f.priority) return false;
    if (f.type !== "all" && t.type !== f.type) return false;
    if (f.overdue && !(t.status !== "Done" && t.deadline < today)) return false;
    if (q) {
      const hay = [t.title, t.description, t.type, user(t.assignee)?.name, ...(t.labels || [])].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
};

export const filtersActive = (adm, me) => {
  const f = S.tf;
  return !!(f.q || f.sprint !== "all" || f.priority !== "all" || f.type !== "all" || f.overdue || taskFilterWho(adm, me) !== (adm ? "all" : me.id));
};

export const csvCell = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
export const downloadCsv = (name, rows) => {
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
};
