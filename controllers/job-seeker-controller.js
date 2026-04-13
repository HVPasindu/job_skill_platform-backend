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

module.exports = {
    createProfile,
    getProfile,
    updateProfile
};