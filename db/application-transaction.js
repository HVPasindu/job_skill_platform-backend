// mysql2's promise pool gives each application write its own transaction connection.
// Never begin a transaction on the shared connection used by the other controllers.
const mysql = require("mysql2/promise");
const db = require("./db-connection");
let pool;
async function withApplicationTransaction(work) {
  if (!pool) {
    if (!db?.config) throw new Error("Database configuration is missing");
    const { host, port, user, password, database, ssl, charset, timezone } =
      db.config;
    pool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      ssl,
      charset,
      timezone,
      dateStrings: true,
      connectionLimit: 4,
    });
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      /* Keep the original failure. */
    }
    throw error;
  } finally {
    connection.release();
  }
}
module.exports = withApplicationTransaction;
