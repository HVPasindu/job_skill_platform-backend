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
    deleteExperience
};