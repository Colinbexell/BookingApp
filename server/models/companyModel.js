const mongoose = require("mongoose");
const { Schema } = mongoose;

const companySchema = new Schema(
  {
    name: { type: String, required: true },
  },
  { timestamps: true }
);

const CompanyModel = mongoose.model("Company", companySchema);

module.exports = CompanyModel;
