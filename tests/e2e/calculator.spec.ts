import { expect, test, type Page } from "@playwright/test"

function collectBrowserErrors(page: Page): string[] {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text())
  })
  return errors
}

async function openReadyCalculator(page: Page): Promise<void> {
  await page.goto("/calc.html")
  await expect(page.getByRole("region", { name: "Production targets" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Choose output for target 1: Advanced circuit" })).toBeVisible()
  await expect(page.getByRole("button", { name: "+ Add target" })).toBeEnabled()
}

async function openReadyCompactCalculator(page: Page): Promise<void> {
  await page.goto("/calc.html")
  await expect(page.getByRole("list", { name: "Factory rows" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Targets (1)" })).toBeVisible()
  await expect(page.getByRole("region", { name: "Production targets" })).toHaveCount(0)
}

test("loads, edits targets, and restores the URL-backed plan", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page)
  await openReadyCalculator(page)

  await expect(page.getByRole("region", { name: "Factory summary" })).toBeVisible()

  let output = page.getByRole("button", { name: "Choose output for target 1: Advanced circuit" })
  await output.click()
  let outputDialog = page.getByRole("dialog", { name: "Choose output for target 1" })
  await outputDialog.getByLabel("Search target outputs").fill("processing unit")
  await outputDialog.getByRole("button", { name: "Select Processing unit as output" }).click()
  output = page.getByRole("button", { name: "Choose output for target 1: Processing unit" })
  await expect(output).toBeVisible()
  await output.click()
  outputDialog = page.getByRole("dialog", { name: "Choose output for target 1" })
  await outputDialog.getByLabel("Search target outputs").fill("advanced circuit")
  await outputDialog.getByLabel("Search target outputs").press("Enter")
  output = page.getByRole("button", { name: "Choose output for target 1: Advanced circuit" })
  await expect(output).toBeVisible()
  await output.click()
  outputDialog = page.getByRole("dialog", { name: "Choose output for target 1" })
  await outputDialog.getByLabel("Search target outputs").fill("coal")
  await outputDialog.getByLabel("Search target outputs").press("Enter")
  await expect(page.getByRole("button", { name: "Choose output for target 1: Coal" })).toBeVisible()
  await expect(page.getByLabel("Recipe for Coal")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Enable or disable recipes for Coal" })).toHaveCount(1)
  output = page.getByRole("button", { name: "Choose output for target 1: Coal" })
  await output.click()
  outputDialog = page.getByRole("dialog", { name: "Choose output for target 1" })
  await outputDialog.getByLabel("Search target outputs").fill("advanced circuit")
  await outputDialog.getByLabel("Search target outputs").press("Enter")
  await expect(page.getByRole("button", { name: "Choose output for target 1: Advanced circuit" })).toBeVisible()

  const rate = page.getByLabel("Rate for Advanced circuit")
  await rate.fill("120")
  await rate.press("Enter")
  await expect(rate).toHaveValue("120")
  await expect.poll(() => new URL(page.url()).hash).not.toBe("")

  await page.getByRole("button", { name: "+ Add target" }).click()
  await expect(page.locator("#targets > li")).toHaveCount(2)
  await page.getByRole("button", { name: "Remove Advanced circuit target" }).last().click()
  await expect(page.locator("#targets > li")).toHaveCount(1)

  await page.reload()
  await expect(page.getByRole("button", { name: "Choose output for target 1: Advanced circuit" })).toBeVisible()
  await expect(page.getByLabel("Rate for Advanced circuit")).toHaveValue("120")
  expect(browserErrors, "uncaught browser errors").toEqual([])
})

test("display rate units update the production target rate", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page)
  await openReadyCalculator(page)
  const targetRate = page.getByLabel("Rate for Advanced circuit")
  await targetRate.fill("60")
  await targetRate.press("Enter")
  await expect(targetRate).toHaveValue("60")

  await page.getByRole("button", { name: "Settings" }).click()
  await page.getByRole("radio", { name: "items/second" }).check()
  await expect(targetRate).toHaveValue("1")
  await expect(page.getByText("Rate/second", { exact: true })).toHaveCount(2)
  await page.getByRole("radio", { name: "items/hour" }).check()
  await expect(targetRate).toHaveValue("3,600")
  await expect(page.getByText("Rate/hour", { exact: true })).toHaveCount(2)
  expect(browserErrors, "uncaught browser errors").toEqual([])
})

test("settings are native React controls and persist without DOM adapters", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page)
  await openReadyCalculator(page)

  await page.getByRole("radio", { name: "Relaxed" }).check()
  await expect(page.locator('[data-density="comfortable"]')).toBeVisible()

  await page.getByRole("button", { name: "Settings" }).click()
  await expect(page.getByText("Quality factory", { exact: true })).toBeVisible()
  await expect(page.getByLabel("Search recipes")).toBeVisible()
  await expect(page.getByText("Show unavailable recipes", { exact: true })).toBeVisible()
  await page.getByLabel("Quality factory speed beacon module").selectOption({ label: "Speed module 3" })
  await page.getByLabel("Quality factory speed module quality").selectOption("rare")
  await page.getByLabel("Quality factory maximum beacon quality").selectOption("epic")
  const maximumMiningBeacons = page.getByLabel("Quality factory maximum beacon count")
  await maximumMiningBeacons.fill("6")
  await maximumMiningBeacons.press("Enter")
  await page.getByText("Recycling recipes", { exact: true }).click()
  await expect(page.getByRole("button", { name: "Disable all recycling recipes" })).toBeVisible()

  const title = page.getByLabel("Plan title")
  await title.fill("Circuit plan")
  await title.press("Enter")
  await expect(page).toHaveTitle("Circuit plan")

  await page.getByRole("radio", { name: "items/hour" }).check()
  await page.getByLabel("Search recipes").fill("recycling")
  await expect(page.getByText(/\d+ matching recipes?/)).toBeVisible()
  await expect.poll(() => new URL(page.url()).hash).not.toBe("")

  await page.reload()
  await expect(page).toHaveTitle("Circuit plan")
  await page.getByRole("button", { name: "Settings" }).click()
  await expect(page.getByRole("radio", { name: "items/hour" })).toBeChecked()
  await expect(page.locator('[data-density="comfortable"]')).toBeVisible()
  await expect(page.getByLabel("Quality factory speed beacon module")).toHaveValue("speed-module-3")
  await expect(page.getByLabel("Quality factory speed module quality")).toHaveValue("rare")
  await expect(page.getByLabel("Quality factory maximum beacon quality")).toHaveValue("epic")
  await expect(page.getByLabel("Quality factory maximum beacon count")).toHaveValue("6")
  expect(browserErrors, "uncaught browser errors").toEqual([])
})

test("Factorio productivity is copied and pasted without replacing the plan", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  await openReadyCalculator(page)
  const targetRate = await page.getByLabel("Rate for Advanced circuit").inputValue()
  await page.getByRole("button", { name: "Settings" }).click()

  await page.getByRole("button", { name: "Copy game command" }).click()
  await expect(page.getByText("Game command copied.", { exact: true })).toBeVisible()
  const command = await page.evaluate(() => navigator.clipboard.readText())
  expect(command).toMatch(/^\/c /)
  expect(command).toContain("factorio-calculator-productivity")

  await page.evaluate(() =>
    navigator.clipboard.writeText(
      JSON.stringify({
        kind: "factorio-calculator-productivity",
        schemaVersion: 1,
        miningProductivityPercent: 230,
        technologyLevels: {
          "processing-unit-productivity": 6,
          "steel-plate-productivity": 9,
        },
      }),
    ),
  )
  await page.getByRole("button", { name: "Paste productivity" }).click()

  await expect(page.getByText("Imported mining and 2 recipe productivity values.", { exact: true })).toBeVisible()
  await expect(page.getByLabel("Mining productivity bonus percentage")).toHaveValue("230")
  await expect(page.getByLabel("Processing unit productivity bonus percentage")).toHaveValue("60")
  await expect(page.getByLabel("Steel plate productivity bonus percentage")).toHaveValue("90")
  await expect(page.getByLabel("Rate for Advanced circuit")).toHaveValue(targetRate)

  await page.reload()
  await page.getByRole("button", { name: "Settings" }).click()
  await expect(page.getByLabel("Mining productivity bonus percentage")).toHaveValue("230")
  await expect(page.getByLabel("Processing unit productivity bonus percentage")).toHaveValue("60")
  await expect(page.getByLabel("Steel plate productivity bonus percentage")).toHaveValue("90")
})

