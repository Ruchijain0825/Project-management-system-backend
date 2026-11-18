
const mongoose = require("mongoose");

const Ticket = require("../models/Ticket");
const Project = require("../models/Project");
const Comment = require("../models/Comment");

// --------------------------------------------------
// CONSTANTS
// --------------------------------------------------

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

const CREATE_ROLES = ["admin", "manager", "developer"];
const UPDATE_ROLES = ["admin", "manager", "developer"];
const ASSIGN_ROLES = ["admin", "manager"];

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

const getUserId = (req) => {
  return req.user?.id || req.user?._id;
};

const getUserRole = (req) => {
  return String(req.user?.role || "").toLowerCase();
};

const hasRole = (req, roles) => {
  return roles.includes(getUserRole(req));
};

const isValidId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

const getAccessibleProject = async (projectId, userId, role) => {
  if (!isValidId(projectId)) {
    return null;
  }

  const project = await Project.findById(projectId);

  if (!project) {
    return null;
  }

  const isOwner =
    project.owner.toString() === userId.toString();

  const isMember = project.teamMembers.some(
    member => member.toString() === userId.toString()
  );

  // Admin can access any existing project
  if (role === "admin" || isOwner || isMember) {
    return project;
  }

  return null;
};

const isProjectOwner = (project, userId) => {
  return project.owner.toString() === userId.toString();
};

const isAssigneeAllowed = (project, assigneeId) => {
  const isOwner =
    project.owner.toString() === assigneeId.toString();

  const isMember = project.teamMembers.some(
    member => member.toString() === assigneeId.toString()
  );

  return isOwner || isMember;
};

const escapeRegex = (value) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// --------------------------------------------------
// 1. CREATE TICKET
// POST /api/tickets
// --------------------------------------------------

const createTicket = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    if (!hasRole(req, CREATE_ROLES)) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to create tickets"
      });
    }

    const {
      title,
      description,
      type,
      priority,
      projectId,
      assignee
    } = req.body;

    // Validate title
    if (
      typeof title !== "string" ||
      title.trim().length < 3 ||
      title.trim().length > 150
    ) {
      return res.status(400).json({
        success: false,
        message: "Title must contain 3 to 150 characters"
      });
    }

    // Validate description
    if (
      description !== undefined &&
      (typeof description !== "string" ||
       description.length > 3000)
    ) {
      return res.status(400).json({
        success: false,
        message: "Description cannot exceed 3000 characters"
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
      userId,
      getUserRole(req)
    );

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found or access denied"
      });
    }

    // Validate assignee
    if (assignee) {
      if (!isValidId(assignee)) {
        return res.status(400).json({
          success: false,
          message: "Invalid assignee ID"
        });
      }

      if (!isAssigneeAllowed(project, assignee)) {
        return res.status(400).json({
          success: false,
          message: "Assignee must belong to this project"
        });
      }
    }

    const ticket = await Ticket.create({
      title: title.trim(),
      description: description || "",
      type: type || "Bug",
      priority: priority || "Medium",
      projectId: project._id,
      reporter: userId,
      assignee: assignee || null
    });

    const populatedTicket = await Ticket.findById(ticket._id)
      .populate("reporter", "name email")
      .populate("assignee", "name email")
      .populate("projectId", "title");

    return res.status(201).json({
      success: true,
      message: "Ticket created successfully",
      ticket: populatedTicket
    });

  } catch (error) {
    console.error("Create ticket error:", error);

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

// --------------------------------------------------
// 2. GET TICKETS BY PROJECT
// GET /api/tickets/project/:projectId
// --------------------------------------------------

const getTickets = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = getUserId(req);

    const project = await getAccessibleProject(
      projectId,
      userId,
      getUserRole(req)
    );

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found or access denied"
      });
    }

    // Pagination
    const page = Math.max(
      1,
      parseInt(req.query.page, 10) || 1
    );

    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit, 10) || 10)
    );

    const skip = (page - 1) * limit;

    const filter = {
      projectId: project._id
    };

    const {
      status,
      priority,
      type,
      assignee,
      search
    } = req.query;

    // Status filter
    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status filter"
        });
      }

      filter.status = status;
    }

    // Priority filter
    if (priority) {
      if (!VALID_PRIORITIES.includes(priority)) {
        return res.status(400).json({
          success: false,
          message: "Invalid priority filter"
        });
      }

      filter.priority = priority;
    }

    // Type filter
    if (type) {
      if (!VALID_TYPES.includes(type)) {
        return res.status(400).json({
          success: false,
          message: "Invalid type filter"
        });
      }

      filter.type = type;
    }

    // Assignee filter
    if (assignee) {
      if (assignee === "unassigned") {
        filter.assignee = null;
      } else {
        if (!isValidId(assignee)) {
          return res.status(400).json({
            success: false,
            message: "Invalid assignee ID"
          });
        }

        filter.assignee = assignee;
      }
    }

    // Search by title or description
    if (search && search.trim()) {
      const safeSearch = escapeRegex(search.trim());

      filter.$or = [
        {
          title: {
            $regex: safeSearch,
            $options: "i"
          }
        },
        {
          description: {
            $regex: safeSearch,
            $options: "i"
          }
        }
      ];
    }

    const [tickets, total] = await Promise.all([
      Ticket.find(filter)
        .populate("reporter", "name email")
        .populate("assignee", "name email")
        .populate("projectId", "title")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      Ticket.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      count: tickets.length,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      tickets
    });

  } catch (error) {
    console.error("Get tickets error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch tickets"
    });
  }
};

