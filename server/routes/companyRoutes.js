const express = require("express");
const router = express.Router();
const cors = require("cors");

const { createCompany } = require("../controllers/companyController");

// Skapa företag
router.post("/create", createCompany);

module.exports = router;
