
const Ticket = require("../models/Ticket");
const Project = require("../models/Project");
const mongoose = require("mongoose");

// Helper: Check project access
const getAccessibleProject = async (projectId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    return null;
  }

  return Project.findOne({
    _id: projectId,
    $or: [
      { owner: userId },
      { teamMembers: userId }
    ]
  });
};


// 1. CREATE TICKET
const createTicket = async (req, res) => {
  try {
    const {
      title,
      description,
      type,
      priority,
      projectId,
      assignee
    } = req.body;

    if (!title || typeof title !== "string" || title.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: "Ticket title must be at least 3 characters"
      });
    }

    const project = await getAccessibleProject(
      projectId,
      req.user.id
    );

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found or access denied"
      });
    }

    // Validate assignee if provided
    if (assignee) {
      const isMember = project.teamMembers.some(
        id => id.toString() === assignee
      );

      if (
        project.owner.toString() !== assignee &&
        !isMember
      ) {
        return res.status(400).json({
          success: false,
          message: "Assignee must belong to this project"
        });
      }
    }

    const ticket = await Ticket.create({
      title: title.trim(),
      description,
      type,
      priority,
      projectId,
      reporter: req.user.id,
      assignee: assignee || null
    });

    return res.status(201).json({
      success: true,
      message: "Ticket created successfully",
      ticket
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// 2. GET TICKETS BY PROJECT
const getTickets = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await getAccessibleProject(
      projectId,
      req.user.id
    );

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found or access denied"
      });
    }

    const tickets = await Ticket.find({ projectId })
      .populate("reporter", "name email")
      .populate("assignee", "name email")
      .populate("projectId", "title")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: tickets.length,
      tickets
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// 3. UPDATE TICKET
const updateTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { title, description, priority, status, type } = req.body;

    if (!mongoose.Types.ObjectId.isValid(ticketId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket ID"
      });
    }

    const ticket = await Ticket.findById(ticketId);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found"
      });
    }

    const project = await getAccessibleProject(
      ticket.projectId,
      req.user.id
    );

    if (!project) {
      return res.status(403).json({
        success: false,
        message: "You cannot access this ticket"
      });
    }

    if (title !== undefined) {
      if (typeof title !== "string" || title.trim().length < 3) {
        return res.status(400).json({
          success: false,
          message: "Title must be at least 3 characters"
        });
      }

      ticket.title = title.trim();
    }

    if (description !== undefined) {
      if (typeof description !== "string") {
        return res.status(400).json({
          success: false,
          message: "Invalid description"
        });
      }

      ticket.description = description;
    }

    if (priority !== undefined) ticket.priority = priority;
    if (status !== undefined) ticket.status = status;
    if (type !== undefined) ticket.type = type;

    await ticket.save();

    return res.status(200).json({
      success: true,
      message: "Ticket updated successfully",
      ticket
    });

  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// 4. DELETE TICKET
const deleteTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(ticketId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket ID"
      });
    }

    const ticket = await Ticket.findById(ticketId);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found"
      });
    }

    const project = await getAccessibleProject(
      ticket.projectId,
      req.user.id
    );

    if (!project) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    const isOwner =
      project.owner.toString() === req.user.id;

    const isReporter =
      ticket.reporter.toString() === req.user.id;

    if (!isOwner && !isReporter) {
      return res.status(403).json({
        success: false,
        message: "Only project owner or ticket reporter can delete"
      });
    }

    await ticket.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Ticket deleted successfully"
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// 5. ASSIGN TICKET
const assignTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { assignee } = req.body;

    if (!mongoose.Types.ObjectId.isValid(ticketId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket ID"
      });
    }

    const ticket = await Ticket.findById(ticketId);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found"
      });
    }

    const project = await getAccessibleProject(
      ticket.projectId,
      req.user.id
    );

    if (!project) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    // null means unassign the ticket
    if (assignee === null) {
      ticket.assignee = null;
    } else {
      if (!mongoose.Types.ObjectId.isValid(assignee)) {
        return res.status(400).json({
          success: false,
          message: "Invalid assignee ID"
        });
      }

      const isMember = project.teamMembers.some(
        id => id.toString() === assignee
      );

      const isOwner =
        project.owner.toString() === assignee;

      if (!isMember && !isOwner) {
        return res.status(400).json({
          success: false,
          message: "Assignee must be a project member"
        });
      }

      ticket.assignee = assignee;
    }

    await ticket.save();

    return res.status(200).json({
      success: true,
      message: "Ticket assignment updated",
      ticket
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


module.exports = {
  createTicket,
  getTickets,
  updateTicket,
  deleteTicket,
  assignTicket
};
