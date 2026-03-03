const Staff = require("../models/staffModel");

const createStaff = async (req, res) => {
  try {
    const { name, workshopId } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: "name is required" });
    if (!workshopId) return res.status(400).json({ message: "workshopId is required" });
    const doc = await Staff.create({ name: name.trim(), workshopId });
    return res.status(201).json({ ok: true, staff: doc });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};

const listStaff = async (req, res) => {
  try {
    const { workshopId } = req.query;
    const q = workshopId ? { workshopId } : {};
    const staff = await Staff.find(q).sort({ createdAt: 1 });
    return res.json({ ok: true, staff });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};

const updateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: "name is required" });
    const updated = await Staff.findByIdAndUpdate(
      id,
      { name: name.trim() },
      { new: true }
    );
    if (!updated) return res.status(404).json({ ok: false, message: "Staff not found" });
    return res.json({ ok: true, staff: updated });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};

const deleteStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Staff.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ ok: false, message: "Staff not found" });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};

module.exports = { createStaff, listStaff, updateStaff, deleteStaff };