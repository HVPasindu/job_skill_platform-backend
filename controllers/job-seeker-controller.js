const db = require("../db/db-connection");
const fs = require("fs");
const path = require("path");

const createProfile = (req, res) => {
    try {
        const userId = req.user.id;

        const {
            phone,
            city,
            country,
            bio,
            preferred_job_role,
            preferred_job_type,
            expected_salary,
            experience_level
        } = req.body;

        const profileImagePath = req.file ? req.file.path : null;

        const checkProfileQuery = `
            SELECT * FROM job_seeker_profiles
            WHERE user_id = ?
        `;

        db.query(checkProfileQuery, [userId], (checkError, checkResult) => {
            if (checkError) {
                return res.status(500).json({
                    success: false,
                    message: "Database error",
                    error: checkError.message
                });
            }

            if (checkResult.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: "Profile already exists"
                });
            }

            const profileCompleted =
                phone &&
                    city &&
                    country &&
                    preferred_job_role &&
                    preferred_job_type &&
                    experience_level
                    ? true
                    : false;

            const insertProfileQuery = `
                INSERT INTO job_seeker_profiles (
                    user_id,
                    phone,
                    profile_image_url,
                    city,
                    country,
                    bio,
                    preferred_job_role,
                    preferred_job_type,
                    expected_salary,
                    experience_level,
                    profile_completed
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            db.query(
                insertProfileQuery,
                [
                    userId,
                    phone || null,
                    profileImagePath,
                    city || null,
                    country || null,
                    bio || null,
                    preferred_job_role || null,
                    preferred_job_type || null,
                    expected_salary || null,
                    experience_level || null,
                    profileCompleted
                ],
                (insertError, insertResult) => {
                    if (insertError) {
                        return res.status(500).json({
                            success: false,
                            message: "Profile creation failed",
                            error: insertError.message
                        });
                    }

                    return res.status(201).json({
                        success: true,
                        message: "Profile created successfully",
                        profile_id: insertResult.insertId,
                        profile_image_url: profileImagePath
                    });
                }
            );
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Create profile failed",
            error: error.message
        });
    }
};

const getProfile = (req, res) => {
    try {
        const userId = req.user.id;

        const getProfileQuery = `
            SELECT 
                jsp.id,
                jsp.user_id,
                u.full_name,
                u.email,
                jsp.phone,
                jsp.profile_image_url,
                jsp.city,
                jsp.country,
                jsp.bio,
                jsp.preferred_job_role,
                jsp.preferred_job_type,
                jsp.expected_salary,
                jsp.experience_level,
                jsp.profile_completed,
                jsp.created_at,
                jsp.updated_at
            FROM job_seeker_profiles jsp
            JOIN users u ON jsp.user_id = u.id
            WHERE jsp.user_id = ?
        `;

        db.query(getProfileQuery, [userId], (error, result) => {
            if (error) {
                return res.status(500).json({
                    success: false,
                    message: "Database error",
                    error: error.message
                });
            }

            if (result.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Profile not found"
                });
            }

            return res.status(200).json({
                success: true,
                profile: result[0]
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Get profile failed",
            error: error.message
        });
    }
};

const updateProfile = (req, res) => {
    try {
        const userId = req.user.id;

        const {
            phone,
            city,
            country,
            bio,
            preferred_job_role,
            preferred_job_type,
            expected_salary,
            experience_level
        } = req.body;

        const checkProfileQuery = `
            SELECT * FROM job_seeker_profiles
            WHERE user_id = ?
        `;

        db.query(checkProfileQuery, [userId], (checkError, checkResult) => {
            if (checkError) {
                return res.status(500).json({
                    success: false,
                    message: "Database error",
                    error: checkError.message
                });
            }

            if (checkResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Profile not found"
                });
            }

            const existingProfile = checkResult[0];
            let profileImagePath = existingProfile.profile_image_url;

            // new image ekak upload una nam
            if (req.file) {
                profileImagePath = req.file.path;

                // old image eka thiyenawanam delete karanna
                if (existingProfile.profile_image_url) {
                    const oldImagePath = path.resolve(existingProfile.profile_image_url);

                    fs.unlink(oldImagePath, (unlinkError) => {
                        if (unlinkError) {
                            console.log("Old image delete failed:", unlinkError.message);
                        } else {
                            console.log("Old image deleted successfully");
                        }
                    });
                }
            }

            // 🟢 old values keep karana logic (IMPORTANT)
            const updatedPhone = phone || existingProfile.phone;
            const updatedCity = city || existingProfile.city;
            const updatedCountry = country || existingProfile.country;
            const updatedBio = bio || existingProfile.bio;
            const updatedJobRole = preferred_job_role || existingProfile.preferred_job_role;
            const updatedJobType = preferred_job_type || existingProfile.preferred_job_type;
            const updatedSalary = expected_salary || existingProfile.expected_salary;
            const updatedExperience = experience_level || existingProfile.experience_level;


            // 🟢 profile completed logic
            const profileCompleted =
                updatedPhone &&
                    updatedCity &&
                    updatedCountry &&
                    updatedJobRole &&
                    updatedJobType &&
                    updatedExperience
                    ? true
                    : false;

            const updateProfileQuery = `
                UPDATE job_seeker_profiles
                SET
                    phone = ?,
                    profile_image_url = ?,
                    city = ?,
                    country = ?,
                    bio = ?,
                    preferred_job_role = ?,
                    preferred_job_type = ?,
                    expected_salary = ?,
                    experience_level = ?,
                    profile_completed = ?
                WHERE user_id = ?
            `;

            db.query(
                updateProfileQuery,
                [
                    updatedPhone,
                    profileImagePath,
                    updatedCity,
                    updatedCountry,
                    updatedBio,
                    updatedJobRole,
                    updatedJobType,
                    updatedSalary,
                    updatedExperience,
                    profileCompleted,
                    userId
                ],
                (updateError) => {
                    if (updateError) {
                        return res.status(500).json({
                            success: false,
                            message: "Profile update failed",
                            error: updateError.message
                        });
                    }

                    return res.status(200).json({
                        success: true,
                        message: "Profile updated successfully",
                        profile_image_url: profileImagePath
                    });
                }
            );
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Update profile failed",
            error: error.message
        });
    }
};


//education---->

const addEducation = (req, res) => {
    try {
        const userId = req.user.id;

        const {
            qualification,
            institute_name,
            field_of_study,
            start_date,
            end_date,
            grade,
            description
        } = req.body;

        if (!qualification || !institute_name) {
            return res.status(400).json({
                success: false,
                message: "Qualification and institute name are required"
            });
        }

        const getProfileQuery = `
            SELECT id FROM job_seeker_profiles
            WHERE user_id = ?
        `;

        db.query(getProfileQuery, [userId], (profileError, profileResult) => {
            if (profileError) {
                return res.status(500).json({
                    success: false,
                    message: "Database error",
                    error: profileError.message
                });
            }

            if (profileResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Job seeker profile not found"
                });
            }

            const jobSeekerProfileId = profileResult[0].id;

            const insertEducationQuery = `
                INSERT INTO job_seeker_educations (
                    job_seeker_profile_id,
                    qualification,
                    institute_name,
                    field_of_study,
                    start_date,
                    end_date,
                    grade,
                    description
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;

            db.query(
                insertEducationQuery,
                [
                    jobSeekerProfileId,
                    qualification,
                    institute_name,
                    field_of_study || null,
                    start_date || null,
                    end_date || null,
                    grade || null,
                    description || null
                ],
                (insertError, insertResult) => {
                    if (insertError) {
                        return res.status(500).json({
                            success: false,
                            message: "Education add failed",
                            error: insertError.message
                        });
                    }

                    return res.status(201).json({
                        success: true,
                        message: "Education added successfully",
                        education_id: insertResult.insertId
                    });
                }
            );
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Add education failed",
            error: error.message
        });
    }
};

