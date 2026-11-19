
const mongoose = require("mongoose");
const Project = require("../models/Project");
const Ticket = require("../models/Ticket");

// Helper: Get logged-in user ID
const getUserId = (req) => req.user?.id || req.user?._id;

// Helper: Verify project access
const getAccessibleProject = async (projectId, userId, role) => {
  const isAdmin = String(role || "").toLowerCase() === "admin";

  if (isAdmin) {
    return Project.findById(projectId);
  }

  return Project.findOne({
    _id: projectId,
    $or: [
      { owner: userId },
      { teamMembers: userId }
    ]
  });
};

// Helper: Call Gemini API
const callGemini = async (prompt, maxOutputTokens = 800) => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens
        }
      })
    }
  );

  const result = await response.json();

  if (!response.ok) {
    console.error("Gemini API error:", result);
    throw new Error("Gemini API request failed");
  }

  const answer = result.candidates?.[0]?.content?.parts
    ?.map(part => part.text || "")
    .join("")
    .trim();

  if (!answer) {
    throw new Error("Gemini returned an empty response");
  }

  return answer;
};

// ======================================
// 1. GENERATE TICKET USING AI
// ======================================

const generateTicket = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { projectId, prompt } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID"
      });
    }

    if (
      typeof prompt !== "string" ||
      prompt.trim().length < 3 ||
      prompt.trim().length > 1000
    ) {
      return res.status(400).json({
        success: false,
        message: "Prompt must contain 3 to 1000 characters"
      });
    }

    const project = await getAccessibleProject(
      projectId,
      userId,
      req.user?.role
    );

    if (!project) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this project"
      });
    }

    const aiPrompt = `
You are TaskFlow AI, a professional project management assistant.

Generate a ticket based on the following user requirement.

Project: ${project.title}
Requirement: ${prompt.trim()}

Return ONLY valid JSON in this exact structure:
{
  "title": "Short ticket title",
  "description": "Detailed ticket description",
  "type": "Bug",
  "priority": "Medium"
}

Rules:
- type must be Bug, Feature, or Task.
- priority must be Low, Medium, High, or Critical.
- Do not include markdown or code fences.
- Do not add fields outside the JSON structure.
`;

    const answer = await callGemini(aiPrompt, 600);

    let generatedTicket;

    try {
      const cleaned = answer
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

      generatedTicket = JSON.parse(cleaned);
    } catch (error) {
      return res.status(502).json({
        success: false,
        message: "AI returned an invalid ticket format"
      });
    }

    const validTypes = ["Bug", "Feature", "Task"];
    const validPriorities = ["Low", "Medium", "High", "Critical"];

    if (
      typeof generatedTicket.title !== "string" ||
      typeof generatedTicket.description !== "string" ||
      !validTypes.includes(generatedTicket.type) ||
      !validPriorities.includes(generatedTicket.priority)
    ) {
      return res.status(502).json({
        success: false,
        message: "AI returned invalid ticket fields"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Ticket generated successfully",
      ticket: {
        title: generatedTicket.title,
        description: generatedTicket.description,
        type: generatedTicket.type,
        priority: generatedTicket.priority
      }
    });

  } catch (error) {
    console.error("Generate ticket error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to generate ticket"
    });
  }
};

// ======================================
// 2. CHAT WITH PROJECT TICKET ANALYTICS
// ======================================

const chatWithTicketAnalytics = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { projectId, message } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID"
      });
    }

    if (
      typeof message !== "string" ||
      message.trim().length < 2 ||
      message.trim().length > 1000
    ) {
      return res.status(400).json({
        success: false,
        message: "Message must contain 2 to 1000 characters"
      });
    }

    // Verify project access
    const project = await getAccessibleProject(
      projectId,
      userId,
      req.user?.role
    );

    if (!project) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this project"
      });
    }

    // Fetch exact statistics from MongoDB
    const result = await Ticket.aggregate([
      {
        $match: {
          projectId: project._id
        }
      },
      {
        $facet: {
          total: [
            { $count: "count" }
          ],
          byType: [
            {
              $group: {
                _id: "$type",
                count: { $sum: 1 }
              }
            }
          ],
          byStatus: [
            {
              $group: {
                _id: "$status",
                count: { $sum: 1 }
              }
            }
          ],
          byPriority: [
            {
              $group: {
                _id: "$priority",
                count: { $sum: 1 }
              }
            }
          ],
          unassigned: [
            {
              $match: {
                $or: [
                  { assignee: null },
                  { assignee: { $exists: false } }
                ]
              }
            },
            { $count: "count" }
          ]
        }
      }
    ]);

    const stats = result[0];

    const getCount = (items, key) =>
      items.find(item => item._id === key)?.count || 0;

    const analytics = {
      project: project.title,

      totalTickets: stats.total[0]?.count || 0,

      categories: {
        Bug: getCount(stats.byType, "Bug"),
        Feature: getCount(stats.byType, "Feature"),
        Task: getCount(stats.byType, "Task")
      },

      statuses: {
        "To Do": getCount(stats.byStatus, "To Do"),
        "In Progress": getCount(stats.byStatus, "In Progress"),
        Done: getCount(stats.byStatus, "Done")
      },

      priorities: {
        Low: getCount(stats.byPriority, "Low"),
        Medium: getCount(stats.byPriority, "Medium"),
        High: getCount(stats.byPriority, "High"),
        Critical: getCount(stats.byPriority, "Critical")
      },

      unassignedTickets: stats.unassigned[0]?.count || 0
    };

    analytics.pendingTickets =
      analytics.statuses["To Do"] +
      analytics.statuses["In Progress"];

    const aiPrompt = `
You are TaskFlow AI, a project ticket analytics assistant.

Answer the user's question using ONLY the following database statistics.

PROJECT ANALYTICS:
${JSON.stringify(analytics, null, 2)}

USER QUESTION:
${message.trim()}

RULES:
1. Use only the supplied statistics.
2. Never invent ticket counts.
3. Clearly mention zero when a category has no tickets.
4. Explain comparisons using actual numbers.
5. Keep answers concise, friendly and professional.
6. If unrelated to analytics, politely explain your scope.
7. Never claim to have modified, created or deleted tickets.
8. Use readable plain text.
`;

    const answer = await callGemini(aiPrompt, 500);

    return res.status(200).json({
      success: true,
      answer,
      analytics
    });

  } catch (error) {
    console.error("Ticket analytics chatbot error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to process analytics question"
    });
  }
};

// ======================================
// EXPORT BOTH CONTROLLERS
// ======================================

module.exports = {
  generateTicket,
  chatWithTicketAnalytics
};
