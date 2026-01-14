const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Absolut sökväg till backend/uploads
const uploadDir = path.join(__dirname, "..", "uploads");

// Skapa mappen om den saknas
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    cb(null, `activity_${Date.now()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const ok = ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype);
  if (!ok) return cb(new Error("Fel filtyp. Tillåtna: jpeg, png, webp"), false);
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("image");

router.post("/activity-image", (req, res) => {
  upload(req, res, (err) => {
    if (err) return res.status(400).json({ ok: false, message: err.message });
    if (!req.file)
      return res.status(400).json({ ok: false, message: "Ingen fil mottogs" });

    return res.json({
      ok: true,
      imageUrl: `/uploads/${req.file.filename}`,
    });
  });
});

module.exports = router;
