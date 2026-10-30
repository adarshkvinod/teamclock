const router = require("express").Router();
const taskCtrl = require("../controllers/taskController");
const { needAuth, asyncHandler } = require("../middlewares/auth");

router.use(needAuth);

router.put("/:id", asyncHandler(taskCtrl.createTask));
router.patch("/:id", asyncHandler(taskCtrl.updateTask));
router.delete("/:id", asyncHandler(taskCtrl.deleteTask));

router.get("/:id/detail", asyncHandler(taskCtrl.getDetail));
router.post("/:id/comments", asyncHandler(taskCtrl.addComment));
router.delete("/:id/comments/:cid", asyncHandler(taskCtrl.deleteComment));

module.exports = router;
