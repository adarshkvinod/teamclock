import { TOK, S, clearTokenStorage, saveTokenToStorage } from "./state.js";
import { user } from "./utils.js";

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
      set: (d) => API("PUT", u, d).then(loadData),
      update: (d) => API("PATCH", u, d).then(loadData),
      delete: () => API("DELETE", u).then(loadData)
    };
  }
};

export async function loadData() {
  if (!TOK) return;
  const j = await API("GET", "/data");
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
  await loadData();
}