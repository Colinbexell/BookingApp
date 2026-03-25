const express = require("express");
const dotenv = require("dotenv").config();
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const app = express();

const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const { loadOrigins, isAllowed } = require("./controllers/corsController");

// Dynamisk CORS — kollar mot in-memory cache (synkad med DB)
app.use(
  cors({
    origin: (origin, callback) => {
      // Tillåt requests utan origin (t.ex. Postman, server-till-server)
      if (!origin) return callback(null, true);
      if (isAllowed(origin)) return callback(null, true);
      callback(new Error(`CORS blockerad: ${origin}`));
    },
    credentials: true,
  }),
);

// Webhook måste ligga före express.json
app.post(
  "/payment/webhook",
  express.raw({ type: "application/json" }),
  require("./controllers/paymentController").webhook,
);

app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));

app.use("/user", require("./routes/authRoutes"));
app.use("/company", require("./routes/companyRoutes"));
app.use("/workshop", require("./routes/workshopRoutes"));
app.use("/activity", require("./routes/activityRoutes"));
app.use("/staff", require("./routes/staffRoutes"));
app.use("/booking", require("./routes/bookingRoutes"));
app.use("/upload", require("./routes/uploadRoutes"));
app.use("/stats", require("./routes/statsRoutes"));
app.use("/payment", require("./routes/paymentRoutes"));
app.use("/cors", require("./routes/corsRoutes")); // ← ny

const connectDB = async (retries = 5) => {
  for (let i = 0; i < retries; i++) {
    try {
      await mongoose.connect(process.env.DB_URL);
      console.log("Database connected");
      return;
    } catch (err) {
      console.error(`DB-försök ${i + 1} misslyckades:`, err.message);
      if (i < retries - 1) await new Promise((r) => setTimeout(r, 3000));
    }
  }
  console.error("Kunde inte ansluta till databasen, stänger av.");
  process.exit(1);
};

connectDB().then(async () => {
  await loadOrigins(); // ← ladda whitelist innan servern startar
  app.listen(6969, () => {
    console.log("Server is running on port 6969");
  });
});
