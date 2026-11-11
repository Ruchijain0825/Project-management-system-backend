
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

const {
  createTicket,
  getTickets,
  updateTicket,
  deleteTicket,
  assignTicket
} = require("../controllers/ticketcontroller");

router.use(authMiddleware);

// Create ticket
router.post("/", createTicket);

// Get tickets of a project
router.get("/project/:projectId", getTickets);

// Update ticket
router.put("/:ticketId", updateTicket);

// Delete ticket
router.delete("/:ticketId", deleteTicket);

// Assign ticket
router.patch("/:ticketId/assign", assignTicket);

module.exports = router;
