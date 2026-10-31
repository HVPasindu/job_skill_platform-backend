const {createMentorshipSession,updateMentorshipSession,deleteMentorshipSession} = require("./mentorship-actions");
const sendList = require("../utils/paginated-list");
const db = require("../db/db-connection");

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
                SELECT ms.*,DATE_FORMAT(ms.session_date,'%Y-%m-%d') AS session_date, (TIMESTAMP(ms.session_date,ms.start_time)<=CURRENT_TIMESTAMP()) AS started, (SELECT COUNT(*) FROM mentorship_participants mp WHERE mp.mentorship_session_id=ms.id) AS participant_count, c.title AS course_title
                FROM mentorship_sessions ms
                LEFT JOIN courses c ON ms.course_id = c.id
                WHERE ms.trainer_profile_id = ?
            `;

            const params = [trainerProfile.id];

            if (status) {
                query += ` AND ms.status = ? `;
                params.push(status);
            }

            query += ` ORDER BY ms.session_date DESC, ms.start_time DESC, ms.id DESC `;

            return sendList(req, res, {
                sql: query,
                params: params,
                key: "sessions",
                countSql: "SELECT COUNT(*) AS total FROM mentorship_sessions ms LEFT JOIN courses c ON ms.course_id=c.id WHERE ms.trainer_profile_id = ?" + (status ? " AND ms.status = ?" : ""),
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
const publicJoins = ` FROM mentorship_sessions ms JOIN trainer_profiles tp ON ms.trainer_profile_id=tp.id JOIN users u ON tp.user_id=u.id LEFT JOIN courses c ON ms.course_id=c.id CROSS JOIN (SELECT ? AS user_id) viewer `;
const publicColumns = `SELECT ms.id,ms.trainer_profile_id,ms.course_id,ms.title,ms.description,ms.start_time,ms.end_time,ms.max_participants,ms.status,ms.created_at,ms.updated_at,DATE_FORMAT(ms.session_date,'%Y-%m-%d') AS session_date,
 (TIMESTAMP(ms.session_date,ms.start_time)<=CURRENT_TIMESTAMP()) AS started,
 tp.user_id AS trainer_user_id,u.full_name AS trainer_name,
 CASE WHEN c.status='published' OR tp.user_id=viewer.user_id THEN c.title ELSE NULL END AS course_title,
 (SELECT COUNT(*) FROM mentorship_participants mp WHERE mp.mentorship_session_id=ms.id) AS participant_count,
 EXISTS(SELECT 1 FROM mentorship_participants mp JOIN job_seeker_profiles jsp ON mp.job_seeker_profile_id=jsp.id WHERE mp.mentorship_session_id=ms.id AND jsp.user_id=viewer.user_id) AS is_joined,
 CASE WHEN tp.user_id=viewer.user_id OR (ms.status<>'cancelled' AND EXISTS(SELECT 1 FROM mentorship_participants mp JOIN job_seeker_profiles jsp ON mp.job_seeker_profile_id=jsp.id WHERE mp.mentorship_session_id=ms.id AND jsp.user_id=viewer.user_id)) THEN ms.meeting_url ELSE NULL END AS meeting_url `;
const getAllMentorshipSessions = (req,res)=>{
 const {status,search}=req.query;let where=" WHERE 1=1 ";const params=[req.user?.id||0];
 if(status){if(!["scheduled","completed","cancelled"].includes(status))return res.status(400).json({success:false,message:"Invalid session status"});where+=" AND ms.status = ? ";params.push(status);}
 if(search){if(typeof search!=="string"||search.length>150)return res.status(400).json({success:false,message:"Invalid session search"});where+=" AND (ms.title LIKE ? OR u.full_name LIKE ?) ";params.push(`%${search.trim()}%`,`%${search.trim()}%`);}
 return sendList(req,res,{sql:publicColumns+publicJoins+where+" ORDER BY ms.session_date ASC,ms.start_time ASC,ms.id ASC",countSql:"SELECT COUNT(*) AS total"+publicJoins+where,params,key:"sessions"});
};

// GET SINGLE SESSION
const getSingleMentorshipSession = (req,res)=>{
 db.query(publicColumns+publicJoins+" WHERE ms.id = ? LIMIT 1",[req.user?.id||0,req.params.id],(error,rows)=>{
  if(error)return res.status(500).json({success:false,message:"Could not load this session"});
  if(!rows.length)return res.status(404).json({success:false,message:"Session not found"});
  return res.json({success:true,session:rows[0]});
 });
};

module.exports = {
    createMentorshipSession,
    getMyMentorshipSessions,
    getAllMentorshipSessions,
    getSingleMentorshipSession,
    updateMentorshipSession,
    deleteMentorshipSession
};