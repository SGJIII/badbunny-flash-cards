"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import grammarData from "./data/grammar.json";
import vocabularyData from "./data/vocabulary.json";

type WordCard = (typeof vocabularyData.words)[number];
type Mode = "all" | "essential" | "slang" | "verbs" | "track" | "saved" | "learning";
type StudyDirection = "spanish-first" | "english-first";
type GrammarEntry = {
  kind: "verb" | "noun" | "mixed";
  gloss?: string;
  lemma?: string;
  form: string;
  note?: string;
  alsoUsedAs?: string;
};
type ProgressEntry = {
  status: "new" | "learning" | "mastered";
  favorite: boolean;
  reviews: number;
};
type ProgressMap = Record<string, ProgressEntry>;
type IssueKind = "translation" | "grammar" | "nuance" | "typo" | "other";
type CardReport = {
  id: string;
  wordId: number;
  term: string;
  displayedMeaning: string;
  exampleSpanish?: string;
  exampleEnglish?: string;
  issue: IssueKind;
  note: string;
  createdAt: string;
  status: "open" | "resolved";
  delivery: "local" | "submitted";
};
type SentencePair = {
  spanish: string;
  english: string;
};
type SentenceExample = {
  spanish: string;
  english: string;
  sourceSentenceId: number;
  sourceOwner: string;
  sourceLicense: string;
  translationOwner: string;
  translationLicense: string;
};
type TatoebaSentence = {
  id: number;
  text: string;
  license: string;
  owner: string | null;
  is_unapproved: boolean;
  translations: Array<{
    id: number;
    text: string;
    lang: string;
    license: string;
    owner: string | null;
    is_unapproved: boolean;
    is_direct: boolean;
  }>;
};

const DATA = vocabularyData;
const WORDS = DATA.words;
const GRAMMAR = grammarData.entries as Record<string, GrammarEntry>;
const VERB_WORD_COUNT = WORDS.filter((word) => GRAMMAR[word.term] && GRAMMAR[word.term].kind !== "noun").length;
const TRACK_WORD_COUNTS = Object.fromEntries(
  DATA.tracks.map((track) => [track.id, WORDS.filter((word) => word.tracks.includes(track.id)).length]),
) as Record<number, number>;
const STORAGE_KEY = "palabras-dtmf-progress-v1";
const REPORTS_KEY = "palabras-dtmf-reports-v1";
const DIRECTION_KEY = "palabras-dtmf-direction-v1";
const SWIPE_THRESHOLD = 72;
const SWIPE_MAX_OFFSET = 150;
const RESOLVED_REPORT_IDS = new Set([
  "2f07a036-f222-4e97-bc5b-c437d5985cd5",
  "2649d1ec-dbe6-4d48-aff4-b48c13094354",
  "1661ce6d-17dd-465d-89ad-98b8bfd0b153",
  "0203d681-0d21-47a3-b34b-fff91a18e28d",
  "846774fa-770f-49ba-95f4-c2dae3dcb958",
  "e2ffbee9-0875-4631-a773-8ab646a861a4",
  "c8bbac2b-66d0-4cb0-a3b7-036ef796e907",
  "e5ab0c43-7f96-477c-8229-add4d6f35727",
  "097c1508-235a-457d-afd1-00b078e3f1bb",
]);
const GENIUS_TRACK_URLS: Record<number, string> = {
  1: "https://genius.com/Bad-bunny-nuevayol-lyrics",
  2: "https://genius.com/Bad-bunny-voy-a-llevarte-pa-pr-lyrics",
  3: "https://genius.com/Bad-bunny-baile-inolvidable-lyrics",
  4: "https://genius.com/Bad-bunny-and-rainao-perfumito-nuevo-lyrics",
  5: "https://genius.com/Bad-bunny-and-chuwi-weltita-lyrics",
  6: "https://genius.com/Bad-bunny-omar-courtz-and-dei-v-velda-lyrics",
  7: "https://genius.com/Bad-bunny-el-club-lyrics",
  8: "https://genius.com/Bad-bunny-ketu-tecre-lyrics",
  9: "https://genius.com/Bad-bunny-bokete-lyrics",
  10: "https://genius.com/Bad-bunny-kloufrens-lyrics",
  11: "https://genius.com/Bad-bunny-turista-lyrics",
  12: "https://genius.com/Bad-bunny-and-los-pleneros-de-la-cresta-cafe-con-ron-lyrics",
  13: "https://genius.com/Bad-bunny-pitorro-de-coco-lyrics",
  14: "https://genius.com/Bad-bunny-lo-que-le-paso-a-hawaii-lyrics",
  15: "https://genius.com/Bad-bunny-eoo-lyrics",
  16: "https://genius.com/Bad-bunny-dtmf-lyrics",
  17: "https://genius.com/Bad-bunny-la-mudanza-lyrics",
};

const ISSUE_LABELS: Record<IssueKind, string> = {
  translation: "Traducción incorrecta",
  grammar: "Gramática o conjugación",
  nuance: "Falta contexto o matiz",
  typo: "Error de escritura",
  other: "Otro problema",
};

const MODE_LABELS: Record<Mode, string> = {
  all: "Todas",
  essential: "Esenciales",
  slang: "PR + jerga",
  verbs: "Verbos",
  track: "Canción",
  saved: "Guardadas",
  learning: "Falladas recientes",
};

