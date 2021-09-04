import adapter from "./adapter.js";
import PORT_NAME from "./port_name.js";

export default ({ dir = "." }) => ({
  id: "keyv",
  port: PORT_NAME,
  load: () => new DB(`${dir}/cache.db`), // load env
  link: (env) => (_) => adapter(env), // link adapter
});