test("Visualise renders the original Dagre/D3 flow and recipe graphs", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page)
  await openReadyCalculator(page)

  await page.getByRole("button", { name: "Visualise" }).click()
  const graph = page.getByRole("img", { name: "Factory recipe flow graph" })
  await expect(graph).toBeVisible()
  await expect(graph.locator("g.link").first()).toBeAttached()
  await expect(graph.locator("g.link text").first()).toContainText(/\/m$/)
  await expect(graph.locator("image").first()).toHaveAttribute("href", /sprite-sheet-.+\.webp/)

  await page.getByRole("radio", { name: "Recipe graph" }).check()
  await expect(graph.locator("g.edge").first()).toBeAttached()
  await expect(graph.locator("g.edgeLabel text").first()).toContainText(/\/m$/)
  await page.getByRole("radio", { name: "Fit" }).check()
  await page.getByRole("radio", { name: "Top to bottom" }).check()
  await expect(page.getByRole("radio", { name: "Recipe graph" })).toBeChecked()
  await expect(page.getByRole("radio", { name: "Fit" })).toBeChecked()
  await expect(page.getByRole("radio", { name: "Top to bottom" })).toBeChecked()
  const graphHash = new URL(page.url()).hash
  expect(graphHash).not.toBe("")
  await page.reload()
  await expect(page.getByRole("img", { name: "Factory recipe flow graph" })).toBeVisible()
  await expect(page.getByRole("radio", { name: "Recipe graph" })).toBeChecked()
  await expect(page.getByRole("radio", { name: "Fit" })).toBeChecked()
  await expect(page.getByRole("radio", { name: "Top to bottom" })).toBeChecked()
  await expect(
    page.getByRole("img", { name: "Factory recipe flow graph" }).locator("g.edgeLabel text").first(),
  ).toContainText(/\/m$/)
  expect(browserErrors, "uncaught browser errors").toEqual([])
})

