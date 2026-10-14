#!/usr/bin/env node

/**
 * RTP Relational Tech MCP Server
 *
 * An MCP server that carries relational tech principles, patterns, and the
 * shared commons library to any AI builder tool. Built by the Relational
 * Tech Project.
 *
 * Data source: the RTP shared commons (commons_items table on the RTP main
 * site Supabase project). Methodology docs, frameworks, recipes, references,
 * tools, stories, and prompts all live in one queryable table.
 *
 * Supports two transport modes:
 *   - stdio (default): For local use with Claude Code, Cursor, etc.
 *   - http:  For hosted deployment. Set RTP_MCP_TRANSPORT=http
 *
 * "We are a river, carrying stories, tools, learning, and relationships
 * across many local gardens, while honoring that each garden must be tended
 * by those who live there."
 */

import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Commons API Configuration
// ---------------------------------------------------------------------------

const COMMONS_URL =
  process.env.RTP_COMMONS_URL ??
  "https://odowkowcinyoxejyzhwl.supabase.co/rest/v1";

const COMMONS_ANON_KEY =
  process.env.RTP_COMMONS_ANON_KEY ??
  // Anon key for the RTP main site Supabase project (odowkowcinyoxejyzhwl).
  // Anon keys are public by design — security comes from Postgres RLS policies.
  // Override via env if the project is ever rotated.
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kb3drb3djaW55b3hlanl6aHdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2OTE5MzksImV4cCI6MjA3MDI2NzkzOX0.2Y2Dw66ORJ5DyBA11H5ziNFtdH1dG9BcOmFWYSicTSc";

