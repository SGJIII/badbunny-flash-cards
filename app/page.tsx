"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  issue: IssueKind;
  note: string;
  createdAt: string;
  status: "open" | "resolved";
  delivery: "local" | "submitted";
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
  learning: "Aprendiendo",
};

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

function englishUsageContext(
  word: WordCard,
  grammar: GrammarEntry | undefined,
  trackTitle: string | undefined,
) {
  const where = trackTitle ? `In “${trackTitle},”` : "On the album,";
  const meaning = grammar?.gloss ?? word.meaning;
  const form = grammar?.form.replaceAll(" · ", ", ");

  if (word.term === "fotito") {
    return `${where} “fotito” is a diminutive of foto: literally “little photo,” often with an affectionate “cute little photo” tone.`;
  }
  if (grammar?.kind === "verb") {
    return `${where} “${word.term}” is the ${form} form${grammar.lemma ? ` of ${grammar.lemma}` : ""}; here it means “${meaning}.”`;
  }
  if (grammar?.kind === "noun") {
    return `${where} “${word.term}” functions as a ${form} and means “${meaning}.”`;
  }
  if (grammar?.kind === "mixed") {
    return `${where} “${word.term}” is used as ${form}; in this context it means “${meaning}.”`;
  }
  if (word.category === "slang") {
    return `${where} “${word.term}” is Puerto Rican or Caribbean slang meaning “${meaning}.”`;
  }
  return `${where} “${word.term}” carries the sense “${meaning}.”`;
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
        setReports(JSON.parse(storedReports) as CardReport[]);
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
    const baseReport: CardReport = {
      id: existing?.id ?? (window.crypto?.randomUUID?.() ?? `${Date.now()}-${currentWord.id}`),
      wordId: currentWord.id,
      term: currentWord.term,
      displayedMeaning: currentMeaning,
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
  }, [currentMeaning, currentWord, relatedTracks, reportIssue, reportNote, reports]);

  const copyReport = useCallback(async (report: CardReport) => {
    const text = [
      "Card report — Palabras de DTMF",
      `Word: ${report.term} (#${report.wordId})`,
      `Current answer: ${report.displayedMeaning}`,
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
  const contextTrack = selectedTrack && currentWord?.tracks.includes(selectedTrack.id)
    ? selectedTrack
    : relatedTracks[0];
  const usageContext = currentWord
    ? englishUsageContext(currentWord, currentGrammar, contextTrack?.title)
    : "";
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
              <p>{counts.mastered} dominadas · {counts.learning} en práctica</p>
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
            <p>Datos de 17 canciones, con {VERB_WORD_COUNT} formas verbales anotadas. Letras completas no incluidas.</p>
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
              <div className="wrong-pile">
                <span>Pila de falladas</span>
                <strong>{missedIds.length}</strong>
              </div>
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
                <button
                  type="button"
                  className={`flashcard ${flipped ? "is-flipped" : ""}`}
                  onClick={() => setFlipped((value) => !value)}
                  aria-label={flipped
                    ? `${englishFirst ? "Spanish" : "English"}: ${backText}. ${usageContext}. Flip back.`
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
                        <span>HOW IT’S USED · PARAPHRASED</span>
                        <small>{usageContext}</small>
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

              <div className="rating-row" aria-label="Mark this answer wrong or right">
                <button type="button" className="wrong-button" onClick={() => answerWord(false)}>
                  <span>1</span><strong>Incorrecta</strong><small>Añadir a la pila de falladas</small>
                </button>
                <button type="button" className="right-button" onClick={() => answerWord(true)}>
                  <span>2</span><strong>Correcta</strong><small>Quitar de esta ronda</small>
                </button>
              </div>
              <p className="keyboard-hint">Espacio para voltear · 1 incorrecta · 2 correcta</p>
            </>
          ) : (
            <div className="empty-deck">
              <span>✦</span>
              <h2>Este mazo está vacío.</h2>
              <p>Guarda palabras o marca algunas como difíciles para verlas aquí.</p>
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
