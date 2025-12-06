export interface SolrDoc {
  id: string;
  title_es: string;
  content_es: string;
  url: string;
  [key: string]: unknown;
}

export interface SolrResponseHeader {
  status: number;
  QTime?: number;
  params?: Record<string, string | string[]>;
}

export interface SolrResponseBody {
  numFound: number;
  start: number;
  docs: SolrDoc[];
}

export type SolrFacetFields = Record<string, Array<string | number>>;

export interface SolrFacetCounts {
  facet_fields?: SolrFacetFields;
  facet_queries?: Record<string, number>;
  facet_ranges?: Record<string, unknown>;
  [key: string]: unknown;
}

export type SolrHighlighting = Record<string, Record<string, string[]>>;

export interface SolrSpellcheckSuggestion {
  term?: string;
  suggestions?: Array<{ suggestion: string; freq?: number }>;
}

export interface SolrSpellcheck {
  correctlySpelled?: boolean;
  suggestions?: Array<SolrSpellcheckSuggestion | string>;
  [key: string]: unknown;
}

export interface SolrSuggestOption {
  term: string;
  weight?: number;
  payload?: string;
}

export interface SolrSuggestEntry {
  numFound?: number;
  startOffset?: number;
  endOffset?: number;
  suggestion: SolrSuggestOption[];
}

export type SolrSuggest = Record<string, Record<string, SolrSuggestEntry>>;

export interface RawSolrResponse {
  responseHeader?: SolrResponseHeader;
  response?: SolrResponseBody;
  facet_counts?: SolrFacetCounts;
  highlighting?: SolrHighlighting;
  spellcheck?: SolrSpellcheck;
  suggest?: SolrSuggest;
  [key: string]: unknown;
}

export interface SolrSearchResult {
  docs: SolrDoc[];
  numFound: number;
  start: number;
  facets: SolrFacetFields;
  highlighting?: SolrHighlighting;
  spellcheck?: SolrSpellcheck;
  suggest?: SolrSuggest;
  raw?: RawSolrResponse;
  queryUrl?: string;
}

export function normalizeSolrResponse(
  raw: unknown,
  queryUrl?: string,
): SolrSearchResult {
  const r = (raw as RawSolrResponse) || {};

  const response = r.response ??
    { docs: [], numFound: 0, start: 0 } as SolrResponseBody;

  const docs = Array.isArray(response.docs) ? (response.docs as SolrDoc[]) : [];
  const numFound = typeof response.numFound === "number"
    ? response.numFound
    : Number(response.numFound ?? 0);
  const start = typeof response.start === "number"
    ? response.start
    : Number(response.start ?? 0);

  const facets = (r.facet_counts && r.facet_counts.facet_fields)
    ? r.facet_counts.facet_fields
    : {};

  const highlighting = r.highlighting;
  const spellcheck = r.spellcheck;
  const suggest = r.suggest;

  return {
    docs,
    numFound,
    start,
    facets,
    highlighting,
    spellcheck,
    suggest,
    raw: r,
    queryUrl,
  };
}

export type SolrFullResponse = SolrSearchResult;
