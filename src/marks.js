// Which landmarks a topic can have: the library (tools/landmarks, baked into marks-lib.js) first, then the
// older shapes drawn in code. A topic nobody has picked one for gets one guessed from its name.
import { LIBRARY } from "./marks-lib.js";

const OLDER = [["pipes", "Organ pipes"], ["windmill", "Windmill"], ["coil", "Coil mast"], ["solids", "Pyramid"], ["colonnade", "Colonnade"], ["circle", "Standing stones"]];
export const MARK_LIST = [["kit", "Monument"], ...Object.entries(LIBRARY).map(([id, e]) => [id, e.name]).sort((a, b) => a[1].localeCompare(b[1])), ...OLDER];

// first match wins; a topic whose first match another topic already has gets its next match (assignMarks)
const GUESS = [
  ["bell-tower", /\btime|clock|calendar|organis|productiv/],
  ["gear-tower", /thermo|steam|engine|mechanical|machine|manufactur|industr/],
  ["wind-turbine", /energy|power|renewable|sustainab|wind/],
  ["newtons-cradle", /mechanics|motion|newton|dynamics|kinemat|force/],
  ["lighthouse", /wave|optic|\blight\b|navigat|sail|\bsea\b|ocean|marine/],
  ["magnet", /magnet|electro(?!n)/],
  ["circuit", /electron|circuit|comput|program|software|coding|digital/],
  ["radio-dish", /radio|signal|telecom|astronom/],
  ["atom", /physic|quantum|relativ|nuclear|particle/],
  ["flask", /chemi|alchem|pharma|matter|material/],
  ["dna-helix", /biolog|genet|life sci|living|anatom|ecolog|evolution|medic|health/],
  ["vectors", /linear|vector|matri/],
  ["curve", /calculus|graph|function|differential|integral/],
  ["blackboard", /algebra|equation|formula/],
  ["compass", /shape|geometr|trigonom|space/],
  ["nautilus", /pattern|sequence|fibonacci|fractal|spiral/],
  ["abacus", /math|arithm|number|count|statist/],
  ["scales", /measur|\blaw\b|legal|justice|ethic|econom|finance|invest/],
  ["globe", /geograph|travel|earth sci|climate|geolog/],
  ["observatory", /astro|cosmo|planet/],
  ["crane", /engineer|construct|architect|build|civil/],
  ["harp", /harmon|melod|chord|compos|instrument/],
  ["drum", /rhythm|drum|beat|percuss|tempo/],
  ["synth", /synth|audio|sound|production|music/],
  ["easel", /\bart\b|arts|draw|paint|design|illustrat/],
  ["camera", /photo|film|video|cinema/],
  ["quill", /writ|poet|\bstor(y|ies)\b|novel|journal/],
  ["books", /literat|language|reading|linguist|english|spanish|french|hindi|tamil|japanese/],
  ["ruined-temple", /histor|classic|archaeolog|ancient/],
  ["seated-figure", /philosoph|psycholog|mind|meditat/],
  ["marquee", /event|festival|party|celebrat|host/],
  ["signpost", /coach|mentor|guid|career|direction|plan/],
  ["lectern", /lead|teach|speak|manag|educat|communicat|present/],
  ["trophy", /sport|fitness|football|cricket|running|game|competi/],
  ["yarn", /knit|crochet|sew|craft|textile/],
  ["cooking-pot", /cook|food|bak|cuisine|nutrition/],
  ["flask", /scien/],
];
export function guessMarks(name) {   // every landmark the name matches, best first
  const n = String(name || "").toLowerCase(), out = [];
  for (const [id, re] of GUESS) if (LIBRARY[id] && re.test(n) && !out.includes(id)) out.push(id);
  return out;
}
export const guessMark = (name) => guessMarks(name)[0] || "kit";
// Landmarks for a whole garden, so no two topics share one: picked ones first, then each topic in turn takes its
// best match that nobody has yet. A topic with no free match gets the monument.
export function assignMarks(topics) {   // topics: [{ id, name, picked }]
  const out = new Map(), used = new Set(topics.map((t) => t.picked).filter(Boolean));
  for (const t of topics) {
    if (t.picked) { out.set(t.id, t.picked); continue; }
    const m = guessMarks(t.name).find((id) => !used.has(id)) || "kit";
    if (m !== "kit") used.add(m);
    out.set(t.id, m);
  }
  return out;
}