const getEducations = (req, res) => {
    try {
        const userId = req.user.id;

        const getProfileQuery = `
            SELECT id FROM job_seeker_profiles
            WHERE user_id = ?
        `;

        db.query(getProfileQuery, [userId], (profileError, profileResult) => {
            if (profileError) {
                return res.status(500).json({
                    success: false,
                    message: "Database error",
                    error: profileError.message
                });
            }

            if (profileResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Job seeker profile not found"
                });
            }

            const jobSeekerProfileId = profileResult[0].id;

            const getEducationQuery = `
                SELECT *
                FROM job_seeker_educations
                WHERE job_seeker_profile_id = ?
                ORDER BY id DESC
            `;

            db.query(getEducationQuery, [jobSeekerProfileId], (educationError, educationResult) => {
                if (educationError) {
                    return res.status(500).json({
                        success: false,
                        message: "Fetch education failed",
                        error: educationError.message
                    });
                }

                return res.status(200).json({
                    success: true,
                    educations: educationResult
                });
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Get educations failed",
            error: error.message
        });
    }
};

const updateEducation = (req, res) => {
    try {
        const userId = req.user.id;
        const educationId = req.params.id;

        const {
            qualification,
            institute_name,
            field_of_study,
            start_date,
            end_date,
            grade,
            description
        } = req.body;

        const getProfileQuery = `
            SELECT id FROM job_seeker_profiles
            WHERE user_id = ?
        `;

        db.query(getProfileQuery, [userId], (profileError, profileResult) => {
            if (profileError) {
                return res.status(500).json({
                    success: false,
                    message: "Database error",
                    error: profileError.message
                });
            }

            if (profileResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Job seeker profile not found"
                });
            }

            const jobSeekerProfileId = profileResult[0].id;

            const checkEducationQuery = `
                SELECT * FROM job_seeker_educations
                WHERE id = ? AND job_seeker_profile_id = ?
            `;

            db.query(checkEducationQuery, [educationId, jobSeekerProfileId], (checkError, checkResult) => {
                if (checkError) {
                    return res.status(500).json({
                        success: false,
                        message: "Education check failed",
                        error: checkError.message
                    });
                }

                if (checkResult.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message: "Education record not found"
                    });
                }

                const existingEducation = checkResult[0];

                const updatedQualification = qualification || existingEducation.qualification;
                const updatedInstituteName = institute_name || existingEducation.institute_name;
                const updatedFieldOfStudy = field_of_study || existingEducation.field_of_study;
                const updatedStartDate = start_date || existingEducation.start_date;
                const updatedEndDate = end_date || existingEducation.end_date;
                const updatedGrade = grade || existingEducation.grade;
                const updatedDescription = description || existingEducation.description;

                const updateEducationQuery = `
                    UPDATE job_seeker_educations
                    SET
                        qualification = ?,
                        institute_name = ?,
                        field_of_study = ?,
                        start_date = ?,
                        end_date = ?,
                        grade = ?,
                        description = ?
                    WHERE id = ? AND job_seeker_profile_id = ?
                `;

                db.query(
                    updateEducationQuery,
                    [
                        updatedQualification,
                        updatedInstituteName,
                        updatedFieldOfStudy,
                        updatedStartDate,
                        updatedEndDate,
                        updatedGrade,
                        updatedDescription,
                        educationId,
                        jobSeekerProfileId
                    ],
                    (updateError) => {
                        if (updateError) {
                            return res.status(500).json({
                                success: false,
                                message: "Education update failed",
                                error: updateError.message
                            });
                        }

                        return res.status(200).json({
                            success: true,
                            message: "Education updated successfully"
                        });
                    }
                );
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Update education failed",
            error: error.message
        });
    }
};


