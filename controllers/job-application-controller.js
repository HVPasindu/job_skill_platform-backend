const db = require("../db/db-connection");
const withTransaction = require("../db/application-transaction");
const validId = (value) => /^[1-9]\d{0,19}$/.test(String(value || ""));
const fail = (status, message) => {
  const error = new Error(message);
  error.status = status;
  throw error;
};
const respondError = (res, error, fallback) =>
  res
    .status(error.code === "ER_DUP_ENTRY" ? 409 : error.status || 500)
    .json({
      success: false,
      message:
        error.code === "ER_DUP_ENTRY"
          ? "You have already applied for this job"
          : error.status
            ? error.message
            : fallback,
    });
function applicationFields(body) {
  if (
    body.cover_letter !== undefined &&
    body.cover_letter !== null &&
    typeof body.cover_letter !== "string"
  )
    fail(400, "Cover letter must be text");
  if ((body.cover_letter || "").length > 10000)
    fail(400, "Cover letter must be 10000 characters or fewer");
  if (
    body.resume_id !== undefined &&
    body.resume_id !== null &&
    body.resume_id !== "" &&
    !validId(body.resume_id)
  )
    fail(400, "Invalid resume selection");
  return {
    resume_id:
      body.resume_id === "" || body.resume_id === null ? null : body.resume_id,
    cover_letter:
      body.cover_letter === undefined
        ? undefined
        : body.cover_letter?.trim() || null,
  };
}
async function ownProfile(connection, userId) {
  const [rows] = await connection.query(
    "SELECT id FROM job_seeker_profiles WHERE user_id = ? LIMIT 1",
    [userId],
  );
  if (!rows.length) fail(404, "Job seeker profile not found");
  return rows[0];
}
async function checkAttachment(connection, resumeId, profileId) {
  if (!resumeId) return;
  const [rows] = await connection.query(
    "SELECT id FROM resumes WHERE id = ? AND job_seeker_profile_id = ? LIMIT 1",
    [resumeId, profileId],
  );
  if (!rows.length) fail(404, "Resume not found or does not belong to you");
}
async function saveHistory(connection, id, oldStatus, newStatus, userId, note) {
  await connection.query(
    `INSERT INTO application_status_history
        (job_application_id, old_status, new_status, changed_by_user_id, note) VALUES (?, ?, ?, ?, ?)`,
    [id, oldStatus, newStatus, userId, note],
  );
}

// APPLY FOR A JOB
const applyForJob = async (req, res) => {
  try {
    if (!validId(req.params.jobId)) fail(400, "Invalid job ID");
    const values = applicationFields(req.body);
    const id = await withTransaction(async (connection) => {
      const profile = await ownProfile(connection, req.user.id);
      // Lock the job while checking whether applications are still open.
      const [jobs] = await connection.query(
        `SELECT *,
                (application_deadline IS NOT NULL AND DATE(application_deadline) < CURRENT_DATE()) AS deadline_passed
                FROM jobs WHERE id = ? LIMIT 1 FOR UPDATE`,
        [req.params.jobId],
      );
      if (!jobs.length) fail(404, "Job not found");
      if (jobs[0].status !== "open")
        fail(409, "This job is not open for applications");
      if (Number(jobs[0].deadline_passed))
        fail(409, "Application deadline has passed");
      await checkAttachment(connection, values.resume_id, profile.id);
      const [result] = await connection.query(
        `INSERT INTO job_applications
                (job_id, job_seeker_profile_id, resume_id, cover_letter, application_status) VALUES (?, ?, ?, ?, 'pending')`,
        [
          req.params.jobId,
          profile.id,
          values.resume_id || null,
          values.cover_letter || null,
        ],
      );
      await saveHistory(
        connection,
        result.insertId,
        null,
        "pending",
        req.user.id,
        "Application submitted",
      );
      return result.insertId;
    });
    return res
      .status(201)
      .json({
        success: true,
        message: "Applied for job successfully",
        application_id: id,
      });
  } catch (error) {
    return respondError(
      res,
      error,
      "Job application could not be saved. Please refresh your applications before retrying.",
    );
  }
};

