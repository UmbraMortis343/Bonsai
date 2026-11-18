// Demo data for the beta. Beta keeps its own database, so this never touches a real garden.
// Topics are written as indented outlines: two spaces per level, "Title | short note".
// A blank line starts another knowledge graph in the same topic.

const HUBS = [["acad", "Academics"], ["work", "Work"], ["play", "Hobbies"]];
// id, name, centrepiece, hub, topics, and the island and idea it grows from (the tech tree's boundary cells)
const ISLANDS = [
  ["found", "Foundations", "arches", "acad", ["Numbers", "Reading and writing", "Shapes and space", "Patterns"]],
  ["gensci", "General science", "academy", "acad", ["Matter", "Energy", "Living things", "Measuring"], "found", "Patterns"],
  ["maths", "Maths", "statue", "acad", ["Algebra", "Calculus", "Linear algebra"], "found", "Numbers"],
  ["phys", "Physics", "academy", "acad", ["Mechanics", "Electromagnetism", "Waves", "Thermodynamics", "Quantum"], "gensci", "Energy"],
  ["lead", "Leadership", "statue", "work", ["Communication", "Coaching", "Running events"]],
  ["music", "Music", "amphitheatre", "play", ["Synthesis", "Harmony", "Rhythm"]],
  ["make", "Workshop", "amphitheatre", "play", ["Photography", "Knitting", "Cooking", "Electronics", "Geography", "Engineering"]],
];
// Workshop topics count as this many ideas fuller than they are, so every landmark tier can be seen: 100%, 130%, 160%, 200%
const FILL = { Photography: 150, Knitting: 240, Cooking: 330, Electronics: 480, Geography: 200, Engineering: 400 };
const OUTLINES = {
  Numbers: `Numbers | The quantities we count, compare and measure with
  Counting | Matching things one-to-one with number words
    Zero | Nothing as a number; it came long after counting
    Place value | A digit's worth depends on where it sits
    Negative numbers | Counting below zero: debts, temperatures
  Arithmetic | Combining numbers
    Addition | Putting amounts together
    Multiplication | Repeated addition; areas of rectangles
      Times tables | The facts that make everything faster
    Division | Sharing into equal parts
  Fractions | Parts of a whole
    Equivalent fractions | 1/2 = 2/4 = 3/6
    Ratios | Comparing two amounts
    Decimals | Fractions with powers of ten underneath
    Percentages | Out of a hundred`,
  "Reading and writing": `Reading | Turning marks into meaning
  Phonics | Letters map to sounds
  Comprehension | Following an argument or a story
    Inference | Reading what isn't said outright
  Vocabulary | Words you can use, not just recognise

Writing | Putting thoughts on the page
  Sentences | One complete thought
  Paragraphs | One idea, developed
  Drafting | Write badly first, then fix it`,
  "Shapes and space": `Shapes | Flat and solid forms
  Angles | Amount of turn between two lines
    Right angle | A quarter turn
  Triangles | Three sides; angles add to 180°
    Pythagoras | a² + b² = c² in a right triangle
  Circles | Every point the same distance from the centre
    Pi | Circumference over diameter
  Symmetry | Unchanged by a flip or turn
  Area and volume | How much surface, how much space`,
  Patterns: `Patterns | Rules that repeat or grow
  Sequences | Lists that follow a rule
    Arithmetic sequences | Add the same each time
    Geometric sequences | Multiply the same each time
  Repeating patterns | Tilings, beats, wallpaper
  Graphs | Pictures of how one thing changes with another`,
  Matter: `Matter | What things are made of
  States of matter | Solid, liquid, gas
    Melting and boiling | Changing state with heat
  Particles | Everything is made of tiny bits in motion
    Atoms | The smallest piece of an element
  Mixtures | Things mixed but not bonded
  Density | Mass per volume; why things float`,
  Energy: `Energy | What makes change happen
  Forms of energy | Kinetic, potential, thermal, chemical
  Energy transfer | Moving energy from one store to another
    Heat | Energy moving because of a temperature difference
    Light | Energy that travels as a wave
  Conservation of energy | Energy isn't made or destroyed, only moved
  Efficiency | Useful energy out over energy in`,
  "Living things": `Living things | What it takes to be alive
  Cells | The unit of life
    Plant and animal cells | Walls, chloroplasts, vacuoles
  Food chains | Who eats whom; energy flowing through
  Classification | Grouping living things by features
  Life cycles | Birth, growth, reproduction`,
  Measuring: `Measuring | Putting numbers on the world
  Units | Agreed amounts: metre, kilogram, second
    SI units | The international system
  Accuracy and precision | Close to true vs close together
  Uncertainty | How sure a measurement is
  Fair tests | Change one thing, keep the rest the same`,
  Algebra: `Algebra | Letters standing for numbers
  Variables | A name for an unknown or changing number
  Expressions | Combinations of numbers and variables
    Expanding brackets | a(b + c) = ab + ac
    Factorising | Writing an expression as a product
  Equations | Statements that two things are equal
    Linear equations | Straight-line relationships
    Quadratics | x² terms; parabolas
      Quadratic formula | x = (−b ± √(b² − 4ac)) / 2a
    Simultaneous equations | Two unknowns, two equations
  Functions | A rule from input to output
    Gradient | How steep a line is`,
  Calculus: `Calculus | The maths of change
  Limits | What a value approaches
  Derivatives | Instantaneous rate of change
    Chain rule | Derivative of a function of a function
    Rates of change | Speed of one thing relative to another
    Maxima and minima | Where the derivative is zero
  Integrals | Accumulated change; area under a curve
    Fundamental theorem | Differentiation and integration undo each other
  Differential equations | Equations about rates of change
    Harmonic oscillator | x'' = −ω²x; springs and pendulums`,
  "Linear algebra": `Vectors | Quantities with size and direction
  Vector addition | Tip to tail
  Dot product | How much two vectors point the same way
  Matrices | Grids of numbers that transform vectors
    Matrix multiplication | Doing one transform after another
    Determinant | How much a transform scales area
    Eigenvalues | Directions a transform only stretches
  Vector spaces | Anywhere vectors live
    Basis | The building blocks of a space`,
  Mechanics: `Newton's laws | How forces change motion
  1st law | Things keep doing what they're doing unless pushed
    Inertia | Resistance to changes in motion
  2nd law | F = ma
    Acceleration | Rate of change of velocity
    Impulse | Force × time = change in momentum
  3rd law | Every force has an equal and opposite partner
    Free-body diagrams | Draw every force on one object
  Forces | Pushes and pulls
    Friction | Force opposing sliding
    Tension | Pull through a rope or string
    Weight | Mass × gravitational field strength

Kinematics | Describing motion
  Displacement | Change in position, with direction
  Velocity | Rate of change of displacement
  Projectiles | Motion under gravity in two dimensions
  SUVAT | Equations for constant acceleration

Energy and momentum | Conserved quantities
  Work | Force × distance moved
  Power | Rate of doing work
  Momentum | Mass × velocity
    Collisions | Momentum is conserved
  Circular motion | Moving in a circle needs a centre-seeking force
    Centripetal force | mv²/r`,
  Electromagnetism: `Fields | Forces at a distance
  Electric field | Force per unit charge
    Coulomb's law | Force between two charges
  Magnetic field | Made by moving charges
    Lorentz force | Force on a moving charge in a field
  Induction | Changing magnetic flux makes a voltage
    Faraday's law | EMF = −dΦ/dt
    Lenz's law | Induced current opposes the change

Circuits | Paths for current
  Current | Flow of charge
  Voltage | Energy per charge
  Resistance | V = IR
  Series and parallel | How components share voltage and current`,
  Waves: `Waves | Disturbances that carry energy
  Wave equation | v = fλ
  Superposition | Waves add where they overlap
    Interference | Bright and dark fringes
    Standing waves | Nodes and antinodes
  Sound | Pressure waves in a medium
  Light | An electromagnetic wave
    Refraction | Bending as speed changes
  Fourier analysis | Any wave is a sum of sines
    Harmonics | Whole-number multiples of a fundamental`,
  Thermodynamics: `Laws of thermodynamics | Rules for heat and work
  Temperature | Average kinetic energy of particles
  Entropy | Spread of energy; disorder
    Heat engines | Turning heat into work
  Ideal gas | pV = nRT
    Kinetic theory | Gas pressure from particle collisions`,
  Quantum: `Quantum | Physics of the very small
  Photons | Light comes in packets
  Wave-particle duality | Both, depending on how you look`,
  Communication: `Communication | Getting ideas across
  Listening | Hearing what's meant, not just said
  Clear writing | One idea per sentence
  Presenting | Talking to a room
  Feedback | Telling someone how it landed`,
  Coaching: `Coaching | Helping people find their own answers
  Asking questions | Open questions over advice
  Growth mindset | Ability grows with effort
  Unblocking | Helping when someone is stuck`,
  "Running events": `Running events | Workshops, hackathons, meetups
  Planning | Date, venue, people, budget
  Promotion | Getting the right people to come
  On the day | Run sheet, roles, backup plans
  Follow-up | Thank-yous and what to change`,
  Synthesis: `Subtractive synthesis | Start bright, filter away
  Oscillators | Sources of a repeating wave
    Sawtooth | All harmonics
    Square | Odd harmonics
  Filters | Remove some frequencies
    Cutoff | Where the filter starts
    Resonance | A boost at the cutoff
  Envelopes | How a sound changes over time
    ADSR | Attack, decay, sustain, release
  Modulation | One signal changing another
    LFO | A slow oscillator for movement`,
  Harmony: `Intervals | Distance between two notes
  Tuning | How notes are spaced
    Just intonation | Whole-number frequency ratios
    12-TET | Twelve equal steps per octave
  Chords | Notes sounded together
    Triads | Root, third, fifth
  Scales | Ordered sets of notes
    Modes | Scales started from another note`,
  Rhythm: `Rhythm | Patterns in time
  Beat | The steady pulse
  Time signatures | Beats per bar
  Syncopation | Accents off the beat
  Polyrhythm | Two rhythms at once`,
  Photography: `Photography | Catching light
  Exposure | How much light reaches the sensor
    Aperture | The size of the opening
    Shutter speed | How long it stays open
    ISO | How sensitive the sensor is
  Composition | Where things sit in the frame`,
  Knitting: `Knitting | Loops pulled through loops
  Knit stitch | The basic stitch
  Purl stitch | The knit stitch from the back
  Norwegian patterns | Two-colour stranded motifs`,
  Cooking: `Cooking | Heat and flavour
  Searing | Browning for flavour
  Braising | Slow and wet
  Seasoning | Salt, acid, fat`,
  Electronics: `Electronics | Moving charge to do work
  Ohm's law | V = IR
  Capacitors | Store charge
  Op-amps | High-gain amplifiers`,
  Geography: `Geography | Places and the people in them
  Maps | Projections and scale
  Climate | Weather over decades`,
  Engineering: `Engineering | Making things that work
  Gears | Trading speed for torque
  Tolerances | How exact is exact enough`,
};
const LINKS = [
  ["Velocity", "Derivatives", "rate of change"], ["Acceleration", "Rates of change"], ["Harmonic oscillator", "Standing waves"], ["Free-body diagrams", "Vector addition"],
  ["Fourier analysis", "Oscillators"], ["Harmonics", "Sawtooth"], ["Harmonics", "Just intonation", "ratios"], ["Just intonation", "Ratios"], ["Conservation of energy", "Laws of thermodynamics"],
  ["Lorentz force", "Forces"], ["Gradient", "Derivatives"], ["Integrals", "Area and volume"], ["Eigenvalues", "Standing waves"], ["Pythagoras", "Vector addition"],
  ["Particles", "Kinetic theory"], ["Units", "SI units"], ["Feedback", "Asking questions"], ["Planning", "Fair tests", "try, measure, adjust"], ["Presenting", "Clear writing"], ["Graphs", "Functions"],
  ["Geometric sequences", "Harmonics"], ["Repeating patterns", "Polyrhythm"], ["Coulomb's law", "Weight", "inverse square"], ["Energy transfer", "Work"], ["Density", "Weight"],
  // links inside one graph: these are the straight bonds
  ["2nd law", "Forces", "the F in F = ma"], ["Free-body diagrams", "Tension"], ["Free-body diagrams", "Friction"], ["Weight", "Acceleration", "g"], ["Impulse", "Inertia"],
  ["Projectiles", "SUVAT"], ["Momentum", "Work"], ["Division", "Fractions", "a fraction is a division"], ["Place value", "Decimals"], ["Ratios", "Division"],
];

