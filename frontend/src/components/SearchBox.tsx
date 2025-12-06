import React, { useState, useRef, useEffect } from "react";
import { controlador_busqueda } from "../controladores/controlador_busqueda";

// --- DEFINICIÓN DE TIPOS (Clean Code) ---
type SearchBoxProps = {
  onSearch: (query: string) => void; 
  defaultValue?: string;             
};

export const SearchBox: React.FC<SearchBoxProps> = ({ onSearch, defaultValue = "" }) => {
  // --- ESTADO Y REFS (Lógica Robusta) ---
  const [inputValue, setInputValue] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  
  const suggestTimerRef = useRef<number | null>(null);
  const blurTimerRef = useRef<number | null>(null);

  // Sincronización
  useEffect(() => {
    setInputValue(defaultValue);
  }, [defaultValue]);

  // Limpieza de memoria
  useEffect(() => {
    return () => {
      if (suggestTimerRef.current) window.clearTimeout(suggestTimerRef.current);
      if (blurTimerRef.current) window.clearTimeout(blurTimerRef.current);
    };
  }, []);

  // --- LÓGICA DE NEGOCIO ---

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const cleanValue = inputValue.trim();
    setSuggestions([]); 
    setHighlightedIndex(-1);
    onSearch(cleanValue);
  };

  const fetchSuggestions = async (partialQuery: string) => {
    if (!partialQuery || partialQuery.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    try {
      const lista = await controlador_busqueda.obtenerSugerencias(partialQuery);
      if (lista && Array.isArray(lista) && lista.length > 0) {
        setSuggestions(lista.slice(0, 8)); // Mantenemos tu límite de 8
        setHighlightedIndex(-1);
      } else {
        setSuggestions([]);
      }
    } catch (error) {
      console.warn("⚠️ Error Suggester:", error);
      setSuggestions([]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    if (suggestTimerRef.current) window.clearTimeout(suggestTimerRef.current);
    // @ts-ignore
    suggestTimerRef.current = window.setTimeout(() => fetchSuggestions(newValue), 200);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex(prev => Math.min(suggestions.length - 1, prev + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex(prev => Math.max(-1, prev - 1));
    } else if (e.key === "Enter") {
      if (highlightedIndex >= 0) {
        e.preventDefault();
        selectSuggestion(suggestions[highlightedIndex]);
      }
    } else if (e.key === "Escape") {
      setSuggestions([]);
      setHighlightedIndex(-1);
    }
  };

  const handleBlur = () => {
    if (blurTimerRef.current) window.clearTimeout(blurTimerRef.current);
    // @ts-ignore
    blurTimerRef.current = window.setTimeout(() => {
      setSuggestions([]);
      setHighlightedIndex(-1);
    }, 200);
  };

  const selectSuggestion = (term: string) => {
    setInputValue(term);
    setSuggestions([]);
    onSearch(term);
  };

  // --- RENDERIZADO (Tu UI "Retro" intacta) ---
  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 w-full p-1 bg-[#C0C0C0] relative"
    >
      <div className="relative flex-1">
        <input
          type="text"
          value={inputValue} // Variable actualizada
          onChange={handleChange} // Handler actualizado
          onKeyDown={handleKeyDown} // Handler actualizado
          onBlur={handleBlur}
          placeholder="Términos de búsqueda..."
          autoComplete="off"
          // Tus clases visuales exactas (font-mono, bordes específicos)
          className="w-full p-2 border-2 border-t-black border-l-black border-b-white border-r-white bg-white text-black font-mono outline-none"
        />

        {suggestions.length > 0 && (
          <ul
            role="listbox"
            // Tu contenedor de lista exacto
            className="absolute left-0 right-0 top-full bg-white border-2 border-black mt-0 shadow-xl max-h-64 overflow-y-auto z-50 block"
            style={{ listStyle: "none", padding: 0, margin: 0 }}
          >
            {suggestions.map((s, idx) => (
              <li
                key={idx}
                role="option"
                aria-selected={highlightedIndex === idx}
                onMouseEnter={() => setHighlightedIndex(idx)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectSuggestion(s)}
                // Tu estilizado de items (font-serif, azul clásico de selección)
                className={`px-3 py-2 cursor-pointer font-serif text-sm border-b border-gray-100 last:border-0 ${
                  highlightedIndex === idx
                    ? "bg-[#000080] text-white"
                    : "text-black hover:bg-[#000080] hover:text-white"
                }`}
              >
                {s}
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="submit"
        // Tu botón "clicky" estilo Windows 95
        className="px-4 py-2 bg-[#C0C0C0] text-black font-bold border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black active:border-b-white active:border-r-white active:pl-5 active:pt-3"
      >
        Buscar
      </button>
    </form>
  );
};