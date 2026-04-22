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
            status
        } = req.body;

        if (!company_id || !title || !description || !work_mode || !job_type) {
            return res.status(400).json({
                success: false,
                message: "company_id, title, description, work_mode and job_type are required"
            });
        }

        const checkCompanyAccessQuery = `
            SELECT * FROM company_users
            WHERE company_id = ? AND user_id = ?
            LIMIT 1
        `;

        db.query(checkCompanyAccessQuery, [company_id, userId], (accessError, accessResult) => {
            if (accessError) {
                return res.status(500).json({
                    success: false,
                    message: "Company access check failed",
                    error: accessError.message
                });
            }

            if (accessResult.length === 0) {
                return res.status(403).json({
                    success: false,
                    message: "You are not allowed to create jobs for this company"
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
                        salary_min || null,
                        salary_max || null,
                        application_deadline || null,
                        status || "open"
                    ],
                    (insertError, insertResult) => {
                        if (insertError) {
                            return res.status(500).json({
                                success: false,
                                message: "Job creation failed",
                                error: insertError.message
                            });
                        }

                        return res.status(201).json({
                            success: true,
                            message: "Job created successfully",
                            job_id: insertResult.insertId
                        });
                    }
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

            db.query(checkCategoryQuery, [job_category_id], (categoryError, categoryResult) => {
                if (categoryError) {
                    return res.status(500).json({
                        success: false,
                        message: "Category check failed",
                        error: categoryError.message
                    });
                }

                if (categoryResult.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message: "Job category not found"
                    });
                }

                return continueInsertJob();
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Create job failed",
            error: error.message
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

        db.query(getJobsQuery, (error, result) => {
            if (error) {
                return res.status(500).json({
                    success: false,
                    message: "Fetch jobs failed",
                    error: error.message
                });
            }

            return res.status(200).json({
                success: true,
                jobs: result
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Get jobs failed",
            error: error.message
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

        db.query(getMyJobsQuery, [userId], (error, result) => {
            if (error) {
                return res.status(500).json({
                    success: false,
                    message: "Fetch my jobs failed",
                    error: error.message
                });
            }

            return res.status(200).json({
                success: true,
                jobs: result
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Get my jobs failed",
            error: error.message
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
            WHERE j.company_id = ?
            ORDER BY j.id DESC
        `;

        db.query(getCompanyJobsQuery, [companyId], (error, result) => {
            if (error) {
                return res.status(500).json({
                    success: false,
                    message: "Fetch company jobs failed",
                    error: error.message
                });
            }

            return res.status(200).json({
                success: true,
                jobs: result
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Get company jobs failed",
            error: error.message
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
                    error: error.message
                });
            }

            if (result.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Job not found"
                });
            }

            return res.status(200).json({
                success: true,
                job: result[0]
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Get single job failed",
            error: error.message
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
            status
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
                    error: jobError.message
                });
            }

            if (jobResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Job not found"
                });
            }

            const existingJob = jobResult[0];

            const checkCompanyAccessQuery = `
                SELECT * FROM company_users
                WHERE company_id = ? AND user_id = ?
                LIMIT 1
            `;

            db.query(checkCompanyAccessQuery, [existingJob.company_id, userId], (accessError, accessResult) => {
                if (accessError) {
                    return res.status(500).json({
                        success: false,
                        message: "Company access check failed",
                        error: accessError.message
                    });
                }

                if (accessResult.length === 0) {
                    return res.status(403).json({
                        success: false,
                        message: "You are not allowed to update this job"
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
                            job_category_id !== undefined ? job_category_id : existingJob.job_category_id,
                            title !== undefined ? title : existingJob.title,
                            description !== undefined ? description : existingJob.description,
                            location !== undefined ? location : existingJob.location,
                            work_mode !== undefined ? work_mode : existingJob.work_mode,
                            job_type !== undefined ? job_type : existingJob.job_type,
                            experience_level !== undefined ? experience_level : existingJob.experience_level,
                            salary_min !== undefined ? salary_min : existingJob.salary_min,
                            salary_max !== undefined ? salary_max : existingJob.salary_max,
                            application_deadline !== undefined ? application_deadline : existingJob.application_deadline,
                            status !== undefined ? status : existingJob.status,
                            jobId
                        ],
                        (updateError) => {
                            if (updateError) {
                                return res.status(500).json({
                                    success: false,
                                    message: "Job update failed",
                                    error: updateError.message
                                });
                            }

                            return res.status(200).json({
                                success: true,
                                message: "Job updated successfully"
                            });
                        }
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

                db.query(checkCategoryQuery, [job_category_id], (categoryError, categoryResult) => {
                    if (categoryError) {
                        return res.status(500).json({
                            success: false,
                            message: "Category check failed",
                            error: categoryError.message
                        });
                    }

                    if (categoryResult.length === 0) {
                        return res.status(404).json({
                            success: false,
                            message: "Job category not found"
                        });
                    }

                    return continueUpdate();
                });
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Update job failed",
            error: error.message
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
                    error: jobError.message
                });
            }

            if (jobResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Job not found"
                });
            }

            const existingJob = jobResult[0];

            const checkCompanyAccessQuery = `
                SELECT * FROM company_users
                WHERE company_id = ? AND user_id = ?
                LIMIT 1
            `;

            db.query(checkCompanyAccessQuery, [existingJob.company_id, userId], (accessError, accessResult) => {
                if (accessError) {
                    return res.status(500).json({
                        success: false,
                        message: "Company access check failed",
                        error: accessError.message
                    });
                }

                if (accessResult.length === 0) {
                    return res.status(403).json({
                        success: false,
                        message: "You are not allowed to delete this job"
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
                            error: deleteError.message
                        });
                    }

                    if (deleteResult.affectedRows === 0) {
                        return res.status(404).json({
                            success: false,
                            message: "Job not found"
                        });
                    }

                    return res.status(200).json({
                        success: true,
                        message: "Job deleted successfully"
                    });
                });
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Delete job failed",
            error: error.message
        });
    }
};


// GET ALL JOBS WITH SEARCH + FILTER
const searchJobs = (req, res) => {
    try {
        const {
            search,
            location,
            job_type,
            work_mode,
            min_salary,
            max_salary
        } = req.query;

        let query = `
            SELECT 
                j.*,
                c.company_name,
                c.logo_url,
                jc.category_name
            FROM jobs j
            JOIN companies c ON j.company_id = c.id
            LEFT JOIN job_categories jc ON j.job_category_id = jc.id
            WHERE j.status = 'open'
        `;

        const params = [];

        // 🔍 SEARCH (title + description)
        if (search) {
            query += ` AND (j.title LIKE ? OR j.description LIKE ?) `;
            params.push(`%${search}%`, `%${search}%`);
        }

        // 📍 LOCATION
        if (location) {
            query += ` AND j.location LIKE ? `;
            params.push(`%${location}%`);
        }

        // 💼 JOB TYPE
        if (job_type) {
            query += ` AND j.job_type = ? `;
            params.push(job_type);
        }

        // 🏢 WORK MODE
        if (work_mode) {
            query += ` AND j.work_mode = ? `;
            params.push(work_mode);
        }

        // 💰 MIN SALARY
        if (min_salary) {
            query += ` AND j.salary_min >= ? `;
            params.push(min_salary);
        }

        // 💰 MAX SALARY
        if (max_salary) {
            query += ` AND j.salary_max <= ? `;
            params.push(max_salary);
        }

        query += ` ORDER BY j.created_at DESC `;

        db.query(query, params, (err, results) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: "Fetch jobs failed",
                    error: err.message
                });
            }

            return res.status(200).json({
                success: true,
                jobs: results
            });
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Get jobs failed",
            error: error.message
        });
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
    searchJobs
};