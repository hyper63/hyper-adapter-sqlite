import { DB } from './deps.js'
import adapter from './adapter.js'
import { assert, assertEquals, assertObjectMatch, cachePort } from './dev_deps.js'

/**
 * Wrap adapter with the port to ensure inputs and outputs are also
 * valid and asserted
 */
const cache = cachePort(adapter(new DB(`./test.db`)))
const test = Deno.test

test('adapter', async (t) => {
  await t.step('ttl', async (t) => {
    await t.step('should expire the document', async () => {
      // setup
      const store = 'test'
      await cache.createStore(store)
      await cache.createDoc({
        store,
        key: 'item-8',
        value: { name: 'Temp Item' },
        ttl: '1',
      })

      await new Promise((resolve) => setTimeout(resolve, 10))

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
        ttl: '1',
      })
      await cache.createDoc({
        store,
        key: 'item-10',
        value: { name: 'Temp Item' },
        ttl: '1',
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

    await t.step('should expire only documents who ttl has elapsed', async () => {
      // setup
      const store = 'test'
      await cache.createStore(store)

      // this document will be expired and removed
      await cache.createDoc({
        store,
        key: 'item-8',
        value: { name: 'Temp Item' },
        ttl: '1',
      })

      // these will not
      await cache.createDoc({
        store,
        key: 'item-9',
        value: { name: 'Temp Item 9' },
        ttl: String(1000 * 60 * 60),
      })

      await cache.createDoc({
        store,
        key: 'item-10',
        value: { name: 'Temp Item 10' },
        ttl: String(1000 * 60 * 60),
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

    await t.step('should return cached docs whose ttl has not elapsed', async () => {
      // setup
      const store = 'test'
      await cache.createStore(store)
      await cache.createDoc({
        store,
        key: 'item-10',
        value: { name: 'Temp Item 2' },
        ttl: String(1000 * 60 * 60),
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

    await t.step('should immediately expire doc with negative ttl', async () => {
      // setup
      await cache.createStore('test')
      await cache.createDoc({
        store: 'test',
        key: '1',
        value: { type: 'movie', title: 'Ghostbusters' },
        ttl: String(-100),
      })

      await new Promise((resolve) => setTimeout(resolve, 10))

      const res = await cache.getDoc({
        store: 'test',
        key: '1',
      })

      assertObjectMatch(res, {
        ok: false,
        status: 404,
      })

      // clean up
      await cache.destroyStore('test')
    })
  })

  await t.step('createStore', async (t) => {
    await t.step('should escape/quote special characters', async () => {
      const res = await cache.createStore('test-special_default~characters')
      assert(res.ok)

      // clean up
      await cache.destroyStore('test-special_default~characters')
    })

    await t.step('should 409 if cache already exists', async () => {
      // setup
      await cache.createStore('test')

      const res = await cache.createStore('test')

      assert(!res.ok)
      assertEquals(res.status, 409)

      // clean up
      await cache.destroyStore('test')
    })
  })

  await t.step('createDoc', async (t) => {
    await t.step('should create the cache doc', async () => {
      // setup
      await cache.createStore('test')

      const res = await cache.createDoc({
        store: 'test',
        key: '1',
        value: { type: 'movie', title: 'Ghostbusters' },
      })
      assert(res.ok)

      // clean up
      await cache.destroyStore('test')
    })
  })

  await t.step('getDoc', async (t) => {
    await t.step('should get the cached document', async () => {
      // setup
      await cache.createStore('test')
      await cache.createDoc({
        store: 'test',
        key: '2',
        value: { type: 'movie', title: 'Star Wars' },
      })

      const res = await cache.getDoc({ store: 'test', key: '2' })

      assertEquals(res.type, 'movie')
      assertEquals(res.title, 'Star Wars')

      // clean up
      await cache.destroyStore('test')
    })

    await t.step('should return a HyperErr with status 404 if not found', async () => {
      // setup
      await cache.createStore('test')

      const res = await cache.getDoc({ store: 'test', key: '3' })

      assertObjectMatch(res, {
        ok: false,
        status: 404,
      })

      // clean up
      await cache.destroyStore('test')
    })
  })

  await t.step('updateDoc', async (t) => {
    await t.step('should update the cache doc', async () => {
      // setup
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

      // clean up
      await cache.destroyStore('test')
    })

    test('should upsert the cached document if not found', async () => {
      // setup
      await cache.createStore('test')

      const res = await cache.updateDoc({
        store: 'test',
        key: '6',
        value: { type: 'movie', title: 'The last start fighter', year: '1989' },
      })
      assert(res.ok)
      const movie = await cache.getDoc({
        store: 'test',
        key: '6',
      })
      assertEquals(movie.year, '1989')

      // clean up
      await cache.destroyStore('test')
    })
  })

  await t.step('deleteDoc', async (t) => {
    await t.step('should remove the document', async () => {
      // setup
      await cache.createStore('test')
      await cache.createDoc({
        store: 'test',
        key: '4',
        value: { type: 'movie', title: 'Star Trek' },
      })

      const res = await cache.deleteDoc({
        store: 'test',
        key: '4',
      })
      assert(res.ok)
      const notFound = await cache.getDoc({
        store: 'test',
        key: '4',
      })
      assertObjectMatch(notFound, {
        ok: false,
        status: 404,
      })

      // clean up
      await cache.destroyStore('test')
    })
  })

  await t.step('listDocs', async (t) => {
    await t.step('should return documents whose key matches the pattern', async () => {
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
  })

  await t.step('destroyStore', async (t) => {
    await t.step('should remove the cache store', async () => {
      // setup
      const store = 'test'
      await cache.createStore(store)

      const res = await cache.destroyStore(store)
      assert(res.ok)
    })

    test('should return a HyperErr with status 404 if cache store does not exist', async () => {
      const store = 'test'
      const res = await cache.destroyStore(store)
      assert(!res.ok)
      assertEquals(res.status, 404)
    })
  })
})
