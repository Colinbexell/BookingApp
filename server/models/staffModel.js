const mongoose = require("mongoose");
const { Schema } = mongoose;

const staffSchema = new Schema(
  {
    name: { type: String, required: true },
    workshopId: {
      type: Schema.Types.ObjectId,
      ref: "Workshop",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Staff", staffSchema);