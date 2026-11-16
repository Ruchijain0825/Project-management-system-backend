
const Project = require("../models/Project");
const mongoose = require("mongoose");

const generateTicket = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { projectId, problem } = req.body;

    // 1. Validate input
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID"
      });
    }

    if (
      typeof problem !== "string" ||
      problem.trim().length < 10 ||
      problem.trim().length > 4000
    ) {
      return res.status(400).json({
        success: false,
        message: "Problem description must be between 10 and 4000 characters"
      });
    }

    // 2. Verify project access
    let project;

    if (req.user.role === "admin") {
      project = await Project.findById(projectId);
    } else {
      project = await Project.findOne({
        _id: projectId,
        $or: [
          { owner: userId },
          { teamMembers: userId }
        ]
      });
    }

    if (!project) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this project"
      });
    }

    // 3. Check API key
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        success: false,
        message: "AI service is not configured"
      });
    }

    // 4. Prepare prompt
    const prompt = `
You are an expert software bug triage assistant.

Convert the user's issue into a structured project management ticket.

User's issue:
${problem.trim()}

Return ONLY valid JSON with this exact structure:
{
  "title": "Short and clear ticket title",
  "description": "Detailed, well-written issue description",
  "type": "Bug",
  "priority": "Medium",
  "suggestedSteps": [
    "First investigation step",
    "Second investigation step"
  ],
  "acceptanceCriteria": [
    "Expected outcome one",
    "Expected outcome two"
  ]
}

Rules:
- type must be one of: Bug, Feature, Task.
- priority must be one of: Low, Medium, High, Critical.
- Do not invent technical facts not provided by the user.
- If details are missing, mention what needs investigation.
- Keep the title concise.
- Do not include Markdown or code fences.
`;

    // 5. Call Gemini API
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
            responseMimeType: "application/json",
            temperature: 0.2
          }
        })
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("Gemini API error:", result);

      return res.status(502).json({
        success: false,
        message: "AI service could not generate a ticket"
      });
    }

    const generatedText =
      result.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("")
        .trim();

    if (!generatedText) {
      return res.status(502).json({
        success: false,
        message: "AI returned an empty response"
      });
    }

    // 6. Parse AI JSON
    let ticket;

    try {
      ticket = JSON.parse(generatedText);
    } catch (parseError) {
      console.error("AI JSON parse error:", parseError);

      return res.status(502).json({
        success: false,
        message: "AI returned an invalid ticket format"
      });
    }

    // 7. Validate generated fields
    const validTypes = ["Bug", "Feature", "Task"];
    const validPriorities = ["Low", "Medium", "High", "Critical"];

    if (
      typeof ticket.title !== "string" ||
      ticket.title.trim().length < 3 ||
      ticket.title.trim().length > 150 ||
      typeof ticket.description !== "string" ||
      !validTypes.includes(ticket.type) ||
      !validPriorities.includes(ticket.priority)
    ) {
      return res.status(502).json({
        success: false,
        message: "AI generated invalid ticket fields"
      });
    }

    return res.status(200).json({
      success: true,
      message: "AI ticket generated successfully",
      ticket: {
        title: ticket.title.trim(),
        description: ticket.description.slice(0, 3000),
        type: ticket.type,
        priority: ticket.priority,
        suggestedSteps: Array.isArray(ticket.suggestedSteps)
          ? ticket.suggestedSteps.slice(0, 5)
          : [],
        acceptanceCriteria: Array.isArray(ticket.acceptanceCriteria)
          ? ticket.acceptanceCriteria.slice(0, 5)
          : []
      }
    });

  } catch (error) {
    console.error("Generate ticket error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

module.exports = { generateTicket };