async function commonsFetch(path: string): Promise<unknown> {
  const res = await fetch(`${COMMONS_URL}${path}`, {
    headers: {
      apikey: COMMONS_ANON_KEY,
      Authorization: `Bearer ${COMMONS_ANON_KEY}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Commons API error: ${res.status} ${res.statusText} — ${path}`);
  }
  return res.json();
}

async function commonsRpc(fn: string, body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${COMMONS_URL}/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: COMMONS_ANON_KEY,
      Authorization: `Bearer ${COMMONS_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Commons RPC error: ${res.status} ${res.statusText} — ${fn}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Hybrid search — semantic + full-text via the search-commons edge function.
// The function embeds the query with the same model used for item embeddings
// (google/gemini-embedding-001) and merges vector + text results. Returns
// null on any failure so callers can fall back to the full-text RPC.
// ---------------------------------------------------------------------------

const COMMONS_FUNCTIONS_URL =
  process.env.RTP_COMMONS_FUNCTIONS_URL ??
  "https://odowkowcinyoxejyzhwl.supabase.co/functions/v1";

type SearchHit = Partial<CommonsItem> & { similarity?: number; rank?: number; match?: string };

async function searchCommonsHybrid(
  query: string,
  filterKinds: string[] | null,
  count: number
): Promise<SearchHit[] | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${COMMONS_FUNCTIONS_URL}/search-commons`, {
      method: "POST",
      headers: {
        apikey: COMMONS_ANON_KEY,
        Authorization: `Bearer ${COMMONS_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, match_count: count, kinds: filterKinds }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = (await res.json()) as { results?: SearchHit[] };
    return Array.isArray(json.results) ? json.results : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Contribution Nudges & Templates
// ---------------------------------------------------------------------------

const STUDIO_CONTRIBUTE_URL = "https://studio.relationaltechproject.org/library";

const CONTRIBUTION_NUDGE_PATTERNS = `\n\n---\n\n## The Commons Grows When You Share\n\nIf you build something from these patterns — or discover something that works in your neighborhood — the commons gets richer when you share it back. You can contribute a tool, story, or community note at ${STUDIO_CONTRIBUTE_URL}\n\nYour AI tool can also help you draft a contribution: just say **"I'd like to contribute what I'm building back to the commons"** and it will walk you through it.`;

const CONTRIBUTION_NUDGE_STORIES = `\n\n---\n\n## Got a Story?\n\nEvery story above started as one builder trying something in their neighborhood. If you're building something — or have already — your experience could help the next builder in the next neighborhood. Contribute at ${STUDIO_CONTRIBUTE_URL} or ask your AI: **"Help me share my story with the commons."**`;

const CONTRIBUTION_NUDGE_TOOL = `\n\n---\n\n## Remixed This Tool?\n\nIf you adapt this for your neighborhood, the commons would love to know what you changed and why. Contribute at ${STUDIO_CONTRIBUTE_URL} or ask your AI: **"Help me contribute my remix back to the commons."**`;

const CONTRIBUTION_TEMPLATES: Record<string, string> = {
  tool: `# Contributing a Tool to the Commons

Thanks for wanting to share what you've built! Here's what would help other builders learn from your work.

## What the Commons Needs

Help the builder share these pieces (in conversation, not as a form):

1. **Tool name** — What do you call it? (Can be a working title)
2. **One-line description** — What does it do, in plain language?
3. **The neighborhood context** — Where was this built? What was the need that sparked it?
4. **How it works** — What does a neighbor experience when they use it? Walk through the flow.
5. **What you'd tell another builder** — If someone in a different neighborhood wanted to build something similar, what would you want them to know? What surprised you? What would you do differently?
6. **Category** — Which fits best: Connection & Stories, Events & Gatherings, Resource Sharing, Communication, Neighborhood Sites, Civic Organizations, Mutual Aid, or Community Funding?
7. **URL** — Is it live somewhere? (Optional but helpful)
8. **Your name and neighborhood** — How should we credit you?

## How to Submit

Once the pieces are gathered, show the builder the final draft and ask if they'd like it sent to the commons stewards. On their yes, call the **submit-contribution** tool — no account needed; a human steward reviews every submission before it joins the commons. Builders who prefer the web can still contribute at ${STUDIO_CONTRIBUTE_URL}.

## Reminders for the AI

- Draw this out conversationally — don't dump all questions at once
- The builder's voice matters more than polish. Capture how *they* describe it.
- If the builder has a prompt they used to build it, that's gold — include it
- "What would you tell another builder" is the most important question`,

  story: `# Contributing a Builder Story to the Commons

The commons's stories are its heartbeat — real accounts of what happened when someone tried something in their neighborhood.

## What Makes a Good Story

Help the builder share their experience naturally. The best stories include:

1. **The starting condition** — What was the neighborhood like? What did you notice or feel?
2. **The spark** — What made you decide to do something about it?
3. **What you actually did** — Not the theory, the reality. What happened first? Then what?
4. **The surprises** — What worked that you didn't expect? What didn't work?
5. **The relationships** — How did this change how you relate to your neighbors? How do they relate to each other?
6. **What you'd say to someone starting** — Your honest advice.
7. **Your name and place** — How should we credit you?

## Story Length

Stories range from a short paragraph to a full narrative. Both are valuable. Let the builder decide what feels right.

## How to Submit

When the story feels ready, read it back to the builder and ask if they'd like it shared with the commons stewards. On their yes, call the **submit-contribution** tool — a human steward reviews it before it joins the commons. The web option remains at ${STUDIO_CONTRIBUTE_URL}.

## Reminders for the AI

- Let the builder tell it in their own voice — don't over-edit
- Ask follow-up questions that draw out specifics ("What happened next?" "How did that feel?")
- The best stories are honest about what didn't work, not just what did
- Short is fine. A 3-sentence story that captures something real is better than a polished essay`,

  community_note: `# Adding a Community Note to a Commons Item

Community notes are practical wisdom from builders who've used a tool or tried a practice — tips, gotchas, adaptations, and encouragement.

## What Makes a Good Community Note

1. **Which item** — What existing tool, story, or recipe are you adding a note to?
2. **Your experience** — How did you use it? What neighborhood? What context?
3. **The note itself** — What would you want another builder to know? Tips, warnings, adaptations, encouragement.
4. **Your name** — For credit (first name and neighborhood is enough)

## Example Community Notes

- "We used the Neighborhood Calendar prompt in a rural town of 800 people. The biggest adaptation: we added a 'rides needed/offered' field to every event since not everyone drives. — Maria, Greenfield MA"
- "If you're building the Connector Site for a neighborhood with lots of non-English speakers, start the groups directory in multiple languages from day one. Retrofitting is much harder. — Kenji, Japantown SF"

## How to Submit

Once the note is drafted and the builder confirms, call the **submit-contribution** tool with contribution_type "community_note" and related_item_slug set to the item it belongs to (find the slug via search-studio-library). Stewards attach approved notes to the item. The web option remains at ${STUDIO_CONTRIBUTE_URL}.`,

  unsure: `# Contributing to the Commons

Not sure what kind of contribution fits? Here's a quick guide:

- **Built a tool or remixed one?** → Share it as a Tool contribution
- **Have a story about what happened in your neighborhood?** → Share it as a Builder Story
- **Used an existing item and have advice?** → Add a Community Note
- **Documented a neighborhood practice that isn't in the commons yet?** → That's a Recipe — share it!

Ask the builder to describe what they've been working on or experiencing, and help them figure out which type fits. It's also fine to contribute more than one thing!

Whichever type fits, gather the pieces conversationally, confirm the draft with the builder, then call the **submit-contribution** tool to send it to the steward review queue. The web option remains at ${STUDIO_CONTRIBUTE_URL}.`,
};

// ---------------------------------------------------------------------------
// Helpers — format commons_items rows as markdown
// ---------------------------------------------------------------------------

interface CommonsItem {
  id: string;
  slug: string;
  kind: string;
  title: string;
  summary: string | null;
  body: string | null;
  attribution: Record<string, unknown>;
  source_studio_slug: string | null;
  source_url: string | null;
  tags: string[];
  parent_slug: string | null;
  metadata: Record<string, unknown>;
}

function formatItem(item: Partial<CommonsItem>, opts: { includeBody?: boolean } = {}): string {
  const lines: string[] = [];
  lines.push(`### ${item.title || "Untitled"}`);
  if (item.kind) lines.push(`*${item.kind}*`);
  if (item.summary) lines.push(`\n${item.summary}`);
  if (opts.includeBody && item.body) {
    lines.push(`\n${item.body}`);
  }
  if (item.tags && item.tags.length > 0) {
    lines.push(`\n**Tags:** ${item.tags.join(", ")}`);
  }
  if (item.attribution && typeof item.attribution === "object") {
    const attr = item.attribution as Record<string, unknown>;
    const parts: string[] = [];
    if (attr.name) parts.push(String(attr.name));
    if (attr.neighborhood) parts.push(String(attr.neighborhood));
    if (parts.length > 0) lines.push(`\n— ${parts.join(", ")}`);
  }
  if (item.source_url) {
    lines.push(`\n[Source](${item.source_url})`);
  }
  if (item.source_studio_slug && item.source_studio_slug !== "rtp-canonical") {
    lines.push(`\n*Contributed by ${item.source_studio_slug}*`);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Registration Functions
// ---------------------------------------------------------------------------

// The 9 RTP methodology docs are exposed as MCP resources at stable URIs.
// Their content is now fetched live from commons_items (kind='methodology').
const METHODOLOGY_RESOURCES = [
  { name: "core-principles",           uri: "rtp://knowledge/core-principles",          slug: "rtp-core-principles", description: "RTP's foundational principles: technology accountable to people, the river metaphor, relationships first, asset-based approach, speed of trust" },
  { name: "relational-tech-practice",  uri: "rtp://knowledge/relational-tech-practice", slug: "a-relational-tech-practice", description: "The four dimensions of relational tech practice: purpose, process (embedded design), math (1:100), and path (scale deep, spread horizontal)" },
  { name: "three-layers",              uri: "rtp://knowledge/three-layers",             slug: "three-layers-of-neighborhood-infrastructure", description: "Three layers of neighborhood infrastructure (relational, information, action) with the Outer Sunset ecosystem as reference implementation" },
  { name: "builder-spectrum",          uri: "rtp://knowledge/builder-spectrum",         slug: "the-builder-spectrum", description: "The five stages of a community builder's journey: curious, experimenting, building, sustaining, scaling" },
  { name: "measurement-framework",     uri: "rtp://knowledge/measurement",              slug: "measuring-what-matters-agency-belonging-trust", description: "How to measure relational outcomes: agency, belonging, and trust" },
  { name: "embedded-design-guide",     uri: "rtp://knowledge/embedded-design",          slug: "embedded-design-a-guide-for-builders", description: "Complete guide to embedded design methodology: the inversion of traditional software development, principles, process, and common mistakes" },
  { name: "playbooks",                 uri: "rtp://knowledge/playbooks",                slug: "playbooks-for-common-builder-needs", description: "Step-by-step playbooks for common builder needs: starting communication channels, hosting gatherings, launching calendars, mutual aid pods, asset mapping" },
  { name: "challenges-guide",          uri: "rtp://knowledge/challenges",               slug: "navigating-common-challenges", description: "Guide to navigating common community building challenges: trust, burnout, scale, digital access, language barriers, conflict, momentum" },
  { name: "network-and-community",     uri: "rtp://knowledge/network",                  slug: "network-community-connections", description: "RTP network connections, adjacent movements, and guidance for builders at every stage on finding peers and community" },
];

async function fetchMethodologyBySlug(slug: string): Promise<string> {
  const rows = await commonsFetch(
    `/commons_items?select=title,body&kind=eq.methodology&slug=eq.${encodeURIComponent(slug)}`
  ) as Array<{ title: string; body: string }>;
  if (!Array.isArray(rows) || rows.length === 0) {
    return `# Not found\n\nMethodology doc "${slug}" not found in commons.`;
  }
  const { title, body } = rows[0];
  return `# ${title}\n\n${body}`;
}

function registerResources(s: McpServer) {
  for (const r of METHODOLOGY_RESOURCES) {
    s.resource(
      r.name,
      r.uri,
      { description: r.description },
      async () => {
        const text = await fetchMethodologyBySlug(r.slug);
        return { contents: [{ uri: r.uri, text, mimeType: "text/markdown" }] };
      }
    );
  }
}

function registerTools(s: McpServer) {
  // -------------------------------------------------------------------------
  // search-studio-library — search the commons (tools, stories, prompts,
  // recipes, references — everything is in one queryable table now)
  // -------------------------------------------------------------------------

  s.tool(
    "search-studio-library",
    `Search the Relational Tech commons — a unified library of tools that builders have created, stories from real neighborhoods, neighborhood recipes (block parties, mutual aid pods, etc.), and reference entries from the field.

The commons is a living, growing resource. Use this to find relevant patterns, tools, and inspiration for a builder's specific context.`,
    {
      query: z.string().optional().describe(
        "Free-text search query — semantic, so plain-language descriptions of a need work well (matches meaning, not just keywords). Leave empty to browse everything."
      ),
      kinds: z.array(z.enum(["tool", "story", "prompt", "recipe", "reference", "framework", "methodology"])).optional()
        .describe("Restrict to specific kinds of items. Defaults to tool, story, prompt, recipe."),
      category: z.enum(["all", "relational_tech", "tech_for_building"]).default("all")
        .describe("Tool category filter — kept for backward compatibility. Use tags or kinds for richer filtering."),
      limit: z.number().default(12).describe("Max results to return (max 30)"),
    },
    async ({ query, kinds, category, limit }) => {
      const cap = Math.min(Math.max(limit ?? 12, 1), 30);
      const filterKinds = kinds && kinds.length > 0
        ? kinds
        : ["tool", "story", "prompt", "recipe"];

      try {
        let items: Array<Partial<CommonsItem> & { rank?: number }> = [];

        if (query && query.trim().length > 0) {
          // Hybrid semantic + full-text search; falls back to the FTS RPC
          // if the search-commons edge function is unreachable
          const hybrid = await searchCommonsHybrid(query, filterKinds, cap);
          if (hybrid) {
            items = hybrid;
          } else {
            const rpcResults = await commonsRpc("search_commons_items", {
              query_text: query,
              match_count: cap,
              filter_kinds: filterKinds,
            }) as Array<Partial<CommonsItem> & { rank?: number }>;
            items = Array.isArray(rpcResults) ? rpcResults : [];
          }
        } else {
          // Browse — fetch top items per kind
          const kindFilter = filterKinds.map((k) => `"${k}"`).join(",");
          const rows = await commonsFetch(
            `/commons_items?select=id,slug,kind,title,summary,attribution,source_studio_slug,source_url,tags,parent_slug&kind=in.(${kindFilter})&status=eq.canonical&order=sort_order.asc,created_at.desc&limit=${cap}`
          ) as Array<Partial<CommonsItem>>;
          items = Array.isArray(rows) ? rows : [];
        }

        // Optional category filter (only meaningful for tools; uses tags)
        if (category !== "all") {
          items = items.filter((it) => {
            if (it.kind !== "tool") return true; // category filter is tool-only
            return Array.isArray(it.tags) && it.tags.includes(category);
          });
        }

        if (items.length === 0) {
          return {
            content: [{
              type: "text" as const,
              text: `# Commons Search\n\nNo items found${query ? ` matching "${query}"` : ""} in kinds: ${filterKinds.join(", ")}.\n\nTry a broader query or different kinds.`
            }],
          };
        }

        // Group by kind for readability
        const byKind: Record<string, typeof items> = {};
        for (const item of items) {
          const k = item.kind || "unknown";
          if (!byKind[k]) byKind[k] = [];
          byKind[k].push(item);
        }

        const lines: string[] = [];
        lines.push(`# Commons Library\n`);
        if (query) lines.push(`Search: "${query}"\n`);
        lines.push(`${items.length} result${items.length === 1 ? "" : "s"} across ${Object.keys(byKind).length} kind${Object.keys(byKind).length === 1 ? "" : "s"}.\n`);

        const headings: Record<string, string> = {
          tool: "Tools",
          story: "Builder Stories",
          prompt: "Prompts",
          recipe: "Neighborhood Recipes",
          reference: "Field References",
          framework: "Frameworks",
          methodology: "RTP Methodology",
        };

        for (const kind of ["tool", "story", "prompt", "recipe", "framework", "reference", "methodology"]) {
          if (!byKind[kind] || byKind[kind].length === 0) continue;
          lines.push(`\n## ${headings[kind] || kind}\n`);
          for (const item of byKind[kind]) {
            lines.push(formatItem(item));
            lines.push("");
          }
        }

        const includesStories = filterKinds.includes("story");
        const nudge = includesStories ? CONTRIBUTION_NUDGE_STORIES : CONTRIBUTION_NUDGE_PATTERNS;
        return { content: [{ type: "text" as const, text: lines.join("\n") + nudge }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error querying commons: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // -------------------------------------------------------------------------
  // get-tool-details — full details for a specific item from the commons
  // -------------------------------------------------------------------------

  s.tool(
    "get-tool-details",
    `Get detailed information about a specific item from the commons (tool, recipe, story, etc.), including full body, community notes, and linked items.`,
    {
      tool_name: z.string().describe("Name or partial name of the item to look up"),
      kind: z.enum(["tool", "recipe", "story", "prompt", "framework", "methodology", "reference"]).optional()
        .describe("Optional kind filter to disambiguate"),
    },
    async ({ tool_name, kind }) => {
      try {
        const needle = encodeURIComponent(`*${tool_name}*`);
        const kindFilter = kind ? `&kind=eq.${kind}` : "";
        let items = await commonsFetch(
          `/commons_items?select=id,slug,kind,title,summary,body,attribution,source_studio_slug,source_url,tags,parent_slug,metadata&title=ilike.${needle}${kindFilter}&status=eq.canonical&limit=5`
        ) as Array<Partial<CommonsItem>>;

        if (!Array.isArray(items) || items.length === 0) {
          // Exact title match missed — fall back to hybrid search and fetch
          // full rows for the closest matches
          const fallback = await searchCommonsHybrid(tool_name, kind ? [kind] : null, 3);
          const ids = (fallback ?? []).map((f) => f.id).filter(Boolean);
          if (ids.length > 0) {
            items = await commonsFetch(
              `/commons_items?select=id,slug,kind,title,summary,body,attribution,source_studio_slug,source_url,tags,parent_slug,metadata&id=in.(${ids.join(",")})&status=eq.canonical&limit=3`
            ) as Array<Partial<CommonsItem>>;
          }
        }

        if (!Array.isArray(items) || items.length === 0) {
          return {
            content: [{
              type: "text" as const,
              text: `No items found matching "${tool_name}"${kind ? ` (kind=${kind})` : ""}. Try search-studio-library for broader exploration.`,
            }],
          };
        }

        const lines: string[] = [];
        for (const item of items) {
          lines.push(`# ${item.title}\n`);
          if (item.kind) lines.push(`**Kind:** ${item.kind}`);
          if (item.summary) lines.push(`\n**Summary:** ${item.summary}\n`);
          if (item.body) lines.push(`\n${item.body}\n`);

          // Child items: prompts whose parent_slug matches this item's slug
          if (item.kind === "tool" && item.slug) {
            const children = await commonsFetch(
              `/commons_items?select=title,summary,body&parent_slug=eq.${encodeURIComponent(item.slug)}&kind=eq.prompt&status=eq.canonical`
            ) as Array<Partial<CommonsItem>>;
            if (Array.isArray(children) && children.length > 0) {
              lines.push(`\n## Prompts & Usage Patterns\n`);
              for (const c of children) {
                lines.push(`### ${c.title}`);
                if (c.summary) lines.push(`\n${c.summary}\n`);
                if (c.body) lines.push(c.body);
                lines.push("");
              }
            }
          }

          // Community notes
          if (item.id) {
            try {
              const notes = await commonsFetch(
                `/commons_notes?select=note_text,author_name&item_id=eq.${item.id}&status=eq.approved`
              ) as Array<Record<string, unknown>>;
              if (Array.isArray(notes) && notes.length > 0) {
                lines.push(`\n## Community Notes\n`);
                for (const n of notes) {
                  lines.push(`- ${n.note_text}`);
                  if (n.author_name) lines.push(`  — ${n.author_name}`);
                }
                lines.push("");
              }
            } catch {
              // Notes table errors shouldn't block the response
            }
          }

          if (item.source_url) lines.push(`\n[Source](${item.source_url})`);
          if (item.tags && item.tags.length > 0) lines.push(`**Tags:** ${item.tags.join(", ")}\n`);
          lines.push(`\n---\n`);
        }

        return { content: [{ type: "text" as const, text: lines.join("\n") + CONTRIBUTION_NUDGE_TOOL }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error fetching item details: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // -------------------------------------------------------------------------
  // find-patterns-by-context — match a builder's situation to relevant items
  // -------------------------------------------------------------------------

  s.tool(
    "find-patterns-by-context",
    `Match a builder's specific situation to relevant relational tech patterns, tools, recipes, and stories from the commons. Combines stage/need-specific guidance with live search across the commons library.`,
    {
      situation: z.string().describe("Description of the builder's situation, neighborhood, and what they're trying to do"),
      builder_stage: z.enum(["curious", "experimenting", "building", "sustaining", "scaling"]).optional()
        .describe("Where the builder is on their journey"),
      primary_need: z.enum([
        "connection", "communication", "events", "mutual_aid",
        "information", "organizing", "sustainability", "scaling"
      ]).optional()
        .describe("The builder's primary need area"),
    },
    async ({ situation, builder_stage, primary_need }) => {
      const results: string[] = [];
      results.push(`# Patterns for Your Context\n`);
      results.push(`Based on: ${situation}\n`);

      if (builder_stage) {
        results.push(`## Stage: ${builder_stage}\n`);
        const stageGuidance: Record<string, string> = {
          curious: "You're in the noticing and wondering phase. The most important thing right now is NOT to build anything. Instead: join existing local channels, attend neighborhood events, walk your blocks, and listen. Ask neighbors: 'What do you wish existed here?' Your job right now is to be a neighbor, not a builder.",
          experimenting: "You've started something — a group chat, a gathering, a small project. Stay small and intentional. The 1:100 ratio means you should know every person engaging with what you're building. Focus on depth over reach. Find one co-builder who shares your energy.",
          building: "You're putting infrastructure in place. This is where the three-layer model matters: are you building relational infrastructure (trust), information infrastructure (awareness), or action infrastructure (mutual aid)? Ideally, build them in that order. Don't launch five tools at once.",
          sustaining: "The biggest risk now is burnout. Rotate roles. Set boundaries. If things stop when you take a week off, the structure isn't sustainable yet. Focus on building leadership depth — identify and invest in 2-3 people who could carry any part of the work.",
          scaling: "Scaling relational tech means spreading through remixing, not replication. Document what works in your context. Share it through the RTP commons. Host visiting builders. Your patterns won't transfer exactly — that's the point. Each garden is different.",
        };
        results.push(stageGuidance[builder_stage] || "");
        results.push("");
      }

      if (primary_need) {
        results.push(`## For your need: ${primary_need}\n`);
        const needPatterns: Record<string, string> = {
          connection: "Start with the 'Host a First Gathering' playbook. Low barrier, high impact. Coffee on the sidewalk, a porch hangout, donuts in the driveway. The goal isn't the event — it's the relationships that form. Follow up within 48 hours. Name the next gathering before people leave.",
          communication: "Start with the 'Start a Neighborhood Communication Channel' playbook. Begin with 5 anchor neighbors. Use whatever they already use (WhatsApp, Signal, text). Set norms by modeling. Grow by 2-3 people per week. Split channels by topic when you hit ~50 people.",
          events: "Start with the 'Launch a Neighborhood Calendar' playbook. A well-maintained calendar is one of the highest-value, lowest-cost pieces of neighborhood infrastructure. Seed it with 10-15 existing events. Recruit 2-3 co-curators. Consider the Outer Sunset Today model for automation.",
          mutual_aid: "Start with the 'Build a Mutual Aid Pod' playbook. Start with existing trust — 5-15 households who already know each other. Define what kinds of help you'll share. Create a weekly rhythm. Practice before crisis. Rotate coordination monthly.",
          information: "Consider the three-layer information stack: a community calendar (what's happening), a neighborhood directory (who's here), and a field guide (what this place is). Start with whichever one would be most immediately useful. The Outer Sunset ecosystem is your reference model.",
          organizing: "The embedded design methodology is your guide. Be in community before building. Notice what's needed through relationships, not surveys. Find co-builders. Build the smallest useful thing. Let tools earn their place through word of mouth.",
          sustainability: "Focus on three things: distributed leadership (rotate roles), shared ownership (multiple co-builders), and rhythm (regular practices that don't depend on one person's energy). If you're feeling burned out, that's a structural problem, not a personal one.",
          scaling: "Scale through the RTP commons. Document your patterns. Share tools as remixable templates. Connect with builders in other neighborhoods. The Relational Tech Studio is designed for exactly this — contributing your work so others can adapt it.",
        };
        results.push(needPatterns[primary_need] || "");
        results.push("");
      }

      // Live search the commons using the situation as a search query —
      // semantic first so plain-language situations match well
      try {
        const patternKinds = ["recipe", "tool", "story", "framework"];
        let matches = await searchCommonsHybrid(situation, patternKinds, 8);
        if (!matches) {
          matches = await commonsRpc("search_commons_items", {
            query_text: situation,
            match_count: 8,
            filter_kinds: patternKinds,
          }) as Array<Partial<CommonsItem> & { rank?: number }>;
        }

        if (Array.isArray(matches) && matches.length > 0) {
          const byKind: Record<string, typeof matches> = {};
          for (const m of matches) {
            const k = m.kind || "unknown";
            if (!byKind[k]) byKind[k] = [];
            byKind[k].push(m);
          }

          if (byKind.recipe?.length) {
            results.push(`## Relevant Recipes from the Commons\n`);
            for (const r of byKind.recipe) {
              results.push(`- **${r.title}** — ${r.summary || ""}`);
            }
            results.push("");
          }
          if (byKind.tool?.length) {
            results.push(`## Relevant Tools from the Commons\n`);
            for (const t of byKind.tool) {
              results.push(`- **${t.title}** — ${t.summary || ""}`);
              if (t.source_url) results.push(`  ${t.source_url}`);
            }
            results.push("");
          }
          if (byKind.story?.length) {
            results.push(`## Stories from Other Builders\n`);
            for (const s of byKind.story) {
              results.push(`### ${s.title}`);
              if (s.summary) results.push(s.summary);
              if (s.attribution && typeof s.attribution === "object") {
                const a = s.attribution as Record<string, unknown>;
                if (a.name) results.push(`— ${a.name}`);
              }
              results.push("");
            }
          }
          if (byKind.framework?.length) {
            results.push(`## Relevant Frameworks\n`);
            for (const f of byKind.framework) {
              results.push(`- **${f.title}** — ${f.summary || ""}`);
            }
            results.push("");
          }
        }
      } catch (error) {
        results.push(`\n(Could not reach commons library: ${error instanceof Error ? error.message : String(error)})`);
      }

      return { content: [{ type: "text" as const, text: results.join("\n") + CONTRIBUTION_NUDGE_PATTERNS }] };
    }
  );

  // -------------------------------------------------------------------------
  // suggest-contribution — guided framework for contributing back
  // -------------------------------------------------------------------------

  s.tool(
    "suggest-contribution",
    `Help a builder shape their experience into a contribution for the RT commons. Call this when a builder wants to share a tool they built, a story from their neighborhood, a recipe, or a community note. Returns a guided framework the AI can use to help the builder draft their contribution conversationally. When the draft is ready and the builder has confirmed it, call submit-contribution to send it to the steward review queue.`,
    {
      contribution_type: z.enum(["tool", "story", "community_note", "unsure"]).describe(
        "What the builder wants to contribute"
      ),
      context: z.string().describe(
        "What the builder has shared so far about what they built, experienced, or learned"
      ),
      neighborhood: z.string().optional().describe("The builder's neighborhood or place, if known"),
      builder_name: z.string().optional().describe("The builder's first name, if they've shared it"),
    },
    async ({ contribution_type, context, neighborhood, builder_name }) => {
      const template = CONTRIBUTION_TEMPLATES[contribution_type] || CONTRIBUTION_TEMPLATES.unsure;
      const header = [
        `# Ready to Contribute`,
        ``,
        builder_name ? `Builder: ${builder_name}` : "",
        neighborhood ? `Neighborhood: ${neighborhood}` : "",
        ``,
        `What you've shared so far: ${context}`,
        ``,
        `---`,
        ``,
      ].filter(Boolean).join("\n");

      return { content: [{ type: "text" as const, text: header + template }] };
    }
  );

  // -------------------------------------------------------------------------
  // submit-contribution — send a confirmed draft to the steward review queue
  // -------------------------------------------------------------------------

  s.tool(
    "submit-contribution",
    `Submit a builder's contribution to the commons steward review queue. Use AFTER suggest-contribution has guided the conversation and the builder has seen the final draft and explicitly said yes. Nothing publishes immediately — a human steward reviews every submission before it joins the commons, and the builder is credited by name.`,
    {
      contribution_type: z.enum(["tool", "story", "recipe", "prompt", "community_note"])
        .describe("What kind of contribution this is"),
      title: z.string().describe("Title of the contribution"),
      summary: z.string().optional().describe("One-paragraph summary, in the builder's own voice"),
      body: z.string().optional().describe("The full contribution — the story, the tool description plus what you'd tell another builder, the recipe steps, or the note text"),
      builder_name: z.string().describe("The builder's name for attribution (first name is fine)"),
      neighborhood: z.string().optional().describe("The builder's neighborhood or place"),
      contact_email: z.string().optional().describe("Email so stewards can follow up — ask, don't require"),
      source_url: z.string().optional().describe("Live URL of the tool, if there is one"),
      tags: z.array(z.string()).optional().describe("Up to 8 short tags"),
      related_item_slug: z.string().optional().describe("For community notes: slug of the commons item the note is about"),
      builder_confirmed: z.boolean().describe("Set true only after showing the builder the final draft (including how they'll be credited) and getting their explicit yes. Submitting is an act of consent."),
    },
    async ({ contribution_type, title, summary, body, builder_name, neighborhood, contact_email, source_url, tags, related_item_slug, builder_confirmed }) => {
      if (!builder_confirmed) {
        return {
          content: [{
            type: "text" as const,
            text: `Not submitted yet. Show the builder the final draft — title, summary, body, and how they'll be credited — and ask if they'd like it sent to the commons stewards. Call this tool again with builder_confirmed=true once they say yes.`,
          }],
        };
      }
      try {
        const res = await fetch(`${COMMONS_FUNCTIONS_URL}/submit-contribution`, {
          method: "POST",
          headers: {
            apikey: COMMONS_ANON_KEY,
            Authorization: `Bearer ${COMMONS_ANON_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contribution_type, title, summary, body, builder_name,
            neighborhood, contact_email, source_url, tags, related_item_slug,
          }),
        });
        const json = await res.json() as Record<string, unknown>;
        if (!res.ok || !json.ok) {
          return {
            content: [{
              type: "text" as const,
              text: `The commons couldn't accept this submission: ${json.error ?? res.statusText}.${res.status === 429 ? " Please try again later." : ` The builder can also contribute via the web at ${STUDIO_CONTRIBUTE_URL}.`}`,
            }],
            isError: true,
          };
        }
        return {
          content: [{
            type: "text" as const,
            text: [
              `# Contribution Submitted`,
              ``,
              `**${title}** is in the steward review queue.`,
              ``,
              `What happens next: a human steward reads every submission. If it joins the commons, ${builder_name} will be credited${neighborhood ? ` (${neighborhood})` : ""} and the item will appear in the library and the network feed.${contact_email ? " The stewards have the builder's email and will follow up." : ""}`,
              ``,
              `Thank the builder — contributions like this are how the commons grows.`,
            ].join("\n"),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text" as const,
            text: `Could not reach the commons submission endpoint: ${error instanceof Error ? error.message : String(error)}. The builder can contribute via the web at ${STUDIO_CONTRIBUTE_URL}.`,
          }],
          isError: true,
        };
      }
    }
  );

  // -------------------------------------------------------------------------
  // get-network-updates — Watcher feed of GitHub repo activity.
  // Reads commons_feed_events (the unified activity stream, populated by the
  // ingest-watcher-feed cron) first; falls back to the GitHub Pages feed.
  // -------------------------------------------------------------------------

  s.tool(
    "get-network-updates",
    `Get the latest updates from across the relational tech network — real changes happening in community tools built by neighbors in different neighborhoods. This feed is generated by scanning all open-source repos tagged 'relational-tech' on GitHub.`,
    {
      repo_name: z.string().optional().describe(
        "Filter to updates from a specific project (e.g. 'cozy-corner', 'community-supplies')"
      ),
      tag: z.string().optional().describe(
        "Filter to updates matching a specific tag"
      ),
      entry_type: z.enum(["all", "change", "welcome"]).default("all").describe(
        "Filter by entry type"
      ),
      limit: z.number().default(10).describe(
        "Max entries to return (max 50)"
      ),
    },
    async ({ repo_name, tag, entry_type, limit }) => {
      const FEED_URL = "https://updates.relationaltechproject.org/feed.json";
      const cap = Math.min(Math.max(limit, 1), 50);

      // Commons first: watcher events land in commons_feed_events on a
      // schedule. Map rows back to the feed-entry shape so the filtering
      // and formatting below work identically for both sources.
      let entries: Array<Record<string, unknown>> | null = null;
      try {
        const rows = await commonsFetch(
          `/commons_feed_events?select=event_type,title,summary,url,occurred_at,payload&source=eq.watcher&order=occurred_at.desc&limit=200`
        ) as Array<Record<string, unknown>>;
        if (Array.isArray(rows) && rows.length > 0) {
          entries = rows.map((r) => {
            const p = (r.payload ?? {}) as Record<string, unknown>;
            return {
              entry_type: r.event_type === "new_repo" ? "welcome" : "change",
              timestamp: r.occurred_at,
              summary: r.summary,
              tags: p.tags ?? [],
              repo: {
                name: p.repo_name,
                full_name: p.repo,
                url: r.url,
                description: p.repo_description,
                neighborhood: p.neighborhood,
                builder: p.builder,
              },
              change: { url: r.url },
            };
          });
        }
      } catch {
        // Table unavailable — fall back to the published feed below
      }

      try {
        if (!entries) {
          const res = await fetch(FEED_URL);
          if (!res.ok) {
            return {
              content: [{ type: "text" as const, text: `Could not reach the network updates feed (HTTP ${res.status}). The feed is generated by a GitHub Action and may be temporarily unavailable.` }],
            };
          }
          entries = (await res.json()) as Array<Record<string, unknown>>;
        }
        if (repo_name) {
          const needle = repo_name.toLowerCase();
          entries = entries.filter((e) => {
            const repo = e.repo as Record<string, unknown> | undefined;
            const name = String(repo?.name ?? "").toLowerCase();
            const fullName = String(repo?.full_name ?? "").toLowerCase();
            return name.includes(needle) || fullName.includes(needle);
          });
        }
        if (tag) {
          const needle = tag.toLowerCase();
          entries = entries.filter((e) => {
            const tags = e.tags as string[] | undefined;
            return Array.isArray(tags) && tags.some((t) => t.toLowerCase().includes(needle));
          });
        }
        if (entry_type && entry_type !== "all") {
          entries = entries.filter((e) => e.entry_type === entry_type);
        }
        entries.sort((a, b) => String(b.timestamp ?? "").localeCompare(String(a.timestamp ?? "")));
        entries = entries.slice(0, cap);

        if (entries.length === 0) {
          const filters = [
            repo_name ? `repo="${repo_name}"` : "",
            tag ? `tag="${tag}"` : "",
            entry_type !== "all" ? `type="${entry_type}"` : "",
          ].filter(Boolean).join(", ");
          return {
            content: [{ type: "text" as const, text: `No updates found${filters ? ` matching ${filters}` : ""}. The network is quiet right now — but that just means there's room for your project to be the next update!` + CONTRIBUTION_NUDGE_PATTERNS }],
          };
        }

        const lines: string[] = [`# Network Updates\n`, `${entries.length} recent update${entries.length === 1 ? "" : "s"} from across the relational tech network.\n`];
        for (const entry of entries) {
          const repo = entry.repo as Record<string, unknown> | undefined;
          const change = entry.change as Record<string, unknown> | undefined;
          const tags = entry.tags as string[] | undefined;
          const projectName = String(repo?.name ?? "Unknown project");
          const description = repo?.description ? String(repo.description) : "";
          const summary = entry.summary ? String(entry.summary) : "";
          const timestamp = entry.timestamp ? String(entry.timestamp).split("T")[0] : "";
          const link = change?.url ? String(change.url) : (repo?.url ? String(repo.url) : "");

          lines.push(`---`);
          lines.push(`### ${projectName}${timestamp ? ` — ${timestamp}` : ""}`);
          if (description) lines.push(`*${description}*\n`);
          if (summary) lines.push(summary + "\n");
          if (Array.isArray(tags) && tags.length > 0) lines.push(`**Tags:** ${tags.join(", ")}\n`);
          if (link) lines.push(`[View change](${link})\n`);
        }

        return { content: [{ type: "text" as const, text: lines.join("\n") + CONTRIBUTION_NUDGE_PATTERNS }] };
      } catch (error) {
        return {
          content: [{
            type: "text" as const,
            text: `Could not reach the network updates feed at updates.relationaltechproject.org.\n\nError: ${error instanceof Error ? error.message : String(error)}`,
          }],
        };
      }
    }
  );
}

// ---------------------------------------------------------------------------
// Prompts — guided workflows for builders, plus the practice-guide stance
// ---------------------------------------------------------------------------

function registerPrompts(s: McpServer) {
  // practice-guide — adopt the Neighboring Commons stance
  s.prompt(
    "practice-guide",
    `Adopt the Neighboring Commons practice-guide stance for the rest of the conversation. Use this when responding to community builders working through questions about their neighborhood. Drawn from the Neighboring Commons skill — relationships-first, asset-based, citing practitioners, calibrating confidence, inviting contribution.`,
    {},
    () => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `For this conversation, take on the role of a Neighboring Commons practice guide.

You serve people building community at neighborhood scale — strengthening the relationships, mutual support, and shared life that make a place feel like home.

## Your sources

You can draw on the RTP commons via these MCP tools:
- \`search-studio-library\` — search across tools, stories, prompts, recipes, references
- \`get-tool-details\` — full content for a specific item
- \`find-patterns-by-context\` — situation-matched patterns + stage/need guidance
- \`get-network-updates\` — what builders across the network are shipping

The commons holds RTP methodology, 8 frameworks, 64 neighborhood recipes (block parties, mutual aid, repair cafes, etc.), 198 field references (Block Party USA, Priya Parker, Dean Spade's mutual aid work, ABCD Institute, etc.), and builder-contributed tools and stories.

## How you operate

**Relationships First.** Before giving advice, understand the person's situation. What's their neighborhood like? What relationships already exist? What are they actually trying to do? Don't skip straight to recommendations.

**Reciprocity Over Charity.** Treat them as a peer, not a client. They know their neighborhood better than any knowledge base does. Connect their lived knowledge to other practitioners' experiences — don't prescribe solutions.

**Start Small.** Resist the urge to overwhelm. Suggest one or two practices that match their energy, capacity, and context. They can always come back for more.

**Asset-Based.** Ask what's already working before suggesting what to add.

**Celebrate Practitioners.** The knowledge exists because real people built real things in real places. Name them. Describe what they did and where. Don't strip their work into generic principles.

**Honest About Limits.** The commons is substantial but not exhaustive. Say so when you hit the edges. Their experience may be filling a gap the field needs — invite them to contribute via \`suggest-contribution\`.

## The Guidance Loop

For any question:

1. **Listen and Locate.** Restate the question. Search the commons (use the tools above). Identify what's well-covered and what isn't.

2. **Respond and Attribute.** Lead with the most relevant practitioner work. Name the person or project, describe what they did and where, connect it to the user's situation. Tag your confidence: **KB-Grounded** (commons directly addresses this), **Informed** (synthesizing across sources), **Beyond the commons** (lower confidence, flag explicitly).

3. **Self-Critique.** Before finalizing: Am I answering what was asked? Is this actionable? Did I overstate confidence? Am I centering the practitioners? Am I overwhelming the person (more than 4-5 resources = too many)?

## Response format

Conversational and warm, not report-like. End with a Sources section listing the commons items you referenced (use their slugs).

## A note

You are a practice guide, not an authority. The person asking is the one doing the work. They know their neighborhood. Your job is to connect their situation to others who've faced similar questions — not to replace their judgment.

Now: greet them warmly, ask what they're working on, and listen.`,
        },
      }],
    })
  );

  s.prompt(
    "design-neighborhood-tool",
    `Guided embedded design process for creating a new neighborhood-scale tool.`,
    {
      neighborhood: z.string().optional().describe("Name or description of the neighborhood"),
      builder_role: z.string().optional().describe("How the builder sees their role"),
      initial_idea: z.string().optional().describe("What the builder is thinking of building"),
    },
    ({ neighborhood, builder_role, initial_idea }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `You are a relational tech design partner, grounded in RTP's embedded design methodology. Help me design a neighborhood-scale tool.

## My Context
${neighborhood ? `Neighborhood: ${neighborhood}` : "Neighborhood: (not yet specified — ask me)"}
${builder_role ? `My role: ${builder_role}` : "My role: (not yet specified — ask me)"}
${initial_idea ? `Initial idea: ${initial_idea}` : "Initial idea: (not yet specified — let's explore)"}

## Your Approach
Guide me through the embedded design process. Don't jump to solutions. Instead:

1. **Understand my place.** Ask about my neighborhood — its character, history, who lives there, what already exists. Every place carries its own stories and gifts.
2. **Map my assets.** Help me see what's already here — people, spaces, channels, traditions, informal networks. Start from abundance, not deficit.
3. **Explore relationships.** Who do I already know and trust? Where does energy live? What are people already doing informally that could be supported?
4. **Listen for needs.** Through the relationships and assets I describe, help me notice what's needed. Not from surveys — from stories, from being present.
5. **Design the smallest thing.** When we have enough context, help me design the minimum relational thing — the smallest tool that creates one connection that didn't exist before.
6. **Check the principles.** Before we finalize anything, run it through the RTP principles (use the methodology resources via MCP).

## Key RTP Principles
- "Spend less time building in isolation and more time in the messiness and beauty of community life"
- Dreams emerge from accountable relationships and time spent in the world together
- Fewer "users," more co-creators (1:100 ratio)
- Scale deep in place, spread horizontally through remixing
- The three layers: relational → information → action

Take your time. This is a conversation, not a checklist.

When the design feels ready to build, use the create-build-plan prompt to turn this conversation into the two build artifacts (detailed prompt + plan) with lineage and network guidance included.`,
        },
      }],
    })
  );

  s.prompt(
    "assess-relational-soil",
    `Help a builder understand the current state of relational health in their neighborhood — agency, belonging, and trust.`,
    {
      neighborhood: z.string().optional().describe("Name or description of the neighborhood"),
    },
    ({ neighborhood }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `You are a relational tech partner helping me assess the relational soil in ${neighborhood || "my neighborhood"}.

Relational soil is the conditions in which agency, belonging, and trust can grow. Every neighborhood has some — the question is understanding what's already there and where there's room to cultivate more.

Guide me through an assessment by asking about:

## Agency — Do people here see themselves as capable stewards?
- Who's already building or organizing things?
- When something needs fixing, do people act or wait for someone else?
- Are there local builders, makers, or leaders who others look to?

## Belonging — Do people feel they matter here?
- Where do people gather? (formal and informal spaces)
- Are there groups, channels, or traditions that bring people together?
- Who feels included? Who might feel left out?

## Trust — Do people engage in shared care?
- Do neighbors help each other (meals, tools, rides, childcare)?
- Is there mutual aid, formal or informal?
- Where are trust gaps?

For each dimension, help me see: what already exists (assets), what's growing, where there's room to cultivate more, and one small step I could take.

Be warm, specific, and asset-based. Don't catalog deficits — help me see the life that's already here.`,
        },
      }],
    })
  );

  s.prompt(
    "create-builder-action-plan",
    `Generate a personalized action plan, matching the builder's situation to commons patterns, tools, recipes, and stories. Structured in three time horizons: this week, this month, this quarter.`,
    {
      builder_name: z.string().optional(),
      neighborhood: z.string().optional(),
      situation: z.string().optional(),
      stage: z.string().optional(),
    },
    ({ builder_name, neighborhood, situation, stage }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `You are creating a personalized action plan for a community builder, drawing from the RTP commons.

## Builder Context
${builder_name ? `Name: ${builder_name}` : "Name: (ask me)"}
${neighborhood ? `Neighborhood: ${neighborhood}` : "Neighborhood: (ask me)"}
${situation ? `Situation: ${situation}` : "Situation: (ask me)"}
${stage ? `Builder stage: ${stage}` : "Builder stage: (assess through conversation)"}

## Your Process
1. Understand context deeply — ask about neighborhood, relationships, assets.
2. Search the commons (search-studio-library, find-patterns-by-context) for relevant tools, recipes, and stories.
3. Build the action plan in three layers:

### This Week (Quick Wins)
Concrete, low-effort actions for the next 7 days. At least one face-to-face interaction. Connected to specific commons items.

### This Month (Foundation Building)
Communication channels, asset mapping, finding 2-3 co-builders. Connect to a specific recipe or tool from the commons.

### This Quarter (Growth & Sustainability)
Formalize systems, connect to broader networks, develop sustainability practices, consider contributing back.

4. Self-critique: Is every action relevant to THIS builder? Does it match their readiness? Does it lead with assets? Would they feel energized or exhausted? When in doubt, cut.

## Tone
Warm but not saccharine. Specific, not generic. Asset-based. Honest about difficulty. Rooted in their actual place.`,
        },
      }],
    })
  );

  s.prompt(
    "remix-existing-tool",
    `Help a builder adapt an existing relational tech tool or recipe for their own neighborhood. Remixing — not replication — is how relational tech spreads.`,
    {
      source_tool: z.string().optional().describe("The tool or recipe to remix"),
      target_neighborhood: z.string().optional().describe("The neighborhood they're adapting it for"),
    },
    ({ source_tool, target_neighborhood }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `You are helping me remix an existing relational tech tool or recipe for my neighborhood.

${source_tool ? `Item to remix: ${source_tool}` : "I'd like to browse what's available and choose something to remix."}
${target_neighborhood ? `My neighborhood: ${target_neighborhood}` : "My neighborhood: (ask me about it)"}

## The Remix Approach
Relational tech spreads through remixing, not replication. A tool that works in the Outer Sunset won't work the same way in your neighborhood — and that's the point.

Guide me through:

1. **Understand the source.** Use get-tool-details to look it up. What does it do? What relational infrastructure underneath?
2. **Understand my place.** Ask about my neighborhood. Character, who's here, what already exists, what makes this place distinct.
3. **Find the fit.** What elements map to real needs? What doesn't translate?
4. **Design the remix.** Adapted to my context. Keep the relational core. Change the specifics.
5. **Plan the build.** Smallest version I can create and test with real neighbors.

## Key Principles
- The goal isn't a copy — it's inspiration and adaptation
- Start from my place, not from the source
- Build with neighbors, not for them
- Small enough to test in a week
- If it works, contribute it back via suggest-contribution

When we've designed the remix and I'm ready to build, use the create-build-plan prompt to turn this conversation into the two build artifacts (detailed prompt + plan).`,
        },
      }],
    })
  );

  // create-build-plan — turn the conversation into Studio-grade build artifacts
  s.prompt(
    "create-build-plan",
    `Turn a builder conversation into a Studio-grade build plan: a detailed paste-ready prompt plus a concrete plan, with lineage, license, and relational-tech network guidance. Use when a builder is ready to move from talking about a tool to building it. Mirrors the build plans generated inside the Relational Tech Studio.`,
    {
      builder_name: z.string().optional().describe("The builder's name, if shared"),
      neighborhood: z.string().optional().describe("The builder's neighborhood or place"),
      ai_coding_experience: z.string().optional().describe("How much AI-assisted coding the builder has done: never, a_little, regular, or daily"),
    },
    ({ builder_name, neighborhood, ai_coding_experience }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `You are now the build-plan author for the Relational Tech commons — the same role the Studio's build-plan generator plays. Turn our conversation so far into two artifacts I can copy and run with this afternoon: a detailed prompt and a plan.

## My context
${builder_name ? `Name: ${builder_name}` : "Name: (ask me)"}
${neighborhood ? `Neighborhood: ${neighborhood}` : "Neighborhood: (ask me)"}
${ai_coding_experience ? `AI-coding experience: ${ai_coding_experience}` : "AI-coding experience: (ask me — never / a little / regular / daily)"}

If our conversation hasn't yet covered who the tool is for, the core flows, and the texture of my place, ask me the 2–3 missing questions FIRST — the conversation is the brief, and a thin brief makes a generic plan.

## Ground rules for sources
- Use get-tool-details on any commons tool we discussed. Tool entries carry "## Remix this tool" (live site, fork repo, Lovable link, hosted option, Studio library page) and "## Lineage" (creators, history) sections. These are real, curated links — they are the ONLY legitimate source for fork links, hosted options, and creator names. Never invent a repo, hosted platform, or creator.
- Draw on commons items for structure and texture, but do not copy verbatim. My tool is mine, not a fork of a library item — unless we're explicitly forking.

## Artifact 1 — the detailed prompt
A self-contained markdown spec I will paste into Lovable, Claude Code, Dyad, or Google AI Studio. Sections, as ## headers, in this order:

1. **Purpose** — 1–2 plain sentences; name my neighborhood when the build is tied to place.
2. **Who it's for** — the specific neighbors, not "users."
3. **Core flows** — the 2–4 primary actions, as steps.
4. **Pages / screens** — mark 1–2 "Primary," the rest "Secondary (can be stubbed in v1)."
5. **Data model in plain English** — objects and fields as sentences; no SQL.
6. **What's in v1 vs. deferred** — v1 is the smallest thing I can hand to one neighbor.
7. **Aesthetic, anchored in this place** — warm community-bulletin-board / local-library feel; small palette; 1–2 typography moves that fit this place. Avoid "modern, clean, minimal."
8. **Guardrails the downstream builder MUST follow** — include as a block: no AI-generated photos, faces, or photo-real illustrations; no large decorative AI artwork; labeled placeholders ("Add a real photo here") instead of generated images; no flowery marketing copy — leave human TODO placeholders so I write key paragraphs in my own voice; mobile-first; few accessible colors, large type.
9. **Tone of voice** — one paragraph, drawn from how I talk in this chat.
10. **What "good enough to share with one neighbor" looks like** — three concrete bullets.
11. **Lineage (include in the README)** — write it ready to paste, 3–4 plain lines: "Built by {my name} in {my neighborhood}" (placeholders if unknown); "Created with the Relational Tech commons (https://studio.relationaltechproject.org) via the RTP MCP server."; and when this remixes a commons tool with a named creator or lineage: "Remixed from {tool} by {creator} — {library page link}", carrying the tool's own lineage note forward so the chain stays unbroken. Attribution is a gift — name people only when the commons data or our chat provides them.
12. **Join the relational tech network (repo setup)** — a literal instruction block: make the repo public if I'm comfortable; add the relational-tech GitHub topic (terminal: gh repo edit <owner>/<repo> --add-topic relational-tech; or GitHub UI → About → Topics) — one sentence on why (the RTP Watcher discovers public repos with this topic and shares them in the network feed so other neighborhoods can find and remix this work); include an open-source license (MIT is the RTP default); optionally add a .reltech.yml at the repo root:

   version: 2
   project:
     name: "{tool name}"
     description: "{one sentence}"
     neighborhood: "{my neighborhood}"
     builder: "{my name}"
   lineage:
     remixed_from: "{source tool name}"
     remixed_from_url: "{source tool's library page link}"
     creator: "{source tool's creator, when the commons names one}"
     note: "{source tool's lineage note, carried forward}"

   Include the lineage block only when this build remixes a commons tool; omit any field without real data; leave the block out entirely for original work. If I'm building in Lovable (no terminal), leave a short "Join the network" TODO checklist in the README so the topic step doesn't get lost.

## Artifact 2 — the plan
Markdown with exactly these three sections:

**1. How will you build this?** Up to three options, ordered by fit: Fork an existing codebase (ONLY when a commons tool we discussed has a real "Fork the code" link — name the source, link the repo, note the README lineage section points back at the original; otherwise omit this option entirely); Build a fresh tool from the prompt above (always available, always the default); Use a hosted platform that already does this (ONLY when the commons shows a real hosted option — link it and name who runs it; otherwise omit). If fresh-build is the only real option, say: "We're adding more fork and hosted-platform options to the Studio as the commons grows — for now, the fresh build path is the strongest one."

**2. Pick your builder tech.** Two tracks. If my AI-coding experience is never or a little: Lovable (plan mode then build mode, paste the detailed prompt as the first message), Lovable hosting + Cloud + email, Namecheap for a domain. If regular or daily: Claude Code (paste the detailed prompt as the brief), Vercel, Neon or Supabase, Resend, Namecheap. Mention Dyad and Google AI Studio as alternates either way.

**3. Share with one neighbor.** A concrete next-90-minutes path: ship the roughest working version; pick one neighbor who will care (name a real candidate type); send the link and ask three specific questions; set a coffee date this week to edit copy together; when the repo exists, make it public and add the relational-tech topic — that's what puts this build in the network feed.

## Title
Give the plan a short, warm, place-specific title — under 60 characters, noun phrase, no "App"/"Tool"/"Platform" suffix.

## Writing discipline
Don't invent details about my neighborhood — use placeholders I can fill. No flattery, no emojis, no exclamation points. The two artifacts are copied separately; each must stand alone.

When I've built something from this plan, remind me to share it back to the commons with suggest-contribution → submit-contribution.`,
        },
      }],
    })
  );
}

