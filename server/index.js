const express = require("express");
const dotenv = require("dotenv").config();
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const app = express();

// DB connection
mongoose
  .connect(process.env.DB_URL)
  .then(() => {
    console.log("Database connected");
  })
  .catch((err) => {
    console.error("Database connection error:", err);
  });

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));

app.use("/user", require("./routes/authRoutes"));
app.use("/company", require("./routes/companyRoutes"));
app.use("/workshop", require("./routes/workshopRoutes"));
app.use("/activity", require("./routes/activityRoutes"));
app.use("/booking", require("./routes/bookingRoutes"));

// Start the server
app.listen(6969, () => {
  console.log("Server is running on port 6969");
});
