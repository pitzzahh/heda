<div align="center">

<img src="static/favicon.png" alt="HEDA" width="96" />

# HEDA

**Hierarchical Electrical Design Analyzer**

Load schedules and voltage drop for building electrical systems, sized to the
Philippine Electrical Code 2017.

[![Latest release](https://img.shields.io/github/v/release/pitzzahh/heda?style=flat-square&label=release)](https://github.com/pitzzahh/heda/releases/latest)
[![Publish](https://img.shields.io/github/actions/workflow/status/pitzzahh/heda/publish.yml?style=flat-square&label=build)](https://github.com/pitzzahh/heda/actions/workflows/publish.yml)
![Platforms](https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-informational?style=flat-square)

[Download](https://github.com/pitzzahh/heda/releases/latest) · [Changelog](changelog.md) · [Sample projects](samples/README.md) · [Roadmap](https://github.com/pitzzahh/heda/milestones)

</div>

## Overview

HEDA models a building's distribution the way it is drawn on a riser diagram:
a main panel feeding sub-panels, each panel feeding its own circuits. Edit a
load anywhere in the tree and every panel above it updates.

It is a desktop app for Windows, macOS and Linux. Projects are single `.heda`
files that you keep wherever you keep your other project documents.

## What it does

**Load schedules.** One schedule per panel, built from the loads and
sub-panels under it. For each circuit HEDA works out the apparent power,
current, circuit breaker, conductor, equipment grounding conductor and
conduit, applying demand factors and the ambient and terminal temperature
ratings you set.

**Voltage drop.** For every feeder and branch circuit: conductor length,
impedance, voltage drop, percent drop and the voltage at the receiving end.

**Overrides.** When a conductor or breaker has to differ from the computed
size, override it on the circuit. The change is marked so it stands out on
review, and it can be removed to return to the computed value.

**Excel export.** Panel schedules and voltage drop tables export to `.xlsx`
with the column widths already set.

**Large projects.** The tree, undo history and tables stay responsive on
projects with more than a thousand panels.

## Roadmap

Next up: 3-phase delta load schedules, then permit-ready output (a riser
diagram generated from the tree, a PDF sheet set and phase balancing), then
motor circuits, service and transformer sizing and a bill of materials.
Progress is tracked on the
[milestones](https://github.com/pitzzahh/heda/milestones) and the
[project board](https://github.com/users/pitzzahh/projects/10).

## Download

Get the latest version from the
[releases page](https://github.com/pitzzahh/heda/releases/latest).

| Platform              | File                   |
| --------------------- | ---------------------- |
| Windows               | `.msi` or `-setup.exe` |
| macOS (Apple silicon) | `aarch64.dmg`          |
| macOS (Intel)         | `x64.dmg`              |
| Debian, Ubuntu        | `.deb`                 |
| Fedora, openSUSE      | `.rpm`                 |
| Other Linux           | `linux-x86_64.tar.gz`  |

The installers are not code signed yet, so expect one warning the first time:

- **Windows:** SmartScreen shows "Windows protected your PC". Choose
  _More info_, then _Run anyway_.
- **macOS:** right-click the app in Applications, choose _Open_, then confirm.

### Linux tarball

The tarball holds the binary, an icon, a desktop entry and the `.heda` file
type. To install it for your user:

```sh
mkdir -p /tmp/heda
tar -xzf Hierarchical_Electrical_Design_Analyzer-*-linux-x86_64.tar.gz -C /tmp/heda
install -Dm755 /tmp/heda/heda ~/.local/bin/heda
install -Dm644 /tmp/heda/heda.png ~/.local/share/icons/hicolor/512x512/apps/heda.png
install -Dm644 /tmp/heda/heda.desktop ~/.local/share/applications/heda.desktop
install -Dm644 /tmp/heda/heda.xml ~/.local/share/mime/packages/heda.xml
update-mime-database ~/.local/share/mime
```

Make sure `~/.local/bin` is on your `PATH`.

### Updates

HEDA checks for new versions and installs them from **Settings → Updates**.
On Linux this works for the tarball, `.deb` and `.rpm` installs.

## Project files

A `.heda` file is encrypted. By default it is sealed with a key stored on your
computer, so it opens without a password on that machine and is unreadable
anywhere else.

To share a project with someone on another computer, turn on password
protection when you save. The file then opens on any machine with that
password. The password itself is never saved in the file.

Files from HEDA 1.x are upgraded the first time you open them, and the
original is kept as a backup next to the new file.

## Sample projects

The [`samples`](samples/README.md) folder has six projects, from a single
apartment unit to a business park with 1,270 panels. Open them with the
password `heda-sample-2026`.

## Development

You need [Bun](https://bun.sh) and, for the desktop app, the
[Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your
platform.

```sh
bun install
bunx tauri dev       # desktop app
bun run dev          # browser only
bun run test         # unit and component tests
bun run lint         # formatting and eslint
bun run check        # type check
```

Built with Tauri 2, SvelteKit and Svelte 5. Conventions for contributors
live in [`AGENTS.md`](AGENTS.md).

### Releasing

PRs merge into `preview`, the default branch. Bump the version in
`package.json` and `src-tauri/tauri.conf.json`, add a section to
`changelog.md`, and merge. No tag push: CI sees the new version, builds every
platform and attaches the installers to an unpublished release (versions that
already have a tag or release are skipped).

- **Preview:** on `preview`, use a numeric pre-release version such as
  `2.9.0-1` (the Windows installer rejects `2.9.0-beta.1`). It is published as
  a pre-release on its own once every installer is up; the in-app updater never
  offers pre-releases. Linux previews have no `.rpm` (RPM rejects the hyphen);
  the tarball covers those distros.
- **Stable:** open a PR from `preview` into `main` that drops the suffix
  (`2.9.0`). Merging it builds the stable release.

A version in the wrong form for its branch is skipped. Stable releases stay
drafts: publish them on GitHub to create the tag and make them available. To retry a failed release,
delete its draft and run the `publish` workflow manually.

## Authors

- Peter John Arao ([@pitzzahh](https://github.com/pitzzahh))
- Alessandro Benig ([@isipisii](https://github.com/isipisii))
