# heda AGENTS.md

SvelteKit 3 + Svelte 5 (runes) + Tauri 2 (desktop, Android) + a Rust engine (`crates/heda-core`) + Valibot + Formisch. Package manager: `bun`.

## Commands

- Desktop dev: `bunx tauri dev` (it starts `bun run dev`, the Vite server; the app needs the Tauri backend and does not run in a plain browser) · desktop build: `bunx tauri build` (runs `bun run build`)
- Tests (vitest, colocated `*.test.ts`): `bun run test`
- Formatting: `bun run format` (`bun fmt`, built into bun). Settings live in the `[fmt]` section of `bunfig.toml`; never reintroduce Prettier or its plugins.
- `.env` is optional: `BASE_PATH` (web builds only; dev and Tauri builds ignore it) and the legacy v1 migration keys `VITE_LEGACY_FILE_*` (production web builds define them empty; dev servers and tests still read them). Without those keys, v1 `.heda` files cannot be upgraded; v2/v3 files never need `.env`. See `.env.example`.

## Android

- Build: `ANDROID_HOME=~/Android/Sdk NDK_HOME=~/Android/Sdk/ndk/29.0.14206865 bunx tauri android build --apk --target aarch64`, then `adb -s <serial> install -r src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk` (`arm64/release` holds stale `dev --release` output). Always pin `adb -s`. Live runs: `bunx tauri android dev <model>` (e.g. `SM-A066B`; without a name it looks for an emulator); it still loads the Vite dev server, so judge speed on an installed build. Local release builds without `keystore.properties` are signed with the debug key; CI never is.
- Identifier is `com.peterjohnarao.heda` via `src-tauri/tauri.android.conf.json`. The desktop keeps `me.araopj.heda`: changing it moves `$APPLOCALDATA` and strands every install's device key.
- `src-tauri/gen/android` is committed and hand-edited (insets in `MainActivity.kt`, `DocumentsPlugin.kt`, backups off, signing from `keystore.properties`). Re-running `tauri android init` overwrites it.
- Detect with `isAndroidApp()` (`#lib/helpers/platform.ts`). Desktop-only there: popouts, Updates, single-instance, updater, "Show in folder".
- Projects live in `$APPLOCALDATA/projects` (`#lib/helpers/file/library.ts`). Picked files are `content://` URIs: import (copy) them in, export through the save dialog; never keep or save back to a picked URI.
- The back button is handled entirely in JS (`#lib/helpers/back-button.ts`).

## SvelteKit 3 notes

- No `svelte.config.js`: all Kit/Svelte config lives in the `sveltekit({ ... })` plugin in `vite.config.ts`.
- Removed modules: `$app/stores` → `$app/state`, `$app/environment` → `$app/env` (`browser`/`dev`/`building`/`version`), `$lib` → `#lib`. Never reintroduce them.
- `tsconfig.json` extends `$app/tsconfig`; `#` subpath mappings live in its `paths` (TS 6 does not resolve `package.json` `imports`, so both are needed; keep them in sync).

## Imports & aliases

- No folder that holds only an `index.ts`: a single module is a flat file (`#lib/validators/voltage-drop.ts`, `#lib/types/schedule.ts`, `#lib/constants.ts`). Folders with `index.ts` barrels are only for groups of several files (components, `utils/computations/`).

- `#lib/*` → `./src/lib/*`, `#routes/*` → `./src/routes/*` (see `imports` in `package.json` + `paths` in `tsconfig.json`). Always use aliases, never deep relative paths across folders, EXCEPT inside `new URL()` (e.g. `new Worker`), where `#` starts a URL fragment and breaks Vite resolution: use a relative path there.
- Valibot is always `import * as v from "valibot"`, and only inside `src/lib/validators/`.
- Icons come only from `#lib/assets/icons`, which re-exports phosphor-svelte with the `Icon` postfix via deep imports (`export { default as XIcon } from 'phosphor-svelte/lib/XIcon'`, which skips the 3000-export barrel). Never import icon components from anywhere else; never reintroduce `lucide-svelte`.

## Validators (Valibot)

