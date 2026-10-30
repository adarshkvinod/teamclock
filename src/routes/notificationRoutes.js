const router = require("express").Router();
const ctrl = require("../controllers/notificationController");
const { needAuth, asyncHandler } = require("../middlewares/auth");

router.use(needAuth);
router.post("/read", asyncHandler(ctrl.markRead));

module.exports = router;
