import { DB } from './deps.js'

const createTable = name => `
CREATE TABLE IF NOT EXISTS stores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT,
  value TEXT,
  ttl INTEGER
)
`
export default (db) => {

  const createStore = (name) => {
    try {
      db.query(createTable(name))
      return Promise.resolve(({ ok: true }))
    } catch (e) {
      return Promise.reject({ ok: false, status: 500, msg: 'Could not create store!' })
    }
  }

  const createDoc = ({ store, key, value, ttl }) => {
    try {
      db.query(insertDoc(key, JSON.stringify(value), ttl))
      return Promise.resolve({ ok: true })
    } catch (e) {
      return Promise.resolve({ ok: false, status: 400 })
    }
  }

  const deleteDoc = async ({ store, key }) => {
    //const res = await stores[store].del(key)
    return ({ ok: true })
  }

  return {
    createStore,
    createDoc,
    deleteDoc
  }
}