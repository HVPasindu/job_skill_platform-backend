const db = require("../db/db-connection");
// Published reads remain public, as in the supplied API. Draft/archived reads need the owning trainer.
function courseReadAccess(byMaterial = false) {
  return async (req, res, next) => {
    try {
      const sql = byMaterial
        ? "SELECT c.status,tp.user_id FROM course_materials cm JOIN courses c ON cm.course_id=c.id JOIN trainer_profiles tp ON c.trainer_profile_id=tp.id WHERE cm.id = ? LIMIT 1"
        : "SELECT c.status,tp.user_id FROM courses c JOIN trainer_profiles tp ON c.trainer_profile_id=tp.id WHERE c.id = ? LIMIT 1";
      const id = byMaterial
        ? req.params.materialId
        : req.params.courseId || req.params.id;
      const [rows] = await db.promise().query(sql, [id]);
      if (
        !rows.length ||
        (rows[0].status !== "published" &&
          Number(rows[0].user_id) !== Number(req.user?.id))
      )
        return res
          .status(404)
          .json({ success: false, message: "Course not found" });
      next();
    } catch {
      return res
        .status(500)
        .json({ success: false, message: "Could not check course access" });
    }
  };
}
module.exports = courseReadAccess;
