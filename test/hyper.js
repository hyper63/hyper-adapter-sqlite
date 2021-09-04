import { appOpine, core } from "../dev_deps.js";
import myAdapter from "../mod.js";
import PORT_NAME from "../port_name.js";

const hyperConfig = {
  app: appOpine,
  adapters: [
    { port: PORT_NAME, plugins: [myAdapter()] },
  ],
};

core(hyperConfig);
