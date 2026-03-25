const CorsOrigin = require("../models/corsModel");

// Intern cache — uppdateras från DB
let allowedOrigins = new Set();

const loadOrigins = async () => {
  const docs = await CorsOrigin.find({});
  allowedOrigins = new Set(docs.map((d) => d.origin));
  console.log("CORS whitelist laddad:", [...allowedOrigins]);
};

const isAllowed = (origin) => allowedOrigins.has(origin);

const getOrigins = async (req, res) => {
  const docs = await CorsOrigin.find({});
  res.json(docs);
};

const addOrigin = async (req, res) => {
  try {
    const { origin } = req.body;
    if (!origin) return res.status(400).json({ message: "origin krävs" });

    await CorsOrigin.create({ origin });
    allowedOrigins.add(origin); // uppdatera cache direkt
    res.json({ message: "Tillagd", origin });
  } catch (err) {
    if (err.code === 11000)
      return res.status(400).json({ message: "Redan i listan" });
    res.status(500).json({ message: "Serverfel", err });
  }
};

const removeOrigin = async (req, res) => {
  try {
    const { origin } = req.body;
    await CorsOrigin.deleteOne({ origin });
    allowedOrigins.delete(origin); // uppdatera cache direkt
    res.json({ message: "Borttagen", origin });
  } catch (err) {
    res.status(500).json({ message: "Serverfel", err });
  }
};

module.exports = {
  loadOrigins,
  isAllowed,
  getOrigins,
  addOrigin,
  removeOrigin,
};
