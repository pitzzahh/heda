# Sample projects

Realistic project files for trying the app out. They are not part of any
build: the web build compiles `src/`, and the desktop bundle takes only the
icons.

Open any of them with the password **`heda-sample-2026`**. They are sealed
with the file password, so they open on any machine.

| File                            | Project                        | Size                         |
| ------------------------------- | ------------------------------ | ---------------------------- |
| `sunrise-apartment-7a.heda`     | Sunrise Apartments, Unit 7A    | 1 panel, 3 circuits          |
| `maple-street-residence.heda`   | Maple Street Residence         | 2 panels, 12 circuits        |
| `meridian-office-building.heda` | Meridian Office Building       | 4 panels, 11 circuits        |
| `northpoint-cold-storage.heda`  | Northpoint Cold Storage        | 3 panels, 10 circuits        |
| `harborview-residences.heda`    | Harborview Residences, Tower A | 282 panels, 1,269 circuits   |
| `meridian-business-park.heda`   | Meridian Business Park         | 1,270 panels, 6,259 circuits |

The last two are the large ones: a residential tower and an office campus,
drawn the way an electrical engineer would draw them, with incoming
sections, risers, floor boards and a board per dwelling unit or tenant
suite.

## The device copies

Running `bun scripts/make-sample-files.ts` writes a `-device` copy of each
sample next to it, sealed with the key in the app's data folder. Those open
without a password, but only on the machine that made them, so they are not
in the repository. The script also rewrites the files in this folder, which
gives every file a new salt and therefore new bytes.

Every board in the samples stays inside what the app can size: its
conductor table stops at 500 mm², which covers a single set up to about
900 A, and its trip ratings stop at 6,000 A.
