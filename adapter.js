import { DB } from './deps.js'

export default ({ dir }) => {
  const DBFILE = `${dir}/cache.db`
  let stores = {}
  const storeDb = new DB(DBFILE, 'stores')
  storeDb.init()
  // TODO: load all existing stores from stores db..

  const createStore = async (name) => {
    try {
      stores.name = new DB(DBFILE, name)
      stores.name.init()
      await storeDb.set(name, true)
      return ({ ok: true })
    } catch (e) {
      return ({ ok: false, status: 500, msg: 'Could not create database!' })
    }
  }

  const createDoc = async ({ store, key, value, ttl }) => {

    const res = await stores[store].set(key, value)
    console.log(res)
    return ({ ok: true })
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