// ---------------------------------------------------------------------------
// Relational Builder bridge
//
// The commons above is RTP's shared library. Relational Builder
// (relationalbuilder.org) is RTP's own build tool, and some of what makes
// it useful lives in ITS backend rather than the commons: the principles
// and practices its AI builds by, the live civic-data endpoints partner
// cities run, the prompt seeds builders share, and each community build
// day's demo wall. These calls bring that to builders working in their own
// tools. Reads need no key; the wall takes the room's event code.
// ---------------------------------------------------------------------------

const BUILDER_SITE_URL =
  (process.env.RTP_BUILDER_SITE_URL ?? "https://relationalbuilder.org").replace(/\/$/, "");

// The Builder's `commons-bridge` edge function (relational-builder repo,
// supabase/functions/commons-bridge) — one door for everything below.
const BUILDER_BRIDGE_URL =
  process.env.RTP_BUILDER_BRIDGE_URL ??
  "https://texakzqqenzpxawktbgx.supabase.co/functions/v1/commons-bridge";

async function builderBridge(action: string, body: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  const res = await fetch(BUILDER_BRIDGE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...body }),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(String(json.error ?? `${res.status} ${res.statusText}`));
  return json;
}

// The Builder's principles and practices, as it publishes them — generated
// from its own source on every deploy (scripts/export-builder-knowledge.mjs
// in the relational-builder repo), so this server never carries a stale
// copy. Cached briefly; the documents change at the pace of the code.
const BUILDER_DOCS = [
  { slug: "builder-principles", name: "builder-principles", uri: "rtp://builder/principles", title: "Relational Technology Principles, as Relational Builder carries them", description: "The principles block every Relational Builder conversation starts from: purpose, the 90/10 principle, river-garden-commons, relational soil (agency, belonging, trust), the practice cycle, what AI should and must not do, open source and remixing, stewardship. Paste it into any AI tool's system prompt." },
  { slug: "builder-practice",   name: "builder-practice",   uri: "rtp://builder/practice",   title: "How Relational Builder builds", description: "The working practices behind Relational Builder, with no stack in them: what counts as a build (programs and flyers too), the first build as the core loop alive, seed one neighbor, real records come from the person, relational mechanics (bonding and bridging, every post opens a path to a person, pair asks with offers), easy for a neighbor, personality from the place, working with the person." },
  { slug: "builder-frames",     name: "builder-frames",     uri: "rtp://builder/frames",     title: "Domain frames", description: "Principle sets that layer onto the base principles for particular shapes of project: civic media, practice-first, relational, microgrants (a gathering fund), deliberative. Pick the one that fits and add it after the principles." },
] as const;

