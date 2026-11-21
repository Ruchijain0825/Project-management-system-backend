
const mongoose = require("mongoose");

const ticketSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Ticket title is required"],
      trim: true,
      minlength: 3,
      maxlength: 150
    },

    description: {
      type: String,
      trim: true,
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

    // New field: Ticket deadline
    dueDate: {
      type: Date,
      default: null
    },

    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true
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

// Query optimization
ticketSchema.index({ projectId: 1, status: 1 });
ticketSchema.index({ projectId: 1, priority: 1 });
ticketSchema.index({ assignee: 1 });
ticketSchema.index({ reporter: 1 });

module.exports = mongoose.model("Ticket", ticketSchema);
