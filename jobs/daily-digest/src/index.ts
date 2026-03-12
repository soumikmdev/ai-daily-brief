import Parser from "rss-parser";

const RSS_FEEDS = [
  { name: "MIT Technology Review – AI", url: "https://www.technologyreview.com/topic/artificial-intelligence/feed" },
  { name: "The Verge – AI",            url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml" },
  { name: "Ars Technica – AI",         url: "https://feeds.arstechnica.com/arstechnica/features" },
  { name: "VentureBeat – AI",          url: "https://venturebeat.com/category/ai/feed/" },
  { name: "TechCrunch – AI",           url: "https://techcrunch.com/category/artificial-intelligence/feed/" },
  { name: "Google AI Blog",            url: "https://blog.google/technology/ai/rss/" },
  { name: "OpenAI Blog",               url: "https://openai.com/blog/rss.xml" },
  { name: "Hugging Face Blog",         url: "https://huggingface.co/blog/feed.xml" },
];

interface Story {
  title: string;
  link: string;
  source: string;
  published: Date;
  snippet: string;
}

// ── helpers ──────────────────────────────────────────────────────────

function isAIRelevant(title: string): boolean {
  const keywords = [
    "ai", "artificial intelligence", "llm", "gpt", "claude", "gemini",
    "mistral", "llama", "copilot", "chatgpt", "openai", "anthropic",
    "deepmind", "machine learning", "neural", "transformer", "diffusion",
    "deep learning", "language model", "foundation model", "benchmark",
    "reasoning", "agi", "multimodal", "fine-tun", "rlhf", "token",
  ];
  const lower = title.toLowerCase();
  return keywords.some((k) => lower.includes(k));
}

function dedup(stories: Story[]): Story[] {
  const seen = new Map<string, Story>();
  for (const s of stories) {
    const key = s.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 60);
    if (!seen.has(key)) seen.set(key, s);
  }
  return [...seen.values()];
}

function hoursAgo(d: Date): number {
  return (Date.now() - d.getTime()) / 3_600_000;
}

function recencyScore(s: Story): number {
  const h = hoursAgo(s.published);
  if (h < 6) return 3;
  if (h < 12) return 2;
  if (h < 24) return 1;
  return 0;
}

// ── fetch ────────────────────────────────────────────────────────────

async function fetchFeed(
  parser: Parser,
  name: string,
  url: string,
): Promise<Story[]> {
  try {
    const feed = await parser.parseURL(url);
    return (feed.items ?? []).map((item) => ({
      title: (item.title ?? "").trim(),
      link: item.link ?? "",
      source: name,
      published: item.pubDate ? new Date(item.pubDate) : new Date(),
      snippet: (item.contentSnippet ?? item.content ?? "").slice(0, 200).trim(),
    }));
  } catch (err: any) {
    console.error(`  ⚠ ${name}: ${err.message}`);
    return [];
  }
}

// ── main ─────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  AI DAILY BRIEF  –  " + new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  }));
  console.log("═══════════════════════════════════════════════════════════\n");

  const parser = new Parser({ timeout: 10_000 });

  // Fetch all feeds concurrently
  console.log("📡 Fetching feeds…");
  const results = await Promise.allSettled(
    RSS_FEEDS.map((f) => fetchFeed(parser, f.name, f.url)),
  );

  let allStories: Story[] = [];
  let feedsOk = 0;
  for (const r of results) {
    if (r.status === "fulfilled") {
      allStories.push(...r.value);
      if (r.value.length > 0) feedsOk++;
    }
  }
  console.log(`  ✓ ${feedsOk}/${RSS_FEEDS.length} feeds returned stories (${allStories.length} total items)\n`);

  // Filter to last 48 h and AI-relevant
  const cutoff = new Date(Date.now() - 48 * 3_600_000);
  let stories = allStories
    .filter((s) => s.published >= cutoff)
    .filter((s) => isAIRelevant(s.title));

  stories = dedup(stories);

  // Rank: recency + source diversity bonus
  stories.sort((a, b) => {
    const diff = recencyScore(b) - recencyScore(a);
    if (diff !== 0) return diff;
    return b.published.getTime() - a.published.getTime();
  });

  const top = stories.slice(0, 15);

  if (top.length === 0) {
    console.log("  No AI-relevant stories found in the last 48 hours.\n");
    console.log("  (This can happen if feeds are geo-blocked or rate-limited.)");
    return;
  }

  // Print the brief
  console.log(`📰 TOP ${top.length} AI STORIES\n`);
  top.forEach((s, i) => {
    const age = hoursAgo(s.published);
    const ageStr = age < 1 ? "<1 h ago" : `${Math.round(age)}h ago`;
    console.log(`  ${String(i + 1).padStart(2)}. [${s.source}]  ${ageStr}`);
    console.log(`      ${s.title}`);
    if (s.snippet) console.log(`      ${s.snippet.slice(0, 120)}…`);
    console.log(`      🔗 ${s.link}\n`);
  });

  // Summary stats
  const sourceCounts = new Map<string, number>();
  for (const s of top) sourceCounts.set(s.source, (sourceCounts.get(s.source) ?? 0) + 1);
  console.log("───────────────────────────────────────────────────────────");
  console.log("  Sources represented:", [...sourceCounts.entries()].map(([k, v]) => `${k} (${v})`).join(", "));
  console.log("  Stories after dedup:", stories.length);
  console.log("  Showing top:", top.length);
  console.log("═══════════════════════════════════════════════════════════\n");
}

main().catch(console.error);
