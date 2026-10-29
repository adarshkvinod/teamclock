const router = require("express").Router();
const projectCtrl = require("../controllers/projectController");
const { needAuth, asyncHandler } = require("../middlewares/auth");

router.use(needAuth);

router.put("/:id", asyncHandler(projectCtrl.createProject));
router.patch("/:id", asyncHandler(projectCtrl.updateProject));
router.delete("/:id", asyncHandler(projectCtrl.deleteProject));

module.exports = router;
