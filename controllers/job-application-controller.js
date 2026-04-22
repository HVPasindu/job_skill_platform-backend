const db = require("../db/db-connection");

// APPLY FOR A JOB
const applyForJob = (req, res) => {
    try {
        const userId = req.user.id;
        const jobId = req.params.jobId;
        const { resume_id, cover_letter } = req.body;

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
                    error: profileError.message
                });
            }

            if (profileResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Job seeker profile not found"
                });
            }

            const profile = profileResult[0];

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

                const job = jobResult[0];

                if (job.status !== "open") {
                    return res.status(400).json({
                        success: false,
                        message: "This job is not open for applications"
                    });
                }

                if (job.application_deadline) {
                    const today = new Date();
                    const deadline = new Date(job.application_deadline);

                    if (today > deadline) {
                        return res.status(400).json({
                            success: false,
                            message: "Application deadline has passed"
                        });
                    }
                }

                const continueApplicationInsert = () => {
                    const insertApplicationQuery = `
                        INSERT INTO job_applications (
                            job_id,
                            job_seeker_profile_id,
                            resume_id,
                            cover_letter,
                            application_status
                        )
                        VALUES (?, ?, ?, ?, ?)
                    `;

                    db.query(
                        insertApplicationQuery,
                        [
                            jobId,
                            profile.id,
                            resume_id || null,
                            cover_letter || null,
                            "pending"
                        ],
                        (insertError, insertResult) => {
                            if (insertError) {
                                if (insertError.code === "ER_DUP_ENTRY") {
                                    return res.status(400).json({
                                        success: false,
                                        message: "You have already applied for this job"
                                    });
                                }

                                return res.status(500).json({
                                    success: false,
                                    message: "Job application failed",
                                    error: insertError.message
                                });
                            }

                            const applicationId = insertResult.insertId;

                            const insertHistoryQuery = `
                                INSERT INTO application_status_history (
                                    job_application_id,
                                    old_status,
                                    new_status,
                                    changed_by_user_id,
                                    note
                                )
                                VALUES (?, ?, ?, ?, ?)
                            `;

                            db.query(
                                insertHistoryQuery,
                                [
                                    applicationId,
                                    null,
                                    "pending",
                                    userId,
                                    "Application submitted"
                                ],
                                (historyError) => {
                                    if (historyError) {
                                        return res.status(500).json({
                                            success: false,
                                            message: "Application history save failed",
                                            error: historyError.message
                                        });
                                    }

                                    return res.status(201).json({
                                        success: true,
                                        message: "Applied for job successfully",
                                        application_id: applicationId
                                    });
                                }
                            );
                        }
                    );
                };

                if (!resume_id) {
                    return continueApplicationInsert();
                }

                const checkResumeQuery = `
                    SELECT * FROM resumes
                    WHERE id = ? AND job_seeker_profile_id = ?
                    LIMIT 1
                `;

                db.query(checkResumeQuery, [resume_id, profile.id], (resumeError, resumeResult) => {
                    if (resumeError) {
                        return res.status(500).json({
                            success: false,
                            message: "Resume check failed",
                            error: resumeError.message
                        });
                    }

                    if (resumeResult.length === 0) {
                        return res.status(404).json({
                            success: false,
                            message: "Resume not found or does not belong to you"
                        });
                    }

                    return continueApplicationInsert();
                });
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Apply for job failed",
            error: error.message
        });
    }
};

// UPDATE MY APPLICATION (ONLY PENDING)
const updateMyApplication = (req, res) => {
    try {
        const userId = req.user.id;
        const applicationId = req.params.id;
        const { resume_id, cover_letter } = req.body;

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
                    error: profileError.message
                });
            }

            if (profileResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Job seeker profile not found"
                });
            }

            const profile = profileResult[0];

            const getApplicationQuery = `
                SELECT * FROM job_applications
                WHERE id = ? AND job_seeker_profile_id = ?
                LIMIT 1
            `;

            db.query(getApplicationQuery, [applicationId, profile.id], (applicationError, applicationResult) => {
                if (applicationError) {
                    return res.status(500).json({
                        success: false,
                        message: "Application fetch failed",
                        error: applicationError.message
                    });
                }

                if (applicationResult.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message: "Application not found"
                    });
                }

                const application = applicationResult[0];

                if (application.application_status !== "pending") {
                    return res.status(400).json({
                        success: false,
                        message: "Only pending applications can be updated"
                    });
                }

                const continueUpdate = () => {
                    const finalResumeId =
                        resume_id !== undefined ? resume_id : application.resume_id;

                    const finalCoverLetter =
                        cover_letter !== undefined ? cover_letter : application.cover_letter;

                    const updateApplicationQuery = `
                        UPDATE job_applications
                        SET
                            resume_id = ?,
                            cover_letter = ?
                        WHERE id = ? AND job_seeker_profile_id = ?
                    `;

                    db.query(
                        updateApplicationQuery,
                        [
                            finalResumeId || null,
                            finalCoverLetter || null,
                            applicationId,
                            profile.id
                        ],
                        (updateError) => {
                            if (updateError) {
                                return res.status(500).json({
                                    success: false,
                                    message: "Application update failed",
                                    error: updateError.message
                                });
                            }

                            return res.status(200).json({
                                success: true,
                                message: "Application updated successfully"
                            });
                        }
                    );
                };

                if (resume_id === undefined || resume_id === null) {
                    return continueUpdate();
                }

                const checkResumeQuery = `
                    SELECT * FROM resumes
                    WHERE id = ? AND job_seeker_profile_id = ?
                    LIMIT 1
                `;

                db.query(checkResumeQuery, [resume_id, profile.id], (resumeError, resumeResult) => {
                    if (resumeError) {
                        return res.status(500).json({
                            success: false,
                            message: "Resume check failed",
                            error: resumeError.message
                        });
                    }

                    if (resumeResult.length === 0) {
                        return res.status(404).json({
                            success: false,
                            message: "Resume not found or does not belong to you"
                        });
                    }

                    return continueUpdate();
                });
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Update my application failed",
            error: error.message
        });
    }
};