test("factory equipment, quality, beacons, and location are edited inline", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page)
  await openReadyCalculator(page)

  await expect(page.getByText("Equipment, modules, beacons, and location", { exact: true })).toHaveCount(0)
  await expect(page.getByRole("dialog")).toHaveCount(0)

  await page.getByRole("button", { name: /^Space platform/ }).click({ modifiers: ["Shift"] })
  const location = page.getByLabel("Choose production location for Advanced circuit")
  await expect(location).toBeVisible()
  await location.selectOption("nauvis")

  const machine = page.getByRole("button", { name: "Choose a machine for Advanced circuit" })
  await machine.click()
  let machineDialog = page.getByRole("dialog", { name: "Machine and quality for Advanced circuit" })
  await machineDialog.getByRole("button", { name: "Rare quality", exact: true }).click()
  await machine.click()
  machineDialog = page.getByRole("dialog", { name: "Machine and quality for Advanced circuit" })
  await machineDialog.getByRole("button", { name: /^Assembling machine 3 —/ }).click()
  await expect(machine).toBeFocused()
  await expect(page.getByRole("dialog")).toHaveCount(0)

  const firstModule = page.getByRole("button", { name: /^Advanced circuit module 1/ })
  await firstModule.click()
  const moduleDialog = page.getByRole("dialog", { name: "Module 1 and quality for Advanced circuit" })
  await moduleDialog.getByRole("button", { name: "Rare quality", exact: true }).click()
  await expect(moduleDialog).toBeVisible()
  await moduleDialog
    .getByRole("button", {
      name: "Rare Speed module for Advanced circuit module 1 — changes matching slots",
      exact: true,
    })
    .click()
  await expect(firstModule).toBeFocused()
  await expect(page.getByRole("button", { name: /^Advanced circuit module 4/ })).toHaveAccessibleName(
    /Rare Speed module/,
  )

  await firstModule.hover()
  await page.keyboard.press("q")

  await expect(page.locator("#module_pipette_status")).toContainText("Pipette: Rare Speed module")
  const ghost = page.locator("#module_pipette_ghost")
  await expect(ghost).toBeVisible()
  await expect(ghost.locator('[role="img"]')).toHaveAttribute("aria-label", "Rare Speed module")

  const secondModule = page.getByRole("button", { name: /^Advanced circuit module 2/ })
  await secondModule.click()
  await expect(secondModule).toHaveAccessibleName(/Rare Speed module/)
  await expect(ghost).toBeVisible()
  await page.locator('tr[data-item-key="advanced-circuit"] td').nth(2).hover()
  await page.keyboard.press("q")
  await expect(ghost).toHaveCount(0)

  const firstBeaconModule = page.getByRole("button", { name: /^Advanced circuit beacon module 1/ })
  await firstBeaconModule.click()
  const beaconModuleDialog = page.getByRole("dialog", {
    name: "Beacon module 1 and quality for Advanced circuit",
  })
  await beaconModuleDialog.getByRole("button", { name: "Epic quality", exact: true }).click()
  await expect(beaconModuleDialog).toBeVisible()
  await beaconModuleDialog
    .getByRole("button", { name: "Epic Speed module for Advanced circuit beacon module 1", exact: true })
    .click()
  await expect(firstBeaconModule).toBeFocused()
  await expect(page.getByRole("button", { name: /^Advanced circuit beacon module 2/ })).toHaveAccessibleName(
    /Epic Speed module/,
  )

  const beaconQuality = page.getByRole("button", { name: /beacon quality for Advanced circuit$/ })
  await beaconQuality.click()
  const beaconQualityDialog = page.getByRole("dialog", { name: "Beacon quality for Advanced circuit" })
  await beaconQualityDialog.getByRole("button", { name: "Rare quality", exact: true }).click()
  await expect(beaconQuality).toBeFocused()
  await expect(beaconQuality).toHaveAccessibleName("Rare beacon quality for Advanced circuit")

  await page.keyboard.press("Control+A")
  const factoryCopy = await page.evaluate(() => window.getSelection()?.toString() ?? "")
  expect(factoryCopy).toContain("Machine: Rare Assembling machine 3.")
  expect(factoryCopy).toContain("Modules: Rare Speed module, Rare Speed module")
  expect(factoryCopy).toContain("Rare beacon; modules: Epic Speed module, Epic Speed module")

  const pipetteHash = new URL(page.url()).hash
  await page.reload()
  await expect.poll(() => new URL(page.url()).hash).toBe(pipetteHash)
  await expect(page.getByLabel("Choose production location for Advanced circuit")).toHaveValue("nauvis")
  await expect(page.getByRole("button", { name: /^Advanced circuit module 2/ })).toHaveAccessibleName(
    /Rare Speed module/,
  )
  await expect(page.getByRole("button", { name: /^Advanced circuit beacon module 2/ })).toHaveAccessibleName(
    /Epic Speed module/,
  )
  await machine.click()
  machineDialog = page.getByRole("dialog", { name: "Machine and quality for Advanced circuit" })
  await expect(machineDialog.getByRole("button", { name: "Rare quality", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  )
  await expect(page.locator("#module_pipette_ghost")).toHaveCount(0)

  await page.getByRole("button", { name: "Help" }).click()
  await expect(page.getByText(/Hover a module or module choice and press Q/)).toBeVisible()
  expect(browserErrors, "uncaught browser errors").toEqual([])
})

