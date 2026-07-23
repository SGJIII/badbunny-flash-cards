import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const html = await readFile(new URL("../out/index.html", import.meta.url), "utf8");
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}

test("server-renders the finished study experience", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Palabras de DTMF/);
  assert.match(html, /Escucha\. Voltea\./);
  assert.match(html, /1,482 palabras/);
  assert.match(html, /Ver todas/);
  assert.match(html, /corillo/);
  assert.match(html, /Incorrecta/);
  assert.match(html, /Correcta/);
  assert.match(html, /Pila de falladas/);
  assert.match(html, /Verbos/);
  assert.match(html, /Practica una canción/);
  assert.match(html, /NUEVAYoL/);
  assert.match(html, /Reportes pendientes/);
  assert.match(html, /FRENTE DE LA TARJETA/);
  assert.match(html, /English/);
  assert.match(html, /EN UNA ORACIÓN · SPANISH → ENGLISH/);
  assert.match(html, /Mi corillo está afuera; vámonos\./);
  assert.match(html, /My crew is waiting outside, so let’s go\./);
  assert.match(html, /Ver cómo aparece en[\s\S]*VOY A LLeVARTE PA PR/);
  assert.match(html, /https:\/\/genius\.com\/Bad-bunny-voy-a-llevarte-pa-pr-lyrics/);
  assert.match(html, /name="card-report"/);
  assert.match(html, /data-netlify="true"/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});

test("ships a complete, deduplicated vocabulary-only dataset", async () => {
  const [raw, grammarRaw] = await Promise.all([
    readFile(new URL("../app/data/vocabulary.json", import.meta.url), "utf8"),
    readFile(new URL("../app/data/grammar.json", import.meta.url), "utf8"),
  ]);
  const data = JSON.parse(raw);
  const grammar = JSON.parse(grammarRaw);
  const terms = data.words.map((word) => word.term);

  assert.equal(data.tracks.length, 17);
  assert.equal(data.uniqueWords, 1482);
  assert.equal(data.words.length, data.uniqueWords);
  assert.equal(new Set(terms).size, terms.length);
  assert.ok(data.totalTokens > data.uniqueWords);
  assert.ok(data.words.every((word) => word.meaning && word.count > 0));
  assert.ok(data.words.every((word) => word.tracks.every((track) => track >= 1 && track <= 17)));
  assert.ok(data.tracks.every((track) => !("lyrics" in track) && !("plainLyrics" in track)));
  assert.ok(data.tracks.every((track) => data.words.some((word) => word.tracks.includes(track.id))));
  assert.ok(grammar.annotatedWords >= 450);
  assert.equal(grammar.entries.bailo.gloss, "I dance");
  assert.equal(grammar.entries.bailo.lemma, "bailar");
  assert.equal(grammar.entries.baile.form, "masculine noun");
  assert.equal(grammar.entries.bailando.form, "gerund");
  assert.equal(data.words.find((word) => word.term === "fotito").meaning, "little photo / cute little photo");
  assert.equal(data.words.find((word) => word.term === "perfumito").meaning, "little perfume / perfume scent");

  const reportedFixes = {
    "he": "I have (auxiliary)",
    "da": "he/she/you gives; give (command)",
    "hacía": "I/he/she/you used to do / make",
    "dio": "he/she/you gave",
    "prendan": "turn on / light up (you all)",
    "tiré": "I threw / took (a photo)",
    "valgan": "may be worth / be worthwhile (they)",
  };
  for (const [term, meaning] of Object.entries(reportedFixes)) {
    const word = data.words.find((entry) => entry.term === term);
    assert.equal(word?.meaning, meaning, `${term} should use the reviewed translation`);
    assert.equal(word?.source, "curated", `${term} should be marked as curated`);
    assert.equal(grammar.entries[term]?.gloss, meaning, `${term} grammar should match the card`);
  }
  assert.equal(grammar.entries.prendan.lemma, "prender");
  assert.match(grammar.entries.prendan.form, /affirmative command/);
  assert.equal(grammar.entries["hacía"].form, "yo/él/ella/usted · imperfect");
  assert.match(grammar.entries.da.form, /affirmative command/);
});

