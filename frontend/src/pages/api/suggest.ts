import type { APIRoute } from "astro";
import { suggestSolr } from "./solr";

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("q") || "";
    if (!q) {
      return new Response(JSON.stringify({ suggestions: [] }), { status: 200 });
    }

    const data = await suggestSolr(q);
    const suggestions: string[] = Array.isArray((data as any)?.suggestions)
      ? (data as any).suggestions
      : [];
    console.log("Suggestions:", suggestions);
    return new Response(JSON.stringify({ suggestions }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("API /api/suggest error:", e);
    return new Response(JSON.stringify({ suggestions: [] }), { status: 500 });
  }
};
