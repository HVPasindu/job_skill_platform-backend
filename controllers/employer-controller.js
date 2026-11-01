const db = require("../db/db-connection");
const sendList = require("../utils/paginated-list");

// Always read current membership from MySQL; cached login company roles are not permissions.
async function companyAccess(userId, companyId) {
  const [rows] = await db
    .promise()
    .query(
      "SELECT company_role FROM company_users WHERE user_id = ? AND company_id = ? LIMIT 1",
      [userId, companyId],
    );
  return rows[0];
}
const getDashboard = async (req, res) => {
  try {
    const client = db.promise(),
      id = req.user.id;
    const [companyRows] = await client.query(
      "SELECT COUNT(*) AS total, COALESCE(SUM(company_role='owner'),0) AS owned FROM company_users WHERE user_id = ?",
      [id],
    );
    const [jobRows] = await client.query(
      `SELECT COUNT(*) AS total,
      COALESCE(SUM(j.status='open' AND (j.application_deadline IS NULL OR DATE(j.application_deadline)>=CURRENT_DATE())),0) AS live
      FROM jobs j JOIN company_users cu ON cu.company_id=j.company_id WHERE cu.user_id = ?`,
      [id],
    );
    const [applicationRows] = await client.query(
      `SELECT COUNT(*) AS total, COALESCE(SUM(ja.application_status='pending'),0) AS pending
      FROM job_applications ja JOIN jobs j ON ja.job_id=j.id JOIN company_users cu ON cu.company_id=j.company_id WHERE cu.user_id = ?`,
      [id],
    );
    const [recent] = await client.query(
      `SELECT j.id,j.company_id,j.title,j.status,c.company_name FROM jobs j
      JOIN companies c ON j.company_id=c.id JOIN company_users cu ON cu.company_id=c.id
      WHERE cu.user_id = ? ORDER BY j.id DESC LIMIT 4`,
      [id],
    );
    return res.json({
      success: true,
      companies: companyRows[0],
      jobs: jobRows[0],
      applications: applicationRows[0],
      recent_jobs: recent,
    });
  } catch {
    return res
      .status(500)
      .json({
        success: false,
        message: "Could not load your employer overview",
      });
  }
};
const getCompanyJobs = async (req, res) => {
  try {
    if (!(await companyAccess(req.user.id, req.params.id)))
      return res
        .status(403)
        .json({
          success: false,
          message: "You are not a member of this company",
        });
    const params = [req.params.id];
    let where = " WHERE j.company_id = ? ";
    const { status, search } = req.query;
    if (status) {
      if (!["draft", "open", "closed"].includes(status))
        return res
          .status(400)
          .json({ success: false, message: "Invalid job status" });
      where += " AND j.status = ? ";
      params.push(status);
    }
    if (search) {
      if (typeof search !== "string" || search.length > 150)
        return res
          .status(400)
          .json({ success: false, message: "Invalid job search" });
      where += " AND j.title LIKE ? ";
      params.push(`%${search.trim()}%`);
    }
    const from =
      " FROM jobs j LEFT JOIN job_categories jc ON j.job_category_id=jc.id ";
    return sendList(req, res, {
      sql:
        "SELECT j.*, DATE_FORMAT(j.application_deadline, '%Y-%m-%d') AS application_deadline, jc.category_name" +
        from +
        where +
        " ORDER BY j.id DESC",
      countSql: "SELECT COUNT(*) AS total" + from + where,
      params,
      key: "jobs",
    });
  } catch {
    return res
      .status(500)
      .json({ success: false, message: "Could not load company jobs" });
  }
};
const getCompanyJob = async (req, res) => {
  try {
    if (!(await companyAccess(req.user.id, req.params.id)))
      return res
        .status(403)
        .json({
          success: false,
          message: "You are not a member of this company",
        });
    const [rows] = await db
      .promise()
      .query(
        "SELECT j.*, DATE_FORMAT(j.application_deadline, '%Y-%m-%d') AS application_deadline FROM jobs j WHERE j.id = ? AND j.company_id = ? LIMIT 1",
        [req.params.jobId, req.params.id],
      );
    if (!rows.length)
      return res
        .status(404)
        .json({ success: false, message: "Job not found in this company" });
    return res.json({ success: true, job: rows[0] });
  } catch {
    return res
      .status(500)
      .json({ success: false, message: "Could not load this job" });
  }
};
// Existing installations can use 'onsite' or 'on_site'. Offer the database's actual enum values.
const getJobOptions = async (_req, res) => {
  try {
    const [columns] = await db
      .promise()
      .query(
        "SHOW COLUMNS FROM jobs WHERE Field IN ('work_mode','job_type','status')",
      );
    const options = {
      work_modes: ["onsite", "remote", "hybrid"],
      job_types: ["full_time", "part_time", "contract", "internship"],
      statuses: ["draft", "open", "closed"],
    };
    const keys = {
      work_mode: "work_modes",
      job_type: "job_types",
      status: "statuses",
    };
    for (const column of columns) {
      if (column.Type.startsWith("enum("))
        options[keys[column.Field]] = [
          ...column.Type.matchAll(/'([^']+)'/g),
        ].map((match) => match[1]);
    }
    return res.json({ success: true, ...options });
  } catch {
    return res
      .status(500)
      .json({ success: false, message: "Could not load job form options" });
  }
};
const getCandidates = (req, res) => {
  const { status, search } = req.query;
  const params = [req.user.id];
  let where = " WHERE cu.user_id = ? ";
  if (status) {
    if (
      ![
        "pending",
        "reviewed",
        "shortlisted",
        "accepted",
        "rejected",
        "withdrawn",
      ].includes(status)
    )
      return res
        .status(400)
        .json({ success: false, message: "Invalid application status" });
    where += " AND ja.application_status = ? ";
    params.push(status);
  }
  if (search) {
    if (typeof search !== "string" || search.length > 150)
      return res
        .status(400)
        .json({ success: false, message: "Invalid candidate search" });
    where +=
      " AND (u.full_name LIKE ? OR j.title LIKE ? OR c.company_name LIKE ?) ";
    params.push(...Array(3).fill(`%${search.trim()}%`));
  }
  const joins = ` FROM job_applications ja JOIN jobs j ON ja.job_id=j.id JOIN companies c ON j.company_id=c.id
    JOIN company_users cu ON cu.company_id=c.id JOIN job_seeker_profiles jsp ON ja.job_seeker_profile_id=jsp.id
    JOIN users u ON jsp.user_id=u.id LEFT JOIN resumes r ON ja.resume_id=r.id `;
  return sendList(req, res, {
    sql:
      `SELECT ja.*,j.title AS job_title,j.company_id,c.company_name,u.full_name,u.email,jsp.phone,jsp.city,jsp.country,
    r.file_name AS resume_file_name,r.file_url AS resume_file_url` +
      joins +
      where +
      " ORDER BY ja.id DESC",
    countSql: "SELECT COUNT(*) AS total" + joins + where,
    params,
    key: "applications",
  });
};
const getJobs = (req, res) => {
  const params = [req.user.id];
  let where = " WHERE cu.user_id = ? ";
  const { status, search } = req.query;
  if (status) {
    if (!["draft", "open", "closed"].includes(status))
      return res
        .status(400)
        .json({ success: false, message: "Invalid job status" });
    where += " AND j.status = ? ";
    params.push(status);
  }
  if (search) {
    if (typeof search !== "string" || search.length > 150)
      return res
        .status(400)
        .json({ success: false, message: "Invalid job search" });
    where += " AND j.title LIKE ? ";
    params.push(`%${search.trim()}%`);
  }
  const joins =
    " FROM jobs j JOIN companies c ON j.company_id=c.id JOIN company_users cu ON cu.company_id=c.id LEFT JOIN job_categories jc ON j.job_category_id=jc.id ";
  return sendList(req, res, {
    sql:
      "SELECT j.*,DATE_FORMAT(j.application_deadline,'%Y-%m-%d') AS application_deadline,c.company_name,jc.category_name" +
      joins +
      where +
      " ORDER BY j.id DESC",
    countSql: "SELECT COUNT(*) AS total" + joins + where,
    params,
    key: "jobs",
  });
};
module.exports = {
  getDashboard,
  getCompanyJobs,
  getCompanyJob,
  getJobOptions,
  getCandidates,
  getJobs,
};
