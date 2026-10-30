const router = require("express").Router();
const sprintCtrl = require("../controllers/sprintController");
const { needAuth, asyncHandler } = require("../middlewares/auth");

router.use(needAuth);

router.put("/:id", asyncHandler(sprintCtrl.createSprint));
router.patch("/:id", asyncHandler(sprintCtrl.updateSprint));
router.delete("/:id", asyncHandler(sprintCtrl.deleteSprint));

module.exports = router;
