# ai-daily-brief

`ai-daily-brief` is a daily AI news product that combines three surfaces:

- 📰 **Daily Brief** — top AI news aggregated from 8+ RSS feeds, deduplicated and ranked
- 🎙️ **Podcast** — audio narration of the daily brief (planned)
- 📊 **Model Tracker** — frontier LLM comparison with benchmark scores across MMLU, HumanEval, MATH, GPQA-Diamond, SWE-bench, and Arena ELO

## Quick start

```bash
# Prerequisites: Node.js >= 20

# 1. Clone the repository
git clone https://github.com/soumikmaji_microsoft/ai-daily-brief.git
cd ai-daily-brief

# 2. Install dependencies
npm install

# 3. Run the daily AI news digest
npx tsx jobs/daily-digest/src/index.ts

# 4. Run the LLM model comparison tracker
npx tsx jobs/daily-digest/src/model-tracker.ts
```

## What each script does

### Daily News Digest (`jobs/daily-digest/src/index.ts`)

Fetches live RSS feeds from 8 sources, filters for AI-relevant stories from the last 48 hours, deduplicates, ranks by recency, and prints the top 15.

**Sources:** MIT Technology Review, The Verge, Ars Technica, VentureBeat, TechCrunch, Google AI Blog, OpenAI Blog, Hugging Face Blog

### Model Tracker (`jobs/daily-digest/src/model-tracker.ts`)

Compares 12 frontier LLMs across 6 major benchmarks and outputs:

- **Model overview** — lab, release date, context window, modalities, open-weight status
- **Benchmark scores** — side-by-side comparison table
- **Category leaders** — best model per benchmark
- **Open-weight spotlight** — highlights of freely available models
- **Recent launches** — chronological list of 2025 releases

## Repository structure

```text
apps/
  web/              Website and newsletter UI (planned)
  api/              Backend APIs for content, models, and publishing (planned)
jobs/
  daily-digest/     News ingestion, ranking, and model tracking (working)
packages/
  shared/           Shared types, schemas, prompt templates, and utilities
docs/               Product and technical docs
scripts/            Local automation scripts
```

## Delivery flow

1. Ingest daily AI news from curated RSS feeds.
2. Rank and deduplicate stories.
3. Generate a structured brief.
4. Produce audio narration for the podcast.
5. Publish the newsletter and episode metadata to the website.
6. Detect notable model launches and publish comparison pages with benchmark snapshots.

## What comes next

- [ ] Website frontend (`apps/web`) to host the newsletter and model comparison pages
- [ ] Backend API (`apps/api`) for content retrieval and publishing
- [ ] Text-to-speech integration for podcast audio generation
- [ ] Scheduled daily automation (cron / GitHub Actions)
- [ ] Live benchmark enrichment from LMSYS Arena and Hugging Face leaderboards