const ENGLISH_EXAMPLE_SENTENCES: Record<string, string> = {
  que: "I know that you still think about that night.",
  y: "You and I danced until the sun came up.",
  la: "The photo is still saved on my phone.",
  a: "I went to the party just to see you.",
  te: "I sent you a message after midnight.",
  no: "I’m not ready for the night to end.",
  me: "Tell me you remember that song too.",
  yo: "I stayed until the last song finished.",
  tú: "You were the first person I looked for.",
  de: "That photo of us still makes me smile.",
  en: "We met again in the same old place.",
  el: "The music got louder when you walked in.",
  si: "If you call me, I’ll come back tonight.",
  lo: "I remember it like it happened yesterday.",
  pa: "I saved this dance for you.",
  se: "She left before anyone noticed.",
  ey: "Hey, come dance with me.",
  un: "I waited for a message that never came.",
  ve: "Go see whether they’re still outside.",
  con: "I want to spend one more night with you.",
  eh: "Hey, I thought I saw you by the door.",
  los: "The memories came back with the music.",
  baby: "Baby, stay with me until the song ends.",
  es: "It is the song that always brings me back.",
  por: "I came back for one last dance.",
  mi: "My favorite photo is still the one of us.",
  ya: "I already know how this night will end.",
  pero: "I tried to leave, but our song came on.",
  vamo: "Let’s go before the party ends.",
  bien: "I’m doing well, even though I still miss you.",
  las: "The lights came on before we stopped dancing.",
  como: "Dance like nobody is watching.",
  va: "She is going wherever the music takes her.",
  hoy: "Today I finally deleted your old message.",
  mami: "Baby, you know I saved this dance for you.",
  una: "We shared a night I’ll never forget.",
  le: "I gave her the photo before I left.",
  tu: "Your voice still sounds the same on that recording.",
  "vo'a": "I’m going to dance until the club closes.",
  qué: "What are you doing after the party?",
  estoy: "I am still here, listening to our song.",
  más: "I wanted one more night with you.",
  aquí: "I’ll be here if you decide to come back.",
  mí: "You saved the last dance for me.",
  ahora: "Now the whole night feels like a memory.",
  cuando: "Call me when you hear our song.",
  ver: "I went back to see if you were there.",
  así: "Hold me like this until the music stops.",
  cómo: "I still remember how you used to dance.",
  día: "That was the day everything changed.",
  nos: "The music took us back to that summer.",
  ni: "I didn’t even notice the sun coming up.",
  solo: "I danced alone after everyone went home.",
  nadie: "No one knew where we had gone.",
  sé: "I know this song still makes you think of me.",
  soy: "I am the same person you met that summer.",
  está: "The party is still going downstairs.",
  otra: "Play another song before we leave.",
  porque: "I came back because I wanted to see you.",
  quiero: "I want one more dance before you go.",
  ven: "Come dance with me before the night ends.",
  voy: "I’m going wherever the night takes me.",
  hace: "We met here a long time ago.",
  na: "Nothing felt the same after you left.",
  sí: "Yes, I still remember our last night together.",
  tengo: "I have your old photo in my wallet.",
  verdá: "You still miss those nights, right?",
  vida: "Life felt easier when we danced together.",
  calle: "The music followed us into the street.",
  hay: "There is one song I still can’t forget.",
  loco: "The whole night felt crazy and beautiful.",
  ser: "I just wanted to be close to you again.",
  ahí: "I left your photo right there on the table.",
  dale: "Come on, the night is just getting started.",
  estás: "You are exactly where I hoped you’d be.",
  hasta: "We danced until the lights came on.",
  nuevo: "That new song made the room come alive.",
  puedo: "I can still remember every word you said.",
  siempre: "I’ll always remember the way you danced.",
  también: "I miss those nights too.",
  tiene: "She has the photo we took that night.",
  to: "I gave you everything I had.",
  cabrón: "That dude still thinks he owns the dance floor.",
  contigo: "I would stay here all night with you.",
  eso: "That is the moment I keep thinking about.",
  fue: "It was the best night of that summer.",
  nunca: "I never forgot the way you looked at me.",
  o: "We can stay here or leave together.",
  quieres: "Do you want to dance one more time?",
  son: "They are the friends who stayed until sunrise.",
  toy: "I’m outside, waiting by the car.",
  dime: "Tell me where you want to go tonight.",
  fuiste: "You were the reason I came to the party.",
  perreo: "That reggaetón dance kept the whole room moving.",
  perreá: "Dance reggaetón with me before the DJ changes the song.",
  bellaquita: "That flirty girl took over the dance floor.",
  "pa'cá": "Come over here so I can hear you.",
  "pa'l": "We’re heading to the club after midnight.",
  papi: "Baby, come closer before the song ends.",
  perreando: "We spent the whole night dancing reggaetón.",
  "to'l": "The whole club sang along with the chorus.",
  acho: "Man, I still can’t believe that happened.",
  chamaquito: "That young guy knows every song the DJ plays.",
  nena: "Babe, save the last dance for me.",
  perrear: "We came here to dance reggaetón until sunrise.",
  bellaca: "She felt worked up when the beat dropped.",
  bellaqueo: "Their flirting got bolder as the night went on.",
  culito: "He couldn’t stop talking about that cute little ass.",
  janguear: "We should hang out after the party.",
  nene: "Babe, call me when you get home.",
  "pa'llá": "Let’s go over there where the music is louder.",
  "pa'trá": "Move back before the crowd closes in.",
  perico: "He swore the bag held cocaine, not anything harmless.",
  pitorro: "They passed around Puerto Rican moonshine at the party.",
  sobeteo: "She was tired of all the unwanted touching in the club.",
  vámono: "Let’s go before the sun comes up.",
  vírate: "Turn around and look at me when I’m talking to you.",
  bellaqueando: "They kept flirting and dancing close all night.",
  bicho: "That dude talks big whenever his crew is around.",
  bichote: "The big shot arrived with his whole crew.",
  cabrona: "She walked in like a total badass.",
  chinchorrear: "We spent Sunday bar-hopping around the island.",
  "chinga'o": "The whole situation was completely messed up.",
  chingando: "They were having sex while everyone else was out.",
  chingar: "They left the party early to have sex.",
  chulería: "Her outfit was pure Caribbean coolness.",
  jangueando: "We were hanging out when our old song came on.",
  pal: "This song is for the people who stayed.",
  puñeta: "Damn, that song still hits me every time.",
  ella: "She danced as if no one else was there.",
  noche: "That night still feels like yesterday.",
  bailar: "We went out to dance and forgot the time.",
  escuchando: "We stayed up listening to the songs you loved.",
  triste: "The apartment felt sad and quiet after you left.",
  bebé: "Baby, don’t leave before our song ends.",
  bebiendo: "They kept drinking while the music played.",
  beso: "I still remember our first kiss.",
  bonita: "You looked beautiful under the club lights.",
  casa: "I didn’t want to go home without you.",
  bailo: "I dance whenever that song comes on.",
  baile: "That dance is one I’ll never forget.",
  bailando: "We kept dancing until the lights came on.",
  corillo: "My crew is waiting outside, so let’s go.",
  fotito: "She sent me a cute little photo before the party.",
  perfumito: "I can still smell your perfume on my shirt.",
  he: "I have kept the photos from that summer.",
  da: "That song gives me joy.",
  hacía: "He used to make music every night.",
  dio: "She gave me a photo before leaving.",
  prendan: "Turn on the lights when the crew arrives.",
  tiré: "I took a lot of photos at the party.",
  valgan: "I want memories that are worth it.",
};

