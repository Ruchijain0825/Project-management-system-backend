
const express = require("express");
const router = express.Router();

const { generateTicket } = require("../controllers/aicontroller");
const authMiddleware = require("../middlewares/authMiddleware");
const authorizeRoles = require("../middlewares/roleMiddleware");

router.post(
  "/generate-ticket",
  authMiddleware,
  authorizeRoles("admin", "manager", "developer"),
  generateTicket
);

module.exports = router;
