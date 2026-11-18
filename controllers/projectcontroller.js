
const mongoose = require("mongoose");
const Project = require("../models/Project");
const User = require("../models/User");
const Ticket = require("../models/Ticket");
const Comment = require("../models/Comment");

// Reusable ObjectId validation
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// Reusable project access check
const findOwnedProject = async (projectId, userId) => {
  return Project.findOne({
    _id: projectId,
    owner: userId
  });
};

// 1. CREATE PROJECT
const createProject = async (req, res) => {
  try {
    const {
      title,
      description,
      status,
      visibility
    } = req.body;

    if (!title || typeof title !== "string" || title.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: "Project title must be at least 3 characters"
      });
    }

    if (title.trim().length > 100) {
      return res.status(400).json({
        success: false,
        message: "Project title cannot exceed 100 characters"
      });
    }

    if (
      description !== undefined &&
      (typeof description !== "string" || description.length > 1000)
    ) {
      return res.status(400).json({
        success: false,
        message: "Description must be text and cannot exceed 1000 characters"
      });
    }

    if (
      status !== undefined &&
      !["Active", "Completed", "Archived"].includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid project status"
      });
    }

    if (
      visibility !== undefined &&
      !["Private", "Team"].includes(visibility)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid project visibility"
      });
    }

    const project = await Project.create({
      title: title.trim(),
      description: description?.trim() || "",
      owner: req.user.id,
      teamMembers: [],
      status: status || "Active",
      visibility: visibility || "Private"
    });

    return res.status(201).json({
      success: true,
      message: "Project created successfully",
      project
    });

  } catch (error) {
    console.error("Create Project Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create project"
    });
  }
};


// 2. GET ALL PROJECTS WITH SEARCH AND PAGINATION
const getProjects = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, parseInt(req.query.limit, 10) || 10)
    );

    const skip = (page - 1) * limit;

    const filter = {
      $or: [
        { owner: req.user.id },
        { teamMembers: req.user.id }
      ]
    };

    // Search by project title
    if (req.query.search) {
      const search = String(req.query.search).trim().slice(0, 100);

      filter.title = {
        $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        $options: "i"
      };
    }

    // Filter by status
    if (req.query.status) {
      if (!["Active", "Completed", "Archived"].includes(req.query.status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid project status filter"
        });
      }

      filter.status = req.query.status;
    }

    // Filter by visibility
    if (req.query.visibility) {
      if (!["Private", "Team"].includes(req.query.visibility)) {
        return res.status(400).json({
          success: false,
          message: "Invalid visibility filter"
        });
      }

      filter.visibility = req.query.visibility;
    }

    const [projects, total] = await Promise.all([
      Project.find(filter)
        .populate("owner", "name email")
        .populate("teamMembers", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      Project.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      count: projects.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      projects
    });

  } catch (error) {
    console.error("Get Projects Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch projects"
    });
  }
};


// 3. GET SINGLE PROJECT
const getProjectById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID"
      });
    }

    const project = await Project.findOne({
      _id: id,
      $or: [
        { owner: req.user.id },
        { teamMembers: req.user.id }
      ]
    })
      .populate("owner", "name email")
      .populate("teamMembers", "name email");

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found or access denied"
      });
    }

    return res.status(200).json({
      success: true,
      project
    });

  } catch (error) {
    console.error("Get Project Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch project"
    });
  }
};


// 4. UPDATE PROJECT
const updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      status,
      visibility
    } = req.body;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID"
      });
    }

    const project = await findOwnedProject(id, req.user.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found or unauthorized"
      });
    }

    if (title !== undefined) {
      if (
        typeof title !== "string" ||
        title.trim().length < 3 ||
        title.trim().length > 100
      ) {
        return res.status(400).json({
          success: false,
          message: "Title must contain 3 to 100 characters"
        });
      }

      project.title = title.trim();
    }

    if (description !== undefined) {
      if (
        typeof description !== "string" ||
        description.length > 1000
      ) {
        return res.status(400).json({
          success: false,
          message: "Description must be text and cannot exceed 1000 characters"
        });
      }

      project.description = description.trim();
    }

    if (status !== undefined) {
      if (!["Active", "Completed", "Archived"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid project status"
        });
      }

      project.status = status;
    }

    if (visibility !== undefined) {
      if (!["Private", "Team"].includes(visibility)) {
        return res.status(400).json({
          success: false,
          message: "Invalid project visibility"
        });
      }

      project.visibility = visibility;
    }

    await project.save();

    return res.status(200).json({
      success: true,
      message: "Project updated successfully",
      project
    });

  } catch (error) {
    console.error("Update Project Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update project"
    });
  }
};



const deleteProject = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID"
      });
    }

    await session.withTransaction(async () => {
      // Only project owner can delete
      const project = await Project.findOne({
        _id: id,
        owner: req.user.id
      }).session(session);

      if (!project) {
        const error = new Error(
          "Project not found or unauthorized"
        );
        error.statusCode = 404;
        throw error;
      }

      // Find all tickets belonging to this project
      const tickets = await Ticket.find({
        projectId: project._id
      })
        .select("_id")
        .session(session);

      const ticketIds = tickets.map(ticket => ticket._id);

      // Delete all comments associated with these tickets
      await Comment.deleteMany({
        ticketId: { $in: ticketIds }
      }).session(session);

      // Delete all project tickets
      await Ticket.deleteMany({
        projectId: project._id
      }).session(session);

      // Finally delete project
      await Project.deleteOne({
        _id: project._id
      }).session(session);
    });

    return res.status(200).json({
      success: true,
      message: "Project, tickets and comments deleted successfully"
    });

  } catch (error) {
    console.error("Delete Project Error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Failed to delete project"
    });

  } finally {
    await session.endSession();
  }
};


// 6. ADD TEAM MEMBER
const addTeamMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID"
      });
    }

    if (!email || typeof email !== "string") {
      return res.status(400).json({
        success: false,
        message: "Member email is required"
      });
    }

    const project = await findOwnedProject(id, req.user.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found or unauthorized"
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const member = await User.findOne({
      email: normalizedEmail
    }).select("_id name email");

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    if (member._id.toString() === req.user.id.toString()) {
      return res.status(400).json({
        success: false,
        message: "Project owner is already a member"
      });
    }

    const alreadyExists = project.teamMembers.some(
      (memberId) => memberId.toString() === member._id.toString()
    );

    if (alreadyExists) {
      return res.status(409).json({
        success: false,
        message: "User already exists in this project"
      });
    }

    project.teamMembers.push(member._id);

    await project.save();

    await project.populate("teamMembers", "name email");

    return res.status(200).json({
      success: true,
      message: "Team member added successfully",
      project
    });

  } catch (error) {
    console.error("Add Team Member Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to add team member"
    });
  }
};


// 7. REMOVE TEAM MEMBER
const removeTeamMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!isValidId(id) || !isValidId(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID or user ID"
      });
    }

    const project = await findOwnedProject(id, req.user.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found or unauthorized"
      });
    }

    const exists = project.teamMembers.some(
      (memberId) => memberId.toString() === userId
    );

    if (!exists) {
      return res.status(404).json({
        success: false,
        message: "Team member not found"
      });
    }

    project.teamMembers = project.teamMembers.filter(
      (memberId) => memberId.toString() !== userId
    );

    await project.save();

    await project.populate("teamMembers", "name email");

    return res.status(200).json({
      success: true,
      message: "Team member removed successfully",
      project
    });

  } catch (error) {
    console.error("Remove Team Member Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to remove team member"
    });
  }
};


module.exports = {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  addTeamMember,
  removeTeamMember
};
