import adapter from "./adapter.js";
import PORT_NAME from "./port_name.js";
import { DB } from "./deps.js";

let db = null;

export default (config) => ({
  id: "sqlite",
  port: PORT_NAME,
  load: () => {
    const dir = config.dir || ".";
    db = new DB(`${dir}/cache.db`);
    return db; // load env
  },
  link: (env) => (_) => adapter(env), // link adapter
});

window.addEventListener("unload", () => {
  if (db) db.close();
});