// --------------------------------------------------
// 3. UPDATE TICKET
// PUT /api/tickets/:ticketId
// --------------------------------------------------

const updateTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const userId = getUserId(req);

    if (!isValidId(ticketId)) {
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
      userId,
      getUserRole(req)
    );

    if (!project) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    if (!hasRole(req, UPDATE_ROLES)) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to update tickets"
      });
    }

    const {
      title,
      description,
      priority,
      status,
      type,
      assignee
    } = req.body;

    // Validate and update title
    if (title !== undefined) {
      if (
        typeof title !== "string" ||
        title.trim().length < 3 ||
        title.trim().length > 150
      ) {
        return res.status(400).json({
          success: false,
          message: "Title must contain 3 to 150 characters"
        });
      }

      ticket.title = title.trim();
    }

    // Validate and update description
    if (description !== undefined) {
      if (
        typeof description !== "string" ||
        description.length > 3000
      ) {
        return res.status(400).json({
          success: false,
          message: "Description cannot exceed 3000 characters"
        });
      }

      ticket.description = description;
    }

    // Update priority
    if (priority !== undefined) {
      if (!VALID_PRIORITIES.includes(priority)) {
        return res.status(400).json({
          success: false,
          message: "Invalid priority"
        });
      }

      ticket.priority = priority;
    }

    // Update status
    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status"
        });
      }

      ticket.status = status;
    }

    // Update type
    if (type !== undefined) {
      if (!VALID_TYPES.includes(type)) {
        return res.status(400).json({
          success: false,
          message: "Invalid ticket type"
        });
      }

      ticket.type = type;
    }

    // Only managers/admins/project owners can assign
    if (assignee !== undefined) {
      const canAssign =
        hasRole(req, ASSIGN_ROLES) ||
        isProjectOwner(project, userId);

      if (!canAssign) {
        return res.status(403).json({
          success: false,
          message: "You cannot change ticket assignment"
        });
      }

      if (assignee === null || assignee === "") {
        ticket.assignee = null;
      } else {
        if (!isValidId(assignee)) {
          return res.status(400).json({
            success: false,
            message: "Invalid assignee ID"
          });
        }

        if (!isAssigneeAllowed(project, assignee)) {
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
    console.error("Update ticket error:", error);

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

// --------------------------------------------------
// 4. DELETE TICKET + ASSOCIATED COMMENTS
// DELETE /api/tickets/:ticketId
// --------------------------------------------------

const deleteTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const userId = getUserId(req);

    if (!isValidId(ticketId)) {
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

    const role = getUserRole(req);

    const project = await getAccessibleProject(
      ticket.projectId,
      userId,
      role
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

    const isAdminOrManager =
      ["admin", "manager"].includes(role);

    const canDelete =
      isAdminOrManager ||
      isOwner ||
      (role === "developer" && isReporter);

    if (!canDelete) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to delete this ticket"
      });
    }

    // Remove associated comments first
    await Comment.deleteMany({
      ticketId: ticket._id
    });

    // Delete ticket
    await ticket.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Ticket and associated comments deleted successfully"
    });

  } catch (error) {
    console.error("Delete ticket error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete ticket"
    });
  }
};

// --------------------------------------------------
// 5. ASSIGN / UNASSIGN TICKET
// PATCH /api/tickets/:ticketId/assign
// --------------------------------------------------

const assignTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { assignee } = req.body;
    const userId = getUserId(req);

    if (!isValidId(ticketId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket ID"
      });
    }

    if (!hasRole(req, ASSIGN_ROLES)) {
      return res.status(403).json({
        success: false,
        message: "Only admin and manager can assign tickets"
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
      userId,
      getUserRole(req)
    );

    if (!project) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    if (assignee === null || assignee === "") {
      ticket.assignee = null;
    } else {
      if (!assignee || !isValidId(assignee)) {
        return res.status(400).json({
          success: false,
          message: "Valid assignee ID is required"
        });
      }

      if (!isAssigneeAllowed(project, assignee)) {
        return res.status(400).json({
          success: false,
          message: "Assignee must belong to this project"
        });
      }

      ticket.assignee = assignee;
    }

    await ticket.save();

    const updatedTicket = await Ticket.findById(ticket._id)
      .populate("reporter", "name email")
      .populate("assignee", "name email")
      .populate("projectId", "title");

    return res.status(200).json({
      success: true,
      message: "Ticket assignment updated successfully",
      ticket: updatedTicket
    });

  } catch (error) {
    console.error("Assign ticket error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to assign ticket"
    });
  }
};

// --------------------------------------------------
// EXPORTS
// --------------------------------------------------

module.exports = {
  createTicket,
  getTickets,
  updateTicket,
  deleteTicket,
  assignTicket
};
