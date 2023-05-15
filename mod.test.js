import { assert, pluginFactory } from './dev_deps.js'

import factory from './mod.js'

Deno.test('validate factory schema', () => {
  assert(pluginFactory(factory()))
})
