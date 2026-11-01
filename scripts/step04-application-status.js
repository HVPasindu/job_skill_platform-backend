// Run from backend root: node scripts/step04-application-status.js --check
// Then: node scripts/step04-application-status.js --apply
// This appends 'withdrawn' only if missing. It never replaces the existing enum list.
require("dotenv").config();
const mysql = require("mysql2/promise");
const db = require("../db/db-connection");
async function run() {
  const apply = process.argv.includes("--apply");
  if (!db?.config) throw new Error("Database configuration is missing");
  const { host, port, user, password, database, ssl, charset, timezone } =
    db.config;
  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    ssl,
    charset,
    timezone,
  });
  try {
    for (const [table, field] of [
      ["job_applications", "application_status"],
      ["application_status_history", "old_status"],
      ["application_status_history", "new_status"],
    ]) {
      const [rows] = await connection.query(
        "SHOW FULL COLUMNS FROM ?? WHERE Field = ?",
        [table, field],
      );
      if (!rows.length) throw new Error(`Missing ${table}.${field}`);
      const column = rows[0];
      if (!column.Type.toLowerCase().startsWith("enum(")) {
        if (/^(var)?char\(/i.test(column.Type) || /text$/i.test(column.Type)) {
          console.log(`${table}.${field}: text column, no enum update needed`);
          continue;
        }
        throw new Error(
          `Unsupported type for ${table}.${field}; review manually`,
        );
      }
      if (column.Type.includes("'withdrawn'")) {
        console.log(`${table}.${field}: already supports withdrawn`);
        continue;
      }
      if (column.Extra)
        throw new Error(
          `Unexpected column options on ${table}.${field}; review manually`,
        );
      const type = column.Type.slice(0, -1) + ",'withdrawn')";
      const nullable = column.Null === "YES" ? "NULL" : "NOT NULL";
      const defaultValue =
        column.Default === null
          ? column.Null === "YES"
            ? " DEFAULT NULL"
            : ""
          : ` DEFAULT ${connection.escape(column.Default)}`;
      const collation = column.Collation
        ? ` COLLATE ${connection.escapeId(column.Collation)}`
        : "";
      const comment = column.Comment
        ? ` COMMENT ${connection.escape(column.Comment)}`
        : "";
      console.log(`${table}.${field}: ${apply ? "adding" : "needs"} withdrawn`);
      if (apply)
        await connection.query(
          `ALTER TABLE ${connection.escapeId(table)} MODIFY COLUMN ${connection.escapeId(field)} ${type}${collation} ${nullable}${defaultValue}${comment}`,
        );
    }
    console.log(
      apply
        ? "Step 04 status check/update complete"
        : "Check complete. Use --apply to perform needed enum changes.",
    );
  } finally {
    await connection.end();
  }
}
run()
  .catch((error) => {
    console.error("Step 04 status migration failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => {
    if (db) db.end();
  });
