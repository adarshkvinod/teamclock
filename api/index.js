const express = require("express"), { MongoClient } = require("mongodb"), jwt = require("jsonwebtoken"), bcrypt = require("bcryptjs"), crypto = require("crypto");
const app = express(); app.use(express.json({ limit: "50kb" }));
const SECRET = process.env.JWT_SECRET;
const TYPES = ["Designer", "Project Manager", "Marketing", "Developer", "DevOps"];
const STATUS = ["To do", "In progress", "Done"];
let cli;
const D = async () => { if (!cli) { cli = new MongoClient(process.env.MONGODB_URI); await cli.connect(); } return cli.db(process.env.DB_NAME || "teamclock"); };
const h = f => (q, r) => f(q, r).catch(e => { console.error(e); r.status(500).json({ error: "Server error" }); });
const pub = ({ _id, hash, ...r }) => ({ id: _id, ...r });
const rid = () => crypto.randomBytes(6).toString("hex");
const tok = u => jwt.sign({ id: u._id, role: u.role }, SECRET, { expiresIn: "7d" });
const need = (q, r, n) => { try { q.u = jwt.verify((q.headers.authorization || "").slice(7), SECRET); n(); } catch { r.status(401).json({ error: "Please log in again" }); } };
const str = (v, m = 80) => typeof v === "string" ? v.trim().slice(0, m) : "";
const DAY = /^\d{4}-\d{2}-\d{2}$/, ID = /^[a-z0-9]{6,24}$/;

app.get("/api/state", h(async (q, r) => {
  const d = await D(); r.json({ needsSetup: !(await d.collection("users").countDocuments({}, { limit: 1 })) });
}));

app.post("/api/setup", h(async (q, r) => {
  const d = await D();
  if (await d.collection("users").countDocuments({}, { limit: 1 })) return r.status(403).json({ error: "Already set up" });
  const name = str(q.body.name), username = str(q.body.username).toLowerCase(), pw = String(q.body.password || "");
  if (!name || !username || pw.length < 4) return r.status(400).json({ error: "Fill all fields (password 4+ characters)" });
  const u = { _id: rid(), name, username, hash: await bcrypt.hash(pw, 10), role: "admin", workType: "Project Manager" };
  await d.collection("users").insertOne(u); r.json({ token: tok(u), id: u._id });
}));

app.post("/api/login", h(async (q, r) => {
  const d = await D(), u = await d.collection("users").findOne({ username: str(q.body.username).toLowerCase() });
  if (!u || !(await bcrypt.compare(String(q.body.password || ""), u.hash))) return r.status(401).json({ error: "Wrong username or password." });
  r.json({ token: tok(u), id: u._id });
}));

app.get("/api/data", need, h(async (q, r) => {
  const d = await D(), a = q.u.role === "admin";
  const users = (await d.collection("users").find().toArray()).map(u => a ? pub(u) : { id: u._id, name: u.name, role: u.role, workType: u.workType });
  const tasks = await d.collection("tasks").find(a ? {} : { assignee: q.u.id }).toArray();
  const sessions = await d.collection("sessions").find(a ? {} : { uid: q.u.id }).sort({ start: -1 }).limit(3000).toArray();
  r.json({ users, tasks: tasks.map(pub), sessions: sessions.map(pub) });
}));

app.use("/api/:c/:id", need);
app.all("/api/:c/:id", h(async (q, r) => {
  const { c, id } = q.params, m = q.method, b = q.body || {}, adm = q.u.role === "admin";
  if (!ID.test(id) || !["users", "tasks", "sessions"].includes(c)) return r.status(404).json({ error: "Not found" });
  const d = await D(), col = d.collection(c), cur = await col.findOne({ _id: id });
  const no = () => r.status(403).json({ error: "Not allowed" }), bad = e => r.status(400).json({ error: e }), ok = () => r.json({ ok: 1 });

  if (c === "users") {
    if (!adm) return no();
    if (m === "PUT") {
      const name = str(b.name), username = str(b.username).toLowerCase(), pw = String(b.password || "");
      if (cur || !name || !username || pw.length < 4 || !TYPES.includes(b.workType)) return bad("Invalid employee data");
      if (await col.findOne({ username })) return bad("Username already exists");
      await col.insertOne({ _id: id, name, username, hash: await bcrypt.hash(pw, 10), role: "employee", workType: b.workType }); return ok();
    }
    if (!cur) return bad("Not found");
    if (m === "PATCH") {
      const s = {}; if (str(b.name)) s.name = str(b.name); if (TYPES.includes(b.workType)) s.workType = b.workType;
      if (b.password) { if (String(b.password).length < 4) return bad("Password too short"); s.hash = await bcrypt.hash(String(b.password), 10); }
      await col.updateOne({ _id: id }, { $set: s }); return ok();
    }
    if (m === "DELETE") { if (cur.role === "admin") return no(); await col.deleteOne({ _id: id }); return ok(); }
  }

  if (c === "tasks") {
    if (m === "PUT") {
      if (!adm) return no();
      const title = str(b.title, 200);
      if (cur || !title || !DAY.test(b.deadline) || !(await d.collection("users").findOne({ _id: b.assignee, role: "employee" }))) return bad("Invalid task data");
      await col.insertOne({ _id: id, title, assignee: b.assignee, deadline: b.deadline, status: "To do", created: Date.now() }); return ok();
    }
    if (!cur) return bad("Not found");
    if (m === "PATCH") {
      const s = {};
      if (STATUS.includes(b.status)) s.status = b.status;
      if (adm) {
        if (str(b.title, 200)) s.title = str(b.title, 200);
        if (DAY.test(b.deadline)) s.deadline = b.deadline;
        if (b.assignee && await d.collection("users").findOne({ _id: b.assignee })) s.assignee = b.assignee;
      } else if (cur.assignee !== q.u.id) return no();
      await col.updateOne({ _id: id }, { $set: s }); return ok();
    }
    if (m === "DELETE") { if (!adm) return no(); await col.deleteOne({ _id: id }); return ok(); }
  }

  if (c === "sessions") {
    if (m === "PUT") {
      if (cur || !TYPES.includes(b.type)) return bad("Invalid session");
      if (await col.findOne({ uid: q.u.id, end: null })) return bad("You are already clocked in");
      await col.insertOne({ _id: id, uid: q.u.id, type: b.type, taskId: str(b.taskId, 24), start: Date.now(), end: null, breaks: [] }); return ok();
    }
    if (!cur) return bad("Not found");
    if (m === "PATCH") {
      if (cur.uid !== q.u.id || cur.end) return no();
      const s = {};
      if (Array.isArray(b.breaks)) s.breaks = b.breaks.slice(0, 200).map(x => ({ s: +x.s, e: x.e ? +x.e : null })).filter(x => x.s > 0);
      if (b.end) { s.end = Date.now(); s.breaks = (s.breaks || cur.breaks).map(x => x.e ? x : { ...x, e: s.end }); }
      await col.updateOne({ _id: id }, { $set: s }); return ok();
    }
    if (m === "DELETE") { if (!adm) return no(); await col.deleteOne({ _id: id }); return ok(); }
  }
  r.status(405).json({ error: "Method not allowed" });
}));

module.exports = app;
