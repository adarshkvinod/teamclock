module.exports = {
  SECRET: process.env.JWT_SECRET,
  DB_NAME: process.env.DB_NAME || "teamclock",
  
  // Available Employee Roles (can have multiple per employee)
  ROLES: [
    "Mobile App Developer",
    "Web Developer",
    "Backend Developer",
    "Product Designer",
    "Project Manager"
  ],

  // Available Task Categories / Shift Types
  TASK_TYPES: [
    "Mobile App Development",
    "Backend Development",
    "Web Development",
    "Product Designing",
    "Marketing",
    "Meeting",
    "Discussion",
    "Project Management"
  ],

  // Backward compatibility alias
  TYPES: [
    "Mobile App Development",
    "Backend Development",
    "Web Development",
    "Product Designing",
    "Marketing",
    "Meeting",
    "Discussion",
    "Project Management"
  ],

  STATUS: ["To do", "In progress", "Done"],
  PROJECT_STATUS: ["active", "archived"],
  PRIORITIES: ["Low", "Medium", "High", "Urgent"],
  SPRINT_STATUS: ["planned", "active", "completed"],
  DOCBOOK_ID: "docbook",
  DAY_REGEX: /^\d{4}-\d{2}-\d{2}$/,
  ID_REGEX: /^[a-zA-Z0-9_-]{4,64}$/
};