const deleteEducation = (req, res) => {
    try {
        const userId = req.user.id;
        const educationId = req.params.id;

        const getProfileQuery = `
            SELECT id FROM job_seeker_profiles
            WHERE user_id = ?
        `;

        db.query(getProfileQuery, [userId], (profileError, profileResult) => {
            if (profileError) {
                return res.status(500).json({
                    success: false,
                    message: "Database error",
                    error: profileError.message
                });
            }

            if (profileResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Job seeker profile not found"
                });
            }

            const jobSeekerProfileId = profileResult[0].id;

            const deleteEducationQuery = `
                DELETE FROM job_seeker_educations
                WHERE id = ? AND job_seeker_profile_id = ?
            `;

            db.query(deleteEducationQuery, [educationId, jobSeekerProfileId], (deleteError, deleteResult) => {
                if (deleteError) {
                    return res.status(500).json({
                        success: false,
                        message: "Education delete failed",
                        error: deleteError.message
                    });
                }

                if (deleteResult.affectedRows === 0) {
                    return res.status(404).json({
                        success: false,
                        message: "Education record not found"
                    });
                }

                return res.status(200).json({
                    success: true,
                    message: "Education deleted successfully"
                });
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Delete education failed",
            error: error.message
        });
    }
};


//Experience

