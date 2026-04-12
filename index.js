const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

//const authRoutes = require("./routes/auth-routes");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//app.use("/api/auth", authRoutes);

app.get("/", (req, res) => {
  res.send("Job Skill Platform API running...");
});

const PORT = process.env.PORT || 50000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});