// WITHDRAW MY APPLICATION (ONLY PENDING)
const withdrawMyApplication = (req, res) => {
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
                    error: profileError.message
                });
            }

            if (profileResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Job seeker profile not found"
                });
            }

            const profile = profileResult[0];

            const getApplicationQuery = `
                SELECT * FROM job_applications
                WHERE id = ? AND job_seeker_profile_id = ?
                LIMIT 1
            `;

            db.query(getApplicationQuery, [applicationId, profile.id], (applicationError, applicationResult) => {
                if (applicationError) {
                    return res.status(500).json({
                        success: false,
                        message: "Application fetch failed",
                        error: applicationError.message
                    });
                }

                if (applicationResult.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message: "Application not found"
                    });
                }

                const application = applicationResult[0];

                if (application.application_status !== "pending") {
                    return res.status(400).json({
                        success: false,
                        message: "Only pending applications can be withdrawn"
                    });
                }

                const updateApplicationQuery = `
                    UPDATE job_applications
                    SET application_status = ?
                    WHERE id = ? AND job_seeker_profile_id = ?
                `;

                db.query(
                    updateApplicationQuery,
                    ["withdrawn", applicationId, profile.id],
                    (updateError) => {
                        if (updateError) {
                            return res.status(500).json({
                                success: false,
                                message: "Application withdraw failed",
                                error: updateError.message
                            });
                        }

                        const insertHistoryQuery = `
                            INSERT INTO application_status_history (
                                job_application_id,
                                old_status,
                                new_status,
                                changed_by_user_id,
                                note
                            )
                            VALUES (?, ?, ?, ?, ?)
                        `;

                        db.query(
                            insertHistoryQuery,
                            [
                                applicationId,
                                "pending",
                                "withdrawn",
                                userId,
                                "Application withdrawn by candidate"
                            ],
                            (historyError) => {
                                if (historyError) {
                                    return res.status(500).json({
                                        success: false,
                                        message: "Application history save failed",
                                        error: historyError.message
                                    });
                                }

                                return res.status(200).json({
                                    success: true,
                                    message: "Application withdrawn successfully"
                                });
                            }
                        );
                    }
                );
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Withdraw application failed",
            error: error.message
        });
    }
};

// GET MY APPLICATIONS
const getMyApplications = (req, res) => {
    try {
        const userId = req.user.id;
        const { status } = req.query;

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
                    error: profileError.message
                });
            }

            if (profileResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Job seeker profile not found"
                });
            }

            const profile = profileResult[0];

            let getApplicationsQuery = `
                SELECT
                    ja.*,
                    j.title AS job_title,
                    j.location,
                    j.work_mode,
                    j.job_type,
                    c.company_name,
                    c.logo_url,
                    r.file_name AS resume_file_name
                FROM job_applications ja
                JOIN jobs j ON ja.job_id = j.id
                JOIN companies c ON j.company_id = c.id
                LEFT JOIN resumes r ON ja.resume_id = r.id
                WHERE ja.job_seeker_profile_id = ?
            `;

            const queryParams = [profile.id];

            if (status) {
                getApplicationsQuery += ` AND ja.application_status = ? `;
                queryParams.push(status);
            }

            getApplicationsQuery += ` ORDER BY ja.id DESC `;

            db.query(getApplicationsQuery, queryParams, (error, result) => {
                if (error) {
                    return res.status(500).json({
                        success: false,
                        message: "Fetch applications failed",
                        error: error.message
                    });
                }

                return res.status(200).json({
                    success: true,
                    applications: result
                });
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Get my applications failed",
            error: error.message
        });
    }
};

