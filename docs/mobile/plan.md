# Mobile interface plan

Status: PR 1 implemented on branch `mobile-interface` (uncommitted); PR 2 not started. Drafted 2026-10-18 from the claude.ai artifact "Factorio Calculator – Mobile Mockups"
(https://claude.ai/artifact/KXHEY9cz4WG1Q5LMFb8YmB). Line references checked against commit `7f9a0e7`; re-search the
symbol before trusting a line number.

## Mockups

Local copies live in [`mockups/`](mockups/). They are static design-canvas exports, so they reference a `support.js` that
isn't included and load IBM Plex from Google Fonts. Read them as layout references, not as running pages.

| Board                                          | File                     | Covered by this plan    |
| ---------------------------------------------- | ------------------------ | ----------------------- |
| 1 · Factory as cards (390×844)                 | `Main.dc.html`           | Phase 2                 |
| 2 · Targets + item picker (390×844)            | `Targets.dc.html`        | Phase 4                 |
| 3 · Row editor sheet (390×844)                 | `RowSheet.dc.html`       | Phase 3                 |
| 4 · Desktop factory + row editor drawer (1440) | `DesktopFactory.dc.html` | No, see open question 4 |
| 5 · Desktop targets drawer (1440)              | `DesktopTargets.dc.html` | No, see open question 4 |

[`screenshots/`](screenshots/) holds captures of the app as it was before this work (desktop factory, desktop settings,
and mobile factory at 390px).

The mobile mockups show:

1. **Factory as cards.** A header, a strip with Power, Machines and Rate, a one-line summary of the current target, one
   card per factory row, and a bottom navigation bar with 5 tabs.
2. **Targets.** A list of targets with a bottom sheet for editing one: item search with an icon grid, a Rate/Machines
   switch, a stepper, a quality select, a belts readout, and a Done button.
3. **Row editor.** A full-screen editor for one factory row: machine choice, module slots with a module palette, beacons,
   location, a stats summary and an "Ignore this item" button.

## Current state

Mobile is handled only by the `@media (max-width: 760px)` block in `BASE_CSS` (`src/main.tsx:66-101`). Below that width
the factory table keeps its desktop columns and scrolls sideways (sticky first two columns). The target grid is restacked
with negative margins. `calc.html` has `width=device-width, initial-scale=1` but no `viewport-fit=cover`.

This plan replaces that with a separate mobile layout. Everything stays inside the `react-ui.tsx` region of
`src/main.tsx`, as AGENTS.md requires.

## Key decisions

- **Choose the layout in React, not only in CSS.** Cards and a table are different DOM, and rendering both then hiding
  one with CSS doubles the work on every recalculation. Add a small `useCompactLayout()` in the react-ui region. It uses
  `useSyncExternalStore` over `matchMedia("(max-width: 760px)")`. This counts as disposable view state, which AGENTS.md
  allows. During server rendering it reports desktop, so the existing `renderToStaticMarkup` UI tests keep passing.
  `scripts/check-architecture.mjs` doesn't block `matchMedia`.
- **No new state or model methods.** Every mobile control calls the same `BuildTarget` and specification methods as the
  desktop controls: `setRate`, `setBuildings`, `setBeaconCount`, `setBeltStackOverride`, the module and machine setters,
  and the imported/ignored toggle. As a result, URLs, persistence and calculation don't change.
- **Share row data between the table and the cards.** `ItemTable` (`src/main.tsx:13795`) builds its rows inline from
  `topoSort(getRecipeGroups(...))`. Extract that into one function in the react-ui region that both `ItemTable` and the
  new card list use, so rows are never built a second way.
- **Use the existing theme, not the mockup's colours or fonts.** Map the mockup's dark, amber and grey onto the existing
  `THEME_VARIABLES`. Don't add IBM Plex from Google Fonts; that would be a new startup dependency. Replace the
  "EC"/"CC" letter tiles with `SpriteIcon`.
- **Keep every desktop feature.** The mockups leave out controls that mobile still needs: the recipe picker, belt
  stacking, beacon quality, module quality, and the location/preset/copy-link toolbar. Each gets a place below.

## Phases

### 1. Shell and navigation

- When `useCompactLayout()` is true, `CalculatorView` (`src/main.tsx:17329`) renders a mobile shell instead of
  `TargetsPanel` followed by `TabBar` (`src/main.tsx:17339-17340`). The shell has:
  - a header with the section title and a Copy plan link button;
  - the content for the active tab;
  - `TabBar` (`src/main.tsx:13246`) as a fixed bottom bar, with icons and the same `commands.selectTab`.
- Tab state stays in the URL as `tab=`, so the URL format doesn't change.
- Add `padding-bottom: env(safe-area-inset-bottom)` and add `viewport-fit=cover` to the `calc.html` viewport meta.

### 2. Factory tab as cards (mockup 1)

- `FactoryPanel` (`src/main.tsx:15443`) renders a card list instead of `ItemTable` (`src/main.tsx:15559`) on mobile.
  - The summary strip reuses the values from `FactorySummaryView` (`src/main.tsx:13333`).
  - The target line under it shows the first target and "+N more", and links to Targets.
- Each card is a `<button>` showing the icon, item name, machine name, rate, and chips for machine count, modules,
  beacons and belts. Target rows get an accent; ignored rows are dimmed. Tapping a card opens the row editor.
- `PlanningDetails` (`src/main.tsx:15560`) stays below the list; `ItemBreakdown` moves into the row editor.

### 3. Row editor screen (mockup 3)

- Full-screen view tracked by local state (`editingRowKey`), with a back button.
- **Machine:** a segmented group built from the same options as `InlineMachinePicker` (`src/main.tsx:14503`).
- **Recipe:** a section the mockup doesn't show, using the `RecipeIconPicker` (`src/main.tsx:13404`) options inline.
- **Modules:** slot buttons plus a palette. Tapping a slot selects it; tapping a palette module fills it. "Fill all"
  applies the module to every slot. Module quality uses `EquipmentQualityStrip` (`src/main.tsx:14436`).
- **Beacons:** a count stepper wrapping the `setBeaconCount` commit, plus the beacon module picker and beacon quality.
- **Location:** chips built from `InlineLocationSelect` (`src/main.tsx:14632`), shown only when more than one planet is
  selected (same rule as the table column).
- **Belts:** the stacking select (Default / Auto / Stacked / Unstacked).
- **Stats:** effective speed, productivity, power per machine and output belts. Read these from existing breakdown data
  (`getItemBreakdown`, `src/main.tsx:13608`) or the owning model method. Convert to floats only when formatting. No new
  calculations here.
- **"Ignore this item":** the existing imported/ignored toggle.

### 4. Targets screen (mockup 2)

- Opens from the target line on the factory tab and from the header. Lists targets; each opens a bottom sheet.
- Build the sheet as a native `<dialog>` opened with `showModal()` (focus trapping, Escape and inert background for
  free), using a ref and effect like the existing popovers. This is the first `<dialog>` in the codebase; the
  alternative is a fixed `role="dialog"` div like `InlineEquipmentPopover` (`src/main.tsx:14341`).
- **Item:** a search field and icon grid, reusing the filtering and grouping in `TargetItemPicker`
  (`src/main.tsx:12827`) rendered inline instead of as a popover.
- **Rate/Machines switch:** chooses `target.setRate` or `target.setBuildings`. Disable Machines under today's
  conditions: no recipe, or quality above normal.
- **Belts:** keep it editable (`setBelts`), because desktop allows that.
- **Toolbar items:** location and preset at the top of the Targets screen; copy link in the header.

### 5. Other tabs and touch sizing

- **Visualize:** let the toolbar wrap and make the graph fill the available height. `src/visualization.ts` doesn't
  change; check that D3 zoom handles pinch.
- **Resources, Settings and Help:** mostly already work under the 760px query. Remove the `max-content` widths.
- **Touch targets:** one `@media (pointer: coarse)` rule in `BASE_CSS` raising control, button and tab minimum heights
  to 44px through variables, like the density variables.
- **Old CSS:** delete the target-grid restacking (`margin-top: -53px` etc.) and the sticky-column factory-table rules
  once mobile no longer renders the table. Net reduction in CSS.

### 6. Tests and gate

- **Playwright:** add a mobile project (`devices["iPhone 13"]` or 390×844 Chromium) or viewport-setting tests covering:
  - no horizontal page scroll;
  - one card per factory row;
  - an edit in the row editor produces the **same URL hash** as the same edit in the desktop table (the key
    mobile/desktop equivalence check);
  - Targets sheet: add a target, edit its rate, switch Rate/Machines, focus and Escape;
  - the bottom bar switches tabs and keeps `tab=` in sync.
- **Existing tests:** update the 390px test in `tests/e2e/calculator.spec.ts` (around line 335), which expects the
  desktop target/recipe popovers at phone width.
- **UI tests:** let the card list and row editor take a `layout` prop so `tests/ui` can render them with
  `renderToStaticMarkup`.
- **Checks:** `check:quick`, `test:ui`, `test:e2e`, `bench:check`. Watch `check-build-budgets`: the mobile UI ships in
  the initial bundle.

## Decisions

All four recommendations were accepted on 2026-10-19.

1. Should opening the row editor or Targets screen add a history entry, so Android back closes it? That means a new URL
   parameter and round-trip tests. **Start with local state; add history later if wanted.**
2. What should the mockup header's "Row density" button do on cards? **Drop it on mobile.**
3. Breakpoint: 760px width only, or width plus `pointer: coarse`? **760px width only, so a narrow desktop window gets
   cards too.**
4. Mockups 4 and 5 show a desktop row-editor drawer and a desktop targets drawer. PLANS.md currently says "do not add a
   second expanded equipment editor" on desktop. **Treat them as out of scope until that rule is revisited; the mobile
   row editor should be built so a desktop drawer could reuse it later.**

## Delivery

- **PR 1:** phases 1–3 (cards aren't usable without the row editor).
- **PR 2:** phases 4–6.

## Next steps

PR 1, in order. Each step should leave the app working at both widths.

1. ~~**Baseline.**~~ Done 2026-10-19 on `7f9a0e7`: `check:quick`, `test:core` (92), `test:ui` (48), `test:e2e` (10),
   `bench:check`, `build:site` and `validate:build` all pass. Initial JS 521,620 B / 147,379 B gzip against budgets of
   700,000 B / 200,000 B.
2. ~~Answer open questions 1–4.~~ Done: recommendations accepted.
3. ~~**Extract factory rows.**~~ Done: `getFactoryRows()` builds rows and per-row values for both views.
4. ~~**Add `useCompactLayout()`.**~~ Done. `CalculatorView` also takes an optional `compact` override for tests.
5. ~~**Mobile shell.**~~ Done: compact header (skipped on Help, which has its own `h1`), fixed bottom `TabBar` with
   icons, safe-area padding, `viewport-fit=cover`. `TargetsPanel` still renders above the content until PR 2. The
   header Copy-link button moves in PR 2 with the rest of the toolbar, to avoid two identical buttons.
6. ~~**Factory cards.**~~ Done: `FactoryCardList`, compact `FactorySummaryView`. The target line under the summary waits
   for the PR 2 Targets screen it links to.
7. ~~**Row editor.**~~ Done: `FactoryRowEditor` is a native modal `<dialog>`. Escape inside a nested popover closes only
   the popover. Stats shown: crafts per machine, productivity, recipe rate, power per machine.
8. ~~**Tests for PR 1.**~~ Done: two UI tests (cards/bottom bar; editor sections) and three Playwright tests (cards,
   tabs, no horizontal scroll and tab persistence; editor edits, location chips, Escape and focus return; mobile vs
   desktop URL-hash equivalence). The old 390px table-scroll test was replaced.
9. ~~**Gate.**~~ Done 2026-10-19: `pnpm verify` and `test:e2e` (12) pass. Initial JS 539,622 B / 151,652 B gzip
   (+18,002 B / +4,273 B).

Then PR 2: Targets screen and `<dialog>` sheet, other-tab pass, `pointer: coarse` sizing, deletion of the old 760px
table/target-grid CSS, and the remaining Playwright coverage.
