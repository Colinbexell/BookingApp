const express = require("express");
const router = express.Router();
const {
  getOrigins,
  addOrigin,
  removeOrigin,
} = require("../controllers/corsController");

// Skydda dessa med din admin-auth middleware
router.get("/", getOrigins);
router.post("/", addOrigin);
router.delete("/", removeOrigin);

module.exports = router;
