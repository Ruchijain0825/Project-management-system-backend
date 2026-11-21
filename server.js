const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const authMiddleware = require("./middlewares/authMiddleware.js");
const projectRoutes = require("./routes/projectroute.js");
const ticketRoutes = require("./routes/ticketRoutes.js");
const commentRoutes = require("./routes/commentRoute.js");
const aiRoutes = require("./routes/aiRoutes.js");
dotenv.config();

const app = express();



const allowedOrigins = [
  "http://localhost:5173",
  "https://project-management-system-frontend-iota.vercel.app"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));

app.use(express.json());

app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "TaskFlow API is running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/ai", aiRoutes);

// Protected test route
app.get("/api/auth/me", authMiddleware, (req, res) => {
  res.json({
    success: true,
    user: req.user,
  });
});

const PORT = process.env.PORT || 8080;

const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();
