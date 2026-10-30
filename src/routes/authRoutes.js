const router = require("express").Router();
const authCtrl = require("../controllers/authController");
const { needAuth, asyncHandler } = require("../middlewares/auth");

router.get("/state", asyncHandler(authCtrl.getState));
router.post("/setup", asyncHandler(authCtrl.setupAdmin));
router.post("/login", asyncHandler(authCtrl.login));
router.get("/data", needAuth, asyncHandler(authCtrl.getData));
router.post("/password", needAuth, asyncHandler(authCtrl.changePassword));

module.exports = router;