const updateMyApplication = async (req, res) => {
  try {
    if (!validId(req.params.id)) fail(400, "Invalid application ID");
    const values = applicationFields(req.body);
    await withTransaction(async (connection) => {
      const profile = await ownProfile(connection, req.user.id);
      const [rows] = await connection.query(
        "SELECT * FROM job_applications WHERE id = ? AND job_seeker_profile_id = ? LIMIT 1 FOR UPDATE",
        [req.params.id, profile.id],
      );
      if (!rows.length) fail(404, "Application not found");
      if (rows[0].application_status !== "pending")
        fail(409, "Only pending applications can be updated");
      const resumeId =
        values.resume_id === undefined ? rows[0].resume_id : values.resume_id;
      await checkAttachment(connection, resumeId, profile.id);
      await connection.query(
        "UPDATE job_applications SET resume_id = ?, cover_letter = ? WHERE id = ? AND job_seeker_profile_id = ?",
        [
          resumeId || null,
          values.cover_letter === undefined
            ? rows[0].cover_letter
            : values.cover_letter,
          req.params.id,
          profile.id,
        ],
      );
    });
    return res.json({
      success: true,
      message: "Application updated successfully",
    });
  } catch (error) {
    return respondError(res, error, "Application update failed");
  }
};

const withdrawMyApplication = async (req, res) => {
  try {
    if (!validId(req.params.id)) fail(400, "Invalid application ID");
    await withTransaction(async (connection) => {
      const profile = await ownProfile(connection, req.user.id);
      const [rows] = await connection.query(
        "SELECT * FROM job_applications WHERE id = ? AND job_seeker_profile_id = ? LIMIT 1 FOR UPDATE",
        [req.params.id, profile.id],
      );
      if (!rows.length) fail(404, "Application not found");
      if (rows[0].application_status !== "pending")
        fail(409, "Only pending applications can be withdrawn");
      await connection.query(
        "UPDATE job_applications SET application_status = 'withdrawn' WHERE id = ? AND job_seeker_profile_id = ?",
        [req.params.id, profile.id],
      );
      await saveHistory(
        connection,
        req.params.id,
        "pending",
        "withdrawn",
        req.user.id,
        "Application withdrawn by candidate",
      );
    });
    return res.json({
      success: true,
      message: "Application withdrawn successfully",
    });
  } catch (error) {
    return respondError(
      res,
      error,
      "Withdrawal failed. Check that the Step 04 status migration has been applied.",
    );
  }
};

const getMyApplications = async (req, res) => {
  try {
    const client = db.promise();
    const profile = await ownProfile(client, req.user.id);
    const { status, job_id } = req.query;
    if (
      status &&
      ![
        "pending",
        "reviewed",
        "shortlisted",
        "rejected",
        "accepted",
        "withdrawn",
      ].includes(status)
    )
      fail(400, "Invalid application status");
    if (job_id && !validId(job_id)) fail(400, "Invalid job ID");
    const paged =
      req.query.page !== undefined || req.query.per_page !== undefined;
    const page = Number(req.query.page || 1),
      size = Number(req.query.per_page || 8);
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      page > 100000 ||
      !Number.isInteger(size) ||
      size < 1 ||
      size > 24
    )
      fail(400, "Invalid page or page size");
    let where = " WHERE ja.job_seeker_profile_id = ? ";
    const params = [profile.id];
    if (status) {
      where += " AND ja.application_status = ? ";
      params.push(status);
    }
    if (job_id) {
      where += " AND ja.job_id = ? ";
      params.push(job_id);
    }
    const joins =
      " FROM job_applications ja JOIN jobs j ON ja.job_id = j.id JOIN companies c ON j.company_id = c.id LEFT JOIN resumes r ON ja.resume_id = r.id ";
    let pagination;
    if (paged) {
      const [count] = await client.query(
        "SELECT COUNT(*) AS total" + joins + where,
        params,
      );
      pagination = {
        page,
        per_page: size,
        total: Number(count[0].total),
        total_pages: Math.ceil(Number(count[0].total) / size),
      };
    }
    const [applications] = await client.query(
      `SELECT ja.*, j.title AS job_title, j.location, j.work_mode, j.job_type,
            c.company_name, c.logo_url, r.file_name AS resume_file_name` +
        joins +
        where +
        " ORDER BY ja.id DESC " +
        (paged ? " LIMIT ? OFFSET ?" : ""),
      paged ? [...params, size, (page - 1) * size] : params,
    );
    return res.json({
      success: true,
      applications,
      ...(pagination ? { pagination } : {}),
    });
  } catch (error) {
    return respondError(res, error, "Fetch applications failed");
  }
};

