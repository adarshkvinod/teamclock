const crypto = require("crypto");

const rid = () => crypto.randomBytes(6).toString("hex");

const str = (v, max = 80) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// Net working time of a session in ms (end - start - breaks)
const workedMs = (s, now = Date.now()) => {
  const end = s.end || now;
  const br = (s.breaks || []).reduce((a, b) => a + ((b.e || end) - b.s), 0);
  return Math.max(0, end - s.start - br);
};

// Loads a project and checks the caller may see it (admin, or member). Sends the error itself.
async function projectFor(db, req, res, id) {
  const project = await db.collection("projects").findOne({ _id: id });
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return null;
  }
  if (req.u.role !== "admin" && !(project.members || []).includes(req.u.id)) {
    res.status(403).json({ error: "You are not a member of this project" });
    return null;
  }
  return project;
}

// @username mentions -> ids of project members (excluding the author)
async function extractMentions(db, text, project, authorId) {
  const names = [...String(text).matchAll(/@([a-zA-Z0-9._-]{2,40})/g)].map((m) => m[1].toLowerCase());
  if (!names.length || !(project.members || []).length) return [];
  const users = await db
    .collection("users")
    .find({ _id: { $in: project.members }, username: { $in: [...new Set(names)] } }, { projection: { _id: 1 } })
    .toArray();
  return users.map((u) => u._id).filter((id) => id !== authorId);
}

async function logActivity(db, { projectId, uid, kind, text, taskId = null }) {
  await db.collection("activity").insertOne({ _id: rid(), projectId, uid, kind, text, taskId, at: Date.now() });
}

// In-app notifications. `tab` + `taskId` tell the UI where to take the user when clicked.
async function notify(db, { uids, from, projectId, kind, text, taskId = null, tab = null }) {
  const targets = [...new Set((uids || []).filter((u) => u && u !== from))];
  if (!targets.length) return;
  const at = Date.now();
  await db.collection("notifications").insertMany(
    targets.map((uid) => ({ _id: rid(), uid, from: from || null, projectId, kind, text, taskId, tab, at, read: false }))
  );
}

module.exports = { rid, str, workedMs, projectFor, extractMentions, logActivity, notify };
