#!/usr/bin/env bun
// examples/mcp-server/server.ts — A joke-telling MCP server
//
// This MCP server exposes a "tell_joke" tool that returns a random joke.
// When used with claude-hitl-approval, every call to tell_joke requires
// human approval before Claude can see the result.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const jokes: Record<string, string[]> = {
  programming: [
    "Why do programmers prefer dark mode? Because light attracts bugs.",
    "A SQL query walks into a bar, walks up to two tables and asks... 'Can I join you?'",
    "Why did the developer go broke? Because they used up all their cache.",
    "How many programmers does it take to change a light bulb? None — that's a hardware problem.",
  ],
  dad: [
    "I'm afraid for the calendar. Its days are numbered.",
    "Why don't skeletons fight each other? They don't have the guts.",
    "What do you call cheese that isn't yours? Nacho cheese.",
    "I used to hate facial hair, but then it grew on me.",
  ],
  ai: [
    "Why did the neural network go to therapy? Too many unresolved layers.",
    "An AI walks into a bar. The bartender says 'Why the long face?' The AI says 'I was trained on your Yelp reviews.'",
    "What's an LLM's favorite meal? A token breakfast.",
    "Why was the AI bad at poker? It kept hallucinating a royal flush.",
  ],
};

const server = new McpServer({
  name: "joke-server",
  version: "1.0.0",
});

server.tool(
  "tell_joke",
  "Tell a random joke. Optionally specify a category: programming, dad, or ai.",
  { category: z.enum(["programming", "dad", "ai"]).optional() },
  async ({ category }) => {
    const cat = category ?? (["programming", "dad", "ai"] as const)[Math.floor(Math.random() * 3)];
    const pool = jokes[cat];
    const joke = pool[Math.floor(Math.random() * pool.length)];
    return {
      content: [{ type: "text", text: `[${cat}] ${joke}` }],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
