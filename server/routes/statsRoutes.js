const express = require("express");
const router = express.Router();
const cors = require("cors");

const { getWorkshopStats } = require("../controllers/statsController");

router.use(
  cors({
    credentials: true,
    origin: "http://localhost:5173",
  }),
);

router.get("/workshop/:workshopId", getWorkshopStats);

module.exports = router;
