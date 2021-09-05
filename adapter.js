const createTable = (name) => `
CREATE TABLE IF NOT EXISTS ${name} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT,
  value TEXT,
  ttl INTEGER,
  timestmp TEXT
)
`;
const insertDoc = (table) => `
insert into ${table} (key,value,ttl,timestmp) values (?, ?, ?, ?)`;

export default (db) => {
  const createStore = (name) => {
    try {
      db.query(createTable(name));
      return Promise.resolve(({ ok: true }));
    } catch (_e) {
      return Promise.reject({
        ok: false,
        status: 500,
        msg: "Could not create store!",
      });
    }
  };

  const createDoc = ({ store, key, value, ttl }) => {
    try {
      const res = db.query(`select key from ${store} where key = ?`, [key]);
      if (res.length > 0) {
        return Promise.reject({
          ok: false,
          status: 409,
          msg: "document conflict",
        });
      }
      db.query(insertDoc(store), [
        key,
        JSON.stringify(value),
        ttl || 0,
        new Date().toISOString(),
      ]); //ttl
      return Promise.resolve({ ok: true });
    } catch (_e) {
      console.log(_e);
      return Promise.reject({ ok: false, status: 400 });
    }
  };

  const deleteDoc = ({ store, key }) => {
    //const res = await stores[store].del(key)
    db.query(`delete from ${store} where key = ?`, [key]);
    return Promise.resolve({ ok: true });
  };

  const getDoc = ({ store, key }) => {
    try {
      const res = db.query(`select value, id from ${store} where key = ?`, [
        key,
      ]);
      // update timestmp
      db.query(
        `update ${store} set timestmp = ? where id = ?`,
        new Date().toISOString(),
        res[0][1],
      );
      return Promise.resolve(JSON.parse(res[0][0]));
    } catch (_e) {
      return Promise.reject({
        ok: false,
        status: 404,
        msg: "document not found",
      });
    }
  };

  const updateDoc = ({ store, key, value, ttl }) => {
    try {
      const res = db.query(`select id, value from ${store} where key = ?`, [
        key,
      ]);
      if (res.length === 0) {
        db.query(
          `insert into ${store} (key, value, ttl, timestmp) values (?, ?, ?, ?)`,
          [
            key,
            JSON.stringify(value),
            ttl || 0,
            new Date().toISOString(),
          ],
        );
        return Promise.resolve({ ok: true });
      }
      const [id] = res[0];
      const cur = JSON.parse(res[0][1]);
      value = { ...cur, ...value };
      const _ = db.query(
        `update ${store} set value = ?, ttl = ?, timestmp = ? where id = ?`,
        [JSON.stringify(value), ttl, new Date().toISOString(), id],
      );
      return Promise.resolve({ ok: true });
    } catch (_e) {
      console.log(_e);
      return Promise.reject({
        ok: false,
        status: 400,
        msg: _e.message,
      });
    }
  };

  const listDocs = ({ store, pattern }) => {
    try {
      const res = db.query(`select key, value from ${store} where key like ?`, [
        pattern.replace("*", "%"),
      ]);
      const toObject = ([k, v]) => ({ key: k, value: JSON.parse(v) });
      return Promise.resolve({
        ok: true,
        docs: res.map(toObject),
      });
    } catch (_e) {
      return Promise.reject({
        ok: false,
        status: 400,
        msg: "cache not created",
      });
    }
  };

  const index = () => {
    return Promise.reject({ ok: false, status: 501, msg: "not implemented" });
  };

  const destroyStore = (name) => {
    try {
      const res = db.query(`drop table ${name}`);
      console.log(res);
      return Promise.resolve({ ok: true });
    } catch (_e) {
      return Promise.reject({ ok: false });
    }
  };

  return {
    createStore,
    createDoc,
    deleteDoc,
    getDoc,
    updateDoc,
    listDocs,
    index,
    destroyStore,
  };
};
