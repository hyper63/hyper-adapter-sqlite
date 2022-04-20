import { DB } from "./deps.js";
import adapter from "./adapter.js";
import {
  assert,
  assertEquals,
  validateCacheAdapterSchema,
} from "./dev_deps.js";

const cache = adapter(new DB(`./test.db`));
const test = Deno.test;

test("should implement the port", () => {
  assert(validateCacheAdapterSchema(cache));
});

test("should escape/quote special characters", async () => {
  const res = await cache.createStore("test-special_default~characters");
  assert(res.ok);
});

test("create cache doc", async () => {
  await cache.createStore("test");
  const res = await cache.createDoc({
    store: "test",
    key: "1",
    value: { type: "movie", title: "Ghostbusters" },
  });
  assert(res.ok);
  await cache.deleteDoc({ store: "test", key: "1" });
});

test("get cache document", async () => {
  await cache.createStore("test");
  await cache.createDoc({
    store: "test",
    key: "2",
    value: { type: "movie", title: "Star Wars" },
  });
  const res = await cache.getDoc({ store: "test", key: "2" });
  assertEquals(res.type, "movie");
  assertEquals(res.title, "Star Wars");
  await cache.deleteDoc({ store: "test", key: "2" });
});

test("get cache document not found", async () => {
  await cache.createStore("test");
  const res = await cache.getDoc({ store: "test", key: "3" });
  assert(!res.ok);
  assertEquals(res.status, 404);
  await cache.deleteDoc({ store: "test", key: "3" });
});

test("update cache document", async () => {
  await cache.createStore("test");
  await cache.createDoc({
    store: "test",
    key: "4",
    value: { type: "movie", title: "Star Trek" },
  });
  const res = await cache.updateDoc({
    store: "test",
    key: "4",
    value: { type: "movie", title: "Star Trek", year: "1981" },
  });
  assert(res.ok);
  const movie = await cache.getDoc({
    store: "test",
    key: "4",
  });
  assertEquals(movie.year, "1981");
  await cache.deleteDoc({
    store: "test",
    key: "4",
  });
});

test("update cache document not found should upsert", async () => {
  await cache.createStore("test");
  const res = await cache.updateDoc({
    store: "test",
    key: "6",
    value: { type: "movie", title: "The last start fighter", year: "1989" },
  });
  assert(res.ok);
});

test("list documents by pattern", async () => {
  // setup
  const store = "test";
  await cache.createStore(store);
  await cache.createDoc({
    store,
    key: "team-1",
    value: { name: "Atlanta Braves" },
  });
  await cache.createDoc({
    store,
    key: "team-2",
    value: { name: "Carolina Panthers" },
  });
  await cache.createDoc({
    store,
    key: "team-3",
    value: { name: "Georgia Bulldogs" },
  });

  // test
  const res = await cache.listDocs({
    store: "test",
    pattern: "team-*",
  });
  assert(res.ok);
  assertEquals(res.docs.length, 3);
  // clean up
  await cache.deleteDoc({ store, key: "team-1" });
  await cache.deleteDoc({ store, key: "team-2" });
  await cache.deleteDoc({ store, key: "team-3" });
});

test("destroy cache", async () => {
  const store = "test";
  await cache.createStore(store);

  const res = await cache.destroyStore(store);
  assert(res.ok);
});

test("destroy cache should 404 if does not exist", async () => {
  const store = "test";
  const res = await cache.destroyStore(store);
  assert(!res.ok);
  assertEquals(res.status, 404);
});

test("ttl feature expired", async () => {
  // setup
  const store = "test";
  await cache.createStore(store);
  await cache.createDoc({
    store,
    key: "item-8",
    value: { name: "Temp Item" },
    ttl: 1,
  });
  const team = await cache.getDoc({
    store: "test",
    key: "item-8",
  });
  assertEquals(team.ok, false);
  assertEquals(team.status, 404);
  // clean up
  await cache.deleteDoc({ store, key: "item-8" });
});

test("ttl feature not expired", async () => {
  // setup
  const store = "test";
  await cache.createStore(store);
  await cache.createDoc({
    store,
    key: "item-10",
    value: { name: "Temp Item 2" },
    ttl: 1000 * 60 * 60,
  });
  const team = await cache.getDoc({
    store: "test",
    key: "item-10",
  });
  assertEquals(team.name, "Temp Item 2");
  // clean up
  await cache.deleteDoc({ store, key: "item-10" });
});
