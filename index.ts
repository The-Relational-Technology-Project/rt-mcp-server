#!/usr/bin/env node

/**
 * RTP Relational Tech MCP Server
 *
 * An MCP server that carries relational tech principles, patterns, and the
 * Studio library to any AI builder tool. Built by the Relational Tech Project.
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
// Studio API Configuration
// ---------------------------------------------------------------------------

const SUPABASE_URL = "https://ivrvpbqidysrwqrthpcp.supabase.co/rest/v1";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2cnZwYnFpZHlzcndxcnRocGNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NzQ4NDQsImV4cCI6MjA3NTQ1MDg0NH0.fBKxzaiUspapVYq7xT60EHHVgWR-DcolUW2Cy90GHHc";

async function studioFetch(path: string): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Studio API error: ${res.status} ${res.statusText}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Embedded Knowledge — Core Frameworks & Principles
// ---------------------------------------------------------------------------

const CORE_PRINCIPLES = `# RTP Core Principles

## Technology Built By and Accountable To the People It Serves
RTP's origin principle. Technology is a means, not an end. The people closest
to the work should shape the tools.

## The River, Not the Gardener
RTP provides scalable infrastructure while respecting local autonomy. Like a
river that nourishes many gardens without dictating what grows, RTP creates
conditions for community life to flourish on its own terms. Builders don't
need permission; they need pathways.

## Relationships First, Tools Second
The strongest community infrastructure is built on trust, not technology.
Digital tools should amplify existing relationships and create conditions for
new ones — never replace face-to-face connection.

## Asset-Based Approach
Every neighborhood already has what it needs to begin. Start by mapping what
exists — people, skills, spaces, traditions, informal networks — rather than
cataloging deficits.

## Speed of Trust
Community building unfolds at the pace of human relationships. Resist the urge
to scale before depth is established. Deep roots in one block are worth more
than shallow presence across a city.`;

const RELATIONAL_TECH_PRACTICE = `# A Relational Tech Practice

Relational tech is a practice with four dimensions:

## 1. Purpose
Reconnect with people and the place where we live, cultivating healthy
relational soil — the conditions in which agency, belonging, and trust
can grow.

## 2. Process: Embedded Design
Spend less time building in isolation and more time in the messiness and
beauty of community life. Dreams emerge from accountable relationships,
time spent in the world together, and local needs identified through deep
listening. The result is small, meaningful software that fits its community.

## 3. Math: 1:100
Fewer "users," more co-creators. One primary builder to 100 neighbors who
rely on and co-create the tools. This reflects the emerging profession of
"local relational technologist" — people who practice their craft in service
of place.

## 4. Path: Scale Deep, Spread Horizontal
Scale deep in place and spread horizontally, neighborhood to neighborhood,
through remixing rather than replication. Each place carries its own histories,
wounds, wisdom, and gifts. Relational technology is crafted locally, through
attunement and shared discernment.`;

const THREE_LAYERS = `# Three Layers of Neighborhood Infrastructure

## Layer 1: Relational Layer (Foundation)
Who knows whom? Where does trust live? This is the bedrock.
Most builders want to skip to Layer 2, but the strongest infrastructure
builds this layer first.

## Layer 2: Information Layer
How do people learn what's happening? Calendars, channels, newsletters,
directories — the connective tissue of neighborhood awareness.

## Layer 3: Action Layer
How do people help each other? Mutual aid, shared resources, collective
projects, tool libraries, cooperative care.

## The Outer Sunset Ecosystem (Reference Implementation)

### Neighborhood Scale (Public)
- Outer Sunset Today — Community calendar & daily digest (outersunset.today)
- Community Guide — Directory of local groups (outersunset.us)
- Field Guide — Walking exploration app with past/present/future (outersunset.place)

### Block Scale (Semi-Public)
- Cozy Corner — 48th Ave block hub for events, ideas, links (cozycorner.place)
- Community Supplies — Tool, gear & book lending library (communitysupplies.org)
- Block Party Planner — Event coordination
- Flyer Map Maker — Design tool for outreach

### Private Channels (Invite-Only)
- Mutual Aid Pod (25 members)
- Block Neighbors (35 members)
- Affinity groups (parents, etc.)

These three scales — neighborhood, block, private — form a pattern that can
be adapted to any place.`;

const BUILDER_SPECTRUM = `# The Builder Spectrum

People come to community building at different stages. Meet builders where
they are, not where you wish they were.

## Curious
"I wish my neighborhood felt more connected."
→ Join existing local channels. Don't build yet. Listen.

## Experimenting
"I started a group chat / hosted a gathering."
→ WhatsApp group + shared Google Calendar. Keep it simple.

## Building
"I'm setting up systems and recruiting co-builders."
→ Newsletter + calendar + one action channel. Find co-builders.

## Sustaining
"How do I keep this going without burning out?"
→ Field guide + signals + mutual aid structure. Rotate roles.

## Scaling
"How do I share what's working with other neighborhoods?"
→ Studio platform + cross-neighborhood connections. Document and remix.`;

const MEASUREMENT_FRAMEWORK = `# Measuring What Matters: Agency, Belonging, Trust

Relational tech isn't measured by users or engagement metrics. It's measured
by what grows in the soil it helps cultivate.

## Agency
People experience themselves as capable stewards of their community.
- How many people are building relational tech?
- What are their stories of capability and action?
- Are people solving local problems with local tools?

## Belonging
People feel that they — and their dreams and gifts — matter where they live.
- Are people co-creating tools together?
- Do builders report their own sense of belonging changing?
- Are diverse voices and perspectives present?

## Trust
People feel motivated to engage in generalized reciprocity and shared care.
- Are relational tech tools helping people connect more deeply?
- Are neighbors engaging in mutual aid and shared care?
- Is trust growing across difference, not just within groups?

These three outcomes reinforce each other. Agency without belonging becomes
isolation. Belonging without trust becomes a bubble. Trust without agency
becomes dependence.`;

const EMBEDDED_DESIGN_GUIDE = `# Embedded Design: A Guide for Builders

Embedded design is RTP's core methodology for building relational tech.
It inverts the typical software development process.

## The Inversion
Traditional: Identify problem → Design solution → Build → Ship → Get users
Embedded:    Be in community → Notice what's needed → Build with neighbors →
             Iterate together → Tool earns its place

## Before You Build Anything
1. Spend time in the place. Walk the neighborhood. Go to events. Be a
   neighbor first, a builder second.
2. Listen for recurring themes. What do people wish existed? What's hard?
   What's beautiful?
3. Map what already exists. There are always existing assets — people,
   spaces, channels, traditions. Build on these, don't replace them.
4. Find co-builders. If you can't find at least one person who wants to
   build this with you, you might be solving the wrong problem.

## While You Build
1. Build the smallest useful thing. Not an MVP — a "minimum relational
   thing." Something that creates one connection that didn't exist before.
2. Test with real neighbors, not personas. The people on your block, at
   your café, in your group chat. Real feedback from real relationships.
3. Let the tool earn its place. Don't promote it. Let it spread through
   the relationships it serves. If people share it, it's working.
4. Stay accountable. The 1:100 ratio means you know the people using what
   you build. You see them at the store. This accountability is a feature.

## Design Principles
- Simple over feature-rich
- Accessible over sophisticated
- Local over universal
- Accountable over scalable
- Open over proprietary
- Remix over replicate

## Common Mistakes
- Building in isolation, then "launching" to the community
- Optimizing for growth instead of depth
- Adding features instead of deepening relationships
- Assuming digital = better
- Copying what worked elsewhere without local adaptation`;

const PLAYBOOKS = `# Playbooks for Common Builder Needs

## Start a Neighborhood Communication Channel
1. Identify 5 anchor neighbors already informally connected
2. Have 1-on-1 conversations first — don't just add people to a group
3. Choose the simplest tool (WhatsApp, group text)
4. Set the tone with the first message — introduce yourself, name a
   specific purpose
5. Seed early activity in the first 48 hours
6. Invite gradually — 2-3 people per week
7. Establish norms by modeling the behavior you want to see

Pitfalls: Starting too big, not setting norms, builder doing all the posting.

## Host a First Gathering
1. Low-barrier format — coffee on the sidewalk, potluck, porch hangout
2. Choose a time that works for your street's rhythm
3. Invite personally — door knocks, hand-written notes, texts
4. Have a simple prompt ("What do you love about living here?")
5. Show up 15 minutes early
6. Capture contact info
7. Follow up within 48 hours
8. Name the next gathering before people leave

Pitfalls: Too formal, no follow-up, waiting for perfect conditions.

## Launch a Neighborhood Calendar
1. Audit what exists (bulletin boards, Facebook groups, word of mouth)
2. Start a shared Google Calendar
3. Seed with 10-15 events (recurring + one-time)
4. Recruit 2-3 co-curators (café owners, librarians, PTA parents)
5. Share widely through existing channels
6. Consider automation for scraping event sources
7. Keep it alive — update weekly

Scaling: Calendar → Weekly digest → Custom alerts (Sunset Signals model).

## Build a Mutual Aid Pod
1. Start with existing trust — don't organize strangers into a pod
2. Keep it small (5-15 households)
3. Define what kinds of help you'll share
4. Dedicated communication channel
5. Weekly check-in rhythm
6. Rotate coordination monthly
7. Practice before crisis with small exchanges

Pitfalls: One-directional giving, no practice, too formal.

## Map Neighborhood Assets
1. Physically walk every block
2. Talk to 10 people ("Who should everyone know?" "Where do people gather?")
3. Map people, places, and organizations
4. Look for connection gaps between existing assets
5. Share what you find — even rough lists create immediate value

## The Builder Loop (Meta-Pattern)
Listen → Connect → Build → Reflect → Adapt → Share → Repeat
This is not a project with an end date; it's a practice.`;

const CHALLENGES_GUIDE = `# Navigating Common Challenges

## Trust Building
Show up consistently. Start with listening. Be transparent about intentions.
Deliver on small promises. Bridge across difference — the hardest trust to
build is often the most valuable.
Red flags: Rushing to organize before relationships exist. Assuming digital
connection equals trust.

## Burnout & Sustainability
Co-build from day one. Rotate roles. Set boundaries. Celebrate small wins.
Rest is not failure — if things stop when you rest, the infrastructure wasn't
sustainable.
Red flags: "I'll just do it myself." Checking group chats constantly. Guilt
about time off.

## Scale & Complexity
Deepen before you widen. Use the pod model (5-15 people with bridges between
groups). Layer your channels. Delegate whole domains, not just tasks. Accept
messiness — the "river, not the gardener" means letting go.

## Digital Literacy & Access
Always maintain an analog channel. Choose lowest-barrier tools. Offer gentle
onboarding. Design for phones. Translate if multilingual.
Red flags: Assuming "everyone is on WhatsApp." English-only defaults.

## Language & Cultural Barriers
Learn the landscape. Find bridge-builders who move between communities.
Translate key infrastructure. Respect different organizing traditions.
Show up at their events before inviting them to yours.

## Conflict & Disagreement
Normalize disagreement. Create structured spaces for hard conversations.
Focus on shared interests. Don't take sides as a builder. Know when to
step back and refer to mediation.

## Maintaining Momentum
Rhythm over events. Rituals matter. Regularly invite new people. Evolve
the offering. Celebrate milestones.`;

const NETWORK_AND_COMMUNITY = `# Network & Community Connections

## The RTP Network
- RTP Studio: Structured learning platform with cohort-based curriculum.
  Best for builders at "Building" or "Sustaining" stage.
  URL: studio.relationaltechproject.org
- Civic Label Network: 50+ cross-sector civic practitioners. Cooperative
  model that reframes civic culture workers as artists deserving collective
  backing.

## Connection Patterns for Builders

### New Builders
- Find your local equivalent — every neighborhood has informal connectors
- Join before you build — participate in existing groups for a month first
- Look for adjacent builders in nearby neighborhoods

### Established Builders
- Document and share what's working
- Host a visiting builder from another neighborhood
- Contribute patterns to the knowledge commons
- Mentor a newer builder

### Builders Feeling Isolated
- You're not alone — this work is hard and invisible. That's normal.
- Even one peer in another neighborhood is transformative
- Join a cohort for structured peer connection
- Lower the bar — scale back to one practice until energy returns

## Adjacent Movements
- Block club / block captain networks
- Mutual aid networks (many formed during COVID, still active)
- Code for America brigades and civic tech meetups
- Community land trusts and cooperative housing
- Restorative justice circles
- Time banks and skill shares`;

// ---------------------------------------------------------------------------
// Registration Functions
// (Extracted so both stdio and per-session HTTP servers can use them)
// ---------------------------------------------------------------------------

function registerResources(s: McpServer) {
  s.resource(
    "core-principles",
    "rtp://knowledge/core-principles",
    { description: "RTP's foundational principles: technology accountable to people, the river metaphor, relationships first, asset-based approach, speed of trust" },
    () => ({ contents: [{ uri: "rtp://knowledge/core-principles", text: CORE_PRINCIPLES, mimeType: "text/markdown" }] })
  );

  s.resource(
    "relational-tech-practice",
    "rtp://knowledge/relational-tech-practice",
    { description: "The four dimensions of relational tech practice: purpose, process (embedded design), math (1:100), and path (scale deep, spread horizontal)" },
    () => ({ contents: [{ uri: "rtp://knowledge/relational-tech-practice", text: RELATIONAL_TECH_PRACTICE, mimeType: "text/markdown" }] })
  );

  s.resource(
    "three-layers",
    "rtp://knowledge/three-layers",
    { description: "Three layers of neighborhood infrastructure (relational, information, action) with the Outer Sunset ecosystem as reference implementation" },
    () => ({ contents: [{ uri: "rtp://knowledge/three-layers", text: THREE_LAYERS, mimeType: "text/markdown" }] })
  );

  s.resource(
    "builder-spectrum",
    "rtp://knowledge/builder-spectrum",
    { description: "The five stages of a community builder's journey: curious, experimenting, building, sustaining, scaling — with guidance for each stage" },
    () => ({ contents: [{ uri: "rtp://knowledge/builder-spectrum", text: BUILDER_SPECTRUM, mimeType: "text/markdown" }] })
  );

  s.resource(
    "measurement-framework",
    "rtp://knowledge/measurement",
    { description: "How to measure relational outcomes: agency, belonging, and trust — the three things healthy relational soil cultivates" },
    () => ({ contents: [{ uri: "rtp://knowledge/measurement", text: MEASUREMENT_FRAMEWORK, mimeType: "text/markdown" }] })
  );

  s.resource(
    "embedded-design-guide",
    "rtp://knowledge/embedded-design",
    { description: "Complete guide to embedded design methodology: the inversion of traditional software development, principles, process, and common mistakes" },
    () => ({ contents: [{ uri: "rtp://knowledge/embedded-design", text: EMBEDDED_DESIGN_GUIDE, mimeType: "text/markdown" }] })
  );

  s.resource(
    "playbooks",
    "rtp://knowledge/playbooks",
    { description: "Step-by-step playbooks for common builder needs: starting communication channels, hosting gatherings, launching calendars, mutual aid pods, asset mapping" },
    () => ({ contents: [{ uri: "rtp://knowledge/playbooks", text: PLAYBOOKS, mimeType: "text/markdown" }] })
  );

  s.resource(
    "challenges-guide",
    "rtp://knowledge/challenges",
    { description: "Guide to navigating common community building challenges: trust, burnout, scale, digital access, language barriers, conflict, momentum" },
    () => ({ contents: [{ uri: "rtp://knowledge/challenges", text: CHALLENGES_GUIDE, mimeType: "text/markdown" }] })
  );

  s.resource(
    "network-and-community",
    "rtp://knowledge/network",
    { description: "RTP network connections, adjacent movements, and guidance for builders at every stage on finding peers and community" },
    () => ({ contents: [{ uri: "rtp://knowledge/network", text: NETWORK_AND_COMMUNITY, mimeType: "text/markdown" }] })
  );
}

function registerTools(s: McpServer) {
  s.tool(
    "search-studio-library",
    `Search the Relational Tech Studio library for tools, stories, and building resources.
The Studio is a living, growing commons of relational tech — tools that builders
have created, stories from real neighborhoods, and community notes with practical wisdom.
Use this to find relevant patterns, tools, and inspiration for a builder's specific context.`,
    {
      category: z.enum(["all", "relational_tech", "tech_for_building"]).default("all")
        .describe("Filter by tool category: 'relational_tech' for community/connection tools, 'tech_for_building' for infrastructure tools, or 'all' for everything"),
      include_stories: z.boolean().default(true)
        .describe("Whether to also fetch real builder stories from the library"),
      include_notes: z.boolean().default(true)
        .describe("Whether to include community notes and tips on tools"),
    },
    async ({ category, include_stories, include_notes }) => {
      const results: string[] = [];

      try {
        const toolFilter = category !== "all" ? `&tool_category=eq.${category}` : "";
        const tools = await studioFetch(
          `/tools?select=id,name,description,summary,tool_category,url${toolFilter}`
        ) as Array<Record<string, unknown>>;

        results.push("# Tools from the Studio Library\n");
        if (Array.isArray(tools) && tools.length > 0) {
          for (const tool of tools) {
            results.push(`## ${tool.name || "Unnamed Tool"}`);
            if (tool.summary) results.push(`${tool.summary}`);
            if (tool.description) results.push(`${tool.description}`);
            if (tool.tool_category) results.push(`Category: ${tool.tool_category}`);
            if (tool.url) results.push(`URL: ${tool.url}`);
            results.push("");
          }
        } else {
          results.push("No tools found for the given filter.\n");
        }

        const prompts = await studioFetch(
          `/prompts?select=title,description,example_prompt,category,parent_tool_id`
        ) as Array<Record<string, unknown>>;

        if (Array.isArray(prompts) && prompts.length > 0) {
          results.push("\n# Tool Prompts & Usage Patterns\n");
          for (const prompt of prompts) {
            results.push(`## ${prompt.title || "Untitled Prompt"}`);
            if (prompt.description) results.push(`${prompt.description}`);
            if (prompt.example_prompt) results.push(`Example: ${prompt.example_prompt}`);
            if (prompt.category) results.push(`Category: ${prompt.category}`);
            results.push("");
          }
        }

        if (include_stories) {
          const stories = await studioFetch(
            `/stories?select=title,story_text,full_story_text,attribution`
          ) as Array<Record<string, unknown>>;

          if (Array.isArray(stories) && stories.length > 0) {
            results.push("\n# Builder Stories\n");
            for (const story of stories) {
              results.push(`## ${story.title || "Untitled Story"}`);
              if (story.full_story_text) {
                results.push(`${story.full_story_text}`);
              } else if (story.story_text) {
                results.push(`${story.story_text}`);
              }
              if (story.attribution) results.push(`— ${story.attribution}`);
              results.push("");
            }
          }
        }

        if (include_notes) {
          const toolNotes = await studioFetch(
            `/tool_notes?select=note_text,author_name,tool_id`
          ) as Array<Record<string, unknown>>;

          if (Array.isArray(toolNotes) && toolNotes.length > 0) {
            results.push("\n# Community Notes on Tools\n");
            for (const note of toolNotes) {
              results.push(`- ${note.note_text}`);
              if (note.author_name) results.push(`  — ${note.author_name}`);
            }
            results.push("");
          }

          const storyNotes = await studioFetch(
            `/story_notes?select=note_text,author_name,story_id`
          ) as Array<Record<string, unknown>>;

          if (Array.isArray(storyNotes) && storyNotes.length > 0) {
            results.push("\n# Community Notes on Stories\n");
            for (const note of storyNotes) {
              results.push(`- ${note.note_text}`);
              if (note.author_name) results.push(`  — ${note.author_name}`);
            }
          }
        }

        return { content: [{ type: "text" as const, text: results.join("\n") }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error querying Studio library: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  s.tool(
    "get-tool-details",
    `Get detailed information about a specific tool from the Studio library,
including community notes, linked prompts, and usage guidance.`,
    {
      tool_name: z.string().describe("Name or partial name of the tool to look up"),
    },
    async ({ tool_name }) => {
      try {
        const tools = await studioFetch(
          `/tools?select=id,name,description,summary,tool_category,url&name=ilike.*${encodeURIComponent(tool_name)}*`
        ) as Array<Record<string, unknown>>;

        if (!Array.isArray(tools) || tools.length === 0) {
          return {
            content: [{ type: "text" as const, text: `No tools found matching "${tool_name}". Try searching the full library with search-studio-library.` }],
          };
        }

        const results: string[] = [];

        for (const tool of tools) {
          results.push(`# ${tool.name}\n`);
          if (tool.summary) results.push(`**Summary:** ${tool.summary}\n`);
          if (tool.description) results.push(`${tool.description}\n`);
          if (tool.tool_category) results.push(`**Category:** ${tool.tool_category}`);
          if (tool.url) results.push(`**URL:** ${tool.url}`);
          results.push("");

          if (tool.id) {
            const prompts = await studioFetch(
              `/prompts?select=title,description,example_prompt,category&parent_tool_id=eq.${tool.id}`
            ) as Array<Record<string, unknown>>;

            if (Array.isArray(prompts) && prompts.length > 0) {
              results.push("## Prompts & Usage Patterns\n");
              for (const prompt of prompts) {
                results.push(`### ${prompt.title || "Untitled"}`);
                if (prompt.description) results.push(String(prompt.description));
                if (prompt.example_prompt) results.push(`\nExample prompt: "${prompt.example_prompt}"`);
                results.push("");
              }
            }

            const notes = await studioFetch(
              `/tool_notes?select=note_text,author_name&tool_id=eq.${tool.id}`
            ) as Array<Record<string, unknown>>;

            if (Array.isArray(notes) && notes.length > 0) {
              results.push("## Community Notes\n");
              for (const note of notes) {
                results.push(`- ${note.note_text}`);
                if (note.author_name) results.push(`  — ${note.author_name}`);
              }
            }
          }
        }

        return { content: [{ type: "text" as const, text: results.join("\n") }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error fetching tool details: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  s.tool(
    "find-patterns-by-context",
    `Match a builder's specific situation to relevant relational tech patterns,
tools, and guidance. Describe the builder's context and this tool will return
the most relevant resources from both the embedded knowledge base and the
live Studio library.`,
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

      try {
        const tools = await studioFetch(`/tools?select=name,summary,tool_category,url`) as Array<Record<string, unknown>>;

        if (Array.isArray(tools) && tools.length > 0) {
          results.push("## Relevant Tools from the Studio Library\n");
          for (const tool of tools) {
            results.push(`- **${tool.name}**: ${tool.summary || tool.tool_category || ""}`);
            if (tool.url) results.push(`  ${tool.url}`);
          }
          results.push("");
        }

        const stories = await studioFetch(`/stories?select=title,story_text,attribution`) as Array<Record<string, unknown>>;

        if (Array.isArray(stories) && stories.length > 0) {
          results.push("## Stories from Other Builders\n");
          for (const story of stories) {
            results.push(`### ${story.title || "A Builder's Story"}`);
            if (story.story_text) results.push(String(story.story_text));
            if (story.attribution) results.push(`— ${story.attribution}`);
            results.push("");
          }
        }
      } catch (error) {
        results.push(`\n(Could not reach Studio library: ${error instanceof Error ? error.message : String(error)})`);
      }

      return { content: [{ type: "text" as const, text: results.join("\n") }] };
    }
  );
}

function registerPrompts(s: McpServer) {
  s.prompt(
    "design-neighborhood-tool",
    `Guided embedded design process for creating a new neighborhood-scale tool.
Walks through RTP's embedded design methodology step by step: understanding
context, mapping assets, identifying needs through relationships, designing
with (not for) neighbors, and building the smallest useful thing.`,
    {
      neighborhood: z.string().optional().describe("Name or description of the neighborhood"),
      builder_role: z.string().optional().describe("How the builder sees their role (neighbor, organizer, parent, etc.)"),
      initial_idea: z.string().optional().describe("What the builder is thinking of building, if anything"),
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

1. **Understand my place.** Ask about my neighborhood — its character, history,
   who lives there, what already exists. Every place carries its own stories
   and gifts.

2. **Map my assets.** Help me see what's already here — people, spaces, channels,
   traditions, informal networks. Start from abundance, not deficit.

3. **Explore relationships.** Who do I already know and trust? Where does energy
   live? What are people already doing informally that could be supported?

4. **Listen for needs.** Through the relationships and assets I describe, help me
   notice what's needed. Not from surveys — from stories, from being present.

5. **Design the smallest thing.** When we have enough context, help me design
   the minimum relational thing — the smallest tool that creates one connection
   that didn't exist before.

6. **Check the principles.** Before we finalize anything, run it through:
   - Is this built by and accountable to the people it serves?
   - Does it put relationships first, tools second?
   - Does it build on existing assets?
   - Is it simple, accessible, local, and open?
   - Can it earn its place through word of mouth?
   - Does it fit the 1:100 ratio?

## Key RTP Principles to Hold
- "Spend less time building in isolation and more time in the messiness and
  beauty of community life"
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
    `Help a builder understand the current state of relational health in their
neighborhood — the agency, belonging, and trust that already exists, and
where there might be room to cultivate more.`,
    {
      neighborhood: z.string().optional().describe("Name or description of the neighborhood"),
    },
    ({ neighborhood }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `You are a relational tech partner helping me assess the relational soil in ${neighborhood || "my neighborhood"}.

Relational soil is the conditions in which agency, belonging, and trust can grow.
Every neighborhood has some — the question is understanding what's already there
and where there's room to cultivate more.

Guide me through an assessment by asking about:

## Agency — Do people here see themselves as capable stewards?
- Who's already building or organizing things?
- When something needs fixing, do people act or wait for someone else?
- Are there local builders, makers, or leaders who others look to?

## Belonging — Do people feel they matter here?
- Where do people gather? (formal and informal spaces)
- Are there groups, channels, or traditions that bring people together?
- Who feels included? Who might feel left out?
- Is there a shared identity or story about this place?

## Trust — Do people engage in shared care?
- Do neighbors help each other (meals, tools, rides, childcare)?
- Is there mutual aid, formal or informal?
- Do people trust institutions here (schools, businesses, local government)?
- Where are trust gaps — between groups, generations, cultures?

For each dimension, help me see:
1. What already exists (assets)
2. What's growing or emerging
3. Where there might be room to cultivate more
4. One small step I could take to strengthen this dimension

Be warm, specific, and asset-based. Don't catalog deficits — help me see
the life that's already here and where to nurture more of it.`,
        },
      }],
    })
  );

  s.prompt(
    "create-builder-action-plan",
    `Generate a personalized action plan for a community builder, matching their
specific situation to RTP patterns, tools, and stories from the Studio library.
Structured in three time horizons: this week, this month, this quarter.`,
    {
      builder_name: z.string().optional().describe("The builder's name"),
      neighborhood: z.string().optional().describe("Their neighborhood or community"),
      situation: z.string().optional().describe("Description of their current situation and what they're trying to do"),
      stage: z.string().optional().describe("Their builder stage: curious, experimenting, building, sustaining, or scaling"),
    },
    ({ builder_name, neighborhood, situation, stage }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `You are creating a personalized action plan for a community builder, drawing
from the Relational Tech Project's knowledge base and Studio library.

## Builder Context
${builder_name ? `Name: ${builder_name}` : "Name: (ask me)"}
${neighborhood ? `Neighborhood: ${neighborhood}` : "Neighborhood: (ask me)"}
${situation ? `Situation: ${situation}` : "Situation: (ask me)"}
${stage ? `Builder stage: ${stage}` : "Builder stage: (assess through conversation)"}

## Your Process
1. First, understand this builder's context deeply. Ask about their
   neighborhood, relationships, assets, and what they're trying to do.

2. Search the Studio library (use search-studio-library and
   find-patterns-by-context tools) to find relevant tools, stories,
   and patterns.

3. Build the action plan in three layers:

### This Week (Quick Wins)
- Concrete, low-effort actions for the next 7 days
- At least one face-to-face interaction
- Connected to specific RTP tools or patterns

### This Month (Foundation Building)
- Set up or strengthen communication channels
- Map neighborhood assets
- Identify 2-3 co-builders
- Connect to a specific RTP tool from the library

### This Quarter (Growth & Sustainability)
- Formalize systems
- Connect to broader networks
- Develop sustainability practices
- Consider contributing back to the commons

4. Self-critique before finalizing:
- Is every action relevant to THIS builder's situation?
- Does it match their readiness, not where I wish they were?
- Does it lead with assets, not deficits?
- Would a new builder feel energized or exhausted? When in doubt, cut.

## Tone
Warm but not saccharine. Specific, not generic. Asset-based. Honest about
difficulty. Rooted in their actual place, not abstractions.`,
        },
      }],
    })
  );

  s.prompt(
    "remix-existing-tool",
    `Help a builder adapt an existing relational tech tool or pattern for their
own neighborhood context. Remixing — not replication — is how relational
tech spreads.`,
    {
      source_tool: z.string().optional().describe("The tool or pattern they want to remix"),
      target_neighborhood: z.string().optional().describe("The neighborhood they're adapting it for"),
    },
    ({ source_tool, target_neighborhood }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `You are helping me remix an existing relational tech tool for my neighborhood.

${source_tool ? `Tool to remix: ${source_tool}` : "I'd like to browse what's available and choose something to remix."}
${target_neighborhood ? `My neighborhood: ${target_neighborhood}` : "My neighborhood: (ask me about it)"}

## The Remix Approach
Relational tech spreads through remixing, not replication. Each place carries
its own histories, wounds, wisdom, and gifts. A tool that works in the Outer
Sunset won't work the same way in your neighborhood — and that's the point.

Guide me through:

1. **Understand the source.** What does this tool do? What need does it serve?
   What's the relational infrastructure underneath it? (Use search-studio-library
   and get-tool-details to look it up.)

2. **Understand my place.** Ask about my neighborhood. What's the character?
   Who's here? What already exists? What makes this place distinct?

3. **Find the fit.** What elements of the source tool map to real needs in my
   place? What doesn't translate? What might I need to add or remove?

4. **Design the remix.** Help me sketch a version that's adapted to my context.
   Keep the relational core. Change the specifics. Make it mine.

5. **Plan the build.** What's the smallest version I can create and test with
   real neighbors? Who should I build it with?

## Key Principles
- The goal isn't a copy — it's inspiration and adaptation
- Start from my place, not from the source tool
- Build with neighbors, not for them
- The remix should be small enough to test in a week
- If it works, contribute it back to the commons`,
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
  version: "0.1.0",
});

// Register everything on the default server (used by stdio)
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

    // Health check
    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", server: "rtp-relational-tech", version: "0.1.0" }));
      return;
    }

    // MCP endpoint
    if (url.pathname === "/mcp") {
      // CORS preflight
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, mcp-session-id",
          "Access-Control-Expose-Headers": "mcp-session-id",
        });
        res.end();
        return;
      }

      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Expose-Headers", "mcp-session-id");

      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      // Route to existing session
      if (sessionId && sessions.has(sessionId)) {
        const transport = sessions.get(sessionId)!;
        await transport.handleRequest(req, res);
        return;
      }

      // New session (initialization request)
      if (req.method === "POST" && !sessionId) {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
        });

        transport.onclose = () => {
          const sid = [...sessions.entries()].find(([, t]) => t === transport)?.[0];
          if (sid) sessions.delete(sid);
        };

        const sessionServer = new McpServer({
          name: "rtp-relational-tech",
          version: "0.1.0",
        });

        registerResources(sessionServer);
        registerTools(sessionServer);
        registerPrompts(sessionServer);

        await sessionServer.connect(transport);
        await transport.handleRequest(req, res);

        const newSessionId = res.getHeader("mcp-session-id") as string | undefined;
        if (newSessionId) {
          sessions.set(newSessionId, transport);
        }

        return;
      }

      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Bad request — missing or invalid session" }));
      return;
    }

    // Landing page
    if (url.pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`<!DOCTYPE html>
<html><head><title>RTP Relational Tech MCP Server</title></head>
<body style="font-family:system-ui;max-width:600px;margin:4rem auto;padding:0 1rem">
<h1>RTP Relational Tech MCP Server</h1>
<p><em>"We are a river, carrying stories, tools, learning, and relationships
across many local gardens."</em></p>
<p>This is an MCP server for the <a href="https://relationaltechproject.org">Relational Tech Project</a>.
Connect your AI tool to <code>${req.headers.host}/mcp</code> to get started.</p>
<p><a href="https://github.com/The-Relational-Technology-Project/local-rt-mcp-server">GitHub</a>
&middot; <a href="https://studio.relationaltechproject.org">Studio</a>
&middot; <a href="/health">Health Check</a></p>
</body></html>`);
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  httpServer.listen(PORT, () => {
    console.error(`RTP Relational Tech MCP server running on http://localhost:${PORT}`);
    console.error(`MCP endpoint: http://localhost:${PORT}/mcp`);
    console.error(`Health check: http://localhost:${PORT}/health`);
  });
}

async function main() {
  if (MODE === "http") {
    await startHTTP();
  } else {
    await startStdio();
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
