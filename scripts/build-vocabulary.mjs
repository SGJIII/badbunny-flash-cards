import { mkdir, readFile, writeFile } from "node:fs/promises";

const TRACKS = [
  "NUEVAYoL",
  "VOY A LLeVARTE PA PR",
  "BAILE INoLVIDABLE",
  "PERFuMITO NUEVO",
  "WELTiTA",
  "VeLDÁ",
  "EL CLúB",
  "KETU TeCRÉ",
  "BOKeTE",
  "KLOuFRENS",
  "TURiSTA",
  "CAFé CON RON",
  "PIToRRO DE COCO",
  "LO QUE LE PASÓ A HAWAii",
  "EoO",
  "DtMF",
  "LA MuDANZA",
];

const OVERRIDES = {
  acho: "man / wow (Puerto Rican expression)",
  ahí: "there",
  anda: "go on / walks",
  ando: "I am / I walk",
  ay: "oh / ow",
  al: "to the / at the",
  algo: "something",
  aquí: "here",
  ahora: "now",
  así: "like this / this way",
  aunque: "although / even if",
  baby: "baby",
  bellaqueo: "sexual flirting / perreo (slang)",
  bellaco: "horny / worked up (slang)",
  bellaca: "horny / worked up (slang, feminine)",
  bellaqueando: "flirting sexually / dancing perreo (slang)",
  bellaquita: "naughty / flirty girl (slang)",
  bicho: "penis / dude (Puerto Rican slang, vulgar)",
  bichote: "big shot / drug boss (slang)",
  bien: "well / good",
  boricua: "Puerto Rican",
  borinquen: "Borinquen / Puerto Rico",
  cabrón: "dude / bastard (slang, vulgar)",
  cabrona: "badass / bitch (slang, vulgar)",
  caes: "you fall",
  carita: "little face",
  chavos: "money (Puerto Rican slang)",
  chamaquito: "kid / young guy (Puerto Rican slang)",
  "chinga'o": "fucked up (slang, vulgar)",
  chingando: "fucking / having sex (slang, vulgar)",
  chingar: "to fuck / have sex (slang, vulgar)",
  chinchorrear: "to bar-hop / hang out (Puerto Rican slang)",
  chulería: "beauty / coolness (Caribbean slang)",
  club: "club",
  cojón: "ball / nerve (vulgar)",
  cojones: "balls / guts (vulgar)",
  con: "with",
  corillo: "crew / group of friends (Puerto Rican slang)",
  culito: "little ass (slang, vulgar)",
  de: "of / from",
  del: "of the / from the",
  desde: "from / since",
  donde: "where",
  dónde: "where",
  debí: "I should have / I owed",
  dembow: "dembow rhythm",
  diabla: "she-devil / wild girl",
  dime: "tell me",
  doy: "I give",
  el: "the",
  él: "he / him",
  ella: "she / her",
  en: "in / on",
  era: "was / used to be",
  eras: "you were",
  ere: "you are (short for eres)",
  eres: "you are",
  es: "is / it is",
  esa: "that (feminine)",
  ese: "that (masculine)",
  eso: "that",
  está: "is / is located",
  estaba: "was",
  estamo: "we are (short for estamos)",
  estoy: "I am",
  estás: "you are",
  están: "they are / you all are",
  esta: "this (feminine)",
  este: "this (masculine)",
  esto: "this",
  fui: "I went / I was",
  fue: "was / went",
  fotito: "little photo / cute little photo",
  guagua: "bus (Caribbean Spanish)",
  ha: "has",
  hay: "there is / there are",
  hasta: "until / even",
  janguear: "to hang out (Puerto Rican slang)",
  jangueando: "hanging out (Puerto Rican slang)",
  jeva: "girl / girlfriend (slang)",
  joseando: "hustling (Puerto Rican slang)",
  lao: "side (short for lado)",
  "la'o": "side (short for lado)",
  lelolai: "lelolai (Puerto Rican folk refrain)",
  la: "the (feminine)",
  las: "the (feminine plural)",
  le: "to him / to her / to you",
  les: "to them / to you all",
  lo: "it / the (neutral)",
  los: "the (masculine plural)",
  mami: "baby / girl (affectionate slang)",
  má: "mom / ma",
  más: "more / most",
  me: "me / to me",
  mi: "my",
  mí: "me",
  mis: "my (plural)",
  mucho: "a lot / much",
  muy: "very",
  na: "nothing (short for nada)",
  nada: "nothing",
  nena: "girl / babe",
  nene: "boy / babe",
  ni: "neither / not even",
  no: "no / not",
  nos: "us / ourselves",
  nunca: "never",
  o: "or",
  otra: "another / other (feminine)",
  otro: "another / other (masculine)",
  pa: "for / to (short for para)",
  "pa'cá": "over here (short for para acá)",
  "pa'l": "for the / to the (short for para el)",
  "pa'llá": "over there (short for para allá)",
  "pa'trá": "backward / back there (short for para atrás)",
  pal: "for the / to the (short for para el)",
  papi: "baby / guy (affectionate slang)",
  para: "for / in order to",
  party: "party",
  pegao: "stuck / close / popular (slang)",
  perico: "cocaine / parrot (context-dependent slang)",
  perreo: "reggaetón grinding dance",
  perreando: "dancing reggaetón / grinding",
  perrear: "to dance reggaetón / grind",
  perreá: "dance reggaetón / grind",
  piquito: "little kiss / peck",
  pitorro: "Puerto Rican moonshine",
  playita: "little beach",
  pero: "but",
  por: "for / by / through",
  porque: "because",
  pr: "Puerto Rico",
  puñeta: "damn / fuck (Puerto Rican slang, vulgar)",
  que: "that / which",
  qué: "what",
  reggaetón: "reggaetón",
  rumba: "party / dance gathering",
  sacas: "you take out / bring out",
  sea: "may be / be",
  seas: "you may be / be",
  se: "himself / herself / themselves",
  sé: "I know / be",
  si: "if",
  sí: "yes / oneself",
  sin: "without",
  sobre: "about / on top of",
  sobeteo: "touching / groping (slang)",
  solo: "alone / only",
  son: "they are",
  soy: "I am",
  sube: "go up / turn it up",
  su: "his / her / their / your",
  sus: "his / her / their / your (plural)",
  te: "you / to you",
  tengo: "I have",
  ti: "you (after a preposition)",
  ta: "is / it is (short for está)",
  tan: "so / as",
  tas: "you are (short for estás)",
  tás: "you are (short for estás)",
  tiene: "has / you have",
  to: "all / everything (short for todo)",
  "to'l": "all the (short for todo el)",
  todo: "everything / all",
  todos: "everyone / all",
  trigueña: "brown-skinned / olive-toned woman",
  toy: "I am (short for estoy)",
  tu: "your",
  tú: "you",
  un: "a / an",
  una: "a / an",
  uno: "one",
  va: "goes / is going",
  vamos: "we are going / let's go",
  vamo: "we're going / let's go (short for vamos)",
  van: "they go / are going",
  vas: "you go / are going",
  ve: "go / see (context-dependent)",
  ven: "come",
  ver: "to see",
  verdá: "truth / right? (short for verdad)",
  ves: "you see",
  vi: "I saw",
  viera: "saw / if I saw",
  vírate: "turn around / get out (slang)",
  "vo'a": "I'm going to (short for voy a)",
  voy: "I'm going / I go",
  vámono: "let's go (short for vámonos)",
  dale: "go ahead / come on (slang)",
  ey: "hey",
  eh: "eh / hey",
  tra: "tra (rhythmic ad-lib)",
  y: "and",
  ya: "already / now",
  yo: "I",
};

