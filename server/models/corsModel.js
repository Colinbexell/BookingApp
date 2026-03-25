const mongoose = require("mongoose");

const corsSchema = new mongoose.Schema({
  origin: { type: String, required: true, unique: true },
  addedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("CorsOrigin", corsSchema);