const addExperience = (req, res) => {
    try {
        const userId = req.user.id;

        const {
            job_title,
            company_name,
            employment_type,
            start_date,
            end_date,
            is_current,
            description
        } = req.body;

        if (!job_title || !company_name || !start_date) {
            return res.status(400).json({
                success: false,
                message: "Job title, company name and start date are required"
            });
        }

        const getProfileQuery = `
            SELECT id FROM job_seeker_profiles WHERE user_id = ?
        `;

        db.query(getProfileQuery, [userId], (err, result) => {
            if (err) {
                return res.status(500).json({ success: false, message: err.message });
            }

            if (result.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Profile not found"
                });
            }

            const profileId = result[0].id;

            const insertQuery = `
                INSERT INTO job_seeker_experiences
                (job_seeker_profile_id, job_title, company_name, employment_type, start_date, end_date, is_current, description)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;

            db.query(
                insertQuery,
                [
                    profileId,
                    job_title,
                    company_name,
                    employment_type || null,
                    start_date,
                    end_date || null,
                    is_current ? true : false,
                    description || null
                ],
                (error, result) => {
                    if (error) {
                        return res.status(500).json({
                            success: false,
                            message: "Add experience failed",
                            error: error.message
                        });
                    }

                    return res.status(201).json({
                        success: true,
                        message: "Experience added successfully",
                        experience_id: result.insertId
                    });
                }
            );
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Add experience failed",
            error: error.message
        });
    }
};

const getExperiences = (req, res) => {
    try {
        const userId = req.user.id;

        const getProfileQuery = `
            SELECT id FROM job_seeker_profiles WHERE user_id = ?
        `;

        db.query(getProfileQuery, [userId], (err, result) => {
            if (err) {
                return res.status(500).json({ success: false, message: err.message });
            }

            const profileId = result[0].id;

            const query = `
                SELECT * FROM job_seeker_experiences
                WHERE job_seeker_profile_id = ?
                ORDER BY id DESC
            `;

            db.query(query, [profileId], (error, results) => {
                if (error) {
                    return res.status(500).json({
                        success: false,
                        message: "Fetch experience failed",
                        error: error.message
                    });
                }

                return res.status(200).json({
                    success: true,
                    experiences: results
                });
            });
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Get experience failed",
            error: error.message
        });
    }
};


const updateExperience = (req, res) => {
    try {
        const userId = req.user.id;
        const expId = req.params.id;

        const {
            job_title,
            company_name,
            employment_type,
            start_date,
            end_date,
            is_current,
            description
        } = req.body;

        const getProfileQuery = `SELECT id FROM job_seeker_profiles WHERE user_id = ?`;

        db.query(getProfileQuery, [userId], (err, result) => {
            if (err) return res.status(500).json({ success: false, message: err.message });

            const profileId = result[0].id;

            const checkQuery = `
                SELECT * FROM job_seeker_experiences
                WHERE id = ? AND job_seeker_profile_id = ?
            `;

            db.query(checkQuery, [expId, profileId], (err2, res2) => {
                if (res2.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message: "Experience not found"
                    });
                }

                const old = res2[0];

                const updateQuery = `
                    UPDATE job_seeker_experiences
                    SET 
                        job_title = ?, 
                        company_name = ?, 
                        employment_type = ?,
                        start_date = ?, 
                        end_date = ?, 
                        is_current = ?, 
                        description = ?
                    WHERE id = ? AND job_seeker_profile_id = ?
                `;

                db.query(
                    updateQuery,
                    [
                        job_title || old.job_title,
                        company_name || old.company_name,
                        employment_type || old.employment_type,
                        start_date || old.start_date,
                        end_date || old.end_date,
                        is_current !== undefined ? is_current : old.is_current,
                        description || old.description,
                        expId,
                        profileId
                    ],
                    () => {
                        return res.status(200).json({
                            success: true,
                            message: "Experience updated successfully"
                        });
                    }
                );
            });
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Update experience failed",
            error: error.message
        });
    }
};

const deleteExperience = (req, res) => {
    try {
        const userId = req.user.id;
        const expId = req.params.id;

        const getProfileQuery = `SELECT id FROM job_seeker_profiles WHERE user_id = ?`;

        db.query(getProfileQuery, [userId], (err, result) => {
            const profileId = result[0].id;

            const deleteQuery = `
                DELETE FROM job_seeker_experiences
                WHERE id = ? AND job_seeker_profile_id = ?
            `;

            db.query(deleteQuery, [expId, profileId], (error, result) => {
                if (result.affectedRows === 0) {
                    return res.status(404).json({
                        success: false,
                        message: "Experience not found"
                    });
                }

                return res.status(200).json({
                    success: true,
                    message: "Experience deleted successfully"
                });
            });
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Delete experience failed",
            error: error.message
        });
    }
};


//skill

const addSkill = (req, res) => {
    try {
        const userId = req.user.id;
        const { skill_name, proficiency_level, years_of_experience } = req.body;

        if (!skill_name) {
            return res.status(400).json({
                success: false,
                message: "Skill name is required"
            });
        }

        const trimmedSkill = skill_name.trim();

        const getProfileQuery = `
            SELECT id FROM job_seeker_profiles
            WHERE user_id = ?
        `;

        db.query(getProfileQuery, [userId], (profileError, profileResult) => {
            if (profileError) {
                return res.status(500).json({
                    success: false,
                    message: "Database error",
                    error: profileError.message
                });
            }

            if (profileResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Job seeker profile not found"
                });
            }

            const profileId = profileResult[0].id;

            const checkSkillQuery = `
                SELECT * FROM skills
                WHERE LOWER(skill_name) = LOWER(?)
            `;

            db.query(checkSkillQuery, [trimmedSkill], (skillError, skillResult) => {
                if (skillError) {
                    return res.status(500).json({
                        success: false,
                        message: "Skill check failed",
                        error: skillError.message
                    });
                }

                const insertIntoMapping = (skillId) => {
                    const insertMappingQuery = `
                        INSERT INTO job_seeker_skills (
                            job_seeker_profile_id,
                            skill_id,
                            proficiency_level,
                            years_of_experience
                        )
                        VALUES (?, ?, ?, ?)
                    `;

                    db.query(
                        insertMappingQuery,
                        [
                            profileId,
                            skillId,
                            proficiency_level || null,
                            years_of_experience || null
                        ],
                        (mappingError, mappingResult) => {
                            if (mappingError) {
                                if (mappingError.code === "ER_DUP_ENTRY") {
                                    return res.status(400).json({
                                        success: false,
                                        message: "Skill already added"
                                    });
                                }

                                return res.status(500).json({
                                    success: false,
                                    message: "Add skill failed",
                                    error: mappingError.message
                                });
                            }

                            return res.status(201).json({
                                success: true,
                                message: "Skill added successfully",
                                skill_mapping_id: mappingResult.insertId
                            });
                        }
                    );
                };

                if (skillResult.length > 0) {
                    const skillId = skillResult[0].id;
                    insertIntoMapping(skillId);
                } else {
                    const insertSkillQuery = `
                        INSERT INTO skills (skill_name)
                        VALUES (?)
                    `;

                    db.query(insertSkillQuery, [trimmedSkill], (insertSkillError, insertSkillResult) => {
                        if (insertSkillError) {
                            return res.status(500).json({
                                success: false,
                                message: "Create skill failed",
                                error: insertSkillError.message
                            });
                        }

                        const skillId = insertSkillResult.insertId;
                        insertIntoMapping(skillId);
                    });
                }
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Add skill failed",
            error: error.message
        });
    }
};

const getSkills = (req, res) => {
    try {
        const userId = req.user.id;

        const getProfileQuery = `
            SELECT id FROM job_seeker_profiles
            WHERE user_id = ?
        `;

        db.query(getProfileQuery, [userId], (profileError, profileResult) => {
            if (profileError) {
                return res.status(500).json({
                    success: false,
                    message: "Database error",
                    error: profileError.message
                });
            }

            if (profileResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Job seeker profile not found"
                });
            }

            const profileId = profileResult[0].id;

            const getSkillsQuery = `
                SELECT
                    jss.id,
                    jss.job_seeker_profile_id,
                    jss.skill_id,
                    s.skill_name,
                    jss.proficiency_level,
                    jss.years_of_experience,
                    jss.created_at,
                    jss.updated_at
                FROM job_seeker_skills jss
                JOIN skills s ON jss.skill_id = s.id
                WHERE jss.job_seeker_profile_id = ?
                ORDER BY jss.id DESC
            `;

            db.query(getSkillsQuery, [profileId], (skillsError, skillsResult) => {
                if (skillsError) {
                    return res.status(500).json({
                        success: false,
                        message: "Fetch skills failed",
                        error: skillsError.message
                    });
                }

                return res.status(200).json({
                    success: true,
                    skills: skillsResult
                });
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Get skills failed",
            error: error.message
        });
    }
};

const updateSkill = (req, res) => {
    try {
        const userId = req.user.id;
        const mappingId = req.params.id;

        const {
            skill_name,
            proficiency_level,
            years_of_experience
        } = req.body;

        const getProfileQuery = `
            SELECT id FROM job_seeker_profiles
            WHERE user_id = ?
        `;

        db.query(getProfileQuery, [userId], (profileError, profileResult) => {
            if (profileError) {
                return res.status(500).json({
                    success: false,
                    message: "Database error",
                    error: profileError.message
                });
            }

            if (profileResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Job seeker profile not found"
                });
            }

            const profileId = profileResult[0].id;

            const checkMappingQuery = `
                SELECT jss.*, s.skill_name
                FROM job_seeker_skills jss
                JOIN skills s ON jss.skill_id = s.id
                WHERE jss.id = ? AND jss.job_seeker_profile_id = ?
            `;

            db.query(checkMappingQuery, [mappingId, profileId], (checkError, checkResult) => {
                if (checkError) {
                    return res.status(500).json({
                        success: false,
                        message: "Skill record check failed",
                        error: checkError.message
                    });
                }

                if (checkResult.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message: "Skill record not found"
                    });
                }

                const existingSkill = checkResult[0];

                const finalSkillName = skill_name ? skill_name.trim() : existingSkill.skill_name;
                const finalProficiencyLevel =
                    proficiency_level !== undefined
                        ? proficiency_level
                        : existingSkill.proficiency_level;

                const finalYearsOfExperience =
                    years_of_experience !== undefined
                        ? years_of_experience
                        : existingSkill.years_of_experience;

                const findSkillQuery = `
                    SELECT * FROM skills
                    WHERE LOWER(skill_name) = LOWER(?)
                `;

                db.query(findSkillQuery, [finalSkillName], (skillError, skillResult) => {
                    if (skillError) {
                        return res.status(500).json({
                            success: false,
                            message: "Skill lookup failed",
                            error: skillError.message
                        });
                    }

                    const continueUpdate = (skillId) => {
                        const updateSkillQuery = `
                            UPDATE job_seeker_skills
                            SET
                                skill_id = ?,
                                proficiency_level = ?,
                                years_of_experience = ?
                            WHERE id = ? AND job_seeker_profile_id = ?
                        `;

                        db.query(
                            updateSkillQuery,
                            [
                                skillId,
                                finalProficiencyLevel || null,
                                finalYearsOfExperience || null,
                                mappingId,
                                profileId
                            ],
                            (updateError) => {
                                if (updateError) {
                                    if (updateError.code === "ER_DUP_ENTRY") {
                                        return res.status(400).json({
                                            success: false,
                                            message: "This skill is already added"
                                        });
                                    }

                                    return res.status(500).json({
                                        success: false,
                                        message: "Skill update failed",
                                        error: updateError.message
                                    });
                                }

                                return res.status(200).json({
                                    success: true,
                                    message: "Skill updated successfully"
                                });
                            }
                        );
                    };

                    if (skillResult.length > 0) {
                        const skillId = skillResult[0].id;
                        continueUpdate(skillId);
                    } else {
                        const insertSkillQuery = `
                            INSERT INTO skills (skill_name)
                            VALUES (?)
                        `;

                        db.query(insertSkillQuery, [finalSkillName], (insertError, insertResult) => {
                            if (insertError) {
                                return res.status(500).json({
                                    success: false,
                                    message: "Create skill failed",
                                    error: insertError.message
                                });
                            }

                            const skillId = insertResult.insertId;
                            continueUpdate(skillId);
                        });
                    }
                });
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Update skill failed",
            error: error.message
        });
    }
};


const deleteSkill = (req, res) => {
    try {
        const userId = req.user.id;
        const mappingId = req.params.id;

        const getProfileQuery = `
            SELECT id FROM job_seeker_profiles
            WHERE user_id = ?
        `;

        db.query(getProfileQuery, [userId], (profileError, profileResult) => {
            if (profileError) {
                return res.status(500).json({
                    success: false,
                    message: "Database error",
                    error: profileError.message
                });
            }

            if (profileResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Job seeker profile not found"
                });
            }

            const profileId = profileResult[0].id;

            const deleteSkillQuery = `
                DELETE FROM job_seeker_skills
                WHERE id = ? AND job_seeker_profile_id = ?
            `;

            db.query(deleteSkillQuery, [mappingId, profileId], (deleteError, deleteResult) => {
                if (deleteError) {
                    return res.status(500).json({
                        success: false,
                        message: "Delete skill failed",
                        error: deleteError.message
                    });
                }

                if (deleteResult.affectedRows === 0) {
                    return res.status(404).json({
                        success: false,
                        message: "Skill record not found"
                    });
                }

                return res.status(200).json({
                    success: true,
                    message: "Skill deleted successfully"
                });
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Delete skill failed",
            error: error.message
        });
    }
};


//resume

const uploadResumes = (req, res) => {
    try {
        const userId = req.user.id;
        const files = req.files;

        if (!files || files.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No resume files uploaded"
            });
        }

        const getProfileQuery = `
            SELECT id FROM job_seeker_profiles
            WHERE user_id = ?
        `;

        db.query(getProfileQuery, [userId], (profileError, profileResult) => {
            if (profileError) {
                return res.status(500).json({
                    success: false,
                    message: "Database error",
                    error: profileError.message
                });
            }

            if (profileResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Job seeker profile not found"
                });
            }

            const profileId = profileResult[0].id;

            const values = files.map((file) => {
                const fileUrl = `${req.protocol}://${req.get("host")}/${file.path.replace(/\\/g, "/")}`;

                return [
                    profileId,
                    file.filename,
                    fileUrl,
                    file.mimetype,
                    file.size,
                    false
                ];
            });

            const insertResumeQuery = `
                INSERT INTO resumes
                (
                    job_seeker_profile_id,
                    file_name,
                    file_url,
                    file_type,
                    file_size,
                    is_primary
                )
                VALUES ?
            `;

            db.query(insertResumeQuery, [values], (insertError, insertResult) => {
                if (insertError) {
                    return res.status(500).json({
                        success: false,
                        message: "Resume upload failed",
                        error: insertError.message
                    });
                }

                return res.status(201).json({
                    success: true,
                    message: "Resumes uploaded successfully",
                    uploaded_count: insertResult.affectedRows
                });
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Upload resumes failed",
            error: error.message
        });
    }
};

