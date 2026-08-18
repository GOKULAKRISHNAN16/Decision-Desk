/**
 * Cloudflare Worker: Anthropic API proxy for Decision Desk
 *
 * This keeps your real Anthropic API key on the server side.
 * Your GitHub Pages site calls THIS worker; the worker calls Anthropic.
 *
 * SETUP:
 * 1. Go to https://dash.cloudflare.com -> Workers & Pages -> Create -> Worker
 * 2. Paste this file's contents in as the worker code
 * 3. Go to Settings -> Variables -> add a Secret named ANTHROPIC_API_KEY
 *    with your real key as the value (never put it directly in this file)
 * 4. Update ALLOWED_ORIGIN below to your actual GitHub Pages URL
 * 5. Deploy. Copy the worker's URL (looks like
 *    https://decision-desk.YOUR-SUBDOMAIN.workers.dev)
 * 6. In index.html, change the fetch() URL to that worker URL (see below)
 */

// Only allow requests from your own site. Update this to match your
// GitHub Pages URL exactly, e.g. "https://yourusername.github.io"
const ALLOWED_ORIGIN = "https://yourusername.github.io";

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(request) });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return jsonError("Invalid JSON body", 400, request);
    }

    // Force the model server-side so the client can't override it
    // to something more expensive.
    body.model = "claude-sonnet-4-6";
    if (!body.max_tokens) body.max_tokens = 8000;

    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    const responseBody = await anthropicResponse.text();

    return new Response(responseBody, {
      status: anthropicResponse.status,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders(request),
      },
    });
  },
};

function corsHeaders(request) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonError(message, status, request) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(request) },
  });
}
