const { getDB } = require("../config/db");
const { PROJECT_STATUS, DAY_REGEX, ID_REGEX } = require("../config/constants");
const { ensureProjects } = require("../services/projects");

const str = (v, max = 80) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// Keep only ids that belong to real employees (de-duplicated).
const cleanMembers = async (db, list) => {
  if (!Array.isArray(list)) return [];
  const ids = [...new Set(list.filter((x) => typeof x === "string").slice(0, 500))];
  if (!ids.length) return [];
  const found = await db
    .collection("users")
    .find({ _id: { $in: ids }, role: "employee" }, { projection: { _id: 1 } })
    .toArray();
  return found.map((u) => u._id);
};

const dateOrEmpty = (v) => (typeof v === "string" && DAY_REGEX.test(v) ? v : "");

const nameTaken = async (col, name, exceptId) => {
  const all = await col.find({}, { projection: { name: 1 } }).toArray();
  const key = name.toLowerCase();
  return all.some((p) => p._id !== exceptId && String(p.name).toLowerCase() === key);
};

exports.createProject = async (req, res) => {
  if (req.u.role !== "admin") return res.status(403).json({ error: "Only the admin can create projects" });

  const { id } = req.params;
  if (!ID_REGEX.test(id)) return res.status(400).json({ error: "Invalid project ID" });

  const name = str(req.body.name, 80);
  if (!name) return res.status(400).json({ error: "Project name is required" });

  const start = dateOrEmpty(req.body.start);
  const end = dateOrEmpty(req.body.end);
  if (start && end && end < start) return res.status(400).json({ error: "End date cannot be before start date" });

  const db = await getDB();
  await ensureProjects(db);
  const col = db.collection("projects");

  if (await col.findOne({ _id: id })) return res.status(400).json({ error: "Project ID already exists" });
  if (await nameTaken(col, name)) return res.status(400).json({ error: "A project with this name already exists" });

  await col.insertOne({
    _id: id,
    name,
    description: str(req.body.description, 300),
    status: "active",
    start,
    end,
    members: await cleanMembers(db, req.body.members),
    created: Date.now()
  });

  res.json({ ok: 1 });
};

exports.updateProject = async (req, res) => {
  if (req.u.role !== "admin") return res.status(403).json({ error: "Only the admin can edit projects" });

  const db = await getDB();
  const col = db.collection("projects");
  const cur = await col.findOne({ _id: req.params.id });
  if (!cur) return res.status(404).json({ error: "Project not found" });

  const update = {};

  if (req.body.name !== undefined) {
    const name = str(req.body.name, 80);
    if (!name) return res.status(400).json({ error: "Project name is required" });
    if (await nameTaken(col, name, cur._id)) {
      return res.status(400).json({ error: "A project with this name already exists" });
    }
    update.name = name;
  }

  if (req.body.description !== undefined) update.description = str(req.body.description, 300);
  if (req.body.start !== undefined) update.start = dateOrEmpty(req.body.start);
  if (req.body.end !== undefined) update.end = dateOrEmpty(req.body.end);

  const start = update.start !== undefined ? update.start : cur.start;
  const end = update.end !== undefined ? update.end : cur.end;
  if (start && end && end < start) return res.status(400).json({ error: "End date cannot be before start date" });

  if (PROJECT_STATUS.includes(req.body.status)) update.status = req.body.status;

  if (Array.isArray(req.body.members)) {
    const members = await cleanMembers(db, req.body.members);
    const removed = (cur.members || []).filter((m) => !members.includes(m));

    // Don't strand unfinished work on someone who is leaving the project.
    for (const uid of removed) {
      const open = await db
        .collection("tasks")
        .countDocuments({ projectId: cur._id, assignee: uid, status: { $ne: "Done" } });
      if (open) {
        const u = await db.collection("users").findOne({ _id: uid }, { projection: { name: 1 } });
        return res.status(400).json({
          error: `${u ? u.name : "This employee"} still has ${open} open task(s) in this project. Reassign or complete them first.`
        });
      }
    }
    update.members = members;
  }

  if (Object.keys(update).length) await col.updateOne({ _id: cur._id }, { $set: update });
  res.json({ ok: 1 });
};

exports.deleteProject = async (req, res) => {
  if (req.u.role !== "admin") return res.status(403).json({ error: "Only the admin can delete projects" });

  const db = await getDB();
  const id = req.params.id;

  const [taskCount, sessionCount] = await Promise.all([
    db.collection("tasks").countDocuments({ projectId: id }, { limit: 1 }),
    db.collection("sessions").countDocuments({ projectId: id }, { limit: 1 })
  ]);
  if (taskCount || sessionCount) {
    return res.status(400).json({
      error: "This project has tasks or time entries. Archive it instead so the history is preserved."
    });
  }

  await db.collection("projects").deleteOne({ _id: id });
  res.json({ ok: 1 });
};
