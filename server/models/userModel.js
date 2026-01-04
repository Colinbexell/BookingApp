const mongoose = require("mongoose");
const { Schema } = mongoose;

// Användarschema, ändra efter behov. OBS glöm inte ändra i controller också. Samt cookies
const userSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, required: true },
  workshopId: { type: Schema.Types.ObjectId, ref: "Workshop", required: true }, // koppling till workshop
});

const UserModel = mongoose.model("User", userSchema);

module.exports = UserModel;
