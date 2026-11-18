
const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
  {
    // Project title
    title: {
      type: String,
      required: [true, "Project title is required"],
      trim: true,
      minlength: [3, "Project title must be at least 3 characters"],
      maxlength: [100, "Project title cannot exceed 100 characters"]
    },

    // Project description
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
      default: ""
    },

    // Project owner
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    // Project team members
    teamMembers: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User"
        }
      ],
      default: []
    },

    // Project status
    status: {
      type: String,
      enum: ["Active", "Completed", "Archived"],
      default: "Active"
    },

    // Project visibility
    visibility: {
      type: String,
      enum: ["Private", "Team"],
      default: "Private"
    }
  },
  {
    timestamps: true
  }
);

// Prevent duplicate team members
projectSchema.path("teamMembers").validate(function (members) {
  const memberIds = members.map((id) => id.toString());

  return memberIds.length === new Set(memberIds).size;
}, "Duplicate team members are not allowed");

// Export model
module.exports = mongoose.model("Project", projectSchema);
