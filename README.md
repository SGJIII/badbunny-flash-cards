# Palabras de DTMF

[![CI](https://github.com/SGJIII/badbunny-flash-cards/actions/workflows/ci.yml/badge.svg)](https://github.com/SGJIII/badbunny-flash-cards/actions/workflows/ci.yml)

A local-first Spanish flashcard site built from the deduplicated vocabulary in Bad Bunny’s **DeBÍ TiRAR MáS FOToS**.

## What’s included

- 1,482 unique words derived from all 17 tracks
- English meanings, with a curated Puerto Rican slang glossary
- 485 album-context grammar notes covering verb lemmas, person, mood, tense, and colloquial forms
- all-words, essentials, slang, verb, saved, and learning decks
- a one-song-at-a-time picker that builds a smaller deduplicated deck for any of the 17 tracks
- per-card problem reports with a one-by-one review queue, local backup, JSON export, and Netlify Forms delivery
- wrong/right mastery rounds that recycle missed words until you finish a clean round
- card flipping, keyboard shortcuts, pronunciation, search, and word-frequency context
- Spanish-first or English-first cards, with hand-written song-style English examples for core vocabulary and exact-word examples from Tatoeba for long-tail words
- progress saved in the visitor’s browser; no account or database required
- a static Netlify-ready build

The repository contains the vocabulary dataset, grammar annotations, and word counts—not the full lyrics. Album vocabulary is derived from [LRCLIB](https://lrclib.net/); machine translations were generated with [MyMemory](https://mymemory.translated.net/), grammar was cross-checked with open-source Spanish morphology and conjugation tools, and key Puerto Rican or ambiguous forms were reviewed manually. Long-tail practice sentences are fetched from [Tatoeba](https://tatoeba.org/) with per-sentence contributor and license attribution.

## Run locally

Requires Node.js 22 and pnpm.

```bash
pnpm install
pnpm dev
```

## Verify

```bash
pnpm test
pnpm lint
```

## Deploy to Netlify

Push the repository to GitHub and import it in Netlify. The included `netlify.toml` sets the build command and static output folder automatically.

GitHub Actions runs a locked install, lint, production build, and rendered-app tests for every pull request and every push to `main`. Netlify’s Git integration provides continuous deployment from the passing `main` branch.

In Netlify, open **Forms**, enable form detection, and redeploy once. Card reports will then appear under the `card-report` form; reports also retain a device-local copy that can be reviewed or exported from the site.

Set `NEXT_PUBLIC_SITE_URL` in Netlify to the final `https://…netlify.app` or custom-domain URL so social preview tags use the production origin.

## Refresh the vocabulary

The generated dataset is committed at `app/data/vocabulary.json`. To rebuild it from the source catalog:

```bash
node scripts/build-vocabulary.mjs
```

The script reuses cached meanings, fetches current lyric records into memory, saves only deduplicated word-level data, and never writes full lyrics to the repository.

This is an independent educational project and is not affiliated with Bad Bunny or Rimas Entertainment.