type BuilderDocSlug = (typeof BUILDER_DOCS)[number]["slug"];

const BUILDER_DOC_TTL_MS = 10 * 60 * 1000;
const builderDocCache = new Map<string, { text: string; at: number }>();

async function fetchBuilderDoc(slug: BuilderDocSlug): Promise<string> {
  const hit = builderDocCache.get(slug);
  if (hit && Date.now() - hit.at < BUILDER_DOC_TTL_MS) return hit.text;
  const res = await fetch(`${BUILDER_SITE_URL}/knowledge/${slug}.md`, { headers: { Accept: "text/markdown, text/plain" } });
  if (!res.ok) throw new Error(`Could not load ${slug} from ${BUILDER_SITE_URL} (${res.status})`);
  const raw = await res.text();
  // The Builder is a single-page app: an unknown path answers with the app
  // shell, not a 404. A document that isn't markdown isn't the document.
  if (/^\s*<!doctype html|^\s*<html/i.test(raw)) {
    throw new Error(`${slug}.md is not published at ${BUILDER_SITE_URL}/knowledge/ yet`);
  }
  const text = raw.replace(/^<!--[\s\S]*?-->\s*/, "");
  builderDocCache.set(slug, { text, at: Date.now() });
  return text;
}

function registerBuilderResources(s: McpServer) {
  for (const d of BUILDER_DOCS) {
    s.resource(d.name, d.uri, { description: d.description, mimeType: "text/markdown" }, async () => ({
      contents: [{ uri: d.uri, text: await fetchBuilderDoc(d.slug), mimeType: "text/markdown" }],
    }));
  }
}

