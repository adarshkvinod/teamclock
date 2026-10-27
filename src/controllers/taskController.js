const { getDB } = require("../config/db");
const { STATUS, DAY_REGEX, ID_REGEX } = require("../config/constants");

const str = (v, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

exports.createTask = async (req, res) => {
  if (req.u.role !== "admin") return res.status(403).json({ error: "Not allowed" });

  const { id } = req.params;
  if (!ID_REGEX.test(id)) return res.status(400).json({ error: "Invalid task ID" });

  const title = str(req.body.title, 200);
  const { assignee, deadline } = req.body;

  if (!title || !DAY_REGEX.test(deadline)) return res.status(400).json({ error: "Invalid task details" });

  const db = await getDB();
  const employeeExists = await db.collection("users").findOne({ _id: assignee, role: "employee" });
  if (!employeeExists) return res.status(400).json({ error: "Assignee must be an active employee" });

  await db.collection("tasks").insertOne({
    _id: id,
    title,
    assignee,
    deadline,
    status: "To do",
    created: Date.now()
  });

  res.json({ ok: 1 });
};

exports.updateTask = async (req, res) => {
  const db = await getDB();
  const col = db.collection("tasks");
  const cur = await col.findOne({ _id: req.params.id });
  if (!cur) return res.status(404).json({ error: "Task not found" });

  const isAdmin = req.u.role === "admin";
  const update = {};

  if (STATUS.includes(req.body.status)) update.status = req.body.status;

  if (isAdmin) {
    if (str(req.body.title, 200)) update.title = str(req.body.title, 200);
    if (DAY_REGEX.test(req.body.deadline)) update.deadline = req.body.deadline;
    if (req.body.assignee && (await db.collection("users").findOne({ _id: req.body.assignee }))) {
      update.assignee = req.body.assignee;
    }
  } else if (cur.assignee !== req.u.id) {
    return res.status(403).json({ error: "Not allowed to edit someone else's task" });
  }

  await col.updateOne({ _id: req.params.id }, { $set: update });
  res.json({ ok: 1 });
};

exports.deleteTask = async (req, res) => {
  if (req.u.role !== "admin") return res.status(403).json({ error: "Not allowed" });

  const db = await getDB();
  await db.collection("tasks").deleteOne({ _id: req.params.id });
  res.json({ ok: 1 });
};