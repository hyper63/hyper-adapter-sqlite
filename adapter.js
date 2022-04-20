import {
  addMilliseconds,
  crocks,
  HyperErr,
  isAfter,
  isHyperErr,
  parseISO,
  R,
} from "./deps.js";

const { Async } = crocks;

const {
  always,
  compose,
  evolve,
  identity,
  head,
  zipObj,
  length,
  ifElse,
  map,
  includes,
  complement,
} = R;

const asyncify = (fn) =>
  Async.fromPromise(async (...args) => await fn(...args));

const handleHyperErr = ifElse(
  isHyperErr,
  Async.Resolved,
  Async.Rejected,
);

const xDoc = compose(
  evolve({
    id: identity,
    key: identity,
    value: (v) => JSON.parse(v),
    ttl: identity,
    timestmp: identity,
  }),
  zipObj(["id", "key", "value", "ttl", "timestmp"]),
  head,
);

const expired = (ttl, timestmp) => {
  const stop = addMilliseconds(parseISO(timestmp), ttl);
  return isAfter(new Date(), stop);
};

const toObject = ([k, v]) => ({ key: k, value: JSON.parse(v) });

const quote = (str) => `"${str}"`;

const createTable = (name) => `
CREATE TABLE IF NOT EXISTS ${quote(name)} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT,
  value TEXT,
  ttl INTEGER,
  timestmp TEXT
)
`;
const insertDoc = (table) => `
insert into ${quote(table)} (key,value,ttl,timestmp) values (?, ?, ?, ?)`;

export default (db) => {
  const query = asyncify(db.query.bind(db));

  const createStore = (name) => {
    return Async.of(createTable(name))
      .chain(query)
      .bichain(
        (e) => {
          console.log(e);
          return Async.Rejected(HyperErr({
            status: 500,
            msg: "Could not create store",
          }));
        },
        Async.Resolved,
      )
      .bichain(
        handleHyperErr,
        always(Async.Resolved({ ok: true })),
      )
      .toPromise();
  };

  const createDoc = ({ store, key, value, ttl }) => {
    return Async.of(`select key from ${quote(store)} where key = ?`)
      .chain((q) => query(q, [key]))
      .chain(ifElse(
        length,
        () =>
          Async.Rejected(HyperErr({
            status: 409,
            msg: "document conflict",
          })),
        () =>
          query(
            insertDoc(store),
            [
              key,
              JSON.stringify(value),
              ttl || 0,
              new Date().toISOString(),
            ],
          ).bimap(
            (e) => {
              console.log(e);
              return HyperErr({ ok: false, status: 400 });
            },
            identity,
          ),
      ))
      .bichain(
        handleHyperErr,
        always(Async.Resolved({ ok: true })),
      ).toPromise();
  };

  const deleteDoc = ({ store, key }) => {
    return Async.of(`delete from ${quote(store)} where key = ?`)
      .chain((q) => query(q, [key]))
      .bichain(
        handleHyperErr,
        always(Async.Resolved({ ok: true })),
      ).toPromise();
  };

  const getDoc = ({ store, key }) => {
    return Async.of(
      `select id, key, value, ttl, timestmp from ${quote(store)} where key = ?`,
    )
      .chain((q) => query(q, [key]))
      .chain(ifElse(
        length,
        Async.Resolved,
        () =>
          Async.Rejected(HyperErr({
            status: 404,
            msg: "document not found",
          })),
      ))
      .map(xDoc)
      .chain(
        (doc) => {
          if (doc.ttl > 0 && expired(doc.ttl, doc.timestmp)) {
            return query(`delete from ${quote(store)} where id = ?`, [doc.id])
              .chain(() =>
                Async.Rejected(HyperErr({ status: 404, msg: "ttl expired!" }))
              );
          }

          // update timestmp
          return query(
            `update ${quote(store)} set timestmp = ? where id = ?`,
            new Date().toISOString(),
            doc.id,
          ).map(always(doc.value));
        },
      )
      .bichain(
        handleHyperErr,
        Async.Resolved,
      ).toPromise();
  };

  const updateDoc = ({ store, key, value, ttl }) => {
    return Async.of(`select id, value from ${quote(store)} where key = ?`)
      .chain((q) => query(q, [key]))
      // upsert
      .chain(ifElse(
        complement(length),
        () =>
          query(
            `insert into ${
              quote(store)
            } (key, value, ttl, timestmp) values (?, ?, ?, ?)`,
            [
              key,
              JSON.stringify(value),
              ttl || 0,
              new Date().toISOString(),
            ],
          ),
        (res) => {
          const [id] = res[0];
          const cur = JSON.parse(res[0][1]);
          // TODO: should this do a full replace instead of a merge,
          // TODO: for consistency with other hyper adapters?
          value = JSON.stringify({ ...cur, ...value });
          return query(
            `update ${
              quote(store)
            } set value = ?, ttl = ?, timestmp = ? where id = ?`,
            [value, ttl, new Date().toISOString(), id],
          );
        },
      ))
      .bimap(
        (e) => {
          console.log(e);
          return HyperErr({
            status: 400,
            msg: e.message,
          });
        },
        always({ ok: true }),
      )
      .bichain(
        handleHyperErr,
        Async.Resolved,
      )
      .toPromise();
  };

  const listDocs = ({ store, pattern }) => {
    return Async.of(`select key, value from ${quote(store)} where key like ?`)
      .chain((q) => query(q, [pattern.replace("*", "%")]))
      .bimap(
        (e) => {
          console.log(e);
          return HyperErr({
            status: 400,
            msg: "cache not created",
          });
        },
        map(toObject),
      )
      .bichain(
        handleHyperErr,
        (docs) => Async.Resolved({ ok: true, docs }),
      )
      .toPromise();
  };

  const index = () => {
    return Promise.resolve(HyperErr({ status: 501, msg: "not implemented" }));
  };

  const destroyStore = (name) => {
    return Async.of(`drop table ${quote(name)}`)
      .chain(query)
      .bimap(
        ifElse(
          (e) => includes("no such table", e.message),
          always(HyperErr({ msg: "cache not found", status: 404 })),
          identity,
        ),
        identity,
      )
      .bichain(
        handleHyperErr,
        always(Async.Resolved({ ok: true })),
      )
      .toPromise();
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
