export const TYPES = ["Designer", "Project Manager", "Marketing", "Developer", "DevOps"];

export const S = {
  users: [],
  tasks: [],
  sessions: [],
  me: null,
  tab: null,
  ready: 0,
  needsSetup: false
};

export let TOK = null;

export function setToken(token) {
  TOK = token;
}

export function loadTokenFromStorage() {
  try {
    TOK = localStorage.getItem("tc_tok");
    S.me = localStorage.getItem("tc_me");
  } catch (e) {}
}

export function saveTokenToStorage(token, id) {
  TOK = token;
  S.me = id;
  try {
    localStorage.setItem("tc_tok", token);
    localStorage.setItem("tc_me", id);
  } catch (e) {}
}

export function clearTokenStorage() {
  TOK = null;
  S.me = null;
  S.tab = null;
  S.users = [];
  try {
    localStorage.removeItem("tc_tok");
    localStorage.removeItem("tc_me");
  } catch (e) {}
}