const User = require("../models/userModel");
const { hashPassword, comparePassword } = require("../helpers/hashHelper");
const jwt = require("jsonwebtoken");
const Workshop = require("../models/workshopModel");

// Register user endpoint
const registerUser = async (req, res) => {
  try {
    const { name, email, password, role, workshopId } = req.body;

    if (!name) return res.status(400).json({ message: "Name is required" });
    if (!email) return res.status(400).json({ message: "Email is required" });

    const exist = await User.findOne({ email });
    if (exist)
      return res.status(400).json({ message: "Email is already taken" });

    if (!/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ message: "Email is invalid" });
    }

    if (!password)
      return res.status(400).json({ message: "Password is required" });
    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters long" });
    }
    if (password.includes(" ")) {
      return res
        .status(400)
        .json({ message: "Password must not contain spaces" });
    }
    if (!/\d/.test(password) || !/[a-zA-Z]/.test(password)) {
      return res
        .status(400)
        .json({ message: "Password must contain numbers and letters" });
    }

    if (!workshopId) {
      return res.status(400).json({ message: "workshopId is required" });
    }

    // ✅ här är nyckeln: workshopId måste peka på en riktig Workshop
    const ws = await Workshop.findById(workshopId).select("_id");
    if (!ws) {
      return res
        .status(400)
        .json({ message: "Invalid workshopId (workshop not found)" });
    }

    const hashedPassword = await hashPassword(password);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      workshopId: ws._id,
    });

    return res.json({ ok: true, user });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error", error });
  }
};

// Login user endpoint
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email" });
    }

    // Check if passwords match
    const match = await comparePassword(password, user.password);

    if (!match) {
      return res.status(400).json({ message: "Invalid password" });
    }

    if (match) {
      res.json({
        message: "Login successful",
        // Ändra värden här efter att ha redigerat user modellen
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          workshopId: user.workshopId,
        },
        role: user.role,
      });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error", error });
  }
};

module.exports = {
  registerUser,
  loginUser,
};
