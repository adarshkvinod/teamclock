const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { getDB } = require("../config/db");
const { SECRET } = require("../config/constants");
const { ensureProjects } = require("../services/projects");

const pub = ({ _id, hash, ...r }) => ({ id: _id, ...r });
const rid = () => crypto.randomBytes(6).toString("hex");
const tok = (u) => jwt.sign({ id: u._id, role: u.role }, SECRET, { expiresIn: "7d" });
const str = (v, max = 80) => (typeof v === "string" ? v.trim().slice(0, max) : "");

exports.getState = async (req, res) => {
  const db = await getDB();
  const hasUsers = await db.collection("users").countDocuments({}, { limit: 1 });
  res.json({ needsSetup: !hasUsers });
};

exports.setupAdmin = async (req, res) => {
  const db = await getDB();
  const count = await db.collection("users").countDocuments({}, { limit: 1 });
  if (count) return res.status(403).json({ error: "Already set up" });

  const name = str(req.body.name);
  const username = str(req.body.username).toLowerCase();
  const pw = String(req.body.password || "");

  if (!name || !username || pw.length < 4) {
    return res.status(400).json({ error: "Fill all fields (password 4+ characters)" });
  }

  const admin = {
    _id: rid(),
    name,
    username,
    hash: await bcrypt.hash(pw, 10),
    role: "admin",
    workType: "Project Manager"
  };

  await db.collection("users").insertOne(admin);
  res.json({ token: tok(admin), id: admin._id });
};

exports.login = async (req, res) => {
  const db = await getDB();
  const username = str(req.body.username).toLowerCase();
  const pw = String(req.body.password || "");

  const user = await db.collection("users").findOne({ username });
  if (!user || !(await bcrypt.compare(pw, user.hash))) {
    return res.status(401).json({ error: "Wrong username or password." });
  }

  res.json({ token: tok(user), id: user._id });
};

exports.getData = async (req, res) => {
  const db = await getDB();
  const isAdmin = req.u.role === "admin";

  await ensureProjects(db); // one-time move of legacy data into the Docbook project

  // Admin sees every project; an employee only sees projects they are a member of.
  const projects = await db
    .collection("projects")
    .find(isAdmin ? {} : { members: req.u.id })
    .sort({ created: 1 })
    .toArray();
  const projectIds = projects.map((p) => p._id);

  const users = (await db.collection("users").find().toArray()).map((u) =>
    isAdmin ? pub(u) : { id: u._id, name: u.name, role: u.role, workType: u.workType }
  );
  const tasks = await db
    .collection("tasks")
    .find(isAdmin ? {} : { assignee: req.u.id, projectId: { $in: projectIds } })
    .toArray();
  const sessions = await db.collection("sessions").find(isAdmin ? {} : { uid: req.u.id }).sort({ start: -1 }).limit(3000).toArray();

  res.json({ users, projects: projects.map(pub), tasks: tasks.map(pub), sessions: sessions.map(pub) });
};