# RT MCP Server

Hosted MCP service for the [Relational Tech Project](https://relationaltechproject.org) — RTP methodology, neighborhood recipes, frameworks, and field references, accessible to any AI builder tool via URL.

> "We are the river — carrying stories, tools, learning, and relationships across many local gardens, while honoring that each garden must be tended by those who live there."

Made in the Outer Sunset, for neighborhoods everywhere.

---

## What This Does

The RT MCP Server is the hosted gateway to the **RTP global commons** — a shared library of neighborhood practice and relational tech knowledge that any MCP-compatible AI tool can query.

When you connect your AI tool to this server, you get access to **275+ canonical items** (and growing as Studios across the network contribute back):

- **8 RTP methodology docs** — the foundational frameworks (core principles, three layers, builder spectrum, embedded design, measurement, playbooks, challenges, network)
- **7 frameworks** — cross-practice patterns like the 10 Principles of Neighboring, 5 Cs of Community, Asset-Based Community Development
- **63 neighborhood recipes** — actionable how-tos with ingredients, steps, variations, and stories (block parties, mutual aid pods, repair cafes, restorative circles, skillshares, and many more)
- **197 field references** — practitioners' work, organizations, books, and research (Block Party USA, Priya Parker, Dean Spade, ABCD Institute, microsolidarity, and dozens more)

As of v0.2.0 the server queries the commons live — no hardcoded knowledge — so the catalog grows automatically as items are added.

The hosted endpoint is at **`https://mcp.relationaltechproject.org/mcp`**. For a local stdio version, set `RTP_MCP_TRANSPORT=stdio` when running the same code.

---

## For Builders: Connect Your AI Tool

Point your AI tool at the MCP endpoint. No API key, no signup.

### Claude Code

Add to your `.mcp.json` (or run `claude mcp add`):

```json
{
  "mcpServers": {
    "relational-tech": {
      "type": "streamable-http",
      "url": "https://mcp.relationaltechproject.org/mcp"
    }
  }
}
```

### Claude Desktop

Settings → Developer → Edit Config, then add the same block above.

### Cursor, Windsurf, Zed, anything else MCP-compatible

Point it at `https://mcp.relationaltechproject.org/mcp` using Streamable HTTP transport.

### Once you're connected

Try invoking the **`practice-guide`** prompt first — it puts your AI into a Neighboring Commons practice-guide stance for the rest of the conversation: relationships-first, asset-based, citing practitioners by name, calibrating confidence honestly, inviting contribution.

Then ask things like:

- "Help me design a fix-it fair for my neighborhood"
- "I want to start a mutual aid pod on my block — where do I begin?"
- "What's microsolidarity, and how does it differ from mutual aid?"
- "How do I host a block party? What does Vanessa Elias do at Block Party USA?"
- "I'm feeling burned out from community organizing — what do practitioners recommend?"

The server will surface relevant recipes, frameworks, methodology, and practitioner references, with attribution and source URLs so you can read the full work.

---

## What's Inside

### Resources (RTP methodology)

Nine RTP methodology docs are exposed as MCP resources at stable URIs. Content is fetched live from the commons on each request — update once in the commons, see it everywhere.

| Resource URI | What It Contains |
|---|---|
| `rtp://knowledge/core-principles` | Technology accountable to people, the river metaphor, relationships first, asset-based approach, speed of trust |
| `rtp://knowledge/relational-tech-practice` | The four dimensions: purpose, process (embedded design), math (1:100), path (scale deep, spread horizontal) |
| `rtp://knowledge/three-layers` | Neighborhood infrastructure layers — relational, information, action — with the Outer Sunset as reference |
| `rtp://knowledge/builder-spectrum` | Five stages of a builder's journey: curious → experimenting → building → sustaining → scaling |
| `rtp://knowledge/measurement` | Measuring what matters: agency, belonging, and trust |
| `rtp://knowledge/embedded-design` | Complete guide to the embedded design methodology |
| `rtp://knowledge/playbooks` | Step-by-step playbooks: communication channels, gatherings, calendars, mutual aid, asset mapping |
| `rtp://knowledge/challenges` | Navigating trust, burnout, scale, access, language barriers, conflict, momentum |
| `rtp://knowledge/network` | RTP network, adjacent movements, connection patterns for builders |

### Tools (commons API)

| Tool | What It Does |
|---|---|
| `search-studio-library` | Full-text ranked search across the commons (recipes, frameworks, methodology, references, tools, stories). Filterable by kind. |
| `get-tool-details` | Full body + community notes + linked items for one item by name match |
| `find-patterns-by-context` | Describe a builder's situation (with stage/need); returns matched commons items + stage-specific guidance |
| `suggest-contribution` | Guided framework for shaping a builder's experience into a commons contribution |
| `get-network-updates` | Recent activity across the relational tech network (from the Watcher feed) |

### Prompts (guided workflows)

| Prompt | What It Does |
|---|---|
| `practice-guide` | **Start here.** Adopt the Neighboring Commons practice-guide stance for the conversation — relationships-first, asset-based, cite practitioners, calibrate confidence, invite contribution. |
| `design-neighborhood-tool` | Guided embedded design process for creating neighborhood-scale tools |
| `assess-relational-soil` | Assess agency, belonging, and trust in a neighborhood |
| `create-builder-action-plan` | Personalized action plan: this week, this month, this quarter |
| `remix-existing-tool` | Adapt an existing tool or recipe for a new neighborhood |

---

## Endpoints

| Path | Description |
|---|---|
| `/` | Landing page with connection instructions |
| `/mcp` | MCP Streamable HTTP endpoint (what AI tools connect to) |
| `/health` | Health check returning JSON status, version, and source |

---

## Configuration

The server reads its commons connection from environment variables, all with sensible defaults so it works out of the box:

| Env Var | Default | Purpose |
|---|---|---|
| `RTP_COMMONS_URL` | `https://odowkowcinyoxejyzhwl.supabase.co` | Commons Supabase project URL |
| `RTP_COMMONS_ANON_KEY` | (baked in — public anon key) | Read-only access (RLS enforces canonical-only) |
| `PORT` | `3000` | HTTP port (most hosts set automatically) |
| `RTP_MCP_TRANSPORT` | `http` | Set to `stdio` for local CLI mode |

---

## Deploying

Standard Node 18+ HTTP server. `npm install && npm start` is all you need.

### Railway

1. Connect this repo at [railway.app](https://railway.app)
2. Auto-detects Node.js — deploy
3. Endpoint at `https://your-app.up.railway.app/mcp`

### Render

1. New Web Service at [render.com](https://render.com)
2. Build: `npm install && npm run build`
3. Start: `npm start`

### Anywhere Node 18+

Respects `PORT`. No other configuration required.

---

## How It Fits Together

```
                     ┌─────────────────────────────────────┐
                     │  RTP COMMONS (Supabase)             │
                     │  275+ canonical items               │
                     │  commons_items + embeddings +       │
                     │  full-text search RPCs              │
                     └─────────────┬───────────────────────┘
                                   │ read (anon key, RLS)
                          ┌────────▼────────┐
                          │ rt-mcp-server   │
                          │ v0.2.0          │
                          │ (this repo)     │
                          │                 │
                          │ mcp.relational  │
                          │ techproject.org │
                          └────────┬────────┘
                                   │ Streamable HTTP
                                   │
                ┌──────────────────┼──────────────────┐
                │                  │                  │
          Claude Code           Cursor          Claude Desktop
                                                 + any MCP client
```

The commons also powers Sidekick in the Relational Tech Studio. Connect your AI to this server and you have access to the same library Sidekick draws from — plus the `practice-guide` prompt and the methodology resources at stable URIs.

---

## Contributing

This server is open source and part of the broader relational tech commons. PRs welcome.

The most useful contributions right now:

- **Better commons content**: contribute recipes, stories, or community notes via [studio.relationaltechproject.org/library](https://studio.relationaltechproject.org/library) — the commons grows from there
- **New MCP tools or prompts**: if you've found a useful query pattern, propose it
- **Bug reports**: anything broken in how the server formats responses, handles errors, or surfaces items
- **Civic commons integrations**: connecting more knowledge sources beyond what's in the commons today

---

## License

MIT — use freely, remix generously, tend your garden.

---

*Made by the [Relational Tech Project](https://relationaltechproject.org) · [Studio](https://studio.relationaltechproject.org) · hello@relationaltechproject.org*

## Builder

Josh Nesbit – co-founder of Relational Tech Project, building with neighbors in the Outer Sunset in SF.
Reach me by email: josh@relationaltechproject.org
