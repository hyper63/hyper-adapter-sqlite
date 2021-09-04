import adapter from "./adapter.js";
import PORT_NAME from "./port_name.js";

export default ({ dir = "." }) => ({
  id: "keyv",
  port: PORT_NAME,
  load: () => ({ dir }), // load env
  link: (env) => (_) => adapter(env), // link adapter
});
