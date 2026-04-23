const db = require("../db/db-connection");

// CREATE SESSION
const createMentorshipSession = (req, res) => {
    try {
        const userId = req.user.id;

        const {
            course_id,
            title,
            description,
            session_date,
            start_time,
            end_time,
            meeting_url,
            max_participants,
            status
        } = req.body;

        if (!title || !session_date || !start_time || !end_time) {
            return res.status(400).json({
                success: false,
                message: "title, session_date, start_time and end_time are required"
            });
        }

        const trimmedTitle = title.trim();

        const getTrainerQuery = `
            SELECT * FROM trainer_profiles
            WHERE user_id = ?
            LIMIT 1
        `;

        db.query(getTrainerQuery, [userId], (trainerError, trainerResult) => {
            if (trainerError) {
                return res.status(500).json({
                    success: false,
                    message: "Trainer profile fetch failed",
                    error: trainerError.message
                });
            }

            if (trainerResult.length === 0) {
                return res.status(403).json({
                    success: false,
                    message: "Only trainers can create mentorship sessions"
                });
            }

            const trainerProfile = trainerResult[0];

            const continueInsert = () => {
                const insertQuery = `
                    INSERT INTO mentorship_sessions (
                        trainer_profile_id,
                        course_id,
                        title,
                        description,
                        session_date,
                        start_time,
                        end_time,
                        meeting_url,
                        max_participants,
                        status
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;

                db.query(
                    insertQuery,
                    [
                        trainerProfile.id,
                        course_id || null,
                        trimmedTitle,
                        description || null,
                        session_date,
                        start_time,
                        end_time,
                        meeting_url || null,
                        max_participants || null,
                        status || "scheduled"
                    ],
                    (insertError, insertResult) => {
                        if (insertError) {
                            return res.status(500).json({
                                success: false,
                                message: "Mentorship session create failed",
                                error: insertError.message
                            });
                        }

                        return res.status(201).json({
                            success: true,
                            message: "Mentorship session created successfully",
                            session_id: insertResult.insertId
                        });
                    }
                );
            };

            const checkDuplicateAndInsert = () => {
                const checkDuplicateQuery = `
                    SELECT * FROM mentorship_sessions
                    WHERE trainer_profile_id = ?
                      AND LOWER(title) = LOWER(?)
                    LIMIT 1
                `;

                db.query(
                    checkDuplicateQuery,
                    [trainerProfile.id, trimmedTitle],
                    (duplicateError, duplicateResult) => {
                        if (duplicateError) {
                            return res.status(500).json({
                                success: false,
                                message: "Mentorship session duplicate check failed",
                                error: duplicateError.message
                            });
                        }

                        if (duplicateResult.length > 0) {
                            return res.status(400).json({
                                success: false,
                                message: "You already have a mentorship session with this title"
                            });
                        }

                        return continueInsert();
                    }
                );
            };

            if (!course_id) {
                return checkDuplicateAndInsert();
            }

            const checkCourseQuery = `
                SELECT c.id, c.title, tp.user_id
                FROM courses c
                JOIN trainer_profiles tp ON c.trainer_profile_id = tp.id
                WHERE c.id = ?
                LIMIT 1
            `;

            db.query(checkCourseQuery, [course_id], (courseError, courseResult) => {
                if (courseError) {
                    return res.status(500).json({
                        success: false,
                        message: "Course check failed",
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
                        message: "You can only attach your own course to a mentorship session"
                    });
                }

                return checkDuplicateAndInsert();
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Create mentorship session failed",
            error: error.message
        });
    }
};

// GET MY SESSIONS
const getMyMentorshipSessions = (req, res) => {
    try {
        const userId = req.user.id;
        const { status } = req.query;

        const getTrainerQuery = `
            SELECT * FROM trainer_profiles
            WHERE user_id = ?
            LIMIT 1
        `;

        db.query(getTrainerQuery, [userId], (trainerError, trainerResult) => {
            if (trainerError) {
                return res.status(500).json({
                    success: false,
                    message: "Trainer profile fetch failed",
                    error: trainerError.message
                });
            }

            if (trainerResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Trainer profile not found"
                });
            }

            const trainerProfile = trainerResult[0];

            let query = `
                SELECT ms.*, c.title AS course_title
                FROM mentorship_sessions ms
                LEFT JOIN courses c ON ms.course_id = c.id
                WHERE ms.trainer_profile_id = ?
            `;

            const params = [trainerProfile.id];

            if (status) {
                query += ` AND ms.status = ? `;
                params.push(status);
            }

            query += ` ORDER BY ms.session_date DESC, ms.start_time DESC `;

            db.query(query, params, (error, result) => {
                if (error) {
                    return res.status(500).json({
                        success: false,
                        message: "Fetch mentorship sessions failed",
                        error: error.message
                    });
                }

                return res.status(200).json({
                    success: true,
                    sessions: result
                });
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Get my mentorship sessions failed",
            error: error.message
        });
    }
};

// GET ALL PUBLIC SESSIONS
const getAllMentorshipSessions = (req, res) => {
    try {
        const { status } = req.query;

        let query = `
            SELECT
                ms.*,
                c.title AS course_title,
                tp.id AS trainer_profile_id,
                u.full_name AS trainer_name
            FROM mentorship_sessions ms
            JOIN trainer_profiles tp ON ms.trainer_profile_id = tp.id
            JOIN users u ON tp.user_id = u.id
            LEFT JOIN courses c ON ms.course_id = c.id
            WHERE 1 = 1
        `;

        const params = [];

        if (status) {
            query += ` AND ms.status = ? `;
            params.push(status);
        }

        query += ` ORDER BY ms.session_date ASC, ms.start_time ASC `;

        db.query(query, params, (error, result) => {
            if (error) {
                return res.status(500).json({
                    success: false,
                    message: "Fetch mentorship sessions failed",
                    error: error.message
                });
            }

            return res.status(200).json({
                success: true,
                sessions: result
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Get mentorship sessions failed",
            error: error.message
        });
    }
};

// GET SINGLE SESSION
const getSingleMentorshipSession = (req, res) => {
    try {
        const sessionId = req.params.id;

        const query = `
            SELECT
                ms.*,
                c.title AS course_title,
                tp.id AS trainer_profile_id,
                u.full_name AS trainer_name,
                u.email AS trainer_email
            FROM mentorship_sessions ms
            JOIN trainer_profiles tp ON ms.trainer_profile_id = tp.id
            JOIN users u ON tp.user_id = u.id
            LEFT JOIN courses c ON ms.course_id = c.id
            WHERE ms.id = ?
            LIMIT 1
        `;

        db.query(query, [sessionId], (error, result) => {
            if (error) {
                return res.status(500).json({
                    success: false,
                    message: "Fetch mentorship session failed",
                    error: error.message
                });
            }

            if (result.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Mentorship session not found"
                });
            }

            return res.status(200).json({
                success: true,
                session: result[0]
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Get single mentorship session failed",
            error: error.message
        });
    }
};

// UPDATE SESSION
const updateMentorshipSession = (req, res) => {
    try {
        const userId = req.user.id;
        const sessionId = req.params.id;

        const {
            course_id,
            title,
            description,
            session_date,
            start_time,
            end_time,
            meeting_url,
            max_participants,
            status
        } = req.body;

        const getSessionQuery = `
            SELECT ms.*, tp.user_id
            FROM mentorship_sessions ms
            JOIN trainer_profiles tp ON ms.trainer_profile_id = tp.id
            WHERE ms.id = ?
            LIMIT 1
        `;

        db.query(getSessionQuery, [sessionId], (sessionError, sessionResult) => {
            if (sessionError) {
                return res.status(500).json({
                    success: false,
                    message: "Mentorship session fetch failed",
                    error: sessionError.message
                });
            }

            if (sessionResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Mentorship session not found"
                });
            }

            const existingSession = sessionResult[0];

            if (Number(existingSession.user_id) !== Number(userId)) {
                return res.status(403).json({
                    success: false,
                    message: "You are not allowed to update this mentorship session"
                });
            }

            const updatedCourseId =
                course_id !== undefined ? course_id : existingSession.course_id;

            const updatedTitle =
                title !== undefined ? title.trim() : existingSession.title;

            const updatedDescription =
                description !== undefined ? description : existingSession.description;

            const updatedSessionDate =
                session_date !== undefined ? session_date : existingSession.session_date;

            const updatedStartTime =
                start_time !== undefined ? start_time : existingSession.start_time;

            const updatedEndTime =
                end_time !== undefined ? end_time : existingSession.end_time;

            const updatedMeetingUrl =
                meeting_url !== undefined ? meeting_url : existingSession.meeting_url;

            const updatedMaxParticipants =
                max_participants !== undefined ? max_participants : existingSession.max_participants;

            const updatedStatus =
                status !== undefined ? status : existingSession.status;

            const continueUpdate = () => {
                const updateQuery = `
                    UPDATE mentorship_sessions
                    SET
                        course_id = ?,
                        title = ?,
                        description = ?,
                        session_date = ?,
                        start_time = ?,
                        end_time = ?,
                        meeting_url = ?,
                        max_participants = ?,
                        status = ?
                    WHERE id = ?
                `;

                db.query(
                    updateQuery,
                    [
                        updatedCourseId || null,
                        updatedTitle,
                        updatedDescription,
                        updatedSessionDate,
                        updatedStartTime,
                        updatedEndTime,
                        updatedMeetingUrl,
                        updatedMaxParticipants,
                        updatedStatus,
                        sessionId
                    ],
                    (updateError) => {
                        if (updateError) {
                            return res.status(500).json({
                                success: false,
                                message: "Mentorship session update failed",
                                error: updateError.message
                            });
                        }

                        return res.status(200).json({
                            success: true,
                            message: "Mentorship session updated successfully"
                        });
                    }
                );
            };

            const checkDuplicateAndUpdate = () => {
                const checkDuplicateQuery = `
                    SELECT * FROM mentorship_sessions
                    WHERE trainer_profile_id = ?
                      AND LOWER(title) = LOWER(?)
                      AND id != ?
                    LIMIT 1
                `;

                db.query(
                    checkDuplicateQuery,
                    [existingSession.trainer_profile_id, updatedTitle, sessionId],
                    (duplicateError, duplicateResult) => {
                        if (duplicateError) {
                            return res.status(500).json({
                                success: false,
                                message: "Mentorship session duplicate check failed",
                                error: duplicateError.message
                            });
                        }

                        if (duplicateResult.length > 0) {
                            return res.status(400).json({
                                success: false,
                                message: "You already have another mentorship session with this title"
                            });
                        }

                        return continueUpdate();
                    }
                );
            };

            if (
                updatedCourseId === undefined ||
                updatedCourseId === null ||
                updatedCourseId === ""
            ) {
                return checkDuplicateAndUpdate();
            }

            const checkCourseQuery = `
                SELECT c.id, c.title, tp.user_id
                FROM courses c
                JOIN trainer_profiles tp ON c.trainer_profile_id = tp.id
                WHERE c.id = ?
                LIMIT 1
            `;

            db.query(checkCourseQuery, [updatedCourseId], (courseError, courseResult) => {
                if (courseError) {
                    return res.status(500).json({
                        success: false,
                        message: "Course check failed",
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
                        message: "You can only attach your own course to this mentorship session"
                    });
                }

                return checkDuplicateAndUpdate();
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Update mentorship session failed",
            error: error.message
        });
    }
};

// DELETE SESSION
const deleteMentorshipSession = (req, res) => {
    try {
        const userId = req.user.id;
        const sessionId = req.params.id;

        const getSessionQuery = `
            SELECT ms.*, tp.user_id
            FROM mentorship_sessions ms
            JOIN trainer_profiles tp ON ms.trainer_profile_id = tp.id
            WHERE ms.id = ?
            LIMIT 1
        `;

        db.query(getSessionQuery, [sessionId], (sessionError, sessionResult) => {
            if (sessionError) {
                return res.status(500).json({
                    success: false,
                    message: "Mentorship session fetch failed",
                    error: sessionError.message
                });
            }

            if (sessionResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Mentorship session not found"
                });
            }

            const existingSession = sessionResult[0];

            if (Number(existingSession.user_id) !== Number(userId)) {
                return res.status(403).json({
                    success: false,
                    message: "You are not allowed to delete this mentorship session"
                });
            }

            const deleteQuery = `
                DELETE FROM mentorship_sessions
                WHERE id = ?
            `;

            db.query(deleteQuery, [sessionId], (deleteError) => {
                if (deleteError) {
                    return res.status(500).json({
                        success: false,
                        message: "Mentorship session delete failed",
                        error: deleteError.message
                    });
                }

                return res.status(200).json({
                    success: true,
                    message: "Mentorship session deleted successfully"
                });
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Delete mentorship session failed",
            error: error.message
        });
    }
};

module.exports = {
    createMentorshipSession,
    getMyMentorshipSessions,
    getAllMentorshipSessions,
    getSingleMentorshipSession,
    updateMentorshipSession,
    deleteMentorshipSession
};