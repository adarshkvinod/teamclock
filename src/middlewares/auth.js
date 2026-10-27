const jwt = require("jsonwebtoken");
const { SECRET } = require("../config/constants");

const needAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
    if (!token) return res.status(401).json({ error: "Please log in again" });

    req.u = jwt.verify(token, SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: "Please log in again" });
  }
};

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error("Server Route Error:", err);
    res.status(500).json({ error: "Server error occurred" });
  });
};

module.exports = { needAuth, asyncHandler };