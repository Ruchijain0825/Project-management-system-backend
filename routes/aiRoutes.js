
const express = require("express");
const router = express.Router();

const { generateTicket } = require("../controllers/aicontroller");
const authMiddleware = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

router.post(
  "/generate-ticket",
  authMiddleware,
  authorizeRoles("admin", "manager", "developer"),
  generateTicket
);

module.exports = router;
