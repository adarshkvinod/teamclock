const { DOCBOOK_ID } = require("../config/constants");

const MIGRATION_KEY = "projects_v1";
let migrated = false; // per-instance cache so we skip the DB check after the first success

const MISSING = { $or: [{ projectId: { $exists: false } }, { projectId: null }, { projectId: "" }] };

/**
 * One-time, idempotent migration to the project layer.
 *  - Any task / session that has no projectId is moved into the "Docbook" project.
 *  - Docbook is created with every current employee as a member.
 * Safe to call on every request and safe if two serverless instances run it at once:
 * every write is an upsert / updateMany on "missing" records, so repeats change nothing.
 */
async function ensureProjects(db) {
  if (migrated) return;

  const meta = db.collection("meta");
  if (await meta.findOne({ _id: MIGRATION_KEY })) {
    migrated = true;
    return;
  }

  const tasks = db.collection("tasks");
  const sessions = db.collection("sessions");

  const hasLegacy =
    (await tasks.countDocuments(MISSING, { limit: 1 })) > 0 ||
    (await sessions.countDocuments(MISSING, { limit: 1 })) > 0;

  if (hasLegacy) {
    const employees = await db
      .collection("users")
      .find({ role: "employee" }, { projection: { _id: 1 } })
      .toArray();

    try {
      await db.collection("projects").updateOne(
        { _id: DOCBOOK_ID },
        {
          $setOnInsert: {
            name: "Docbook",
            description: "",
            status: "active",
            start: "",
            end: "",
            members: employees.map((e) => e._id),
            created: Date.now()
          }
        },
        { upsert: true }
      );
    } catch (err) {
      if (err.code !== 11000) throw err; // another instance created it first – fine
    }

    await tasks.updateMany(MISSING, { $set: { projectId: DOCBOOK_ID } });
    await sessions.updateMany(MISSING, { $set: { projectId: DOCBOOK_ID } });
  }

  await meta.updateOne({ _id: MIGRATION_KEY }, { $setOnInsert: { at: Date.now() } }, { upsert: true });
  migrated = true;
}

module.exports = { ensureProjects };