const getSingleApplication = (req, res) => {
  try {
    const userId = req.user.id;
    const applicationId = req.params.id;

    const getProfileQuery = `
            SELECT * FROM job_seeker_profiles
            WHERE user_id = ?
            LIMIT 1
        `;

    db.query(getProfileQuery, [userId], (profileError, profileResult) => {
      if (profileError) {
        return res.status(500).json({
          success: false,
          message: "Profile fetch failed",
          error: profileError.message,
        });
      }

      if (profileResult.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Job seeker profile not found",
        });
      }

      const profile = profileResult[0];

      const getApplicationQuery = `
                SELECT
                    ja.*,
                    j.title AS job_title,
                    j.description AS job_description,
                    j.location,
                    j.work_mode,
                    j.job_type,
                    c.company_name,
                    c.logo_url,
                    r.file_name AS resume_file_name,
                    r.file_url AS resume_file_url
                FROM job_applications ja
                JOIN jobs j ON ja.job_id = j.id
                JOIN companies c ON j.company_id = c.id
                LEFT JOIN resumes r ON ja.resume_id = r.id
                WHERE ja.id = ? AND ja.job_seeker_profile_id = ?
                LIMIT 1
            `;

      db.query(
        getApplicationQuery,
        [applicationId, profile.id],
        (error, result) => {
          if (error) {
            return res.status(500).json({
              success: false,
              message: "Fetch application failed",
              error: error.message,
            });
          }

          if (result.length === 0) {
            return res.status(404).json({
              success: false,
              message: "Application not found",
            });
          }

          return res.status(200).json({
            success: true,
            application: result[0],
          });
        },
      );
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Get single application failed",
      error: error.message,
    });
  }
};

// GET APPLICATIONS FOR A JOB (EMPLOYER SIDE)
const getApplicationsForJob = (req, res) => {
  try {
    const userId = req.user.id;
    const jobId = req.params.jobId;
    const { status } = req.query;

    const getJobQuery = `
            SELECT * FROM jobs
            WHERE id = ?
            LIMIT 1
        `;

    db.query(getJobQuery, [jobId], (jobError, jobResult) => {
      if (jobError) {
        return res.status(500).json({
          success: false,
          message: "Job fetch failed",
          error: jobError.message,
        });
      }

      if (jobResult.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Job not found",
        });
      }

      const job = jobResult[0];

      const checkAccessQuery = `
                SELECT * FROM company_users
                WHERE company_id = ? AND user_id = ?
                LIMIT 1
            `;

      db.query(
        checkAccessQuery,
        [job.company_id, userId],
        (accessError, accessResult) => {
          if (accessError) {
            return res.status(500).json({
              success: false,
              message: "Company access check failed",
              error: accessError.message,
            });
          }

          if (accessResult.length === 0) {
            return res.status(403).json({
              success: false,
              message: "You are not allowed to view applications for this job",
            });
          }

          let getApplicationsQuery = `
                    SELECT
                        ja.*,
                        u.full_name,
                        u.email,
                        jsp.phone,
                        jsp.city,
                        jsp.country,
                        r.file_name AS resume_file_name,
                        r.file_url AS resume_file_url
                    FROM job_applications ja
                    JOIN job_seeker_profiles jsp ON ja.job_seeker_profile_id = jsp.id
                    JOIN users u ON jsp.user_id = u.id
                    LEFT JOIN resumes r ON ja.resume_id = r.id
                    WHERE ja.job_id = ?
                `;

          const queryParams = [jobId];

          if (status) {
            getApplicationsQuery += ` AND ja.application_status = ? `;
            queryParams.push(status);
          }

          getApplicationsQuery += ` ORDER BY ja.id DESC `;

          db.query(getApplicationsQuery, queryParams, (error, result) => {
            if (error) {
              return res.status(500).json({
                success: false,
                message: "Fetch job applications failed",
                error: error.message,
              });
            }

            return res.status(200).json({
              success: true,
              applications: result,
            });
          });
        },
      );
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Get applications for job failed",
      error: error.message,
    });
  }
};