test("quality factory equipment stays automatic and sprite-only", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page)
  await openReadyCalculator(page)

  await page.getByLabel("Apply preset").selectOption("full-legendary")
  await expect(page.getByText("Quality modules", { exact: true })).toBeVisible({ timeout: 120_000 })
  await expect(page.getByRole("columnheader", { name: "Rate / m", exact: true }).last()).toBeVisible()
  await expect(page.getByText("Planning diagnostics", { exact: true })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Reset to automatic" })).toHaveCount(0)
  await expect(page.getByLabel(/Machine quality for .* at/)).toHaveCount(0)

  await expect(page.locator('[role="img"][aria-label="Quality module 2"]').first()).toBeVisible()
  await expect(page.locator('[role="img"][aria-label$="Beacon"]').first()).toBeVisible()
  await expect(page.getByText(/\d+× (?:[NUREL]-)?(?:Q|Prod|Speed)\d/)).toHaveCount(0)

  await page.keyboard.press("Control+A")
  const factoryCopy = await page.evaluate(() => window.getSelection()?.toString() ?? "")
  expect(factoryCopy).toMatch(/Machine: (?:Normal|Uncommon|Rare|Epic|Legendary) [^.]+\. Modules:/)
  expect(factoryCopy).toMatch(/Modules: [^.]*Quality module/)
  expect(factoryCopy).toMatch(/Beacons: \d+(?:\.\d+)? (?:Normal|Uncommon|Rare|Epic|Legendary) beacon; modules:/)
  expect(factoryCopy).toMatch(/Quality:\s+Legendary/)
  expect(factoryCopy).toMatch(/Rate \/ m:\s+[\d,.]+/)
  expect(factoryCopy).toMatch(/Machines:\s+[\d,.]+/)
  expect(factoryCopy).toMatch(/Power:\s+[\d,.]+ (?:W|kW|MW|GW)/)
  expect(browserErrors, "uncaught browser errors").toEqual([])
})

test("compact layout shows factory cards and bottom tabs without horizontal scrolling", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await openReadyCompactCalculator(page)

  await expect(page.locator(".factory-table")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Copy plan link" })).toHaveCount(1)
  const cards = page.getByRole("list", { name: "Factory rows" }).getByRole("listitem")
  await expect(cards.first()).toBeVisible()
  expect(await cards.count()).toBeGreaterThan(5)
  await expect(page.getByRole("button", { name: "Edit Advanced circuit" })).toContainText("Target")
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)

  const tabs = page.getByRole("navigation", { name: "Calculator sections" })
  await expect(tabs).toBeInViewport()
  await expect(tabs.getByRole("button", { name: "Factory" })).toHaveAttribute("aria-current", "page")
  await expect(page.getByRole("heading", { level: 1, name: "Factory" })).toBeVisible()

  await tabs.getByRole("button", { name: "Resources" }).click()
  await expect(page.getByText(/Drag resources between tiers/)).toBeVisible()
  await expect(page.getByRole("button", { name: "Restore defaults" })).toBeVisible()
  await expect.poll(() => new URL(page.url()).hash).not.toBe("")
  await page.reload()
  await expect(tabs.getByRole("button", { name: "Resources" })).toHaveAttribute("aria-current", "page")
  await expect(page.getByRole("heading", { level: 1, name: "Resources" })).toBeVisible()

  await tabs.getByRole("button", { name: "Help" }).click()
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(["Help"])
  await expect(page.getByRole("heading", { name: "Using the calculator" })).toBeVisible()
  await expect(page.getByText(/Share the current calculation/)).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  expect(browserErrors, "uncaught browser errors").toEqual([])
})