- `src/lib/validators/` contains ONLY Valibot schemas and shared field consts. Nothing else lives there, and no schema lives anywhere else. Never define `v.object`/`v.pipe`/field schemas inline in `+page.ts`, `+layout.ts`, or components; import them.
- NO type aliases, interfaces, or `v.InferOutput` in validators/ (enforced: `grep -rnE "InferOutput|export (type|interface)" src/lib/validators/` must be empty). Types live in `lib/types` (below).
- NO value imports from `"valibot"` outside `src/lib/validators/**`. `import type` is allowed ONLY in `src/lib/types/**` for `v.InferOutput` derivation (enforced: `grep -rnE 'from ["'"'"']valibot["'"'"']' src | grep -v "src/lib/validators/" | grep -vE "^src/lib/types/[^:]*:[0-9]*:import type"` must be empty). Validate only through Formisch; never call `v.parse`/`v.safeParse` in components or load functions. If a non-Formisch caller ever needs direct parsing, its helper lives in validators/ (none exist today).
- One flat domain file per area (`load.ts`, `panel.ts`, …) plus a shared module `src/lib/validators/shared.ts` for reusable fields. Reuse before duplicating.
- Exported schema/field consts are `UPPER_SNAKE_CASE`:
  ```ts
  // shared.ts
  export const NAME_FIELD = v.pipe(v.string(), v.nonEmpty());
  // panel.ts
  import { NAME_FIELD } from './shared';
  export const GENERIC_PHASE_PANEL_SCHEMA = v.object({ name: NAME_FIELD });
  ```
- Re-export every domain file from `src/lib/validators/index.ts`. Import from the domain file (`#lib/validators/panel.js`), not the barrel, in load functions and components.

## Types (lib/types)

- EVERY domain type lives in `src/lib/types/` and is derived from a validator: `export type PanelInput = v.InferOutput<typeof GENERIC_PHASE_PANEL_SCHEMA>;` Compose with `Pick`/`Omit`/`Extract`/intersections only, never redeclare fields by hand.
- Never hand-write an interface/type that duplicates a schema shape.
- Composite types (`FileExport`, `PhaseLoadSchedule`, `VoltageDrop`, …) intersect/extend derived types; their leaf domain values still come from validators.
- Exempt from derivation but still in `lib/types`: engine payload shapes (`EngineComputed`), generic helpers (`LabelValuePair`, …), and tiny UI/persisted shapes with no validation site.
- `Props` interfaces and per-page types live in `<script module>` of their component, importing leaf types from `#lib/types/*`.

## Forms (Formisch)

- ALL form state, validation, and submission go through `@formisch/svelte` (`createForm`, `Field`, `validate`, `setInput`, `getInput`, …). `sveltekit-superforms`/`formsnap` are removed. Never reintroduce them.
- Text inputs: `<Input {...field.props} value={field.input ?? ''} />`. Number inputs: same spread PLUS `oninput={(e) => field.onInput(e.currentTarget.valueAsNumber)}` (Formisch delivers strings otherwise and `v.number()` rejects them).
- Bits-UI controls (Checkbox, RadioGroup, Popover selects): wire manually inside the `Field` snippet (`checked={field.input ?? false}` + `onCheckedChange={(v) => field.onInput(v)}`, etc.); never spread `field.props` onto them.
- Initial values are a mount snapshot: compute `initialInput` from props in a plain builder function (closure reads resolve `state_referenced_locally` instead of suppressing it). Never `$effect`-sync props into form state.
- Reactive cross-field reads use `$derived(getInput(form, { path: [...] }))` (Formisch signals are `$state`-backed, so this tracks).
- Submit with `validate(form)`; on success use `result.output` (typed). Errors render via the shared `#lib/components/custom/field-errors.svelte`.
- Pages/components import only TYPES in `<script module>` (form output types, `Props`); schemas stay regular imports and are consumed only via Formisch.
- Pure field consts and pure helper functions MUST live in `<script module>`, never in instance `<script>`.

## Svelte 5 conventions

- Runes only (`$props`, `$state`, `$derived`, `$derived.by`). No legacy `export let`, no stores where a rune fits.
- Avoid `$effect`: prefer `$derived`/`$derived.by`, event handlers, or `onMount` for true external sync (subscriptions, observers, imperative DOM). Never use `$effect` to compute derivable state or to sync props → local state; if an effect is unavoidable, comment why in one line.
- Script order: imports first (`import type` in `<script module>`, value imports in instance `<script>`), then:
  1. `<script module>`: ALL imported/declared types (`Props`, input/output types), shared consts, pure helpers. Types and pure code MUST live here, never in instance `<script>`. No runes, no side effects.
  2. `<script>` top, directly below the tag: runes + lifecycle (`$props`, `$state`, `$derived`, `onMount`/`onNavigate`/unavoidable `$effect`, store init).
  3. Middle: functions with side effects (handlers, fetchers, subscriptions).
  4. Bottom: pure local functions and local consts.
