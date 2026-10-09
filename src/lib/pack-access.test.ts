import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hashParentKey,
  newParentKey,
  packsForPublicList,
  parentKeyMatches,
  randomPackId,
  resolveAnswerKeyAccess,
} from "./pack-access.ts";

describe("public pack list", () => {
  it("returns no user packs", () => {
    const listed = packsForPublicList([
      { id: "warmup-en", generated: false, title: "Warm-up" },
      { id: randomPackId(), generated: true, title: "Someone's worksheet" },
      { id: randomPackId(), generated: true, title: "Another family" },
    ]);
    assert.deepEqual(
      listed.map((pack) => pack.id),
      ["warmup-en"],
    );
  });
});

describe("answer key access", () => {
  const secret = newParentKey();
  const hash = hashParentKey(secret);
  const packId = randomPackId();

  it("returns 404 for a random or guessed id", () => {
    const access = resolveAnswerKeyAccess({
      packId: randomPackId(),
      builtIn: false,
      exists: false,
      parentKeyHash: null,
      parentKey: secret,
    });
    assert.deepEqual(access, { ok: false });
  });

  it("returns 404 for a wrong or missing secret", () => {
    assert.deepEqual(
      resolveAnswerKeyAccess({
        packId,
        builtIn: false,
        exists: true,
        parentKeyHash: hash,
        parentKey: newParentKey(),
      }),
      { ok: false },
    );
    assert.deepEqual(
      resolveAnswerKeyAccess({
        packId,
        builtIn: false,
        exists: true,
        parentKeyHash: hash,
        parentKey: null,
      }),
      { ok: false },
    );
    assert.deepEqual(
      resolveAnswerKeyAccess({
        packId,
        builtIn: false,
        exists: true,
        parentKeyHash: hash,
        parentKey: "",
      }),
      { ok: false },
    );
  });

  it("returns the key for the right secret and keeps built-in demos open", () => {
    assert.deepEqual(
      resolveAnswerKeyAccess({
        packId,
        builtIn: false,
        exists: true,
        parentKeyHash: hash,
        parentKey: secret,
      }),
      { ok: true },
    );
    assert.equal(parentKeyMatches(secret, hash), true);
    assert.deepEqual(
      resolveAnswerKeyAccess({
        packId: "warmup-en",
        builtIn: true,
        exists: true,
        parentKeyHash: null,
        parentKey: null,
      }),
      { ok: true },
    );
  });
});

describe("pack ids", () => {
  it("are long and random", () => {
    const ids = new Set(Array.from({ length: 24 }, () => randomPackId()));
    assert.equal(ids.size, 24);
    for (const id of ids) {
      assert.equal(Buffer.from(id, "base64url").length, 16);
      assert.match(id, /^[A-Za-z0-9_-]{22}$/);
      assert.equal(id.includes("hw"), false);
      assert.equal(/^\d+$/.test(id), false);
    }
    const keys = new Set(Array.from({ length: 8 }, () => newParentKey()));
    assert.equal(keys.size, 8);
    for (const key of keys) {
      assert.equal(Buffer.from(key, "base64url").length, 16);
    }
  });
});
