const express = require("express");
const router = express.Router();
const cors = require("cors");

const { createCompany } = require("../controllers/companyController");

// CORS config, ändra origin till domänen vid produktion
router.use(
  cors({
    credentials: true,
    origin: "http://localhost:5173",
  })
);

// Skapa företag
router.post("/create", createCompany);

module.exports = router;
