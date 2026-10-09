import { expect, test } from "@playwright/test";

async function seconds(page) {
  const text = await page.getByTestId("question-timer").innerText();
  return Number(text.trim());
}

test("scan card is fully above the fold and the pack picker is gone", async ({ page }) => {
  await page.goto("/");
  const card = page.getByTestId("scan-card");
  await expect(card).toBeVisible();
  const box = await card.boundingBox();
  const viewport = page.viewportSize();
  expect(box).toBeTruthy();
  expect(viewport?.width).toBe(390);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  const create = await page.getByRole("heading", { name: "Create room" }).boundingBox();
  expect(create.y).toBeGreaterThanOrEqual(box.y + box.height - 1);
  await expect(page.getByText("Quiz pack")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Join room" })).toBeVisible();
});

test("pause and resume three times, then again on the next question", async ({ page }) => {
  await page.goto("/homework");
  await page.getByRole("button", { name: "Water cycle (EN)" }).click();
  await expect(page.getByTestId("question-1")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("pause-quiz")).toBeVisible();

  for (let round = 0; round < 3; round += 1) {
    const before = await seconds(page);
    await page.getByTestId("pause-quiz").click();
    await expect(page.getByTestId("resume-quiz")).toBeVisible();
    const frozen = await seconds(page);
    expect(Math.abs(frozen - before), `pause ${round}`).toBeLessThanOrEqual(1);
    await page.waitForTimeout(600);
    expect(await seconds(page), `held ${round}`).toBe(frozen);
    await page.getByTestId("resume-quiz").click();
    await expect(page.getByTestId("pause-quiz")).toBeVisible();
    await expect(page.getByTestId("resume-quiz")).toHaveCount(0);
    const resumed = await seconds(page);
    expect(Math.abs(resumed - frozen), `resume ${round}`).toBeLessThanOrEqual(1);
    await expect(page.getByTestId("answer-option").first()).toBeEnabled();
  }

  const running = await seconds(page);
  await page.waitForTimeout(1300);
  expect(await seconds(page)).toBeLessThan(running);

  await page.getByTestId("answer-option").first().click();
  await expect(page.getByTestId("question-2")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("question-1")).toHaveCount(0);

  const before = await seconds(page);
  await page.getByTestId("pause-quiz").click();
  await expect(page.getByTestId("resume-quiz")).toBeVisible();
  const frozen = await seconds(page);
  expect(Math.abs(frozen - before)).toBeLessThanOrEqual(1);
  await page.waitForTimeout(500);
  expect(await seconds(page)).toBe(frozen);
  await page.getByTestId("resume-quiz").click();
  await expect(page.getByTestId("pause-quiz")).toBeVisible();
  await expect(page.getByTestId("resume-quiz")).toHaveCount(0);
  expect(Math.abs((await seconds(page)) - frozen)).toBeLessThanOrEqual(1);
  await expect(page.getByTestId("answer-option").first()).toBeEnabled();
});