const getResumes = (req, res) => {
    try {
        const userId = req.user.id;

        const getProfileQuery = `
            SELECT id FROM job_seeker_profiles
            WHERE user_id = ?
        `;

        db.query(getProfileQuery, [userId], (profileError, profileResult) => {
            if (profileError) {
                return res.status(500).json({
                    success: false,
                    message: "Database error",
                    error: profileError.message
                });
            }

            if (profileResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Job seeker profile not found"
                });
            }

            const profileId = profileResult[0].id;

            const getResumeQuery = `
                SELECT *
                FROM resumes
                WHERE job_seeker_profile_id = ?
                ORDER BY is_primary DESC, id DESC
            `;

            db.query(getResumeQuery, [profileId], (resumeError, resumeResult) => {
                if (resumeError) {
                    return res.status(500).json({
                        success: false,
                        message: "Fetch resumes failed",
                        error: resumeError.message
                    });
                }

                return res.status(200).json({
                    success: true,
                    resumes: resumeResult
                });
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Get resumes failed",
            error: error.message
        });
    }
};

const setPrimaryResume = (req, res) => {
    try {
        const userId = req.user.id;
        const resumeId = req.params.id;

        const getProfileQuery = `
            SELECT id FROM job_seeker_profiles
            WHERE user_id = ?
        `;

        db.query(getProfileQuery, [userId], (profileError, profileResult) => {
            if (profileError) {
                return res.status(500).json({
                    success: false,
                    message: "Database error",
                    error: profileError.message
                });
            }

            if (profileResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Job seeker profile not found"
                });
            }

            const profileId = profileResult[0].id;

            const checkResumeQuery = `
                SELECT * FROM resumes
                WHERE id = ? AND job_seeker_profile_id = ?
            `;

            db.query(checkResumeQuery, [resumeId, profileId], (checkError, checkResult) => {
                if (checkError) {
                    return res.status(500).json({
                        success: false,
                        message: "Resume check failed",
                        error: checkError.message
                    });
                }

                if (checkResult.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message: "Resume not found"
                    });
                }

                const resetPrimaryQuery = `
                    UPDATE resumes
                    SET is_primary = false
                    WHERE job_seeker_profile_id = ?
                `;

                db.query(resetPrimaryQuery, [profileId], (resetError) => {
                    if (resetError) {
                        return res.status(500).json({
                            success: false,
                            message: "Reset primary resume failed",
                            error: resetError.message
                        });
                    }

                    const setPrimaryQuery = `
                        UPDATE resumes
                        SET is_primary = true
                        WHERE id = ? AND job_seeker_profile_id = ?
                    `;

                    db.query(setPrimaryQuery, [resumeId, profileId], (setError) => {
                        if (setError) {
                            return res.status(500).json({
                                success: false,
                                message: "Set primary resume failed",
                                error: setError.message
                            });
                        }

                        return res.status(200).json({
                            success: true,
                            message: "Primary resume updated successfully"
                        });
                    });
                });
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Set primary resume failed",
            error: error.message
        });
    }
};