const CURATED_SPANISH_SENTENCES: Record<string, string> = {
  pa: "Guardé este baile pa ti.",
  mami: "Mami, tú sabes que guardé este baile para ti.",
  "vo'a": "Vo'a bailar hasta que cierre el club.",
  na: "Na se sintió igual después que te fuiste.",
  verdá: "Todavía extrañas esas noches, ¿verdá?",
  dale: "Dale, que la noche apenas comienza.",
  to: "Te di to lo que tenía.",
  cabrón: "Ese cabrón todavía cree que la pista es de él.",
  pr: "Quiero volver pa PR este verano.",
  perreo: "Ese perreo mantuvo a todo el mundo bailando.",
  perreá: "Perreá conmigo antes de que el DJ cambie la canción.",
  bellaquita: "La bellaquita se adueñó de la pista.",
  "pa'cá": "Ven pa'cá para poder escucharte.",
  "pa'l": "Vamos pa'l club después de medianoche.",
  papi: "Papi, acércate antes de que termine la canción.",
  perreando: "Pasamos la noche entera perreando.",
  "to'l": "To'l club cantó cuando llegó el coro.",
  acho: "Acho, todavía no puedo creer lo que pasó.",
  chamaquito: "Ese chamaquito se sabe todas las canciones del DJ.",
  nena: "Nena, guarda el último baile para mí.",
  perrear: "Vinimos a perrear hasta que salga el sol.",
  bellaca: "Se puso bellaca cuando cayó el beat.",
  bellaqueo: "El bellaqueo se puso más intenso durante la noche.",
  culito: "No paraba de hablar de ese culito.",
  janguear: "Podemos janguear después de la fiesta.",
  nene: "Nene, llámame cuando llegues a casa.",
  "pa'llá": "Vamos pa'llá, donde la música suena más fuerte.",
  "pa'trá": "Muévete pa'trá antes de que se cierre el corillo.",
  perico: "Juró que la bolsa tenía perico.",
  pitorro: "Pasaron una botella de pitorro en la fiesta.",
  sobeteo: "Ella se cansó del sobeteo en el club.",
  vámono: "Vámono antes de que salga el sol.",
  vírate: "Vírate y mírame cuando te hablo.",
  bellaqueando: "Siguieron bellaqueando y bailando toda la noche.",
  bicho: "Ese bicho habla de más cuando está con su corillo.",
  bichote: "El bichote llegó con el corillo completo.",
  cabrona: "Entró como una cabrona que no le teme a nadie.",
  chinchorrear: "Nos fuimos a chinchorrear por la isla el domingo.",
  "chinga'o": "Todo estaba bien chinga'o después de la fiesta.",
  chingando: "Estaban chingando mientras los demás salían.",
  chingar: "Se fueron temprano para chingar.",
  chulería: "Su ropa era una chulería caribeña.",
  jangueando: "Estábamos jangueando cuando pusieron nuestra canción.",
  pal: "Esta canción es pal que decidió quedarse.",
  puñeta: "Puñeta, esa canción todavía me llega.",
  bailo: "Yo bailo cada vez que ponen esa canción.",
  baile: "Ese baile es uno que nunca voy a olvidar.",
  bailando: "Seguimos bailando hasta que prendieron las luces.",
  corillo: "Mi corillo está afuera; vámonos.",
  fotito: "Ella me mandó una fotito antes de la fiesta.",
  perfumito: "Todavía tengo tu perfumito en la camisa.",
  he: "He guardado las fotos de aquel verano.",
  da: "Esa canción me da alegría.",
  hacía: "Él hacía música todas las noches.",
  dio: "Ella me dio una foto antes de irse.",
  prendan: "Prendan las luces cuando llegue el corillo.",
  tiré: "Tiré muchas fotos en la fiesta.",
  valgan: "Quiero recuerdos que valgan la pena.",
};

function curatedSentencePair(term: string): SentencePair | undefined {
  const spanish = CURATED_SPANISH_SENTENCES[term];
  const english = ENGLISH_EXAMPLE_SENTENCES[term];
  return spanish && english ? { spanish, english } : undefined;
}

function shuffled(values: number[]) {
  const next = [...values];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [next[index], next[swap]] = [next[swap], next[index]];
  }
  return next;
}

function idsForMode(mode: Mode, progress: ProgressMap, trackId = 0) {
  return WORDS.filter((word) => {
    if (trackId && !word.tracks.includes(trackId)) return false;
    if (mode === "essential") return word.tier === "essential";
    if (mode === "slang") return word.category === "slang";
    if (mode === "verbs") return GRAMMAR[word.term]?.kind !== "noun" && Boolean(GRAMMAR[word.term]);
    if (mode === "track") return word.tracks.includes(trackId);
    if (mode === "saved") return progress[word.term]?.favorite;
    if (mode === "learning") return progress[word.term]?.status === "learning";
    return true;
  }).map((word) => word.id);
}

function makeQueue(mode: Mode, progress: ProgressMap, trackId = 0, leadId?: number) {
  const ids = idsForMode(mode, progress, trackId);
  const fresh = ids.filter((id) => {
    const word = WORDS[id - 1];
    return progress[word.term]?.status !== "mastered";
  });
  const source = fresh.length ? fresh : ids;
  const randomized = shuffled(source);
  const corillo = WORDS.find((word) => word.term === "corillo")?.id;
  const preferred = leadId ?? (mode === "all" ? corillo : undefined);
  if (preferred && randomized.includes(preferred)) {
    return [preferred, ...randomized.filter((id) => id !== preferred)];
  }
  return randomized;
}

