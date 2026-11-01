const { enrollInCourse, cancelEnrollment, markEnrollmentCompleted } = require("./learning-actions");
const sendList = require("../utils/paginated-list");
const db = require("../db/db-connection");

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
                    c.status AS course_status,
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

            return sendList(req, res, {
                sql: query,
                params: params,
                key: "enrollments",
                countSql: "SELECT COUNT(*) AS total FROM course_enrollments ce JOIN courses c ON ce.course_id=c.id JOIN trainer_profiles tp ON c.trainer_profile_id=tp.id JOIN users u ON tp.user_id=u.id WHERE ce.job_seeker_profile_id = ?" + (status ? " AND ce.enrollment_status = ?" : ""),
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
                    c.status AS course_status,
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

            return sendList(req, res, {
                sql: query,
                params: params,
                key: "enrollments",
                countSql: "SELECT COUNT(*) AS total FROM course_enrollments ce JOIN job_seeker_profiles jsp ON ce.job_seeker_profile_id=jsp.id JOIN users u ON jsp.user_id=u.id WHERE ce.course_id = ?" + (status ? " AND ce.enrollment_status = ?" : ""),
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

module.exports = {
    enrollInCourse,
    getMyEnrollments,
    getSingleEnrollment,
    cancelEnrollment,
    getCourseEnrollmentsForTrainer,
    markEnrollmentCompleted
};