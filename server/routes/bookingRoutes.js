const express = require("express");
const router = express.Router();
const cors = require("cors");

const {
  createBooking,
  listBookingsForActivity,
  listBookingsForWorkshop,
} = require("../controllers/bookingController");

router.use(
  cors({
    credentials: true,
    origin: "http://localhost:5173",
  })
);

router.post("/create", createBooking);
router.get("/activity/:activityId", listBookingsForActivity);
router.get("/workshop/:workshopId", listBookingsForWorkshop);

module.exports = router;
