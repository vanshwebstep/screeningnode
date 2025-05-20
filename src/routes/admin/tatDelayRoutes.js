const express = require("express");
const router = express.Router();
const tatDelayController = require("../../controllers/admin/tatDelayController");

// Authentication routes
router.get("/list", tatDelayController.list);
router.get("/lists", tatDelayController.listWithoutAuth);
router.delete("/delete", tatDelayController.delete);
router.delete("/delete-application", tatDelayController.deleteApplication);

module.exports = router;
