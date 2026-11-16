import { expect, test, type Page } from "@playwright/test";
import { LIVE } from "../../playwright.config";

test.skip(LIVE, "Demo-mode suite (runs when Supabase is not configured)");

const KEY = "peloton-demo-db-v1";
const db = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), KEY);

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate((k) => localStorage.removeItem(k), KEY);
  await page.reload();
  await page.waitForFunction((k) => localStorage.getItem(k), KEY);
});

test("save a place from the home page", async ({ page }) => {
  const before = (await db(page)).saved.length;
  await page.locator('button[aria-label="Save place"]').first().click();
  await expect.poll(async () => (await db(page)).saved.length).toBe(before + 1);
});

test("write and edit a review — one review per place", async ({ page }) => {
  await page.goto("/place/p-sora");
  await page.getByRole("button", { name: /Rate & review/ }).click();
  await page.locator('[aria-label="Overall rating"] button[aria-label="4.5 stars"]').click();
  await page.fill("#review-text", "Seasonal omakase.");
  await page.getByRole("button", { name: "Publish review" }).click();
  await page.getByRole("button", { name: /Your rating · 4.5/ }).click();
  await page.locator('[aria-label="Overall rating"] button[aria-label="5 stars"]').click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect.poll(async () => (await db(page)).reviews.filter((r: { userId: string; placeId: string }) => r.userId === "u-alex" && r.placeId === "p-sora").map((r: { overall: number }) => r.overall)).toEqual([5]);
});

test("create a collection, add and reorder places", async ({ page }) => {
  await page.goto("/collections");
  await page.getByRole("button", { name: /New collection/ }).first().click();
  await page.fill("#c-title", "Test list");
  await page.getByRole("button", { name: "Create collection" }).click();
  await page.waitForURL(/\/collections\/.+/);
  await page.getByRole("button", { name: /Add places/ }).first().click();
  await page.locator("[role=dialog] li button").nth(0).click();
  await page.locator("[role=dialog] li button").nth(1).click();
  await page.keyboard.press("Escape");
  const order = async () => {
    const d = await db(page);
    const c = d.collections.find((x: { title: string }) => x.title === "Test list");
    return d.collectionPlaces.filter((cp: { collectionId: string }) => cp.collectionId === c.id).sort((a: { position: number }, b: { position: number }) => a.position - b.position).map((cp: { placeId: string }) => cp.placeId);
  };
  const first = await order();
  expect(first).toHaveLength(2);
  await page.locator('button[aria-label="Move down"]').first().click();
  await expect.poll(order).toEqual([first[1], first[0]]);
});

test("accept a friend request", async ({ page }) => {
  await page.goto("/friends");
  await page.getByRole("button", { name: "Accept" }).first().click();
  await expect.poll(async () => (await db(page)).friendships.find((f: { id: string }) => f.id === "f-pending-in").status).toBe("accepted");
});

test("ask box on the home page answers with grounded picks", async ({ page }) => {
  await page.fill('textarea[aria-label="Ask Peloton"]', "Find me a great Italian restaurant in Amsterdam recommended by my friends.");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/assistant/);
  await expect(page.locator("ol li a.truncate")).toHaveText(["Osteria Fiume", "Verde Pasta Bar"]);
});

test("map filters and opens a preview", async ({ page }) => {
  await page.goto("/map");
  await page.fill('input[aria-label="Search the map"]', "pasta");
  await expect(page.locator("section h3", { hasText: "Lumen Koffie" })).toHaveCount(0);
  await page.locator("section h3", { hasText: "Osteria Fiume" }).first().click();
  await expect(page.getByRole("link", { name: "View details" })).toBeVisible();
});

test("share card renders a PNG", async ({ request }) => {
  const res = await request.get("/api/share-card?title=Sora&rating=4.8");
  expect(res.ok()).toBe(true);
  expect(res.headers()["content-type"]).toBe("image/png");
});
