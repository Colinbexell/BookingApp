const Company = require("../models/companyModel");

const createCompany = async (req, res) => {
  try {
    const { name } = req.body;
    const newCompany = await Company.create({ name });

    res.status(201).json(newCompany);
  } catch (error) {
    res.status(500).json({ error: "Failed to create company" });
  }
};

module.exports = {
  createCompany,
};
