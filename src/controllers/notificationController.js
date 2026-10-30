const { getDB } = require("../config/db");

exports.markRead = async (req, res) => {
  const db = await getDB();
  const col = db.collection("notifications");
  const ids = Array.isArray(req.body.ids) ? req.body.ids.filter((x) => typeof x === "string").slice(0, 200) : [];

  if (req.body.all) await col.updateMany({ uid: req.u.id, read: false }, { $set: { read: true } });
  else if (ids.length) await col.updateMany({ uid: req.u.id, _id: { $in: ids } }, { $set: { read: true } });

  res.json({ ok: 1 });
};