const SLANG = new Set([
  "acho", "bellaca", "bellaqueando", "bellaqueo", "bellaquita", "bellaco", "bicho",
  "bichote", "boricua", "cabrón", "cabrona", "chamaquito", "chavos", "chinga'o",
  "chingando", "chingar", "chinchorrear", "chulería", "cojón", "cojones", "corillo",
  "culito", "dale", "guagua", "janguear", "jangueando", "jeva", "joseando", "mami",
  "na", "nena", "nene", "pa", "pa'cá", "pa'l", "pa'llá", "pa'trá", "pal", "papi",
  "pegao", "perico", "perreo", "perreando", "perrear", "perreá", "pitorro", "pr",
  "puñeta", "sobeteo", "to", "to'l", "trigueña", "verdá", "vírate", "vo'a", "vámono",
]);

const BLOCKED = new Set([
  "chorus", "coro", "embed", "intro", "lyrics", "outro", "pre", "refrain",
  "verse", "verso",
]);

const normalize = (value) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const displayTrackName = (value) => value
  .replace(/^BAD BUNNY\s*-\s*/i, "")
  .replace(/\s*\(Visualizer\).*$/i, "")
  .trim();

function candidateScore(candidate, expected) {
  if (!candidate.plainLyrics || candidate.instrumental) return -Infinity;
  const track = normalize(displayTrackName(candidate.trackName ?? ""));
  const wanted = normalize(expected);
  const album = normalize(candidate.albumName ?? "");
  const artist = normalize(candidate.artistName ?? "");
  let score = Math.min(candidate.plainLyrics.length / 1000, 5);
  if (track === wanted) score += 120;
  else if (track.includes(wanted) || wanted.includes(track)) score += 80;
  if (album.includes("debi tirar mas fotos")) score += 35;
  if (artist.includes("bad bunny")) score += 25;
  if (/visualizer/i.test(candidate.trackName ?? "")) score += 6;
  return score;
}

async function fetchTrack(title) {
  const query = new URLSearchParams({ q: `Bad Bunny ${title} DeBÍ TiRAR MáS FOToS` });
  const response = await fetch(`https://lrclib.net/api/search?${query}`, {
    headers: { "User-Agent": "PalabrasDTMF/1.0 (vocabulary study project)" },
  });
  if (!response.ok) throw new Error(`LRCLIB ${response.status} for ${title}`);
  const candidates = await response.json();
  const ranked = candidates
    .map((candidate) => ({ candidate, score: candidateScore(candidate, title) }))
    .filter(({ score }) => Number.isFinite(score))
    .sort((a, b) => b.score - a.score);
  if (!ranked.length || ranked[0].score < 40) {
    throw new Error(`No reliable lyric record found for ${title}`);
  }
  return ranked[0].candidate;
}

