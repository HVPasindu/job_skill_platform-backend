const transaction = require("../db/application-transaction");
function fail(code, message) {
  const error = new Error(message);
  error.status = code;
  throw error;
}
function respond(res, error) {
  return res.status(error.status || 500).json({
    success: false,
    message: error.status
      ? error.message
      : "Could not update this mentorship session",
  });
}
function values(body, old = {}) {
  const value = { ...old, ...body };
  value.title = typeof value.title === "string" ? value.title.trim() : "";
  value.course_id = value.course_id === "" ? null : (value.course_id ?? null);
  value.max_participants =
    value.max_participants === "" ? null : (value.max_participants ?? null);
  value.status = value.status || "scheduled";
  if (!value.title || value.title.length > 150)
    fail(400, "Use a session title up to 150 characters");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value.session_date || "") ||
    Number.isNaN(Date.parse(value.session_date + "T00:00:00Z")) ||
    new Date(value.session_date + "T00:00:00Z").toISOString().slice(0, 10) !==
      value.session_date
  )
    fail(400, "Use a valid session date");
  const time = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;
  if (
    !time.test(value.start_time || "") ||
    !time.test(value.end_time || "") ||
    String(value.end_time).padEnd(8, ":00") <=
      String(value.start_time).padEnd(8, ":00")
  )
    fail(400, "End time must be after start time on the same day");
  if (
    value.max_participants !== null &&
    (!Number.isInteger(Number(value.max_participants)) ||
      Number(value.max_participants) < 1 ||
      Number(value.max_participants) > 2147483647)
  )
    fail(
      400,
      "Capacity must be a positive whole number or blank for unlimited",
    );
  if (!["scheduled", "completed", "cancelled"].includes(value.status))
    fail(400, "Invalid session status");
  if (value.course_id !== null && !/^[1-9]\d*$/.test(String(value.course_id)))
    fail(400, "Invalid course");
  if (
    value.description != null &&
    (typeof value.description !== "string" || value.description.length > 10000)
  )
    fail(400, "Use a description up to 10000 characters");
  if (value.meeting_url) {
    let url;
    try {
      url = new URL(value.meeting_url);
    } catch {
      fail(400, "Use a full http:// or https:// meeting URL");
    }
    if (
      !["http:", "https:"].includes(url.protocol) ||
      value.meeting_url.length > 255
    )
      fail(400, "Use a valid meeting URL up to 255 characters");
  }
  return value;
}
async function save(req, res, editing) {
  try {
    const id = await transaction(async (client) => {
      let old = {};
      let trainer;
      if (editing) {
        const [rows] = await client.query(
          "SELECT ms.*,DATE_FORMAT(ms.session_date,'%Y-%m-%d') AS session_date,tp.user_id FROM mentorship_sessions ms JOIN trainer_profiles tp ON ms.trainer_profile_id=tp.id WHERE ms.id = ? FOR UPDATE",
          [req.params.id],
        );
        if (!rows.length) fail(404, "Session not found");
        old = rows[0];
        if (Number(old.user_id) !== Number(req.user.id))
          fail(403, "You cannot edit this session");
        trainer = old.trainer_profile_id;
      } else {
        const [rows] = await client.query(
          "SELECT id FROM trainer_profiles WHERE user_id = ? FOR UPDATE",
          [req.user.id],
        );
        if (!rows.length) fail(403, "Trainer profile is required");
        trainer = rows[0].id;
      }
      const v = values(req.body, old);
      if (v.course_id !== null) {
        const [courses] = await client.query(
          "SELECT c.id FROM courses c JOIN trainer_profiles tp ON c.trainer_profile_id=tp.id WHERE c.id = ? AND tp.user_id = ? LIMIT 1",
          [v.course_id, req.user.id],
        );
        if (!courses.length) fail(403, "You can only attach your own course");
      }
      const [duplicates] = await client.query(
        "SELECT id FROM mentorship_sessions WHERE trainer_profile_id = ? AND LOWER(title)=LOWER(?) AND id != ? LIMIT 1",
        [trainer, v.title, editing ? req.params.id : 0],
      );
      if (duplicates.length)
        fail(400, "You already have a session with this title");
      if (editing && v.max_participants !== null) {
        const [counts] = await client.query(
          "SELECT COUNT(*) AS total FROM mentorship_participants WHERE mentorship_session_id = ?",
          [req.params.id],
        );
        if (Number(v.max_participants) < Number(counts[0].total))
          fail(
            409,
            "Capacity cannot be lower than the current participant count",
          );
      }
      const fields = [
        v.course_id,
        v.title,
        v.description || null,
        v.session_date,
        v.start_time,
        v.end_time,
        v.meeting_url || null,
        v.max_participants,
        v.status,
      ];
      if (editing) {
        await client.query(
          "UPDATE mentorship_sessions SET course_id=?,title=?,description=?,session_date=?,start_time=?,end_time=?,meeting_url=?,max_participants=?,status=? WHERE id=?",
          [...fields, req.params.id],
        );
        return Number(req.params.id);
      }
      const [insert] = await client.query(
        "INSERT INTO mentorship_sessions (trainer_profile_id,course_id,title,description,session_date,start_time,end_time,meeting_url,max_participants,status) VALUES (?,?,?,?,?,?,?,?,?,?)",
        [trainer, ...fields],
      );
      return insert.insertId;
    });
    return res.status(editing ? 200 : 201).json({
      success: true,
      session_id: id,
      message: editing
        ? "Mentorship session updated successfully"
        : "Mentorship session created successfully",
    });
  } catch (error) {
    return respond(res, error);
  }
}
const createMentorshipSession = (req, res) => save(req, res, false);
const updateMentorshipSession = (req, res) => save(req, res, true);
const deleteMentorshipSession = async (req, res) => {
  try {
    await transaction(async (client) => {
      const [rows] = await client.query(
        "SELECT ms.id,tp.user_id FROM mentorship_sessions ms JOIN trainer_profiles tp ON ms.trainer_profile_id=tp.id WHERE ms.id = ? FOR UPDATE",
        [req.params.id],
      );
      if (!rows.length) fail(404, "Session not found");
      if (Number(rows[0].user_id) !== Number(req.user.id))
        fail(403, "You cannot delete this session");
      await client.query("DELETE FROM mentorship_sessions WHERE id = ?", [
        req.params.id,
      ]);
    });
    return res.json({
      success: true,
      message: "Mentorship session deleted successfully",
    });
  } catch (error) {
    return respond(res, error);
  }
};
async function membership(req, res, joining) {
  try {
    await transaction(async (client) => {
      const [profiles] = await client.query(
        "SELECT id FROM job_seeker_profiles WHERE user_id = ? FOR UPDATE",
        [req.user.id],
      );
      if (!profiles.length) fail(404, "Job seeker profile not found");
      // All joins, leaves, edits and deletes lock the same session row: capacity cannot overbook.
      const [sessions] = await client.query(
        "SELECT ms.*,tp.user_id,(TIMESTAMP(ms.session_date,ms.start_time)<=CURRENT_TIMESTAMP()) AS started FROM mentorship_sessions ms JOIN trainer_profiles tp ON ms.trainer_profile_id=tp.id WHERE ms.id = ? FOR UPDATE",
        [req.params.sessionId],
      );
      if (!sessions.length) fail(404, "Session not found");
      const session = sessions[0];
      if (joining && Number(session.user_id) === Number(req.user.id))
        fail(400, "You cannot join your own session");
      if (session.status !== "scheduled" || Number(session.started))
        fail(409, "Only upcoming scheduled sessions can be joined or left");
      const [members] = await client.query(
        "SELECT id FROM mentorship_participants WHERE mentorship_session_id = ? AND job_seeker_profile_id = ? LIMIT 1",
        [req.params.sessionId, profiles[0].id],
      );
      if (!joining) {
        if (!members.length) fail(404, "You have not joined this session");
        await client.query("DELETE FROM mentorship_participants WHERE id = ?", [
          members[0].id,
        ]);
        return;
      }
      if (members.length) fail(409, "You already joined this session");
      const [counts] = await client.query(
        "SELECT COUNT(*) AS total FROM mentorship_participants WHERE mentorship_session_id = ?",
        [req.params.sessionId],
      );
      if (
        session.max_participants !== null &&
        Number(counts[0].total) >= Number(session.max_participants)
      )
        fail(409, "Session is full");
      await client.query(
        "INSERT INTO mentorship_participants (mentorship_session_id,job_seeker_profile_id) VALUES (?,?)",
        [req.params.sessionId, profiles[0].id],
      );
    });
    return res.status(joining ? 201 : 200).json({
      success: true,
      message: joining
        ? "Joined session successfully"
        : "Left session successfully",
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY")
      return res
        .status(409)
        .json({ success: false, message: "You already joined this session" });
    return respond(res, error);
  }
}
const joinSession = (req, res) => membership(req, res, true);
const leaveSession = (req, res) => membership(req, res, false);
module.exports = {
  createMentorshipSession,
  updateMentorshipSession,
  deleteMentorshipSession,
  joinSession,
  leaveSession,
};
