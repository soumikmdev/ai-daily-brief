# ai-daily-brief

`ai-daily-brief` is a clean-start repository for a daily AI news product that combines three surfaces:

- a daily podcast generated from top AI news
- a website-hosted newsletter edition of the same daily brief
- model launch pages comparing new releases from major LLM labs, including benchmark and score summaries

## Initial repository shape

```text
apps/
  web/              Website and newsletter UI
  api/              Backend APIs for content, models, and publishing
jobs/
  daily-digest/     Scheduled ingestion, ranking, summarization, and podcast generation
packages/
  shared/           Shared types, schemas, prompt templates, and utilities
docs/               Product and technical docs
scripts/            Local automation scripts
```

## Planned delivery flow

1. Ingest daily AI news from curated sources.
2. Rank and deduplicate stories.
3. Generate a structured brief.
4. Produce audio narration for the podcast.
5. Publish the newsletter and episode metadata to the website.
6. Detect notable model launches and publish comparison pages with benchmark snapshots.

## What this first commit includes

- monorepo-friendly folder structure
- root workspace metadata
- environment variable template
- starter docs for each major area

## What comes next

- choose the frontend stack for `apps/web`
- choose the backend/runtime for `apps/api`
- define the daily job orchestration and storage model
- wire benchmark/model data sources for comparison pages
