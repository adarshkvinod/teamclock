const { getDB } = require("../config/db");
const { TASK_TYPES, ID_REGEX } = require("../config/constants");

const str = (v, max = 24) => (typeof v === "string" ? v.trim().slice(0, max) : "");

exports.clockIn = async (req, res) => {
  const { id } = req.params;
  if (!ID_REGEX.test(id)) return res.status(400).json({ error: "Invalid session ID" });
  if (!TASK_TYPES.includes(req.body.type)) return res.status(400).json({ error: "Invalid task/work type" });

  const db = await getDB();
  const col = db.collection("sessions");

  if (await col.findOne({ uid: req.u.id, end: null })) {
    return res.status(400).json({ error: "You are already clocked in" });
  }

  await col.insertOne({
    _id: id,
    uid: req.u.id,
    type: req.body.type,
    taskId: str(req.body.taskId, 150), // Increased from 24 to 150 characters for custom task text
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