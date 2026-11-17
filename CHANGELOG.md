# Changelog

Every release of Bonsai, newest first. Versions follow `major.minor.patch`: minor for new features, patch for fixes and tweaks. Each version also has a git tag (`v0.1.0`) and a GitHub release.

## 0.19.0 — 2026-11-17

- **Vocab.** A Vocab row sits at the foot of the notes sidebar, above + Page and + Folder (V). It opens the vocab page: every term with its meaning and the pages it appears in, searchable (F), sorted A–Z, newest, or by the page you first met it in. + Term (N) adds one; click a term's name to edit it (meaning, other names, where from); × removes it, with undo.
- Terms are underlined wherever they appear in your notes, as you type. Hover one and its panel opens; hover a term inside that panel and the next one opens beside it, showing where you came from. Pin a panel to keep it (dragging pins it too), Esc or right-click closes one, Shift+right-click closes them all. Your notes' text isn't changed by any of this.
- Beta: the demo has six terms from the momentum lecture and the GROW workshop.

## 0.18.2 — 2026-11-17

- Every back arrow shows its key: Esc. Esc still closes what's open first (a panel, a pick, a menu) and then goes back; **Shift+Esc** goes straight back from wherever you are. On a phone the key is hidden.

## 0.18.1 — 2026-11-17

- Graph names in the knowledge view's rings show at any distance; they only give way where they would touch another name. Topic names win over graph names.
- Tech tree (K) is in the knowledge view's bar, and in a graph's ⋯ menu. It opens on what's in view: the topic or island shown, or the topic of the graph picked or open.

## 0.18.0 — 2026-11-17

Exams fill the garden with what you already know.

- **Import exam** (menu): takes what the Bonsai Exams page exports, pasted or as a file. It goes into the topic of that name, or a new one.
- Ideas an exam showed arrive as real ideas in their knowledge graphs, each with a short note saying what it is. Their first reviews are spread over the days ahead, later for ideas shown at a deeper level, so a whole paper doesn't need water on the same morning.
- Ideas not shown yet arrive **greyed**: pale in the knowledge view, a dashed ring in the tech tree, and "Not shown yet" in the idea's panel. They don't count toward a topic's growth and are never due.
- **A re-sit** imported again wakes the greyed ideas it showed and makes nothing twice. Connections shown at the Connect level come in as links. Undo takes an import back.
- An idea from an exam shows the level it was shown at (Recall, Explain, Apply) and its tier in its panel.

## 0.17.0 — 2026-11-17

- **Joined.** The knowledge view has a second way of looking: J (or Joined in the bar) reads everything in view as one structure in 3D, joined the way the tech tree joins it. An island leads to its topics and they to the ideas their graphs start from; an island that grows from another hangs from the idea it grows from, on the next ring out and a step higher, and so on down. Open it on Foundations and you get Foundations with Maths, General science and then Physics growing out of it. Open it on a topic for that topic's graphs as one, with any island that grows from them. With nothing picked it is the whole garden from the start.
- It is only a view: your graphs stay separate and nothing is saved. Click an idea to open it in its own graph; click a topic's or island's name to see just that, still joined. J again goes back to the rings; the choice is remembered.
- Links inside an island are straight bonds as in a graph; links between islands are faint arcs.
- The knowledge view now has a bar: Separate / Joined (J), Fit (0) and, when narrowed, Show all (A).

## 0.16.0 — 2026-11-16

- **Move ideas.** In a graph, V (or Move in the bar) turns on move mode: drag an idea and it stays where you drop it, bringing along what hangs from it, while the rest settles around it so bonds still keep clear. The arrow keys nudge the picked idea across the screen; turn the view first to move it in depth. U puts the picked idea back where the layout had it, Shift+U puts them all back. Nothing else can be changed while move mode is on; V or Esc leaves it. Places are kept with the graph, in backups too, and show in the rings as well.

## 0.15.2 — 2026-11-16

- Names no longer run into each other: where two would touch, the lesser one gives way (a graph's name to its topic's, a link's label to an idea's, a far idea to a near one). The picked one always shows.
- At night the glow under topics and graphs is much fainter.

## 0.15.1 — 2026-11-16

- A graph's first idea no longer has a line down to the ground: the structure floats over its disc.

