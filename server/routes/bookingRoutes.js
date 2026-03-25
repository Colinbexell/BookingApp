const express = require("express");
const router = express.Router();
const cors = require("cors");

const {
  createBooking,
  listBookingsForWorkshop,
  cancelBookings,
  markBookingsPaid,
  confirmBooking,
} = require("../controllers/bookingController");

router.post("/create", createBooking);
router.get("/workshop/:workshopId", listBookingsForWorkshop);
router.patch("/cancel", cancelBookings);
router.patch("/mark-paid", markBookingsPaid);
router.get("/confirm/:token", confirmBooking);

module.exports = router;
