// Which landmarks a topic can have: the library (tools/landmarks, baked into marks-lib.js) first, then the
// older shapes drawn in code. A topic nobody has picked one for gets one guessed from its name.
import { LIBRARY } from "./marks-lib.js";

const OLDER = [["pipes", "Organ pipes"], ["windmill", "Windmill"], ["coil", "Coil mast"], ["solids", "Pyramid"], ["colonnade", "Colonnade"], ["circle", "Standing stones"]];
export const MARK_LIST = [["kit", "Monument"], ...Object.entries(LIBRARY).map(([id, e]) => [id, e.name]).sort((a, b) => a[1].localeCompare(b[1])), ...OLDER];

const GUESS = [
  ["gear-tower", /thermo|energy|steam|engine|mechanical|robot|machine|manufactur|maker/],
  ["lighthouse", /wave|optic|\blight\b|navigat|sail|\bsea\b|ocean|marine/],
  ["radio-dish", /electro|electron|radio|signal|telecom|circuit/],
  ["atom", /physic|quantum|mechanics|relativity|nuclear|particle/],
  ["flask", /chemi|alchem|pharma|matter|material/],
  ["dna-helix", /biolog|genet|life sci|living|anatom|ecolog|evolution|medic|health/],
  ["abacus", /math|arithm|algebra|calculus|statist|geometr|number|shape|pattern/],
  ["scales", /measur|\blaw\b|legal|justice|ethic|econom|finance|invest/],
  ["globe", /geograph|travel|earth sci|climate|geolog/],
  ["observatory", /astro|cosmo|planet/],
  ["gear-tower", /engineer/],
  ["synth", /synth|music|audio|sound|production|harmon|rhythm|melod|chord/],
  ["easel", /\bart\b|arts|draw|paint|design|illustrat/],
  ["camera", /photo|film|video|cinema/],
  ["quill", /writ|poet|\bstor(y|ies)\b|novel|journal/],
  ["books", /literat|language|reading|linguist|english|spanish|french|hindi|tamil|japanese/],
  ["ruined-temple", /histor|classic|archaeolog|ancient/],
  ["seated-figure", /philosoph|psycholog|mind|meditat/],
  ["lectern", /lead|teach|speak|manag|mentor|coach|educat|communicat|event/],
  ["trophy", /sport|fitness|football|cricket|running|game|competi/],
  ["yarn", /knit|crochet|sew|craft|textile/],
  ["cooking-pot", /cook|food|bak|cuisine|nutrition/],
  ["bell-tower", /\btime|clock|calendar|organis|productiv/],
  ["flask", /scien/],
];
export function guessMark(name) {
  const n = String(name || "").toLowerCase();
  for (const [id, re] of GUESS) if (LIBRARY[id] && re.test(n)) return id;
  return "kit";
}
