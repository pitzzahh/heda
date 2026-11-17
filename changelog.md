# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.9.0-2] - 2026-11-17

### Fixed

- Preview installs are offered new previews, not only stable releases

## [2.9.0-1] - 2026-11-17

### Added

- An Android app, with projects kept in app storage and files imported and exported through the system picker
- A phone and tablet layout: dialogs open as bottom drawers, the sidebar is a full-width sheet, and forms, the load schedule and settings fit narrow screens

### Fixed

- Settings switches slide their thumb instead of snapping

## [2.8.1] - 2026-11-17

### Fixed

- Popout windows are styled on Windows instead of opening unstyled

## [2.8.0] - 2026-11-17

### Added

- Three-phase wye (400Y/230 V) panels and loads, with phase-by-phase
  schedules, feeder sizing that checks the balanced and most loaded phase,
  and an action to balance single-phase circuits across A, B and C
- Three-phase motors fed line to line at 400 V, with full-load currents from
  PEC 2017 Table 4.30.14.4
- A Short Circuit tab that computes available fault current at each node and
  flags breakers rated below it
- Schedule tabs can move into their own windows and dock back, so a table can
  sit on a second screen while the sidebar keeps editing
- Recent projects on the home page, and an editable distribution unit name at
  project creation
- A Show in folder action on export and save notifications, and a save dialog
  for Excel exports on desktop so the destination is chosen up front

### Changed

- Excel exports size columns once per sheet instead of once per cell, so large
  projects no longer time out in the export worker
- The home page follows the workspace top bar and shows its branding once

### Fixed

- Breaker, conductor, heating, conduit fill and voltage drop tables follow
  PEC 2017, with old conduit overrides moved to the current raceway sizes on
  open
- Exports no longer fail with a DataCloneError after the workbook is built

## [2.7.5] - 2026-11-15

### Fixed

- Text fields, dropdowns and buttons in forms are the same height, and
  every dropdown field looks like the inputs beside it
- Dialog titles and dividers no longer sit on top of the first field
- The sidebar opens and closes smoothly, and follows the cursor when
  dragging its edge to resize it

## [2.7.4] - 2026-11-15

### Changed

- Large projects respond faster: finding, editing, copying and removing
  panels and loads no longer scans every node in the project, and a bulk
  copy or delete refreshes the schedule once instead of once per node
- Saving the session to disk folds a burst of edits into one write and
  skips a decryption step on each save

## [2.7.3] - 2026-11-15

### Fixed

- The Windows app no longer closes by itself a few seconds after it opens.
  Builds 2.7.0 to 2.7.2 were linked against the wrong system library for
  thread synchronization and crashed on launch

## [2.7.2] - 2026-11-15

### Fixed

- The update download shows its own progress panel with the size downloaded
  so far, instead of a bar squeezed into the button that could read `NaN%`
- A failed download or install offers a retry instead of hanging at 0%
- "Up to date" can be checked again without restarting the app

## [2.7.1] - 2026-11-15

### Fixed

- Linux installs from the tarball update themselves: the updater now replaces
  the `heda` binary instead of writing the `.deb` package over it, which left
  the app unable to start
- The Linux tarball is attached to the same release as the other bundles

## [2.7.0] - 2026-11-15

### Added

- Native desktop bundles on every release: macOS arm64 and Intel disk images,
  Windows MSI and NSIS installers, Linux deb/rpm plus a plain tarball of the
  native binary
- Component and unit test suite for the UI layer: overlay primitives, animation
  contracts, table columns, toast layout, and the page progress bar
- Settings now previews appearance with light/dark/system theme tiles and named
  accent swatches
- `.heda` files open and save without a password by default, sealed with a
  per-device key; an optional file password still protects files shared
  between devices
- Prompt before leaving a project with unsaved changes

### Changed

- Migrated the frontend to SvelteKit 3, Svelte 5 runes, Vite 8, Tailwind CSS 4,
  bits-ui 2, and Formisch with Valibot schemas; domain types derive from validators
- Replaced RxDB with SignalDB collections and a Stronghold-backed session store
- Replaced crypto-js with WebCrypto: `.heda` files use a v2 envelope
  (PBKDF2-SHA256 plus AES-256-GCM) sealed with a per-file password
- Rebuilt the design system in oklch with Tailwind v4 canonical utilities;
  dialogs, sheets, popovers, menus, and tooltips animate with keyframes so they
  open cleanly in every webview
- Redesigned the home page, workspace shell, sidebar, schedule tables, and dialogs
- Pinned every Tauri plugin crate to its matching npm minor release
- The desktop app runs with a content security policy and asks for access to
  project folders on demand instead of the whole home directory
