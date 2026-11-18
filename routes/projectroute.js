
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
  removeTeamMember
} = require("../controllers/projectcontroller");


router.use(authMiddleware);


router.post("/", createProject);


router.get("/", getProjects);


router.get("/:id", getProjectById);


router.put("/:id", updateProject);


router.delete("/:id", deleteProject);


router.post("/:id/members", addTeamMember);


router.delete("/:id/members", removeTeamMember);

module.exports = router;
