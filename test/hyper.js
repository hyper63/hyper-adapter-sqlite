// Harness deps
import { default as appExpress } from 'https://x.nest.land/hyper-app-express@1.0.0/mod.ts'
import { default as core } from 'https://x.nest.land/hyper@3.4.2/mod.js'

import myAdapter from '../mod.js'
import PORT_NAME from '../port_name.js'

const hyperConfig = {
  app: appExpress,
  adapters: [
    { port: PORT_NAME, plugins: [myAdapter({ dir: '/tmp' })] },
  ],
}

core(hyperConfig)
