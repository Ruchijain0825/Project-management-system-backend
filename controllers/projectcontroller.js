
const Project = require("../models/Project");
const User = require("../models/User");

// 1. CREATE PROJECT
const createProject = async (req, res) => {
  try {
    const { title, description } = req.body;

    if (!title || title.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: "Project title must be at least 3 characters"
      });
    }

    const project = await Project.create({
      title: title.trim(),
      description,
      owner: req.user.id,
      teamMembers: []
    });

    return res.status(201).json({
      success: true,
      message: "Project created successfully",
      project
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// 2. GET ALL PROJECTS
const getProjects = async (req, res) => {
  try {
    const projects = await Project.find({
      $or: [
        { owner: req.user.id },
        { teamMembers: req.user.id }
      ]
    })
      .populate("owner", "name email")
      .populate("teamMembers", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: projects.length,
      projects
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// 3. UPDATE PROJECT
const updateProject = async (req, res) => {
  try {
    const { title, description } = req.body;

    const project = await Project.findOne({
      _id: req.params.id,
      owner: req.user.id
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found or unauthorized"
      });
    }

    if (title !== undefined) {
      if (typeof title !== "string" || title.trim().length < 3) {
        return res.status(400).json({
          success: false,
          message: "Title must be at least 3 characters"
        });
      }

      project.title = title.trim();
    }

    if (description !== undefined) {
      if (typeof description !== "string") {
        return res.status(400).json({
          success: false,
          message: "Description must be text"
        });
      }

      project.description = description;
    }

    await project.save();

    return res.status(200).json({
      success: true,
      message: "Project updated successfully",
      project
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// 4. DELETE PROJECT
const deleteProject = async (req, res) => {
  try {
    const project = await Project.findOneAndDelete({
      _id: req.params.id,
      owner: req.user.id
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found or unauthorized"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Project deleted successfully"
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// 5. ADD TEAM MEMBER
const addTeamMember = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({
        success: false,
        message: "Member email is required"
      });
    }

    const project = await Project.findOne({
      _id: req.params.id,
      owner: req.user.id
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found or unauthorized"
      });
    }

    const member = await User.findOne({
      email: email.trim().toLowerCase()
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    if (member._id.toString() === req.user.id) {
      return res.status(400).json({
        success: false,
        message: "Owner is already part of the project"
      });
    }

    const alreadyExists = project.teamMembers.some(
      (id) => id.toString() === member._id.toString()
    );

    if (alreadyExists) {
      return res.status(409).json({
        success: false,
        message: "User already exists in this project"
      });
    }

    project.teamMembers.push(member._id);

    await project.save();

    return res.status(200).json({
      success: true,
      message: "Team member added successfully",
      project
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// 6. REMOVE TEAM MEMBER
const removeTeamMember = async (req, res) => {
  try {
    const { userId } = req.body;

    const project = await Project.findOne({
      _id: req.params.id,
      owner: req.user.id
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found or unauthorized"
      });
    }

    const exists = project.teamMembers.some(
      (id) => id.toString() === userId
    );

    if (!exists) {
      return res.status(404).json({
        success: false,
        message: "Team member not found"
      });
    }

    project.teamMembers = project.teamMembers.filter(
      (id) => id.toString() !== userId
    );

    await project.save();

    return res.status(200).json({
      success: true,
      message: "Team member removed successfully",
      project
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


module.exports = {
  createProject,
  getProjects,
  updateProject,
  deleteProject,
  addTeamMember,
  removeTeamMember
};
