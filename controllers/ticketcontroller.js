
const Ticket = require("../models/Ticket");
const Project = require("../models/Project");
const mongoose = require("mongoose");

// Helper: Get current authenticated user ID
const getUserId = (req) => {
  return req.user?.id || req.user?._id;
};

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

// Helper: Check whether user is project owner
const isProjectOwner = (project, userId) => {
  return project.owner.toString() === userId.toString();
};

// Validation constants
const VALID_PRIORITIES = [
  "Low",
  "Medium",
  "High",
  "Critical"
];

const VALID_STATUSES = [
  "To Do",
  "In Progress",
  "Done"
];

const VALID_TYPES = [
  "Bug",
  "Feature",
  "Task"
];


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

    const userId = getUserId(req);

    if (!title || typeof title !== "string" || title.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: "Ticket title must be at least 3 characters"
      });
    }

    if (type && !VALID_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket type"
      });
    }

    if (priority && !VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({
        success: false,
        message: "Invalid priority"
      });
    }

    const project = await getAccessibleProject(
      projectId,
      userId
    );

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found or access denied"
      });
    }

    // Validate assignee
    if (assignee) {
      if (!mongoose.Types.ObjectId.isValid(assignee)) {
        return res.status(400).json({
          success: false,
          message: "Invalid assignee ID"
        });
      }

      const isMember = project.teamMembers.some(
        id => id.toString() === assignee.toString()
      );

      const isOwner =
        project.owner.toString() === assignee.toString();

      if (!isMember && !isOwner) {
        return res.status(400).json({
          success: false,
          message: "Assignee must belong to this project"
        });
      }
    }

    const ticket = await Ticket.create({
      title: title.trim(),
      description: description || "",
      type: type || "Task",
      priority: priority || "Medium",
      projectId,
      reporter: userId,
      assignee: assignee || null
    });

    return res.status(201).json({
      success: true,
      message: "Ticket created successfully",
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
      message: "Failed to create ticket"
    });
  }
};


// 2. GET TICKETS BY PROJECT
const getTickets = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = getUserId(req);

    const project = await getAccessibleProject(
      projectId,
      userId
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
      message: "Failed to fetch tickets"
    });
  }
};


// 3. UPDATE TICKET
const updateTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;

    const {
      title,
      description,
      priority,
      status,
      type,
      assignee
    } = req.body;

    const userId = getUserId(req);

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
      userId
    );

    if (!project) {
      return res.status(403).json({
        success: false,
        message: "You cannot access this ticket"
      });
    }

    // Validate title
    if (title !== undefined) {
      if (
        typeof title !== "string" ||
        title.trim().length < 3
      ) {
        return res.status(400).json({
          success: false,
          message: "Title must be at least 3 characters"
        });
      }

      ticket.title = title.trim();
    }

    // Validate description
    if (description !== undefined) {
      if (typeof description !== "string") {
        return res.status(400).json({
          success: false,
          message: "Invalid description"
        });
      }

      ticket.description = description;
    }

    // Validate priority
    if (priority !== undefined) {
      if (!VALID_PRIORITIES.includes(priority)) {
        return res.status(400).json({
          success: false,
          message: "Invalid priority"
        });
      }

      ticket.priority = priority;
    }

    // Validate status
    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status"
        });
      }

      ticket.status = status;
    }

    // Validate type
    if (type !== undefined) {
      if (!VALID_TYPES.includes(type)) {
        return res.status(400).json({
          success: false,
          message: "Invalid ticket type"
        });
      }

      ticket.type = type;
    }

    // Validate assignee
    if (assignee !== undefined) {
      if (assignee === null || assignee === "") {
        ticket.assignee = null;
      } else {
        if (!mongoose.Types.ObjectId.isValid(assignee)) {
          return res.status(400).json({
            success: false,
            message: "Invalid assignee ID"
          });
        }

        const isMember = project.teamMembers.some(
          member => member.toString() === assignee.toString()
        );

        const isOwner =
          project.owner.toString() === assignee.toString();

        if (!isMember && !isOwner) {
          return res.status(400).json({
            success: false,
            message: "Assignee must belong to this project"
          });
        }

        ticket.assignee = assignee;
      }
    }

    await ticket.save();

    const updatedTicket = await Ticket.findById(ticket._id)
      .populate("reporter", "name email")
      .populate("assignee", "name email")
      .populate("projectId", "title");

    return res.status(200).json({
      success: true,
      message: "Ticket updated successfully",
      ticket: updatedTicket
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
      message: "Failed to update ticket"
    });
  }
};


// 4. DELETE TICKET
const deleteTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const userId = getUserId(req);

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
      userId
    );

    if (!project) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    const isOwner = isProjectOwner(project, userId);

    const isReporter =
      ticket.reporter.toString() === userId.toString();

    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isReporter && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Only project owner, reporter or admin can delete"
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
      message: "Failed to delete ticket"
    });
  }
};


// 5. ASSIGN TICKET
const assignTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { assignee } = req.body;

    const userId = getUserId(req);

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
      userId
    );

    if (!project) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    // null or empty string means unassign
    if (assignee === null || assignee === "") {
      ticket.assignee = null;
    } else {
      if (!mongoose.Types.ObjectId.isValid(assignee)) {
        return res.status(400).json({
          success: false,
          message: "Invalid assignee ID"
        });
      }

      const isMember = project.teamMembers.some(
        member => member.toString() === assignee.toString()
      );

      const isOwner =
        project.owner.toString() === assignee.toString();

      if (!isMember && !isOwner) {
        return res.status(400).json({
          success: false,
          message: "Assignee must be a project member"
        });
      }

      ticket.assignee = assignee;
    }

    await ticket.save();

    const updatedTicket = await Ticket.findById(ticket._id)
      .populate("assignee", "name email");

    return res.status(200).json({
      success: true,
      message: "Ticket assignment updated",
      ticket: updatedTicket
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to assign ticket"
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
