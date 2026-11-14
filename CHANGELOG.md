# Changelog

Every release of Bonsai, newest first. Versions follow `major.minor.patch`: minor for new features, patch for fixes and tweaks. Each version also has a git tag (`v0.1.0`) and a GitHub release.

## 0.9.0 — 2026-11-14

The tech tree grows from a start.

- **Radial map:** the tech tree now grows outward from a start in the middle. Each topic is a cell, and topics of one island share a slice of the circle, softly lit in its colour. The coloured lanes are gone.
- **Builds on (B):** pick a topic and choose which topics it builds on (Mechanics on Calculus, say). A topic sits one ring further out than everything it builds on, with a line from each. It's your call and can be changed any time; a topic can't build on one that builds on it. Inside a topic, the order of ideas is the graph's own: an idea comes after the one it branches from.
- **Cells:** tap a topic and its cell grows and fills with a small map of its ideas, trunks in the middle and branches outward; the rest of the map moves out to make room. Tap again to close it. 1 closes every cell, 2 shows each topic's key ideas, 3 shows everything.
- Links between ideas run from cell to cell, gathered into one thicker line when a cell is closed. Picking a topic brings forward everything it links to and builds on.
- The web (L) is unchanged.

## 0.8.0 — 2026-11-14

The tech tree.

- **Tech tree (K):** a flat map of everything you know. Each island is a lane, grouped under its hub, with its topics down the left.
- **Three depths:** 1 shows only topics, 2 opens each topic to its key ideas (every graph's trunk and main branches), 3 shows every idea. Any branch opens or folds on its own: click it, or use Space or the arrows (→ opens, ← folds).
- **Links between whatever is open:** a link to an idea inside a folded branch is drawn to that branch, so even the topics-only view shows how topics connect, with more links making a thicker line. Links between topics on one island are dashed in the island's colour; links between subjects fade from one island's colour to the other's.
- **Web (L):** every idea and every connection at once, gathered by island. Drag ideas to reshape it; the layout is kept. Tidy (R) lays it out afresh.
- Enter opens the picked idea in its knowledge graph, and Back returns to the same spot. A topic opens in the garden.
- Opened from a topic in the garden, or from an idea in a graph, the tech tree starts there.

## 0.7.3 — 2026-11-14

- Fixed: on small islands a topic's pond could sit under the corner of the centrepiece. Each centrepiece is now measured from its own blocks, in every direction, and ponds, the mountain's lake and its stream are placed around that: pushed outward, made smaller if the gap is tight, or left out if there is no room. Where a mountain has no room for its lake, it has no waterfall.

## 0.7.2 — 2026-11-14

- Fixed: on an island with a mountain and an academy, amphitheatre or statue, the waterfall's water ran on across the ground and into the centrepiece. It now lands in a small lake at the mountain's foot.

## 0.7.1 — 2026-11-14

- **Mountain on any island:** the island menu has a Mountain switch, so an island can have a mountain whatever its centrepiece. It rises on the first topic's plot, with its waterfall. The stone arches always stand under one.
- Fixed: changing an island's centrepiece could leave the old one's ground (a statue's pool, say) behind.

## 0.7.0 — 2026-11-14

Hubs, and a garden laid out from a map.

- **Hubs:** islands now gather into hubs, all in one sky. Each hub has an island in the middle and the rest in a ring around it, with bridges inside a hub and between neighbouring hubs.
- **Import map:** Menu → Import map takes a layout of hubs, islands and topics as pasted text or a file, and builds the garden from it. Topics you already have are matched by name. Importing again follows what changed on the map; a topic you moved by hand stays where you put it until it moves on the map.
- **Mist:** a topic with no ideas yet lies under mist, and a hub with no islands is only a bank of it. Mist appears once a map has been imported.
- **Keys:** with more than one hub, 1–9 goes to a hub, then an island, then a topic. Arrows step along the level you are on. 0 goes back out to everything.
- **Split (S):** a topic past 200% can move onto an island of its own. Its graphs are read as one graph under the trunk you pick, and its largest main branches become the topics there, each still linked to the trunk. Can be undone.
- Once a map is imported, islands are added, named and given their centrepiece on the map, so those controls leave the garden. Without a map they work as before.
- A new topic joins the island or hub you are looking at.

## 0.6.0 — 2026-11-12

The garden is the home screen.

- **Islands:** your topics are biomes on floating islands made of small blocks, with a centrepiece on each island, bridges between islands, animals, and day or night. A topic's biome fills in as you add ideas and dries out from its edges when ideas wait to be watered.
- **Garden panel:** how many ideas, graphs and topics you have, what needs watering, how your knowledge is spread, and buttons for a new knowledge graph, a new note and the meaning map.
- **Number keys:** 1–9 goes to an island, then to a topic, then opens one of its graphs. 0 or Esc steps back out. W waters, D switches day and night. Each tag shows its key.
- **New knowledge graph (N)** asks only for a topic and a name.
- **Arrange it:** rename islands, choose their centrepiece, add islands, move a topic to another island, and pick each topic's biome and landmark.
- A topic that passes a full plot (about 150 ideas) gets its own landmark and the island grows outward.
- The forest of trees is still there under Knowledge (Shift+Tab). Watering opens the potted plants as before.
- **Licence:** Bonsai is now under the GNU AGPL, version 3 or later. Versions up to 0.5.0 stay MIT.

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