function Icon({ children }: { children: React.ReactNode }) {
  return <span aria-hidden="true">{children}</span>;
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("all");
  const [studyDirection, setStudyDirection] = useState<StudyDirection>("spanish-first");
  const [selectedTrackId, setSelectedTrackId] = useState(0);
  const [progress, setProgress] = useState<ProgressMap>({});
  const [reports, setReports] = useState<CardReport[]>([]);
  const [queue, setQueue] = useState<number[]>(() => makeQueue("all", {}));
  const [queueIndex, setQueueIndex] = useState(0);
  const [missedIds, setMissedIds] = useState<number[]>([]);
  const [round, setRound] = useState(1);
  const [runSize, setRunSize] = useState(DATA.uniqueWords);
  const [runComplete, setRunComplete] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sessionReviews, setSessionReviews] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [reportIndex, setReportIndex] = useState(0);
  const [reportIssue, setReportIssue] = useState<IssueKind>("translation");
  const [reportNote, setReportNote] = useState("");
  const [reportNotice, setReportNotice] = useState("");
  const [sentenceExamples, setSentenceExamples] = useState<Record<string, SentenceExample | null>>({});
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swipeChoice, setSwipeChoice] = useState<"wrong" | "right" | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const suppressFlipRef = useRef(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ProgressMap;
        const nextQueue = makeQueue("all", parsed);
        // Hydrate browser-only progress after the server-rendered first frame.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setProgress(parsed);
        setQueue(nextQueue);
        setRunSize(nextQueue.length);
      }
      const storedReports = window.localStorage.getItem(REPORTS_KEY);
      if (storedReports) {
        const parsedReports = JSON.parse(storedReports) as CardReport[];
        setReports(parsedReports.map((report) => RESOLVED_REPORT_IDS.has(report.id)
          ? { ...report, status: "resolved" }
          : report));
      }
      const storedDirection = window.localStorage.getItem(DIRECTION_KEY);
      if (storedDirection === "spanish-first" || storedDirection === "english-first") {
        setStudyDirection(storedDirection);
      }
    } catch {
      // A private browser session can block storage; practice still works.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
      // Keep the in-memory session when storage is unavailable.
    }
  }, [hydrated, progress]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
    } catch {
      // Netlify still receives deployed submissions if local storage is unavailable.
    }
  }, [hydrated, reports]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(DIRECTION_KEY, studyDirection);
    } catch {
      // Keep the preference in memory when storage is unavailable.
    }
  }, [hydrated, studyDirection]);

  useEffect(() => {
    if (!reportNotice) return;
    const timer = window.setTimeout(() => setReportNotice(""), 3600);
    return () => window.clearTimeout(timer);
  }, [reportNotice]);

  const currentWord = useMemo(() => {
    const id = queue[queueIndex];
    return id ? WORDS[id - 1] : undefined;
  }, [queue, queueIndex]);
  const currentProgress = currentWord ? progress[currentWord.term] : undefined;
  const currentGrammar = currentWord ? GRAMMAR[currentWord.term] : undefined;
  const currentMeaning = currentGrammar?.gloss ?? currentWord?.meaning ?? "";

  useEffect(() => {
    if (!currentWord || curatedSentencePair(currentWord.term)) return;
    if (Object.prototype.hasOwnProperty.call(sentenceExamples, currentWord.term)) return;

    const term = currentWord.term;
    const controller = new AbortController();
    const params = new URLSearchParams({
      lang: "spa",
      q: `=${term}`,
      "trans:lang": "eng",
      sort: "relevance",
      limit: "8",
    });

    fetch(`https://api.tatoeba.org/v1/sentences?${params.toString()}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Sentence lookup failed");
        return response.json() as Promise<{ data: TatoebaSentence[] }>;
      })
      .then(({ data }) => {
        const candidates = data
          .filter((sentence) => !sentence.is_unapproved)
          .flatMap((sentence) => sentence.translations
            .filter((translation) => translation.lang === "eng" && !translation.is_unapproved)
            .map((translation) => ({ sentence, translation })))
          .filter(({ translation }) => translation.text.length >= 6 && translation.text.length <= 150)
          .sort((left, right) => Number(right.translation.is_direct) - Number(left.translation.is_direct)
            || left.translation.text.length - right.translation.text.length);
        const match = candidates[0];
        const example = match
          ? {
              spanish: match.sentence.text,
              english: match.translation.text,
              sourceSentenceId: match.sentence.id,
              sourceOwner: match.sentence.owner ?? "Tatoeba contributor",
              sourceLicense: match.sentence.license,
              translationOwner: match.translation.owner ?? "Tatoeba contributor",
              translationLicense: match.translation.license,
            }
          : null;
        setSentenceExamples((previous) => ({ ...previous, [term]: example }));
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSentenceExamples((previous) => ({ ...previous, [term]: null }));
      });

    return () => controller.abort();
  }, [currentWord, sentenceExamples]);

  const counts = useMemo(() => {
    let mastered = 0;
    let learning = 0;
    let saved = 0;
    Object.values(progress).forEach((entry) => {
      if (entry.status === "mastered") mastered += 1;
      if (entry.status === "learning") learning += 1;
      if (entry.favorite) saved += 1;
    });
    return { mastered, learning, saved };
  }, [progress]);

  const completion = Math.round((counts.mastered / DATA.uniqueWords) * 100);
  const openReports = useMemo(() => reports.filter((report) => report.status === "open"), [reports]);
  const currentOpenReport = currentWord
    ? openReports.find((report) => report.wordId === currentWord.id)
    : undefined;
  const activeReport = openReports.length
    ? openReports[Math.min(reportIndex, openReports.length - 1)]
    : undefined;

  const relatedTracks = useMemo(() => {
    if (!currentWord) return [];
    return currentWord.tracks
      .map((trackId) => DATA.tracks[trackId - 1])
      .filter(Boolean);
  }, [currentWord]);

  const modeWordIds = useMemo(
    () => new Set(idsForMode(mode, progress, selectedTrackId)),
    [mode, progress, selectedTrackId],
  );

  const browseWords = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("es");
    return WORDS.filter((word) => {
      const matchesMode = modeWordIds.has(word.id);
      if (!matchesMode) return false;
      if (!needle) return true;
      const grammar = GRAMMAR[word.term];
      return word.term.includes(needle)
        || word.meaning.toLocaleLowerCase("en").includes(needle)
        || grammar?.gloss?.toLocaleLowerCase("en").includes(needle)
        || grammar?.lemma?.toLocaleLowerCase("es").includes(needle);
    });
  }, [modeWordIds, search]);

  const selectMode = useCallback((nextMode: Mode) => {
    if (nextMode === "track" && !selectedTrackId) return;
    const nextQueue = makeQueue(nextMode, progress, selectedTrackId);
    setMode(nextMode);
    setQueue(nextQueue);
    setQueueIndex(0);
    setMissedIds([]);
    setRound(1);
    setRunSize(nextQueue.length);
    setRunComplete(false);
    setSessionReviews(0);
    setFlipped(false);
  }, [progress, selectedTrackId]);

  const selectTrack = useCallback((trackId: number) => {
    const nextMode: Mode = trackId ? "track" : "all";
    const nextQueue = makeQueue(nextMode, progress, trackId);
    setSelectedTrackId(trackId);
    setMode(nextMode);
    setQueue(nextQueue);
    setQueueIndex(0);
    setMissedIds([]);
    setRound(1);
    setRunSize(nextQueue.length);
    setRunComplete(false);
    setSessionReviews(0);
    setFlipped(false);
  }, [progress]);

  const restartRun = useCallback(() => {
    const nextQueue = makeQueue(mode, progress, selectedTrackId);
    setQueue(nextQueue);
    setQueueIndex(0);
    setMissedIds([]);
    setRound(1);
    setRunSize(nextQueue.length);
    setRunComplete(false);
    setSessionReviews(0);
    setFlipped(false);
  }, [mode, progress, selectedTrackId]);

  const answerWord = useCallback((isRight: boolean) => {
    if (!currentWord) return;
    swipeStartRef.current = null;
    setSwipeOffset(0);
    setSwipeChoice(null);
    setProgress((previous) => {
      const entry = previous[currentWord.term] ?? { status: "new", favorite: false, reviews: 0 };
      return {
        ...previous,
        [currentWord.term]: {
          ...entry,
          status: isRight ? "mastered" : "learning",
          reviews: entry.reviews + 1,
        },
      };
    });
    setSessionReviews((value) => value + 1);

    const nextMissed = isRight || missedIds.includes(currentWord.id)
      ? missedIds
      : [...missedIds, currentWord.id];

    setFlipped(false);
    if (queueIndex < queue.length - 1) {
      setMissedIds(nextMissed);
      setQueueIndex((index) => index + 1);
      return;
    }

    if (nextMissed.length) {
      setQueue(shuffled(nextMissed));
      setQueueIndex(0);
      setMissedIds([]);
      setRound((value) => value + 1);
      return;
    }

    setMissedIds([]);
    setRunComplete(true);
  }, [currentWord, missedIds, queue.length, queueIndex]);

  const beginSwipe = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    swipeStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
    };
    suppressFlipRef.current = false;
    setSwipeOffset(0);
    setSwipeChoice(null);
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const updateSwipe = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const start = swipeStartRef.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) < 7 || Math.abs(deltaX) <= Math.abs(deltaY)) return;

    event.preventDefault();
    suppressFlipRef.current = true;
    const limitedOffset = Math.max(-SWIPE_MAX_OFFSET, Math.min(SWIPE_MAX_OFFSET, deltaX));
    setSwipeOffset(limitedOffset);
    setSwipeChoice(Math.abs(deltaX) >= SWIPE_THRESHOLD ? (deltaX > 0 ? "right" : "wrong") : null);
  }, []);

  const finishSwipe = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const start = swipeStartRef.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    const completed = Math.abs(deltaX) >= SWIPE_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY) * 1.15;

    swipeStartRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (completed) {
      suppressFlipRef.current = true;
      answerWord(deltaX > 0);
      return;
    }
    setSwipeOffset(0);
    setSwipeChoice(null);
  }, [answerWord]);

  const cancelSwipe = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (swipeStartRef.current?.pointerId !== event.pointerId) return;
    swipeStartRef.current = null;
    suppressFlipRef.current = false;
    setSwipeOffset(0);
    setSwipeChoice(null);
  }, []);

  const toggleFavorite = useCallback(() => {
    if (!currentWord) return;
    setProgress((previous) => {
      const entry = previous[currentWord.term] ?? { status: "new", favorite: false, reviews: 0 };
      return {
        ...previous,
        [currentWord.term]: { ...entry, favorite: !entry.favorite },
      };
    });
  }, [currentWord]);

  const speak = useCallback(() => {
    if (!currentWord || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(currentWord.term);
    utterance.lang = "es-PR";
    utterance.rate = 0.82;
    window.speechSynthesis.speak(utterance);
  }, [currentWord]);

  const openWord = useCallback((word: WordCard) => {
    const nextQueue = makeQueue(mode, progress, selectedTrackId, word.id);
    setQueue(nextQueue);
    setQueueIndex(0);
    setMissedIds([]);
    setRound(1);
    setRunSize(nextQueue.length);
    setRunComplete(false);
    setSessionReviews(0);
    setFlipped(false);
    setBrowseOpen(false);
  }, [mode, progress, selectedTrackId]);

  const openReportForm = useCallback(() => {
    if (!currentWord) return;
    const existing = reports.find((report) => report.wordId === currentWord.id && report.status === "open");
    setReportIssue(existing?.issue ?? "translation");
    setReportNote(existing?.note ?? "");
    setReportOpen(true);
  }, [currentWord, reports]);

  const submitReport = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentWord) return;

    const existing = reports.find((report) => report.wordId === currentWord.id && report.status === "open");
    const reportExample = curatedSentencePair(currentWord.term) ?? sentenceExamples[currentWord.term] ?? undefined;
    const baseReport: CardReport = {
      id: existing?.id ?? (window.crypto?.randomUUID?.() ?? `${Date.now()}-${currentWord.id}`),
      wordId: currentWord.id,
      term: currentWord.term,
      displayedMeaning: currentMeaning,
      exampleSpanish: reportExample?.spanish,
      exampleEnglish: reportExample?.english,
      issue: reportIssue,
      note: reportNote.trim(),
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      status: "open",
      delivery: "local",
    };

    let delivery: CardReport["delivery"] = "local";
    if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      try {
        const body = new URLSearchParams({
          "form-name": "card-report",
          "bot-field": "",
          reportId: baseReport.id,
          wordId: String(baseReport.wordId),
          term: baseReport.term,
          currentAnswer: baseReport.displayedMeaning,
          exampleSpanish: baseReport.exampleSpanish ?? "",
          exampleEnglish: baseReport.exampleEnglish ?? "",
          issue: ISSUE_LABELS[baseReport.issue],
          note: baseReport.note,
          tracks: relatedTracks.map((track) => track.title).join(" · "),
        });
        const response = await fetch("/", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body.toString(),
        });
        if (!response.ok) throw new Error("Report submission failed");
        delivery = "submitted";
      } catch {
        // Keep the report locally so it can be retried or copied for review.
      }
    }

    const nextReport = { ...baseReport, delivery };
    setReports((previous) => existing
      ? previous.map((report) => report.id === existing.id ? nextReport : report)
      : [...previous, nextReport]);
    setReportOpen(false);
    setReportNotice(delivery === "submitted" ? "Reporte enviado y guardado." : "Reporte guardado en este navegador.");
  }, [currentMeaning, currentWord, relatedTracks, reportIssue, reportNote, reports, sentenceExamples]);

  const copyReport = useCallback(async (report: CardReport) => {
    const text = [
      "Card report — Palabras de DTMF",
      `Word: ${report.term} (#${report.wordId})`,
      `Current answer: ${report.displayedMeaning}`,
      `Spanish example: ${report.exampleSpanish || "Not available"}`,
      `English example: ${report.exampleEnglish || "Not available"}`,
      `Problem: ${ISSUE_LABELS[report.issue]}`,
      `Note: ${report.note || "No additional note"}`,
    ].join("\n");
    try {
      await window.navigator.clipboard.writeText(text);
      setReportNotice("Reporte copiado. Pégalo en el chat para revisarlo.");
    } catch {
      setReportNotice("No se pudo copiar automáticamente.");
    }
  }, []);

  const resolveReport = useCallback((reportId: string) => {
    setReports((previous) => previous.map((report) => report.id === reportId
      ? { ...report, status: "resolved" }
      : report));
    setReportNotice("Reporte marcado como resuelto.");
  }, []);

  const downloadReports = useCallback(() => {
    const blob = new Blob([JSON.stringify(openReports, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "palabras-dtmf-reportes.json";
    link.click();
    URL.revokeObjectURL(url);
  }, [openReports]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || browseOpen) return;
      if (event.code === "Space") {
        event.preventDefault();
        setFlipped((value) => !value);
      } else if (event.key === "1") {
        answerWord(false);
      } else if (event.key === "2") {
        answerWord(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [answerWord, browseOpen]);

  const selectedTrack = selectedTrackId ? DATA.tracks[selectedTrackId - 1] : undefined;
  const sessionLabel = selectedTrack
    ? mode === "track"
      ? selectedTrack.title
      : `${MODE_LABELS[mode]} · ${selectedTrack.title}`
    : MODE_LABELS[mode];
  const englishFirst = studyDirection === "english-first";
  const curatedExample = currentWord ? curatedSentencePair(currentWord.term) : undefined;
  const fetchedExample = currentWord ? sentenceExamples[currentWord.term] : undefined;
  const exampleSentence = curatedExample ?? fetchedExample ?? undefined;
  const exampleLoading = Boolean(currentWord && !exampleSentence && fetchedExample !== null);
  const exampleSource = fetchedExample
    ? {
        href: `https://tatoeba.org/en/sentences/show/${fetchedExample.sourceSentenceId}`,
        label: `${fetchedExample.sourceOwner} + ${fetchedExample.translationOwner} · Tatoeba · ${fetchedExample.sourceLicense} / ${fetchedExample.translationLicense}`,
      }
    : "";
  const contextTrack = relatedTracks.find((track) => track.id === selectedTrackId) ?? relatedTracks[0];
  const geniusTrackUrl = contextTrack ? GENIUS_TRACK_URLS[contextTrack.id] : undefined;
  const frontText = englishFirst ? currentMeaning : currentWord?.term ?? "";
  const backText = englishFirst ? currentWord?.term ?? "" : currentMeaning;
  const deckPosition = queue.length ? queueIndex + 1 : 0;
  const roundCorrect = Math.max(0, queueIndex - missedIds.length);
  const roundProgress = queue.length ? Math.round((queueIndex / queue.length) * 100) : 0;

  return (
    <main className="app-shell">
      <form name="card-report" method="POST" data-netlify="true" data-netlify-honeypot="bot-field" hidden aria-hidden="true">
        <input type="hidden" name="form-name" value="card-report" />
        <input name="bot-field" />
        <input name="reportId" />
        <input name="wordId" />
        <input name="term" />
        <input name="currentAnswer" />
        <input name="exampleSpanish" />
        <input name="exampleEnglish" />
        <input name="issue" />
        <input name="note" />
        <input name="tracks" />
      </form>

      <header className="topbar">
        <a className="brand" href="#study" aria-label="Palabras home">
          <span className="brand-mark">P.</span>
          <span>PALABRAS <i>de</i> DTMF</span>
        </a>
        <div className="topbar-actions">
          <span className="dataset-pill">{DATA.uniqueWords.toLocaleString()} palabras</span>
          <button className="icon-button" type="button" onClick={() => setBrowseOpen(true)} aria-label="Browse all words">
            <Icon>⌕</Icon>
          </button>
        </div>
      </header>

      <section className="workspace" id="study">
        <aside className="sidebar" aria-label="Study deck navigation">
          <div className="sidebar-heading">
            <p className="eyebrow">TU BIBLIOTECA</p>
            <button type="button" className="text-button" onClick={() => setBrowseOpen(true)}>Ver todas</button>
          </div>

          <div className={`track-picker ${selectedTrack ? "is-active" : ""}`}>
            <label htmlFor="track-select">
              <span className="eyebrow">MAZO MÁS PEQUEÑO</span>
              <strong>Practica una canción</strong>
            </label>
            <div className="track-select-wrap">
              <select
                id="track-select"
                value={selectedTrackId}
                onChange={(event) => selectTrack(Number(event.target.value))}
              >
                <option value={0}>Todo el álbum · {DATA.uniqueWords.toLocaleString()} palabras</option>
                {DATA.tracks.map((track) => (
                  <option key={track.id} value={track.id}>
                    {track.id}. {track.title} · {TRACK_WORD_COUNTS[track.id]} palabras
                  </option>
                ))}
              </select>
              <span aria-hidden="true">⌄</span>
            </div>
            {selectedTrack && (
              <p><strong>{TRACK_WORD_COUNTS[selectedTrack.id]}</strong> palabras únicas · los mazos de abajo usan solo esta canción</p>
            )}
          </div>

          <nav className="deck-nav" aria-label="Vocabulary decks">
            {(["all", "essential", "slang", "verbs", "saved", "learning"] as Mode[]).map((item) => {
              const amount = idsForMode(item, progress, selectedTrackId).length;
              return (
                <button
                  className={`deck-link ${mode === item ? "is-active" : ""}`}
                  key={item}
                  onClick={() => selectMode(item)}
                  type="button"
                >
                  <span>{MODE_LABELS[item]}</span>
                  <span>{amount}</span>
                </button>
              );
            })}
          </nav>

          <div className="progress-panel">
            <div className="progress-ring" style={{ "--progress": `${completion * 3.6}deg` } as React.CSSProperties}>
              <span>{completion}%</span>
            </div>
            <div>
              <p className="progress-title">Tu progreso</p>
              <p>{counts.mastered} dominadas · {counts.learning} falladas recientes</p>
            </div>
          </div>

          <button
            type="button"
            className="report-queue-button"
            onClick={() => {
              setReportIndex(0);
              setReportsOpen(true);
            }}
          >
            <span><Icon>⚑</Icon> Reportes pendientes</span>
            <strong>{openReports.length}</strong>
          </button>

          <div className="source-note">
            <p className="eyebrow">HECHO PARA ESCUCHAR</p>
            <p>Datos de 17 canciones, con {VERB_WORD_COUNT} formas verbales anotadas. Contexto real enlazado; letras completas no alojadas.</p>
          </div>
        </aside>

        <div className="study-area">
          <div className="study-heading">
            <div>
              <p className="eyebrow">SESIÓN · {sessionLabel.toUpperCase()}</p>
              <h1>Escucha. Voltea. <em>Quédate con la palabra.</em></h1>
            </div>
            <div className="session-meta" aria-label="Session progress">
              <span>Ronda {round} · {sessionReviews} respuestas</span>
              <strong>{deckPosition} / {queue.length}</strong>
            </div>
          </div>

          <div className="direction-control" aria-label="Choose which language appears first">
            <span>FRENTE DE LA TARJETA</span>
            <div role="group" aria-label="Front language">
              <button
                type="button"
                className={!englishFirst ? "is-active" : ""}
                onClick={() => {
                  setStudyDirection("spanish-first");
                  setFlipped(false);
                }}
                aria-pressed={!englishFirst}
              >
                Español
              </button>
              <button
                type="button"
                className={englishFirst ? "is-active" : ""}
                onClick={() => {
                  setStudyDirection("english-first");
                  setFlipped(false);
                }}
                aria-pressed={englishFirst}
              >
                English
              </button>
            </div>
          </div>

          {!runComplete && currentWord && (
            <div className="round-status" aria-live="polite">
              <div>
                <span>Ronda {round}</span>
                <strong>{roundCorrect} correctas</strong>
              </div>
              <div className="round-progress" aria-hidden="true">
                <span style={{ width: `${roundProgress}%` }} />
              </div>
              <button
                type="button"
                className={`wrong-pile ${mode === "learning" ? "is-active" : ""}`}
                onClick={() => selectMode("learning")}
                aria-label={`Practicar ${counts.learning} falladas recientes`}
              >
                <span>Falladas recientes</span>
                <strong>{counts.learning}</strong>
              </button>
            </div>
          )}

          {runComplete ? (
            <div className="empty-deck mastery-complete">
              <span>✓</span>
              <p className="eyebrow">MAZO SUPERADO</p>
              <h2>La pila está limpia.</h2>
              <p>Terminaste {runSize.toLocaleString()} palabras en {round} {round === 1 ? "ronda" : "rondas"}. La última ronda quedó 100% correcta.</p>
              <strong>{sessionReviews.toLocaleString()} respuestas totales</strong>
              <button type="button" onClick={restartRun}>Empezar otra vez</button>
            </div>
          ) : currentWord ? (
            <>
              <div className="card-stage">
                <div className="sun-shape" aria-hidden="true" />
                <span className={`swipe-cue swipe-cue-wrong ${swipeChoice === "wrong" ? "is-active" : ""}`} aria-hidden="true">
                  ← INCORRECTA
                </span>
                <span className={`swipe-cue swipe-cue-right ${swipeChoice === "right" ? "is-active" : ""}`} aria-hidden="true">
                  CORRECTA →
                </span>
                <button
                  type="button"
                  className={`flashcard ${flipped ? "is-flipped" : ""} ${swipeOffset ? "is-swiping" : ""} ${swipeChoice ? `is-swipe-${swipeChoice}` : ""}`}
                  style={{
                    "--swipe-x": `${swipeOffset}px`,
                    "--swipe-tilt": `${swipeOffset * 0.035}deg`,
                  } as React.CSSProperties}
                  onPointerDown={beginSwipe}
                  onPointerMove={updateSwipe}
                  onPointerUp={finishSwipe}
                  onPointerCancel={cancelSwipe}
                  onClick={() => {
                    if (suppressFlipRef.current) {
                      suppressFlipRef.current = false;
                      return;
                    }
                    setFlipped((value) => !value);
                  }}
                  aria-describedby="swipe-hint"
                  aria-label={flipped
                    ? `${englishFirst ? "Spanish" : "English"}: ${backText}.${exampleSentence ? ` Spanish example: ${exampleSentence.spanish}. English: ${exampleSentence.english}.` : ""} Flip back.`
                    : `${englishFirst ? "English" : "Spanish"}: ${frontText}. Flip for the answer.`}
                  aria-pressed={flipped}
                >
                  <span className="flashcard-inner">
                    <span className="card-face card-front">
                      <span className="card-topline">
                        <span>{englishFirst ? "ENGLISH" : "ESPAÑOL"}</span>
                        {!englishFirst && (
                          <span>{currentGrammar?.kind === "verb" || currentGrammar?.kind === "mixed"
                            ? "FORMA VERBAL"
                            : currentGrammar?.kind === "noun"
                              ? "SUSTANTIVO"
                              : currentWord.category === "slang"
                                ? "PR + JERGA"
                                : currentWord.tier.replace("-", " ").toUpperCase()}</span>
                        )}
                      </span>
                      <span className={`term ${englishFirst ? "is-english-prompt" : ""}`}>{frontText}</span>
                      <span className="flip-hint"><Icon>↻</Icon> toca para revelar</span>
                    </span>
                    <span className="card-face card-back">
                      <span className="card-topline">
                        <span>{englishFirst ? "ESPAÑOL" : "ENGLISH"}</span>
                        <span>{englishFirst ? "WORD + CONTEXT" : currentGrammar ? "GRAMMAR CHECKED" : currentWord.source === "curated" ? "CURATED" : "TRANSLATION"}</span>
                      </span>
                      <span className={`meaning has-context ${currentGrammar ? "has-grammar" : ""} ${englishFirst ? "is-spanish-answer" : ""}`}>{backText}</span>
                      <span className="usage-context">
                        <span>EN UNA ORACIÓN · SPANISH → ENGLISH</span>
                        {exampleSentence ? (
                          <>
                            <strong lang="es">{exampleSentence.spanish}</strong>
                            <small lang="en">{exampleSentence.english}</small>
                          </>
                        ) : (
                          <small className="example-status">
                            {exampleLoading ? "Buscando una oración revisada…" : "Esta oración necesita revisión."}
                          </small>
                        )}
                      </span>
                      {currentGrammar && (
                        <span className={`grammar-panel is-${currentGrammar.kind}`}>
                          <span className="grammar-kicker">{currentGrammar.kind === "noun" ? "ALBUM USAGE" : "VERB FORM"}</span>
                          {currentGrammar.lemma && <strong>{currentGrammar.lemma}</strong>}
                          <span>{currentGrammar.form}</span>
                          {currentGrammar.alsoUsedAs && <small>Also appears as {currentGrammar.alsoUsedAs}.</small>}
                          {currentGrammar.note && <small>{currentGrammar.note}</small>}
                        </span>
                      )}
                      <span className="flip-hint"><Icon>↻</Icon> toca para volver</span>
                    </span>
                  </span>
                </button>

                <button className="round-action listen-action" type="button" onClick={speak} aria-label={`Hear ${currentWord.term} pronounced`}>
                  <Icon>◖))</Icon>
                </button>
                <button
                  className={`round-action save-action ${currentProgress?.favorite ? "is-saved" : ""}`}
                  type="button"
                  onClick={toggleFavorite}
                  aria-label={currentProgress?.favorite ? "Remove from saved words" : "Save this word"}
                  aria-pressed={Boolean(currentProgress?.favorite)}
                >
                  <Icon>{currentProgress?.favorite ? "★" : "☆"}</Icon>
                </button>
                <button
                  className={`round-action report-action ${currentOpenReport ? "is-reported" : ""}`}
                  type="button"
                  onClick={openReportForm}
                  aria-label={currentOpenReport ? `Edit report for ${currentWord.term}` : `Report a problem with ${currentWord.term}`}
                  aria-pressed={Boolean(currentOpenReport)}
                >
                  <Icon>!</Icon>
                </button>
              </div>

              <div className="word-context">
                <div>
                  <span className="context-number">{currentWord.count}×</span>
                  <span>aparece en {currentWord.tracks.length} {currentWord.tracks.length === 1 ? "canción" : "canciones"}</span>
                </div>
                <p>
                  {relatedTracks.slice(0, 3).map((track) => track.title).join(" · ")}
                  {relatedTracks.length > 3 ? ` · +${relatedTracks.length - 3}` : ""}
                </p>
              </div>

              <div className="source-links">
                {geniusTrackUrl && contextTrack && (
                  <a className="lyrics-link" href={geniusTrackUrl} target="_blank" rel="noreferrer noopener nofollow">
                    <span>CONTEXTO REAL</span>
                    <strong>Ver cómo aparece en {contextTrack.title}</strong>
                    <small>Genius ↗</small>
                  </a>
                )}
                {exampleSource && (
                  <a className="example-credit" href={exampleSource.href} target="_blank" rel="noreferrer">
                    Ejemplo por {exampleSource.label}
                  </a>
                )}
              </div>

              <div className="rating-row" aria-label="Mark this answer wrong or right">
                <button type="button" className="wrong-button" onClick={() => answerWord(false)}>
                  <span>1</span><strong>Incorrecta</strong><small>Añadir a la pila de falladas</small>
                </button>
                <button type="button" className="right-button" onClick={() => answerWord(true)}>
                  <span>2</span><strong>Correcta</strong><small>Quitar de esta ronda</small>
                </button>
              </div>
              <p className="keyboard-hint" id="swipe-hint">
                <span className="touch-hint">Desliza ← incorrecta · correcta → · toca para voltear</span>
                <span className="desktop-hint">Espacio para voltear · 1 incorrecta · 2 correcta</span>
              </p>
            </>
          ) : (
            <div className="empty-deck">
              <span>{mode === "learning" ? "✓" : "✦"}</span>
              <h2>{mode === "learning" ? "Falladas en cero." : "Este mazo está vacío."}</h2>
              <p>{mode === "learning"
                ? "No te queda ninguna palabra fallada. Cada error nuevo aparecerá aquí automáticamente."
                : "Guarda palabras o marca algunas como difíciles para verlas aquí."}</p>
              <button type="button" onClick={() => selectMode("all")}>Practicar todas</button>
            </div>
          )}
        </div>
      </section>

      <section className="album-strip" aria-label="About this deck">
        <div>
          <p className="eyebrow">EL ÁLBUM, EN PALABRAS</p>
          <h2>{DATA.totalTokens.toLocaleString()} apariciones.<br /><em>{DATA.uniqueWords.toLocaleString()} palabras únicas.</em></h2>
        </div>
        <div className="album-facts">
          <div><strong>17</strong><span>canciones</span></div>
          <div><strong>{WORDS.filter((word) => word.tier === "essential").length}</strong><span>esenciales</span></div>
          <div><strong>{WORDS.filter((word) => word.category === "slang").length}</strong><span>jerga curada</span></div>
        </div>
        <p className="disclaimer">Proyecto educativo independiente. No afiliado con Bad Bunny ni Rimas Entertainment. Vocabulario derivado con LRCLIB; traducciones automáticas revisadas para jerga clave.</p>
      </section>

      {browseOpen && (
        <div className="browse-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.currentTarget === event.target) setBrowseOpen(false);
        }}>
          <section className="browse-sheet" role="dialog" aria-modal="true" aria-labelledby="browse-title">
            <div className="browse-header">
              <div>
                <p className="eyebrow">DICCIONARIO DEL ÁLBUM</p>
                <h2 id="browse-title">Todas las palabras</h2>
              </div>
              <button className="close-button" type="button" onClick={() => setBrowseOpen(false)} aria-label="Close word browser">×</button>
            </div>
            <label className="search-box">
              <span aria-hidden="true">⌕</span>
              <span className="sr-only">Search Spanish or English</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Busca en español o inglés…" autoFocus />
            </label>
            <div className="browse-toolbar">
              <div className="mode-chips">
                {(["all", "essential", "slang", "verbs", ...(selectedTrackId ? ["track" as const] : []), "saved", "learning"] as Mode[]).map((item) => (
                  <button key={item} type="button" className={mode === item ? "is-active" : ""} onClick={() => selectMode(item)}>{MODE_LABELS[item]}</button>
                ))}
              </div>
              <span>{browseWords.length.toLocaleString()} resultados</span>
            </div>
            <div className="word-table" role="list">
              {browseWords.map((word) => (
                <button key={word.id} type="button" className="word-row" onClick={() => openWord(word)} role="listitem">
                  <span className="word-index">{String(word.id).padStart(4, "0")}</span>
                  <strong>{word.term}</strong>
                  <span>{GRAMMAR[word.term]?.gloss ?? word.meaning}</span>
                  <small>{word.count}×</small>
                </button>
              ))}
              {!browseWords.length && <p className="no-results">No encontramos esa palabra.</p>}
            </div>
          </section>
        </div>
      )}

      {reportOpen && currentWord && (
        <div className="report-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.currentTarget === event.target) setReportOpen(false);
        }}>
          <section className="report-dialog" role="dialog" aria-modal="true" aria-labelledby="report-title">
            <div className="report-header">
              <div>
                <p className="eyebrow">CONTROL DE CALIDAD</p>
                <h2 id="report-title">Reportar esta tarjeta</h2>
              </div>
              <button className="close-button" type="button" onClick={() => setReportOpen(false)} aria-label="Close report form">×</button>
            </div>

            <div className="reported-card">
              <strong>{currentWord.term}</strong>
              <span>→</span>
              <p>{currentMeaning}</p>
            </div>

            <form name="card-report-visible" method="POST" onSubmit={submitReport}>
              <input type="hidden" name="form-name" value="card-report" />
              <input type="hidden" name="reportId" value={currentOpenReport?.id ?? ""} />
              <input type="hidden" name="wordId" value={currentWord.id} />
              <input type="hidden" name="term" value={currentWord.term} />
              <input type="hidden" name="currentAnswer" value={currentMeaning} />
              <input type="hidden" name="exampleSpanish" value={exampleSentence?.spanish ?? ""} />
              <input type="hidden" name="exampleEnglish" value={exampleSentence?.english ?? ""} />
              <input type="hidden" name="issue" value={ISSUE_LABELS[reportIssue]} />
              <input type="hidden" name="tracks" value={relatedTracks.map((track) => track.title).join(" · ")} />
              <p className="netlify-honeypot">
                <label>Leave this empty: <input name="bot-field" tabIndex={-1} autoComplete="off" /></label>
              </p>

              <fieldset className="issue-fieldset">
                <legend>¿Qué está mal?</legend>
                <div className="issue-options">
                  {(Object.entries(ISSUE_LABELS) as [IssueKind, string][]).map(([value, label]) => (
                    <button
                      type="button"
                      key={value}
                      className={reportIssue === value ? "is-selected" : ""}
                      onClick={() => setReportIssue(value)}
                      aria-pressed={reportIssue === value}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <label className="report-note">
                <span>¿Cómo debería decir?</span>
                <textarea
                  name="note"
                  value={reportNote}
                  onChange={(event) => setReportNote(event.target.value)}
                  placeholder="Ej.: fotito debería incluir ‘little photo’ y el matiz cariñoso…"
                  rows={4}
                />
              </label>

              <div className="report-form-actions">
                <button type="button" onClick={() => setReportOpen(false)}>Cancelar</button>
                <button type="submit">{currentOpenReport ? "Actualizar reporte" : "Guardar reporte"}</button>
              </div>
            </form>
            <p className="report-delivery-note">En Netlify se enviará a Forms. También guardamos una copia local para revisarla aquí.</p>
          </section>
        </div>
      )}

      {reportsOpen && (
        <div className="report-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.currentTarget === event.target) setReportsOpen(false);
        }}>
          <section className="report-dialog report-queue-dialog" role="dialog" aria-modal="true" aria-labelledby="report-queue-title">
            <div className="report-header">
              <div>
                <p className="eyebrow">REVISIÓN UNO POR UNO</p>
                <h2 id="report-queue-title">Reportes pendientes</h2>
              </div>
              <button className="close-button" type="button" onClick={() => setReportsOpen(false)} aria-label="Close report queue">×</button>
            </div>

            {activeReport ? (
              <>
                <p className="report-counter">Reporte {Math.min(reportIndex + 1, openReports.length)} de {openReports.length}</p>
                <article className="report-review-card">
                  <div>
                    <span>PALABRA #{activeReport.wordId}</span>
                    <strong>{activeReport.term}</strong>
                    <p>{activeReport.displayedMeaning}</p>
                    {activeReport.exampleSpanish && <p lang="es">{activeReport.exampleSpanish}</p>}
                    {activeReport.exampleEnglish && <p lang="en">{activeReport.exampleEnglish}</p>}
                  </div>
                  <dl>
                    <div><dt>Problema</dt><dd>{ISSUE_LABELS[activeReport.issue]}</dd></div>
                    <div><dt>Tu nota</dt><dd>{activeReport.note || "Sin nota adicional"}</dd></div>
                    <div><dt>Entrega</dt><dd>{activeReport.delivery === "submitted" ? "Enviado a Netlify" : "Copia local"}</dd></div>
                  </dl>
                </article>

                <div className="report-pager">
                  <button type="button" onClick={() => setReportIndex((index) => Math.max(0, index - 1))} disabled={reportIndex === 0}>← Anterior</button>
                  <button type="button" onClick={() => setReportIndex((index) => Math.min(openReports.length - 1, index + 1))} disabled={reportIndex >= openReports.length - 1}>Siguiente →</button>
                </div>
                <div className="report-review-actions">
                  <button type="button" onClick={() => copyReport(activeReport)}>Copiar para Codex</button>
                  <button type="button" onClick={() => resolveReport(activeReport.id)}>Marcar resuelto</button>
                </div>
              </>
            ) : (
              <div className="no-report-state">
                <span>✓</span>
                <h3>No hay reportes pendientes.</h3>
                <p>Usa el botón <strong>!</strong> de cualquier tarjeta cuando algo no se vea bien.</p>
              </div>
            )}

            <div className="report-queue-footer">
              <p>Los reportes locales permanecen en este navegador.</p>
              <button type="button" onClick={downloadReports} disabled={!openReports.length}>Descargar todos (.json)</button>
            </div>
          </section>
        </div>
      )}

      {reportNotice && <div className="report-toast" role="status">{reportNotice}</div>}
    </main>
  );
}
