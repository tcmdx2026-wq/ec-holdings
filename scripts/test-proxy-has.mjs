// Verify: array Proxy WITHOUT 'has' trap breaks .filter()/.map() called DIRECTLY on the proxy
// (Array.prototype.filter/map use HasProperty → proxy without 'has' trap falls back to
//  the empty array target → every index looks like a hole → result is empty).
const centers = [{ code: "VP" }, { code: "LB" }, { code: "SD" }];

// Proxy exactly like CENTERS in src/lib/catalog.ts (only 'get' trap)
const proxyLikeCenters = new Proxy([], {
  get(_, prop) {
    if (prop === Symbol.iterator) return centers[Symbol.iterator].bind(centers);
    if (typeof prop === "string" && !Number.isNaN(Number(prop))) return centers[Number(prop)];
    return centers[prop];
  },
});

// Proxy WITH 'has' trap added (the proposed fix)
const fixedProxy = new Proxy([], {
  get(_, prop) {
    if (prop === Symbol.iterator) return centers[Symbol.iterator].bind(centers);
    if (typeof prop === "string" && !Number.isNaN(Number(prop))) return centers[Number(prop)];
    return centers[prop];
  },
  has(_, prop) {
    return prop in centers;
  },
});

const brokenFilter = proxyLikeCenters.filter((c) => !!c);
const brokenMap = proxyLikeCenters.map((c) => c.code);
const fixedFilter = fixedProxy.filter((c) => !!c);
const fixedMap = fixedMapWorks(fixedProxy);

function fixedMapWorks(p) {
  return p.map((c) => c.code);
}

console.log("filter DIRECT on proxy WITHOUT has trap →", brokenFilter.length, "items (expect 0 = BUG)");
console.log("map DIRECT on proxy WITHOUT has trap    →", brokenMap.length, "items (expect 0 = BUG)");
console.log("filter DIRECT on proxy WITH has trap    →", fixedFilter.length, "items (expect 3 = FIXED)");
console.log("map DIRECT on proxy WITH has trap       →", fixedMap.length, "items (expect 3 = FIXED)");
console.log("find on proxy WITHOUT has trap          →", proxyLikeCenters.find((c) => c.code === "LB")?.code ?? "undefined", "(expect LB — find uses Get, works)");

if (brokenFilter.length === 0 && brokenMap.length === 0 && fixedFilter.length === 3 && fixedMap.length === 3) {
  console.log("PASS: missing 'has' trap is the root cause; adding it fixes filter/map");
  process.exit(0);
} else {
  console.log("FAIL: unexpected result");
  process.exit(1);
}
