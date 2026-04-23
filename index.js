const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/auth-routes");
const jobSeekerRoutes = require("./routes/job-seeker-routes");
const companyRoutes = require("./routes/company-routes");
const jobCategoryRoutes = require("./routes/job-category-routes");
const jobRoutes = require("./routes/job-routes");
const jobSkillRoutes = require("./routes/job-skill-routes");
const jobApplicationRoutes = require("./routes/job-application-routes");
const trainerRoutes = require("./routes/trainer-routes");
const courseCategoryRoutes = require("./routes/course-category-routes");
const courseRoutes = require("./routes/course-routes");
const courseMaterialRoutes = require("./routes/course-material-routes");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/job-seeker", jobSeekerRoutes);
app.use("/api/company", companyRoutes);
app.use("/api/job-categories", jobCategoryRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/jobs", jobSkillRoutes);
app.use("/api", jobApplicationRoutes);
app.use("/api/trainer", trainerRoutes);
app.use("/api/course-categories", courseCategoryRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/courses", courseMaterialRoutes);


app.get("/", (req, res) => {
  res.send("Job Skill Platform API running...");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});