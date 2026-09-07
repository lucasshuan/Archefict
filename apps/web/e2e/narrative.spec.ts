import { expect, test } from "@playwright/test";

// No API key is configured in this browser context, so no model is called.
// The test covers the local loop: type, persist to IndexedDB, survive a reload.

test("an entry is saved and survives a reload", async ({ page }) => {
  await page.goto("/");
  const box = page.getByRole("textbox", { name: "What do you do?" });
  await expect(box).toBeVisible();

  await box.fill("I open the door.");
  await box.press("Enter");
  await expect(page.getByText("I open the door.")).toBeVisible();
  await expect(box).toHaveValue("");
  // The Repo persists on a debounce; "saved" means the flush reached IndexedDB.
  await expect(page.getByText("saved", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText("I open the door.")).toBeVisible();
});

test("settings dialog opens, validates the model id, and saves", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  const dialog = page.getByRole("dialog", { name: "Settings" });
  await expect(dialog).toBeVisible();

  const model = dialog.getByRole("combobox");
  await model.fill("not-a-model");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog.getByRole("alert")).toContainText("provider/model");

  await model.fill("openai/gpt-5-mini");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("openai/gpt-5-mini")).toBeVisible();
});
