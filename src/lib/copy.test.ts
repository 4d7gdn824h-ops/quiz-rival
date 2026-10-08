import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  QUIZ_TITLE_LIMIT,
  QUIZ_TITLE_TARGET,
  possessive,
  scanPageCountLabel,
  shortQuizTitle,
  turnLabel,
} from "./copy.ts";

describe("scanPageCountLabel", () => {
  it("stays grammatical for one page and for many", () => {
    assert.equal(scanPageCountLabel(1, 6), "1 of 6 pages");
    assert.equal(scanPageCountLabel(5, 6), "5 of 6 pages");
    assert.equal(scanPageCountLabel(6, 6), "6 of 6 pages");
  });
});

describe("possessive", () => {
  it("turns the default player into Your turn", () => {
    assert.equal(possessive("You"), "Your");
    assert.equal(possessive(" you "), "Your");
    assert.equal(turnLabel("You"), "Your turn");
    assert.equal(turnLabel(""), "Your turn");
  });

  it("uses s' for names ending in s and 's otherwise", () => {
    assert.equal(turnLabel("Ana"), "Ana's turn");
    assert.equal(turnLabel("James"), "James' turn");
    assert.equal(turnLabel("Chris"), "Chris' turn");
    assert.equal(possessive("Antek"), "Antek's");
  });
});

describe("shortQuizTitle", () => {
  it("keeps a title that is already about 60 characters or shorter", () => {
    assert.equal(shortQuizTitle("Water cycle", ["Evaporation"]), "Water cycle");
    const fifty = "A".repeat(50);
    assert.equal(shortQuizTitle(fifty, ["Cells"]), fifty);
    assert.equal(shortQuizTitle(`  ${"B".repeat(QUIZ_TITLE_LIMIT)}  `, []), "B".repeat(QUIZ_TITLE_LIMIT));
  });

  it("falls back to the first topic when the title is longer than about 60 characters", () => {
    const long = "Biology worksheet on cell structure and organelles for class 7";
    assert.ok(long.length > QUIZ_TITLE_LIMIT);
    assert.equal(shortQuizTitle(long, ["  Cells  ", "Mitochondria"]), "Cells");
  });

  it("clips to about 40 characters when there is no short topic", () => {
    const long = "C".repeat(80);
    assert.equal(shortQuizTitle(long, []), "C".repeat(QUIZ_TITLE_TARGET));
    assert.equal(shortQuizTitle(long, ["", "  "]), "C".repeat(QUIZ_TITLE_TARGET));
    const hugeTopic = "D".repeat(90);
    assert.equal(shortQuizTitle(long, [hugeTopic]), "D".repeat(QUIZ_TITLE_TARGET));
  });

  it("asks the generator for a title of at most about 40 characters", () => {
    const source = readFileSync(new URL("./homework/generate.ts", import.meta.url), "utf8");
    assert.match(source, /at most 40 characters/);
    assert.match(source, /shortQuizTitle\(/);
  });
});
