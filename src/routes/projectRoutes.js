const router = require("express").Router();
const projectCtrl = require("../controllers/projectController");
const chatCtrl = require("../controllers/chatController");
const { needAuth, asyncHandler } = require("../middlewares/auth");

router.use(needAuth);

router.put("/:id", asyncHandler(projectCtrl.createProject));
router.patch("/:id", asyncHandler(projectCtrl.updateProject));
router.delete("/:id", asyncHandler(projectCtrl.deleteProject));

// Project chat + activity feed
router.get("/:id/chat", asyncHandler(chatCtrl.getMessages));
router.post("/:id/chat", asyncHandler(chatCtrl.postMessage));
router.patch("/:id/chat/:mid", asyncHandler(chatCtrl.editMessage));
router.delete("/:id/chat/:mid", asyncHandler(chatCtrl.deleteMessage));
router.post("/:id/chat-read", asyncHandler(chatCtrl.markRead));
router.get("/:id/activity", asyncHandler(chatCtrl.getActivity));

module.exports = router;
