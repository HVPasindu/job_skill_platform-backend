const sendList = require("../utils/paginated-list");
const db = require("../db/db-connection");

// CREATE JOB
const createJob = (req, res) => {
  try {
    const userId = req.user.id;

    const {
      company_id,
      job_category_id,
      title,
      description,
      location,
      work_mode,
      job_type,
      experience_level,
      salary_min,
      salary_max,
      application_deadline,
      status,
    } = req.body;

    if (!company_id || !title || !description || !work_mode || !job_type) {
      return res.status(400).json({
        success: false,
        message:
          "company_id, title, description, work_mode and job_type are required",
      });
    }

    const checkCompanyAccessQuery = `
            SELECT * FROM company_users
            WHERE company_id = ? AND user_id = ?
            LIMIT 1
        `;

    db.query(
      checkCompanyAccessQuery,
      [company_id, userId],
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
            message: "You are not allowed to create jobs for this company",
          });
        }

        const continueInsertJob = () => {
          const insertJobQuery = `
                    INSERT INTO jobs (
                        company_id,
                        posted_by_user_id,
                        job_category_id,
                        title,
                        description,
                        location,
                        work_mode,
                        job_type,
                        experience_level,
                        salary_min,
                        salary_max,
                        application_deadline,
                        status
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;

          db.query(
            insertJobQuery,
            [
              company_id,
              userId,
              job_category_id || null,
              title,
              description,
              location || null,
              work_mode,
              job_type,
              experience_level || null,
              salary_min ?? null,
              salary_max ?? null,
              application_deadline || null,
              status || "open",
            ],
            (insertError, insertResult) => {
              if (insertError) {
                return res.status(500).json({
                  success: false,
                  message: "Job creation failed",
                  error: insertError.message,
                });
              }

              return res.status(201).json({
                success: true,
                message: "Job created successfully",
                job_id: insertResult.insertId,
              });
            },
          );
        };

        if (!job_category_id) {
          return continueInsertJob();
        }

        const checkCategoryQuery = `
                SELECT * FROM job_categories
                WHERE id = ?
                LIMIT 1
            `;

        db.query(
          checkCategoryQuery,
          [job_category_id],
          (categoryError, categoryResult) => {
            if (categoryError) {
              return res.status(500).json({
                success: false,
                message: "Category check failed",
                error: categoryError.message,
              });
            }

            if (categoryResult.length === 0) {
              return res.status(404).json({
                success: false,
                message: "Job category not found",
              });
            }

            return continueInsertJob();
          },
        );
      },
    );
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Create job failed",
      error: error.message,
    });
  }
};

// GET ALL OPEN JOBS
const getAllJobs = (req, res) => {
  try {
    const getJobsQuery = `
            SELECT
                j.*,
                c.company_name,
                c.logo_url,
                jc.category_name
            FROM jobs j
            JOIN companies c ON j.company_id = c.id
            LEFT JOIN job_categories jc ON j.job_category_id = jc.id
            WHERE j.status = 'open'
            ORDER BY j.id DESC
        `;

    return sendList(req, res, {
        sql: getJobsQuery,
        params: [],
        key: "jobs",
        countSql: "SELECT COUNT(*) AS total FROM jobs j JOIN companies c ON j.company_id=c.id LEFT JOIN job_categories jc ON j.job_category_id=jc.id WHERE j.status=\'open\'",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Get jobs failed",
      error: error.message,
    });
  }
};

// GET MY JOBS
const getMyJobs = (req, res) => {
  try {
    const userId = req.user.id;

    const getMyJobsQuery = `
            SELECT
                j.*,
                c.company_name,
                c.logo_url,
                jc.category_name
            FROM jobs j
            JOIN companies c ON j.company_id = c.id
            LEFT JOIN job_categories jc ON j.job_category_id = jc.id
            WHERE j.posted_by_user_id = ?
            ORDER BY j.id DESC
        `;

    return sendList(req, res, {
        sql: getMyJobsQuery,
        params: [userId],
        key: "jobs",
        countSql: "SELECT COUNT(*) AS total FROM jobs j JOIN companies c ON j.company_id=c.id LEFT JOIN job_categories jc ON j.job_category_id=jc.id WHERE j.posted_by_user_id = ?",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Get my jobs failed",
      error: error.message,
    });
  }
};

// GET JOBS BY COMPANY
const getCompanyJobs = (req, res) => {
  try {
    const companyId = req.params.companyId;

    const getCompanyJobsQuery = `
            SELECT
                j.*,
                c.company_name,
                c.logo_url,
                jc.category_name
            FROM jobs j
            JOIN companies c ON j.company_id = c.id
            LEFT JOIN job_categories jc ON j.job_category_id = jc.id
            WHERE j.company_id = ? AND j.status <> 'draft'
            ORDER BY j.id DESC
        `;

    return sendList(req, res, {
        sql: getCompanyJobsQuery,
        params: [companyId],
        key: "jobs",
        countSql: "SELECT COUNT(*) AS total FROM jobs j JOIN companies c ON j.company_id=c.id LEFT JOIN job_categories jc ON j.job_category_id=jc.id WHERE j.company_id = ? AND j.status <> 'draft'",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Get company jobs failed",
      error: error.message,
    });
  }
};

// GET SINGLE JOB
const getSingleJob = (req, res) => {
  try {
    const jobId = req.params.id;

    const getSingleJobQuery = `
            SELECT
                j.*,
                DATE_FORMAT(j.application_deadline, '%Y-%m-%d') AS application_deadline,
                (j.status = 'open' AND (j.application_deadline IS NULL OR DATE(j.application_deadline) >= CURRENT_DATE())) AS accepting_applications,
                c.company_name,
                c.company_email,
                c.company_phone,
                c.website_url,
                c.logo_url,
                c.city,
                c.country,
                jc.category_name
            FROM jobs j
            JOIN companies c ON j.company_id = c.id
            LEFT JOIN job_categories jc ON j.job_category_id = jc.id
            WHERE j.id = ?
            LIMIT 1
        `;

    db.query(getSingleJobQuery, [jobId], (error, result) => {
      if (error) {
        return res.status(500).json({
          success: false,
          message: "Fetch job failed",
          error: error.message,
        });
      }

      if (result.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Job not found",
        });
      }

      const respond = () => res.status(200).json({ success: true, job: result[0] });
      if (result[0].status !== "draft") return respond();
      if (!req.user) return res.status(404).json({ success: false, message: "Job not found" });
      // Draft previews are available only to current company members.
      db.query("SELECT id FROM company_users WHERE company_id = ? AND user_id = ? LIMIT 1", [result[0].company_id, req.user.id], (accessError, members) => {
        if (accessError) return res.status(500).json({ success: false, message: "Company access check failed" });
        if (!members.length) return res.status(404).json({ success: false, message: "Job not found" });
        return respond();
      });
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Get single job failed",
      error: error.message,
    });
  }
};

// UPDATE JOB
const updateJob = (req, res) => {
  try {
    const userId = req.user.id;
    const jobId = req.params.id;

    const {
      job_category_id,
      title,
      description,
      location,
      work_mode,
      job_type,
      experience_level,
      salary_min,
      salary_max,
      application_deadline,
      status,
    } = req.body;

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

      const existingJob = jobResult[0];

      const checkCompanyAccessQuery = `
                SELECT * FROM company_users
                WHERE company_id = ? AND user_id = ?
                LIMIT 1
            `;

      db.query(
        checkCompanyAccessQuery,
        [existingJob.company_id, userId],
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
              message: "You are not allowed to update this job",
            });
          }

          const continueUpdate = () => {
            const updateJobQuery = `
                        UPDATE jobs
                        SET
                            job_category_id = ?,
                            title = ?,
                            description = ?,
                            location = ?,
                            work_mode = ?,
                            job_type = ?,
                            experience_level = ?,
                            salary_min = ?,
                            salary_max = ?,
                            application_deadline = ?,
                            status = ?
                        WHERE id = ?
                    `;

            db.query(
              updateJobQuery,
              [
                job_category_id !== undefined
                  ? job_category_id
                  : existingJob.job_category_id,
                title !== undefined ? title : existingJob.title,
                description !== undefined
                  ? description
                  : existingJob.description,
                location !== undefined ? location : existingJob.location,
                work_mode !== undefined ? work_mode : existingJob.work_mode,
                job_type !== undefined ? job_type : existingJob.job_type,
                experience_level !== undefined
                  ? experience_level
                  : existingJob.experience_level,
                salary_min !== undefined ? salary_min : existingJob.salary_min,
                salary_max !== undefined ? salary_max : existingJob.salary_max,
                application_deadline !== undefined
                  ? application_deadline
                  : existingJob.application_deadline,
                status !== undefined ? status : existingJob.status,
                jobId,
              ],
              (updateError) => {
                if (updateError) {
                  return res.status(500).json({
                    success: false,
                    message: "Job update failed",
                    error: updateError.message,
                  });
                }

                return res.status(200).json({
                  success: true,
                  message: "Job updated successfully",
                });
              },
            );
          };

          if (job_category_id === undefined || job_category_id === null) {
            return continueUpdate();
          }

          const checkCategoryQuery = `
                    SELECT * FROM job_categories
                    WHERE id = ?
                    LIMIT 1
                `;

          db.query(
            checkCategoryQuery,
            [job_category_id],
            (categoryError, categoryResult) => {
              if (categoryError) {
                return res.status(500).json({
                  success: false,
                  message: "Category check failed",
                  error: categoryError.message,
                });
              }

              if (categoryResult.length === 0) {
                return res.status(404).json({
                  success: false,
                  message: "Job category not found",
                });
              }

              return continueUpdate();
            },
          );
        },
      );
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Update job failed",
      error: error.message,
    });
  }
};

// DELETE JOB
const deleteJob = (req, res) => {
  try {
    const userId = req.user.id;
    const jobId = req.params.id;

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

      const existingJob = jobResult[0];

      const checkCompanyAccessQuery = `
                SELECT * FROM company_users
                WHERE company_id = ? AND user_id = ?
                LIMIT 1
            `;

      db.query(
        checkCompanyAccessQuery,
        [existingJob.company_id, userId],
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
              message: "You are not allowed to delete this job",
            });
          }

          const deleteJobQuery = `
                    DELETE FROM jobs
                    WHERE id = ?
                `;

          db.query(deleteJobQuery, [jobId], (deleteError, deleteResult) => {
            if (deleteError) {
              return res.status(500).json({
                success: false,
                message: "Job delete failed",
                error: deleteError.message,
              });
            }

            if (deleteResult.affectedRows === 0) {
              return res.status(404).json({
                success: false,
                message: "Job not found",
              });
            }

            return res.status(200).json({
              success: true,
              message: "Job deleted successfully",
            });
          });
        },
      );
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Delete job failed",
      error: error.message,
    });
  }
};

// GET ALL JOBS WITH SEARCH + FILTER

// Step 04: opt-in server pagination; existing callers without page parameters keep the list response.
const searchJobs = async (req, res) => {
  try {
    const filters = req.query;
    for (const key of [
      "search",
      "location",
      "job_type",
      "work_mode",
      "experience_level",
      "category_id",
      "min_salary",
      "max_salary",
    ]) {
      if (
        filters[key] !== undefined &&
        (typeof filters[key] !== "string" || filters[key].length > 200)
      )
        return res
          .status(400)
          .json({ success: false, message: "Invalid search filters" });
    }
    const paged = filters.page !== undefined || filters.per_page !== undefined;
    const page = Number(filters.page || 1),
      size = Number(filters.per_page || 9);
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      page > 100000 ||
      !Number.isInteger(size) ||
      size < 1 ||
      size > 24
    )
      return res
        .status(400)
        .json({ success: false, message: "Invalid page or page size" });
    for (const key of ["min_salary", "max_salary"]) {
      if (
        filters[key] &&
        (!Number.isFinite(Number(filters[key])) ||
          Number(filters[key]) < 0 ||
          Number(filters[key]) > 9999999999.99)
      )
        return res
          .status(400)
          .json({ success: false, message: "Invalid salary range" });
    }
    if (
      filters.min_salary &&
      filters.max_salary &&
      Number(filters.min_salary) > Number(filters.max_salary)
    )
      return res
        .status(400)
        .json({
          success: false,
          message: "Minimum salary cannot exceed maximum salary",
        });
    if (filters.category_id && !/^[1-9]\d{0,19}$/.test(filters.category_id))
      return res
        .status(400)
        .json({ success: false, message: "Invalid category" });
    const joins =
      " FROM jobs j JOIN companies c ON j.company_id = c.id LEFT JOIN job_categories jc ON j.job_category_id = jc.id ";
    let where =
      " WHERE j.status = 'open' AND (j.application_deadline IS NULL OR DATE(j.application_deadline) >= CURRENT_DATE()) ";
    const params = [];
    if (filters.search?.trim()) {
      where +=
        " AND (j.title LIKE ? OR j.description LIKE ? OR c.company_name LIKE ? OR EXISTS (SELECT 1 FROM job_required_skills jrs JOIN skills s ON s.id = jrs.skill_id WHERE jrs.job_id = j.id AND s.skill_name LIKE ?)) ";
      params.push(...Array(4).fill(`%${filters.search.trim()}%`));
    }
    if (filters.location?.trim()) {
      where += " AND j.location LIKE ? ";
      params.push(`%${filters.location.trim()}%`);
    }
    for (const key of ["job_type", "work_mode", "experience_level"])
      if (filters[key]) {
        if (key === "work_mode" && ["onsite", "on_site"].includes(filters[key])) {
          where += " AND j.work_mode IN (?, ?) ";
          params.push("onsite", "on_site");
        } else {
          where += ` AND j.${key} = ? `;
          params.push(filters[key]);
        }
      }
    if (filters.category_id) {
      where += " AND j.job_category_id = ? ";
      params.push(filters.category_id);
    }
    // Salary ranges overlap the requested interval; undisclosed bounds do not match that bound.
    if (filters.min_salary) {
      where += " AND COALESCE(j.salary_max, j.salary_min) >= ? ";
      params.push(Number(filters.min_salary));
    }
    if (filters.max_salary) {
      where += " AND COALESCE(j.salary_min, j.salary_max) <= ? ";
      params.push(Number(filters.max_salary));
    }
    const client = db.promise();
    let pagination;
    if (paged) {
      const [rows] = await client.query(
        "SELECT COUNT(*) AS total" + joins + where,
        params,
      );
      const total = Number(rows[0].total);
      pagination = {
        page,
        per_page: size,
        total,
        total_pages: Math.ceil(total / size),
      };
    }
    const [jobs] = await client.query(
      `SELECT j.*, DATE_FORMAT(j.application_deadline, '%Y-%m-%d') AS application_deadline,
            1 AS accepting_applications, c.company_name, c.logo_url, jc.category_name` +
        joins +
        where +
        " ORDER BY j.created_at DESC, j.id DESC " +
        (paged ? " LIMIT ? OFFSET ?" : ""),
      paged ? [...params, size, (page - 1) * size] : params,
    );
    return res.json({
      success: true,
      jobs,
      ...(pagination ? { pagination } : {}),
    });
  } catch {
    return res
      .status(500)
      .json({ success: false, message: "Fetch jobs failed" });
  }
};

module.exports = {
  createJob,
  getAllJobs,
  getMyJobs,
  getCompanyJobs,
  getSingleJob,
  updateJob,
  deleteJob,
  searchJobs,
};
