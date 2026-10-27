export const EMPLOYEE_ROLES = [
  "Mobile App Developer",
  "Web Developer",
  "Backend Developer",
  "Product Designer",
  "Project Manager"
];

export const TASK_TYPES = [
  "Mobile App Development",
  "Backend Development",
  "Web Development",
  "Product Designing",
  "Marketing",
  "Meeting",
  "Discussion",
  "Project Management"
];

// Compatibility aliases
export const ROLES = EMPLOYEE_ROLES;
export const TYPES = TASK_TYPES;

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
export const loadTokenStorage = loadTokenFromStorage;

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