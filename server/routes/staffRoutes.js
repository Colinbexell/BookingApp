const express = require("express");
const router = express.Router();
const { createStaff, listStaff, updateStaff, deleteStaff } =
  require("../controllers/staffController");

router.post("/create", createStaff);
router.get("/", listStaff);
router.patch("/:id", updateStaff);
router.delete("/:id", deleteStaff);

module.exports = router;