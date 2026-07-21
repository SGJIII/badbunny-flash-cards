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
});

test("removes the disposable starter and includes Netlify output config", async () => {
  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)));
  const [packageJson, netlify, page] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../netlify.toml", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
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
  assert.match(page, /HOW IT’S USED · PARAPHRASED/);
  assert.match(page, /englishUsageContext/);
});