- Use the Svelte MCP server when available: `list-sections` first, then `get-documentation` for ALL relevant sections, `svelte-autofixer` until clean on every Svelte edit. Never `playground-link` for project files (only on explicit user request for snippets).

## Quality gate

- Done = ZERO errors and ZERO warnings across every check below. The repo is fully clean. Never ship a finding.
- Fast first, slow last, each once:
  1. `bun run lint` (`bun fmt --check` + eslint, repo-wide). Run after edits.
  2. `bun run test` (vitest): the tests covering your change, at minimum.
  3. `bun run check` (svelte-check, slow): ONCE at the end, never after every edit, never `--watch` in agent runs.
- Bug fixes and behavior changes keep a colocated `*.test.ts` (see `src/lib/utils/format.test.ts`); validator changes extend `src/lib/validators/validators.test.ts`.
- `validators.test.ts` (inside `validators/`) is the one place outside Formisch allowed to call `v.safeParse`.
- Never run `vite build` to validate code, except when touching Vite/adapter/prerender-affecting config (the one area `check` cannot see). No `svelte-kit sync` except as part of `bun run check`.

## Database (session store)

- The open project lives in the Rust engine (`Session` in `crates/heda-core/src/session.rs`), held by the Tauri backend, so a webview reload finds it again and a fresh launch starts empty. Never reintroduce SignalDB, RxDB, session files or a Stronghold vault.
- `src/lib/db/index.ts` keeps a mirror of the documents for synchronous reads. Tree edits (add, update, move, copy, remove, field patches) are engine commands planned in `crates/heda-core/src/edit.rs`, called through `edit()` and the helpers in `#lib/db/mutations/`: the engine checks the supply rules, stores the edit as one undoable step and answers with the documents it wrote and the rows it recomputed, which the mirror then applies; a refusal is the engine's message and changes nothing. Await them. Session-level writes (`closeSession`, `openFile`, `setProject`) change the mirror at once. Never write node documents into the mirror any other way. `await settled()` in tests before reading computed results of non-edit writes.
- Undo/redo is the engine's history (`Session::commit`, the last 100 edits, cleared on open). `UndoRedoState` only mirrors its depth and the unsaved flag; never record undo entries in TS.
- Same-session restore: on a webview reload, `initializeDatabase()` takes the engine's `snapshot` only while `getSessionPassword()` is set (cleared on home/reset); otherwise it closes the engine session. There is no browser-only mode: the app needs Tauri (`bunx tauri dev`).
- Documents are schemaless: the engine fills in node defaults (`crates/heda-core/src/defaults.rs`) on every open and every created node. Opened files and new projects go through `openFile` (engine `open_file`): the engine migrates them (`crates/heda-core/src/migrate.rs`) and completes them with those defaults, and the mirror takes the documents it answers with.
- Queries/mutations return plain objects. Voltage drops and short circuits come from the engine on demand (`getComputed*Async`, cached per snapshot revision).
- DB changes extend `src/lib/db/db.test.ts` (runs on the WASM engine under node).

## Rust engine (crates/heda-core)

- New calculations and features go in Rust (`crates/heda-core`, pure, no Tauri deps); Svelte is UI only. Pages read the engine's results; every export (Excel `workbook.rs`, the sheet set PDF, the riser SVG) is written by the engine itself through `engineFile()`, with maintained crates (rust_xlsxwriter, krilla, svg), never in TypeScript. `#lib/utils/computations` keeps only UI helpers (phase picks, supply checks, the horsepower picker); never add a calculation there.
- Two entry points, both in `src/dispatch.rs`: `dispatch(session, command, args) -> Result<Value, String>` for JSON, and `dispatch_file(...) -> Result<Vec<u8>, String>` for every file the engine writes (exports). The app reaches them through the Tauri `heda` command (`engine()` in `#lib/core/api.ts`, calls run in order) and the async `heda_file` command (`engineFile()`), which copies the `Session` under the lock and builds outside it; `engineFile` starts after every earlier call has answered, and later calls do not wait for it. Never add another Tauri command into the engine. Vitest reaches the same `dispatch` through the WASM build (`bun run core`, run by `test`/`check`; needs `wasm-bindgen-cli` at the exact version pinned in `Cargo.toml`). Only `MODE === 'test'` loads it, so no app build ships it.
- Plain Rust only, no JavaScript semantics: no ports of `toFixed`, `Number(string)`, `||` truthiness or V8 `Math.hypot`. Shared number rules live in `src/num.rs` (`round` to N decimals, `display`, `positive` for "given" inputs and overrides, `stored` for numbers kept as JSON numbers or text, `is_set` for stored flags); otherwise use `f64` and `Option` directly (`f64::hypot`, `f64::max`, `filter`/`unwrap_or`). `src/lib/core/golden.test.ts` runs every sample through the app's queries (and so the engine) against `src/lib/core/golden/` as a regression lock; a golden only changes in a commit that says why. (`legacy_v1.rs` is the one exception: it must reproduce CryptoJS to open v1 files, until v1 support is dropped.)
- PEC tables live only in `src/tables.rs`, each citing its table; verify values on rendered page images (`pdftoppm`), the PDF text layer is corrupt in places. Worked examples (App. D) are cargo integration tests in `crates/heda-core/tests/`. The UI reads the choices it offers (override steps, motor horsepower pickers) from the engine's `catalog`, loaded once at startup, through `getCatalog()` (`#lib/core/catalog.ts`); never copy a PEC table into TS.
- `bun run lint` includes `cargo fmt --check` and `cargo clippy -D warnings`; `bun run test` includes `cargo test`.

