const path = require("path");
const express = require("express");
const app = require("./src/app");

// Serve frontend static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`TeamClock local server running at http://localhost:${PORT}`);
});