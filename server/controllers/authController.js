const User = require("../models/userModel");
const { hashPassword, comparePassword } = require("../helpers/hashHelper");
const jwt = require("jsonwebtoken");

// Register user endpoint
const registerUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    // Name check
    if (!name) {
      return res.status(400).json({ message: "Name is required" });
    }

    // Email checks
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const exist = await User.findOne({ email });
    if (exist) {
      return res.status(400).json({ message: "Email is already taken" });
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ message: "Email is invalid" });
    }

    // Password checks
    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }

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

    // Creating the user

    const hashedPassword = await hashPassword(password);

    // Ändra värden här efter att ha redigerat user modellen
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
    });

    return res.json(user);
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
    // If the passwords match then sign the json web token so it'll end up in cookies
    if (match) {
      jwt.sign(
        {
          // Lägg till de värden som ska sparas i JWT cookien
          email: user.email,
          id: user._id,
          name: user.name,
          role: user.role,
        },
        process.env.JWT_SECRET,
        { expiresIn: "7d" },
        (err, token) => {
          if (err) {
            console.error("JWT signing error:", err);
            return res.status(500).json({ message: "Token generation failed" });
          }
          // Sätt cookie
          res
            .cookie("token", token, {
              httpOnly: true, // Security: förhindrar XSS attacker
              secure: false, //⚠️ SÄTT TILL "true" UNDER PRODUKTION. För att förhindra HTTPS attacker
              sameSite: "lax", //  CSRF-Skydd, "lax" fungerar för de flesta projekt men "strict" kan vara bättre för känsliga sidor
              maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
            })
            .json({
              message: "Login successful",
              // Ändra värden här efter att ha redigerat user modellen
              user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
              },
              role: user.role,
            });
        }
      );
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error", error });
  }
};

// Gets the user profile and their stuff from the cookies, used in the userContext.jsx
const getProfile = (req, res) => {
  const { token } = req.cookies;
  if (token) {
    jwt.verify(token, process.env.JWT_SECRET, {}, (err, user) => {
      if (err) {
        return res.status(401).json({ error: "Invalid token" });
      }
      res.json(user);
    });
  } else {
    res.json(null);
  }
};

// Logout user endpoint
const logoutUser = (req, res) => {
  res.clearCookie("token").json({ message: "Logged out successfully" });
};

module.exports = {
  registerUser,
  loginUser,
  getProfile,
  logoutUser,
};
