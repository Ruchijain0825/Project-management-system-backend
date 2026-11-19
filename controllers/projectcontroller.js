
const mongoose = require("mongoose");

const Project = require("../models/Project");
const User = require("../models/User");
const Ticket = require("../models/Ticket");
const Comment = require("../models/Comment");
const TeamMember = require("../models/TeamMember");

// Helpers
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const getCurrentUserId = (req) => req.user?.id || req.user?._id;

const allowedRoles = ["admin", "manager", "developer", "viewer"];

const findOwnedProject = async (projectId, userId) => {
  return Project.findOne({
    _id: projectId,
    owner: userId
  });
};

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// 1. CREATE PROJECT
const createProject = async (req, res) => {
  try {
    const { title, description, status, visibility } = req.body;
    const userId = getCurrentUserId(req);

    if (
      !title ||
      typeof title !== "string" ||
      title.trim().length < 3 ||
      title.trim().length > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Project title must contain 3 to 100 characters"
      });
    }

    if (
      description !== undefined &&
      (typeof description !== "string" || description.length > 1000)
    ) {
      return res.status(400).json({
        success: false,
        message: "Description cannot exceed 1000 characters"
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
      owner: userId,
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

// 2. GET ALL PROJECTS
const getProjects = async (req, res) => {
  try {
    const userId = getCurrentUserId(req);

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, parseInt(req.query.limit, 10) || 10)
    );

    const skip = (page - 1) * limit;

    const filter = {
      $or: [
        { owner: userId },
        { teamMembers: userId }
      ]
    };

    if (req.query.search) {
      const search = String(req.query.search).trim().slice(0, 100);

      filter.title = {
        $regex: escapeRegex(search),
        $options: "i"
      };
    }

    if (req.query.status) {
      if (!["Active", "Completed", "Archived"].includes(req.query.status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid project status filter"
        });
      }

      filter.status = req.query.status;
    }

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
        .populate("teamMembers", "name email role")
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
    const userId = getCurrentUserId(req);

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID"
      });
    }

    const project = await Project.findOne({
      _id: id,
      $or: [
        { owner: userId },
        { teamMembers: userId }
      ]
    })
      .populate("owner", "name email")
      .populate("teamMembers", "name email role");

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
    const { title, description, status, visibility } = req.body;
    const userId = getCurrentUserId(req);

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID"
      });
    }

    const project = await findOwnedProject(id, userId);

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
          message: "Description cannot exceed 1000 characters"
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

// 5. DELETE PROJECT
const deleteProject = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { id } = req.params;
    const userId = getCurrentUserId(req);

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID"
      });
    }

    await session.withTransaction(async () => {
      const project = await Project.findOne({
        _id: id,
        owner: userId
      }).session(session);

      if (!project) {
        const error = new Error("Project not found or unauthorized");
        error.statusCode = 404;
        throw error;
      }

      const tickets = await Ticket.find({
        projectId: project._id
      })
        .select("_id")
        .session(session);

      const ticketIds = tickets.map((ticket) => ticket._id);

      await Comment.deleteMany({
        ticketId: { $in: ticketIds }
      }).session(session);

      await Ticket.deleteMany({
        projectId: project._id
      }).session(session);

      await TeamMember.deleteMany({
        project: project._id
      }).session(session);

      await Project.deleteOne({
        _id: project._id
      }).session(session);
    });

    return res.status(200).json({
      success: true,
      message: "Project and related data deleted successfully"
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
    const { email, role = "developer" } = req.body;
    const userId = getCurrentUserId(req);

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

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid team member role"
      });
    }

    const project = await findOwnedProject(id, userId);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found or unauthorized"
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail
    }).select("_id name email");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No registered user found with this email"
      });
    }

    if (user._id.toString() === userId.toString()) {
      return res.status(400).json({
        success: false,
        message: "Project owner is already a member"
      });
    }

    const existingMember = await TeamMember.findOne({
      project: id,
      user: user._id
    });

    if (existingMember && existingMember.status !== "removed") {
      return res.status(409).json({
        success: false,
        message: "User is already a member"
      });
    }

    let member;

    if (existingMember) {
      existingMember.role = role;
      existingMember.status = "active";
      existingMember.addedBy = userId;

      member = await existingMember.save();
    } else {
      member = await TeamMember.create({
        project: id,
        user: user._id,
        role,
        status: "active",
        addedBy: userId
      });
    }

    await Project.updateOne(
      { _id: id },
      { $addToSet: { teamMembers: user._id } }
    );

    member = await TeamMember.findById(member._id)
      .populate("user", "name email")
      .populate("addedBy", "name email");

    return res.status(201).json({
      success: true,
      message: "Team member added successfully",
      member
    });
  } catch (error) {
    console.error("Add Team Member Error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "User is already a member"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to add team member"
    });
  }
};

// 7. GET TEAM MEMBERS
const getTeamMembers = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = getCurrentUserId(req);

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID"
      });
    }

    const project = await Project.findOne({
      _id: id,
      $or: [
        { owner: userId },
        { teamMembers: userId }
      ]
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found or access denied"
      });
    }

    const members = await TeamMember.find({
      project: id,
      status: "active"
    })
      .populate("user", "name email role")
      .populate("addedBy", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: members.length,
      members
    });
  } catch (error) {
    console.error("Get Team Members Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch team members"
    });
  }
};

// 8. UPDATE TEAM MEMBER ROLE
const updateTeamMemberRole = async (req, res) => {
  try {
    const { id, userId: memberUserId } = req.params;
    const { role } = req.body;
    const currentUserId = getCurrentUserId(req);

    if (!isValidId(id) || !isValidId(memberUserId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID or user ID"
      });
    }

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role"
      });
    }

    const project = await findOwnedProject(id, currentUserId);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found or unauthorized"
      });
    }

    const member = await TeamMember.findOneAndUpdate(
      {
        project: id,
        user: memberUserId,
        status: "active"
      },
      { $set: { role } },
      { new: true, runValidators: true }
    )
      .populate("user", "name email role")
      .populate("addedBy", "name email");

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Active team member not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Team member role updated successfully",
      member
    });
  } catch (error) {
    console.error("Update Team Member Role Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update team member role"
    });
  }
};

// 9. REMOVE TEAM MEMBER
const removeTeamMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId: memberUserId } = req.body;
    const currentUserId = getCurrentUserId(req);

    if (!isValidId(id) || !isValidId(memberUserId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID or user ID"
      });
    }

    const project = await findOwnedProject(id, currentUserId);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found or unauthorized"
      });
    }

    if (memberUserId.toString() === currentUserId.toString()) {
      return res.status(400).json({
        success: false,
        message: "Project owner cannot remove themselves"
      });
    }

    const member = await TeamMember.findOneAndUpdate(
      {
        project: id,
        user: memberUserId,
        status: "active"
      },
      { $set: { status: "removed" } },
      { new: true }
    );

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Active team member not found"
      });
    }

    await Project.updateOne(
      { _id: id },
      { $pull: { teamMembers: memberUserId } }
    );

    return res.status(200).json({
      success: true,
      message: "Team member removed successfully"
    });
  } catch (error) {
    console.error("Remove Team Member Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to remove team member"
    });
  }
};

// EXPORTS
module.exports = {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  addTeamMember,
  getTeamMembers,
  updateTeamMemberRole,
  removeTeamMember
};
