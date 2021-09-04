import { DB } from './deps.js'
import adapter from "./adapter.js";
import { assert } from "./dev_deps.js";

const cache = adapter(new DB(`./test.db`));
const test = Deno.test;

test("create cache store", async () => {
  await cache.createStore("test");
  const res = await cache.createDoc({
    store: "test",
    key: "1",
    value: { type: "movie", title: "Ghostbusters" },
  });
  console.log(res)
  assert(res.ok);
  await cache.deleteDoc({ store: 'test', key: '1' });

});
