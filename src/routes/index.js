const router = require("express").Router();
const authRoutes = require("./authRoutes");
const userRoutes = require("./userRoutes");
const taskRoutes = require("./taskRoutes");
const sessionRoutes = require("./sessionRoutes");
const projectRoutes = require("./projectRoutes");
const sprintRoutes = require("./sprintRoutes");
const notificationRoutes = require("./notificationRoutes");

router.use("/", authRoutes);
router.use("/users", userRoutes);
router.use("/tasks", taskRoutes);
router.use("/sessions", sessionRoutes);
router.use("/projects", projectRoutes);
router.use("/sprints", sprintRoutes);
router.use("/notifications", notificationRoutes);

module.exports = router;