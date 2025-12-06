import React, { useState } from "react";

export const ResetButton = () => {
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    // 1. Barrera de Seguridad (UX Básico)
    const confirmado = window.confirm(
      "⚠️ ¡ADVERTENCIA DE SISTEMA!\n\n¿Estás seguro de que deseas ELIMINAR TODOS los documentos indexados?\n\nEsta acción no se puede deshacer."
    );

    if (!confirmado) return;

    setLoading(true);
    try {
      // 2. Llamada al Backend
      const res = await fetch("http://localhost:8000/limpiar", {
        method: "DELETE",
      });

      if (res.ok) {
        alert("✅ SISTEMA LIMPIO: El índice ha sido vaciado.");
        // Opcional: Recargar la página para limpiar resultados visuales
        window.location.reload();
      } else {
        alert("❌ ERROR: No se pudo conectar con el núcleo del sistema.");
      }
    } catch (e) {
      console.error(e);
      alert("❌ ERROR CRÍTICO DE RED.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleReset}
      disabled={loading}
      className={`
        px-4 py-2 font-bold font-mono text-sm
        border-2 border-t-white border-l-white border-b-black border-r-black
        active:border-t-black active:border-l-black active:border-b-white active:border-r-white active:translate-y-[1px]
        transition-colors
        ${loading ? "bg-gray-400 cursor-wait" : "bg-[#ff0000] text-white hover:bg-[#cc0000]"}
      `}
      title="Borrar base de datos completa"
    >
      {loading ? "PURGANDO..." : "Eliminar documentos indexados"}
    </button>
  );
};