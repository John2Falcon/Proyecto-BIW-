import pysolr
import requests
import re

# Configuración
SOLR_URL = 'http://localhost:8983/solr/mi_core'
TIMEOUT = 10

class SolrCliente:
    def __init__(self):
        # always_commit=True guarda los cambios inmediatamente
        self.solr = pysolr.Solr(SOLR_URL, always_commit=True, timeout=TIMEOUT)

    def verificar_conexion(self):
        try:
            requests.get(SOLR_URL)
            return True
        except:
            return False

    def indexar_documento(self, documento_dict):
        """Recibe un diccionario y lo envía a Solr"""
        try:
            self.solr.add([documento_dict])
            print(f"✔ Indexado: {documento_dict.get('titulo', 'Sin título')}")
            return True
        except Exception as e:
            print(f"❌ Error indexando: {e}")
            raise e

    def buscar(self, query, filtros=None, orden=None, pagina=1, rows_por_pagina=10):
        """
        Realiza la búsqueda y procesa la corrección ortográfica (Spellcheck),
        procesando también el resaltado (highlighting) de los snippets.
        
        # Punto de la Rúbrica: Generación de Snippets (Highlighting)
        """

        parametros = {
            # --- MOTOR DE BÚSQUEDA ---
            'defType': 'edismax',  # CRÍTICO: Activa el parser avanzado. Permite usar 'qf'.
            
            # 'qf' (Query Fields): Define DÓNDE buscar y QUÉ IMPORTANCIA dar.
            # titulo^3.0: Si aparece en el título, vale 3 veces más que en el contenido.
            # contenido^1.0: Campo base.
            'qf': 'titulo^3.0 contenido^1.0', 
            
            # 'q.op': Define el operador por defecto si el usuario no escribe AND/OR.
            # Como pediste "asumir OR predeterminado", lo dejamos en 'OR'. 
            # Si quisieras que "perro gato" fuera "perro AND gato", pondrías 'AND'.
            'q.op': 'OR',

            # --- PRESENTACIÓN DE RESULTADOS ---
            'fl': '*,score',       # Devuelve todos los campos + puntaje de relevancia
            'rows': 500,           # Estrategia de paginación en cliente (Client-side)
            
            # --- RESALTADO (Snippets) ---
            'hl': 'true',
            'hl.fl': 'contenido',  # Buscamos fragmentos en el cuerpo del texto
            'hl.snippets': 3,      # Máximo 3 fragmentos por documento
            'hl.simple.pre': '<em>', # Etiquetas HTML para el resaltado
            'hl.simple.post': '</em>',

            # --- CORRECTOR ORTOGRÁFICO ---
            'spellcheck': 'true',
            'spellcheck.collate': 'true', # Pide la frase corregida completa
            
            # --- NAVEGACIÓN POR FACETAS (Filtros) ---
            'facet': 'true',
            'facet.field': ['extension', 'categoria'], # Campos exactos de tu Schema
            'facet.mincount': 1    # No mostrar filtros con 0 resultados
        }
        
        # 2. PROCESAMIENTO DE FILTROS (Python Dict -> Solr fq)
        # El frontend manda: {'categorias': ['salud'], 'extensiones': ['pdf', 'doc']}
        # Solr Schema tiene: 'categoria' (singular) y 'extension' (singular)
        if filtros:
            lista_fq = []
            
            # Mapeo de nombres del frontend a nombres del Schema
            mapa_campos = {
                'categorias': 'categoria',
                'extensiones': 'extension'
            }

            for llave_front, valores in filtros.items():
                if not valores: continue # Si la lista está vacía, saltar
                
                campo_schema = mapa_campos.get(llave_front, llave_front)
                
                # LÓGICA DE FILTRADO: 
                # Dentro de una misma faceta (ej. extensiones), usamos OR.
                # (Quiero PDFs O Docs).
                # Syntax Solr: fq=extension:("pdf" OR "doc")
                valores_limpios = [f'"{v}"' for v in valores] # Comillas para manejar espacios
                query_filtro = f'{campo_schema}:({" OR ".join(valores_limpios)})'
                
                lista_fq.append(query_filtro)
            
            # Agregamos la lista de Filter Queries a los parámetros
            parametros['fq'] = lista_fq

        # 3. PROCESAMIENTO DE ORDENAMIENTO
        # Solr espera formato "campo direccion". Ej: "fecha desc"
        if orden and orden != "ninguno":
            parametros['sort'] = orden

        query_procesada = self.traducir_consulta(query)

        try:
            # Hacemos la búsqueda
            resultados = self.solr.search(query_procesada, **parametros)
            
            # -----------------------------------------------------
            # CRÍTICO: PROCESAMIENTO DE HIGHLIGHTING Y MERGE
            # -----------------------------------------------------
            
            documentos_finales = []
            
            for doc in resultados.docs:
                doc_id = doc.get('id')
                
                # 1. Buscamos los snippets resaltados
                highlight_data = resultados.highlighting.get(doc_id)
                
                # COMENTARIO DE INTENCIÓN: Si Solr devolvió snippets para este doc, 
                # los combinamos y los inyectamos en un nuevo campo, 
                # manteniendo el HTML (<em>).
                if highlight_data and 'contenido' in highlight_data:
                    # Unimos los 3 fragmentos con un separador visual 
                    snippets_list = highlight_data['contenido']
                    snippet_combinado = " ... ".join(snippets_list)
                    
                    # 2. Asignamos al documento
                    doc['contenido_snippet'] = snippet_combinado 
                else:
                    # Si no hay resaltado, asignamos el contenido original 
                    doc['contenido_snippet'] = doc.get('contenido') 
                    
                documentos_finales.append(doc)

            # --- LÓGICA DE EXTRACCIÓN DEL SPELLCHECK (sin cambios) ---
            correccion_sugerida = None
            
            if hasattr(resultados, 'spellcheck') and resultados.spellcheck:
                collations = resultados.spellcheck.get('collations', [])
                if len(collations) > 0 and isinstance(collations[-1], str) and collations[-1].lower() != query.lower():
                    correccion_sugerida = collations[-1]

            # --- LÓGICA CRÍTICA: PAGINACIÓN EN PYTHON (SLICING) ---
            indice_inicio = (pagina - 1) * rows_por_pagina
            indice_fin = indice_inicio + rows_por_pagina
            
            # Usamos la lista de documentos finales que contiene el snippet resaltado
            documentos_paginados = documentos_finales[indice_inicio:indice_fin] 
            
            # Retornamos un diccionario limpio y estructurado
            return {
                "docs": documentos_paginados, 
                "numFound": resultados.hits,
                "spellcheck": correccion_sugerida, 
                "facets": resultados.facets 
            }

        except Exception as e:
            print(f"❌ Error buscando: {e}")
            return {"docs": [], "numFound": 0, "spellcheck": None, "facets": {}}
        
    # En solr_cliente.py
    def obtener_sugerencias(self, termino):
        """
        Recupera sugerencias predictivas (Autocomplete).
        """
        if not termino or len(termino) < 2:
            return {"suggestions": []}

        params = {
            "suggest": "true",
            "suggest.build": "false",
            "suggest.dictionary": "miSugestor",
            "suggest.q": termino,
            "wt": "json"
        }

        try:
            res = requests.get(f"{SOLR_URL}/suggest", params=params, timeout=1)
            
            if res.status_code != 200:
                return {"suggestions": []}
                
            data = res.json()
            lista_sugerencias = []
            
            # Navegación segura por la respuesta de AnalyzingInfixLookupFactory
            # La estructura sigue siendo: suggest -> miSugestor -> {termino} -> suggestions
            suggest_component = data.get('suggest', {})
            dictionaries = suggest_component.get('miSugestor', {})
            
            # Iteramos sobre las llaves (que son el término buscado)
            for key_term, value_obj in dictionaries.items():
                if 'suggestions' in value_obj:
                    for item in value_obj['suggestions']:
                        # item['term'] contiene la frase sugerida (ej. "Facultad de Matemáticas")
                        t = item['term']
                        if t not in lista_sugerencias:
                            lista_sugerencias.append(t)
            
            # Clean Code: Limitamos a 8 resultados para no saturar la UI
            return {"suggestions": lista_sugerencias[:8]}

        except Exception as e:
            print(f"[ERROR SUGGESTER] {e}")
            return {"suggestions": []}

    def construir_sugerencias(self):
        """
        Fuerza el guardado en disco y reconstruye el índice de sugerencias.
        
        COMENTARIO DE INTENCIÓN: Aumentamos el timeout a 120 segundos para asegurar
        que el proceso de indexación y reconstrucción de caché no se corte en Solr,
        especialmente si el índice es grande.
        """
        
        # Nuevo timeout para operaciones pesadas
        TIMEOUT_BUILD = 120 
        
        try:
            print("💾 Forzando hard commit en Solr (Datos de RAM a Disco)...")
            # 1. HARD COMMIT: Asegura que los docs pasen de RAM a Disco (CRÍTICO para Suggester)
            # Usamos /update/json para una respuesta limpia, aunque /update?commit=true funciona
            requests.post(f"{SOLR_URL}/update?commit=true", data='<commit/>', headers={'Content-Type': 'text/xml'}, timeout=TIMEOUT_BUILD)
            
            print("🏗 Construyendo diccionario de sugerencias (suggest.build=true)...")
            # 2. BUILD: Ahora sí, construimos sobre datos seguros en el disco
            # El Suggester lee los datos del índice principal (que acaba de ser committed)
            build_url = f"{SOLR_URL}/suggest?suggest.build=true"
            requests.get(build_url, timeout=TIMEOUT_BUILD)
            
            print("✅ Sugerencias actualizadas correctamente.")
            
        except requests.exceptions.Timeout:
            print(f"❌ Error crítico construyendo sugerencias: ¡Tiempo de espera ({TIMEOUT_BUILD}s) agotado!")
            print("   Recomendación: Incrementar el timeout de la API o reducir el volumen de datos a indexar.")
        except Exception as e:
            print(f"❌ Error crítico construyendo sugerencias: {e}")
    


    def traducir_consulta(self, query_usuario):
        """
        Traduce sintaxis académica a Solr respetando jerarquías (paréntesis).
        """
        if not query_usuario: 
            return "*:*"

        q = query_usuario

        # 1. Traducir CADENA("texto") -> "texto"
        # El (.*?) captura el contenido de forma "no codiciosa" (non-greedy)
        q = re.sub(r'CADENA\s*\((.*?)\)', r'"\1"', q, flags=re.IGNORECASE)

        # 2. Traducir PATRON(texto) -> texto*
        q = re.sub(r'PATRON\s*\((.*?)\)', r'\1*', q, flags=re.IGNORECASE)

        # 3. Traducir Operadores (AND, OR, NOT)
        # Usamos \b (word boundary) para que detecte "OR" incluso si está pegado a paréntesis
        # Ej: "(A)OR(B)" -> "(A) OR (B)"
        
        # NOT: Debe ser reemplazado primero para evitar conflictos
        q = re.sub(r'\bnot\b', 'NOT', q, flags=re.IGNORECASE)
        # También manejamos el símbolo '-' o '!' si quieres dar soporte extra
        
        q = re.sub(r'\band\b', 'AND', q, flags=re.IGNORECASE)
        q = re.sub(r'\bor\b', 'OR', q, flags=re.IGNORECASE)
        
        return q

    def eliminar_todo(self):
        """
        Borra TODOS los documentos del índice (q=*:*) y fuerza el guardado.
        
        CRÍTICO: Además, reconstruye el diccionario del Suggester para 
        limpiar la caché de sugerencias obsoletas.
        """
        try:
            # 1. Eliminar todos los documentos (Índice Lucene)
            self.solr.delete(q='*:*', commit=True)
            print("☢️  ÍNDICE PURGADO: Se han eliminado todos los documentos.")
            
            # 2. Reconstruir el Suggester (Diccionario de Autocompletado)
            # Esto llama a /suggest?suggest.build=true, que crea un diccionario vacío.
            self.construir_sugerencias()
            
            print("✅ Sugerencias limpiadas. El sistema está completamente vacío.")
            return True
        except Exception as e:
            print(f"❌ Error eliminando índice: {e}")
            return False
        
    # En solr_cliente.py
    def obtener_hash_existente(self, id_documento):
        """Busca y retorna el hash y contenido de un doc por su ID (URL)."""
        params = {'fl': 'hash_contenido,contenido'}
        resultados = self.solr.search(f'id:"{id_documento}"', **params)

        if resultados.hits > 0:
            return resultados.docs[0] # Retorna un diccionario con 'hash_contenido' y 'contenido'
        return None