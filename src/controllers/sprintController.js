const { getDB } = require("../config/db");
const { DAY_REGEX, ID_REGEX } = require("../config/constants");
const { str, logActivity, notify } = require("../services/collab");

const adminOnly = (req, res) => {
  if (req.u.role !== "admin") {
    res.status(403).json({ error: "Only the admin can manage sprints" });
    return false;
  }
  return true;
};

const nameTaken = async (db, projectId, name, exceptId) => {
  const all = await db.collection("sprints").find({ projectId }, { projection: { name: 1 } }).toArray();
  return all.some((s) => s._id !== exceptId && String(s.name).toLowerCase() === name.toLowerCase());
};

exports.createSprint = async (req, res) => {
  if (!adminOnly(req, res)) return;
  const { id } = req.params;
  if (!ID_REGEX.test(id)) return res.status(400).json({ error: "Invalid sprint ID" });

  const name = str(req.body.name, 60);
  const { start, end } = req.body;
  if (!name) return res.status(400).json({ error: "Sprint name is required" });
  if (!DAY_REGEX.test(start) || !DAY_REGEX.test(end)) return res.status(400).json({ error: "Start and end dates are required" });
  if (end < start) return res.status(400).json({ error: "End date cannot be before start date" });

  const db = await getDB();
  const project = await db.collection("projects").findOne({ _id: str(req.body.projectId, 64) });
  if (!project) return res.status(400).json({ error: "Please choose a valid project" });
  if (project.status === "archived") return res.status(400).json({ error: "This project is archived" });
  if (await nameTaken(db, project._id, name)) return res.status(400).json({ error: "A sprint with this name already exists" });

  await db.collection("sprints").insertOne({
    _id: id,
    projectId: project._id,
    name,
    goal: str(req.body.goal, 200),
    start,
    end,
    status: "planned",
    committed: 0,
    created: Date.now()
  });
  await logActivity(db, { projectId: project._id, uid: req.u.id, kind: "sprint", text: `planned sprint "${name}"` });
  res.json({ ok: 1 });
};

exports.updateSprint = async (req, res) => {
  if (!adminOnly(req, res)) return;
  const db = await getDB();
  const col = db.collection("sprints");
  const cur = await col.findOne({ _id: req.params.id });
  if (!cur) return res.status(404).json({ error: "Sprint not found" });
  if (cur.status === "completed") return res.status(400).json({ error: "A completed sprint can't be changed" });

  const project = await db.collection("projects").findOne({ _id: cur.projectId });
  if (project && project.status === "archived") return res.status(400).json({ error: "This project is archived" });

  const update = {};
  const b = req.body;

  if (b.name !== undefined) {
    const name = str(b.name, 60);
    if (!name) return res.status(400).json({ error: "Sprint name is required" });
    if (await nameTaken(db, cur.projectId, name, cur._id)) return res.status(400).json({ error: "A sprint with this name already exists" });
    update.name = name;
  }
  if (b.goal !== undefined) update.goal = str(b.goal, 200);
  if (b.start !== undefined) {
    if (!DAY_REGEX.test(b.start)) return res.status(400).json({ error: "Invalid start date" });
    update.start = b.start;
  }
  if (b.end !== undefined) {
    if (!DAY_REGEX.test(b.end)) return res.status(400).json({ error: "Invalid end date" });
    update.end = b.end;
  }
  if ((update.end || cur.end) < (update.start || cur.start)) {
    return res.status(400).json({ error: "End date cannot be before start date" });
  }

  const tasks = db.collection("tasks");
  const members = (project && project.members) || [];

  // ---- Start sprint
  if (b.status === "active" && cur.status === "planned") {
    if (await col.findOne({ projectId: cur.projectId, status: "active" })) {
      return res.status(400).json({ error: "Another sprint is already active. Complete it first." });
    }
    update.status = "active";
    update.startedAt = Date.now();
    update.committed = await tasks.countDocuments({ projectId: cur.projectId, sprintId: cur._id });
  }

  // ---- Complete sprint
  if (b.status === "completed" && cur.status === "active") {
    let target = null;
    if (b.moveTo && b.moveTo !== "backlog") {
      const next = await col.findOne({ _id: String(b.moveTo), projectId: cur.projectId });
      if (!next || next.status === "completed" || next._id === cur._id) {
        return res.status(400).json({ error: "Choose a planned sprint (or the backlog) for unfinished tasks" });
      }
      target = next._id;
    }

    const inSprint = await tasks.find({ projectId: cur.projectId, sprintId: cur._id }).toArray();
    const done = inSprint.filter((t) => t.status === "Done");
    const open = inSprint.filter((t) => t.status !== "Done");

    await tasks.updateMany({ projectId: cur.projectId, sprintId: cur._id, status: { $ne: "Done" } }, { $set: { sprintId: target } });

    update.status = "completed";
    update.completedAt = Date.now();
    update.committed = inSprint.length;
    update.doneCount = done.length;
    update.carriedOver = open.length;
    update.doneHours = Math.round(done.reduce((a, t) => a + (t.estimate || 0), 0) * 100) / 100;
  }

  if (!Object.keys(update).length) return res.json({ ok: 1 });
  await col.updateOne({ _id: cur._id }, { $set: update });

  if (update.status === "active") {
    await logActivity(db, { projectId: cur.projectId, uid: req.u.id, kind: "sprint", text: `started sprint "${cur.name}"` });
    await notify(db, { uids: members, from: req.u.id, projectId: cur.projectId, kind: "sprint", tab: "sprints", text: `Sprint "${cur.name}" has started` });
  }
  if (update.status === "completed") {
    await logActivity(db, {
      projectId: cur.projectId,
      uid: req.u.id,
      kind: "sprint",
      text: `completed sprint "${cur.name}" (${update.doneCount}/${update.committed} tasks done)`
    });
    await notify(db, { uids: members, from: req.u.id, projectId: cur.projectId, kind: "sprint", tab: "sprints", text: `Sprint "${cur.name}" was completed` });
  }

  res.json({ ok: 1 });
};

exports.deleteSprint = async (req, res) => {
  if (!adminOnly(req, res)) return;
  const db = await getDB();
  const cur = await db.collection("sprints").findOne({ _id: req.params.id });
  if (!cur) return res.json({ ok: 1 });
  if (cur.status === "active") return res.status(400).json({ error: "Complete the active sprint before deleting it" });

  await db.collection("tasks").updateMany({ projectId: cur.projectId, sprintId: cur._id }, { $set: { sprintId: null } });
  await db.collection("sprints").deleteOne({ _id: cur._id });
  await logActivity(db, { projectId: cur.projectId, uid: req.u.id, kind: "sprint", text: `deleted sprint "${cur.name}"` });
  res.json({ ok: 1 });
};
