const express = require("express");
const router = express.Router();
const cors = require("cors");

const {
  createActivity,
  listActivities,
  getActivity,
  getActivityAvailability,
  updateActivity,
  deleteActivity,
} = require("../controllers/activityController");

router.post("/create", createActivity);
router.get("/", listActivities);
router.get("/:id", getActivity);
router.get("/:id/availability", getActivityAvailability);
router.patch("/:id", updateActivity);
router.delete("/:id", deleteActivity);

module.exports = router;
