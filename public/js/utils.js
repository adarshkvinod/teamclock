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