// UPDATE APPLICATION STATUS
const updateApplicationStatus = async (req, res) => {
  try {
    const { application_status, note } = req.body;
    if (!validId(req.params.id)) fail(400, "Invalid application ID");
    if (
      ![
        "pending",
        "reviewed",
        "shortlisted",
        "rejected",
        "accepted",
        "withdrawn",
      ].includes(application_status)
    )
      fail(400, "Invalid application status");
    if (
      note !== undefined &&
      note !== null &&
      (typeof note !== "string" || note.length > 10000)
    )
      fail(400, "Invalid status note");
    await withTransaction(async (connection) => {
      const [rows] = await connection.query(
        `SELECT ja.*, j.company_id FROM job_applications ja JOIN jobs j ON ja.job_id = j.id WHERE ja.id = ? LIMIT 1 FOR UPDATE`,
        [req.params.id],
      );
      if (!rows.length) fail(404, "Application not found");
      const [access] = await connection.query(
        "SELECT user_id FROM company_users WHERE company_id = ? AND user_id = ? LIMIT 1",
        [rows[0].company_id, req.user.id],
      );
      if (!access.length)
        fail(403, "You are not allowed to update this application status");
      if (rows[0].application_status === application_status) return;
      await connection.query(
        "UPDATE job_applications SET application_status = ? WHERE id = ?",
        [application_status, req.params.id],
      );
      await saveHistory(
        connection,
        req.params.id,
        rows[0].application_status,
        application_status,
        req.user.id,
        note?.trim() || null,
      );
    });
    return res.json({
      success: true,
      message: "Application status updated successfully",
    });
  } catch (error) {
    return respondError(res, error, "Application status update failed");
  }
};

const getApplicationStatusHistory = (req, res) => {
  try {
    const userId = req.user.id;
    const applicationId = req.params.id;

    const getApplicationQuery = `
            SELECT ja.*, j.company_id, jsp.user_id AS applicant_user_id
            FROM job_applications ja
            JOIN jobs j ON ja.job_id = j.id
            JOIN job_seeker_profiles jsp ON ja.job_seeker_profile_id = jsp.id
            WHERE ja.id = ?
            LIMIT 1
        `;

    db.query(
      getApplicationQuery,
      [applicationId],
      (applicationError, applicationResult) => {
        if (applicationError) {
          return res.status(500).json({
            success: false,
            message: "Application fetch failed",
            error: applicationError.message,
          });
        }

        if (applicationResult.length === 0) {
          return res.status(404).json({
            success: false,
            message: "Application not found",
          });
        }

        const application = applicationResult[0];

        const checkCompanyAccessQuery = `
                SELECT * FROM company_users
                WHERE company_id = ? AND user_id = ?
                LIMIT 1
            `;

        db.query(
          checkCompanyAccessQuery,
          [application.company_id, userId],
          (companyAccessError, companyAccessResult) => {
            if (companyAccessError) {
              return res.status(500).json({
                success: false,
                message: "Company access check failed",
                error: companyAccessError.message,
              });
            }

            const isEmployerSide = companyAccessResult.length > 0;
            const isApplicant =
              Number(application.applicant_user_id) === Number(userId);

            if (!isEmployerSide && !isApplicant) {
              return res.status(403).json({
                success: false,
                message: "You are not allowed to view this status history",
              });
            }

            const getHistoryQuery = `
                    SELECT
                        ash.*,
                        u.full_name AS changed_by_name,
                        u.email AS changed_by_email
                    FROM application_status_history ash
                    JOIN users u ON ash.changed_by_user_id = u.id
                    WHERE ash.job_application_id = ?
                    ORDER BY ash.id DESC
                `;

            db.query(getHistoryQuery, [applicationId], (error, result) => {
              if (error) {
                return res.status(500).json({
                  success: false,
                  message: "Fetch application status history failed",
                  error: error.message,
                });
              }

              return res.status(200).json({
                success: true,
                history: result,
              });
            });
          },
        );
      },
    );
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Get application status history failed",
      error: error.message,
    });
  }
};

module.exports = {
  applyForJob,
  updateMyApplication,
  withdrawMyApplication,
  getMyApplications,
  getSingleApplication,
  getApplicationsForJob,
  updateApplicationStatus,
  getApplicationStatusHistory,
};
