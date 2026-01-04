const express = require("express");
const router = express.Router();
const cors = require("cors");

const {
  createActivity,
  listActivities,
  getActivity,
  getActivityAvailability,
} = require("../controllers/activityController");

// samma CORS-stil som dina andra routes :contentReference[oaicite:5]{index=5}
router.use(
  cors({
    credentials: true,
    origin: "http://localhost:5173",
  })
);

router.post("/create", createActivity);
router.get("/", listActivities);
router.get("/:id", getActivity);
router.get("/:id/availability", getActivityAvailability);

module.exports = router;
