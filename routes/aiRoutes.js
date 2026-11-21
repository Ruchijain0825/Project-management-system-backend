
const express = require("express");
const router = express.Router();

const {
  generateTicket,
  chatWithTicketAnalytics
} = require("../controllers/aicontroller");

const authMiddleware = require("../middlewares/authMiddleware");
const authorizeRoles = require("../middlewares/rolemiddleware");

// Generate ticket using AI
router.post(
  "/generate-ticket",
  authMiddleware,
  authorizeRoles("admin", "manager", "developer"),
  generateTicket
);

// Chat with project ticket analytics
router.post(
  "/chat",
  authMiddleware,
  authorizeRoles("admin", "manager", "developer", "viewer"),
  chatWithTicketAnalytics
);

module.exports = router;
