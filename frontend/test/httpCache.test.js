import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchJsonWithCache,
  invalidateApiCache,
} from "../services/http.js";

const deferred = () => {
  let resolve;
  const promise = new Promise((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
};

test("cache invalidation does not reuse or overwrite with an older in-flight request", async (context) => {
  const first = deferred();
  const second = deferred();
  const originalFetch = globalThis.fetch;
  let calls = 0;

  globalThis.fetch = async () => {
    calls += 1;
    return calls === 1 ? first.promise : second.promise;
  };
  context.after(() => {
    globalThis.fetch = originalFetch;
    invalidateApiCache();
  });

  const url = "https://example.test/student/enrollments";
  const firstRequest = fetchJsonWithCache(url, {}, { ttlMs: 60_000 });
  invalidateApiCache("/student/enrollments");
  const secondRequest = fetchJsonWithCache(url, {}, { ttlMs: 60_000 });

  assert.equal(calls, 2);

  first.resolve(new Response(JSON.stringify({ version: 1 }), {
    status: 200,
    headers: { "content-type": "application/json" },
  }));
  assert.deepEqual(await firstRequest, { version: 1 });

  const joinedSecondRequest = fetchJsonWithCache(url, {}, { ttlMs: 60_000 });
  assert.equal(calls, 2);

  second.resolve(new Response(JSON.stringify({ version: 2 }), {
    status: 200,
    headers: { "content-type": "application/json" },
  }));

  assert.deepEqual(await secondRequest, { version: 2 });
  assert.deepEqual(await joinedSecondRequest, { version: 2 });
  assert.deepEqual(
    await fetchJsonWithCache(url, {}, { ttlMs: 60_000 }),
    { version: 2 },
  );
  assert.equal(calls, 2);
});