## Crypto & file passwords

- All crypto is WebCrypto ONLY (`src/lib/helpers/security/index.ts`: PBKDF2-SHA256, AES-256-GCM, `getRandomValues`). Never reintroduce `crypto-js`. The one exception is the legacy v1 reader, `crates/heda-core/src/legacy_v1.rs` (engine commands `is_legacy_v1`/`legacy_v1_decrypt`, called from `legacy/v1.ts`): CryptoJS's 512-bit AES and fractional hex salts fit no WebCrypto or RustCrypto API, so those parts are hand-ported there, around `sha2`/`hmac`. It is temporary; delete it when v1 support is dropped, and never use it for new formats.
- The device key (`src/lib/helpers/security/device-key.ts`) is one random 256-bit key per installation, stored in an owner-only file (`heda-d` in `$APPLOCALDATA`) on Tauri, else `localStorage`. It is the default file seal, so local files open/save with no password. Never move it into a `.heda` file; it is what keeps files unreadable in text editors.
- `.heda` format: one JSON envelope. v3 `{v:3,payload}` is sealed with the raw device key (AES-256-GCM, no KDF, milliseconds). v2 `{v:2,salt,payload}` is sealed with the user's file password (PBKDF2 100k + GCM) and exists for files that must be shared with other devices. Format code lives in `src/lib/helpers/file/format.ts` (pure, tested). Password problems surface as `FilePasswordError` (`required`/`invalid`); a v3 file sealed on another device surfaces as `FileDeviceKeyError`; v1 bytes surface as `FileLegacyError` from the format code; the open flow then upgrades them through `legacy/migration.ts` when the `VITE_LEGACY_FILE_*` keys are present.
- The file password (when a file has one) lives ONLY in `src/lib/db/session.ts` (memory, cleared on home/reset) and the file seal. The one exception is that module's own `sessionStorage` mirror (`heda-session`, tab-scoped, cleared with the session) so a same-tab reload can re-unlock the session store. Never persist it anywhere else (no localStorage, no `highest_unit_form`, no logs), never read the mirror directly, never pass it through props; call `getSessionPassword()` at the call site. File protection mode (`device`|`password`) is stored in the same entry, so the two are always written together (`setSession`).
- Password inputs validate through `PASSWORD_FIELD` (`src/lib/validators/shared.ts`, min 8) wherever Formisch is in play; standalone prompts (`PasswordDialog`) enforce the same min-8/match rules locally.
- Crypto changes extend `security.test.ts` + `format.test.ts`.

## Dependencies

- `cn` (from `"cn"`) is the only class-merge helper. Never reintroduce `clsx`/`tailwind-merge`.
- IDs come from `crypto.randomUUID()`. Never reintroduce `cuid2`.
- Secrets stay per-variable: one GitHub secret / `.env` key each, referenced individually in CI. Never bundle them into a single blob secret again.

## Svelte MCP tools

- `list-sections`: discover docs FIRST on any Svelte/SvelteKit task.
- `get-documentation`: fetch ALL relevant sections (check `use_cases`).
- `svelte-autofixer`: MUST pass with no issues/suggestions before finishing Svelte code.
- `playground-link`: only after user confirmation, never for project files.
