# Día 3 · Mi propio servidor MCP para especificaciones OpenAPI

**Objetivo:** construir un servidor MCP en TypeScript que permita a un LLM consultar una especificación OpenAPI por partes, en vez de pegarla entera en el chat (las grandes, como Stripe, no caben).
**Tiempo:** [1 h]

## Qué construí
- Servidor MCP `openapi-explorer` en `openapi-mcp/` (TypeScript, `@modelcontextprotocol/sdk` 1.32.2, transporte stdio).
- Lee la especificación indicada en la variable de entorno `OPENAPI_SPEC` (JSON o YAML).
- Dos herramientas, ambas de solo lectura:
  - `list_endpoints`: método, ruta, resumen y operationId; filtro por texto; máximo 50 resultados con `total` y `truncated`.
  - `get_endpoint`: parámetros, requestBody y responses de un endpoint, con los `$ref` resueltos.
- Código generado con Claude (chat), revisado y compilado por mí en mi máquina.

## Cómo lo probé (MCP Inspector)
```powershell
npm run build
npx @modelcontextprotocol/inspector -e OPENAPI_SPEC=<ruta absoluta>\specs\petstore.json node build/index.js
```
| # | Prueba | Esperado | Resultado |
|---|---|---|---|
| 1 | `list_endpoints` sin filtro | 19 operaciones (contadas en el fichero) | ✅ total 19 |
| 2 | `get_endpoint` GET `/pet/{petId}` | `petId` en path, respuestas 200/400/404 | ✅ (más `default`) |
| 3 | `get_endpoint` GET `/coche` | Error controlado | ✅ `isError` con mensaje claro |
| 3b | `get_endpoint` GET `/order` | Sugiere rutas que contienen "/order" | ✅ |
| 3c | `get_endpoint` GET `/pets/{petId}` | La IA dijo "sugiere rutas parecidas" | ❌ No sugiere nada (solo busca texto contenido) |

## Qué falló y cómo lo resolví
| # | Síntoma | Causa | Cómo lo detecté | Solución |
|---|---|---|---|---|
| 1 | `package.json` inválido | `"type": "module"` pegado fuera de la llave, sin coma, y `"type": "commonjs"` duplicado | Validación con un parser JSON, no a ojo | Reescribir el fichero; una sola clave `type` |
| 2 | `tsconfig.json` de TypeScript 7 sin tipos de Node | `"types": []` por defecto en TS 7 | Revisión antes de compilar | `"types": ["node"]`, `rootDir` y `outDir` |
| 3 | La IA dijo "lo he compilado y probado", pero en mi PC no existía `build/` | Lo probó en su propio entorno, no en el mío (allí compilaba en `dist/`) | Comprobar la carpeta en mi máquina | Compilar y probar en local |
| 4 | Inspector: "Connection closed" / falta `OPENAPI_SPEC` | Los clientes MCP no pasan al servidor las variables de entorno de la terminal | Mensaje del propio servidor en la consola (stderr) | Pasar la variable con `-e` y ruta absoluta |
| 5 | La IA prometía "sugerir rutas parecidas" | El código solo busca rutas que contienen el texto exacto | Prueba 3c y lectura del código | Corregir la descripción para que diga lo que hace |
| 6 | El ejemplo de la herramienta era `/pets/{petId}`, que no existe en mi especificación | La IA usó un ejemplo genérico de Petstore | Comparación con `list_endpoints` | Cambiado a `/pet/{petId}` (lo lee el modelo) |

## Riesgo pendiente (verificar con Stripe)
Resolver los `$ref` copia los esquemas completos dentro de la respuesta. En Petstore el esquema `Pet` sale dos veces (JSON y XML). En una especificación grande esto puede generar respuestas enormes que llenen el contexto del modelo.

## Preguntas de entrevista sobre el código (respuestas corregidas)
1. **¿Qué hace `server.connect(new StdioServerTransport())` y por qué `console.log` lo rompe?** Arranca el servidor usando la entrada y salida estándar como canal. stdout es el canal del protocolo (mensajes JSON-RPC); `console.log` mete texto ajeno en ese canal y el cliente no puede interpretarlo. Los mensajes de depuración van por stderr con `console.error`.
2. **¿Quién lee el `inputSchema` y sus descripciones?** El modelo. El servidor los envía en la llamada `tools/list`, y el modelo decide con ellos cuándo usar la herramienta y qué parámetros pasar. Por eso un ejemplo erróneo en la descripción es un fallo real.
3. **¿Qué hace `resolveRefs` y qué riesgo tiene?** Sustituye cada `$ref` por la definición a la que apunta, también dentro de las definiciones. Mejora la precisión, pero con especificaciones grandes y anidadas puede generar respuestas enormes: más contexto ocupado, más coste y posibles cortes.
4. **¿Qué es `readOnlyHint: true`?** Una marca que indica al cliente que la herramienta no modifica nada; el cliente puede usarla para no pedir confirmación. Mis dos herramientas solo leen la especificación. (En el día 2, Jira pedía permiso para escribir y no para leer.)
5. **¿Por qué `isError: true` y no una excepción?** El error llega al modelo como un resultado que puede leer, así que puede corregirse solo (por ejemplo, llamar a `list_endpoints`). Una excepción sería un fallo técnico del que el modelo no aprende nada.

Mi primera versión de estas respuestas sacó 2,5/5: fallé la 1 (lo relacioné con excepciones) y la 4 (lo confundí con filtrar la respuesta).

## Uso de IA
- Código generado con IA y revisado por mí; 2 afirmaciones de la IA eran falsas o engañosas (fallos 3 y 5).
- Validé cada resultado contra la especificación real y con el Inspector.
