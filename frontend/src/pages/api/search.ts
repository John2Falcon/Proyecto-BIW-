import type { APIRoute } from "astro";
import { searchSolr } from "./solr";
import type { SolrSearchResult } from "../../types/solr";

export const POST: APIRoute = async ({ request }) => {
  console.log("API /api/search called");
  try {
    const body = await request.json();
    const q = (body.q || body.rawQuery || "").toString();
    const rows = Number(body.rows) || 10;
    const fq = Array.isArray(body.fq) ? body.fq.map(String) : [];

    const qf = typeof body.qf === "string" ? body.qf : undefined;
    const hlFields = Array.isArray(body.highlight)
      ? body.highlight.map(String)
      : undefined;
    const facetFields = body.facets?.fields
      ? body.facets.fields.map(String)
      : undefined;

    const data: SolrSearchResult = await searchSolr(q, {
      rows,
      fq,
      qf,
      hlFields,
      facetFields,
    });

    const payload = {
      results: {
        docs: data.docs,
        highlighting: data.highlighting || {},
        facets: data.facets || {},
        response: {
          numFound: data.numFound,
          start: data.start,
          docs: data.docs,
        },
        queryUrl: data.queryUrl || null,
      },
      spellcheck: data.spellcheck || null,
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("API /api/search error:", e);
    return new Response(JSON.stringify({ error: "Error processing search" }), {
      status: 500,
    });
  }
};
