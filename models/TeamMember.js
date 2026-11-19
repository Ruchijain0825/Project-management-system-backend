
const mongoose = require("mongoose");

const teamMemberSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    role: {
      type: String,
      enum: ["admin", "manager", "developer", "viewer"],
      default: "developer"
    },

    status: {
      type: String,
      enum: ["active", "pending", "removed"],
      default: "active"
    },

    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  { timestamps: true }
);

// Same user cannot be added twice to the same project
teamMemberSchema.index(
  { project: 1, user: 1 },
  { unique: true }
);

module.exports = mongoose.model("TeamMember", teamMemberSchema);
