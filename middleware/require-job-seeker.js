// JWT role names match the existing auth controller. Ownership is checked in SQL too.
module.exports = (req, res, next) => {
  if (
    !Array.isArray(req.user?.roles) ||
    !req.user.roles.includes("job_seeker")
  ) {
    return res
      .status(403)
      .json({ success: false, message: "A job seeker role is required" });
  }
  next();
};
