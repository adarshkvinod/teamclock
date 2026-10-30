const { getDB } = require("../config/db");
const { TASK_TYPES, ID_REGEX } = require("../config/constants");
const { rid } = require("../services/collab");

const str = (v, max = 24) => (typeof v === "string" ? v.trim().slice(0, max) : "");

exports.clockIn = async (req, res) => {
  const { id } = req.params;
  if (!ID_REGEX.test(id)) return res.status(400).json({ error: "Invalid session ID" });
  if (!TASK_TYPES.includes(req.body.type)) return res.status(400).json({ error: "Invalid task/work type" });

  const db = await getDB();
  const col = db.collection("sessions");

  const projectId = str(req.body.projectId, 64);
  const project = await db.collection("projects").findOne({ _id: projectId });
  if (!project) return res.status(400).json({ error: "Please choose a project to clock in to" });
  if (project.status === "archived") return res.status(400).json({ error: "This project is archived" });
  if (req.u.role !== "admin" && !(project.members || []).includes(req.u.id)) {
    return res.status(403).json({ error: "You are not a member of this project" });
  }

  const taskId = str(req.body.taskId, 150); // may be a task id or free-typed task text
  if (taskId) {
    const linked = await db.collection("tasks").findOne({ _id: taskId }, { projection: { projectId: 1 } });
    if (linked && linked.projectId !== projectId) {
      return res.status(400).json({ error: "That task belongs to a different project" });
    }
  }

  if (await col.findOne({ uid: req.u.id, end: null })) {
    return res.status(400).json({ error: "You are already clocked in" });
  }

  await col.insertOne({
    _id: id,
    uid: req.u.id,
    projectId,
    type: req.body.type,
    taskId, // up to 150 characters to allow custom task text
    start: Date.now(),
    end: null,
    breaks: []
  });

  res.json({ ok: 1 });
};

exports.updateSession = async (req, res) => {
  const db = await getDB();
  const col = db.collection("sessions");
  const cur = await col.findOne({ _id: req.params.id });

  if (!cur) return res.status(404).json({ error: "Session not found" });
  if (cur.uid !== req.u.id || cur.end) return res.status(403).json({ error: "Not allowed" });

  const update = {};
  if (Array.isArray(req.body.breaks)) {
    update.breaks = req.body.breaks
      .slice(0, 200)
      .map((x) => ({ s: +x.s, e: x.e ? +x.e : null }))
      .filter((x) => x.s > 0);
  }

  if (req.body.end) {
    update.end = Date.now();
    update.breaks = (update.breaks || cur.breaks).map((x) => (x.e ? x : { ...x, e: update.end }));
  }

  await col.updateOne({ _id: req.params.id }, { $set: update });
  res.json({ ok: 1 });
};

exports.deleteSession = async (req, res) => {
  if (req.u.role !== "admin") return res.status(403).json({ error: "Not allowed" });

  const db = await getDB();
  await db.collection("sessions").deleteOne({ _id: req.params.id });
  res.json({ ok: 1 });
};

// Add a finished time entry after the fact (forgot to clock in/out)
exports.addManual = async (req, res) => {
  const { type } = req.body;
  if (!TASK_TYPES.includes(type)) return res.status(400).json({ error: "Invalid task/work type" });

  const start = Number(req.body.start);
  const end = Number(req.body.end);
  const now = Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0) return res.status(400).json({ error: "Invalid start or end time" });
  if (end <= start) return res.status(400).json({ error: "End time must be after start time" });
  if (end > now + 60000) return res.status(400).json({ error: "You can't log time in the future" });
  if (end - start > 24 * 3600000) return res.status(400).json({ error: "An entry can't be longer than 24 hours" });

  const breakMs = Math.max(0, Math.round(Number(req.body.breakMinutes) || 0)) * 60000;
  if (breakMs >= end - start) return res.status(400).json({ error: "Break is longer than the entry" });

  const db = await getDB();
  const project = await db.collection("projects").findOne({ _id: str(req.body.projectId, 64) });
  if (!project) return res.status(400).json({ error: "Please choose a project" });
  if (project.status === "archived") return res.status(400).json({ error: "This project is archived" });
  if (req.u.role !== "admin" && !(project.members || []).includes(req.u.id)) {
    return res.status(403).json({ error: "You are not a member of this project" });
  }

  const taskId = str(req.body.taskId, 150);
  if (taskId) {
    const linked = await db.collection("tasks").findOne({ _id: taskId }, { projection: { projectId: 1 } });
    if (linked && linked.projectId !== project._id) return res.status(400).json({ error: "That task belongs to a different project" });
  }

  const clash = await db.collection("sessions").findOne({
    uid: req.u.id,
    start: { $lt: end },
    $or: [{ end: null }, { end: { $gt: start } }]
  });
  if (clash) return res.status(400).json({ error: "This overlaps another time entry" });

  await db.collection("sessions").insertOne({
    _id: rid(),
    uid: req.u.id,
    projectId: project._id,
    type,
    taskId,
    start,
    end,
    breaks: breakMs ? [{ s: start, e: start + breakMs }] : [],
    manual: true
  });
  res.json({ ok: 1 });
};
