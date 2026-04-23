const db = require("../db/db-connection");

// JOIN SESSION
const joinSession = (req, res) => {
    try {
        const userId = req.user.id;
        const sessionId = req.params.sessionId;

        const getProfileQuery = `
            SELECT * FROM job_seeker_profiles
            WHERE user_id = ?
            LIMIT 1
        `;

        db.query(getProfileQuery, [userId], (profileErr, profileRes) => {
            if (profileErr) {
                return res.status(500).json({ success: false, error: profileErr.message });
            }

            if (profileRes.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Job seeker profile not found"
                });
            }

            const profile = profileRes[0];

            const getSessionQuery = `
                SELECT ms.*, tp.user_id
                FROM mentorship_sessions ms
                JOIN trainer_profiles tp ON ms.trainer_profile_id = tp.id
                WHERE ms.id = ?
                LIMIT 1
            `;

            db.query(getSessionQuery, [sessionId], (sessionErr, sessionRes) => {
                if (sessionErr) {
                    return res.status(500).json({ success: false, error: sessionErr.message });
                }

                if (sessionRes.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message: "Session not found"
                    });
                }

                const session = sessionRes[0];

                // ❌ cannot join own session
                if (Number(session.user_id) === Number(userId)) {
                    return res.status(400).json({
                        success: false,
                        message: "You cannot join your own session"
                    });
                }

                // ❌ only scheduled sessions
                if (session.status !== "scheduled") {
                    return res.status(400).json({
                        success: false,
                        message: "This session is not open for joining"
                    });
                }

                // 🔢 max participants check
                const countQuery = `
                    SELECT COUNT(*) AS total
                    FROM mentorship_participants
                    WHERE mentorship_session_id = ?
                `;

                db.query(countQuery, [sessionId], (countErr, countRes) => {
                    if (countErr) {
                        return res.status(500).json({ success: false, error: countErr.message });
                    }

                    const currentCount = countRes[0].total;

                    if (
                        session.max_participants &&
                        currentCount >= session.max_participants
                    ) {
                        return res.status(400).json({
                            success: false,
                            message: "Session is full"
                        });
                    }

                    const insertQuery = `
                        INSERT INTO mentorship_participants (
                            mentorship_session_id,
                            job_seeker_profile_id
                        )
                        VALUES (?, ?)
                    `;

                    db.query(
                        insertQuery,
                        [sessionId, profile.id],
                        (insertErr, insertRes) => {
                            if (insertErr) {
                                if (insertErr.code === "ER_DUP_ENTRY") {
                                    return res.status(400).json({
                                        success: false,
                                        message: "You already joined this session"
                                    });
                                }

                                return res.status(500).json({
                                    success: false,
                                    message: "Join session failed",
                                    error: insertErr.message
                                });
                            }

                            return res.status(201).json({
                                success: true,
                                message: "Joined session successfully"
                            });
                        }
                    );
                });
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Join session failed",
            error: error.message
        });
    }
};

// GET MY SESSIONS
const getMySessions = (req, res) => {
    try {
        const userId = req.user.id;

        const getProfileQuery = `
            SELECT * FROM job_seeker_profiles
            WHERE user_id = ?
            LIMIT 1
        `;

        db.query(getProfileQuery, [userId], (profileErr, profileRes) => {
            if (profileErr) return res.status(500).json({ success: false, error: profileErr.message });

            if (profileRes.length === 0) {
                return res.status(404).json({ success: false, message: "Profile not found" });
            }

            const profile = profileRes[0];

            const query = `
                SELECT
                    mp.*,
                    ms.title,
                    ms.session_date,
                    ms.start_time,
                    ms.end_time,
                    ms.meeting_url,
                    u.full_name AS trainer_name
                FROM mentorship_participants mp
                JOIN mentorship_sessions ms ON mp.mentorship_session_id = ms.id
                JOIN trainer_profiles tp ON ms.trainer_profile_id = tp.id
                JOIN users u ON tp.user_id = u.id
                WHERE mp.job_seeker_profile_id = ?
                ORDER BY ms.session_date DESC
            `;

            db.query(query, [profile.id], (err, result) => {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: "Fetch failed",
                        error: err.message
                    });
                }

                return res.json({
                    success: true,
                    sessions: result
                });
            });
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

// LEAVE SESSION
const leaveSession = (req, res) => {
    try {
        const userId = req.user.id;
        const sessionId = req.params.sessionId;

        const getProfileQuery = `
            SELECT * FROM job_seeker_profiles
            WHERE user_id = ?
            LIMIT 1
        `;

        db.query(getProfileQuery, [userId], (profileErr, profileRes) => {
            if (profileErr) return res.status(500).json({ success: false, error: profileErr.message });

            if (profileRes.length === 0) {
                return res.status(404).json({ success: false, message: "Profile not found" });
            }

            const profile = profileRes[0];

            const deleteQuery = `
                DELETE FROM mentorship_participants
                WHERE mentorship_session_id = ?
                AND job_seeker_profile_id = ?
            `;

            db.query(deleteQuery, [sessionId, profile.id], (err) => {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: "Leave failed",
                        error: err.message
                    });
                }

                return res.json({
                    success: true,
                    message: "Left session successfully"
                });
            });
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

// TRAINER VIEW PARTICIPANTS
const getParticipants = (req, res) => {
    try {
        const userId = req.user.id;
        const sessionId = req.params.sessionId;

        const getSessionQuery = `
            SELECT ms.*, tp.user_id
            FROM mentorship_sessions ms
            JOIN trainer_profiles tp ON ms.trainer_profile_id = tp.id
            WHERE ms.id = ?
        `;

        db.query(getSessionQuery, [sessionId], (err, result) => {
            if (err) return res.status(500).json({ success: false, error: err.message });

            if (result.length === 0) {
                return res.status(404).json({ success: false, message: "Session not found" });
            }

            if (Number(result[0].user_id) !== Number(userId)) {
                return res.status(403).json({
                    success: false,
                    message: "Not allowed"
                });
            }

            const query = `
                SELECT
                    mp.*,
                    u.full_name,
                    u.email
                FROM mentorship_participants mp
                JOIN job_seeker_profiles jsp ON mp.job_seeker_profile_id = jsp.id
                JOIN users u ON jsp.user_id = u.id
                WHERE mp.mentorship_session_id = ?
            `;

            db.query(query, [sessionId], (err2, participants) => {
                if (err2) {
                    return res.status(500).json({
                        success: false,
                        message: "Fetch failed",
                        error: err2.message
                    });
                }

                return res.json({
                    success: true,
                    participants
                });
            });
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    joinSession,
    getMySessions,
    leaveSession,
    getParticipants
};