const updateResume = (req, res) => {
    try {
        const userId = req.user.id;
        const resumeId = req.params.id;
        const file = req.file;

        if (!file) {
            return res.status(400).json({
                success: false,
                message: "No resume file uploaded"
            });
        }

        const getProfileQuery = `
            SELECT id FROM job_seeker_profiles
            WHERE user_id = ?
        `;

        db.query(getProfileQuery, [userId], (profileError, profileResult) => {
            if (profileError) {
                return res.status(500).json({
                    success: false,
                    message: "Database error",
                    error: profileError.message
                });
            }

            if (profileResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Job seeker profile not found"
                });
            }

            const profileId = profileResult[0].id;

            const getResumeQuery = `
                SELECT * FROM resumes
                WHERE id = ? AND job_seeker_profile_id = ?
            `;

            db.query(getResumeQuery, [resumeId, profileId], (resumeError, resumeResult) => {
                if (resumeError) {
                    return res.status(500).json({
                        success: false,
                        message: "Resume fetch failed",
                        error: resumeError.message
                    });
                }

                if (resumeResult.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message: "Resume not found"
                    });
                }

                const existingResume = resumeResult[0];
                const oldFileUrl = existingResume.file_url;

                const fileUrl = `${req.protocol}://${req.get("host")}/${file.path.replace(/\\/g, "/")}`;

                const updateResumeQuery = `
                    UPDATE resumes
                    SET
                        file_name = ?,
                        file_url = ?,
                        file_type = ?,
                        file_size = ?
                    WHERE id = ? AND job_seeker_profile_id = ?
                `;

                db.query(
                    updateResumeQuery,
                    [
                        file.filename,
                        fileUrl,
                        file.mimetype,
                        file.size,
                        resumeId,
                        profileId
                    ],
                    (updateError) => {
                        if (updateError) {
                            return res.status(500).json({
                                success: false,
                                message: "Resume update failed",
                                error: updateError.message
                            });
                        }

                        let oldFilePath = null;

                        try {
                            const urlObj = new URL(oldFileUrl);
                            oldFilePath = decodeURIComponent(urlObj.pathname.substring(1));
                        } catch {
                            oldFilePath = oldFileUrl;
                        }

                        if (oldFilePath && fs.existsSync(oldFilePath)) {
                            fs.unlinkSync(oldFilePath);
                        }

                        return res.status(200).json({
                            success: true,
                            message: "Resume updated successfully"
                        });
                    }
                );
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Update resume failed",
            error: error.message
        });
    }
};

