const express = require("express");
const router = express.Router();
const cors = require("cors");

const {
  createBooking,
  listBookingsForWorkshop,
  cancelBookings,
} = require("../controllers/bookingController");

router.use(
  cors({
    credentials: true,
    origin: "http://localhost:5173",
  })
);

router.post("/create", createBooking);
router.get("/workshop/:workshopId", listBookingsForWorkshop);
router.patch("/cancel", cancelBookings);

module.exports = router;
