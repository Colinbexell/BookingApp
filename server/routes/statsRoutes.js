const express = require("express");
const router = express.Router();
const cors = require("cors");

const { getWorkshopStats } = require("../controllers/statsController");

router.get("/workshop/:workshopId", getWorkshopStats);

module.exports = router;
