# RT MCP Server

Hosted MCP service for the [Relational Tech Project](https://relationaltechproject.org) — relational tech principles, patterns, and the Studio library, accessible to any AI builder tool via URL.

> "We are the river — carrying stories, tools, learning, and relationships across many local gardens, while honoring that each garden must be tended by those who live there."

Made in the Outer Sunset, for neighborhoods everywhere.

---

## What This Does

This is the **hosted service version** of the RTP MCP server. It runs as an HTTP service so builders can connect with just a URL — no local install, no cloning repos, no command line.

When a builder points their AI tool at this service, their AI gets access to RTP's core frameworks (embedded design, 1:100, three-layer neighborhood model, relational soil, playbooks, and more), live tools and stories from the [Relational Tech Studio](https://studio.relationaltechproject.org), and guided workflows for designing neighborhood-scale tools.

For the **local version** (runs on your own machine via stdio), see [local-rt-mcp-server](https://github.com/The-Relational-Technology-Project/local-rt-mcp-server).

---

## For Builders: Connect Your AI Tool

Point your AI tool at the MCP endpoint. No setup beyond this.

### Claude Code

Add to your `.mcp.json`:

```json
{
  "mcpServers": {
    "rtp-relational-tech": {
      "type": "streamable-http",
      "url": "https://YOUR_DEPLOYED_URL/mcp"
    }
  }
}
```

### Claude Desktop

Go to Settings → Developer → Edit Config:

```json
{
  "mcpServers": {
    "rtp-relational-tech": {
      "type": "streamable-http",
      "url": "https://YOUR_DEPLOYED_URL/mcp"
    }
  }
}
```

### Any Other MCP-Compatible Tool

Point it at `https://YOUR_DEPLOYED_URL/mcp` using Streamable HTTP transport.

### Things You Can Ask Once Connected

- "Help me design a community calendar for my neighborhood"
- "I want to start a mutual aid pod on my block — where do I begin?"
- "What relational tech tools exist for connecting neighbors?"
- "I'm feeling burned out from community organizing — what should I do?"
- "Help me remix the Outer Sunset's field guide for my neighborhood"

Your AI will ground its responses in RTP's embedded design methodology — asking about your place, your relationships, and your assets before jumping to solutions.

---

## Deploying

This repo is pre-configured for hosted deployment. `npm start` launches the HTTP server — no environment variables needed.

### Deploy to Railway

1. Connect this GitHub repo at [railway.app](https://railway.app)
2. Railway auto-detects Node.js. That's it — deploy.
3. Your MCP endpoint will be at `https://your-app.up.railway.app/mcp`

### Deploy to Render

1. Create a new Web Service at [render.com](https://render.com)
2. Connect this GitHub repo
3. Build command: `npm install && npm run build`
4. Start command: `npm start`

### Deploy Anywhere Else

Standard Node.js HTTP server. Any platform that runs Node 18+ works. The server respects the `PORT` environment variable (most platforms set this automatically).

### Endpoints

| Path | Description |
|---|---|
| `/` | Landing page with connection instructions |
| `/mcp` | MCP Streamable HTTP endpoint (what builders connect to) |
| `/health` | Health check (returns JSON status) |

---

## What's Inside

### Resources (Embedded Knowledge)

| Resource | What It Contains |
|---|---|
| `core-principles` | Technology accountable to people, the river metaphor, relationships first, asset-based approach, speed of trust |
| `relational-tech-practice` | The four dimensions: purpose, process (embedded design), math (1:100), path (scale deep, spread horizontal) |
| `three-layers` | Neighborhood infrastructure layers (relational, information, action) with the Outer Sunset as reference |
| `builder-spectrum` | Five stages of a builder's journey: curious → experimenting → building → sustaining → scaling |
| `measurement-framework` | Measuring what matters: agency, belonging, and trust |
| `embedded-design-guide` | Complete guide to the embedded design methodology |
| `playbooks` | Step-by-step playbooks: communication channels, gatherings, calendars, mutual aid, asset mapping |
| `challenges-guide` | Navigating trust, burnout, scale, access, language barriers, conflict, momentum |
| `network-and-community` | RTP network, adjacent movements, connection patterns for builders |

### Tools (Live Studio API)

| Tool | What It Does |
|---|---|
| `search-studio-library` | Search the full Studio library — tools, stories, prompts, and community notes |
| `get-tool-details` | Look up a specific tool with its linked prompts, community notes, and usage guidance |
| `find-patterns-by-context` | Describe a builder's situation and get matched to relevant patterns and guidance |

### Prompts (Guided Workflows)

| Prompt | What It Does |
|---|---|
| `design-neighborhood-tool` | Guided embedded design process for creating neighborhood-scale tools |
| `assess-relational-soil` | Assess agency, belonging, and trust in a neighborhood |
| `create-builder-action-plan` | Personalized action plan: this week, this month, this quarter |
| `remix-existing-tool` | Adapt an existing tool or pattern for a new neighborhood |

---

## Contributing

This server is part of the relational tech commons. Contributions welcome:

- **Add patterns**: Built something that works in your neighborhood? It could become an embedded resource.
- **Improve prompts**: The guided workflows get better with real builder feedback.
- **Connect new data sources**: Civic commons APIs, local data, and other knowledge bases.

---

## Future Directions

- Civic commons API integrations (Civic Tech Field Guide, Connective Tissue, Join 101, Group Hug)
- Semantic search over the knowledge base
- Builder profiles for context across sessions
- Multi-language support

---

## License

MIT — use freely, remix generously, tend your garden.

---

*Made by the [Relational Tech Project](https://relationaltechproject.org) · [Studio](https://studio.relationaltechproject.org) · hello@relationaltechproject.org*