function fmtWallEntry(e: Record<string, unknown>, i: number): string {
  const lines = [`${i + 1}. **${e.project_name ?? "Untitled"}**${e.builder_name ? ` — ${e.builder_name}` : ""}${e.submitted_via && e.submitted_via !== "builder" ? " _(built with their own tools)_" : ""}`];
  if (e.one_liner) lines.push(`   ${e.one_liner}`);
  const links: string[] = [];
  if (e.demo_url) links.push(`[open the app](${e.demo_url})`);
  if (e.deck_url) links.push(`[slides](${e.deck_url})`);
  if (e.screenshot_url) links.push(`[screenshot](${e.screenshot_url})`);
  if (links.length) lines.push(`   ${links.join(" · ")}`);
  if (e.contact_value) lines.push(`   ${e.contact_label ?? "Contact"}: ${e.contact_value}`);
  return lines.join("\n");
}

function registerBuilderTools(s: McpServer) {
  // -------------------------------------------------------------------------
  // get-builder-guidance — RB's principles and practices, for any tool.
  // Resources carry the same text; the tool is for clients that only
  // surface tools, and for an AI that wants to pull a section mid-build.
  // -------------------------------------------------------------------------

  s.tool(
    "get-builder-guidance",
    `Get the principles and working practices Relational Builder (relationaltechproject.org's own build tool) builds by — so a builder working in Claude Code, Cursor, Lovable, or any other AI tool builds from the same ground. Call this at the start of any neighborhood-tool build and keep it in context: "principles" is the block to adopt as a system prompt; "practice" is how to size, seed, shape, and hand off a community tool (the first build as the core loop alive, seed one neighbor, relational mechanics, easy for a neighbor, personality from the place); "frames" are add-on principle sets for particular shapes of project (civic media, practice-first, relational, microgrants, deliberative).`,
    {
      topic: z.enum(["principles", "practice", "frames", "all"]).default("all")
        .describe("Which document. 'all' returns principles, practice, then frames."),
    },
    async ({ topic }) => {
      const slugs: BuilderDocSlug[] =
        topic === "all" ? ["builder-principles", "builder-practice", "builder-frames"]
        : topic === "principles" ? ["builder-principles"]
        : topic === "practice" ? ["builder-practice"]
        : ["builder-frames"];
      try {
        const parts = await Promise.all(slugs.map(fetchBuilderDoc));
        const footer = `\n\n---\n\n_These documents are generated from Relational Builder's own source and served at ${BUILDER_SITE_URL}/knowledge/. When your build draws on them, say so in the README: "Built with the Relational Tech Project's principles and practices (${BUILDER_SITE_URL})."_`;
        return { content: [{ type: "text" as const, text: parts.join("\n\n---\n\n") + footer }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Could not load the Builder's guidance: ${error instanceof Error ? error.message : String(error)}. The documents are also readable directly at ${BUILDER_SITE_URL}/knowledge/builder-practice.md.` }],
          isError: true,
        };
      }
    }
  );

  // -------------------------------------------------------------------------
  // find-civic-data-endpoints — live city open data, as MCP servers.
  // -------------------------------------------------------------------------

  s.tool(
    "find-civic-data-endpoints",
    `Find a city's live open-data MCP endpoint (run by partner networks, currently the Responsive Cities Network). Each is a keyless MCP server over plain HTTP JSON-RPC with permissive CORS: your AI tool can connect to it directly to read the city's real datasets, and a generated app can call it from the browser with fetch. Use this when a build touches a city's parcels, permits, services, transit, or any civic record — real rows from the city beat invented data every time.`,
    {
      city: z.string().optional().describe("City name or part of one (e.g. 'Boulder', 'Charlotte, NC'). Leave empty to list every city with an endpoint."),
    },
    async ({ city }) => {
      try {
        const json = await builderBridge("civic_endpoints", city ? { city } : {});
        const rows = (json.endpoints as Record<string, unknown>[]) ?? [];
        if (rows.length === 0) {
          return { content: [{ type: "text" as const, text: city ? `No live civic-data endpoint for "${city}" yet. Call without a city to see which cities have one, or search the web for the city's open-data portal and load a public dataset by URL.` : "No civic-data endpoints are registered right now." }] };
        }
        const list = rows.map(r => `- **${r.city}** (${r.kind}) — \`${r.mcp_url}\`${r.notes ? `\n  ${r.notes}` : ""}`).join("\n");
        const howTo = [
          "",
          "## How to use one",
          "",
          "- **In your AI tool:** add the endpoint as an MCP server (Streamable HTTP), then ask for the city's datasets. Tool names differ by portal (`arcgis__*`, `ckan__*`, and others), so start with the tool list.",
          "- **In a generated app:** discover with `tools/list`, read with `tools/call`:",
          "",
          "```js",
          "const r = await fetch(MCP_URL, {",
          "  method: 'POST',",
          "  headers: { 'content-type': 'application/json', accept: 'application/json' },",
          "  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),",
          "});",
          "```",
          "",
          "- Prefer \"the app reads it live from the city endpoint\" over pasting a snapshot into a file. Say where the data came from, in one line, in the app.",
        ].join("\n");
        return { content: [{ type: "text" as const, text: `# Live civic data endpoints\n\n${list}\n${howTo}` }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: `Could not reach the endpoint registry: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );

  // -------------------------------------------------------------------------
  // search-prompt-seeds / get-prompt-seed — the seed library.
  // -------------------------------------------------------------------------

  s.tool(
    "search-prompt-seeds",
    `Search the prompt seeds builders have shared from Relational Builder. A seed is the plain-language description that grew a working neighborhood tool, with the place-specific parts marked for adaptation — the artifact that actually spreads between neighborhoods. Find one that is close to what a builder wants, then get-prompt-seed for the full text to grow their own version in their own tool, credited to the seed's author.`,
    {
      query: z.string().optional().describe("Plain words for what the builder wants (e.g. 'tool lending library', 'block party RSVP'). Leave empty to browse the newest."),
      limit: z.number().optional().describe("Max results (default 12, max 40)"),
    },
    async ({ query, limit }) => {
      try {
        const json = await builderBridge("seeds", { query, limit });
        const seeds = (json.seeds as Record<string, unknown>[]) ?? [];
        if (seeds.length === 0) {
          return { content: [{ type: "text" as const, text: `No shared seeds match${query ? ` "${query}"` : ""} yet. The commons' tools and recipes (search-studio-library) are the next place to look — and a builder who grows something new can share its seed from Relational Builder.` }] };
        }
        const list = seeds.map(sd => [
          `### ${sd.title}`,
          sd.author_name ? `*shared by ${sd.author_name}*` : "",
          `slug: \`${sd.share_slug}\` · [open in Relational Builder](${sd.url})`,
          "",
          String(sd.excerpt ?? ""),
        ].filter(Boolean).join("\n")).join("\n\n");
        return { content: [{ type: "text" as const, text: `# Prompt seeds\n\n${list}\n\n---\n\nCall get-prompt-seed with a slug for the full seed. A seed is grown, not copied: keep its relational core, change the specifics to this builder's place, and credit the author in the README.` }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: `Could not search seeds: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );

  s.tool(
    "get-prompt-seed",
    `Get the full text of one shared prompt seed by its slug (from search-prompt-seeds). Use it as the brief for a build in the builder's own tool, adapted to their neighborhood, with the author credited.`,
    {
      share_slug: z.string().describe("The seed's slug"),
    },
    async ({ share_slug }) => {
      try {
        const json = await builderBridge("seed", { share_slug });
        const sd = json.seed as Record<string, unknown>;
        return { content: [{ type: "text" as const, text: `# ${sd.title}\n\n${sd.author_name ? `*Seed shared by ${sd.author_name}* · ` : ""}[open in Relational Builder](${sd.url})\n\n${sd.body}\n\n---\n\n_Grown from a prompt seed shared through Relational Builder${sd.author_name ? ` by ${sd.author_name}` : ""}. Carry that line into the README._` }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: `Could not load that seed: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );

  // -------------------------------------------------------------------------
  // get-build-day-wall / share-to-build-day-wall — the room's demo wall.
  // -------------------------------------------------------------------------

  s.tool(
    "get-build-day-wall",
    `See what a community build day's room has built so far: the demo wall for one event, by its event code (the room key on the slide and the QR card). Builds appear in the order they were shared, with links, so a builder can see neighbors' work and the host can present the room.`,
    {
      event_code: z.string().describe("The event code, e.g. BUILDJAM"),
    },
    async ({ event_code }) => {
      try {
        const json = await builderBridge("wall", { event_code });
        const ev = json.event as { code: string; name: string };
        const entries = (json.entries as Record<string, unknown>[]) ?? [];
        const body = entries.length === 0
          ? "Nothing on the wall yet — this builder could be first."
          : entries.map(fmtWallEntry).join("\n\n");
        return { content: [{ type: "text" as const, text: `# ${ev.name} — the wall\n\n${body}\n\n---\n\nPresent the room: ${json.wall_url}\nShare this builder's own work with share-to-build-day-wall.` }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: `Could not read the wall: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );

  s.tool(
    "share-to-build-day-wall",
    `Pin a builder's project to their community build day's demo wall — the gallery the room presents from at the end of the day — from whatever tool they built it in. Needs the event code (the room key on the slide or QR card) and a project name; a one-line description, a link to the live tool, a screenshot, and a way to reach the builder make the card. Call ONLY after the builder has seen what the card will say and said yes: the wall is public to the room, and the card carries their name. Re-sharing the same project (with the same email) replaces the earlier card.`,
    {
      event_code: z.string().describe("The event code, e.g. BUILDJAM"),
      project_name: z.string().describe("What the project is called (the card's title)"),
      builder_name: z.string().optional().describe("The builder's name as it should appear on the card (first name is fine)"),
      one_liner: z.string().optional().describe("One sentence on what it does and who it's for, in the builder's words"),
      demo_url: z.string().optional().describe("Link to the live tool, if it's deployed anywhere (a repo link is fine too)"),
      screenshot_data_url: z.string().optional().describe("A screenshot as a data URL (png/jpeg/webp, under 4MB). Optional but it makes the card."),
      contact_label: z.string().optional().describe("How the builder wants to be reached, if at all: 'Email', 'Phone', 'Website', or their own word"),
      contact_value: z.string().optional().describe("The matching value. Only if the builder offered it — the wall is public to the room."),
      email: z.string().optional().describe("The builder's email, so a re-share replaces their card and the host can follow up. Not shown on the wall."),
      builder_confirmed: z.boolean().describe("Set true only after showing the builder the card (name, project, line, link) and getting their explicit yes."),
    },
    async ({ event_code, project_name, builder_name, one_liner, demo_url, screenshot_data_url, contact_label, contact_value, email, builder_confirmed }) => {
      if (!builder_confirmed) {
        return { content: [{ type: "text" as const, text: `Not shared yet. Show the builder the card — **${project_name}**${builder_name ? ` by ${builder_name}` : ""}${one_liner ? `: ${one_liner}` : ""}${demo_url ? ` (${demo_url})` : ""} — and ask if it should go on the ${event_code} wall. Call again with builder_confirmed=true once they say yes.` }] };
      }
      try {
        const json = await builderBridge("share", {
          event_code, project_name, builder_name, one_liner, demo_url,
          screenshot: screenshot_data_url, contact_label, contact_value, email, via: "mcp",
        });
        const ev = json.event as { code: string; name: string };
        return { content: [{ type: "text" as const, text: [
          `# On the wall`,
          ``,
          `**${project_name}** is pinned to the ${ev.name} wall${builder_name ? `, credited to ${builder_name}` : ""}.`,
          ``,
          `The room's wall: ${json.wall_url}`,
          ``,
          `Two things worth offering now: a one-line tip on the wall about what they'd tell the next builder, and — if this build is something another neighborhood could learn from — contributing it to the commons with suggest-contribution, so it outlives today.`,
        ].join("\n") }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: `Couldn't pin to the wall: ${error instanceof Error ? error.message : String(error)}. The builder can also email the build to the room's inbox (the address is on the slide) or show it to a host.` }], isError: true };
      }
    }
  );
}

function registerBuilderPrompts(s: McpServer) {
  // relational-builder-stance — build like the Builder does, in any tool
  s.prompt(
    "relational-builder-stance",
    `Build a neighborhood tool the way Relational Builder does, in whatever tool you're using: load the RTP principles and the Builder's practices, work in the person's own words, size the first build to the core loop, seed one neighbor, make every post open a path to a person, and credit the commons. Use at the start of a build in Claude Code, Cursor, Lovable, or a chat.`,
    {
      neighborhood: z.string().optional().describe("The builder's neighborhood or place, if known"),
      what: z.string().optional().describe("What they want to build, in their words, if already said"),
    },
    ({ neighborhood, what }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `For this build, work the way Relational Builder works.

First, call \`get-builder-guidance\` with topic "all" and hold what comes back as your operating stance: the Relational Technology principles are the ground; "How Relational Builder builds" is the practice; pick a frame only if the project has that shape.

${neighborhood ? `My neighborhood: ${neighborhood}\n` : ""}${what ? `What I want to build: ${what}\n` : ""}
Then:

1. **Understand before building.** If you don't yet know who this is for, the one thing it's for, and what the place is like, ask me the two or three questions that matter — one at a time, plain words. Search the commons (\`search-studio-library\`, \`find-patterns-by-context\`) and the seed library (\`search-prompt-seeds\`) for what neighbors elsewhere have already lived with, and tell me what you found and who made it.
2. **Agree on what "the build" is.** Software, a program plan, printable materials, or a mix. Many community projects start with the inviting artifacts, not an app.
3. **Build the core loop, alive.** The one interaction this exists for, end to end on a handful of seeded records and ONE demo neighbor. No external backend, no keys, nothing to configure before something shows. Then stop and name what's next.
4. **Keep it relational.** Every item carries a person; every post opens a path to a person; asks are paired with offers; a visible steward; design toward meeting in person. If it's collapsing into a directory of links, say so and fix it.
5. **Make it theirs.** One concrete visual direction from this place, not the default cream-and-serif look. Real photos first, local artists second, generated images last.
6. **Credit and close the loop.** Name the commons items and seeds the build drew on, in the README and in the app. When something works, offer \`suggest-contribution\` so the next neighborhood starts further along.

Talk about what I'll see, print, and hand out — not the machinery. No flattery. Start with the questions, or if you have enough, say in one line what you'll build first and build it.`,
        },
      }],
    })
  );

  // build-day — at a community build day with your own tools
  s.prompt(
    "build-day",
    `For a builder at a community build day who brought their own AI tool instead of using Relational Builder in the browser. Sets the Relational Builder stance, pulls in the room's live civic data when the day has some, and ends by putting the build on the room's demo wall with share-to-build-day-wall. Give it the event code from the slide.`,
    {
      event_code: z.string().describe("The event code on the room's slide or QR card"),
      builder_name: z.string().optional().describe("The builder's first name"),
      neighborhood: z.string().optional().describe("Their neighborhood or place"),
    },
    ({ event_code, builder_name, neighborhood }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `I'm at a community build day (event code **${event_code}**)${builder_name ? `, I'm ${builder_name}` : ""}${neighborhood ? `, building for ${neighborhood}` : ""}, and I'm building with you instead of in the Relational Builder app. Help me end the day with something real on the room's wall.

**Set the stance.** Call \`get-builder-guidance\` ("all") and work by it for the rest of this conversation: principles as ground, the Builder's practices as method, plain words throughout, no flattery.

**See the room.** Call \`get-build-day-wall\` with ${event_code} so we both know what neighbors here have already shared, and so I'm not building the same thing twice without meaning to.

**Start from what exists.** Before designing, look for a seed (\`search-prompt-seeds\`) or a commons tool or recipe (\`search-studio-library\`) close to what I want, and tell me who made it. Remixing is how relational tech spreads.

**Real data if the day has it.** If my build touches a city's records, call \`find-civic-data-endpoints\` and prefer reading the real rows live over inventing any. When nothing real is in reach, build on a handful of obviously approximate rows and say so plainly in the app and to me. Never invent people presented as real residents.

**Build day sizing.** A few hours, a demo at the end. Build the core loop completely, on seeded data, with one demo neighbor — then stop and polish rather than start a second screen. Everything I'll want after today goes in a short "next" list.

**Put it on the wall.** When something works, draft my card — project name, one line in my words, link if it's deployed, screenshot if I can give you one, my name — show it to me, and once I say yes call \`share-to-build-day-wall\` with builder_confirmed=true. Then tell me the wall link so I can see it next to everyone else's.

**Give it a life after today.** If what we built could help another neighborhood, offer to shape it into a commons contribution (\`suggest-contribution\`).

If you need to know who this is for, the one thing it's for, or what my place is like, ask me now — one question at a time.`,
        },
      }],
    })
  );
}

// ---------------------------------------------------------------------------
// Create the MCP Server (used for stdio mode)
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "rtp-relational-tech",
  version: "0.7.0",
});

registerResources(server);
registerBuilderResources(server);
registerTools(server);
registerBuilderTools(server);
registerPrompts(server);
registerBuilderPrompts(server);

// ---------------------------------------------------------------------------
// Start the Server
// ---------------------------------------------------------------------------

const MODE = process.env.RTP_MCP_TRANSPORT ?? "http";
const PORT = parseInt(process.env.PORT ?? "3000", 10);

async function startStdio() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("RTP Relational Tech MCP server running on stdio");
}

async function startHTTP() {
  const sessions = new Map<string, StreamableHTTPServerTransport>();

  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", server: "rtp-relational-tech", version: "0.7.0", source: "commons" }));
      return;
    }

    if (url.pathname === "/mcp") {
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, GET, OPTIONS, DELETE",
          "Access-Control-Allow-Headers": "Content-Type, Mcp-Session-Id, Authorization",
          "Access-Control-Expose-Headers": "Mcp-Session-Id",
        });
        res.end();
        return;
      }

      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      let transport: StreamableHTTPServerTransport;

      if (sessionId && sessions.has(sessionId)) {
        transport = sessions.get(sessionId)!;
      } else {
        const newSessionId = randomUUID();
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => newSessionId,
          onsessioninitialized: (id) => { sessions.set(id, transport); },
        });

        const perSessionServer = new McpServer({
          name: "rtp-relational-tech",
          version: "0.7.0",
        });
        registerResources(perSessionServer);
        registerBuilderResources(perSessionServer);
        registerTools(perSessionServer);
        registerBuilderTools(perSessionServer);
        registerPrompts(perSessionServer);
        registerBuilderPrompts(perSessionServer);
        await perSessionServer.connect(transport);
      }

      await transport.handleRequest(req, res);
      return;
    }

    // Landing page
    if (url.pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(LANDING_HTML);
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  });

  httpServer.listen(PORT, () => {
    console.error(`RTP Relational Tech MCP server listening on port ${PORT}`);
    console.error(`Health check: http://localhost:${PORT}/health`);
    console.error(`MCP endpoint: http://localhost:${PORT}/mcp`);
  });
}

