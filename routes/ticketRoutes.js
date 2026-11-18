
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/authMiddleware");

const {
  createTicket,
  getTickets,
  updateTicket,
  deleteTicket,
  assignTicket
} = require("../controllers/ticketcontroller");

router.use(authMiddleware);

router.post("/", createTicket);

router.get("/project/:projectId", getTickets);

router.put("/:ticketId", updateTicket);

router.delete("/:ticketId", deleteTicket);

router.patch("/:ticketId/assign", assignTicket);

module.exports = router;
