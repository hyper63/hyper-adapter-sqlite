// Harness deps
import { default as appExpress } from 'https://raw.githubusercontent.com/hyper63/hyper/hyper-app-express%40v1.2.1/packages/app-express/mod.ts'
import { default as core } from 'https://raw.githubusercontent.com/hyper63/hyper/hyper%40v4.3.2/packages/core/mod.ts'

import myAdapter from '../mod.js'
import PORT_NAME from '../port_name.js'

const hyperConfig = {
  app: appExpress,
  adapters: [
    { port: PORT_NAME, plugins: [myAdapter({ dir: '/tmp' })] },
  ],
}

core(hyperConfig)
