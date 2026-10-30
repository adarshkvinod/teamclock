import { S, saveProjectSelection } from "./state.js";
import { API } from "./api.js";
import { esc, ago, user, pname } from "./utils.js";
import { toast } from "./toast.js";
import { openModal } from "./modal.js";

const KIND_ICON = {
  assigned: "📌",
  mention: "💬",
  comment: "🗨️",
  sprint: "🏁",
  project: "📁"
};

export const unreadCount = () => (S.notifications || []).filter((n) => !n.read).length;

export function bellView() {
  const n = unreadCount();
  const items = (S.notifications || []).slice(0, 25);
  return `
    <div class="notif-wrap">
      <button type="button" class="btn-bell" id="btnBell" title="Notifications" aria-label="Notifications">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        ${n ? `<span class="bell-badge">${n > 9 ? "9+" : n}</span>` : ""}
      </button>
      <div class="notif-menu" id="notifMenu">
        <div class="notif-head">
          <strong>Notifications</strong>
          ${n ? `<button type="button" class="notif-all" id="notifAll">Mark all read</button>` : ""}
        </div>
        <div class="notif-list">
          ${items.length
            ? items
                .map(
                  (x) => `
            <button type="button" class="notif-item ${x.read ? "" : "unread"}" data-notif="${esc(x.id)}">
              <span class="notif-ico">${KIND_ICON[x.kind] || "🔔"}</span>
              <span class="notif-body">
                <span class="notif-text">${esc(x.text)}</span>
                <span class="notif-meta">${x.from ? esc(user(x.from)?.name || "Someone") + " · " : ""}${esc(pname(x.projectId))} · ${ago(x.at)}</span>
              </span>
            </button>`
                )
                .join("")
            : '<div class="notif-empty">You\'re all caught up 🎉</div>'}
        </div>
      </div>
    </div>`;
}

// Jump to wherever a notification points (switching project if needed)
export function goTo({ projectId, tab, taskId }) {
  if (projectId && S.projects.some((p) => p.id === projectId)) {
    saveProjectSelection(S.me, projectId);
    S.tab = tab || "dashboard";
  }
  window.dispatchEvent(new CustomEvent("app:render"));
  if (taskId) import("./taskDrawer.js").then((m) => m.openTaskDrawer(taskId));
}

export function bindBell() {
  const btn = document.getElementById("btnBell");
  const menu = document.getElementById("notifMenu");
  if (!btn || !menu) return;

  btn.onclick = (e) => {
    e.stopPropagation();
    menu.classList.toggle("open");
  };
  menu.onclick = (e) => e.stopPropagation();
  document.addEventListener("click", () => menu.classList.remove("open"), { once: true });

  const markRead = async (body) => {
    try {
      await API("POST", "/notifications/read", body);
      window.dispatchEvent(new CustomEvent("app:reload"));
    } catch (e) {}
  };

  const all = document.getElementById("notifAll");
  if (all) all.onclick = () => markRead({ all: true });

  menu.querySelectorAll("[data-notif]").forEach((el) => {
    el.onclick = () => {
      const n = S.notifications.find((x) => x.id === el.dataset.notif);
      if (!n) return;
      n.read = true;
      markRead({ ids: [n.id] });
      goTo({ projectId: n.projectId, tab: n.tab, taskId: n.taskId });
    };
  });
}

// ---- Change password dialog
export function openProfile() {
  const me = user(S.me);
  openModal({
    title: "My Account",
    subtitle: me ? `${me.name} · @${me.username || ""}` : "",
    confirmText: "Change Password",
    body: `
      <div class="input-group" style="margin-bottom:14px;"><label>Current password</label><input type="password" id="pwCur" autocomplete="current-password"></div>
      <div class="input-group" style="margin-bottom:14px;"><label>New password</label><input type="password" id="pwNew" autocomplete="new-password"></div>
      <div class="input-group"><label>Repeat new password</label><input type="password" id="pwNew2" autocomplete="new-password"></div>`,
    onSubmit: async (root) => {
      const cur = root.querySelector("#pwCur").value;
      const nxt = root.querySelector("#pwNew").value;
      if (nxt !== root.querySelector("#pwNew2").value) throw new Error("The new passwords don't match");
      await API("POST", "/password", { current: cur, next: nxt });
      toast.success("Your password was changed.", "Password Updated");
    }
  });
}
