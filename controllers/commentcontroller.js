
const Comment = require("../models/Comment");
const Ticket = require("../models/Ticket");
const Project = require("../models/Project");
const mongoose = require("mongoose");

// Check project membership
const checkTicketAccess = async (ticketId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(ticketId)) {
    return null;
  }

  const ticket = await Ticket.findById(ticketId);

  if (!ticket) return null;

  const project = await Project.findOne({
    _id: ticket.projectId,
    $or: [
      { owner: userId },
      { teamMembers: userId }
    ]
  });

  if (!project) return null;

  return ticket;
};


// ADD COMMENT
const addComment = async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: "Comment cannot be empty"
      });
    }

    if (text.trim().length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Comment is too long"
      });
    }

    const ticket = await checkTicketAccess(
      req.params.ticketId,
      req.user.id
    );

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found or access denied"
      });
    }

    const comment = await Comment.create({
      ticketId: ticket._id,
      userId: req.user.id,
      text: text.trim()
    });

    await comment.populate("userId", "name email");

    return res.status(201).json({
      success: true,
      message: "Comment added successfully",
      comment
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// GET COMMENTS
const getComments = async (req, res) => {
  try {
    const ticket = await checkTicketAccess(
      req.params.ticketId,
      req.user.id
    );

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found or access denied"
      });
    }

    const comments = await Comment.find({
      ticketId: ticket._id
    })
      .populate("userId", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: comments.length,
      comments
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// DELETE OWN COMMENT
const deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findOne({
      _id: req.params.commentId,
      userId: req.user.id
    });

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found or unauthorized"
      });
    }

    const ticket = await checkTicketAccess(
      comment.ticketId,
      req.user.id
    );

    if (!ticket) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    await comment.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Comment deleted successfully"
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


module.exports = {
  addComment,
  getComments,
  deleteComment
};