function tokenize(lyrics) {
  return lyrics
    .split("\n")
    .filter((line) => !/^\s*\[.*\]\s*$/.test(line))
    .join("\n")
    .match(/[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*/gu)
    ?.map((word) => word.normalize("NFC").toLocaleLowerCase("es"))
    .map((word) => word.replace(/^['’]+|['’]+$/g, ""))
    .filter((word) => word && !BLOCKED.has(word)) ?? [];
}

function chunksByCharacters(words, maxCharacters = 360) {
  const chunks = [];
  let chunk = [];
  let count = 0;
  for (const word of words) {
    const added = word.length + (chunk.length ? 1 : 0);
    if (chunk.length && count + added > maxCharacters) {
      chunks.push(chunk);
      chunk = [];
      count = 0;
    }
    chunk.push(word);
    count += added;
  }
  if (chunk.length) chunks.push(chunk);
  return chunks;
}

async function translateWords(words, cachedTranslations = new Map()) {
  const translations = new Map(Object.entries(OVERRIDES));
  for (const [word, meaning] of cachedTranslations) {
    if (!translations.has(word)) translations.set(word, meaning);
  }
  const remaining = words.filter((word) => !translations.has(word));
  for (const [index, chunk] of chunksByCharacters(remaining).entries()) {
    const params = new URLSearchParams({ q: chunk.join("\n"), langpair: "es|en" });
    const response = await fetch(`https://api.mymemory.translated.net/get?${params}`);
    if (!response.ok) {
      console.warn(`MyMemory ${response.status} on batch ${index + 1}; keeping untranslated fallbacks.`);
      break;
    }
    const payload = await response.json();
    const translated = String(payload.responseData?.translatedText ?? "").split("\n");
    if (translated.length !== chunk.length) {
      console.warn(`Translation batch ${index + 1} changed line count; using source words as fallback.`);
    }
    chunk.forEach((word, wordIndex) => {
      const meaning = translated[wordIndex]?.trim();
      translations.set(word, meaning || word);
    });
    await new Promise((resolve) => setTimeout(resolve, 180));
  }
  for (const word of words) {
    if (!translations.has(word)) translations.set(word, word);
  }
  return translations;
}

const trackRecords = [];
for (const [index, title] of TRACKS.entries()) {
  const record = await fetchTrack(title);
  trackRecords.push({
    id: index + 1,
    title,
    lrclibId: record.id,
    duration: Math.round(record.duration ?? 0),
    lyrics: record.plainLyrics,
  });
  console.log(`${String(index + 1).padStart(2, "0")}/17 ${title} — LRCLIB ${record.id}`);
  await new Promise((resolve) => setTimeout(resolve, 120));
}

const vocabulary = new Map();
let totalTokens = 0;
for (const track of trackRecords) {
  for (const word of tokenize(track.lyrics)) {
    totalTokens += 1;
    const current = vocabulary.get(word) ?? { count: 0, tracks: new Set() };
    current.count += 1;
    current.tracks.add(track.id);
    vocabulary.set(word, current);
  }
}

const rankedWords = [...vocabulary.entries()]
  .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0], "es"));
let cachedTranslations = new Map();
try {
  const previous = JSON.parse(await readFile("app/data/vocabulary.json", "utf8"));
  cachedTranslations = new Map(previous.words.map(({ term, meaning }) => [term, meaning]));
  console.log(`Reusing ${cachedTranslations.size} cached translations.`);
} catch {
  // The first generation has no cache.
}
const translations = await translateWords(
  rankedWords.map(([word]) => word),
  cachedTranslations,
);

const words = rankedWords.map(([term, value], index) => {
  const translated = translations.get(term) ?? term;
  const isFallback = normalize(translated) === normalize(term);
  return {
    id: index + 1,
    term,
    meaning: translated,
    count: value.count,
    tracks: [...value.tracks],
    tier: value.count >= 8 ? "essential" : value.count >= 3 ? "frequent" : "deep-cut",
    category: SLANG.has(term) ? "slang" : isFallback ? "name-or-untranslated" : "standard",
    source: Object.hasOwn(OVERRIDES, term) ? "curated" : "machine",
  };
});

const output = {
  generatedAt: new Date().toISOString(),
  album: "DeBÍ TiRAR MáS FOToS",
  artist: "Bad Bunny",
  totalTokens,
  uniqueWords: words.length,
  tracks: trackRecords.map(({ id, title, lrclibId, duration }) => ({ id, title, lrclibId, duration })),
  words,
};

await mkdir("app/data", { recursive: true });
await writeFile("app/data/vocabulary.json", `${JSON.stringify(output, null, 2)}\n`);
console.log(`Wrote ${words.length} unique words from ${totalTokens} appearances.`);
