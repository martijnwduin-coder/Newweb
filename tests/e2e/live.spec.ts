import { execSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { LIVE } from "../../playwright.config";

test.skip(!LIVE, "Live-mode suite (runs when Supabase env vars are set)");
test.describe.configure({ mode: "serial" });

let sb: SupabaseClient;
let alex: string;
let sora: string;

test.beforeAll(async () => {
  // Fresh, known state: reseed and remove the review this suite writes.
  execSync("npm run db:seed", { stdio: "ignore" });
  const status = JSON.parse(execSync("npx supabase status -o json", { stdio: ["ignore", "pipe", "ignore"] }).toString());
  sb = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  alex = (await sb.from("profiles").select("id").eq("username", "alex").single()).data!.id;
  sora = (await sb.from("places").select("id").eq("name", "Sora").single()).data!.id;
  await sb.from("reviews").delete().eq("user_id", alex).eq("place_id", sora);
});

async function signIn(page: Page) {
  await page.goto("/login");
  await page.fill("#email", "alex@peloton.demo");
  await page.fill("#password", "peloton-demo");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => u.pathname === "/");
}

test("signed-out visitors are sent to login; bad password is rejected", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await page.fill("#email", "alex@peloton.demo");
  await page.fill("#password", "wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(/invalid/i)).toBeVisible();
});

test("review is stored once and edited in place", async ({ page }) => {
  await signIn(page);
  await page.goto(`/place/${sora}`);
  await page.getByRole("button", { name: /Rate & review/ }).click();
  await page.locator('[aria-label="Overall rating"] button[aria-label="4.5 stars"]').click();
  await page.getByRole("button", { name: "Publish review" }).click();
  await expect.poll(async () => (await sb.from("reviews").select("overall_rating").eq("user_id", alex).eq("place_id", sora)).data?.map((r) => Number(r.overall_rating))).toEqual([4.5]);
  await page.reload();
  await page.getByRole("button", { name: /Your rating · 4.5/ }).click();
  await page.locator('[aria-label="Overall rating"] button[aria-label="5 stars"]').click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect.poll(async () => (await sb.from("reviews").select("overall_rating").eq("user_id", alex).eq("place_id", sora)).data?.map((r) => Number(r.overall_rating))).toEqual([5]);
});

test("accepting a friend request updates the database", async ({ page }) => {
  await signIn(page);
  const pending = (await sb.from("friendships").select("id").eq("addressee_id", alex).eq("status", "pending")).data!;
  await page.goto("/friends");
  await page.getByRole("button", { name: "Accept" }).first().click();
  await expect.poll(async () => (await sb.from("friendships").select("status").eq("id", pending[0].id).single()).data?.status).toBe("accepted");
});

test("sharing with a friend creates a notification for them", async ({ page }) => {
  await signIn(page);
  await page.goto(`/place/${sora}`);
  await page.getByRole("button", { name: "Share", exact: true }).last().click();
  await page.locator("[role=dialog] button[aria-pressed]").first().click();
  await page.getByRole("button", { name: /^Send to 1/ }).click();
  await expect.poll(async () => {
    const rec = (await sb.from("place_recommendations").select("receiver_id").eq("sender_id", alex).eq("place_id", sora)).data?.[0];
    if (!rec) return 0;
    return (await sb.from("notifications").select("id").eq("user_id", rec.receiver_id).eq("type", "recommendation")).data?.length ?? 0;
  }).toBeGreaterThan(0);
});

test("a new recommendation arrives live, without a refresh", async ({ page }) => {
  await signIn(page);
  await page.waitForTimeout(1500); // let the realtime channel connect
  const emma = (await sb.from("profiles").select("id").eq("username", "emma").single()).data!.id;
  const place = (await sb.from("places").select("id").eq("name", "Lumen Koffie").single()).data!.id;
  const { error } = await sb.from("place_recommendations").insert({ sender_id: emma, receiver_id: alex, place_id: place, message: "Live test — try the filter flight" });
  expect(error).toBeNull();
  await expect(page.getByText("You have a new notification")).toBeVisible({ timeout: 10_000 });
});

test("public share page renders from the database", async ({ request }) => {
  const res = await request.get(`/share/place/${sora}`);
  expect(res.ok()).toBe(true);
  expect(await res.text()).toContain("Sora");
});

test.afterAll(() => {
  execSync("npm run db:seed", { stdio: "ignore" });
});