- Overwriting a project file keeps a backup next to it

### Removed

- Android support: the APK job, generated Android project, and mobile capability
  are gone; releases target desktop only

### Fixed

- Page progress bar no longer sticks on after SvelteKit 3 changed `navigating`
  to an always-truthy object
- Schedule tables refresh in place instead of remounting on every edit, ending
  the dropdown flicker and making undo visible
- Toast titles and descriptions wrap instead of clipping with an ellipsis
- Sidebar toolbar aligns with the workspace header and uses single buttons
- Tree collapse carets render bold, rotate, and no longer navigate on click
- Legacy v1 `.heda` files are upgraded to the new format when opened in the
  desktop app
- Edits made while a save is writing are no longer lost
- Project names containing a slash open correctly
- Updated Rust dependencies to patch security advisories in zip, tar, time,
  tokio, bytes, ring, rand, crossbeam-channel and serde_with

## [2.6.99] - 2025-07-12

### Added

- Android build support in Tauri GitHub Actions workflow

## [2.6.90] - 2025-01-25

### Fixed

- Resolved backup system for project files during override operations
- Corrected recent projects list loading mechanism
- Improved application performance
- Fixed progress bar visibility during update downloads

### Added

- Excel export functionality for voltage drop calculations
- Automatic column width adjustment for panelboard schedule and voltage drop exports
- Enhanced user feedback system with additional toast notifications

## [1.6.62] - 2025-01-18

### Fixed

- Resolved display issue for overridden conductor size values in load schedule and voltage drop calculations.

## [1.6.61] - 2025-01-18

### Fixed

- Fixed application startup issue after updates or when installed in Program Files directory.

## [1.6.60] - 2025-01-16

### Added

- Backup old project when overriding.
- Added ability to save project files in any user folder.

### Fixed

- Improved file loading mechanism

## [1.6.53] - 2025-01-13

### Added

- Recent projects list functionality
- Project loading from recent projects list
- Save location selector for project creation

### Fixed

- Save button activation based on project changes
- GitHub Actions build configuration

## [1.5.50] - 2025-01-13

### Fixed

- Resolved project title modification to prevent overriding existing projects
- Implemented new GitHub Actions build configuration

### Added

- Implemented persistent logging system for debugging purposes

## [1.5.41] - 2025-01-11

### Changed

- Updated GitHub Actions build configuration for improved stability.

## [1.5.40] - 2025-01-11

### Fixed

- Resolved critical system error preventing application usage.
- Implemented automatic file name handling for duplicate project names.
- Restored missing plugin update functionality.
- Optimized CI/CD pipeline configuration.

## [1.4.35] - 2025-01-10

### Added

- Drag and drop functionality for panel and load reordering
- Multi-selection copy functionality for panels and loads
- Multi-selection delete functionality for panels and loads
- Project file import and export capabilities

### Fixed

- Batch operations (copy/removal) now properly support group undo/redo functionality
- Settings theme switcher functionality

## [0.4.30] - 2025-01-05

### Added

- Implemented new Settings dialog for improved application configuration
- Added multi-panel and multi-load copy preferences in Settings
- Introduced panel and load bulk copy functionality
- Integrated voltage drop calculations
- Implemented Undo & Redo system

## [0.4.29] - 2025-01-04

### Added

- Implemented hierarchy action dropdown menu
- Added selective panelboard schedule export functionality
- Introduced load visibility toggle in Unit Hierarchy

### Fixed

- Corrected load data row alignment and spacing
- Optimized Unit Hierarchy tree rendering during load schedule modifications

## [0.3.28] - 2025-01-01

### Fixed

- Resolved markdown rendering issues in changelog history
- Fixed overlapping content in panelboard schedule Excel export for complex hierarchies

## [0.3.27] - 2024-12-30

### Added

- Implemented toast notifications for Excel export operations
- Added ErrorCell component with integrated error handling for conduit and conductor size validation
- Updated application logo

### Fixed

- Prevented load creation in circuit number cells within load schedule
- Enhanced column header presentation and base column rendering logic
- Implemented proper error handling for ampacity range validation in conduit sizing
- Added descriptive error messages in sidebar header for export operations
- Improved project and unit validation messaging in sidebar header
- Corrected voltage and apparent power value positions in sidebar header
- Optimized positioning of load total calculations in sidebar header
- Resolved alignment issues for load total calculations
- Enhanced phase handling for single-phase and three-phase loads in sidebar header

## [0.3.26] - 2024-12-30

