import { TOK, S, clearTokenStorage, saveTokenToStorage, loadProjectSelection } from "./state.js";
import { user } from "./utils.js";

let lastDataSignature = "";

export async function API(m, p, b) {
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
    if (r.status === 401 && TOK) {
      clearTokenStorage();
      window.dispatchEvent(new CustomEvent("app:render"));
    }
    throw { message: j.error || "Request failed" };
  }
  return j;
}

export const db = {
  doc: (p) => {
    const [c, i] = p.split("/"),
      u = `/${c}/${i}`;
    return {
      set: (d) => API("PUT", u, d).then(() => loadData(false)),
      update: (d) => API("PATCH", u, d).then(() => loadData(false)),
      delete: () => API("DELETE", u).then(() => loadData(false))
    };
  }
};

/**
 * Loads dashboard data.
 * @param {boolean} isBackground - If true, checks whether data changed before re-rendering.
 */
export async function loadData(isBackground = false) {
  if (!TOK) return;

  const j = await API("GET", "/data");

  // Create lightweight fingerprint of incoming data
  const newSignature = JSON.stringify({
    users: (j.users || []).map((u) => u.id + u.workType + (u.roles || []).join("")),
    projects: (j.projects || []).map(
      (p) => p.id + p.name + p.status + (p.description || "") + (p.start || "") + (p.end || "") + (p.members || []).join(",")
    ),
    tasks: (j.tasks || []).map((t) => t.id + t.status + t.deadline + t.assignee + t.projectId),
    sessionsCount: (j.sessions || []).length,
    activeSession: (j.sessions || []).find((s) => !s.end)
  });

  // If background polling and nothing changed, do not touch the DOM
  if (isBackground && newSignature === lastDataSignature) {
    return;
  }

  // Prevent background re-renders if the user is typing or an interactive modal is open
  if (isBackground) {
    const activeEl = document.activeElement;
    const isTyping = activeEl && /^(INPUT|SELECT|TEXTAREA)$/.test(activeEl.tagName);
    const isModalOpen = document.querySelector(
      ".prompt-modal-overlay.open, .confirm-overlay.open, .status-dropdown.open"
    );
    if (isTyping || isModalOpen) {
      return; // Defer until the user is done interacting
    }
  }

  lastDataSignature = newSignature;
  Object.assign(S, j, { ready: 7 });

  if (!user(S.me)) {
    clearTokenStorage();
    window.dispatchEvent(new CustomEvent("app:render"));
    return;
  }

  // First load after login / reopen: jump back into the last opened project (if still accessible).
  if (!S.projectsRestored) {
    S.projectsRestored = true;
    const saved = loadProjectSelection(S.me);
    if (saved && S.projects.some((p) => p.id === saved)) {
      S.projectId = saved;
      S.tab = "dashboard";
    } else {
      S.projectId = null;
      S.tab = "projects";
    }
  }

  // The opened project may have been deleted or the user removed from it.
  if (S.projectId && !S.projects.some((p) => p.id === S.projectId)) {
    S.projectId = null;
    S.tab = "projects";
  }

  window.dispatchEvent(new CustomEvent("app:render"));
}

export async function authenticate(endpoint, credentials) {
  const j = await API("POST", endpoint, credentials);
  saveTokenToStorage(j.token, j.id);
  S.tab = null;
  S.projectsRestored = false;
  await loadData(false);
}