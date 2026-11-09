# heda AGENTS.md

SvelteKit 3 + Svelte 5 (runes) + Tauri 2 (desktop) + SignalDB + Valibot + Formisch. Package manager: `bun`.

## Commands

- Web dev: `bun run dev` · production web build: `bun run build` · desktop dev: `bunx tauri dev` · desktop build: `bunx tauri build`
- Tests (vitest, colocated `*.test.ts`): `bun run test`
- `.env` holds web-build config only (`BASE_PATH`, loaded by Vite). Tauri builds and all `.heda` files (per-file user passwords) never touch it. See `.env.example`.

## SvelteKit 3 notes

- No `svelte.config.js`: all Kit/Svelte config lives in the `sveltekit({ ... })` plugin in `vite.config.ts`.
- Removed modules: `$app/stores` → `$app/state`, `$app/environment` → `$app/env` (`browser`/`dev`/`building`/`version`), `$lib` → `#lib`. Never reintroduce them.
- `tsconfig.json` extends `$app/tsconfig`; `#` subpath mappings live in its `paths` (TS 6 does not resolve `package.json` `imports`, so both are needed; keep them in sync).

## Imports & aliases

- `#lib/*` → `./src/lib/*`, `#routes/*` → `./src/routes/*` (see `imports` in `package.json` + `paths` in `tsconfig.json`). Always use aliases, never deep relative paths across folders, EXCEPT inside `new URL()` (e.g. `new Worker`), where `#` starts a URL fragment and breaks Vite resolution: use a relative path there.
- Valibot is always `import * as v from "valibot"`, and only inside `src/lib/validators/`.
- Icons come only from `#lib/assets/icons`, which re-exports phosphor-svelte with the `Icon` postfix via deep imports (`export { default as XIcon } from 'phosphor-svelte/lib/XIcon'`, which skips the 3000-export barrel). Never import icon components from anywhere else; never reintroduce `lucide-svelte`.

## Validators (Valibot)

- `src/lib/validators/` contains ONLY Valibot schemas and shared field consts. Nothing else lives there, and no schema lives anywhere else. Never define `v.object`/`v.pipe`/field schemas inline in `+page.ts`, `+layout.ts`, or components; import them.
- NO type aliases, interfaces, or `v.InferOutput` in validators/ (enforced: `grep -rnE "InferOutput|export (type|interface)" src/lib/validators/` must be empty). Types live in `lib/types` (below).
- NO value imports from `"valibot"` outside `src/lib/validators/**`. `import type` is allowed ONLY in `src/lib/types/**` for `v.InferOutput` derivation (enforced: `grep -rnE 'from ["'"'"']valibot["'"'"']' src | grep -v "src/lib/validators/" | grep -vE "^src/lib/types/[^:]*:[0-9]*:import type"` must be empty). Validate only through Formisch; never call `v.parse`/`v.safeParse` in components or load functions. If a non-Formisch caller ever needs direct parsing, its helper lives in validators/ (none exist today).
- One domain file per area (`load/`, `panel/`, …) plus a shared module `src/lib/validators/shared.ts` for reusable fields. Reuse before duplicating.
- Exported schema/field consts are `UPPER_SNAKE_CASE`:
  ```ts
  // shared.ts
  export const NAME_FIELD = v.pipe(v.string(), v.nonEmpty());
  // panel.ts
  import { NAME_FIELD } from './shared';
  export const GENERIC_PHASE_PANEL_SCHEMA = v.object({ name: NAME_FIELD });
  ```
- Re-export every domain file from `src/lib/validators/index.ts`. Import from the domain file (`#lib/validators/panel`), not the barrel, in load functions and components.

## Types (lib/types)

- EVERY domain type lives in `src/lib/types/` and is derived from a validator: `export type PanelInput = v.InferOutput<typeof GENERIC_PHASE_PANEL_SCHEMA>;` Compose with `Pick`/`Omit`/`Extract`/intersections only, never redeclare fields by hand.
- Never hand-write an interface/type that duplicates a schema shape.
- Composite types (`FileExport`, `PhaseLoadSchedule`, `VoltageDrop`, …) intersect/extend derived types; their leaf domain values still come from validators.
- Exempt from derivation but still in `lib/types`: SignalDB `Collection<…>` aliases, generic helpers (`LabelValuePair`, …), and tiny UI/persisted shapes with no validation site.
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
  1. `bun run lint` (prettier + eslint, repo-wide). Run after edits.
  2. `bun run test` (vitest): the tests covering your change, at minimum.
  3. `bun run check` (svelte-check, slow): ONCE at the end, never after every edit, never `--watch` in agent runs.