test("removes the disposable starter and includes Netlify and small-phone output config", async () => {
  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)));
  const [packageJson, netlify, page, css, layout, robotsSource, robotsOutput] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../netlify.toml", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/robots.ts", import.meta.url), "utf8"),
    readFile(new URL("../out/robots.txt", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(packageJson, /react-loading-skeleton|vinext|wrangler|cloudflare/i);
  assert.match(packageJson, /"build": "next build"/);
  assert.match(netlify, /publish = "out"/);
  assert.match(page, /localStorage/);
  assert.match(page, /SpeechSynthesisUtterance/);
  assert.match(page, /answerWord/);
  assert.match(page, /nextMissed/);
  assert.match(page, /runComplete/);
  assert.match(page, /word\.tracks\.includes\(trackId\)/);
  assert.match(page, /selectTrack/);
  assert.match(page, /submitReport/);
  assert.match(page, /Copiar para Codex/);
  assert.match(page, /palabras-dtmf-reports-v1/);
  assert.match(page, /if \(trackId && !word\.tracks\.includes\(trackId\)\) return false/);
  assert.match(page, /idsForMode\(item, progress, selectedTrackId\)\.length/);
  assert.match(page, /Todo el álbum/);
  assert.match(page, /english-first/);
  assert.match(page, /EN UNA ORACIÓN · SPANISH → ENGLISH/);
  assert.match(page, /curatedSentencePair/);
  assert.match(page, /spanish: match\.sentence\.text/);
  assert.match(page, /english: match\.translation\.text/);
  assert.match(page, /name="exampleSpanish"/);
  assert.match(page, /name="exampleEnglish"/);
  assert.match(page, /api\.tatoeba\.org\/v1\/sentences/);
  assert.match(page, /q: `=\$\{term\}`/);
  assert.match(page, /GENIUS_TRACK_URLS/);
  assert.equal((page.match(/https:\/\/genius\.com\/Bad-bunny/g) ?? []).length, 17);
  assert.match(page, /Ver cómo aparece en/);
  assert.match(page, /Ejemplo por/);
  assert.match(page, /I dance whenever that song comes on\./);
  assert.match(page, /That dance is one I’ll never forget\./);
  assert.match(page, /She sent me a cute little photo before the party\./);
  assert.match(page, /Yo bailo cada vez que ponen esa canción\./);
  assert.match(page, /Ese baile es uno que nunca voy a olvidar\./);
  assert.match(page, /Ella me mandó una fotito antes de la fiesta\./);
  assert.match(page, /He guardado las fotos de aquel verano\./);
  assert.match(page, /Prendan las luces cuando llegue el corillo\./);
  assert.match(page, /Tiré muchas fotos en la fiesta\./);
  assert.match(page, /Quiero recuerdos que valgan la pena\./);
  assert.match(page, /RESOLVED_REPORT_IDS/);
  assert.match(page, /2f07a036-f222-4e97-bc5b-c437d5985cd5/);
  assert.match(page, /097c1508-235a-457d-afd1-00b078e3f1bb/);
  assert.doesNotMatch(page, /HOW IT’S USED · PARAPHRASED|here it means|carries the sense/);
  assert.doesNotMatch(page, /englishExampleSentence|The phrase “/);
  assert.match(layout, /index: false/);
  assert.match(layout, /follow: false/);
  assert.match(layout, /viewportFit: "cover"/);
  assert.match(robotsSource, /disallow: "\/"/);
  assert.match(robotsOutput, /Disallow: \//);
  assert.match(netlify, /X-Robots-Tag = "noindex, nofollow, noarchive, nosnippet, noimageindex"/);
  assert.match(css, /iPhone 13 mini/);
  assert.match(css, /@media \(max-width: 430px\)/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /min-height: 100dvh/);
  assert.match(css, /position: sticky/);
  assert.match(css, /\.lyrics-link/);
});
