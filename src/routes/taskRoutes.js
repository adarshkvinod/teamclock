const router = require("express").Router();
const taskCtrl = require("../controllers/taskController");
const { needAuth, asyncHandler } = require("../middlewares/auth");

router.use(needAuth);

router.put("/:id", asyncHandler(taskCtrl.createTask));
router.patch("/:id", asyncHandler(taskCtrl.updateTask));
router.delete("/:id", asyncHandler(taskCtrl.deleteTask));

module.exports = router;