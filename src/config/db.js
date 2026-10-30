const { MongoClient } = require("mongodb");
const { DB_NAME } = require("./constants");

let client;
let indexed = false;

// Indexes keep the board, chat polling and notifications fast as data grows.
// createIndex is idempotent; failures (e.g. restricted DB user) are logged, never fatal.
const ensureIndexes = async (db) => {
  if (indexed) return;
  indexed = true;
  try {
    await Promise.all([
      db.collection("tasks").createIndex({ projectId: 1 }),
      db.collection("sessions").createIndex({ uid: 1, start: -1 }),
      db.collection("sessions").createIndex({ projectId: 1 }),
      db.collection("sessions").createIndex({ taskId: 1 }),
      db.collection("sprints").createIndex({ projectId: 1 }),
      db.collection("messages").createIndex({ projectId: 1, at: -1 }),
      db.collection("messages").createIndex({ projectId: 1, u: 1 }),
      db.collection("comments").createIndex({ taskId: 1, at: 1 }),
      db.collection("activity").createIndex({ projectId: 1, at: -1 }),
      db.collection("activity").createIndex({ taskId: 1, at: -1 }),
      db.collection("notifications").createIndex({ uid: 1, at: -1 })
    ]);
  } catch (err) {
    console.warn("Index creation skipped:", err.message);
  }
};

const getDB = async () => {
  if (!client) {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI environment variable is not defined");
    }
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    await ensureIndexes(client.db(DB_NAME));
  }
  return client.db(DB_NAME);
};

module.exports = { getDB };
