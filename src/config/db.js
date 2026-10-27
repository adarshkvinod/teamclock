const { MongoClient } = require("mongodb");
const { DB_NAME } = require("./constants");

let client;

const getDB = async () => {
  if (!client) {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI environment variable is not defined");
    }
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
  }
  return client.db(DB_NAME);
};

module.exports = { getDB };