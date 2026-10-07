import { expect, test } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { makeTextPdf } from "./pdf-fixture.mjs";

const timings = [];

test.describe.configure({ mode: "serial" });

test("3-page PDF reaches TinyPath", async ({ page }) => {
  const pdf = makeTextPdf([
    ["The water cycle", "Evaporation from oceans", "Condensation makes clouds"],
    ["Precipitation falls as rain", "Collection in lakes and rivers"],
    ["Runoff returns water to the sea", "The sun drives the cycle"],
  ]);
  await page.goto("/homework");
  const started = Date.now();
  await page.getByTestId("scan-file").setInputFiles({
    name: "water-cycle.pdf",
    mimeType: "application/pdf",
    buffer: pdf,
  });
  await expect(page.getByTestId("page-count")).toHaveText("3 pages", { timeout: 20_000 });
  await page.getByRole("button", { name: "Generate tiny path" }).click({ timeout: 25_000 });
  await expect(page.getByRole("list", { name: "Tiny level path" })).toBeVisible({ timeout: 25_000 });
  await expect(page.locator(".tiny-path-node").first()).toHaveClass(/is-current/);
  const elapsed = Date.now() - started;
  expect(elapsed).toBeLessThan(30_000);
  const html = await page.content();
  expect(html).not.toContain("correctOptionId");
  expect(html).not.toContain("parentHint");
  expect(html).not.toContain("answerKey");
  timings.push({ flow: "pdf-3-page", ms: elapsed });
  console.log(`PDF_MS ${elapsed}`);
});

test("12MP photo reaches TinyPath", async ({ page }) => {
  await page.goto("/homework");
  const b64 = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 4000;
    canvas.height = 3000;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 4000, 3000);
    ctx.fillStyle = "#111111";
    ctx.font = "bold 140px sans-serif";
    const lines = [
      "The water cycle",
      "Evaporation from the ocean",
      "Condensation makes clouds",
      "Precipitation falls as rain",
      "Collection in lakes and rivers",
    ];
    lines.forEach((line, index) => ctx.fillText(line, 120, 420 + index * 280));
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((value) => (value ? resolve(value) : reject(new Error("blob"))), "image/jpeg", 0.85);
    });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let index = 0; index < bytes.length; index += 4096) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 4096));
    }
    return { b64: btoa(binary), bytes: bytes.length };
  });
  console.log(`PHOTO_SOURCE_BYTES ${b64.bytes}`);
  let uploadBytes = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/homework/extract") && request.method() === "POST") {
      uploadBytes = request.postDataBuffer()?.length ?? 0;
    }
  });
  const started = Date.now();
  await page.getByTestId("scan-file").setInputFiles({
    name: "worksheet.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from(b64.b64, "base64"),
  });
  await expect(page.getByTestId("page-count")).toHaveText("1 page", { timeout: 20_000 });
  await page.getByRole("button", { name: "Generate tiny path" }).click({ timeout: 25_000 });
  await expect(page.getByRole("list", { name: "Tiny level path" })).toBeVisible({ timeout: 25_000 });
  await expect(page.locator(".tiny-path-node").first()).toHaveClass(/is-current/);
  const elapsed = Date.now() - started;
  expect(elapsed).toBeLessThan(30_000);
  expect(uploadBytes).toBeGreaterThan(0);
  expect(uploadBytes).toBeLessThan(3.5 * 1024 * 1024);
  const html = await page.content();
  expect(html).not.toContain("correctOptionId");
  expect(html).not.toContain("parentHint");
  timings.push({ flow: "photo-12mp", ms: elapsed, uploadBytes });
  console.log(`PHOTO_MS ${elapsed} UPLOAD_BYTES ${uploadBytes}`);
  writeFileSync("/tmp/scan-timings.json", JSON.stringify(timings, null, 2));
});
