const express = require("express");
const dotenv = require("dotenv").config();
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const app = express();
const path = require("path");
const cors = require("cors");

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
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);

// Måste ligga före express.json
app.post(
  "/payment/webhook",
  express.raw({ type: "application/json" }),
  require("./controllers/paymentController").webhook,
);

app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/user", require("./routes/authRoutes"));
app.use("/company", require("./routes/companyRoutes"));
app.use("/workshop", require("./routes/workshopRoutes"));
app.use("/activity", require("./routes/activityRoutes"));
app.use("/booking", require("./routes/bookingRoutes"));
app.use("/upload", require("./routes/uploadRoutes"));
app.use("/stats", require("./routes/statsRoutes"));
app.use("/payment", require("./routes/paymentRoutes"));

// Start the server
app.listen(6969, () => {
  console.log("Server is running on port 6969");
});