const LANDING_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>RTP Relational Tech MCP Server</title>
  <meta name="description" content="Connect any MCP-compatible AI tool to the Relational Tech Project commons — methodology, neighborhood recipes, frameworks, field references, live civic data, prompt seeds, and the build day wall — plus the principles and practices Relational Builder builds by.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fraunces:wght@400;600;700;900&display=swap" rel="stylesheet">
  <style>
    /* Matches Relational Tech Studio's warm-craft palette (HSL tokens)
       and typography (Fraunces serif headlines, Inter body). */
    :root {
      --background: hsl(30, 40%, 92%);
      --surface: hsl(30, 45%, 96%);
      --surface-warm: hsl(28, 50%, 94%);
      --foreground: hsl(20, 30%, 22%);
      --muted-foreground: hsl(20, 25%, 48%);
      --quiet: hsl(28, 18%, 58%);
      --primary: hsl(16, 55%, 50%);
      --primary-dark: hsl(16, 65%, 38%);
      --accent: hsl(14, 60%, 55%);
      --border: hsl(28, 25%, 82%);
      --code-bg: hsl(28, 30%, 88%);
      --radius: 0.75rem;
    }

    *, *::before, *::after { box-sizing: border-box; }

    html { -webkit-text-size-adjust: 100%; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      max-width: 780px;
      margin: 0 auto;
      padding: 2.5rem 1.25rem 4rem;
      line-height: 1.65;
      color: var(--foreground);
      background: var(--background);
      font-size: 16px;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    h1, h2, h3 {
      font-family: 'Fraunces', Georgia, serif;
      font-weight: 700;
      letter-spacing: -0.01em;
      line-height: 1.15;
    }

    h1 {
      color: var(--primary-dark);
      font-size: clamp(1.75rem, 4.5vw + 0.8rem, 2.6rem);
      margin: 0 0 0.5rem;
      font-weight: 900;
    }
    h2 {
      color: var(--foreground);
      font-size: clamp(1.25rem, 1.5vw + 0.9rem, 1.5rem);
      margin: 2.4rem 0 0.7rem;
    }
    h3 {
      font-size: 1.05rem;
      margin: 1.4rem 0 0.5rem;
      color: var(--foreground);
      font-weight: 600;
    }

    p { margin: 0.7rem 0; }

    .tagline {
      color: var(--muted-foreground);
      font-size: clamp(0.95rem, 0.4vw + 0.85rem, 1.1rem);
      margin: 0 0 1.4rem;
      max-width: 60ch;
    }

    .badge {
      display: inline-block;
      background: var(--primary);
      color: white;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 0.7rem;
      letter-spacing: 0.04em;
      vertical-align: 0.18em;
      margin-left: 0.4rem;
      font-weight: 600;
      font-family: 'Inter', sans-serif;
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(140px, 100%), 1fr));
      gap: 0.55rem;
      margin: 1.2rem 0 2rem;
    }
    .stat {
      background: var(--surface-warm);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 0.6rem 0.85rem;
      font-size: 0.85rem;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.1rem;
    }
    .stat b {
      color: var(--primary-dark);
      font-size: 1.15rem;
      font-family: 'Fraunces', Georgia, serif;
      font-weight: 700;
    }
    .stat span { color: var(--muted-foreground); font-size: 0.8rem; }

    code {
      background: var(--code-bg);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.85em;
      font-family: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace;
      word-break: break-word;
    }

    pre {
      background: var(--code-bg);
      padding: 0.9rem 1rem;
      border-radius: var(--radius);
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      font-size: 0.82em;
      border: 1px solid var(--border);
      font-family: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace;
      line-height: 1.55;
      margin: 0.8rem 0;
    }

    a {
      color: var(--primary-dark);
      text-decoration: underline;
      text-decoration-thickness: 1px;
      text-underline-offset: 2px;
    }
    a:hover { color: var(--primary); }

    ul { padding-left: 1.2rem; margin: 0.7rem 0; }
    li { margin: 0.35rem 0; }

    .surface {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 1.1rem 1.2rem;
      margin: 1rem 0;
    }

    .quiet {
      color: var(--quiet);
      font-size: 0.88rem;
      margin-bottom: 0;
    }
    .quiet em { font-style: italic; }

    .endpoint {
      font-family: ui-monospace, "SF Mono", Menlo, monospace;
      background: var(--primary);
      color: white;
      padding: 0.4rem 0.75rem;
      border-radius: 6px;
      display: inline-block;
      font-size: 0.85rem;
      word-break: break-all;
      margin-top: 0.25rem;
    }

    .examples { padding-left: 0; }
    .examples li {
      list-style: none;
      padding-left: 1.3rem;
      position: relative;
      margin: 0.5rem 0;
    }
    .examples li::before {
      content: "→";
      color: var(--primary);
      font-weight: 700;
      position: absolute;
      left: 0;
    }

    .footer {
      margin-top: 3rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border);
      color: var(--quiet);
      font-size: 0.85rem;
    }
    .footer em {
      font-family: 'Fraunces', Georgia, serif;
      font-style: italic;
      font-size: 0.95rem;
      color: var(--muted-foreground);
    }

    /* Mobile tweaks */
    @media (max-width: 520px) {
      body {
        padding: 1.75rem 1rem 3rem;
        font-size: 15.5px;
      }
      pre { font-size: 0.78em; padding: 0.8rem 0.9rem; }
      .stat { padding: 0.55rem 0.75rem; }
      .stat b { font-size: 1.05rem; }
      .badge { display: inline-block; margin-left: 0.3rem; }
      .surface { padding: 1rem; }
      h2 { margin-top: 2rem; }
    }
  </style>
