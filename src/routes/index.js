const router = require("express").Router();
const authRoutes = require("./authRoutes");
const userRoutes = require("./userRoutes");
const taskRoutes = require("./taskRoutes");
const sessionRoutes = require("./sessionRoutes");
const projectRoutes = require("./projectRoutes");

router.use("/", authRoutes);
router.use("/users", userRoutes);
router.use("/tasks", taskRoutes);
router.use("/sessions", sessionRoutes);
router.use("/projects", projectRoutes);

module.exports = router;