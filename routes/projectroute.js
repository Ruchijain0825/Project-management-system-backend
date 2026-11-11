
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

const {
  createProject,
  getProjects,
  updateProject,
  deleteProject,
  addTeamMember,
  removeTeamMember
} = require("../controllers/projectcontroller.js");

// All project routes require authentication
router.use(authMiddleware);

router.post("/", createProject);

router.get("/", getProjects);

router.put("/:id", updateProject);

router.delete("/:id", deleteProject);

router.post("/:id/members", addTeamMember);

router.delete("/:id/members", removeTeamMember);

module.exports = router;