import { textToBlocks } from "./blocks.js";

// Notes, written the way lecture notes are, in folders, with properties: to try the notes window and growing with Claude.
// [kind, title, text or children, props, pages inside]
const tag = (name, value) => ({ id: "pr-" + name.toLowerCase(), name, type: "tags", value });
const PAGES = [
  ["folder", "Physics", [
    ["page", "Lecture 6: Momentum", `Quiz on Friday, bring calculator
- Momentum p = mv (vector, kg m/s)
  - heavier or faster → harder to stop
- Newton's 2nd law really says F = dp/dt
  - F = ma is the special case when mass doesn't change
  - rockets: mass changes, so use dp/dt
- Impulse = F × Δt = Δp
  - same change in momentum over longer time → smaller force
  - crumple zones, airbags, bending knees when landing
- Conservation of momentum: total p constant if no external force
  - comes from Newton's 3rd law (equal and opposite forces, same time)
  - recoil of a gun, ice skaters pushing apart
- Collisions
  - elastic: KE conserved too (snooker balls, roughly)
  - inelastic: KE lost to heat/sound/deformation
  - perfectly inelastic: objects stick together, max KE lost
- Worked example: 2 kg at 3 m/s hits 1 kg at rest, they stick → v = 6/3 = 2 m/s`, [tag("Tags", ["lecture", "momentum", "physics 120"]), { id: "pr-date", name: "Date", type: "date", value: "2026-11-12" }, { id: "pr-status", name: "Status", type: "status", value: "Tidied" }], [
      ["page", "Problem sheet 6", `## Q1
A 0.15 kg ball at 20 m/s is caught and stopped in 0.1 s. Average force?
- Δp = 0.15 × 20 = 3 kg m/s
- F = Δp / Δt = 30 N
## Q2
- [ ] Two skaters push apart: 50 kg moves off at 2 m/s. How fast does the 40 kg one go?
- [ ] Ask in tutorial about rockets and dp/dt`, [tag("Tags", ["problems", "momentum"]), { id: "pr-status", name: "Status", type: "status", value: "Raw" }]]]],
  ]],
  ["folder", "Leadership", [
    ["page", "Workshop: GROW model", `Facilitator: Sam. Slides on the drive.
GROW = a structure for a coaching conversation
  Goal: what do you want out of this? make it specific
  Reality: where are things now? facts, not judgements
  Options: what could you do? get several before picking
  Way forward: what will you do, by when? commitment
- Ask, don't tell. Open questions ("what", "how"), not "why" (sounds like blame)
- Silence is fine, let them think
- Coach doesn't need to know the answer
- Practised in pairs: 10 min each, observer gave feedback
  - I jumped to Options too fast, skipped Reality`, [tag("Tags", ["workshop", "coaching"]), { id: "pr-date", name: "Date", type: "date", value: "2026-11-08" }, { id: "pr-status", name: "Status", type: "status", value: "Raw" }]],
  ]],
  ["page", "Reading list", `- [ ] Feynman Lectures, vol 1, ch 9–10
- [x] The Coaching Habit
- [ ] Make It Stick`, [tag("Tags", ["reading"])]],
];

