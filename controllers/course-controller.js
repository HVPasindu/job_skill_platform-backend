const db = require("../db/db-connection");

// CREATE COURSE
const createCourse = (req, res) => {
    try {
        const userId = req.user.id;

        const {
            course_category_id,
            title,
            short_description,
            full_description,
            level,
            duration_text,
            course_type,
            status
        } = req.body;

        if (!title || !short_description) {
            return res.status(400).json({
                success: false,
                message: "title and short_description are required"
            });
        }

        const trimmedTitle = title.trim();

        const getTrainerQuery = `
            SELECT * FROM trainer_profiles
            WHERE user_id = ?
            LIMIT 1
        `;

        db.query(getTrainerQuery, [userId], (trainerErr, trainerRes) => {
            if (trainerErr) {
                return res.status(500).json({
                    success: false,
                    message: "Trainer profile fetch failed",
                    error: trainerErr.message
                });
            }

            if (trainerRes.length === 0) {
                return res.status(403).json({
                    success: false,
                    message: "Only trainers can create courses"
                });
            }

            const trainerProfileId = trainerRes[0].id;

            const checkDuplicateQuery = `
                SELECT * FROM courses
                WHERE trainer_profile_id = ?
                  AND LOWER(title) = LOWER(?)
                LIMIT 1
            `;

            db.query(checkDuplicateQuery, [trainerProfileId, trimmedTitle], (checkErr, checkRes) => {
                if (checkErr) {
                    return res.status(500).json({
                        success: false,
                        message: "Course duplicate check failed",
                        error: checkErr.message
                    });
                }

                if (checkRes.length > 0) {
                    return res.status(400).json({
                        success: false,
                        message: "You have already created a course with this title"
                    });
                }

                const thumbnailUrl = req.file
                    ? `${req.protocol}://${req.get("host")}/${req.file.path.replace(/\\/g, "/")}`
                    : null;

                const continueInsert = () => {
                    const insertQuery = `
                        INSERT INTO courses (
                            trainer_profile_id,
                            course_category_id,
                            title,
                            short_description,
                            full_description,
                            thumbnail_url,
                            level,
                            duration_text,
                            course_type,
                            status
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `;

                    db.query(
                        insertQuery,
                        [
                            trainerProfileId,
                            course_category_id || null,
                            trimmedTitle,
                            short_description,
                            full_description || null,
                            thumbnailUrl,
                            level || null,
                            duration_text || null,
                            course_type || "recorded",
                            status || "published"
                        ],
                        (err, result) => {
                            if (err) {
                                return res.status(500).json({
                                    success: false,
                                    message: "Course create failed",
                                    error: err.message
                                });
                            }

                            return res.status(201).json({
                                success: true,
                                message: "Course created successfully",
                                course_id: result.insertId
                            });
                        }
                    );
                };

                if (!course_category_id) {
                    return continueInsert();
                }

                const checkCategoryQuery = `
                    SELECT * FROM course_categories
                    WHERE id = ?
                    LIMIT 1
                `;

                db.query(checkCategoryQuery, [course_category_id], (categoryErr, categoryRes) => {
                    if (categoryErr) {
                        return res.status(500).json({
                            success: false,
                            message: "Course category check failed",
                            error: categoryErr.message
                        });
                    }

                    if (categoryRes.length === 0) {
                        return res.status(404).json({
                            success: false,
                            message: "Course category not found"
                        });
                    }

                    return continueInsert();
                });
            });
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Create course failed",
            error: error.message
        });
    }
};

const getMyCourses = (req, res) => {
    const userId = req.user.id;

    const query = `
        SELECT c.*
        FROM courses c
        JOIN trainer_profiles tp ON c.trainer_profile_id = tp.id
        WHERE tp.user_id = ?
        ORDER BY c.created_at DESC
    `;

    db.query(query, [userId], (err, result) => {
        if (err) return res.status(500).json({ success: false, error: err.message });

        res.json({
            success: true,
            courses: result
        });
    });
};

const getSingleCourse = (req, res) => {
    const courseId = req.params.id;

    const query = `
        SELECT c.*, cc.category_name
        FROM courses c
        LEFT JOIN course_categories cc ON c.course_category_id = cc.id
        WHERE c.id = ?
    `;

    db.query(query, [courseId], (err, result) => {
        if (err) return res.status(500).json({ success: false, error: err.message });

        if (result.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Course not found"
            });
        }

        res.json({
            success: true,
            course: result[0]
        });
    });
};

const fs = require("fs");

