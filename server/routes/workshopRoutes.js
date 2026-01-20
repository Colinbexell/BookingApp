const express = require("express");
const router = express.Router();
const cors = require("cors");

const {
  createWorkshop,
  getWorkshopName,
  getWorkshopAvailability,
  updateWorkshopAvailability,
  getWorkshopSettings,
  updateWorkshopSettings,
} = require("../controllers/workshopController");

// CORS config, ändra origin till domänen vid produktion
router.use(
  cors({
    credentials: true,
    origin: "http://localhost:5173",
  }),
);

// Skapa workshop
router.post("/create", createWorkshop);

// Behåll din nuvarande: returnerar { name }
router.get("/:id", getWorkshopName);

// ✅ NYA: öppettider (availability)
router.get("/:id/availability", getWorkshopAvailability);
router.patch("/:id/availability", updateWorkshopAvailability);

router.get("/:id/settings", getWorkshopSettings);
router.patch("/:id/settings", updateWorkshopSettings);

module.exports = router;