// vocab: [term, also called, meaning, where from]. Terms named inside a meaning link on to their own panels.
const VOCAB = [
  ["Momentum", ["p"], "Mass times velocity, p = mv. A vector, so direction matters. Newton's 2nd law is really about the rate of change of momentum.", "Lecture 6"],
  ["Impulse", [], "Force times the time it acts, F × Δt. It equals the change in momentum, which is why a longer stop means a smaller force.", "Lecture 6"],
  ["Newton's 2nd law", ["F = ma"], "Force is the rate of change of momentum, F = dp/dt. When mass stays the same this becomes F = ma.", "Lecture 6"],
  ["Inelastic", ["inelastic collision"], "A collision where kinetic energy is lost to heat, sound or bending; momentum is still conserved. Perfectly inelastic: the objects stick together.", "Lecture 6"],
  ["Kinetic energy", ["KE"], "Energy of motion, ½mv². Conserved in an elastic collision, lost in an inelastic one.", ""],
  ["GROW", ["GROW model"], "A structure for a coaching conversation: Goal, Reality, Options, Way forward.\n\nAsk, don't tell: open questions, and let them do the thinking.", "Workshop with Sam"],
];

export function demoBackup(now = Date.now()) {
  const DAY = 86400000, iso = (t) => new Date(t).toISOString();
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  let n = 0; const id = (p) => `${p}-${(++n).toString(36)}`;
  const zones = [], trees = [], nodes = [], links = [], byTitle = new Map(), zoneByName = new Map();
  const made = iso(now - 40 * DAY);
  ISLANDS.forEach(([, , , , topics]) => topics.forEach((name) => { const z = { id: id("z"), name, color: null, order: zones.length + 1, archived: false, createdAt: made, updatedAt: made }; zones.push(z); zoneByName.set(name, z); }));
  for (const [name, text] of Object.entries(OUTLINES)) {
    const z = zoneByName.get(name);
    text.split(/\n\s*\n/).forEach((block, gi) => {
      const lines = block.split("\n").filter((l) => l.trim());
      const t = { id: id("t"), zoneId: z.id, name: lines[0].split("|")[0].trim(), color: null, rootId: null, order: gi + 1, archived: false, createdAt: made, updatedAt: made };
      const stack = [], order = new Map();
      for (const line of lines) {
        const depth = (line.match(/^ */)[0].length) / 2, [title, note = ""] = line.trim().split("|").map((s) => s.trim());
        while (stack.length > depth) stack.pop();
        const parentId = stack.length ? stack[stack.length - 1] : null, k = order.get(parentId) || 0; order.set(parentId, k + 1);
        // about two in three are reviewed and not due; the rest are due now, a few long overdue
        const r = rnd(), reviewed = iso(now - (3 + rnd() * 20) * DAY), due = r < 0.62 ? now + (1 + rnd() * 14) * DAY : r < 0.85 ? now - rnd() * 0.8 * DAY : now - (2 + rnd() * 10) * DAY;
        const node = { id: id("n"), treeId: t.id, parentId, title, note, body: "", color: null, order: k + 1, createdAt: made, updatedAt: made, reviewedAt: reviewed, srs: { interval: 3, ease: 2.5, reps: 2, lapses: 0, passes: 2, due: iso(due) } };
        nodes.push(node); if (!parentId) t.rootId = node.id; if (!byTitle.has(title)) byTitle.set(title, node.id);
        stack.push(node.id);
      }
      trees.push(t);
    });
  }
  for (const [a, b, label = ""] of LINKS) { const x = byTitle.get(a), y = byTitle.get(b); if (x && y && x !== y) links.push({ id: id("l"), fromId: x, toId: y, label, note: "", createdAt: made, updatedAt: made }); }
  const garden = { hubs: HUBS.map(([hid, name]) => ({ id: hid, name })), zone: Object.fromEntries(Object.entries(FILL).map(([name, fill]) => [zoneByName.get(name).id, { fill }])), patron: "none",
    islands: ISLANDS.map(([iid, name, landmark, hubId, topics, after, from]) => ({ id: iid, name, landmark, hubId, zoneIds: topics.map((t) => zoneByName.get(t).id), after: after || null, from: (from && byTitle.get(from)) || null })) };
  const pages = [];
  const addPages = (list, parentId) => list.forEach(([kind, title, content, props = [], inside = []], k) => {
    const p = { id: id("p"), kind, parentId, title, blocks: kind === "page" ? textToBlocks(content) : [], props, order: k + 1, createdAt: iso(now - (3 - k) * DAY), updatedAt: iso(now - DAY), grown: [] };
    pages.push(p);
    if (kind === "folder") addPages(content, p.id);
    if (inside.length) { addPages(inside, p.id); for (const c of pages.filter((x) => x.parentId === p.id)) p.blocks.push({ id: id("b"), type: "page", pageId: c.id, html: "", indent: 0 }); }
  });
  addPages(PAGES, null);
  // a pen page: a sketch of two balls before a collision, a note under it, one line highlighted
  const phys = pages.find((x) => x.kind === "folder" && x.title === "Physics");
  if (phys) pages.push({ id: id("p"), kind: "ink", parentId: phys.id, title: "Collision sketch", blocks: [], props: [], ink: demoInk(), order: 9, createdAt: iso(now - DAY), updatedAt: iso(now - DAY), grown: [] });
  return { app: "bonsai", schema: 4, exportedAt: iso(now), zones, trees, nodes, links, events: [], patches: [], inbox: [], pages, meta: [{ key: "vocab", value: VOCAB.map(([term, aliases, def, source], k) => ({ id: "v" + k, term, aliases, def, source, at: iso(now - (VOCAB.length - k) * 3600000), editedAt: iso(now) })) }, { key: "garden", value: garden }, { key: "demo", value: iso(now) }] };
}

