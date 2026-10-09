import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Ambil definisi murni groupCount/groupRects dari app.js (tanpa DOM).
const src = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const m = src.match(/function groupCount[\s\S]*?\n\}\nfunction groupRects[\s\S]*?\n\}/);
assert.ok(m, "groupCount/groupRects harus ada di app.js");
const { groupCount, groupRects } = new Function(`${m[0]}; return {groupCount, groupRects};`)();

const frames = JSON.parse(readFileSync(new URL("../frames.json", import.meta.url), "utf8"));

test("strip-kecil: jumlah foto = jumlah grup", () => {
  const f = frames.find((x) => x.id === "stripe-10");
  assert.equal(groupCount(f), 3);
});

test("strip-kecil: grup menunjuk rect kiri+kanan sebaris", () => {
  const f = frames.find((x) => x.id === "stripe-10");
  const r = groupRects(f, 0);
  assert.equal(r.length, 2);
  assert.ok(r[0].x < r[1].x);
  assert.ok(Math.abs(r[0].y - r[1].y) < r[0].h);
});

test("koran: tanpa captureGroups, 1 rect 1 foto", () => {
  const f = frames.find((x) => x.category === "strip-koran");
  assert.equal(groupCount(f), f.slots.length);
  assert.equal(groupRects(f, 0).length, 1);
});

test("semua grup mencakup semua slot tepat sekali", () => {
  for (const f of frames) {
    const n = f.slots.length;
    const seen = new Set();
    for (let k = 0; k < groupCount(f); k++)
      for (const r of groupRects(f, k)) {
        const i = f.slots.indexOf(r);
        assert.ok(i >= 0 && !seen.has(i));
        seen.add(i);
      }
    assert.equal(seen.size, n, f.id);
  }
});

test("strip-kecil: grup kanonis berpasangan sebaris", () => {
  for (const f of frames.filter((x) => x.category === "strip-kecil")) {
    const want = [];
    for (let i = 0; i < f.slots.length; i += 2) want.push([i, i + 1]);
    assert.deepEqual(f.captureGroups, want, f.id);
    for (const [a, b] of f.captureGroups) {
      const A = f.slots[a], B = f.slots[b];
      assert.ok(A.x < B.x, `${f.id}: kiri dulu`);
      const ov = Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y);
      assert.ok(ov >= 0.5 * Math.min(A.h, B.h), `${f.id}: sebaris`);
    }
  }
});
