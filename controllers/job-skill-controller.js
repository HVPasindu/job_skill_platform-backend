const db = require("../db/db-connection");

// ADD SKILL TO JOB
const addJobSkill = (req, res) => {
    try {
        const userId = req.user.id;
        const jobId = req.params.jobId;
        const { skill_id, skill_name, is_mandatory } = req.body;

        if (!skill_id && !skill_name) {
            return res.status(400).json({
                success: false,
                message: "skill_id or skill_name is required"
            });
        }

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
                        message: "You are not allowed to add skills to this job"
                    });
                }

                const insertMapping = (finalSkillId) => {
                    const checkDuplicateQuery = `
                        SELECT * FROM job_required_skills
                        WHERE job_id = ? AND skill_id = ?
                        LIMIT 1
                    `;

                    db.query(checkDuplicateQuery, [jobId, finalSkillId], (checkErr, checkRes) => {
                        if (checkErr) {
                            return res.status(500).json({
                                success: false,
                                message: "Duplicate skill check failed",
                                error: checkErr.message
                            });
                        }

                        if (checkRes.length > 0) {
                            return res.status(400).json({
                                success: false,
                                message: "Skill already added to this job"
                            });
                        }

                        const insertQuery = `
                            INSERT INTO job_required_skills (
                                job_id,
                                skill_id,
                                is_mandatory
                            )
                            VALUES (?, ?, ?)
                        `;

                        db.query(
                            insertQuery,
                            [jobId, finalSkillId, is_mandatory !== undefined ? is_mandatory : true],
                            (insertErr, insertResult) => {
                                if (insertErr) {
                                    return res.status(500).json({
                                        success: false,
                                        message: "Add skill to job failed",
                                        error: insertErr.message
                                    });
                                }

                                return res.status(201).json({
                                    success: true,
                                    message: "Skill added to job successfully",
                                    job_required_skill_id: insertResult.insertId
                                });
                            }
                        );
                    });
                };

                // CASE 1: skill_id dila thiyenawa
                if (skill_id) {
                    const checkSkillByIdQuery = `
                        SELECT * FROM skills
                        WHERE id = ?
                        LIMIT 1
                    `;

                    db.query(checkSkillByIdQuery, [skill_id], (skillError, skillResult) => {
                        if (skillError) {
                            return res.status(500).json({
                                success: false,
                                message: "Skill check failed",
                                error: skillError.message
                            });
                        }

                        if (skillResult.length === 0) {
                            return res.status(404).json({
                                success: false,
                                message: "Skill not found"
                            });
                        }

                        return insertMapping(skill_id);
                    });

                    return;
                }

                // CASE 2: skill_name dila thiyenawa
                const trimmedSkillName = skill_name.trim();

                const checkSkillByNameQuery = `
                    SELECT * FROM skills
                    WHERE LOWER(skill_name) = LOWER(?)
                    LIMIT 1
                `;

                db.query(checkSkillByNameQuery, [trimmedSkillName], (skillError, skillResult) => {
                    if (skillError) {
                        return res.status(500).json({
                            success: false,
                            message: "Skill lookup failed",
                            error: skillError.message
                        });
                    }

                    if (skillResult.length > 0) {
                        return insertMapping(skillResult[0].id);
                    }

                    const insertSkillQuery = `
                        INSERT INTO skills (skill_name)
                        VALUES (?)
                    `;

                    db.query(insertSkillQuery, [trimmedSkillName], (insertSkillError, insertSkillResult) => {
                        if (insertSkillError) {
                            return res.status(500).json({
                                success: false,
                                message: "Create skill failed",
                                error: insertSkillError.message
                            });
                        }

                        return insertMapping(insertSkillResult.insertId);
                    });
                });
            });
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Add job skill failed",
            error: error.message
        });
    }
};

// GET JOB SKILLS
const getJobSkills = (req, res) => {
    try {
        const jobId = req.params.jobId;

        const query = `
            SELECT
                jrs.id,
                jrs.job_id,
                jrs.skill_id,
                s.skill_name,
                jrs.is_mandatory,
                jrs.created_at,
                jrs.updated_at
            FROM job_required_skills jrs
            JOIN skills s ON jrs.skill_id = s.id
            WHERE jrs.job_id = ?
            ORDER BY jrs.id DESC
        `;

        db.query(query, [jobId], (err, result) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: "Fetch job skills failed",
                    error: err.message
                });
            }

            return res.status(200).json({
                success: true,
                skills: result
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Get job skills failed",
            error: error.message
        });
    }
};

// UPDATE SKILL
const updateJobSkill = (req, res) => {
    try {
        const userId = req.user.id;
        const { jobId, skillId } = req.params;
        const { is_mandatory } = req.body;

        if (is_mandatory === undefined) {
            return res.status(400).json({
                success: false,
                message: "is_mandatory is required"
            });
        }

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
                        message: "You are not allowed to update job skills"
                    });
                }

                const updateQuery = `
                    UPDATE job_required_skills
                    SET is_mandatory = ?
                    WHERE job_id = ? AND skill_id = ?
                `;

                db.query(updateQuery, [is_mandatory, jobId, skillId], (err, result) => {
                    if (err) {
                        return res.status(500).json({
                            success: false,
                            message: "Update job skill failed",
                            error: err.message
                        });
                    }

                    if (result.affectedRows === 0) {
                        return res.status(404).json({
                            success: false,
                            message: "Job skill not found"
                        });
                    }

                    return res.status(200).json({
                        success: true,
                        message: "Job skill updated successfully"
                    });
                });
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Update job skill failed",
            error: error.message
        });
    }
};

// DELETE SKILL
const deleteJobSkill = (req, res) => {
    try {
        const userId = req.user.id;
        const { jobId, skillId } = req.params;

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
                        message: "You are not allowed to delete job skills"
                    });
                }

                const deleteQuery = `
                    DELETE FROM job_required_skills
                    WHERE job_id = ? AND skill_id = ?
                `;

                db.query(deleteQuery, [jobId, skillId], (err, result) => {
                    if (err) {
                        return res.status(500).json({
                            success: false,
                            message: "Delete job skill failed",
                            error: err.message
                        });
                    }

                    if (result.affectedRows === 0) {
                        return res.status(404).json({
                            success: false,
                            message: "Job skill not found"
                        });
                    }

                    return res.status(200).json({
                        success: true,
                        message: "Job skill removed successfully"
                    });
                });
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Delete job skill failed",
            error: error.message
        });
    }
};

module.exports = {
    addJobSkill,
    getJobSkills,
    updateJobSkill,
    deleteJobSkill
};