# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://"0.0.9"keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.6.61] - 2025-01-18

### Fix

- App won't start after update or if app is installed in Program files.

## [1.6.60] - 2025-01-16

### Add

- Backup old project when overriding.
- Added ability to save project files in any user folder.

### Fix

- Loading of file

## [1.6.53] - 2025-01-13

### Add

- Recent projects list.
- Load project from recent projects list.
- Save location selector on project creation.


### Fix

- Save button only enables when there are changes in the project. 
- Fix github actions build.

## [1.5.50] - 2025-01-13

### Test

- New github actions build.

### Fix

- Fix issue where changing project title overrides the existing projects.

### Add

- Add persisted logs for debugging purposes.

## [1.5.41] - 2025-01-11

### Test

- New github actions build.

## [1.5.40] - 2025-01-11

### Fix

- Fix issue where the app cannot be used because of system error.
- Project file names are now appended if the file already exists.
- Fix missing plugin updater.
- Fix ci/cd.

## [1.4.35] - 2025-01-10

### Add

- Drag and drop changing panels/loads.
- Multi copy of panels/loads.
- Multi delete of panels/loads.
- Save to file and load from file.

### Fix

- Fix issue of undoing a batch copy/remoal of panels/loads.(undoing a batch copy/removal of panels/loads will also undo as a batch).
- Fix settings theme switcher.

## [0.4.30] - 2025-01-05

### Add

- New Settings dialog for clean and easy access to app settings.
- Multi copy preference for copying multiple panels or loads in settings.
- Multi copy of panels or loads.
- Voltage drop.
- Undo & Redo functionality.

## [0.4.29] - 2025-01-04

### Add

- Dropdown menu for selecting heirarchy actions
- Ability to export specific panelboard schedule.
- Add preference to show or hide loads in Unit Heirarchy.

### Fix

- Fix extra shifted load data row, add one more row spacing.
- Unit Heirarchy tree re-rendering behavior when modifying load schedule, now updates only affected nodes.

## [0.3.28] - 2025-01-01

### Fix

- Changelog history markdown rendering.
- Overlapping panelboard schedule excel export when heirarchy is too complex.

## [0.3.27] - 2024-12-30

### Add

- Toast notification when performing export to excel.
- Add ErrorCell component and integrate error handling for conduit and conductor sizes in table columns.
- Updated app logo.

### Fix

- Remove adding load in crkt no. cell in load schedule.
- Update column headers and improve rendering logic in base columns for better clarity and functionality.
- Adjust ampacity range condition and add error handling for conduit size in computations.
- Enhance error handling in sidebar header by adding a description field for improved clarity on export failures.
- Improve export error handling in sidebar header by adding descriptive messages for missing project and highest unit.
- Swap voltage and apparent power values in sidebar header for correct data representation.
- Adjust calculation placement for l(t) in sidebar header to correct row positioning.
- Fix alignment and value assignment for l(t) calculation in sidebar header.
- Update load schedule handling for 1P and 3P phases in sidebar header.

## [0.3.26] - 2024-12-30

### Test

- Test release for in app update.

## [0.3.25] - 2024-12-29

### Add

- Exporting of panelboard schedule to excel file.
- In app updates.
- Changelog history.

### Fix

- In app updates
- Changelog history loader.


## [0.2.24] - 2024-12-27

### Fix

- In app update automation

## [0.2.23] - 2024-12-27

### Fix

- In app update

## [0.2.22] - 2024-12-26

### Add

- Add Ampere Trip overriding feature.
- Add Ampere Trip indicator on load schedule.
- Computation of EGC Size
- Computation of Conductor Size
- Computation of Conduit Size
- Refactoring Node Retrieval by ID
- Overriding Data in EGC Size, Conduit, Ampere Frames and Conductor
- Changing Insulations for EGC and Conductor
- Add default values of kAIC, pole, conduit type, and ampere frames
- Implement Adjustment Factor toggle in app settings
- In app update

## [0.1.21] - 2024-12-20

### Add

- Add Ampere Trip overriding feature.
- Add Ampere Trip indicator on load schedule.

### Fix

- Load schedule heirarchy when deep copying a panel.
- Improve query performance.
- Fix incorrect increment and decrement button placement.

## [0.1.19] - 2024-12-16

### Fix

- Inconsistent window title version indicator.

## [0.1.18] - 2024-12-16

## Update

- Update dependencies to fix security vulnerabilities.

### Add

- Heirarchy quick actions
- Quick copy panel/load actions
- Etc..

### Fix

- Supply from when adding panel/load using the quick actions
- Quick copy of highest unit removes the whole project (fixed and should not be possible)

## [0.1.17] - 2024-12-13

## Update

- Update dependencies to fix security vulnerabilities.

## [0.1.16] - 2024-12-13

### Add

- Changing of load supply from to any load or highest unit.
- More bugs

### Fix

- Horsepower rating dropdown options.

## [0.1.15] - 2024-12-12

### Add

- Alert in form when circuit number is already taken by a panel/load.

### Fix

- Fix remove load context menu state on heirarchy.

## [0.1.14] - 2024-12-12

### Fix

- Inconsistent icons library(sticking with lucide-svelte)
- Transformer distribution unit not being set to default value when first load.

### Add

- Panel total load to panel supplier.
- Load type varying input/options.
- Terminal temperature default value to "Standard temperature"

## [0.1.12] - 2024-12-10

### Fix

- Fixed issue where the context menu dialog would not close after completing or canceling an action
- Remove max varies limit

### Add

- Distinguishable heirarchy icon/label
- Automatically repopulate varies/continuous/load type fields when the load description is changed on DEFAULT loads

## [0.1.11] - 2024-12-9

### Add

- Circuit number validation
- Confirmation dialog upon project/panel/load removal

## [0.1.10] - 2024-12-9

### Fix

- Fix sidebar issue when resizing

## [0.1.9] - 2024-12-8

### Fix

- Ui update after mutations.

## [0.1.8] - 2024-12-7

### Add

- Main description (highest unit form) when adding new panel.
- Add app icon
- Etc.

## [0.1.7] - 2024-12-7

### Fix

- Fix deployment issue

## [0.1.6] - 2024-12-7

### Fix

- Fix data sync issue

### Add

- Add delete heirarchy function

## [0.1.5] - 2024-12-7

### Fix

- Fix adding loads and panels by adding rxdb update plugin

## [0.1.4] - 2024-12-7

### Fix

- Fix adding loads and panels

## [0.1.3] - 2024-12-6

### Fix

- Add changelog entry.
- Fix cargo lock file

## [0.1.2] - 2024-12-6

### Fix

- Add changelog entry.
- Fix rxdb heirarchy

## [0.0.13] - 2024-12-3

### Fix

- Fix changelog entry.
- Test cross-platform deployment.

## [0.0.11] - 2024-11-12

### Fix

- Fix ci/cd pipeline again this time.

## [0.0.10] - 2024-11-12

#### Fix

- Fix ci/cd pipeline again.

## [0.0.9] - 2024-11-12

#### Fix

- Fix ci/cd pipeline

## [Unreleased]

## [0.0.8] - 2024-11-12

### Added

- The project has now a changelog
