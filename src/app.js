const express = require("express");
const routes = require("./routes");

const app = express();
app.use(express.json({ limit: "50kb" }));

// Mount all API routes under /api
app.use("/api", routes);

module.exports = app;