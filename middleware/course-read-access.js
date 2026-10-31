const db = require("../db/db-connection");
// Public metadata/outline remains public. Actual learning resources require owner or enrollment.
function courseReadAccess(byMaterial = false, learning = false) {
  return async (req, res, next) => {
    try {
      const sql = byMaterial
        ? "SELECT c.id,c.status,tp.user_id FROM course_materials cm JOIN courses c ON cm.course_id=c.id JOIN trainer_profiles tp ON c.trainer_profile_id=tp.id WHERE cm.id = ? LIMIT 1"
        : "SELECT c.id,c.status,tp.user_id FROM courses c JOIN trainer_profiles tp ON c.trainer_profile_id=tp.id WHERE c.id = ? LIMIT 1";
      const id = byMaterial
        ? req.params.materialId
        : req.params.courseId || req.params.id;
      const [rows] = await db.promise().query(sql, [id]);
      if (!rows.length)
        return res
          .status(404)
          .json({ success: false, message: "Course not found" });
      const course = rows[0];
      if (Number(course.user_id) === Number(req.user?.id)) return next();
      if (!learning && course.status === "published") return next();
      let enrolled = false;
      if (req.user && ["published", "archived"].includes(course.status)) {
        const [access] = await db
          .promise()
          .query(
            "SELECT EXISTS(SELECT 1 FROM course_enrollments ce JOIN job_seeker_profiles jsp ON ce.job_seeker_profile_id=jsp.id WHERE ce.course_id = ? AND jsp.user_id = ? AND ce.enrollment_status IN ('active','completed')) AS allowed",
            [course.id, req.user.id],
          );
        enrolled = Number(access[0]?.allowed) === 1;
      }
      if (enrolled) return next();
      if (course.status !== "published")
        return res
          .status(404)
          .json({ success: false, message: "Course not found" });
      return res
        .status(403)
        .json({
          success: false,
          message:
            "An active or completed enrollment is required to access course materials",
        });
    } catch {
      return res
        .status(500)
        .json({ success: false, message: "Could not check course access" });
    }
  };
}
module.exports = courseReadAccess;
