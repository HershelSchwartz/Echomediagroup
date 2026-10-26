import { test, expect, signIn, goOnline, requestRide, hold, axe } from "./helpers";

// F02 rider requests, F03 driver takes the trip, F04 trip completes, rated and tipped.
test("F02/F03/F04-H1: request, match, ride, pay, rate, tip", async ({ browser, users }) => {
  const driver = await users();
  await signIn(driver.page, "+15550000201", "/drive");
  // A 1x1 PNG as the driver's photo; the rider should see it on the driver card.
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
  const up = await driver.page.request.post("/api/me/photo", { multipart: { file: { name: "me.png", mimeType: "image/png", buffer: png } } });
  expect(up.ok()).toBe(true);
  await goOnline(driver.page);

  const rider = await users();
  await signIn(rider.page, "+15550000100");
  await expect(rider.page.getByRole("heading", { name: /where to\?/i })).toBeVisible();
  await axe(rider.page);

  await requestRide(rider.page);
  await expect(rider.page.getByRole("heading", { name: "Finding you a driver" })).toBeVisible();

  // Driver gets the offer and accepts.
  await expect(driver.page.getByRole("button", { name: "Accept" })).toBeVisible({ timeout: 20_000 });
  // The rider asked from their GPS position; the driver sees a real place name, not "Current location".
  await expect(driver.page.getByText("Union Square")).toBeVisible();
  await expect(driver.page.getByText("Current location")).toHaveCount(0);
  // Open fare split: the driver sees what the rider pays and what we keep.
  await expect(driver.page.getByTestId("fare-split")).toContainText(/Rider pays \$\d+\.\d\d · we keep \$\d+\.\d\d/);
  await axe(driver.page);
  await driver.page.getByRole("button", { name: "Accept" }).click();
  await expect(driver.page.getByRole("heading", { name: /Pick up Alex/ })).toBeVisible();

  // Rider sees the driver and car.
  await expect(rider.page.getByRole("heading", { name: /Your driver is .* away|on the way/ })).toBeVisible();
  await expect(rider.page.getByTestId("driver-card")).toContainText("Dana");
  await expect(rider.page.getByTestId("driver-card")).toContainText("DEV1201");
  await expect(rider.page.getByRole("img", { name: "Photo of Dana" })).toBeVisible();
  await axe(rider.page);

  // Chat both ways.
  await rider.page.getByRole("button", { name: /Message/ }).click();
  await rider.page.getByLabel("Message", { exact: true }).fill("Blue jacket by the steps");
  await rider.page.getByRole("button", { name: "Send" }).click();
  await expect(rider.page.getByText("Blue jacket by the steps")).toBeVisible();
  await rider.page.getByRole("button", { name: "Close" }).click();
  await driver.page.getByRole("button", { name: /Message/ }).click();
  await expect(driver.page.getByText("Blue jacket by the steps")).toBeVisible();
  await driver.page.getByRole("button", { name: "I'm here" }).click();
  await driver.page.getByRole("button", { name: "Close" }).click();

  await driver.page.getByRole("button", { name: "I've arrived" }).click();
  await expect(rider.page.getByRole("heading", { name: "Your driver is here" })).toBeVisible();

  await hold(driver.page, /Hold to start trip/);
  await expect(driver.page.getByRole("heading", { name: /Drop off Alex/ })).toBeVisible();
  await expect(rider.page.getByRole("heading", { name: /Arriving at|On the way/ })).toBeVisible();

  await hold(driver.page, /Hold to end trip/);
  await expect(driver.page.getByRole("heading", { name: "Trip complete" })).toBeVisible();
  await driver.page.getByRole("radio", { name: "5 stars" }).click();
  await driver.page.getByRole("button", { name: "Submit" }).click();

  // Rider rates and tips.
  await expect(rider.page.getByRole("heading", { name: /How was your ride with Dana/ })).toBeVisible();
  await axe(rider.page);
  await rider.page.getByRole("radio", { name: "5 stars" }).click();
  await rider.page.getByRole("button", { name: "Friendly" }).click();
  await rider.page.getByRole("button", { name: "Submit" }).click();
  await expect(rider.page.getByRole("heading", { name: /Add a tip/ })).toBeVisible();
  await rider.page.getByRole("button", { name: "$2.00" }).click();
  await expect(rider.page.getByRole("heading", { name: /where to\?/i })).toBeVisible();

  // Receipt in Activity.
  await rider.page.goto("/ride/activity");
  await rider.page.getByRole("link", { name: /Grand Central/ }).first().click();
  await expect(rider.page.getByText("Fare", { exact: true })).toBeVisible();
  await expect(rider.page.getByText("Tip", { exact: true }).first()).toBeVisible();
  await axe(rider.page);

  // Driver earnings include the tip.
  await driver.page.goto("/drive/earnings");
  await expect(driver.page.getByText(/tip \$2\.00/)).toBeVisible();

  rider.check();
  driver.check();
});
