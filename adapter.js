import { DB } from './deps.js'

const createTable = name => `
CREATE TABLE IF NOT EXISTS ${name} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT,
  value TEXT,
  ttl INTEGER
)
`
const insertDoc = (table) => `
insert into ${table} (key,value) values (?, ?)`
export default (db) => {

  const createStore = (name) => {
    try {
      console.log(createTable(name))
      db.query(createTable(name))
      return Promise.resolve(({ ok: true }))
    } catch (e) {
      console.log(e)
      return Promise.reject({ ok: false, status: 500, msg: 'Could not create store!' })
    }
  }

  const createDoc = ({ store, key, value, ttl }) => {
    console.log(insertDoc(store))
    try {
      db.query(insertDoc(store), [key, JSON.stringify(value)]) //ttl
      return Promise.resolve({ ok: true })
    } catch (e) {
      console.log(e)
      return Promise.resolve({ ok: false, status: 409 })
    }
  }

  const deleteDoc = async ({ store, key }) => {
    //const res = await stores[store].del(key)
    db.query(`delete from ${store} where key = ?`, [key])
    return ({ ok: true })
  }

  return {
    createStore,
    createDoc,
    deleteDoc
  }
}