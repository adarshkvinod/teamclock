import { TOK, S, clearTokenStorage, saveTokenToStorage } from "./state.js";
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
    tasks: (j.tasks || []).map((t) => t.id + t.status + t.deadline),
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

  window.dispatchEvent(new CustomEvent("app:render"));
}

export async function authenticate(endpoint, credentials) {
  const j = await API("POST", endpoint, credentials);
  saveTokenToStorage(j.token, j.id);
  S.tab = null;
  await loadData(false);
}