test("compact row editor edits equipment and closes back to its card", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await openReadyCompactCalculator(page)

  await page.getByRole("button", { name: "Edit targets" }).click()
  const targetsScreen = page.getByRole("dialog", { name: "Production targets" })
  await targetsScreen.getByRole("button", { name: /^Space platform/ }).click()
  await expect(targetsScreen.getByRole("button", { name: /^Space platform/ })).toHaveAttribute("aria-pressed", "true")
  await expect(targetsScreen.getByRole("button", { name: /^Nauvis/ })).toHaveAttribute("aria-pressed", "true")
  await targetsScreen.getByRole("button", { name: "Back" }).click()
  await expect(targetsScreen).toHaveCount(0)
  const card = page.getByRole("button", { name: "Edit Advanced circuit" })
  await card.click()
  const editor = page.getByRole("dialog", { name: "Advanced circuit" })
  await expect(editor).toBeVisible()

  const locations = editor.getByRole("group", { name: "Production location for Advanced circuit" })
  await expect(locations.getByRole("button", { name: /^Automatic/ })).toHaveAttribute("aria-pressed", "true")
  await locations.getByRole("button", { name: "Nauvis", exact: true }).click()
  await expect(locations.getByRole("button", { name: "Nauvis", exact: true })).toHaveAttribute("aria-pressed", "true")

  const recipePicker = editor.getByRole("button", { name: "Enable or disable recipes for Advanced circuit" })
  await recipePicker.click()
  const recipeDialog = page.getByRole("dialog", { name: "Recipes for Advanced circuit" })
  await expect(recipeDialog).toBeVisible()
  const recipeDialogBox = await recipeDialog.boundingBox()
  expect(recipeDialogBox).not.toBeNull()
  expect(recipeDialogBox?.x).toBeGreaterThanOrEqual(0)
  expect((recipeDialogBox?.x ?? 0) + (recipeDialogBox?.width ?? 0)).toBeLessThanOrEqual(390)
  await page.keyboard.press("Escape")
  await expect(recipeDialog).toHaveCount(0)
  await expect(editor).toBeVisible()

  await editor.getByRole("button", { name: /^Assembling machine 3/ }).click()
  await expect(editor.getByRole("button", { name: /^Assembling machine 3/ })).toHaveAttribute("aria-pressed", "true")
  await editor
    .getByRole("group", { name: /^Choose module 1/ })
    .getByRole("button", { name: "Speed module", exact: true })
    .click()
  await expect(editor.getByRole("button", { name: "Module slot 1: Speed module", exact: true })).toBeVisible()
  await expect(editor.getByRole("button", { name: "Module slot 2: Empty", exact: true })).toBeVisible()
  await editor.getByRole("button", { name: "Fill all module slots" }).click()
  await expect(editor.getByRole("button", { name: "Module slot 4: Speed module", exact: true })).toBeVisible()
  await editor.getByRole("button", { name: "More beacons" }).click()
  await expect(editor.getByLabel("Beacon count for Advanced circuit")).toHaveValue("1")
  expect(await editor.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)

  await page.keyboard.press("Escape")
  await expect(editor).toHaveCount(0)
  await expect(card).toBeFocused()
  await expect(card).toContainText("Assembling machine 3")
  await expect(card).toContainText("Speed module ×4")
  await expect(card).toContainText("1 beacon")
  expect(browserErrors, "uncaught browser errors").toEqual([])
})

test("compact row editor produces the same plan URL as the desktop factory table", async ({ browser }) => {
  const editHash = async (width: number, edit: (page: Page) => Promise<void>) => {
    const page = await browser.newPage({ viewport: { width, height: 844 } })
    if (width <= 760) await openReadyCompactCalculator(page)
    else await openReadyCalculator(page)
    await edit(page)
    await expect.poll(() => new URL(page.url()).hash).toContain("zip=")
    const hash = new URL(page.url()).hash
    await page.close()
    return hash
  }

  const compactHash = await editHash(390, async (page) => {
    await page.getByRole("button", { name: "Edit Advanced circuit" }).click()
    const editor = page.getByRole("dialog", { name: "Advanced circuit" })
    await editor.getByRole("button", { name: /^Assembling machine 3/ }).click()
    await editor
      .getByRole("group", { name: /^Choose module 1/ })
      .getByRole("button", { name: "Productivity module 3", exact: true })
      .click()
    await editor.getByRole("button", { name: "Fill all module slots" }).click()
    await editor.getByRole("button", { name: "More beacons" }).click()
    await expect(editor.getByLabel("Beacon count for Advanced circuit")).toHaveValue("1")
  })

  const desktopHash = await editHash(1280, async (page) => {
    const machine = page.getByRole("button", { name: "Choose a machine for Advanced circuit" })
    await machine.click()
    await page
      .getByRole("dialog", { name: "Machine and quality for Advanced circuit" })
      .getByRole("button", { name: /^Assembling machine 3 —/ })
      .click()
    await page.getByRole("button", { name: /^Advanced circuit module 1/ }).click()
    await page
      .getByRole("dialog", { name: "Module 1 and quality for Advanced circuit" })
      .getByRole("button", { name: /^Productivity module 3 for Advanced circuit module 1/ })
      .click()
    const beacons = page.getByLabel("Beacon count for Advanced circuit")
    await beacons.fill("1")
    await beacons.press("Enter")
    await expect(beacons).toHaveValue("1")
  })

  expect(compactHash).toBe(desktopHash)
})

