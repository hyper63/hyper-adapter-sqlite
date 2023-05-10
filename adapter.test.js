import { DB } from './deps.js'
import adapter from './adapter.js'
import { assert, assertEquals, assertObjectMatch, validateCacheAdapterSchema } from './dev_deps.js'

const cache = adapter(new DB(`./test.db`))
const test = Deno.test

test('should implement the port', () => {
  assert(validateCacheAdapterSchema(cache))
})

test('should escape/quote special characters', async () => {
  const res = await cache.createStore('test-special_default~characters')
  assert(res.ok)
  await cache.destroyStore('test-special_default~characters')
})

test('should 409 if cache already exists', async () => {
  await cache.createStore('test')
  const res = await cache.createStore('test')
  assert(!res.ok)
  assertEquals(res.status, 409)
  await cache.destroyStore('test')
})

test('create cache doc', async () => {
  await cache.createStore('test')
  const res = await cache.createDoc({
    store: 'test',
    key: '1',
    value: { type: 'movie', title: 'Ghostbusters' },
  })
  assert(res.ok)
  await cache.destroyStore('test')
})

test('get cache document', async () => {
  await cache.createStore('test')
  await cache.createDoc({
    store: 'test',
    key: '2',
    value: { type: 'movie', title: 'Star Wars' },
  })
  const res = await cache.getDoc({ store: 'test', key: '2' })
  assertEquals(res.type, 'movie')
  assertEquals(res.title, 'Star Wars')
  await cache.destroyStore('test')
})

test('get cache document not found', async () => {
  await cache.createStore('test')
  const res = await cache.getDoc({ store: 'test', key: '3' })
  assert(!res.ok)
  assertEquals(res.status, 404)
  await cache.destroyStore('test')
})

test('update cache document', async () => {
  await cache.createStore('test')
  await cache.createDoc({
    store: 'test',
    key: '4',
    value: { type: 'movie', title: 'Star Trek' },
  })
  const res = await cache.updateDoc({
    store: 'test',
    key: '4',
    value: { type: 'movie', title: 'Star Trek', year: '1981' },
  })
  assert(res.ok)
  const movie = await cache.getDoc({
    store: 'test',
    key: '4',
  })
  assertEquals(movie.year, '1981')
  await cache.destroyStore('test')
})

test('update cache document not found should upsert', async () => {
  await cache.createStore('test')
  const res = await cache.updateDoc({
    store: 'test',
    key: '6',
    value: { type: 'movie', title: 'The last start fighter', year: '1989' },
  })
  assert(res.ok)
  await cache.destroyStore('test')
})

test('list documents by pattern', async () => {
  // setup
  const store = 'test'
  await cache.createStore(store)
  await cache.createDoc({
    store,
    key: 'team-1',
    value: { name: 'Atlanta Braves' },
  })
  await cache.createDoc({
    store,
    key: 'team-2',
    value: { name: 'Carolina Panthers' },
  })
  await cache.createDoc({
    store,
    key: 'team-3',
    value: { name: 'Georgia Bulldogs' },
  })

  // test
  const res = await cache.listDocs({
    store: 'test',
    pattern: 'team-*',
  })
  assert(res.ok)
  assertEquals(res.docs.length, 3)
  // clean up
  await cache.destroyStore('test')
})

test('destroy cache', async () => {
  const store = 'test'
  await cache.createStore(store)

  const res = await cache.destroyStore(store)
  assert(res.ok)
})

test('destroy cache should 404 if does not exist', async () => {
  const store = 'test'
  const res = await cache.destroyStore(store)
  assert(!res.ok)
  assertEquals(res.status, 404)
})

test('all methods should 404 if does not exist', async () => {
  const res = await cache.getDoc({ store: 'test', key: '1' })
  assert(!res.ok)
  assertEquals(res.status, 404)
})

test('ttl feature expired', async () => {
  // setup
  const store = 'test'
  await cache.createStore(store)
  await cache.createDoc({
    store,
    key: 'item-8',
    value: { name: 'Temp Item' },
    ttl: 1,
  })
  const team = await cache.getDoc({
    store,
    key: 'item-8',
  })
  assertEquals(team.ok, false)
  assertEquals(team.status, 404)

  await cache.createDoc({
    store,
    key: 'item-9',
    value: { name: 'Temp Item' },
    ttl: 1,
  })
  await cache.createDoc({
    store,
    key: 'item-10',
    value: { name: 'Temp Item' },
    ttl: 1,
  })

  await new Promise((resolve) => setTimeout(resolve, 10))

  const res = await cache.listDocs({
    store,
    pattern: 'item-*',
  })
  assertEquals(res.docs.length, 0)

  // clean up
  await cache.destroyStore('test')
})

test('ttl feature mixed', async () => {
  // setup
  const store = 'test'
  await cache.createStore(store)

  // this document will be evicted
  await cache.createDoc({
    store,
    key: 'item-8',
    value: { name: 'Temp Item' },
    ttl: 1,
  })

  // these will not
  await cache.createDoc({
    store,
    key: 'item-9',
    value: { name: 'Temp Item 9' },
    ttl: 1000 * 60 * 60,
  })

  await cache.createDoc({
    store,
    key: 'item-10',
    value: { name: 'Temp Item 10' },
    ttl: 1000 * 60 * 60,
  })

  await new Promise((resolve) => setTimeout(resolve, 10))

  const res = await cache.listDocs({
    store,
    pattern: 'item-*',
  })

  assert(res.ok)
  assertEquals(res.docs.length, 2)
  // clean up
  await cache.destroyStore('test')
})

test('ttl feature not expired', async () => {
  // setup
  const store = 'test'
  await cache.createStore(store)
  await cache.createDoc({
    store,
    key: 'item-10',
    value: { name: 'Temp Item 2' },
    ttl: 1000 * 60 * 60,
  })
  const team = await cache.getDoc({
    store,
    key: 'item-10',
  })
  assertEquals(team.name, 'Temp Item 2')

  const res = await cache.listDocs({
    store,
    pattern: 'item-10',
  })
  assertEquals(res.docs.length, 1)
  // clean up
  await cache.destroyStore('test')
})

test('ttl feature negative ttl should immediately expire', async () => {
  await cache.createStore('test')
  await cache.createDoc({
    store: 'test',
    key: '1',
    value: { type: 'movie', title: 'Ghostbusters' },
    ttl: -100,
  })

  const res = await cache.getDoc({
    store: 'test',
    key: '1',
  })

  await new Promise((resolve) => setTimeout(resolve, 20))

  assertObjectMatch(res, {
    ok: false,
    status: 404,
  })

  await cache.destroyStore('test')
})