// GET SINGLE APPLICATION
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
                    error: profileError.message
                });
            }

            if (profileResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Job seeker profile not found"
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

            db.query(getApplicationQuery, [applicationId, profile.id], (error, result) => {
                if (error) {
                    return res.status(500).json({
                        success: false,
                        message: "Fetch application failed",
                        error: error.message
                    });
                }

                if (result.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message: "Application not found"
                    });
                }

                return res.status(200).json({
                    success: true,
                    application: result[0]
                });
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Get single application failed",
            error: error.message
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
                    error: jobError.message
                });
            }

            if (jobResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Job not found"
                });
            }

            const job = jobResult[0];

            const checkAccessQuery = `
                SELECT * FROM company_users
                WHERE company_id = ? AND user_id = ?
                LIMIT 1
            `;

            db.query(checkAccessQuery, [job.company_id, userId], (accessError, accessResult) => {
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
                        message: "You are not allowed to view applications for this job"
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
                            error: error.message
                        });
                    }

                    return res.status(200).json({
                        success: true,
                        applications: result
                    });
                });
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Get applications for job failed",
            error: error.message
        });
    }
};

// UPDATE APPLICATION STATUS
const updateApplicationStatus = (req, res) => {
    try {
        const userId = req.user.id;
        const applicationId = req.params.id;
        const { application_status, note } = req.body;

        const allowedStatuses = [
            "pending",
            "reviewed",
            "shortlisted",
            "rejected",
            "accepted",
            "withdrawn"
        ];

        if (!application_status) {
            return res.status(400).json({
                success: false,
                message: "application_status is required"
            });
        }

        if (!allowedStatuses.includes(application_status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid application status"
            });
        }

        const getApplicationQuery = `
            SELECT ja.*, j.company_id
            FROM job_applications ja
            JOIN jobs j ON ja.job_id = j.id
            WHERE ja.id = ?
            LIMIT 1
        `;

        db.query(getApplicationQuery, [applicationId], (applicationError, applicationResult) => {
            if (applicationError) {
                return res.status(500).json({
                    success: false,
                    message: "Application fetch failed",
                    error: applicationError.message
                });
            }

            if (applicationResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Application not found"
                });
            }

            const application = applicationResult[0];

            const checkAccessQuery = `
                SELECT * FROM company_users
                WHERE company_id = ? AND user_id = ?
                LIMIT 1
            `;

            db.query(checkAccessQuery, [application.company_id, userId], (accessError, accessResult) => {
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
                        message: "You are not allowed to update this application status"
                    });
                }

                const oldStatus = application.application_status;

                const updateStatusQuery = `
                    UPDATE job_applications
                    SET application_status = ?
                    WHERE id = ?
                `;

                db.query(updateStatusQuery, [application_status, applicationId], (updateError) => {
                    if (updateError) {
                        return res.status(500).json({
                            success: false,
                            message: "Application status update failed",
                            error: updateError.message
                        });
                    }

                    const insertHistoryQuery = `
                        INSERT INTO application_status_history (
                            job_application_id,
                            old_status,
                            new_status,
                            changed_by_user_id,
                            note
                        )
                        VALUES (?, ?, ?, ?, ?)
                    `;

                    db.query(
                        insertHistoryQuery,
                        [
                            applicationId,
                            oldStatus,
                            application_status,
                            userId,
                            note || null
                        ],
                        (historyError) => {
                            if (historyError) {
                                return res.status(500).json({
                                    success: false,
                                    message: "Application history save failed",
                                    error: historyError.message
                                });
                            }

                            return res.status(200).json({
                                success: true,
                                message: "Application status updated successfully"
                            });
                        }
                    );
                });
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Update application status failed",
            error: error.message
        });
    }
};

// GET APPLICATION STATUS HISTORY
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

        db.query(getApplicationQuery, [applicationId], (applicationError, applicationResult) => {
            if (applicationError) {
                return res.status(500).json({
                    success: false,
                    message: "Application fetch failed",
                    error: applicationError.message
                });
            }

            if (applicationResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Application not found"
                });
            }

            const application = applicationResult[0];

            const checkCompanyAccessQuery = `
                SELECT * FROM company_users
                WHERE company_id = ? AND user_id = ?
                LIMIT 1
            `;

            db.query(checkCompanyAccessQuery, [application.company_id, userId], (companyAccessError, companyAccessResult) => {
                if (companyAccessError) {
                    return res.status(500).json({
                        success: false,
                        message: "Company access check failed",
                        error: companyAccessError.message
                    });
                }

                const isEmployerSide = companyAccessResult.length > 0;
                const isApplicant = Number(application.applicant_user_id) === Number(userId);

                if (!isEmployerSide && !isApplicant) {
                    return res.status(403).json({
                        success: false,
                        message: "You are not allowed to view this status history"
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
                            error: error.message
                        });
                    }

                    return res.status(200).json({
                        success: true,
                        history: result
                    });
                });
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Get application status history failed",
            error: error.message
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
    getApplicationStatusHistory
};