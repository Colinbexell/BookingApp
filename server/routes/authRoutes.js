const express = require("express");
const router = express.Router();
const cors = require("cors");
const rateLimit = require("express-rate-limit");

// Importer routes controllers
const {
  registerUser,
  loginUser,
  getProfile,
  logoutUser,
} = require("../controllers/authController");

// CORS config, ändra origin till domänen vid produktion
router.use(
  cors({
    credentials: true,
    origin: "http://localhost:5173",
  })
);

// Rate limiting for login attempts
const loginLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minut
  max: 5, // max 5 försök per IP-adress
  message: { error: "För många inloggningsförsök, försök igen om en minut" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Register user route
router.post("/register", registerUser);

// Login user route
router.post("/login", loginLimiter, loginUser);

// Login user route
router.get("/profile", getProfile);

// Logout user route
router.post("/logout", logoutUser);

module.exports = router;