### Testing

- Internal testing of application update mechanism.

## [0.3.25] - 2024-12-29

### Added

- Implemented panelboard schedule Excel export functionality.
- Integrated automatic application update system.
- Added changelog version history tracking.

### Fixed

- Resolved application update system issues.
- Enhanced changelog history loading mechanism.

## [0.2.24] - 2024-12-27

### Fixed

- In app update automation

## [0.2.23] - 2024-12-27

### Fixed

- In app update

## [0.2.22] - 2024-12-26

### Added

- Ampere Trip override functionality
- Ampere Trip indicators in load schedule
- Equipment Grounding Conductor (EGC) size calculation
- Conductor size calculation
- Conduit size calculation
- Improved node retrieval system
- Override capabilities for EGC size, conduit, ampere frames and conductor
- Insulation selection for EGC and conductor
- Default values for kAIC, pole, conduit type, and ampere frames
- Adjustment Factor toggle in application settings
- Automatic update system

## [0.1.21] - 2024-12-20

### Added

- Ampere Trip override functionality
- Ampere Trip indicators in load schedule

### Fixed

- Load schedule heirarchy when deep copying a panel.
- Improve query performance.
- Fix incorrect increment and decrement button placement.

## [0.1.19] - 2024-12-16

### Fixed

- Inconsistent window title version indicator.

## [0.1.18] - 2024-12-16

### Changed

- Updated dependencies to address security vulnerabilities

### Added

- Hierarchy quick actions
- Quick copy panel/load actions
- Additional system improvements

### Fixed

- Supply source selection when adding panel/load using quick actions
- Prevented accidental project deletion when copying top-level unit

## [0.1.17] - 2024-12-13

## [0.1.17] - 2024-12-13

### Changed

- Updated dependencies to address security vulnerabilities.

## [0.1.16] - 2024-12-13

### Added

- Added ability to change load supply source to any load or highest unit.
- Enhanced system functionality with additional features.

### Fixed

- Corrected horsepower rating dropdown options display.

## [0.1.15] - 2024-12-12

### Added

- Added validation alert when attempting to use an existing circuit number.

### Fixed

- Resolved load context menu state persistence in hierarchy view.

## [0.1.14] - 2024-12-12

### Fixed

- Standardized icon library implementation using lucide-svelte.
- Corrected default value initialization for transformer distribution units.

### Added

- Panel total load calculation for panel suppliers
- Dynamic load type input options
- Default terminal temperature set to "Standard Temperature"

## [0.1.12] - 2024-12-10

### Fixed

- Context menu dialog now closes properly after action completion or cancellation
- Removed maximum varies limit restriction

### Added

- Distinctive hierarchy icons and labels
- Automatic field population for varies, continuous, and load type when modifying DEFAULT load descriptions

## [0.1.11] - 2024-12-9

### Added

- Implemented circuit number validation system
- Added confirmation dialogs for project, panel, and load deletion

## [0.1.10] - 2024-12-9

### Fixed

- Resolved sidebar resizing issues

## [0.1.9] - 2024-12-8

### Fixed

- Improved UI synchronization after data mutations

## [0.1.8] - 2024-12-7

### Added

- Enhanced unit form with main description field for new panels
- Integrated application icon
- Additional system improvements

## [0.1.7] - 2024-12-7

### Fixed

- Resolved deployment configuration issues

## [0.1.6] - 2024-12-7

### Fixed

- Resolved data synchronization conflicts

### Added

- Implemented hierarchy deletion functionality

## [0.1.5] - 2024-12-7

### Fixed

- Enhanced panel and load management by integrating RxDB update plugin

## [0.1.4] - 2024-12-7

### Fixed

- Resolved issues with panel and load creation functionality
- Enhanced data persistence reliability

## [0.1.3] - 2024-12-6

### Fixed

- Added comprehensive changelog documentation
- Updated Cargo.lock dependencies for improved stability

## [0.1.2] - 2024-12-6

### Fixed

- Added initial changelog documentation
- Resolved RxDB hierarchy implementation issues

## [0.0.13] - 2024-12-3

### Fixed

- Updated changelog documentation
- Implemented cross-platform deployment testing

## [0.0.11] - 2024-11-12

### Fixed

- Enhanced CI/CD pipeline configuration

## [0.0.10] - 2024-11-12

### Fixed

- Enhanced CI/CD pipeline configuration

## [0.0.9] - 2024-11-12

### Fixed

- Improved CI/CD pipeline stability and reliability

## [Unreleased]

## [0.0.8] - 2024-11-12

### Added

- Initial changelog implementation