const updateCourse = (req, res) => {
    try {
        const userId = req.user.id;
        const courseId = req.params.id;

        const {
            course_category_id,
            title,
            short_description,
            full_description,
            level,
            duration_text,
            course_type,
            status
        } = req.body;

        const getCourseQuery = `
            SELECT c.*, tp.user_id
            FROM courses c
            JOIN trainer_profiles tp ON c.trainer_profile_id = tp.id
            WHERE c.id = ?
            LIMIT 1
        `;

        db.query(getCourseQuery, [courseId], (fetchError, fetchResult) => {
            if (fetchError) {
                return res.status(500).json({
                    success: false,
                    message: "Course fetch failed",
                    error: fetchError.message
                });
            }

            if (fetchResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Course not found"
                });
            }

            const course = fetchResult[0];

            if (Number(course.user_id) !== Number(userId)) {
                return res.status(403).json({
                    success: false,
                    message: "You are not allowed to update this course"
                });
            }

            let updatedThumbnailUrl = course.thumbnail_url;

            if (req.file) {
                updatedThumbnailUrl = `${req.protocol}://${req.get("host")}/${req.file.path.replace(/\\/g, "/")}`;

                if (course.thumbnail_url) {
                    try {
                        const oldUrl = new URL(course.thumbnail_url);
                        const oldFilePath = decodeURIComponent(oldUrl.pathname.substring(1));

                        if (fs.existsSync(oldFilePath)) {
                            fs.unlinkSync(oldFilePath);
                        }
                    } catch (error) {
                        console.log("Old course thumbnail delete failed:", error.message);
                    }
                }
            }

            const updatedCourseCategoryId =
                course_category_id !== undefined ? course_category_id : course.course_category_id;

            const updatedTitle =
                title !== undefined ? title : course.title;

            const updatedShortDescription =
                short_description !== undefined ? short_description : course.short_description;

            const updatedFullDescription =
                full_description !== undefined ? full_description : course.full_description;

            const updatedLevel =
                level !== undefined ? level : course.level;

            const updatedDurationText =
                duration_text !== undefined ? duration_text : course.duration_text;

            const updatedCourseType =
                course_type !== undefined ? course_type : course.course_type;

            const updatedStatus =
                status !== undefined ? status : course.status;

            const continueUpdate = () => {
                const updateQuery = `
                    UPDATE courses
                    SET
                        course_category_id = ?,
                        title = ?,
                        short_description = ?,
                        full_description = ?,
                        thumbnail_url = ?,
                        level = ?,
                        duration_text = ?,
                        course_type = ?,
                        status = ?
                    WHERE id = ?
                `;

                db.query(
                    updateQuery,
                    [
                        updatedCourseCategoryId,
                        updatedTitle,
                        updatedShortDescription,
                        updatedFullDescription,
                        updatedThumbnailUrl,
                        updatedLevel,
                        updatedDurationText,
                        updatedCourseType,
                        updatedStatus,
                        courseId
                    ],
                    (updateError) => {
                        if (updateError) {
                            return res.status(500).json({
                                success: false,
                                message: "Course update failed",
                                error: updateError.message
                            });
                        }

                        return res.status(200).json({
                            success: true,
                            message: "Course updated successfully",
                            thumbnail_url: updatedThumbnailUrl
                        });
                    }
                );
            };

            if (
                updatedCourseCategoryId === undefined ||
                updatedCourseCategoryId === null ||
                updatedCourseCategoryId === ""
            ) {
                return continueUpdate();
            }

            const checkCategoryQuery = `
                SELECT * FROM course_categories
                WHERE id = ?
                LIMIT 1
            `;

            db.query(checkCategoryQuery, [updatedCourseCategoryId], (categoryError, categoryResult) => {
                if (categoryError) {
                    return res.status(500).json({
                        success: false,
                        message: "Course category check failed",
                        error: categoryError.message
                    });
                }

                if (categoryResult.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message: "Course category not found"
                    });
                }

                return continueUpdate();
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Update course failed",
            error: error.message
        });
    }
};


const deleteCourse = (req, res) => {
    const userId = req.user.id;
    const courseId = req.params.id;

    const query = `
        DELETE c FROM courses c
        JOIN trainer_profiles tp ON c.trainer_profile_id = tp.id
        WHERE c.id = ? AND tp.user_id = ?
    `;

    db.query(query, [courseId, userId], (err, result) => {
        if (err) return res.status(500).json({ success: false, error: err.message });

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Course not found or not allowed"
            });
        }

        res.json({
            success: true,
            message: "Course deleted"
        });
    });
};


module.exports = {
    createCourse,
    getMyCourses,
    getSingleCourse,
    updateCourse,
    deleteCourse
};