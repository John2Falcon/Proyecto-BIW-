import React from "react";
import { ResetButton } from "./ResetButton";
// --- CONSTANTES ---
const OPCIONES_CATEGORIA = [
  "Tecnologia",
  "Salud",
  "Legal",
  "Educacion",
  "Deportes",
  "Ciencia",
  "Astronomia",
  "Gastronomia",
  "Musica",
  "Finanzas",
];
const OPCIONES_EXTENSION = ["pdf", "txt", "html", "docx", "xlsx", "pptx"];
const OPCIONES_ORDEN = [
  { valor: "ninguno", etiqueta: "Relevancia" },
  { valor: "fecha asc", etiqueta: "Fecha Asc" },
  { valor: "fecha desc", etiqueta: "Fecha Desc" },
  { valor: "titulo desc", etiqueta: "Alfabetico Asc" },
  { valor: "titulo asc", etiqueta: "Alfabetico Desc" },
];

// --- INTERFACES ---
interface Filtros {
  categorias: string[];
  extensiones: string[];
  orden: string;
}

interface Props {
  filtros: Filtros; // Estado que viene del padre (Source of Truth)
  // Función para notificar cambios inmediatamente al padre
  alCambiarFiltros: (nuevosFiltros: Filtros) => void;
}

/**
 * Componente de UI para facetas.
 * Ahora es un "Controlled Component": no tiene estado interno.
 * Cada cambio dispara una nueva petición Solr inmediata a través del padre.
 */
export const FiltrosBusqueda: React.FC<Props> = ({ filtros, alCambiarFiltros }) => {

  // Lógica auxiliar para agregar/quitar elementos de arrays (Categorias/Extensiones)
  const alternarValorEnLista = (
    valor: string,
    listaActual: string[],
    clave: keyof Filtros
  ) => {
    const nuevaLista = listaActual.includes(valor)
      ? listaActual.filter((item) => item !== valor)
      : [...listaActual, valor];

    // Notificamos al padre inmediatamente con el nuevo estado completo
    alCambiarFiltros({
      ...filtros,
      [clave]: nuevaLista,
    });
  };

  // Manejo del cambio de orden (Select simple)
  const manejarCambioOrden = (e: React.ChangeEvent<HTMLSelectElement>) => {
    alCambiarFiltros({
      ...filtros,
      orden: e.target.value,
    });
  };

  return (
    <div className="p-4 bg-[#C0C0C0] border-2 border-t-white border-l-white border-b-black border-r-black font-sans shadow-lg">
      <h3 className="text-lg font-bold text-black mb-3 border-b border-gray-500 pb-1">
        ⚙️ Filtros Activos
      </h3>

      {/* 1. Ordenamiento (Sort en Solr) */}
      <div className="mb-4">
        <label
          htmlFor="select-orden"
          className="block text-black font-semibold mb-1"
        >
          Ordenar por:
        </label>
        <select
          id="select-orden"
          value={filtros.orden}
          onChange={manejarCambioOrden}
          className="w-full p-1 border-2 border-t-black border-l-black border-b-white border-r-white bg-white text-black font-mono outline-none text-sm"
        >
          {OPCIONES_ORDEN.map((op) => (
            <option key={op.valor} value={op.valor}>
              {op.etiqueta}
            </option>
          ))}
        </select>
      </div>

      {/* 2. Filtro por Categoría (fq field:categoria) */}
      <div className="mb-4">
        <label className="block text-black font-semibold mb-1">
          Categoría:
        </label>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {OPCIONES_CATEGORIA.map((cat) => (
            <label key={cat} className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filtros.categorias.includes(cat)}
                onChange={() => alternarValorEnLista(cat, filtros.categorias, 'categorias')}
                className="form-checkbox text-[#000080] h-4 w-4 border-black cursor-pointer"
              />
              <span className="capitalize text-black">{cat}</span>
            </label>
          ))}
        </div>
      </div>

      {/* 3. Filtro por Extensión (fq field:extension) */}
      <div className="mb-4">
        <label className="block text-black font-semibold mb-1">
          Extensión:
        </label>
        <div className="grid grid-cols-3 gap-2 text-sm">
          {OPCIONES_EXTENSION.map((ext) => (
            <label key={ext} className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filtros.extensiones.includes(ext)}
                onChange={() => alternarValorEnLista(ext, filtros.extensiones, 'extensiones')}
                className="form-checkbox text-[#000080] h-4 w-4 border-black cursor-pointer"
              />
              <span className="uppercase text-black">{ext}</span>
            </label>
          ))}
        </div>
      </div>
      
      <ResetButton />
    </div>
  );
};