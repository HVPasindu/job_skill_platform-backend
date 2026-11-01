const db = require("../db/db-connection");
// Reuse the existing isolated mysql2 pool; never start transactions on the shared connection.
const transaction = require("../db/application-transaction");
function fail(code, message) {
  const error = new Error(message);
  error.status = code;
  throw error;
}
function errorResponse(res, error) {
  return res
    .status(error.status || 500)
    .json({
      success: false,
      message: error.status
        ? error.message
        : "Could not update this enrollment",
    });
}
const enrollInCourse = async (req, res) => {
  try {
    const result = await transaction(async (client) => {
      const [profiles] = await client.query(
        "SELECT id FROM job_seeker_profiles WHERE user_id = ? FOR UPDATE",
        [req.user.id],
      );
      if (!profiles.length) fail(404, "Job seeker profile not found");
      const [courses] = await client.query(
        "SELECT id,status FROM courses WHERE id = ? FOR UPDATE",
        [req.params.courseId],
      );
      if (!courses.length) fail(404, "Course not found");
      if (courses[0].status !== "published")
        fail(409, "This course is not available for enrollment");
      const [existing] = await client.query(
        "SELECT id,enrollment_status FROM course_enrollments WHERE course_id = ? AND job_seeker_profile_id = ? LIMIT 1",
        [req.params.courseId, profiles[0].id],
      );
      if (existing.length)
        fail(
          409,
          existing[0].enrollment_status === "cancelled"
            ? "Your enrollment was cancelled. Its record is retained; this course cannot be enrolled again."
            : "You are already enrolled in this course",
        );
      const [insert] = await client.query(
        "INSERT INTO course_enrollments (course_id,job_seeker_profile_id,enrollment_status,progress_percentage) VALUES (?,?,'active',0)",
        [req.params.courseId, profiles[0].id],
      );
      return insert.insertId;
    });
    return res
      .status(201)
      .json({
        success: true,
        enrollment_id: result,
        message: "Enrolled in course successfully",
      });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY")
      return res
        .status(409)
        .json({
          success: false,
          message: "You are already enrolled in this course",
        });
    return errorResponse(res, error);
  }
};
async function transition(req, res, complete) {
  try {
    await transaction(async (client) => {
      const sql = complete
        ? "SELECT ce.*,tp.user_id AS owner_id FROM course_enrollments ce JOIN courses c ON ce.course_id=c.id JOIN trainer_profiles tp ON c.trainer_profile_id=tp.id WHERE ce.id = ? FOR UPDATE"
        : "SELECT ce.*,jsp.user_id AS owner_id FROM course_enrollments ce JOIN job_seeker_profiles jsp ON ce.job_seeker_profile_id=jsp.id WHERE ce.id = ? FOR UPDATE";
      const [rows] = await client.query(sql, [req.params.id]);
      if (!rows.length) fail(404, "Enrollment not found");
      if (Number(rows[0].owner_id) !== Number(req.user.id))
        fail(403, "You are not allowed to update this enrollment");
      if (rows[0].enrollment_status !== "active")
        fail(
          409,
          "Only active enrollments can be " +
            (complete ? "completed" : "cancelled"),
        );
      await client.query(
        complete
          ? "UPDATE course_enrollments SET enrollment_status='completed',progress_percentage=100 WHERE id = ?"
          : "UPDATE course_enrollments SET enrollment_status='cancelled' WHERE id = ?",
        [req.params.id],
      );
    });
    return res.json({
      success: true,
      message: complete
        ? "Enrollment marked as completed"
        : "Enrollment cancelled successfully",
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}
const cancelEnrollment = (req, res) => transition(req, res, false);
const markEnrollmentCompleted = (req, res) => transition(req, res, true);
const getMyCourseEnrollment = async (req, res) => {
  try {
    const [rows] = await db
      .promise()
      .query(
        "SELECT ce.* FROM course_enrollments ce JOIN job_seeker_profiles jsp ON ce.job_seeker_profile_id=jsp.id WHERE ce.course_id = ? AND jsp.user_id = ? LIMIT 1",
        [req.params.courseId, req.user.id],
      );
    return res.json({ success: true, enrollment: rows[0] || null });
  } catch {
    return res
      .status(500)
      .json({ success: false, message: "Could not check your enrollment" });
  }
};
const getStudents = (req, res) => {
  const sendList = require("../utils/paginated-list");
  const params = [req.user.id];
  let where = " WHERE tp.user_id = ? ";
  const { status, course_id, search } = req.query;
  if (status) {
    if (!["active", "completed", "cancelled"].includes(status))
      return res
        .status(400)
        .json({ success: false, message: "Invalid enrollment status" });
    where += " AND ce.enrollment_status = ? ";
    params.push(status);
  }
  if (course_id) {
    if (typeof course_id !== "string" || !/^\d+$/.test(course_id))
      return res
        .status(400)
        .json({ success: false, message: "Invalid course" });
    where += " AND c.id = ? ";
    params.push(course_id);
  }
  if (search) {
    if (typeof search !== "string" || search.length > 150)
      return res
        .status(400)
        .json({ success: false, message: "Invalid student search" });
    where += " AND (u.full_name LIKE ? OR c.title LIKE ?) ";
    params.push(`%${search.trim()}%`, `%${search.trim()}%`);
  }
  const joins =
    " FROM course_enrollments ce JOIN courses c ON ce.course_id=c.id JOIN trainer_profiles tp ON c.trainer_profile_id=tp.id JOIN job_seeker_profiles jsp ON ce.job_seeker_profile_id=jsp.id JOIN users u ON jsp.user_id=u.id ";
  return sendList(req, res, {
    sql:
      "SELECT ce.*,c.title AS course_title,u.full_name,u.email,jsp.phone" +
      joins +
      where +
      " ORDER BY ce.id DESC",
    countSql: "SELECT COUNT(*) AS total" + joins + where,
    params,
    key: "enrollments",
  });
};
module.exports = {
  enrollInCourse,
  cancelEnrollment,
  markEnrollmentCompleted,
  getMyCourseEnrollment,
  getStudents,
};
