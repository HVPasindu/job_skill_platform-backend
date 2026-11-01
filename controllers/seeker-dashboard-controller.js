const db = require("../db/db-connection");
// Real, current-user counts; a missing profile is an onboarding state, not a query failure.
exports.getDashboard = async (req, res) => {
  try {
    const client = db.promise();
    const [profiles] = await client.query(
      "SELECT * FROM job_seeker_profiles WHERE user_id = ? LIMIT 1",
      [req.user.id],
    );
    if (!profiles.length)
      return res.json({
        success: true,
        profile: null,
        counts: { education: 0, experience: 0, skills: 0, documents: 0 },
        applications: {},
        recent_applications: [],
      });
    const profile = profiles[0];
    const [counts] = await client.query(
      `SELECT
            (SELECT COUNT(*) FROM job_seeker_educations WHERE job_seeker_profile_id = ?) AS education,
            (SELECT COUNT(*) FROM job_seeker_experiences WHERE job_seeker_profile_id = ?) AS experience,
            (SELECT COUNT(*) FROM job_seeker_skills WHERE job_seeker_profile_id = ?) AS skills,
            (SELECT COUNT(*) FROM resumes WHERE job_seeker_profile_id = ?) AS documents`,
      [profile.id, profile.id, profile.id, profile.id],
    );
    const [statuses] = await client.query(
      "SELECT application_status, COUNT(*) AS total FROM job_applications WHERE job_seeker_profile_id = ? GROUP BY application_status",
      [profile.id],
    );
    const [recent] = await client.query(
      `SELECT ja.id, ja.job_id, ja.application_status, ja.applied_at, j.title AS job_title, c.company_name
            FROM job_applications ja JOIN jobs j ON ja.job_id = j.id JOIN companies c ON j.company_id = c.id
            WHERE ja.job_seeker_profile_id = ? ORDER BY ja.id DESC LIMIT 4`,
      [profile.id],
    );
    return res.json({
      success: true,
      profile,
      counts: counts[0],
      applications: Object.fromEntries(
        statuses.map((row) => [row.application_status, Number(row.total)]),
      ),
      recent_applications: recent,
    });
  } catch {
    return res
      .status(500)
      .json({ success: false, message: "Your dashboard could not be loaded" });
  }
};
