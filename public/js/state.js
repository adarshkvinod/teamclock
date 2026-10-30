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

export const PRIORITIES = ["Low", "Medium", "High", "Urgent"];

export const defaultFilters = () => ({ q: "", assignee: null, sprint: "all", priority: "all", type: "all", overdue: false });

export const S = {
  users: [],
  sprints: [],
  notifications: [],
  unread: {},
  tf: defaultFilters(), // task board filters (assignee null = role default)
  showTaskForm: false,
  calT: null, // {y, m} month shown in the task calendar
  sheetRange: null, // null = role default (admin: all time, employee: this week)
  activity: {},
  showSprintForm: false,
  sheetEmp: "all",
  reportRange: 30,
  myTasksTab: "open",
  chat: {}, // per-project chat cache
  projects: [],
  tasks: [],
  sessions: [],
  projectId: null, // currently opened project (null = Projects home)
  projectsRestored: false,
  showProjForm: false,
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

// ---- Selected project is remembered per user, so reopening the app lands inside it.
const projectKey = (userId) => "tc_project_" + userId;

export function saveProjectSelection(userId, projectId) {
  if ((projectId || null) !== S.projectId) {
    // a different project starts with clean board filters
    S.tf = defaultFilters();
    S.showTaskForm = false;
    S.calT = null;
  }
  S.projectId = projectId || null;
  try {
    if (projectId) localStorage.setItem(projectKey(userId), projectId);
    else localStorage.removeItem(projectKey(userId));
  } catch (e) {}
}

export function loadProjectSelection(userId) {
  try {
    return localStorage.getItem(projectKey(userId));
  } catch (e) {
    return null;
  }
}

export function clearTokenStorage() {
  TOK = null;
  S.me = null;
  S.tab = null;
  S.users = [];
  S.projects = [];
  S.sprints = [];
  S.notifications = [];
  S.unread = {};
  S.chat = {};
  S.tf = defaultFilters();
  S.projectId = null;
  S.projectsRestored = false;
  S.showProjForm = false;
  S.showTaskForm = false;
  try {
    localStorage.removeItem("tc_tok");
    localStorage.removeItem("tc_me");
  } catch (e) {}
}