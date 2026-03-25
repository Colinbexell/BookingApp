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
