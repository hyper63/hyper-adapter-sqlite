import { addMilliseconds, crocks, HyperErr, isAfter, isHyperErr, parseISO, R } from './deps.js'

const { Async } = crocks

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
  partition,
  pluck,
  pick,
} = R

const asyncify = (fn) => Async.fromPromise(async (...args) => await fn(...args))

const handleHyperErr = ifElse(
  isHyperErr,
  Async.Resolved,
  Async.Rejected,
)

const mapCacheDne = ifElse(
  (e) => includes('no such table', e.message),
  always(HyperErr({ msg: 'cache not found', status: 404 })),
  // some other error so passthrough
  (e) => {
    console.log(e)
    return e
  },
)

const xDoc = compose(
  evolve({
    id: identity,
    key: identity,
    value: (v) => JSON.parse(v),
    ttl: identity,
    timestmp: identity,
  }),
  zipObj(['id', 'key', 'value', 'ttl', 'timestmp']),
)

const expired = (ttl, timestmp) => {
  if (!ttl) return false
  const stop = addMilliseconds(parseISO(timestmp), ttl)
  return isAfter(new Date(), stop)
}

const quote = (str) => `"${str}"`

/**
 * If the ttl is not provided, default to 0
 * which means store indefinitely
 *
 * Otherwise, choose the max of ttl and 1 millisecond.
 * This way, if a negative ttl is provided, for whatever reason,
 * it results in the document being expired in the next millisecond,
 * effectively immediately
 */
const mapTtl = (ttl) => ttl == null ? 0 : Math.max(ttl, 1)

const createTable = (name) => `
CREATE TABLE ${quote(name)} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT,
  value TEXT,
  ttl INTEGER,
  timestmp TEXT
)
`
const insertDoc = (table) => `
insert into ${quote(table)} (key,value,ttl,timestmp) values (?, ?, ?, ?)`

export default (db) => {
  const query = asyncify(db.query.bind(db))

  const evictExpired = (store) =>
    ifElse(
      length,
      (docs) =>
        Async.Resolved(docs)
          .map(partition((doc) => expired(doc.ttl, doc.timestmp)))
          .chain(([expired, good]) => {
            return expired.length
              // evict all expired docs, then return the good ones
              ? query(
                `delete from ${quote(store)} where id in (${
                  // See https://stackoverflow.com/questions/4788724/sqlite-bind-list-of-values-to-where-col-in-prm
                  Array(expired.length).fill('?').join(',')})`,
                pluck('id', expired),
              ).map(always(good))
              : Async.Resolved(good)
          }),
      Async.Resolved,
    )

  const createStore = (name) => {
    return Async.of(createTable(name))
      .chain(query)
      .bimap(
        ifElse(
          (e) => includes('already exists', e.message),
          always(HyperErr({ msg: 'cache already exists', status: 409 })),
          identity,
        ),
        identity,
      )
      .bichain(
        handleHyperErr,
        always(Async.Resolved({ ok: true })),
      )
      .toPromise()
  }

  const createDoc = ({ store, key, value, ttl }) => {
    return Async.of(`select key from ${quote(store)} where key = ?`)
      .chain((q) => query(q, [key]))
      .bimap(
        mapCacheDne,
        identity,
      )
      .chain(ifElse(
        length,
        () =>
          Async.Rejected(HyperErr({
            status: 409,
            msg: 'document conflict',
          })),
        () =>
          query(
            insertDoc(store),
            [
              key,
              JSON.stringify(value),
              mapTtl(ttl),
              new Date().toISOString(),
            ],
          ),
      ))
      .bichain(
        handleHyperErr,
        always(Async.Resolved({ ok: true })),
      ).toPromise()
  }

  const deleteDoc = ({ store, key }) => {
    return Async.of(`delete from ${quote(store)} where key = ?`)
      .chain((q) => query(q, [key]))
      .bimap(
        mapCacheDne,
        identity,
      )
      .bichain(
        handleHyperErr,
        always(Async.Resolved({ ok: true })),
      ).toPromise()
  }

  const getDoc = ({ store, key }) => {
    return Async.of(
      `select id, key, value, ttl, timestmp from ${quote(store)} where key = ?`,
    )
      .chain((q) => query(q, [key]))
      .bimap(
        mapCacheDne,
        identity,
      )
      .chain(ifElse(
        length,
        Async.Resolved,
        () =>
          Async.Rejected(HyperErr({
            status: 404,
            msg: 'document not found',
          })),
      ))
      .map(compose(
        xDoc,
        head, // just one result will come back, so just grab it
      ))
      .chain((doc) => evictExpired(store)([doc]))
      .map(head) // just one result will come back, so just grab it
      .chain((doc) =>
        doc
          ? Async.Resolved(doc.value)
          : Async.Rejected(HyperErr({ status: 404, msg: 'ttl expired!' }))
      )
      .bichain(
        handleHyperErr,
        Async.Resolved,
      ).toPromise()
  }

  const updateDoc = ({ store, key, value, ttl }) => {
    return Async.of(`select id, value from ${quote(store)} where key = ?`)
      .chain((q) => query(q, [key]))
      .bimap(
        mapCacheDne,
        identity,
      )
      // upsert
      .chain(ifElse(
        complement(length),
        () =>
          query(
            `insert into ${quote(store)} (key, value, ttl, timestmp) values (?, ?, ?, ?)`,
            [
              key,
              JSON.stringify(value),
              mapTtl(ttl),
              new Date().toISOString(),
            ],
          ),
        (res) => {
          const [id] = res[0]
          const cur = JSON.parse(res[0][1])
          // TODO: should this do a full replace instead of a merge,
          // TODO: for consistency with other hyper adapters?
          value = JSON.stringify({ ...cur, ...value })
          return query(
            `update ${quote(store)} set value = ?, ttl = ?, timestmp = ? where id = ?`,
            [value, ttl, new Date().toISOString(), id],
          )
        },
      ))
      .map(always({ ok: true }))
      .bichain(
        handleHyperErr,
        Async.Resolved,
      )
      .toPromise()
  }

  const listDocs = ({ store, pattern }) => {
    return Async.of(
      `select id, key, value, ttl, timestmp from ${quote(store)} where key like ?`,
    )
      .chain((q) => query(q, [pattern.replace('*', '%')]))
      .bimap(
        mapCacheDne,
        map(xDoc),
      )
      .chain(evictExpired(store))
      .map(map(pick(['key', 'value'])))
      .bichain(
        handleHyperErr,
        (docs) => Async.Resolved({ ok: true, docs }),
      )
      .toPromise()
  }

  const index = () => {
    return Promise.resolve(HyperErr({ status: 501, msg: 'not implemented' }))
  }

  const destroyStore = (name) => {
    return Async.of(`drop table ${quote(name)}`)
      .chain(query)
      .bimap(
        mapCacheDne,
        identity,
      )
      .bichain(
        handleHyperErr,
        always(Async.Resolved({ ok: true })),
      )
      .toPromise()
  }

  return {
    createStore,
    createDoc,
    deleteDoc,
    getDoc,
    updateDoc,
    listDocs,
    index,
    destroyStore,
  }
}
