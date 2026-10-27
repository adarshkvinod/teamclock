const bcrypt = require("bcryptjs");
const { getDB } = require("../config/db");
const { ROLES, ID_REGEX } = require("../config/constants");

const str = (v, max = 80) => (typeof v === "string" ? v.trim().slice(0, max) : "");

exports.createEmployee = async (req, res) => {
  if (req.u.role !== "admin") return res.status(403).json({ error: "Not allowed: Admin only" });

  const { id } = req.params;
  if (!ID_REGEX.test(id)) return res.status(400).json({ error: "Invalid ID format" });

  const name = str(req.body.name);
  const username = str(req.body.username).toLowerCase();
  const pw = String(req.body.password || "");

  // Multi-role extraction and validation
  let roles = [];
  if (Array.isArray(req.body.roles)) {
    roles = req.body.roles.filter((r) => ROLES.includes(r));
  } else if (typeof req.body.workType === "string") {
    roles = req.body.workType.split(",").map((s) => s.trim()).filter((r) => ROLES.includes(r));
  }

  if (!name) return res.status(400).json({ error: "Employee name is required" });
  if (!username) return res.status(400).json({ error: "Username is required" });
  if (pw.length < 4) return res.status(400).json({ error: "Password must be at least 4 characters" });
  if (roles.length === 0) return res.status(400).json({ error: "Select at least one valid role" });

  const db = await getDB();
  const col = db.collection("users");

  const existingUsername = await col.findOne({ username });
  if (existingUsername) return res.status(400).json({ error: "Username already exists" });

  const existingId = await col.findOne({ _id: id });
  if (existingId) return res.status(400).json({ error: "User record with this ID already exists" });

  await col.insertOne({
    _id: id,
    name,
    username,
    hash: await bcrypt.hash(pw, 10),
    role: "employee",
    roles: roles,
    workType: roles.join(", ") // Comma-separated string for display fallback
  });

  res.json({ ok: 1 });
};

exports.updateEmployee = async (req, res) => {
  if (req.u.role !== "admin") return res.status(403).json({ error: "Not allowed" });

  const db = await getDB();
  const col = db.collection("users");
  const user = await col.findOne({ _id: req.params.id });
  if (!user) return res.status(404).json({ error: "Employee not found" });

  const update = {};
  if (str(req.body.name)) update.name = str(req.body.name);
  
  if (Array.isArray(req.body.roles)) {
    const valid = req.body.roles.filter((r) => ROLES.includes(r));
    if (valid.length > 0) {
      update.roles = valid;
      update.workType = valid.join(", ");
    }
  }

  if (req.body.password) {
    if (String(req.body.password).length < 4) return res.status(400).json({ error: "Password too short" });
    update.hash = await bcrypt.hash(String(req.body.password), 10);
  }

  await col.updateOne({ _id: req.params.id }, { $set: update });
  res.json({ ok: 1 });
};

exports.deleteEmployee = async (req, res) => {
  if (req.u.role !== "admin") return res.status(403).json({ error: "Not allowed" });

  const db = await getDB();
  const col = db.collection("users");
  const user = await col.findOne({ _id: req.params.id });

  if (!user) return res.status(404).json({ error: "User not found" });
  if (user.role === "admin") return res.status(403).json({ error: "Cannot delete the admin account" });

  await col.deleteOne({ _id: req.params.id });
  res.json({ ok: 1 });
};