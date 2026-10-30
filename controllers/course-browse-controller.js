const db = require("../db/db-connection");
const sendList = require("../utils/paginated-list");

// Published catalogue only. Existing trainer CRUD stays in course-controller.js.
const getPublicCourses = (req, res) => {
  const { search, category_id, level, course_type } = req.query;
  const params = [];
  let where = " WHERE c.status = 'published' ";
  if (search !== undefined) {
    if (typeof search !== "string" || search.length > 150)
      return res
        .status(400)
        .json({ success: false, message: "Invalid course search" });
    where +=
      " AND (c.title LIKE ? OR c.short_description LIKE ? OR u.full_name LIKE ?) ";
    params.push(...Array(3).fill(`%${search.trim()}%`));
  }
  if (category_id !== undefined && category_id !== "") {
    if (typeof category_id !== "string" || !/^[1-9]\d*$/.test(category_id))
      return res
        .status(400)
        .json({ success: false, message: "Invalid course category" });
    where += " AND c.course_category_id = ? ";
    params.push(category_id);
  }
  for (const [column, value] of [
    ["level", level],
    ["course_type", course_type],
  ]) {
    if (value === undefined || value === "") continue;
    if (typeof value !== "string" || value.length > 50)
      return res
        .status(400)
        .json({ success: false, message: "Invalid course filter" });
    where += ` AND c.${column} = ? `;
    params.push(value);
  }
  const joins =
    " FROM courses c JOIN trainer_profiles tp ON c.trainer_profile_id=tp.id JOIN users u ON tp.user_id=u.id LEFT JOIN course_categories cc ON c.course_category_id=cc.id ";
  return sendList(req, res, {
    sql:
      "SELECT c.id,c.title,c.short_description,c.thumbnail_url,c.level,c.duration_text,c.course_type,c.course_category_id,cc.category_name,u.full_name AS trainer_name" +
      joins +
      where +
      " ORDER BY c.created_at DESC,c.id DESC",
    countSql: "SELECT COUNT(*) AS total" + joins + where,
    params,
    key: "courses",
  });
};
const getOutline = (req, res) =>
  sendList(req, res, {
    sql: "SELECT id,title,material_type,sort_order FROM course_materials WHERE course_id = ? ORDER BY CASE WHEN sort_order IS NULL THEN 1 ELSE 0 END,sort_order ASC,id ASC",
    countSql:
      "SELECT COUNT(*) AS total FROM course_materials WHERE course_id = ?",
    params: [req.params.id],
    key: "materials",
  });
const getTrainerDashboard = async (req, res) => {
  try {
    const client = db.promise(),
      id = req.user.id;
    const [profiles] = await client.query(
      "SELECT id, specialization FROM trainer_profiles WHERE user_id = ? LIMIT 1",
      [id],
    );
    if (!profiles.length)
      return res.json({
        success: true,
        profile: null,
        counts: {
          courses: 0,
          published: 0,
          draft: 0,
          materials: 0,
          resources: 0,
        },
        recent_courses: [],
      });
    const profileId = profiles[0].id;
    const [courses] = await client.query(
      "SELECT COUNT(*) AS courses,COALESCE(SUM(status='published'),0) AS published,COALESCE(SUM(status='draft'),0) AS draft FROM courses WHERE trainer_profile_id = ?",
      [profileId],
    );
    const [materials] = await client.query(
      "SELECT COUNT(*) AS materials FROM course_materials cm JOIN courses c ON cm.course_id=c.id WHERE c.trainer_profile_id = ?",
      [profileId],
    );
    const [resources] = await client.query(
      "SELECT COUNT(*) AS resources FROM course_material_files f JOIN course_materials cm ON f.course_material_id=cm.id JOIN courses c ON cm.course_id=c.id WHERE c.trainer_profile_id = ?",
      [profileId],
    );
    const [recent] = await client.query(
      "SELECT id,title,status,course_type,thumbnail_url FROM courses WHERE trainer_profile_id = ? ORDER BY id DESC LIMIT 4",
      [profileId],
    );
    return res.json({
      success: true,
      profile: profiles[0],
      counts: { ...courses[0], ...materials[0], ...resources[0] },
      recent_courses: recent,
    });
  } catch {
    return res
      .status(500)
      .json({
        success: false,
        message: "Could not load your trainer overview",
      });
  }
};
// Match the installed schema; no migrations or hard-coded enum rewrites.
const getCourseOptions = async (_req, res) => {
  try {
    const client = db.promise();
    const options = {
      course_types: ["recorded", "live", "hybrid"],
      statuses: ["draft", "published", "archived"],
      material_types: [
        "youtube_link",
        "video_link",
        "pdf",
        "document",
        "external_link",
      ],
      file_types: ["pdf", "image", "doc", "link"],
    };
    for (const [table, mapping] of [
      ["courses", { course_type: "course_types", status: "statuses" }],
      ["course_materials", { material_type: "material_types" }],
      ["course_material_files", { file_type: "file_types" }],
    ]) {
      const [columns] = await client.query(`SHOW COLUMNS FROM ${table}`);
      for (const column of columns) {
        if (mapping[column.Field] && column.Type.startsWith("enum("))
          options[mapping[column.Field]] = [
            ...column.Type.matchAll(/'([^']+)'/g),
          ].map((match) => match[1]);
      }
    }
    return res.json({ success: true, ...options });
  } catch {
    return res
      .status(500)
      .json({ success: false, message: "Could not load course form options" });
  }
};
module.exports = {
  getPublicCourses,
  getOutline,
  getTrainerDashboard,
  getCourseOptions,
};
