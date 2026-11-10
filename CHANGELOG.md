# Changelog

Every release of Bonsai, newest first. Versions follow `major.minor.patch`: minor for new features, patch for fixes and tweaks. Each version also has a git tag (`v0.1.0`) and a GitHub release.

## 0.5.0 — 2026-11-10

Ideas placed by meaning.

- **Meaning view (M):** every idea arranged in 3D by what it means, for one zone or for everything. Colour marks the tree or the zone.
- **Suggested links:** pairs of ideas that are close in meaning but not linked yet. Link or dismiss each one.
- **Search by meaning:** search also finds ideas that share no words with what you typed.
- Runs on your device with a small open model (all-MiniLM-L6-v2). One 45 MB download the first time; nothing you write leaves the device.

## 0.4.0 — 2026-11-10

Two windows: Knowledge and Garden.

- **Knowledge** is only your ideas: no roots, no fading, no review prompts.
- **Garden** shows each tree as a potted plant. Ideas due for review turn amber, then grey, and the plant sags; passed reviews grow its roots.
- **Watering** a plant reviews its thirsty ideas: recall, Show, then Again, Hard, Good or Easy. **All good** passes the whole plant in one tap, with undo.
- Switch windows with the button in the top bar or Shift+Tab. The Garden button shows how many ideas are thirsty.

## 0.3.1 — 2026-11-10

A cleaner look.

- Ideas are smooth spheres, branches and roots are thin lines, and the floor is a faint grid.
- With no colours set, each main branch of a tree gets its own colour. Colours you pick still win and pass down.
- Labels are plain text. Zones are outlined with a thin ring.
- Neutral light and dark themes. Overdue ideas fade; the glow on new ideas is gone.

## 0.3.0 — 2026-11-10

Bonsai in 3D.

- **3D forest:** zones are groves, every tree is drawn at its real shape. Click a tree to fly in.
- **3D trees:** the trunk is the core idea and ideas branch off it. Drag to orbit, scroll or pinch to zoom, right-drag or two fingers to pan, W A S D Q E to fly. Branches re-settle as the tree grows.
- **Keyboard:** Tab adds a branch, Enter a sibling, arrows move between ideas, plus keys for rename, delete, notes, link, graft, colour, search and more. Press ? for the list.
- **Notes:** a short note on hover (first tap on a phone) and full Markdown notes in a side panel (bottom sheet on a phone).
- **Colours:** per idea, inherited by its branches. Zones and trees can be coloured too.
- **Cross-links** between any two ideas, in any trees, with an optional label.
- **Grafting:** move a branch, or a whole tree, onto any idea. Merge a zone into one tree, and split grafted trees back out.
- **Review:** spaced repetition with Again, Hard, Good, Easy. Passed reviews grow the tree's roots; new ideas glow and overdue ones fade.
- **Patches and stitching:** short reflections attached to the ideas they mention, stitched into the trunk's notes.
- **Timeline:** replay how a tree or the forest grew.
- **Search** across everything, and an **inbox** for quick thoughts to file later.
- Zones and trees: rename, recolour, move, archive, delete. Deleting an idea can be undone.
- Removed the outline view and the explanatory text.

## 0.2.0 — 2026-11-10

Your forest is saved on your device, and you can start planting.

- Zones (subjects) hold trees (topics). Each tree starts with its trunk: the core idea.
- Branch ideas off any idea, rename them, and delete them with a second tap (deleting an idea removes everything branching from it).
- A temporary outline view of each tree until the 3D tree arrives.
- Everything is stored on this device and kept across restarts. Bonsai asks the browser not to clear it.
- **Export backup** and **Restore backup** at the bottom of the app.
- Under the hood: cross-links, moving branches between trees (for grafting later) and a growth log for the timeline are in place.

## 0.1.0 — 2026-11-10

First release: the app shell.

- Installable web app for laptop and phone, with the Bonsai icon.
- Opens without internet once you've visited.
- **Update to x.y.z** banner when a new version is published, plus **Check for updates**.
- **What's new** link to this version history.
- Free to use under the MIT licence.
