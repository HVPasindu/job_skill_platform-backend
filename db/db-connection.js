const mysql = require("mysql2");

let db;

if (
  process.env.DB_HOST &&
  process.env.DB_USER &&
  process.env.DB_NAME
) {
  db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  db.connect((error) => {
    if (error) {
      console.log("Database connection failed:", error.message);
    } else {
      console.log("Database connected successfully");
    }
  });
} else {
  console.log("Database environment variables are missing");
}

module.exports = db;