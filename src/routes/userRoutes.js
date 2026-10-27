const router = require("express").Router();
const userCtrl = require("../controllers/userController");
const { needAuth, asyncHandler } = require("../middlewares/auth");

router.use(needAuth);
router.put("/:id", asyncHandler(userCtrl.createEmployee));
router.patch("/:id", asyncHandler(userCtrl.updateEmployee));
router.delete("/:id", asyncHandler(userCtrl.deleteEmployee));

module.exports = router;