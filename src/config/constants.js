module.exports = {
  SECRET: process.env.JWT_SECRET,
  DB_NAME: process.env.DB_NAME || "teamclock",
  TYPES: ["Designer", "Project Manager", "Marketing", "Developer", "DevOps"],
  STATUS: ["To do", "In progress", "Done"],
  DAY_REGEX: /^\d{4}-\d{2}-\d{2}$/,
  ID_REGEX: /^[a-zA-Z0-9_-]{4,64}$/
};