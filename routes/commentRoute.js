
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

const {
  addComment,
  getComments,
  deleteComment
} = require("../controllers/commentcontroller.js");

router.use(authMiddleware);

router.post("/:ticketId", addComment);

router.get("/:ticketId", getComments);

router.delete("/:commentId", deleteComment);

module.exports = router;
