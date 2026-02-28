const express = require("express");
const dotenv = require("dotenv").config();
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const app = express();
const path = require("path");
const cors = require("cors");

// Använder GOOGLE DNS. Ta bort vid produktion
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);



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

const connectDB = async (retries = 5) => {
  for (let i = 0; i < retries; i++) {
    try {
      await mongoose.connect(process.env.DB_URL);
      console.log("Database connected");
      return;
    } catch (err) {
      console.error(`DB-försök ${i + 1} misslyckades:`, err.message);
      if (i < retries - 1) await new Promise(r => setTimeout(r, 3000));
    }
  }
  console.error("Kunde inte ansluta till databasen, stänger av.");
  process.exit(1);
};

connectDB().then(() => {
  app.listen(6969, () => {
    console.log("Server is running on port 6969");
  });
});
