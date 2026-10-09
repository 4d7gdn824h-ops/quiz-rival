import { expect, test } from "@playwright/test";
import { makeTextPdf } from "./pdf-fixture.mjs";

test.describe.configure({ mode: "serial" });

async function jpegBuffer(page, label) {
  const b64 = await page.evaluate(async (text) => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 640, 480);
    ctx.fillStyle = "#111111";
    ctx.font = "bold 42px sans-serif";
    ctx.fillText(text, 40, 240);
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((value) => (value ? resolve(value) : reject(new Error("blob"))), "image/jpeg", 0.85);
    });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let index = 0; index < bytes.length; index += 4096) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 4096));
    }
    return btoa(binary);
  }, label);
  return Buffer.from(b64, "base64");
}

async function expectQuestion1(page) {
  await page.evaluate(() => {
    const target = window;
    target.__scanClicks = 0;
    if (target.__scanClickListener) {
      document.removeEventListener("click", target.__scanClickListener, true);
    }
    target.__scanClickListener = () => {
      target.__scanClicks += 1;
    };
    document.addEventListener("click", target.__scanClickListener, true);
  });
  await expect(page.getByTestId("scan-checklist")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("question-1")).toBeVisible({ timeout: 30_000 });
  const extraClicks = await page.evaluate(() => window.__scanClicks);
  expect(extraClicks).toBe(0);
  await expect(page.getByText("Generate tiny path")).toHaveCount(0);
  await expect(page.getByText(/Looks right\?|Confirm topics|Let's go/)).toHaveCount(0);
  await expect(page.getByLabel(/grade|topic|your name/i)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /Water evaporates from oceans/ })).toBeVisible();
  await expect(page.getByText("Your turn")).toBeVisible();
}

test("five photos go straight to the quiz; a seventh page is blocked", async ({ page }) => {
  await page.goto("/homework");
  const seven = [];
  for (let index = 1; index <= 7; index += 1) {
    seven.push({
      name: `page-${index}.jpg`,
      mimeType: "image/jpeg",
      buffer: await jpegBuffer(page, `Worksheet page ${index}`),
    });
  }

  await page.getByTestId("scan-file").setInputFiles(seven);
  await expect(page.getByTestId("page-cap")).toHaveText(
    "Up to 6 pages at a time — remove one to add another.",
    { timeout: 20_000 },
  );
  await expect(page.getByTestId("page-thumb")).toHaveCount(6);
  await expect(page.getByTestId("make-quiz")).toBeVisible();
  await expect(page.getByLabel("Worksheet language")).toHaveCount(0);
  await expect(page.getByText("Generate tiny path")).toHaveCount(0);
  await page.getByTestId("make-quiz").click();
  await expectQuestion1(page);

  await page.goto("/homework");
  const five = seven.slice(0, 5);
  let scanBodies = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/homework/scan") && request.method() === "POST") {
      scanBodies += 1;
      const raw = request.postData() || "";
      const body = JSON.parse(raw);
      expect(body.pages).toHaveLength(5);
      expect(Buffer.byteLength(raw)).toBeLessThan(4 * 1024 * 1024);
    }
    expect(request.url()).not.toContain("/api/homework/extract");
    expect(request.url()).not.toContain("/api/homework/generate");
  });

  await page.getByTestId("scan-file").setInputFiles(five);
  await expectQuestion1(page);
  const html = await page.content();
  expect(html).not.toContain("correctOptionId");
  expect(html).not.toContain("parentHint");
  expect(html).not.toContain("answerKey");
  expect(scanBodies).toBe(1);
});

test("one photo, the camera input, paste, a demo, and both PDF kinds start question 1", async ({
  page,
}) => {
  const one = {
    name: "page-1.jpg",
    mimeType: "image/jpeg",
    buffer: await jpegBuffer(page, "Worksheet page 1"),
  };

  await page.goto("/homework");
  await page.getByTestId("scan-file").setInputFiles(one);
  await expectQuestion1(page);

  await page.goto("/homework");
  await page.getByTestId("scan-camera").setInputFiles(one);
  await expectQuestion1(page);

  await page.goto("/homework");
  await page.getByRole("button", { name: "Paste lines" }).click();
  await page.getByTestId("paste-text").fill("Cells have a nucleus.");
  await page.getByTestId("make-quiz").click();
  await expectQuestion1(page);

  await page.goto("/homework");
  await page.getByRole("button", { name: "Water cycle (EN)" }).click();
  await expectQuestion1(page);

  await page.goto("/");
  await page.getByRole("button", { name: "Water cycle (EN)" }).click();
  await expectQuestion1(page);

  await page.goto("/");
  await page.getByTestId("scan-file").setInputFiles(one);
  await expectQuestion1(page);

  await page.goto("/");
  await page.getByTestId("scan-camera").setInputFiles(one);
  await expectQuestion1(page);

  await page.goto("/");
  await page.getByRole("button", { name: "Paste lines" }).click();
  await page.getByTestId("paste-text").fill("Cells have a nucleus.");
  await page.getByTestId("make-quiz").click();
  await expectQuestion1(page);

  await page.goto("/homework");
  await page.getByTestId("scan-file").setInputFiles({
    name: "notes.pdf",
    mimeType: "application/pdf",
    buffer: makeTextPdf([["Water evaporates from oceans", "Clouds form by condensation"]]),
  });
  await expectQuestion1(page);

  await page.goto("/homework");
  await page.getByTestId("scan-file").setInputFiles({
    name: "scan.pdf",
    mimeType: "application/pdf",
    buffer: makeTextPdf([[]]),
  });
  await expectQuestion1(page);
});

test("old scan routes redirect to homework", async ({ request }) => {
  for (const path of ["/scan", "/create", "/room/new", "/homework/confirm", "/write"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(new URL(response.url()).pathname, path).toBe("/homework");
  }
});

test("home, homework, privacy, and support links respond 200", async ({ page, request }) => {
  const seeds = ["/", "/homework", "/privacy", "/support"];
  const seen = new Set();
  for (const path of seeds) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    await page.goto(path);
    const hrefs = await page.locator("a[href]").evaluateAll((anchors) =>
      anchors.map((anchor) => anchor.getAttribute("href") || ""),
    );
    for (const href of hrefs) {
      expect(href, `${path} -> ${href}`).not.toContain("/write");
      if (!href.startsWith("/") || href.startsWith("//")) continue;
      const url = new URL(href, "http://127.0.0.1:3210");
      if (url.origin !== "http://127.0.0.1:3210") continue;
      const target = `${url.pathname}${url.search}`;
      if (seen.has(target)) continue;
      seen.add(target);
      const hit = await request.get(target);
      expect(hit.status(), target).toBe(200);
    }
  }
  expect(seen.size).toBeGreaterThan(0);
});
