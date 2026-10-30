const { getDB } = require("../config/db");
const { STATUS, DAY_REGEX, ID_REGEX, TASK_TYPES, PRIORITIES } = require("../config/constants");
const { rid, workedMs, projectFor, extractMentions, logActivity, notify } = require("../services/collab");

const str = (v, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

const cleanLabels = (v) => {
  const raw = Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : [];
  return [...new Set(raw.map((x) => str(x, 24)).filter(Boolean))].slice(0, 8);
};

const cleanSubtasks = (v) =>
  Array.isArray(v)
    ? v
        .slice(0, 50)
        .map((s) => ({ id: str(s && s.id, 24) || rid(), title: str(s && s.title, 120), done: !!(s && s.done) }))
        .filter((s) => s.title)
    : [];

const cleanHours = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.round(n * 100) / 100, 1000) : 0;
};

// Admin can manage everything; an employee can fully manage a task they created for themselves.
const canManage = (u, task) => u.role === "admin" || (task.createdBy === u.id && task.assignee === u.id);

// Checks a sprint belongs to the project and is still open. Returns sprint id/null or an error string.
async function resolveSprint(db, sprintId, projectId) {
  if (!sprintId) return { id: null };
  const sp = await db.collection("sprints").findOne({ _id: String(sprintId), projectId });
  if (!sp) return { error: "Sprint not found in this project" };
  if (sp.status === "completed") return { error: "That sprint is already completed" };
  return { id: sp._id, name: sp.name };
}

exports.createTask = async (req, res) => {
  const { id } = req.params;
  if (!ID_REGEX.test(id)) return res.status(400).json({ error: "Invalid task ID" });

  const isAdmin = req.u.role === "admin";
  const title = str(req.body.title, 200);
  const { deadline } = req.body;
  const type = str(req.body.type, 80);

  if (!title || !DAY_REGEX.test(deadline)) return res.status(400).json({ error: "Invalid task details" });

  const db = await getDB();
  const project = await db.collection("projects").findOne({ _id: str(req.body.projectId, 64) });
  if (!project) return res.status(400).json({ error: "Please choose a valid project" });
  if (project.status === "archived") return res.status(400).json({ error: "This project is archived" });
  if (!isAdmin && !(project.members || []).includes(req.u.id)) {
    return res.status(403).json({ error: "You are not a member of this project" });
  }

  // Employees can only add tasks for themselves; the admin can assign to any member.
  const assignee = isAdmin ? req.body.assignee : req.u.id;
  const employee = await db.collection("users").findOne({ _id: assignee, role: "employee" });
  if (!employee) return res.status(400).json({ error: "Assignee must be an active employee" });
  if (!(project.members || []).includes(assignee)) {
    return res.status(400).json({ error: "Assignee is not a member of this project" });
  }

  const sprint = await resolveSprint(db, req.body.sprintId, project._id);
  if (sprint.error) return res.status(400).json({ error: sprint.error });

  const priority = PRIORITIES.includes(req.body.priority) ? req.body.priority : "Medium";

  await db.collection("tasks").insertOne({
    _id: id,
    title,
    projectId: project._id,
    assignee,
    deadline,
    type: TASK_TYPES.includes(type) ? type : "Mobile App Development",
    priority,
    description: str(req.body.description, 2000),
    labels: cleanLabels(req.body.labels),
    estimate: cleanHours(req.body.estimate),
    sprintId: sprint.id,
    subtasks: cleanSubtasks(req.body.subtasks),
    status: "To do",
    doneAt: null,
    createdBy: req.u.id,
    created: Date.now()
  });

  await logActivity(db, { projectId: project._id, uid: req.u.id, kind: "task", taskId: id, text: `created task "${title}"` });
  await notify(db, {
    uids: [assignee],
    from: req.u.id,
    projectId: project._id,
    kind: "assigned",
    taskId: id,
    tab: "tasks",
    text: `You were assigned "${title}"`
  });

  res.json({ ok: 1 });
};

