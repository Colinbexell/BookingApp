const express = require("express");
const router = express.Router();
const multer = require("multer");
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const ok = ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype);
    if (!ok) return cb(new Error("Fel filtyp. Tillåtna: jpeg, png, webp"), false);
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("image");

router.post("/activity-image", (req, res) => {
  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ ok: false, message: err.message });
    if (!req.file)
      return res.status(400).json({ ok: false, message: "Ingen fil mottogs" });

    try {
      const base64 = req.file.buffer.toString("base64");
      const dataUri = `data:${req.file.mimetype};base64,${base64}`;

      const result = await cloudinary.uploader.upload(dataUri, {
        folder: `activities/${req.body.workshopId || "unknown"}`,
        resource_type: "image",
        transformation: [{ quality: "auto", fetch_format: "auto" }],
      });

      return res.json({ ok: true, imageUrl: result.secure_url });
    } catch (e) {
      console.error("Cloudinary-fel:", e.message);
      return res.status(500).json({ ok: false, message: "Uppladdning till Cloudinary misslyckades: " + e.message });
    }
  });
});

module.exports = router;