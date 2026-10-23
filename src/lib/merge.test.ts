import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseTs, mergeByTs } from "./merge.ts";

type Row = { id: string; updatedAt: string };

const t = (iso: string): Row => ({ id: iso, updatedAt: iso });

describe("parseTs", () => {
  it("parses ISO strings", () => {
    const iso = "2026-09-03T07:00:00.000Z";
    assert.equal(parseTs(iso), Date.parse(iso));
  });

  it("parses Postgres timestamptz strings (space + +00)", () => {
    const ts = parseTs("2026-09-03 07:00:00+00");
    assert.equal(ts, Date.parse("2026-09-03T07:00:00+00:00"));
  });

  it("parses Date objects", () => {
    const d = new Date("2026-09-03T07:00:00.000Z");
    assert.equal(parseTs(d), d.getTime());
  });

  it("parses YYYY-MM-DD HH:MM (task updated format)", () => {
    const ts = parseTs("2026-09-03 07:30");
    assert.ok(ts > 0);
  });

  it("returns 0 for empty / invalid input", () => {
    assert.equal(parseTs(null), 0);
    assert.equal(parseTs(undefined), 0);
    assert.equal(parseTs("not-a-date"), 0);
  });
});

describe("mergeByTs (local is source of truth)", () => {
  it("adds new records coming from Neon (another device)", () => {
    const out = mergeByTs<Row>([t("local-1")], [t("neon-1")], new Set(), (r) => r.updatedAt);
    assert.deepEqual(out.map((r) => r.id).sort(), ["local-1", "neon-1"]);
  });

  it("keeps local records that are still pending sync even if Neon has the id", () => {
    const pending = new Set(["local-pending"]);
    const out = mergeByTs<Row>(
      [{ id: "local-pending", updatedAt: "2026-09-03T01:00:00.000Z" }],
      [{ id: "local-pending", updatedAt: "2026-09-03T09:00:00.000Z" }],
      pending,
      (r) => r.updatedAt,
    );
    assert.equal(out[0].updatedAt, "2026-09-03T01:00:00.000Z"); // local kept
  });

  it("keeps local records that Neon does not have (local source of truth)", () => {
    const out = mergeByTs<Row>([t("local-only")], [], new Set(), (r) => r.updatedAt);
    assert.equal(out.length, 1);
    assert.equal(out[0].id, "local-only");
  });

  it("uses the NEWER version (LWW by updatedAt) when not pending", () => {
    const out = mergeByTs<Row>(
      [{ id: "x", updatedAt: "2026-09-03T01:00:00.000Z" }],
      [{ id: "x", updatedAt: "2026-09-03T09:00:00.000Z" }],
      new Set(),
      (r) => r.updatedAt,
    );
    assert.equal(out[0].updatedAt, "2026-09-03T09:00:00.000Z"); // Neon newer

    const out2 = mergeByTs<Row>(
      [{ id: "x", updatedAt: "2026-09-03T09:00:00.000Z" }],
      [{ id: "x", updatedAt: "2026-09-03T01:00:00.000Z" }],
      new Set(),
      (r) => r.updatedAt,
    );
    assert.equal(out2[0].updatedAt, "2026-09-03T09:00:00.000Z"); // local newer
  });

  it("treats equal timestamps as Neon (official copy after retry)", () => {
    const out = mergeByTs<Row>(
      [{ id: "x", updatedAt: "2026-09-03T07:00:00.000Z" }],
      [{ id: "x", updatedAt: "2026-09-03T07:00:00.000Z", extra: 1 } as Row],
      new Set(),
      (r) => r.updatedAt,
    );
    assert.equal((out[0] as Row & { extra?: number }).extra, 1); // Neon version used
  });

  it("without a version timestamp, Neon is authoritative for non-pending records", () => {
    const out = mergeByTs<{ id: string; name: string }>(
      [{ id: "x", name: "local" }],
      [{ id: "x", name: "neon" }],
      new Set(),
    );
    assert.equal(out[0].name, "neon");
  });
});