// Strokes for the demo's pen page, made by hand-ish curves (a fixed wobble, so the demo is the same each time).
function demoInk() {
  let k = 0; const wob = () => Math.sin(k++ * 1.7) * 0.8;
  const stroke = (t, c, pts, w) => ({ id: "d" + k++, t, c, p: pts.flatMap(([x, y], i) => [Math.round((x + wob()) * 10) / 10, Math.round((y + wob()) * 10) / 10, t === "hl" ? w : Math.round(w * (0.75 + 0.5 * Math.sin((i / pts.length) * Math.PI)) * 10) / 10]) });
  const circle = (cx, cy, r) => Array.from({ length: 46 }, (_, i) => { const a = -0.4 + (i / 42) * Math.PI * 2; return [cx + Math.cos(a) * r * (1 + 0.04 * Math.sin(a * 3)), cy + Math.sin(a) * r]; });
  const line = (x0, y0, x1, y1, n = 12) => Array.from({ length: n + 1 }, (_, i) => [x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n + Math.sin(i) * 0.6]);
  // joined-up loops along a line, a word at a time (a looped cycloid; every other loop taller, like an l)
  const words = (x, y, ws) => ws.map((len) => { const pts = []; for (let i = 0; i <= len * 14; i++) { const u = (i / 14) * Math.PI * 2, d = Math.floor(i / 14) % 2 ? 9 : 6; pts.push([x + 4.2 * u - d * Math.sin(u), y - d - d * -Math.cos(u) * -1 - 2]); } x += len * 26 + 20; return pts; });
  return { paper: "lined", strokes: [
    stroke("pen", 0, circle(250, 250, 70), 3.2), stroke("pen", 0, circle(640, 260, 44), 3.2),
    stroke("pen", 1, line(330, 250, 520, 252), 3), stroke("pen", 1, line(496, 236, 522, 252, 4), 3), stroke("pen", 1, line(496, 268, 522, 252, 4), 3),
    ...words(196, 360, [3, 5]).map((p) => stroke("pen", 0, p, 2.4)), ...words(600, 360, [3, 4]).map((p) => stroke("pen", 0, p, 2.4)),
    stroke("hl", 0, line(96, 467, 560, 467), 24),
    ...words(100, 468, [5, 2, 6, 3, 7]).map((p) => stroke("pen", 0, p, 2.4)),
    ...words(100, 540, [4, 6, 2, 5]).map((p) => stroke("pen", 0, p, 2.4)),
    stroke("pen", 2, line(100, 556, 400, 556, 20), 2.6),
  ] };
}