- Bug fixes and behavior changes keep a colocated `*.test.ts` (see `src/lib/utils/format/format.test.ts`); validator changes extend `src/lib/validators/validators.test.ts`.
- `validators.test.ts` (inside `validators/`) is the one place outside Formisch allowed to call `v.safeParse`.
- Never run `vite build` to validate code, except when touching Vite/adapter/prerender-affecting config (the one area `check` cannot see). No `svelte-kit sync` except as part of `bun run check`.

## Database (SignalDB)

- Store: `@signaldb/core` v1 `Collection<Project>` / `Collection<Node>` (see `src/lib/db/index.ts`). Never reintroduce RxDB.
- Persistence: `@pitzzahh/signaldb-adapter-tauri` in Tauri, pure memory in web dev/preview. Detect via `isTauri()` from `@tauri-apps/api/core`.
- Session encryption key is a per-session random passphrase kept in a Stronghold vault (`tauri-plugin-stronghold`, argon2 snapshot KDF, registered in `src-tauri` builders + `stronghold:default` capability). The vault password is the session secret (the open file's password, or the device key for device-encrypted files). Never hardcoded, never persisted.
- Never await Stronghold bare: its Rust memory protection can panic (sandboxed kernels, locked-memory limits) and leave the IPC promise unsettled, hanging the UI at loading. Every vault access races `withTimeout` (5s) and degrades to memory-only on timeout: no retry after a hang, only after an active throw (corrupt vault).
- Session-scoped by design: `databaseInstance()` wipes the session files (including the vault) on launch so every start begins empty. Do NOT add cross-session restore without a product decision.
- Session files are deliberately nondescript and extensionless (`heda-p`, `heda-n`, `heda-v` in `$APPLOCALDATA`); never rename them to something advertising their contents.
- The store is schemaless: every insert path MUST merge `withNodeDefaults` / `withProjectDefaults` (in `src/lib/db/mutations/`); that is where the old schema defaults live now.
- Queries/mutations return plain objects and keep async signatures even though SignalDB calls are sync. After `updateOne`, re-fetch with `findOne` for the updated doc. Sort uses `{ field: 1 | -1 }`, never `'asc'`/`'desc'`.
- DB changes extend `src/lib/db/db.test.ts` (runs on memory under node).

## Crypto & file passwords

- All crypto is WebCrypto ONLY (`src/lib/helpers/security/index.ts`: PBKDF2-SHA256, AES-256-GCM, `getRandomValues`). Never reintroduce `crypto-js`.
- The device key (`src/lib/helpers/security/device-key.ts`) is one random 256-bit key per installation, stored in an owner-only file (`heda-d` in `$APPLOCALDATA`) on Tauri, else `localStorage`. It is the default file seal, so local files open/save with no password. Never move it into a `.heda` file; it is what keeps files unreadable in text editors.
- `.heda` format: one JSON envelope. v3 `{v:3,payload}` is sealed with the raw device key (AES-256-GCM, no KDF, milliseconds). v2 `{v:2,salt,payload}` is sealed with the user's file password (PBKDF2 100k + GCM) and exists for files that must be shared with other devices. Format code lives in `src/lib/helpers/file/format.ts` (pure, tested). Password problems surface as `FilePasswordError` (`required`/`invalid`); a v3 file sealed on another device surfaces as `FileDeviceKeyError`; v1 bytes are recognized but no longer openable (`FileLegacyError`).
- The file password (when a file has one) lives ONLY in `src/lib/db/session.ts` (memory, cleared on home/reset) and the file seal. Never persist it (no localStorage, no `highest_unit_form`, no logs), never pass it through props; call `getSessionPassword()` at the call site. File protection mode (`device`|`password`) is tracked alongside it in the same module.
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
