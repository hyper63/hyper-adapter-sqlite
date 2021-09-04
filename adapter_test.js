import adapter from "./adapter.js";
import { assert } from "./dev_deps.js";

const cache = adapter({ dir: "/tmp" });
const test = Deno.test;

test("create cache store", async () => {
  await cache.createStore("test");
  const res = await cache.createDoc({
    store: "test",
    key: "1",
    value: { type: "movie", title: "Ghostbusters" },
  });
  assert(res.ok);
  await cache.deleteDoc("1");
});
