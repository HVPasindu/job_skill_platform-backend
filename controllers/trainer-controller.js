const db = require("../db/db-connection");
const fs = require("fs");
const path = require("path");

// CREATE TRAINER PROFILE
const createTrainerProfile = (req, res) => {
    try {
        const userId = req.user.id;

        const {
            phone,
            specialization,
            bio,
            years_of_experience,
            qualification,
            website_url
        } = req.body;

        const profileImageUrl = req.file
            ? `${req.protocol}://${req.get("host")}/${req.file.path.replace(/\\/g, "/")}`
            : null;

        const checkQuery = `
            SELECT * FROM trainer_profiles
            WHERE user_id = ?
            LIMIT 1
        `;

        db.query(checkQuery, [userId], (checkErr, checkRes) => {
            if (checkErr) {
                return res.status(500).json({
                    success: false,
                    message: "Trainer profile check failed",
                    error: checkErr.message
                });
            }

            if (checkRes.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: "Trainer profile already exists"
                });
            }

            const insertQuery = `
                INSERT INTO trainer_profiles (
                    user_id,
                    phone,
                    profile_image_url,
                    specialization,
                    bio,
                    years_of_experience,
                    qualification,
                    website_url
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;

            db.query(
                insertQuery,
                [
                    userId,
                    phone || null,
                    profileImageUrl,
                    specialization || null,
                    bio || null,
                    years_of_experience || null,
                    qualification || null,
                    website_url || null
                ],
                (err, result) => {
                    if (err) {
                        return res.status(500).json({
                            success: false,
                            message: "Trainer profile create failed",
                            error: err.message
                        });
                    }

                    return res.status(201).json({
                        success: true,
                        message: "Trainer profile created successfully",
                        profile_id: result.insertId,
                        profile_image_url: profileImageUrl
                    });
                }
            );
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Create trainer profile failed",
            error: error.message
        });
    }
};

// GET MY TRAINER PROFILE
const getMyTrainerProfile = (req, res) => {
    try {
        const userId = req.user.id;

        const query = `
            SELECT
                tp.id,
                tp.user_id,
                u.full_name,
                u.email,
                tp.phone,
                tp.profile_image_url,
                tp.specialization,
                tp.bio,
                tp.years_of_experience,
                tp.qualification,
                tp.website_url,
                tp.created_at,
                tp.updated_at
            FROM trainer_profiles tp
            JOIN users u ON tp.user_id = u.id
            WHERE tp.user_id = ?
            LIMIT 1
        `;

        db.query(query, [userId], (err, result) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: "Fetch trainer profile failed",
                    error: err.message
                });
            }

            if (result.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Trainer profile not found"
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
            message: "Get trainer profile failed",
            error: error.message
        });
    }
};

// UPDATE TRAINER PROFILE
const updateTrainerProfile = (req, res) => {
    try {
        const userId = req.user.id;

        const {
            phone,
            specialization,
            bio,
            years_of_experience,
            qualification,
            website_url
        } = req.body;

        const checkProfileQuery = `
            SELECT * FROM trainer_profiles
            WHERE user_id = ?
            LIMIT 1
        `;

        db.query(checkProfileQuery, [userId], (checkError, checkResult) => {
            if (checkError) {
                return res.status(500).json({
                    success: false,
                    message: "Trainer profile check failed",
                    error: checkError.message
                });
            }

            if (checkResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Trainer profile not found"
                });
            }

            const existingProfile = checkResult[0];
            let updatedProfileImageUrl = existingProfile.profile_image_url;

            if (req.file) {
                updatedProfileImageUrl = `${req.protocol}://${req.get("host")}/${req.file.path.replace(/\\/g, "/")}`;

                if (existingProfile.profile_image_url) {
                    try {
                        const oldUrl = new URL(existingProfile.profile_image_url);
                        const oldImagePath = decodeURIComponent(oldUrl.pathname.substring(1));

                        if (fs.existsSync(oldImagePath)) {
                            fs.unlinkSync(oldImagePath);
                        }
                    } catch (error) {
                        console.log("Old trainer profile image delete failed:", error.message);
                    }
                }
            }

            const updatedPhone =
                phone !== undefined ? phone : existingProfile.phone;

            const updatedSpecialization =
                specialization !== undefined ? specialization : existingProfile.specialization;

            const updatedBio =
                bio !== undefined ? bio : existingProfile.bio;

            const updatedYearsOfExperience =
                years_of_experience !== undefined ? years_of_experience : existingProfile.years_of_experience;

            const updatedQualification =
                qualification !== undefined ? qualification : existingProfile.qualification;

            const updatedWebsiteUrl =
                website_url !== undefined ? website_url : existingProfile.website_url;

            const updateQuery = `
                UPDATE trainer_profiles
                SET
                    phone = ?,
                    profile_image_url = ?,
                    specialization = ?,
                    bio = ?,
                    years_of_experience = ?,
                    qualification = ?,
                    website_url = ?
                WHERE user_id = ?
            `;

            db.query(
                updateQuery,
                [
                    updatedPhone,
                    updatedProfileImageUrl,
                    updatedSpecialization,
                    updatedBio,
                    updatedYearsOfExperience,
                    updatedQualification,
                    updatedWebsiteUrl,
                    userId
                ],
                (updateError) => {
                    if (updateError) {
                        return res.status(500).json({
                            success: false,
                            message: "Trainer profile update failed",
                            error: updateError.message
                        });
                    }

                    return res.status(200).json({
                        success: true,
                        message: "Trainer profile updated successfully",
                        profile_image_url: updatedProfileImageUrl
                    });
                }
            );
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Update trainer profile failed",
            error: error.message
        });
    }
};

module.exports = {
    createTrainerProfile,
    getMyTrainerProfile,
    updateTrainerProfile
};