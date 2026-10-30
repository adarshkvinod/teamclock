const { getDB } = require("../config/db");
const { rid, str, projectFor, extractMentions, notify } = require("../services/collab");

const pub = (m) => ({
  id: m._id,
  uid: m.uid,
  text: m.deleted ? "" : m.text,
  at: m.at,
  u: m.u,
  edited: !!m.edited,
  deleted: !!m.deleted
});

// Latest messages, or only what changed after `after` (new, edited or deleted) for cheap polling.
exports.getMessages = async (req, res) => {
  const db = await getDB();
  const project = await projectFor(db, req, res, req.params.id);
  if (!project) return;

  const after = Number(req.query.after) || 0;
  const col = db.collection("messages");

  let list;
  if (after) {
    list = await col.find({ projectId: project._id, u: { $gt: after } }).sort({ u: 1 }).limit(200).toArray();
  } else {
    list = (await col.find({ projectId: project._id }).sort({ at: -1 }).limit(60).toArray()).reverse();
  }
  res.json({ messages: list.map(pub) });
};

exports.postMessage = async (req, res) => {
  const db = await getDB();
  const project = await projectFor(db, req, res, req.params.id);
  if (!project) return;
  if (project.status === "archived") return res.status(400).json({ error: "This project is archived" });

  const text = str(req.body.text, 2000);
  if (!text) return res.status(400).json({ error: "Message is empty" });

  const mentions = await extractMentions(db, text, project, req.u.id);
  const now = Date.now();
  const msg = { _id: rid(), projectId: project._id, uid: req.u.id, text, mentions, at: now, u: now };
  await db.collection("messages").insertOne(msg);

  await notify(db, {
    uids: mentions,
    from: req.u.id,
    projectId: project._id,
    kind: "mention",
    tab: "chat",
    text: `You were mentioned in ${project.name} chat`
  });

  res.json({ message: pub(msg) });
};

exports.editMessage = async (req, res) => {
  const db = await getDB();
  const project = await projectFor(db, req, res, req.params.id);
  if (!project) return;

  const col = db.collection("messages");
  const m = await col.findOne({ _id: req.params.mid, projectId: project._id });
  if (!m || m.deleted) return res.status(404).json({ error: "Message not found" });
  if (m.uid !== req.u.id) return res.status(403).json({ error: "You can only edit your own messages" });

  const text = str(req.body.text, 2000);
  if (!text) return res.status(400).json({ error: "Message is empty" });

  await col.updateOne({ _id: m._id }, { $set: { text, edited: true, u: Date.now() } });
  res.json({ ok: 1 });
};

// Soft delete so other people's polling learns about it
exports.deleteMessage = async (req, res) => {
  const db = await getDB();
  const project = await projectFor(db, req, res, req.params.id);
  if (!project) return;

  const col = db.collection("messages");
  const m = await col.findOne({ _id: req.params.mid, projectId: project._id });
  if (!m) return res.json({ ok: 1 });
  if (m.uid !== req.u.id && req.u.role !== "admin") return res.status(403).json({ error: "Not allowed" });

  await col.updateOne({ _id: m._id }, { $set: { deleted: true, text: "", u: Date.now() } });
  res.json({ ok: 1 });
};

exports.markRead = async (req, res) => {
  const db = await getDB();
  const project = await projectFor(db, req, res, req.params.id);
  if (!project) return;
  await db
    .collection("reads")
    .updateOne({ _id: `${req.u.id}:${project._id}` }, { $set: { uid: req.u.id, projectId: project._id, at: Date.now() } }, { upsert: true });
  res.json({ ok: 1 });
};

exports.getActivity = async (req, res) => {
  const db = await getDB();
  const project = await projectFor(db, req, res, req.params.id);
  if (!project) return;
  const list = await db.collection("activity").find({ projectId: project._id }).sort({ at: -1 }).limit(40).toArray();
  res.json({ activity: list.map(({ _id, ...r }) => ({ id: _id, ...r })) });
};