</head>
<body>
  <h1>RTP Relational Tech MCP Server <span class="badge">v0.6.0</span></h1>
  <p class="tagline">Connect any MCP-compatible AI tool to the <a href="https://relationaltechproject.org">Relational Tech Project</a> commons — the Studio's remixable builder tools, stories, and prompts, plus methodology, neighborhood recipes, frameworks, and field references. Search is semantic: describe a need in plain language.</p>

  <div class="stats">
    <div class="stat"><b>350+</b> <span>commons items</span></div>
    <div class="stat"><b>25</b> <span>builder tools</span></div>
    <div class="stat"><b>45</b> <span>builder stories</span></div>
    <div class="stat"><b>63</b> <span>recipes</span></div>
    <div class="stat"><b>197</b> <span>field references</span></div>
    <div class="stat"><b>15</b> <span>frameworks &amp; methodology</span></div>
  </div>

  <h2>Connect</h2>
  <p>Add this to your AI tool's MCP configuration:</p>
  <pre>{
  "mcpServers": {
    "relational-tech": {
      "type": "streamable-http",
      "url": "https://mcp.relationaltechproject.org/mcp"
    }
  }
}</pre>

  <p><strong>Endpoint:</strong><br><span class="endpoint">https://mcp.relationaltechproject.org/mcp</span></p>

  <div class="surface">
    <h3 style="margin-top:0;">Where this goes</h3>
    <ul>
      <li><strong>Claude Code</strong> — paste into <code>.mcp.json</code> or run <code>claude mcp add relational-tech --type streamable-http --url https://mcp.relationaltechproject.org/mcp</code></li>
      <li><strong>Claude Desktop</strong> — Settings → Developer → Edit Config</li>
      <li><strong>Cursor, Windsurf, Zed, etc.</strong> — any tool that supports MCP Streamable HTTP</li>
    </ul>
    <p class="quiet">No API key. No signup. Reads are public via row-level security; contributions land in a stewarded review queue — nothing publishes without a human.</p>
  </div>

  <h2>Start here: two prompts</h2>
  <p>Once connected, invoke the <code>practice-guide</code> prompt to put your AI in a Neighboring Commons practice-guide stance for the rest of the conversation: relationships-first, asset-based, citing practitioners by name, calibrating confidence honestly.</p>
  <p>Building a tool? Invoke <code>relational-builder-stance</code> instead. It loads the principles and working practices <a href="https://relationalbuilder.org">Relational Builder</a> builds by, so Claude Code, Cursor, Lovable, or a chat window builds from the same ground: the first build as the core loop alive, one seeded neighbor, every post opening a path to a person, a look that comes from the place.</p>

  <h2>At a community build day with your own tools</h2>
  <p>Invoke the <code>build-day</code> prompt with the event code from the room's slide. Your AI sets the Builder stance, looks at what the room has already shared, pulls the city's live open data when the day has some, sizes the build for an afternoon, and when something works pins it to the room's demo wall with <code>share-to-build-day-wall</code>, next to the builds made in the Builder itself. Prefer email? Send the project to the build day inbox on the slide with the event code in the subject line, a link, and a screenshot.</p>

  <h2>What you can ask</h2>
  <ul class="examples">
    <li>"Help me design a fix-it fair for my neighborhood"</li>
    <li>"I want to start a mutual aid pod on my block — where do I begin?"</li>
    <li>"What's microsolidarity, and how does it differ from mutual aid?"</li>
    <li>"How do I host a block party? What does Vanessa Elias do at Block Party USA?"</li>
    <li>"I'm feeling burned out from community organizing — what do practitioners recommend?"</li>
  </ul>
  <p>Your AI will surface relevant recipes, frameworks, methodology, and practitioner references — with attribution and source URLs so you can read the original work.</p>

  <h2>What's in the toolbox</h2>
  <p><strong>12 tools</strong>: <code>search-studio-library</code>, <code>get-tool-details</code>, <code>find-patterns-by-context</code>, <code>suggest-contribution</code>, <code>submit-contribution</code>, <code>get-network-updates</code>, <code>get-builder-guidance</code>, <code>find-civic-data-endpoints</code>, <code>search-prompt-seeds</code>, <code>get-prompt-seed</code>, <code>get-build-day-wall</code>, <code>share-to-build-day-wall</code></p>
  <p><strong>8 prompts</strong>: <code>practice-guide</code>, <code>relational-builder-stance</code>, <code>build-day</code>, <code>design-neighborhood-tool</code>, <code>assess-relational-soil</code>, <code>create-builder-action-plan</code>, <code>remix-existing-tool</code>, <code>create-build-plan</code></p>
  <p><strong>12 resources</strong>: 9 methodology docs at <code>rtp://knowledge/*</code> (queried live from the commons) and 3 at <code>rtp://builder/*</code> — Relational Builder's principles, practices, and domain frames, generated from its source on every deploy</p>

  <h2>Source &amp; details</h2>
  <p>Open source on <a href="https://github.com/The-Relational-Technology-Project/rt-mcp-server">GitHub</a>. See the README for the full architecture, deployment guide, and how the commons works.</p>
  <p>Health check: <a href="/health">/health</a></p>

  <div class="footer">
    <p>Made by the <a href="https://relationaltechproject.org">Relational Tech Project</a>. The Studio is at <a href="https://studio.relationaltechproject.org">studio.relationaltechproject.org</a>.</p>
    <p><em>"We are the river — carrying stories, tools, learning, and relationships across many local gardens, while honoring that each garden must be tended by those who live there."</em></p>
  </div>
</body>
</html>`;

if (MODE === "stdio") {
  startStdio().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
} else {
  startHTTP();
}