exports.updateTask = async (req, res) => {
  const db = await getDB();
  const col = db.collection("tasks");
  const cur = await col.findOne({ _id: req.params.id });
  if (!cur) return res.status(404).json({ error: "Task not found" });

  const project = await db.collection("projects").findOne({ _id: cur.projectId });
  const isAdmin = req.u.role === "admin";
  const isAssignee = cur.assignee === req.u.id;
  const manager = canManage(req.u, cur);

  if (!manager && !isAssignee) return res.status(403).json({ error: "Not allowed to edit someone else's task" });
  if (project && project.status === "archived") return res.status(400).json({ error: "This project is archived" });

  const b = req.body;
  const update = {};
  const log = [];

  if (STATUS.includes(b.status) && b.status !== cur.status) {
    update.status = b.status;
    update.doneAt = b.status === "Done" ? Date.now() : null;
    log.push(`moved "${cur.title}" to ${b.status}`);
  }

  if (Array.isArray(b.subtasks)) {
    update.subtasks = cleanSubtasks(b.subtasks);
    const was = (cur.subtasks || []).filter((s) => s.done).length;
    const now = update.subtasks.filter((s) => s.done).length;
    if (now !== was) log.push(`updated the checklist on "${cur.title}" (${now}/${update.subtasks.length})`);
  }

  // Fields the assignee may also touch
  if (b.description !== undefined) update.description = str(b.description, 2000);
  if (b.labels !== undefined) update.labels = cleanLabels(b.labels);

  if (manager) {
    if (str(b.title, 200)) update.title = str(b.title, 200);
    if (typeof b.deadline === "string" && DAY_REGEX.test(b.deadline)) update.deadline = b.deadline;
    if (TASK_TYPES.includes(b.type)) update.type = b.type;
    if (PRIORITIES.includes(b.priority) && b.priority !== (cur.priority || "Medium")) {
      update.priority = b.priority;
      log.push(`set priority of "${cur.title}" to ${b.priority}`);
    }
    if (b.estimate !== undefined) update.estimate = cleanHours(b.estimate);

    if (b.sprintId !== undefined && (b.sprintId || null) !== (cur.sprintId || null)) {
      const sprint = await resolveSprint(db, b.sprintId, cur.projectId);
      if (sprint.error) return res.status(400).json({ error: sprint.error });
      update.sprintId = sprint.id;
      log.push(sprint.id ? `added "${cur.title}" to ${sprint.name}` : `moved "${cur.title}" to the backlog`);
    }
  }

  if (isAdmin && b.assignee && b.assignee !== cur.assignee) {
    const emp = await db.collection("users").findOne({ _id: b.assignee, role: "employee" });
    if (!emp || !project || !(project.members || []).includes(emp._id)) {
      return res.status(400).json({ error: "Assignee must be an employee in this project" });
    }
    update.assignee = emp._id;
    log.push(`reassigned "${cur.title}" to ${emp.name}`);
  }

  if (!Object.keys(update).length) return res.json({ ok: 1 });

  await col.updateOne({ _id: cur._id }, { $set: update });

  for (const text of log) {
    await logActivity(db, { projectId: cur.projectId, uid: req.u.id, kind: "task", taskId: cur._id, text });
  }
  if (update.assignee) {
    await notify(db, {
      uids: [update.assignee],
      from: req.u.id,
      projectId: cur.projectId,
      kind: "assigned",
      taskId: cur._id,
      tab: "tasks",
      text: `You were assigned "${update.title || cur.title}"`
    });
  }

  res.json({ ok: 1 });
};

exports.deleteTask = async (req, res) => {
  const db = await getDB();
  const cur = await db.collection("tasks").findOne({ _id: req.params.id });
  if (!cur) return res.json({ ok: 1 });
  if (!canManage(req.u, cur)) return res.status(403).json({ error: "Not allowed" });

  await db.collection("tasks").deleteOne({ _id: cur._id });
  await db.collection("comments").deleteMany({ taskId: cur._id });
  await logActivity(db, { projectId: cur.projectId, uid: req.u.id, kind: "task", text: `deleted task "${cur.title}"` });
  res.json({ ok: 1 });
};

// Comments, activity and time logged for the task drawer
exports.getDetail = async (req, res) => {
  const db = await getDB();
  const task = await db.collection("tasks").findOne({ _id: req.params.id });
  if (!task) return res.status(404).json({ error: "Task not found" });
  if (!(await projectFor(db, req, res, task.projectId))) return;

  const comments = await db.collection("comments").find({ taskId: task._id }).sort({ at: 1 }).limit(200).toArray();
  const activity = await db.collection("activity").find({ taskId: task._id }).sort({ at: -1 }).limit(30).toArray();
  const sessions = await db.collection("sessions").find({ taskId: task._id }).toArray();

  const byUser = {};
  let timeMs = 0;
  for (const s of sessions) {
    const ms = workedMs(s);
    timeMs += ms;
    byUser[s.uid] = (byUser[s.uid] || 0) + ms;
  }

  const pub = ({ _id, ...r }) => ({ id: _id, ...r });
  res.json({
    comments: comments.map(pub),
    activity: activity.map(pub),
    timeMs,
    byUser: Object.entries(byUser).map(([uid, ms]) => ({ uid, ms }))
  });
};

exports.addComment = async (req, res) => {
  const db = await getDB();
  const task = await db.collection("tasks").findOne({ _id: req.params.id });
  if (!task) return res.status(404).json({ error: "Task not found" });
  const project = await projectFor(db, req, res, task.projectId);
  if (!project) return;

  const text = str(req.body.text, 1000);
  if (!text) return res.status(400).json({ error: "Write something first" });

  const mentions = await extractMentions(db, text, project, req.u.id);
  const comment = { _id: rid(), taskId: task._id, projectId: task.projectId, uid: req.u.id, text, mentions, at: Date.now() };
  await db.collection("comments").insertOne(comment);

  await logActivity(db, { projectId: task.projectId, uid: req.u.id, kind: "comment", taskId: task._id, text: `commented on "${task.title}"` });

  // Mentioned people get a "mention"; the assignee gets a "comment" unless already mentioned.
  await notify(db, { uids: mentions, from: req.u.id, projectId: task.projectId, kind: "mention", taskId: task._id, tab: "tasks", text: `You were mentioned on "${task.title}"` });
  await notify(db, {
    uids: [task.assignee].filter((u) => !mentions.includes(u)),
    from: req.u.id,
    projectId: task.projectId,
    kind: "comment",
    taskId: task._id,
    tab: "tasks",
    text: `New comment on "${task.title}"`
  });

  const { _id, ...rest } = comment;
  res.json({ comment: { id: _id, ...rest } });
};

exports.deleteComment = async (req, res) => {
  const db = await getDB();
  const c = await db.collection("comments").findOne({ _id: req.params.cid, taskId: req.params.id });
  if (!c) return res.json({ ok: 1 });
  if (c.uid !== req.u.id && req.u.role !== "admin") return res.status(403).json({ error: "Not allowed" });
  await db.collection("comments").deleteOne({ _id: c._id });
  res.json({ ok: 1 });
};
