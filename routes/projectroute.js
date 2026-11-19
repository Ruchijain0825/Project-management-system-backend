
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/authMiddleware");

const {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  addTeamMember,
  getTeamMembers,
  updateTeamMemberRole,
  removeTeamMember
} = require("../controllers/projectcontroller");

router.use(authMiddleware);

// Project routes
router.post("/", createProject);
router.get("/", getProjects);

// Team routes
router.get("/:id/members", getTeamMembers);
router.post("/:id/members", addTeamMember);
router.patch("/:id/members/:userId/role", updateTeamMemberRole);
router.delete("/:id/members", removeTeamMember);

// Single project routes
router.get("/:id", getProjectById);
router.put("/:id", updateProject);
router.delete("/:id", deleteProject);

module.exports = router;
