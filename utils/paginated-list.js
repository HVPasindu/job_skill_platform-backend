const db = require("../db/db-connection");

// Opt-in paging: callers without page/per_page keep the original full-array response.
// Count and row queries use the same filters and parameter values.
async function sendList(req, res, { sql, countSql, params = [], key }) {
  try {
    const paged =
      req.query.page !== undefined || req.query.per_page !== undefined;
    const page = Number(req.query.page || 1);
    const size = Number(req.query.per_page || 8);
    if (
      paged &&
      ([req.query.page, req.query.per_page].some(
        (value) =>
          value !== undefined &&
          (typeof value !== "string" || !/^\d+$/.test(value)),
      ) ||
        !Number.isInteger(page) ||
        page < 1 ||
        page > 100000 ||
        !Number.isInteger(size) ||
        size < 1 ||
        size > 50)
    )
      return res
        .status(400)
        .json({ success: false, message: "Invalid page or page size" });
    const client = db.promise();
    let pagination;
    if (paged) {
      const [counts] = await client.query(countSql, params);
      const total = Number(counts[0].total);
      pagination = {
        page,
        per_page: size,
        total,
        total_pages: Math.ceil(total / size),
      };
    }
    const [rows] = await client.query(
      sql + (paged ? " LIMIT ? OFFSET ?" : ""),
      paged ? [...params, size, (page - 1) * size] : params,
    );
    return res.json({
      success: true,
      [key]: rows,
      ...(pagination ? { pagination } : {}),
    });
  } catch {
    return res
      .status(500)
      .json({ success: false, message: "Could not load this list" });
  }
}
module.exports = sendList;
