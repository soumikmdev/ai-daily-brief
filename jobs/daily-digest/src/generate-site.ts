/**
 * generate-site.ts — Runs both the daily digest and model tracker,
 * then produces a self-contained static HTML page at docs/index.html
 * suitable for GitHub Pages hosting.
 */

import Parser from "rss-parser";
import { readFileSync } from "fs";
import { join as pathJoin } from "path";

// ═══════════════════════════════════════════════════════════════════════
// NEWS DIGEST
// ═══════════════════════════════════════════════════════════════════════

const RSS_FEEDS = [
  { name: "MIT Technology Review", url: "https://www.technologyreview.com/topic/artificial-intelligence/feed" },
  { name: "The Verge",            url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml" },
  { name: "Ars Technica",         url: "https://feeds.arstechnica.com/arstechnica/features" },
  { name: "VentureBeat",          url: "https://venturebeat.com/category/ai/feed/" },
  { name: "TechCrunch",           url: "https://techcrunch.com/category/artificial-intelligence/feed/" },
  { name: "Google AI Blog",       url: "https://blog.google/technology/ai/rss/" },
  { name: "OpenAI Blog",          url: "https://openai.com/blog/rss.xml" },
  { name: "Hugging Face Blog",    url: "https://huggingface.co/blog/feed.xml" },
];

interface Story {
  title: string;
  link: string;
  source: string;
  published: Date;
  snippet: string;
}

function isAIRelevant(title: string): boolean {
  const kw = [
    "ai","artificial intelligence","llm","gpt","claude","gemini","mistral",
    "llama","copilot","chatgpt","openai","anthropic","deepmind","machine learning",
    "neural","transformer","diffusion","deep learning","language model",
    "foundation model","benchmark","reasoning","agi","multimodal","fine-tun",
    "rlhf","token",
  ];
  const l = title.toLowerCase();
  return kw.some((k) => l.includes(k));
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

async function fetchStories(): Promise<Story[]> {
  const parser = new Parser({ timeout: 10_000 });

  // 1. Fetch RSS feeds
  const results = await Promise.allSettled(
    RSS_FEEDS.map(async (f) => {
      try {
        const feed = await parser.parseURL(f.url);
        return (feed.items ?? []).map((item) => ({
          title: (item.title ?? "").trim(),
          link: item.link ?? "",
          source: f.name,
          published: item.pubDate ? new Date(item.pubDate) : new Date(),
          snippet: (item.contentSnippet ?? item.content ?? "").slice(0, 200).trim(),
        }));
      } catch { return []; }
    }),
  );

  let all: Story[] = [];
  for (const r of results) if (r.status === "fulfilled") all.push(...r.value);

  // 2. Merge curated stories from web search
  try {
    const curatedPath = pathJoin(__dirname, "curated-news.json");
    const curatedRaw = readFileSync(curatedPath, "utf-8");
    const curated: { title: string; link: string; source: string; snippet: string; published: string }[] = JSON.parse(curatedRaw);
    for (const c of curated) {
      all.push({
        title: c.title,
        link: c.link,
        source: c.source + " 🔍",
        published: new Date(c.published),
        snippet: c.snippet,
      });
    }
    console.log(`  ✓ Merged ${curated.length} curated web-search stories`);
  } catch (e: any) {
    console.log(`  ⚠ No curated news found (${e.message})`);
  }

  const cutoff = new Date(Date.now() - 14 * 24 * 3_600_000); // 14 days for web-search stories
  let stories = all.filter((s) => s.published >= cutoff).filter((s) => isAIRelevant(s.title));
  stories = dedup(stories);
  stories.sort((a, b) => {
    const diff = recencyScore(b) - recencyScore(a);
    return diff !== 0 ? diff : b.published.getTime() - a.published.getTime();
  });
  return stories.slice(0, 20);
}

// ═══════════════════════════════════════════════════════════════════════
// MODEL DATA
// ═══════════════════════════════════════════════════════════════════════

interface Model {
  name: string; lab: string; released: string; contextWindow: string;
  modalities: string[]; openWeight: boolean;
  scores: Record<string, number | string>; notes: string;
}

const MODELS: Model[] = [
  { name:"GPT-5.4", lab:"OpenAI", released:"2026-03", contextWindow:"1M", modalities:["text","image","audio"], openWeight:false, scores:{MMLU:93.8,HumanEval:97.2,MATH:97.1,"GDPval":83.0,"SWE-Bench Pro":57.7,OSWorld:75.0}, notes:"Flagship model, 33% fewer factual errors, tool search" },
  { name:"GPT-4.1", lab:"OpenAI", released:"2025-04", contextWindow:"1M", modalities:["text","image"], openWeight:false, scores:{MMLU:90.2,HumanEval:93.4,MATH:82.1,SWE_bench:54.6,"Arena ELO":1350}, notes:"1M context, strong coding" },
  { name:"o3", lab:"OpenAI", released:"2025-04", contextWindow:"200K", modalities:["text","image"], openWeight:false, scores:{MMLU:92.1,HumanEval:96.7,MATH:96.7,"GPQA-Diamond":87.7,"ARC-AGI":87.5,SWE_bench:69.1}, notes:"Reasoning model with extended thinking" },
  { name:"Claude Opus 4.6", lab:"Anthropic", released:"2026-02", contextWindow:"200K", modalities:["text","image"], openWeight:false, scores:{MMLU:92.5,HumanEval:96.1,MATH:85.2,SWE_bench:82.1,"GPQA-Diamond":76.4}, notes:"Max Effort mode, Agent Teams orchestration" },
  { name:"Claude Sonnet 4.6", lab:"Anthropic", released:"2026-02", contextWindow:"200K", modalities:["text","image"], openWeight:false, scores:{MMLU:91.2,HumanEval:94.8,MATH:83.1,SWE_bench:75.3,"GPQA-Diamond":70.2}, notes:"Adaptive reasoning, agentic code CLI" },
  { name:"Claude Opus 4", lab:"Anthropic", released:"2025-06", contextWindow:"200K", modalities:["text","image"], openWeight:false, scores:{MMLU:91.4,HumanEval:95.1,MATH:83.6,SWE_bench:79.4,"GPQA-Diamond":74.8,"TAU-bench":67.9}, notes:"Previous Anthropic flagship" },
  { name:"Gemini 3.1 Pro", lab:"Google DeepMind", released:"2026-02", contextWindow:"2M", modalities:["text","image","audio","video"], openWeight:false, scores:{MMLU:93.6,HumanEval:96.8,MATH:91.2,"GPQA-Diamond":72.5,"Arena ELO":1420}, notes:"2M context, Deep Think mode, ties GPT-5.4" },
  { name:"Gemini 2.5 Pro", lab:"Google DeepMind", released:"2025-03", contextWindow:"1M", modalities:["text","image","audio","video"], openWeight:false, scores:{MMLU:90.8,HumanEval:93.2,MATH:86.4,"GPQA-Diamond":67.1,SWE_bench:63.8,"Arena ELO":1402}, notes:"1M native, thinking model" },
  { name:"Gemini 2.5 Flash", lab:"Google DeepMind", released:"2025-04", contextWindow:"1M", modalities:["text","image","audio","video"], openWeight:false, scores:{MMLU:88.1,HumanEval:90.8,MATH:82.3,SWE_bench:49.2,"Arena ELO":1361}, notes:"Fast + cost-efficient thinking model" },
  { name:"DeepSeek V3.2", lab:"DeepSeek", released:"2026-03", contextWindow:"1M", modalities:["text"], openWeight:true, scores:{MMLU:91.5,HumanEval:93.8,MATH:97.8,"GPQA-Diamond":73.2}, notes:"GPT-4 class at $0.28/M tokens, open-weight" },
  { name:"DeepSeek-R1", lab:"DeepSeek", released:"2025-01", contextWindow:"128K", modalities:["text"], openWeight:true, scores:{MMLU:90.8,HumanEval:92.1,MATH:97.3,"GPQA-Diamond":71.5,"AIME 2024":79.8}, notes:"Open-weight reasoning, MIT license" },
  { name:"Grok-4", lab:"xAI", released:"2026-02", contextWindow:"256K", modalities:["text","image"], openWeight:false, scores:{MMLU:92.0,HumanEval:94.1,MATH:94.8,"GPQA-Diamond":71.0,"Arena ELO":1395}, notes:"Real-time knowledge, $20B funding round" },
  { name:"Llama 4 Maverick", lab:"Meta", released:"2025-04", contextWindow:"1M", modalities:["text","image"], openWeight:true, scores:{MMLU:89.2,HumanEval:90.5,MATH:77.4,"Arena ELO":1340}, notes:"MoE, 128 experts, open-weight" },
  { name:"Qwen 3.5 Small", lab:"Alibaba", released:"2026-03", contextWindow:"128K", modalities:["text"], openWeight:true, scores:{MMLU:88.4,HumanEval:89.7,MATH:84.2}, notes:"0.8B–9B params, on-device, open-source" },
  { name:"Qwen3-235B-A22B", lab:"Alibaba", released:"2025-04", contextWindow:"128K", modalities:["text"], openWeight:true, scores:{MMLU:89.5,HumanEval:90.3,MATH:85.7,"GPQA-Diamond":65.8,"Arena ELO":1380}, notes:"MoE, 22B active params, Apache 2.0" },
  { name:"Nemotron 3 Super", lab:"Nvidia", released:"2026-02", contextWindow:"128K", modalities:["text"], openWeight:true, scores:{MMLU:90.1,HumanEval:91.5,MATH:82.6}, notes:"Open-source 120B, Nvidia optimized" },
  { name:"Mistral Large 2", lab:"Mistral", released:"2024-11", contextWindow:"128K", modalities:["text"], openWeight:true, scores:{MMLU:84.0,HumanEval:89.1,MATH:69.1,"Arena ELO":1187}, notes:"Open-weight 123B params" },
];

const BENCHMARKS = ["MMLU","HumanEval","MATH","GPQA-Diamond","SWE_bench","Arena ELO"];

function getLeaders() {
  return BENCHMARKS.map((b) => {
    const c = MODELS.filter((m) => typeof m.scores[b] === "number");
    c.sort((a, d) => (d.scores[b] as number) - (a.scores[b] as number));
    return { benchmark: b, model: c[0]?.name ?? "—", lab: c[0]?.lab ?? "", score: c[0]?.scores[b] ?? "—" };
  });
}

// ═══════════════════════════════════════════════════════════════════════
// HTML GENERATION
// ═══════════════════════════════════════════════════════════════════════

function esc(s: string): string {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function timeAgo(d: Date): string {
  const h = hoursAgo(d);
  if (h < 1) return "just now";
  if (h < 24) return `${Math.round(h)}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function buildHTML(stories: Story[]): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { weekday:"long", year:"numeric", month:"long", day:"numeric" });
  const leaders = getLeaders();
  const recent = [...MODELS].filter((m) => m.released.startsWith("2025")).sort((a, b) => b.released.localeCompare(a.released));
  const openModels = MODELS.filter((m) => m.openWeight);

  const newsCards = stories.map((s) => `
    <article class="card">
      <div class="card-meta"><span class="source">${esc(s.source)}</span><span class="time">${timeAgo(s.published)}</span></div>
      <h3><a href="${esc(s.link)}" target="_blank" rel="noopener">${esc(s.title)}</a></h3>
      ${s.snippet ? `<p class="snippet">${esc(s.snippet.slice(0, 150))}…</p>` : ""}
    </article>`).join("\n");

  const modelRows = MODELS.map((m) => `
    <tr>
      <td><strong>${esc(m.name)}</strong></td>
      <td>${esc(m.lab)}</td>
      <td>${m.released}</td>
      <td>${m.contextWindow}</td>
      <td>${m.modalities.join(", ")}</td>
      <td class="center">${m.openWeight ? "✅" : "—"}</td>
    </tr>`).join("\n");

  const benchRows = MODELS.map((m) => {
    const cells = BENCHMARKS.map((b) => {
      const v = m.scores[b];
      const leader = leaders.find((l) => l.benchmark === b);
      const isBest = leader && leader.model === m.name;
      return `<td class="${isBest ? "best" : ""}">${v !== undefined ? v : "—"}</td>`;
    }).join("");
    return `<tr><td><strong>${esc(m.name)}</strong></td>${cells}</tr>`;
  }).join("\n");

  const leaderCards = leaders.map((l) => `
    <div class="leader-card">
      <div class="leader-bench">${esc(l.benchmark.replace("_", " "))}</div>
      <div class="leader-model">${esc(l.model)}</div>
      <div class="leader-score">${l.score}</div>
      <div class="leader-lab">${esc(l.lab)}</div>
    </div>`).join("\n");

  const recentList = recent.map((m) => `
    <div class="launch-item">
      <span class="launch-date">${m.released}</span>
      <span class="launch-name">${esc(m.name)}</span>
      <span class="launch-lab">${esc(m.lab)}</span>
      <span class="launch-note">${esc(m.notes)}</span>
    </div>`).join("\n");

  const openList = openModels.map((m) => {
    const topScores = Object.entries(m.scores).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(" · ");
    return `
    <div class="open-card">
      <h4>${esc(m.name)} <span class="open-lab">${esc(m.lab)}</span></h4>
      <p>${esc(m.notes)}</p>
      <p class="open-scores">${topScores}</p>
    </div>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AI Daily Brief — ${dateStr}</title>
<style>
  :root {
    --bg: #0d1117; --surface: #161b22; --border: #30363d;
    --text: #e6edf3; --muted: #8b949e; --accent: #58a6ff;
    --green: #3fb950; --purple: #bc8cff; --orange: #f0883e;
    --gold: #d29922;
  }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:var(--bg); color:var(--text); font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif; line-height:1.6; }

  .container { max-width:1200px; margin:0 auto; padding:0 24px; }

  header { background:linear-gradient(135deg, #1a1f2e 0%, #0d1117 100%); border-bottom:1px solid var(--border); padding:40px 0; text-align:center; }
  header h1 { font-size:2.5rem; margin-bottom:8px; background:linear-gradient(90deg, var(--accent), var(--purple)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
  header .date { color:var(--muted); font-size:1.1rem; }
  header .tagline { color:var(--muted); font-size:0.95rem; margin-top:4px; }

  nav { background:var(--surface); border-bottom:1px solid var(--border); position:sticky; top:0; z-index:10; }
  nav .container { display:flex; gap:24px; padding:12px 24px; overflow-x:auto; }
  nav a { color:var(--muted); text-decoration:none; font-weight:500; white-space:nowrap; padding:4px 0; border-bottom:2px solid transparent; transition:all .2s; }
  nav a:hover, nav a.active { color:var(--accent); border-bottom-color:var(--accent); }

  section { padding:48px 0; border-bottom:1px solid var(--border); }
  section:last-child { border-bottom:none; }
  h2 { font-size:1.75rem; margin-bottom:24px; display:flex; align-items:center; gap:12px; }
  h2 .icon { font-size:1.5rem; }

  /* News cards */
  .news-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(340px, 1fr)); gap:16px; }
  .card { background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:20px; transition:border-color .2s; }
  .card:hover { border-color:var(--accent); }
  .card-meta { display:flex; justify-content:space-between; margin-bottom:8px; font-size:0.85rem; }
  .source { color:var(--accent); font-weight:600; }
  .time { color:var(--muted); }
  .card h3 { font-size:1rem; margin-bottom:8px; line-height:1.4; }
  .card h3 a { color:var(--text); text-decoration:none; }
  .card h3 a:hover { color:var(--accent); }
  .snippet { color:var(--muted); font-size:0.85rem; }

  /* Tables */
  .table-wrap { overflow-x:auto; border-radius:12px; border:1px solid var(--border); }
  table { width:100%; border-collapse:collapse; font-size:0.9rem; }
  th { background:var(--surface); color:var(--accent); text-align:left; padding:12px 16px; font-weight:600; position:sticky; top:0; white-space:nowrap; }
  td { padding:10px 16px; border-top:1px solid var(--border); white-space:nowrap; }
  tr:hover td { background:rgba(88,166,255,0.04); }
  .center { text-align:center; }
  .best { color:var(--green); font-weight:700; }

  /* Leaders */
  .leader-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(170px, 1fr)); gap:16px; }
  .leader-card { background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:20px; text-align:center; }
  .leader-bench { color:var(--muted); font-size:0.8rem; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px; }
  .leader-model { font-weight:700; font-size:1.05rem; color:var(--text); }
  .leader-score { font-size:1.8rem; font-weight:800; background:linear-gradient(135deg, var(--gold), var(--orange)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; margin:4px 0; }
  .leader-lab { color:var(--muted); font-size:0.85rem; }

  /* Launches */
  .launch-item { display:grid; grid-template-columns:90px 180px 140px 1fr; gap:12px; padding:10px 0; border-bottom:1px solid var(--border); align-items:center; font-size:0.9rem; }
  .launch-item:last-child { border-bottom:none; }
  .launch-date { color:var(--accent); font-family:monospace; font-weight:600; }
  .launch-name { font-weight:700; }
  .launch-lab { color:var(--muted); }
  .launch-note { color:var(--muted); font-size:0.85rem; }

  /* Open weight */
  .open-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:16px; }
  .open-card { background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:20px; }
  .open-card h4 { margin-bottom:8px; }
  .open-lab { color:var(--muted); font-weight:400; font-size:0.85rem; }
  .open-card p { color:var(--muted); font-size:0.9rem; margin-bottom:4px; }
  .open-scores { font-family:monospace; color:var(--green); font-size:0.85rem !important; }

  footer { text-align:center; padding:32px 0; color:var(--muted); font-size:0.85rem; border-top:1px solid var(--border); }
  footer a { color:var(--accent); text-decoration:none; }

  @media (max-width:700px) {
    header h1 { font-size:1.6rem; }
    .news-grid { grid-template-columns:1fr; }
    .launch-item { grid-template-columns:1fr; gap:2px; }
    .leader-grid { grid-template-columns:repeat(2, 1fr); }
  }
</style>
</head>
<body>

<header>
  <div class="container">
    <h1>🤖 AI Daily Brief</h1>
    <div class="date">${dateStr}</div>
    <div class="tagline">Top AI news &amp; frontier model tracking — powered by RSS feeds + web search</div>
  </div>
</header>

<nav>
  <div class="container">
    <a href="#news">📰 Today's News</a>
    <a href="#leaders">🏆 Leaders</a>
    <a href="#models">📊 Models</a>
    <a href="#benchmarks">📈 Benchmarks</a>
    <a href="#launches">🚀 Launches</a>
    <a href="#open">🔓 Open Weight</a>
  </div>
</nav>

<main class="container">

  <section id="news">
    <h2><span class="icon">📰</span> Today's Top AI Stories</h2>
    <div class="news-grid">
      ${newsCards}
    </div>
  </section>

  <section id="leaders">
    <h2><span class="icon">🏆</span> Benchmark Leaders</h2>
    <div class="leader-grid">
      ${leaderCards}
    </div>
  </section>

  <section id="models">
    <h2><span class="icon">📊</span> Model Overview</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Model</th><th>Lab</th><th>Released</th><th>Context</th><th>Modalities</th><th class="center">Open</th></tr></thead>
        <tbody>${modelRows}</tbody>
      </table>
    </div>
  </section>

  <section id="benchmarks">
    <h2><span class="icon">📈</span> Benchmark Scores</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Model</th>${BENCHMARKS.map((b) => `<th>${esc(b.replace("_"," "))}</th>`).join("")}</tr></thead>
        <tbody>${benchRows}</tbody>
      </table>
    </div>
  </section>

  <section id="launches">
    <h2><span class="icon">🚀</span> Recent Launches (2025)</h2>
    ${recentList}
  </section>

  <section id="open">
    <h2><span class="icon">🔓</span> Open-Weight Models</h2>
    <div class="open-grid">
      ${openList}
    </div>
  </section>

</main>

<footer>
  <p>Generated on ${now.toISOString()} · <a href="https://github.com/soumikmaji_microsoft/ai-daily-brief">Source on GitHub</a></p>
  <p>Data from RSS feeds &amp; public benchmarks. Scores are approximate and may vary by evaluation methodology.</p>
</footer>

</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

async function main() {
  console.log("⏳ Fetching AI news from RSS feeds…");
  const stories = await fetchStories();
  console.log(`  ✓ ${stories.length} stories collected\n`);

  console.log("🔧 Generating static site…");
  const html = buildHTML(stories);

  const outDir = join(process.cwd(), "docs");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "index.html");
  writeFileSync(outPath, html, "utf-8");

  console.log(`  ✓ Written to ${outPath}`);
  console.log(`  ✓ File size: ${(html.length / 1024).toFixed(1)} KB\n`);
  console.log("🚀 To preview locally: open docs/index.html in a browser");
  console.log("🌐 To publish: enable GitHub Pages → Source: main branch, /docs folder");
}

main().catch(console.error);
