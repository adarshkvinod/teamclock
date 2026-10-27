const router = require("express").Router();
const sessionCtrl = require("../controllers/sessionController");
const { needAuth, asyncHandler } = require("../middlewares/auth");

router.use(needAuth);
router.put("/:id", asyncHandler(sessionCtrl.clockIn));
router.patch("/:id", asyncHandler(sessionCtrl.updateSession));
router.delete("/:id", asyncHandler(sessionCtrl.deleteSession));

module.exports = router;