test("compact targets screen adds, edits, and removes targets in a bottom sheet", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await openReadyCompactCalculator(page)

  await expect(page.getByText("Advanced circuit · 1 machine")).toBeVisible()
  await page.getByRole("button", { name: "Targets (1)" }).click()
  const screen = page.getByRole("dialog", { name: "Production targets" })
  await expect(screen.getByRole("button", { name: "Edit target 1: Advanced circuit" })).toContainText("1 machine")

  await screen.getByRole("button", { name: "+ Add target" }).click()
  const sheet = page.getByRole("dialog", { name: "Edit target 2" })
  await expect(sheet).toBeVisible()
  await sheet.getByLabel("Search target outputs").fill("processing unit")
  await sheet.getByRole("button", { name: "Select Processing unit as output" }).click()
  await expect(sheet.getByLabel("Search target outputs")).toHaveValue("")
  await sheet.getByRole("button", { name: "Rate", exact: true }).click()
  const rate = sheet.getByLabel("Rate for Processing unit")
  await rate.fill("30")
  await rate.press("Enter")
  await expect(rate).toHaveValue("30")
  await sheet.getByRole("button", { name: "Increase" }).click()
  await expect(rate).toHaveValue("31")
  await sheet.getByRole("button", { name: "Decrease" }).click()
  await sheet.getByRole("button", { name: "Decrease" }).click()
  await expect(rate).toHaveValue("29")
  await sheet.getByRole("button", { name: "Machines", exact: true }).click()
  await expect(sheet.getByLabel("Machine count for Processing unit")).toBeVisible()
  await sheet.getByRole("button", { name: "Done" }).click()
  await expect(sheet).toHaveCount(0)
  await expect(screen.getByRole("button", { name: "Edit target 2: Processing unit" })).toContainText("29/m")

  await screen.getByRole("button", { name: "Edit target 1: Advanced circuit" }).click()
  const firstSheet = page.getByRole("dialog", { name: "Edit target 1" })
  await firstSheet.getByLabel("Search target outputs").fill("processing")
  await page.keyboard.press("Escape")
  await expect(firstSheet.getByLabel("Search target outputs")).toHaveValue("")
  await page.keyboard.press("Escape")
  await expect(firstSheet).toHaveCount(0)
  await expect(screen).toBeVisible()

  await screen.getByRole("button", { name: "Edit target 2: Processing unit" }).click()
  await page
    .getByRole("dialog", { name: "Edit target 2" })
    .getByRole("button", { name: "Remove Processing unit target" })
    .click()
  await expect(screen.getByRole("listitem")).toHaveCount(1)
  await page.keyboard.press("Escape")
  await expect(screen).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Targets (1)" })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  expect(browserErrors, "uncaught browser errors").toEqual([])
})

test("compact target sheet produces the same plan URL as the desktop target row", async ({ browser }) => {
  const editHash = async (width: number, edit: (page: Page) => Promise<void>) => {
    const page = await browser.newPage({ viewport: { width, height: 844 } })
    if (width <= 760) await openReadyCompactCalculator(page)
    else await openReadyCalculator(page)
    await edit(page)
    await expect.poll(() => new URL(page.url()).hash).toContain("zip=")
    const hash = new URL(page.url()).hash
    await page.close()
    return hash
  }

  const compactHash = await editHash(390, async (page) => {
    await page.getByRole("button", { name: "Targets (1)" }).click()
    await page.getByRole("dialog", { name: "Production targets" }).getByRole("button", { name: "+ Add target" }).click()
    const sheet = page.getByRole("dialog", { name: "Edit target 2" })
    await sheet.getByLabel("Search target outputs").fill("processing unit")
    await sheet.getByRole("button", { name: "Select Processing unit as output" }).click()
    await sheet.getByRole("button", { name: "Rate", exact: true }).click()
    const rate = sheet.getByLabel("Rate for Processing unit")
    await rate.fill("30")
    await rate.press("Enter")
    await expect(rate).toHaveValue("30")
  })

  const desktopHash = await editHash(1280, async (page) => {
    await page.getByRole("button", { name: "+ Add target" }).click()
    await page.getByRole("button", { name: "Choose output for target 2: Advanced circuit" }).click()
    const outputDialog = page.getByRole("dialog", { name: "Choose output for target 2" })
    await outputDialog.getByLabel("Search target outputs").fill("processing unit")
    await outputDialog.getByRole("button", { name: "Select Processing unit as output" }).click()
    const rate = page.getByLabel("Rate for Processing unit")
    await rate.fill("30")
    await rate.press("Enter")
    await expect(rate).toHaveValue("30")
  })

  expect(compactHash).toBe(desktopHash)
})

