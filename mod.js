import adapter from './adapter.js'
import PORT_NAME from './port_name.js'
import { DB } from './deps.js'

export default (config = {}) => ({
  id: 'sqlite',
  port: PORT_NAME,
  load: () => {
    const dir = config.dir || '.'
    const db = new DB(`${dir}/cache.db`)

    addEventListener('unload', () => {
      if (db) {
        try {
          db.close(true)
        } catch (e) {
          console.log(e)
        }
      }
    })

    return db // load env
  },
  link: (env) => (_) => adapter(env), // link adapter
})
