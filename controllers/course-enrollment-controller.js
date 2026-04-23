const db = require("../db/db-connection");

// ENROLL IN COURSE
const enrollInCourse = (req, res) => {
    try {
        const userId = req.user.id;
        const courseId = req.params.courseId;

        const getJobSeekerProfileQuery = `
            SELECT * FROM job_seeker_profiles
            WHERE user_id = ?
            LIMIT 1
        `;

        db.query(getJobSeekerProfileQuery, [userId], (profileError, profileResult) => {
            if (profileError) {
                return res.status(500).json({
                    success: false,
                    message: "Job seeker profile fetch failed",
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

            const getCourseQuery = `
                SELECT * FROM courses
                WHERE id = ?
                LIMIT 1
            `;

            db.query(getCourseQuery, [courseId], (courseError, courseResult) => {
                if (courseError) {
                    return res.status(500).json({
                        success: false,
                        message: "Course fetch failed",
                        error: courseError.message
                    });
                }

                if (courseResult.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message: "Course not found"
                    });
                }

                const course = courseResult[0];

                if (course.status !== "published") {
                    return res.status(400).json({
                        success: false,
                        message: "This course is not available for enrollment"
                    });
                }

                const insertQuery = `
                    INSERT INTO course_enrollments (
                        course_id,
                        job_seeker_profile_id,
                        enrollment_status,
                        progress_percentage
                    )
                    VALUES (?, ?, ?, ?)
                `;

                db.query(
                    insertQuery,
                    [
                        courseId,
                        profile.id,
                        "active",
                        0.00
                    ],
                    (insertError, insertResult) => {
                        if (insertError) {
                            if (insertError.code === "ER_DUP_ENTRY") {
                                return res.status(400).json({
                                    success: false,
                                    message: "You are already enrolled in this course"
                                });
                            }

                            return res.status(500).json({
                                success: false,
                                message: "Course enrollment failed",
                                error: insertError.message
                            });
                        }

                        return res.status(201).json({
                            success: true,
                            message: "Enrolled in course successfully",
                            enrollment_id: insertResult.insertId
                        });
                    }
                );
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Enroll in course failed",
            error: error.message
        });
    }
};

// GET MY ENROLLED COURSES
const getMyEnrollments = (req, res) => {
    try {
        const userId = req.user.id;
        const { status } = req.query;

        const getJobSeekerProfileQuery = `
            SELECT * FROM job_seeker_profiles
            WHERE user_id = ?
            LIMIT 1
        `;

        db.query(getJobSeekerProfileQuery, [userId], (profileError, profileResult) => {
            if (profileError) {
                return res.status(500).json({
                    success: false,
                    message: "Job seeker profile fetch failed",
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

            let query = `
                SELECT
                    ce.*,
                    c.title,
                    c.short_description,
                    c.thumbnail_url,
                    c.level,
                    c.duration_text,
                    c.course_type,
                    tp.id AS trainer_profile_id,
                    u.full_name AS trainer_name
                FROM course_enrollments ce
                JOIN courses c ON ce.course_id = c.id
                JOIN trainer_profiles tp ON c.trainer_profile_id = tp.id
                JOIN users u ON tp.user_id = u.id
                WHERE ce.job_seeker_profile_id = ?
            `;

            const params = [profile.id];

            if (status) {
                query += ` AND ce.enrollment_status = ? `;
                params.push(status);
            }

            query += ` ORDER BY ce.id DESC `;

            db.query(query, params, (error, result) => {
                if (error) {
                    return res.status(500).json({
                        success: false,
                        message: "Fetch enrollments failed",
                        error: error.message
                    });
                }

                return res.status(200).json({
                    success: true,
                    enrollments: result
                });
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Get my enrollments failed",
            error: error.message
        });
    }
};

// GET SINGLE MY ENROLLMENT
const getSingleEnrollment = (req, res) => {
    try {
        const userId = req.user.id;
        const enrollmentId = req.params.id;

        const getJobSeekerProfileQuery = `
            SELECT * FROM job_seeker_profiles
            WHERE user_id = ?
            LIMIT 1
        `;

        db.query(getJobSeekerProfileQuery, [userId], (profileError, profileResult) => {
            if (profileError) {
                return res.status(500).json({
                    success: false,
                    message: "Job seeker profile fetch failed",
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

            const query = `
                SELECT
                    ce.*,
                    c.title,
                    c.short_description,
                    c.full_description,
                    c.thumbnail_url,
                    c.level,
                    c.duration_text,
                    c.course_type,
                    tp.id AS trainer_profile_id,
                    u.full_name AS trainer_name
                FROM course_enrollments ce
                JOIN courses c ON ce.course_id = c.id
                JOIN trainer_profiles tp ON c.trainer_profile_id = tp.id
                JOIN users u ON tp.user_id = u.id
                WHERE ce.id = ? AND ce.job_seeker_profile_id = ?
                LIMIT 1
            `;

            db.query(query, [enrollmentId, profile.id], (error, result) => {
                if (error) {
                    return res.status(500).json({
                        success: false,
                        message: "Fetch enrollment failed",
                        error: error.message
                    });
                }

                if (result.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message: "Enrollment not found"
                    });
                }

                return res.status(200).json({
                    success: true,
                    enrollment: result[0]
                });
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Get single enrollment failed",
            error: error.message
        });
    }
};

// CANCEL MY ENROLLMENT
const cancelEnrollment = (req, res) => {
    try {
        const userId = req.user.id;
        const enrollmentId = req.params.id;

        const getJobSeekerProfileQuery = `
            SELECT * FROM job_seeker_profiles
            WHERE user_id = ?
            LIMIT 1
        `;

        db.query(getJobSeekerProfileQuery, [userId], (profileError, profileResult) => {
            if (profileError) {
                return res.status(500).json({
                    success: false,
                    message: "Job seeker profile fetch failed",
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

            const getEnrollmentQuery = `
                SELECT * FROM course_enrollments
                WHERE id = ? AND job_seeker_profile_id = ?
                LIMIT 1
            `;

            db.query(getEnrollmentQuery, [enrollmentId, profile.id], (enrollError, enrollResult) => {
                if (enrollError) {
                    return res.status(500).json({
                        success: false,
                        message: "Enrollment fetch failed",
                        error: enrollError.message
                    });
                }

                if (enrollResult.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message: "Enrollment not found"
                    });
                }

                const enrollment = enrollResult[0];

                if (enrollment.enrollment_status === "cancelled") {
                    return res.status(400).json({
                        success: false,
                        message: "Enrollment already cancelled"
                    });
                }

                const updateQuery = `
                    UPDATE course_enrollments
                    SET enrollment_status = ?
                    WHERE id = ? AND job_seeker_profile_id = ?
                `;

                db.query(updateQuery, ["cancelled", enrollmentId, profile.id], (updateError) => {
                    if (updateError) {
                        return res.status(500).json({
                            success: false,
                            message: "Enrollment cancel failed",
                            error: updateError.message
                        });
                    }

                    return res.status(200).json({
                        success: true,
                        message: "Enrollment cancelled successfully"
                    });
                });
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Cancel enrollment failed",
            error: error.message
        });
    }
};

// TRAINER - GET ENROLLMENTS FOR MY COURSE
const getCourseEnrollmentsForTrainer = (req, res) => {
    try {
        const userId = req.user.id;
        const courseId = req.params.courseId;
        const { status } = req.query;

        const getCourseQuery = `
            SELECT c.*, tp.user_id
            FROM courses c
            JOIN trainer_profiles tp ON c.trainer_profile_id = tp.id
            WHERE c.id = ?
            LIMIT 1
        `;

        db.query(getCourseQuery, [courseId], (courseError, courseResult) => {
            if (courseError) {
                return res.status(500).json({
                    success: false,
                    message: "Course fetch failed",
                    error: courseError.message
                });
            }

            if (courseResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Course not found"
                });
            }

            const course = courseResult[0];

            if (Number(course.user_id) !== Number(userId)) {
                return res.status(403).json({
                    success: false,
                    message: "You are not allowed to view enrollments for this course"
                });
            }

            let query = `
                SELECT
                    ce.*,
                    jsp.id AS job_seeker_profile_id,
                    u.full_name,
                    u.email,
                    jsp.phone,
                    jsp.city,
                    jsp.country
                FROM course_enrollments ce
                JOIN job_seeker_profiles jsp ON ce.job_seeker_profile_id = jsp.id
                JOIN users u ON jsp.user_id = u.id
                WHERE ce.course_id = ?
            `;

            const params = [courseId];

            if (status) {
                query += ` AND ce.enrollment_status = ? `;
                params.push(status);
            }

            query += ` ORDER BY ce.id DESC `;

            db.query(query, params, (error, result) => {
                if (error) {
                    return res.status(500).json({
                        success: false,
                        message: "Fetch course enrollments failed",
                        error: error.message
                    });
                }

                return res.status(200).json({
                    success: true,
                    enrollments: result
                });
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Get course enrollments failed",
            error: error.message
        });
    }
};

// TRAINER - MARK ENROLLMENT COMPLETED
const markEnrollmentCompleted = (req, res) => {
    try {
        const userId = req.user.id;
        const enrollmentId = req.params.id;

        const getEnrollmentQuery = `
            SELECT ce.*, c.id AS course_id, tp.user_id
            FROM course_enrollments ce
            JOIN courses c ON ce.course_id = c.id
            JOIN trainer_profiles tp ON c.trainer_profile_id = tp.id
            WHERE ce.id = ?
            LIMIT 1
        `;

        db.query(getEnrollmentQuery, [enrollmentId], (enrollError, enrollResult) => {
            if (enrollError) {
                return res.status(500).json({
                    success: false,
                    message: "Enrollment fetch failed",
                    error: enrollError.message
                });
            }

            if (enrollResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Enrollment not found"
                });
            }

            const enrollment = enrollResult[0];

            if (Number(enrollment.user_id) !== Number(userId)) {
                return res.status(403).json({
                    success: false,
                    message: "You are not allowed to update this enrollment"
                });
            }

            const updateQuery = `
                UPDATE course_enrollments
                SET
                    enrollment_status = ?,
                    progress_percentage = ?
                WHERE id = ?
            `;

            db.query(updateQuery, ["completed", 100.00, enrollmentId], (updateError) => {
                if (updateError) {
                    return res.status(500).json({
                        success: false,
                        message: "Enrollment update failed",
                        error: updateError.message
                    });
                }

                return res.status(200).json({
                    success: true,
                    message: "Enrollment marked as completed"
                });
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Mark enrollment completed failed",
            error: error.message
        });
    }
};

module.exports = {
    enrollInCourse,
    getMyEnrollments,
    getSingleEnrollment,
    cancelEnrollment,
    getCourseEnrollmentsForTrainer,
    markEnrollmentCompleted
};