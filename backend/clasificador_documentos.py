import json
import os
import re

class Clasificador:
    def __init__(self, ruta_taxonomia="categorias.json"):
        self.taxonomia = self._cargar_taxonomia(ruta_taxonomia)
        
        # PRE-PROCESAMIENTO: Convertimos listas a SETS para velocidad O(1)
        self.sets_categorias = {
            cat: set(palabras) for cat, palabras in self.taxonomia.items()
        }

    def _cargar_taxonomia(self, ruta):
        if not os.path.exists(ruta):
            print(f"⚠️ Advertencia: No se encontró {ruta}, usando categorías vacías.")
            return {}
        try:
            with open(ruta, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"❌ Error leyendo taxonomía: {e}")
            return {}

    def predecir_categoria(self, texto, nombre_archivo):
        """
        Retorna la categoría principal y, opcionalmente, una secundaria
        si su relevancia es significativa comparada con la primera.
        """
        # 1. Normalización
        contenido_total = (texto + " " + nombre_archivo).lower()
        palabras_documento = set(re.findall(r'\w+', contenido_total))
        
        # 3. Cálculo de Puntajes (Scoring)
        puntajes = {}
        
        for categoria, palabras_clave_set in self.sets_categorias.items():
            # Intersección de conjuntos
            coincidencias = palabras_documento.intersection(palabras_clave_set)
            cantidad = len(coincidencias)
            
            # Umbral Mínimo Absoluto: Al menos 2 palabras para considerar la categoría
            if cantidad >= 2:
                puntajes[categoria] = cantidad

        # Si no hay ninguna categoría que cumpla el mínimo
        if not puntajes:
            return ["General"]

        # 4. Lógica de Selección ("Top 2 con Relevancia Relativa")
        # Ordenamos las categorías por puntaje de mayor a menor
        # Ejemplo: [('Tecnologia', 40), ('Ciencia', 35), ('Cocina', 3)]
        cats_ordenadas = sorted(puntajes.items(), key=lambda x: x[1], reverse=True)
        
        # La ganadora siempre entra
        mejor_categoria, mejor_puntaje = cats_ordenadas[0]
        resultado = [mejor_categoria]

        # Evaluamos la segunda posición (si existe)
        if len(cats_ordenadas) > 1:
            segunda_categoria, segundo_puntaje = cats_ordenadas[1]
            
            # REGLA DE NEGOCIO: Relevancia Relativa
            # La 2da categoría debe tener al menos el 50% de coincidencias que la 1ra.
            # Esto evita mezclar temas fuertes con temas residuales (ruido).
            umbral_relativo = mejor_puntaje * 0.5 
            
            if segundo_puntaje >= umbral_relativo:
                resultado.append(segunda_categoria)

        return resultado