test("desktop row drawer edits a row beside the table and stays in sync with inline controls", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page)
  await page.setViewportSize({ width: 1440, height: 960 })
  await openReadyCalculator(page)

  const edit = page.getByRole("button", { name: "Edit Advanced circuit in the row editor" })
  await expect(edit).toHaveAttribute("aria-expanded", "false")
  await edit.click()
  const drawer = page.getByRole("complementary", { name: "Advanced circuit" })
  await expect(drawer).toBeVisible()
  await expect(edit).toHaveAttribute("aria-expanded", "true")
  await expect(page.getByRole("dialog")).toHaveCount(0)

  await drawer.getByRole("button", { name: /^Assembling machine 3/ }).click()
  await expect(page.getByRole("button", { name: "Choose a machine for Advanced circuit" })).toHaveAttribute(
    "title",
    /Assembling machine 3/,
  )
  await expect(page.getByRole("button", { name: /^Advanced circuit module 4/ })).toBeVisible()

  const inlineBeacons = page.getByLabel("Beacon count for Advanced circuit").first()
  await inlineBeacons.fill("3")
  await inlineBeacons.press("Enter")
  await expect(drawer.getByLabel("Beacon count for Advanced circuit")).toHaveValue("3")

  await drawer.getByRole("button", { name: "Fewer beacons" }).click()
  await expect(inlineBeacons).toHaveValue("2")

  await drawer.getByRole("button", { name: "Fewer beacons" }).focus()
  await page.keyboard.press("Escape")
  await expect(drawer).toHaveCount(0)
  await expect(edit).toBeFocused()

  await edit.click()
  await expect(drawer).toBeVisible()
  await page.getByRole("button", { name: "Edit Iron plate in the row editor" }).click()
  await expect(page.getByRole("complementary", { name: "Iron plate" })).toBeVisible()
  await expect(drawer).toHaveCount(0)
  await page.getByRole("button", { name: "Edit Iron plate in the row editor" }).click()
  await expect(page.getByRole("complementary")).toHaveCount(0)
  expect(browserErrors, "uncaught browser errors").toEqual([])
})

test("browser back closes compact dialogs one level at a time and keeps plan edits", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await openReadyCompactCalculator(page)
  const back = () => page.evaluate(() => window.history.back())

  const card = page.getByRole("button", { name: "Edit Advanced circuit" })
  await card.click()
  const editor = page.getByRole("dialog", { name: "Advanced circuit" })
  await editor.getByRole("button", { name: /^Assembling machine 3/ }).click()
  await expect(editor.getByRole("button", { name: /^Assembling machine 3/ })).toHaveAttribute("aria-pressed", "true")
  const editedHash = new URL(page.url()).hash
  expect(editedHash).toContain("zip=")

  await back()
  await expect(editor).toHaveCount(0)
  await expect.poll(() => new URL(page.url()).hash).toBe(editedHash)
  await expect(card).toContainText("Assembling machine 3")

  await page.getByRole("button", { name: "Targets (1)" }).click()
  const screen = page.getByRole("dialog", { name: "Production targets" })
  await screen.getByRole("button", { name: "Edit target 1: Advanced circuit" }).click()
  const sheet = page.getByRole("dialog", { name: "Edit target 1" })
  await sheet.getByRole("button", { name: "Rate", exact: true }).click()
  const rate = sheet.getByLabel("Rate for Advanced circuit")
  await rate.fill("12")
  await rate.press("Enter")
  await expect(rate).toHaveValue("12")
  const targetHash = new URL(page.url()).hash
  await back()
  await expect(sheet).toHaveCount(0)
  await expect(screen).toBeVisible()
  await back()
  await expect(screen).toHaveCount(0)
  await expect.poll(() => new URL(page.url()).hash).toBe(targetHash)
  await expect(page.getByText("Advanced circuit · 12/m")).toBeVisible()

  await card.click()
  await editor.getByRole("button", { name: "Back to factory" }).click()
  await expect(editor).toHaveCount(0)
  await expect.poll(() => new URL(page.url()).hash).toBe(targetHash)
  await card.click()
  await expect(editor).toBeVisible()
  await back()
  await expect(editor).toHaveCount(0)
  await expect.poll(() => new URL(page.url()).hash).toBe(targetHash)
  expect(browserErrors, "uncaught browser errors").toEqual([])
})

test("compact flow graph starts zoomed in and pans and pinch-zooms with pointers", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await openReadyCompactCalculator(page)
  await page.getByRole("navigation", { name: "Calculator sections" }).getByRole("button", { name: "Visualise" }).click()
  const graph = page.locator("#graph")
  await expect(graph.locator("g").first()).toBeAttached()
  await expect(graph).toHaveCSS("touch-action", "none")

  const viewBox = async () => (await graph.getAttribute("viewBox"))?.split(" ").map(Number) ?? []
  await expect.poll(async () => (await viewBox()).length).toBe(4)
  const diagramWidth = await graph.evaluate((svg) => (svg as SVGSVGElement).getBBox().width)
  const [startX, , startWidth] = await viewBox()
  expect(startWidth).toBeLessThan(diagramWidth)

  const box = await graph.boundingBox()
  if (box === null) throw new Error("Graph has no box")
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 - 120, box.y + box.height / 2, { steps: 4 })
  await page.mouse.up()
  const [pannedX] = await viewBox()
  expect(pannedX).toBeGreaterThan(startX ?? 0)

  await graph.evaluate((svg) => {
    const rect = svg.getBoundingClientRect()
    const cx = rect.x + rect.width / 2
    const cy = rect.y + rect.height / 2
    const fire = (type: string, pointerId: number, clientX: number) =>
      svg.dispatchEvent(
        new PointerEvent(type, {
          pointerId,
          pointerType: "touch",
          clientX,
          clientY: cy,
          bubbles: true,
          cancelable: true,
        }),
      )
    fire("pointerdown", 11, cx - 20)
    fire("pointerdown", 12, cx + 20)
    fire("pointermove", 11, cx - 80)
    fire("pointermove", 12, cx + 80)
    fire("pointerup", 11, cx - 80)
    fire("pointerup", 12, cx + 80)
  })
  const [, , pinchedWidth] = await viewBox()
  expect(pinchedWidth).toBeLessThan(startWidth ?? 0)
  expect(browserErrors, "uncaught browser errors").toEqual([])
})

