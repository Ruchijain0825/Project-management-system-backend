
const mongoose = require("mongoose");

const ticketSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 150
    },

    description: {
      type: String,
      default: "",
      maxlength: 3000
    },

    type: {
      type: String,
      enum: ["Bug", "Feature", "Task"],
      default: "Bug"
    },

    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Critical"],
      default: "Medium"
    },

    status: {
      type: String,
      enum: ["To Do", "In Progress", "Done"],
      default: "To Do"
    },

    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true
    },

    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    assignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    }
  },
  {
    timestamps: true
  }
);

ticketSchema.index({ projectId: 1, status: 1 });
ticketSchema.index({ assignee: 1 });

module.exports = mongoose.model("Ticket", ticketSchema);