const deleteResume = (req, res) => {
    try {
        const userId = req.user.id;
        const resumeId = req.params.id;

        const getProfileQuery = `
            SELECT id FROM job_seeker_profiles
            WHERE user_id = ?
        `;

        db.query(getProfileQuery, [userId], (profileError, profileResult) => {
            if (profileError) {
                return res.status(500).json({
                    success: false,
                    message: "Database error",
                    error: profileError.message
                });
            }

            if (profileResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Job seeker profile not found"
                });
            }

            const profileId = profileResult[0].id;

            const getResumeQuery = `
                SELECT *
                FROM resumes
                WHERE id = ? AND job_seeker_profile_id = ?
            `;

            db.query(getResumeQuery, [resumeId, profileId], (resumeError, resumeResult) => {
                if (resumeError) {
                    return res.status(500).json({
                        success: false,
                        message: "Resume fetch failed",
                        error: resumeError.message
                    });
                }

                if (resumeResult.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message: "Resume not found"
                    });
                }

                const resume = resumeResult[0];
                let filePath = null;

                try {
                    const urlObj = new URL(resume.file_url);
                    filePath = decodeURIComponent(urlObj.pathname.substring(1));
                } catch {
                    filePath = resume.file_url;
                }

                const deleteResumeQuery = `
                    DELETE FROM resumes
                    WHERE id = ? AND job_seeker_profile_id = ?
                `;

                db.query(deleteResumeQuery, [resumeId, profileId], (deleteError, deleteResult) => {
                    if (deleteError) {
                        return res.status(500).json({
                            success: false,
                            message: "Resume delete failed",
                            error: deleteError.message
                        });
                    }

                    if (deleteResult.affectedRows === 0) {
                        return res.status(404).json({
                            success: false,
                            message: "Resume not found"
                        });
                    }

                    if (filePath && fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }

                    return res.status(200).json({
                        success: true,
                        message: "Resume deleted successfully"
                    });
                });
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Delete resume failed",
            error: error.message
        });
    }
};


module.exports = {
    createProfile,
    getProfile,
    updateProfile,
    addEducation,
    getEducations,
    updateEducation,
    deleteEducation,
    addExperience,
    getExperiences,
    updateExperience,
    deleteExperience,
    addSkill,
    getSkills,
    updateSkill,
    deleteSkill,
    uploadResumes,
    getResumes,
    setPrimaryResume,
    updateResume,
    deleteResume
};