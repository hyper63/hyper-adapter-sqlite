import adapter from "./adapter.js";
import PORT_NAME from "./port_name.js";
import { DB } from './deps.js'

export default (config) => ({
  id: "sqlite",
  port: PORT_NAME,
  load: () => {
    const dir = config.dir || '.'
    return new DB(`${dir}/cache.db`) // load env
  },
  link: (env) => (_) => adapter(env), // link adapter
});
