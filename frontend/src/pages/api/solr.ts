import type {
    RawSolrResponse,
    SolrFullResponse,
    SolrSearchResult,
} from "../../types/solr";
import { normalizeSolrResponse } from "../../types/solr";

const SOLR_BASE = process.env.SOLR_BASE || "http://localhost:8983/solr/mi_core";

function buildSelectUrl(paramsObj: Record<string, string | number | string[]>) {
    const qs = new URLSearchParams();
    Object.entries(paramsObj).forEach(([k, v]) => {
        if (Array.isArray(v)) {
            v.forEach((i) => qs.append(k, String(i)));
        } else {
            qs.append(k, String(v));
        }
    });
    return `${SOLR_BASE}/select?${qs.toString()}`;
}

export async function searchSolr(
    query: string,
    options?: {
        rows?: number;
        fq?: string[];
        qf?: string;
        hlFields?: string[];
        facetFields?: string[];
        df?: string;
    },
): Promise<SolrSearchResult> {
    const q = query && query.trim() !== "" ? query.trim() : "*:*";

    const qfVal = options?.qf ?? "title_es^5 content_es^1 category^2";
    const hlFields = options?.hlFields ?? ["content_es", "title_es"];
    const facetFields = options?.facetFields ?? ["category"];

    const params: Record<string, string | number | string[]> = {
        wt: "json",
        indent: "true",
        q,
        defType: "edismax",
        df: options?.df ?? "content_es",

        "lowercaseOperators": "false",
        uf: "*",
        "q.op": "OR",
        mm: "1<-1 3<75%",

        qf: qfVal,
        pf: "title_es^8",
        bq: `product(weight_factor, 100)^100`,

        hl: "true",
        "hl.fl": hlFields,
        "hl.simple.pre": "<em>",
        "hl.simple.post": "</em>",
    };

    if (options?.fq && options.fq.length > 0) {
        params["fq"] = options.fq;
    }

    const url = buildSelectUrl(params);

    try {
        const res = await fetch(url);
        if (!res.ok) {
            const errorBody = await res.text().catch(() => "<no-body>");
            console.error("Solr HTTP Error Body:", errorBody);
            throw new Error(`Solr error ${res.status}: ${res.statusText}`);
        }

        const data = (await res.json().catch(() => ({}))) as RawSolrResponse;

        const normalized = normalizeSolrResponse(data, url);

        const docsWithSnippet = normalized.docs.map((d) => {
            const id = String((d as any).id || "");
            const highlight = normalized.highlighting?.[id];
            const snippet = highlight?.content_es?.[0] ||
                highlight?.title_es?.[0] || null;
            return { ...d, snippet } as typeof d & { snippet?: string | null };
        });

        return { ...normalized, docs: docsWithSnippet };
    } catch (error) {
        console.error("Error fetching or parsing Solr response:", error);
        return normalizeSolrResponse({}, url);
    }
}

export async function suggestSolr(q: string, dict = "miSugestor") {
    const qs = new URLSearchParams({
        suggest: "true",
        "suggest.build": "false",
        "suggest.dictionary": dict,
        "suggest.q": q,
        wt: "json",
    }).toString();

    const out: { suggestions: string[] } = { suggestions: [] };

    try {
        const url = `${SOLR_BASE}/suggest?${qs}`;
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json().catch(() => ({}));
            const suggestions: string[] = [];
            if (data && data.suggest) {
                Object.values(data.suggest).forEach((dictObj: any) => {
                    if (dictObj && typeof dictObj === "object") {
                        Object.values(dictObj).forEach((entry: any) => {
                            if (
                                entry && entry.suggestions &&
                                Array.isArray(entry.suggestions)
                            ) {
                                entry.suggestions.forEach((s: any) => {
                                    if (s?.term) {
                                        suggestions.push(String(s.term));
                                    }
                                });
                            }
                        });
                    }
                });
            }
            if (suggestions.length > 0) {
                out.suggestions = Array.from(new Set(suggestions)).slice(0, 8);
                return out;
            }
        } else {
            const body = await res.text().catch(() => "<no-body>");
            console.warn(`Suggester returned non-ok ${res.status}: ${body}`);
        }
    } catch (err) {
        console.warn("Suggester fetch failed:", err);
    }

    try {
        const params: Record<string, string | number | string[]> = {
            wt: "json",
            indent: "true",
            q: "*:*",
            rows: 0,
            facet: "true",
            "facet.field": ["suggest_field"],
            "facet.prefix": q,
            "facet.limit": 8,
        };
        const qs2 = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => {
            if (Array.isArray(v)) v.forEach((i) => qs2.append(k, String(i)));
            else qs2.append(k, String(v));
        });
        const url2 = `${SOLR_BASE}/select?${qs2.toString()}`;
        const r2 = await fetch(url2);
        if (r2.ok) {
            const d2 = await r2.json().catch(() => ({}));
            const facets = d2.facet_counts?.facet_fields?.suggest_field || [];
            for (let i = 0; i < facets.length; i += 2) {
                const term = facets[i];
                if (term && typeof term === "string") {
                    out.suggestions.push(term);
                }
            }
            out.suggestions = Array.from(new Set(out.suggestions)).slice(0, 8);
            return out;
        } else {
            console.warn(
                "Fallback /select for suggestions failed with status",
                r2.status,
            );
        }
    } catch (err) {
        console.error("Fallback suggest error:", err);
    }

    return out;
}
