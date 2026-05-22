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

Once you've gathered this through conversation, the builder can contribute directly at ${STUDIO_CONTRIBUTE_URL} — they can create an account and add their tool to the commons.

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

The builder can contribute directly at ${STUDIO_CONTRIBUTE_URL} — create an account and add their story to the commons.

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

The builder can add community notes directly at ${STUDIO_CONTRIBUTE_URL} — find the item and add a note.`,

  unsure: `# Contributing to the Commons

Not sure what kind of contribution fits? Here's a quick guide:

- **Built a tool or remixed one?** → Share it as a Tool contribution
- **Have a story about what happened in your neighborhood?** → Share it as a Builder Story
- **Used an existing item and have advice?** → Add a Community Note
- **Documented a neighborhood practice that isn't in the commons yet?** → That's a Recipe — share it!

Ask the builder to describe what they've been working on or experiencing, and help them figure out which type fits. It's also fine to contribute more than one thing!

All contributions can be made at ${STUDIO_CONTRIBUTE_URL} — create an account to get started.`,
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
        "Free-text search query (matches title, summary, tags, body). Leave empty to browse everything."
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
          // Use full-text search RPC
          const rpcResults = await commonsRpc("search_commons_items", {
            query_text: query,
            match_count: cap,
            filter_kinds: filterKinds,
          }) as Array<Partial<CommonsItem> & { rank?: number }>;
          items = Array.isArray(rpcResults) ? rpcResults : [];
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
        const items = await commonsFetch(
          `/commons_items?select=id,slug,kind,title,summary,body,attribution,source_studio_slug,source_url,tags,parent_slug,metadata&title=ilike.${needle}${kindFilter}&status=eq.canonical&limit=5`
        ) as Array<Partial<CommonsItem>>;

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

      // Live search the commons using the situation as a search query
      try {
        const matches = await commonsRpc("search_commons_items", {
          query_text: situation,
          match_count: 8,
          filter_kinds: ["recipe", "tool", "story", "framework"],
        }) as Array<Partial<CommonsItem> & { rank?: number }>;

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
    `Help a builder shape their experience into a contribution for the RT commons. Call this when a builder wants to share a tool they built, a story from their neighborhood, a recipe, or a community note. Returns a guided framework the AI can use to help the builder draft their contribution conversationally.`,
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
  // get-network-updates — Watcher feed of GitHub repo activity
  // (still queries updates.relationaltechproject.org directly; will switch
  // to commons_feed_events once Watcher ingest is wired up)
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

      try {
        const res = await fetch(FEED_URL);
        if (!res.ok) {
          return {
            content: [{ type: "text" as const, text: `Could not reach the network updates feed (HTTP ${res.status}). The feed is generated by a GitHub Action and may be temporarily unavailable.` }],
          };
        }

        let entries = (await res.json()) as Array<Record<string, unknown>>;
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

Take your time. This is a conversation, not a checklist.`,
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
- If it works, contribute it back via suggest-contribution`,
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
  version: "0.2.0",
});

registerResources(server);
registerTools(server);
registerPrompts(server);

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
      res.end(JSON.stringify({ status: "ok", server: "rtp-relational-tech", version: "0.2.0", source: "commons" }));
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
          version: "0.2.0",
        });
        registerResources(perSessionServer);
        registerTools(perSessionServer);
        registerPrompts(perSessionServer);
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
<html>
<head>
  <meta charset="utf-8">
  <title>RTP Relational Tech MCP Server</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 700px; margin: 4rem auto; padding: 0 1.5rem; line-height: 1.6; color: #2d2d2d; background: #faf5ee; }
    h1 { font-family: Georgia, serif; color: #8b3a1f; }
    code { background: #f0e6d2; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
    pre { background: #f0e6d2; padding: 1rem; border-radius: 6px; overflow-x: auto; font-size: 0.85em; }
    a { color: #8b3a1f; }
    .badge { display: inline-block; background: #8b3a1f; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.75em; }
  </style>
</head>
<body>
  <h1>RTP Relational Tech MCP Server <span class="badge">v0.2.0</span></h1>
  <p>An MCP server carrying relational tech principles, neighborhood recipes, builder stories, and the RTP commons library to any AI builder tool.</p>
  <h2>Connect</h2>
  <p>Add to your <code>.mcp.json</code>:</p>
  <pre>{
  "mcpServers": {
    "relational-tech": {
      "type": "streamable-http",
      "url": "https://mcp.relationaltechproject.org/mcp"
    }
  }
}</pre>
  <p>Then invoke the <code>practice-guide</code> prompt to adopt the Neighboring Commons stance for the rest of your conversation.</p>
  <h2>Source</h2>
  <p>Open source on <a href="https://github.com/The-Relational-Technology-Project/rt-mcp-server">GitHub</a>. Built by the <a href="https://relationaltechproject.org">Relational Technology Project</a>.</p>
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