test("factory table keeps machines, modules, and beacons on one line beside the drawer", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 })
  await openReadyCalculator(page)
  await page.getByRole("button", { name: "Choose a machine for Advanced circuit" }).click()
  await page
    .getByRole("dialog", { name: "Machine and quality for Advanced circuit" })
    .getByRole("button", { name: /^Electromagnetic plant —/ })
    .click()
  await expect(page.getByRole("button", { name: /^Advanced circuit module 5/ })).toBeVisible()

  const layoutProblems = () =>
    page.locator("tr[data-item-key]").evaluateAll((rows) =>
      rows.flatMap((row) => {
        const machine = row.querySelector("td.factory-machine > div")
        const modules = row.querySelector("td.factory-modules")
        const cells = [
          ...row.querySelectorAll("td.factory-machine > div, td.factory-modules > div, td.factory-beacons > div"),
        ]
        const key = row.getAttribute("data-item-key") ?? ""
        return [
          ...(machine && modules && machine.getBoundingClientRect().right > modules.getBoundingClientRect().left + 1
            ? [`${key}: machine overlaps modules`]
            : []),
          ...cells.filter((cell) => cell.getBoundingClientRect().height > 40).map(() => `${key}: wrapped`),
        ]
      }),
    )
  expect(await layoutProblems()).toEqual([])
  await page.getByRole("button", { name: "Edit Advanced circuit in the row editor" }).click()
  await expect(page.getByRole("complementary", { name: "Advanced circuit" })).toBeVisible()
  expect(await layoutProblems()).toEqual([])
})

test("preset and copy plan link wrap together as the targets toolbar narrows", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 })
  await openReadyCalculator(page)
  const preset = page.getByLabel("Apply preset")
  const copy = page.getByRole("button", { name: "Copy plan link" })
  for (const width of [1440, 1100, 1024, 900, 770]) {
    await page.setViewportSize({ width, height: 800 })
    const presetBox = await preset.boundingBox()
    const copyBox = await copy.boundingBox()
    expect(presetBox, `preset at ${width}px`).not.toBeNull()
    expect(copyBox, `copy at ${width}px`).not.toBeNull()
    const presetMiddle = (presetBox?.y ?? 0) + (presetBox?.height ?? 0) / 2
    const copyMiddle = (copyBox?.y ?? 0) + (copyBox?.height ?? 0) / 2
    expect(Math.abs(presetMiddle - copyMiddle), `same line at ${width}px`).toBeLessThan(4)
    expect((copyBox?.x ?? 0) + (copyBox?.width ?? 0)).toBeLessThanOrEqual(width)
  }
})

test("factory equipment popovers escape the table scroller and stay inside the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 560 })
  await openReadyCalculator(page)

  const machine = page.getByRole("button", { name: "Choose a machine for Iron plate" })
  await machine.scrollIntoViewIfNeeded()
  await machine.click()

  const dialog = page.getByRole("dialog", { name: "Machine and quality for Iron plate" })
  await expect(dialog).toBeVisible()
  await expect(dialog).toBeInViewport()
  await expect(dialog.getByRole("button").last()).toBeInViewport()
})

test("popout target link opens the item calculation in a new tab", async ({ page, context }) => {
  const browserErrors = collectBrowserErrors(page)
  await openReadyCalculator(page)

  const popoutLink = page.getByRole("link", { name: "Add Electronic circuit as a production target" })
  await expect(popoutLink).toBeVisible()
  await expect(popoutLink).toHaveAttribute("target", "_blank")
  await expect(popoutLink).toHaveAttribute("rel", "noopener noreferrer")
  await expect(popoutLink).toHaveAttribute("href", /^#/)

  const [newPage] = await Promise.all([context.waitForEvent("page"), popoutLink.click()])

  await newPage.waitForLoadState()
  await expect(newPage.getByRole("button", { name: "Choose output for target 1: Electronic circuit" })).toBeVisible()
  await expect(newPage.getByRole("region", { name: "Factory summary" })).toBeVisible()
  expect(browserErrors, "uncaught browser errors").toEqual([])
})
