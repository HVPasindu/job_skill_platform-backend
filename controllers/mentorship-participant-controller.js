const {joinSession,leaveSession} = require("./mentorship-actions");
const sendList = require("../utils/paginated-list");
const db = require("../db/db-connection");

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
                    DATE_FORMAT(ms.session_date,'%Y-%m-%d') AS session_date,
                    ms.status,ms.description,ms.max_participants,
                    (TIMESTAMP(ms.session_date,ms.start_time)<=CURRENT_TIMESTAMP()) AS started,
                    (SELECT COUNT(*) FROM mentorship_participants counts WHERE counts.mentorship_session_id=ms.id) AS participant_count,
                    ms.start_time,
                    ms.end_time,
                    CASE WHEN ms.status='cancelled' THEN NULL ELSE ms.meeting_url END AS meeting_url,
                    u.full_name AS trainer_name
                FROM mentorship_participants mp
                JOIN mentorship_sessions ms ON mp.mentorship_session_id = ms.id
                JOIN trainer_profiles tp ON ms.trainer_profile_id = tp.id
                JOIN users u ON tp.user_id = u.id
                WHERE mp.job_seeker_profile_id = ?
                ORDER BY ms.session_date DESC, mp.id DESC
            `;

            return sendList(req, res, {
                sql: query,
                params: [profile.id],
                key: "sessions",
                countSql: "SELECT COUNT(*) AS total FROM mentorship_participants mp JOIN mentorship_sessions ms ON mp.mentorship_session_id=ms.id JOIN trainer_profiles tp ON ms.trainer_profile_id=tp.id JOIN users u ON tp.user_id=u.id WHERE mp.job_seeker_profile_id = ?",
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
                WHERE mp.mentorship_session_id = ? ORDER BY mp.id DESC
            `;

            return sendList(req, res, {
                sql: query,
                params: [sessionId],
                key: "participants",
                countSql: "SELECT COUNT(*) AS total FROM mentorship_participants mp JOIN job_seeker_profiles jsp ON mp.job_seeker_profile_id=jsp.id JOIN users u ON jsp.user_id=u.id WHERE mp.mentorship_session_id = ?",
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