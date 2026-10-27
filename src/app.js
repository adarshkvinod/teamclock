const express = require("express");
const path = require("path");
const routes = require("./routes");

const app = express();

app.use(express.json({ limit: "50kb" }));

// 1. Serve all static files from the root public folder (favicon.svg, css, js)
app.use(express.static(path.join(__dirname, "../public")));

// 2. Mount API routes
app.use("/api", routes);

// 3. SPA fallback to index.html for non-API routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../public", "index.html"));
});

module.exports = app;