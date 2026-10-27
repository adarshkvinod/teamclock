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

export const user = (id) => S.users.find((u) => u.id === id);

export const tname = (id) => S.tasks.find((t) => t.id === id)?.title || "–";

export const active = (id) => S.sessions.find((s) => s.uid === id && !s.end);

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