## 0.15.0 — 2026-11-16

The knowledge view, redrawn in the tech tree's manner.

- **Graphs are ball-and-stick structures.** Each stands on a disc, with a stem up to its first idea and the rest spreading out from there. No more leaning like a tree, no pots, no roots.
- **Links inside a graph are straight bonds.** The structure settles itself so that no bond, and no stick, passes through an idea it doesn't join. Links from one graph to another are still thin arcs.
- **Rings.** A topic's graphs sit in a ring round its name. An island shows its topics in a ring round its own name, each with its graphs round it; a hub does the same with its islands. Click an island's or hub's name to see only that; a topic's menu has Only this topic.
- **The tech tree's colours.** A graph takes its topic's colour, turned a little for each idea that hangs off the start; a soft glow lies under each topic and thin spokes run from a name to what sits round it. Colours you set yourself are kept. The knowledge view goes dark when the garden is at night, as the tech tree does.
- **Watering** is the same picture: an idea turns ochre when it needs water and grey once it has dried out, a graph with anything waiting has an ochre rim, each topic's name carries its count, and a graph's disc gains a ring as its reviews are passed. Picking a graph brings its whole topic into view. Enter waters it, A is All good, G opens it.
- **Numbered ideas.** Every idea in a graph has a number, counted outward from the start. Type the number to go there: each digit lands at once, and a second digit typed straight after makes a longer number. Go to in the bar does the same by tapping.
- **Every button in the bar shows its key:** Add (Tab), Beside (Enter), Rename (R), Notes (Space), Link (L), Graft (G), Go to (1–9), Fit (0). The ⋯ menu has the rest with theirs: Write notes (N), Colour (C), Fly to (F), Make its own graph (X), Delete (Del).
- **The idea's panel** shows the idea's number, the ideas it hangs from as steps back, and a card for each idea under it; click a card to go there. Hovering an idea still only shows the small card on the graph.
- **Words:** zones are topics and trees are knowledge graphs everywhere now, and trunks and branches are gone. A new graph asks only for its topic and its name.
- Beta: the demo has links inside single graphs (Newton's laws, Numbers) to see the bonds.

## 0.14.0 — 2026-11-16

- Eight more landmarks for theory topics, 44 in all: spacetime (Relativity), prism (Optics), dice (Probability, Statistics), orrery (Astrophysics, Cosmology), puzzle cube (Logic), computer (Computer science, Algorithms), light bulb (Design, Ideas) and brain (Psychology, Neuroscience).
- Design no longer falls back to the monument next to Drawing's easel: it gets the light bulb.

## 0.13.0 — 2026-11-16

No two topics share a landmark.

- 14 new landmarks, 36 in all: blackboard, circuit, compass, crane, curve, drum, harp, magnet, marquee, nautilus, Newton's cradle, signpost, vectors and wind turbine.
- Topics with no landmark picked get the best one nobody else has yet: Algebra a blackboard, Calculus a curve, Linear algebra vectors, Mechanics Newton's cradle, Energy a wind turbine, Electromagnetism a magnet, Electronics a circuit, Engineering a crane, Harmony a harp, Rhythm a drum, Coaching a signpost, Running events a marquee. One you've picked yourself is kept, and the guesses step around it.

## 0.12.0 — 2026-11-16

The landmark library comes into the garden.

- A topic that fills its plot now raises one of 22 voxel landmarks: abacus, atom, books, camera, clock tower, cooking pot, DNA helix, easel, flask, globe, lectern, lighthouse, observatory, quill, radio dish, ruined temple, scales, seated scholar, steam engine, synth, trophy and yarn. Pick one under Landmark in the topic's panel; the older shapes are still there below them.
- A topic with no landmark picked gets one from its name: Physics an atom, Leadership a lectern, Music a synth, Maths an abacus. Anything unrecognised keeps the monument.
- Landmarks face out from the middle of the island, stand in a wider clearing so trees don't hide them, and shrink to fit on small islands.
- Weathered stone at 100%; from 130% the wood, glass and the topic's own colour come through, and the trims and metal turn bronze at 160% and gold at 200%.
- The bell tower is now a clock tower after Big Ben: a slim Gothic tower with gold-framed dials on every side and a tall slate spire. The gear tower is now a steam engine: a riveted copper boiler with a big brass cog on the front, pipes and valve wheels, a gauge, a brass dome and a smokestack letting off steam.
- Beta: a Workshop island in the demo whose topics count as full, so a landmark shows at every tier.

## 0.11.0 — 2026-11-16

Notes, a third window, and a cleaner look everywhere.

- Garden, Knowledge and Notes are three windows, switched from the top bar or round with Shift+Tab.
- Notes work like Notion and stand on their own: folders and pages, pages inside pages, nothing tied to a topic or a graph. Search by name or #tag (/). N new page, F new folder; drag a page onto a folder to move it, or use Move to.
- Every page has the same properties at the top, as in Notion: Tags, Date (opens a calendar), Status, Source and Created, each Empty until set. Add a property adds your own text fields. Tags made on one page are offered on the others.
- Status follows a note from Raw to Tidied to Grown; growing a page into a knowledge graph marks it Grown by itself. The sidebar can show just Raw, Tidied or Grown notes, newest first.
- Type @ for a date tag (today, tomorrow, next Monday or any day); click it to change the day.
- Writing as in Notion: / for blocks, Markdown shortcuts, Tab to indent, Ctrl+B, I, U, E, K, a toolbar over selected text, drag blocks by ⋮⋮ or Ctrl+Shift+↑ ↓, and block colours.
- In a knowledge graph, O opens the notes sidebar beside it (search, filter, folders and pages); pick a page and it opens next to the graph. With a page open, the idea panel covers the rest of the screen and shows the graph as a web you can click ideas in.
- [ and ] close or open the menu on the left and on the right; the close buttons show the keys.
- G in the garden (or Knowledge graphs in its panel) opens just the knowledge graphs of the hub, island or topic you've picked.
- Grow into a knowledge graph, from a page's menu: pick the topic, copy the page for Claude, paste its reply back and see what it adds. Undo, or take the last grow back later.
- One look: white, black and an earth green, with warm greys, in light and dark. Corners are only slightly rounded; no pills.
- The garden panel puts the name first: click it to rename. Biome, landmark, centrepiece and mountain sit at the foot of the panel instead of in menus. Tech tree from a topic or an island opens at that island's tier.
- The bars are docked instead of floating: a full-width top bar, side panels against the edge, a bottom bar for actions. The garden's totals and Water are in the top bar, and its panel starts with day/night and detail, with Knowledge spread folded away.

## 0.10.0 — 2026-11-15

- Tech tree, rebuilt as a web that recentres: one island in the middle as a hexagon with its key ideas around it; the islands that grow out of it sit on its ring. Step in on one, step back with Esc or the hexagon, and the way back stays lit. T shows this tier only, A shows everything, H goes back to the start, 1–9 pick, Enter goes in, Space opens a key idea.
- B sets which island an island grows from, and the idea on it that leads there.
- The middle and the ring show pictures of their islands.
- Two looks, Y to switch: organic (tapered arms) and simple (straight lines).
- Web view: J holds everything still while you drag, so only what you drag moves.
- Only the little ideas under the one you pick are labelled.
- Stepping back no longer zooms out.

## 0.9.2 — 2026-11-15

A beta to test with.

- **Bonsai Beta** at /Bonsai/beta/: a second copy of the app built from the `beta` branch, for trying new work before it reaches the real app. It installs as its own app.
- The beta keeps its own data and settings, so nothing in it touches your real garden, and the real app never touches it.
- It opens with demo islands: Foundations, General science, Maths, Physics, Leadership and Music, about 190 ideas with links between subjects, some due for watering. Menu → Reset demo data puts them back.

## 0.9.1 — 2026-11-14

The tech tree goes dark.

- Styled after the Path of Exile passive tree: near-black sky with faint stars, carved bronze paths, gold-ringed nodes, trunks as notables with a second ring, topics as ornate keystones, and a compass star at the start.
- Ideas you know are lit and glow; ideas due for watering go dim, and ones that have dried out get a red ring.
- Picking anything lights its path back to the start in blue: up its branches, through its topic and everything that topic builds on.
- The bars and hover card turn dark while the tech tree is open. The web view gets the same look.

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
