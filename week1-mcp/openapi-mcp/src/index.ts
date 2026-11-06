#!/usr/bin/env node
// Servidor MCP (stdio) que expone una especificación OpenAPI 3.x como herramientas de consulta.
// IMPORTANTE: stdout es el canal del protocolo; todo log va a stderr con console.error.

import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Tipos mínimos de OpenAPI: solo lo que necesitamos leer
// ---------------------------------------------------------------------------

type JsonObject = Record<string, unknown>;

interface Operation {
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: unknown[];
  requestBody?: unknown;
  responses?: unknown;
}

type PathItem = Partial<Record<HttpMethod, Operation>> & { parameters?: unknown[] };

interface OpenApiDoc {
  openapi?: string;
  swagger?: string;
  paths?: Record<string, PathItem>;
}

// Métodos HTTP válidos como claves de un Path Item
const HTTP_METHODS = ["get", "put", "post", "delete", "options", "head", "patch", "trace"] as const;
type HttpMethod = (typeof HTTP_METHODS)[number];

const MAX_RESULTS = 50;

// ---------------------------------------------------------------------------
// Carga de la especificación (JSON o YAML según la extensión)
// ---------------------------------------------------------------------------

async function loadSpec(): Promise<OpenApiDoc> {
  const specPath = process.env.OPENAPI_SPEC;
  if (!specPath) {
    throw new Error("Falta la variable de entorno OPENAPI_SPEC con la ruta a la especificación.");
  }

  const fullPath = resolve(specPath);
  const raw = await readFile(fullPath, "utf8");

  // .json → JSON.parse; cualquier otra extensión → YAML (que además acepta JSON)
  const parsed: unknown = extname(fullPath).toLowerCase() === ".json" ? JSON.parse(raw) : parseYaml(raw);

  if (!isObject(parsed)) {
    throw new Error(`La especificación en ${fullPath} no es un objeto válido.`);
  }

  const doc = parsed as OpenApiDoc;
  if (doc.swagger) {
    console.error(`[openapi-mcp] Aviso: ${fullPath} es Swagger ${doc.swagger}; se espera OpenAPI 3.x (no habrá requestBody).`);
  }
  if (!isObject(doc.paths)) {
    console.error(`[openapi-mcp] Aviso: la especificación no tiene "paths".`);
  }

  console.error(`[openapi-mcp] Especificación cargada: ${fullPath}`);
  return doc;
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Devuelve el valor tipado como T si es un objeto; si no, undefined (evita intersecciones raras al estrechar)
function asObject<T>(value: unknown): T | undefined {
  return isObject(value) ? (value as T) : undefined;
}

// Sigue un JSON Pointer local ("#/components/schemas/Pet") dentro del documento
function followPointer(doc: unknown, ref: string): unknown {
  return ref
    .slice(2)
    .split("/")
    .map((part) => decodeURIComponent(part).replace(/~1/g, "/").replace(/~0/g, "~"))
    .reduce<unknown>((node, key) => (isObject(node) || Array.isArray(node) ? (node as JsonObject)[key] : undefined), doc);
}

// Resuelve recursivamente los $ref locales para que la respuesta sea autocontenida.
// Las referencias externas o circulares se dejan tal cual para no entrar en bucle.
function resolveRefs(node: unknown, doc: unknown, seen: ReadonlySet<string> = new Set()): unknown {
  if (Array.isArray(node)) {
    return node.map((item) => resolveRefs(item, doc, seen));
  }
  if (!isObject(node)) {
    return node;
  }

  const ref = node["$ref"];
  if (typeof ref === "string") {
    if (!ref.startsWith("#/")) return { $ref: ref, note: "referencia externa no resuelta" };
    if (seen.has(ref)) return { $ref: ref, note: "referencia circular" };

    const target = followPointer(doc, ref);
    if (target === undefined) return { $ref: ref, note: "referencia no encontrada" };

    // Los campos hermanos de $ref (p. ej. description en 3.1) prevalecen sobre el destino
    const { $ref: _ignored, ...siblings } = node;
    const resolved = resolveRefs(target, doc, new Set([...seen, ref]));
    return isObject(resolved) ? { ...resolved, ...resolveRefs(siblings, doc, seen) as JsonObject } : resolved;
  }

  return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, resolveRefs(value, doc, seen)]));
}

// Combina parámetros del path y de la operación: los de la operación ganan (misma name + in)
function mergeParameters(pathLevel: unknown[] = [], opLevel: unknown[] = []): unknown[] {
  const keyOf = (p: unknown): string => (isObject(p) ? `${String(p["in"])}:${String(p["name"])}` : JSON.stringify(p));
  const merged = new Map<string, unknown>();
  for (const p of [...pathLevel, ...opLevel]) merged.set(keyOf(p), p);
  return [...merged.values()];
}

// Recorre todos los paths y devuelve una lista plana de endpoints
function collectEndpoints(doc: OpenApiDoc) {
  const endpoints: { method: string; path: string; summary: string; operationId?: string }[] = [];
  for (const [path, rawItem] of Object.entries(doc.paths ?? {})) {
    const item = asObject<PathItem>(rawItem);
    if (!item) continue;
    for (const method of HTTP_METHODS) {
      const op = asObject<Operation>(item[method]);
      if (!op) continue;
      endpoints.push({
        method: method.toUpperCase(),
        path,
        summary: op.summary ?? op.description?.split("\n")[0] ?? "",
        ...(op.operationId ? { operationId: op.operationId } : {}),
      });
    }
  }
  return endpoints;
}

// Formatea una respuesta de herramienta como texto JSON
function jsonResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

// ---------------------------------------------------------------------------
// Arranque: cargar spec, registrar herramientas y conectar por stdio
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const doc = await loadSpec();
  const endpoints = collectEndpoints(doc);

  const server = new McpServer({ name: "openapi-explorer", version: "1.0.0" });

  // Herramienta 1: listado de endpoints con filtro opcional y tope de 50
  server.registerTool(
    "list_endpoints",
    {
      title: "Listar endpoints",
      description:
        `Lista los endpoints de la API (método, ruta y resumen). Filtro opcional por texto ` +
        `sobre método, ruta, resumen u operationId. Devuelve como máximo ${MAX_RESULTS} resultados.`,
      inputSchema: {
        filter: z.string().optional().describe("Texto a buscar (sin distinguir mayúsculas)"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ filter }) => {
      const needle = filter?.trim().toLowerCase();
      const matches = needle
        ? endpoints.filter((e) =>
            [e.method, e.path, e.summary, e.operationId ?? ""].some((field) => field.toLowerCase().includes(needle)),
          )
        : endpoints;

      return jsonResult({
        total: matches.length,
        returned: Math.min(matches.length, MAX_RESULTS),
        truncated: matches.length > MAX_RESULTS,
        endpoints: matches.slice(0, MAX_RESULTS),
      });
    },
  );

  // Herramienta 2: detalle de un endpoint concreto ($ref resueltos)
  server.registerTool(
    "get_endpoint",
    {
      title: "Detalle de endpoint",
      description: "Devuelve parámetros, requestBody y responses de un endpoint dado su método y su ruta exacta.",
      inputSchema: {
        method: z.string().describe("Método HTTP, p. ej. GET o post"),
        path: z.string().describe("Ruta tal como aparece en la especificación, p. ej. /pet/{petId}"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ method, path }) => {
      const m = method.trim().toLowerCase();

      // Validar el método antes de buscar
      if (!(HTTP_METHODS as readonly string[]).includes(m)) {
        return errorResult(`Método no válido: "${method}". Usa uno de: ${HTTP_METHODS.join(", ").toUpperCase()}.`);
      }

      // Buscar la ruta; si no existe, sugerir rutas que contengan el texto buscado
      const item = asObject<PathItem>(doc.paths?.[path]);
      if (!item) {
        const hint = endpoints
          .map((e) => e.path)
          .filter((p, i, all) => all.indexOf(p) === i && p.toLowerCase().includes(path.toLowerCase().replace(/\/+$/, "")))
          .slice(0, 5);
        return errorResult(
          `No existe la ruta "${path}" en la especificación.` +
            (hint.length ? ` ¿Quizá: ${hint.join(", ")}?` : " Usa list_endpoints para ver las disponibles."),
        );
      }

      // La ruta existe pero no tiene ese método
      const op = asObject<Operation>(item[m as HttpMethod]);
      if (!op) {
        const available = HTTP_METHODS.filter((x) => isObject(item[x])).map((x) => x.toUpperCase());
        return errorResult(
          `La ruta "${path}" no tiene método ${m.toUpperCase()}. Métodos disponibles: ${available.join(", ") || "ninguno"}.`,
        );
      }

      // Construir la respuesta con referencias resueltas
      return jsonResult({
        method: m.toUpperCase(),
        path,
        summary: op.summary,
        description: op.description,
        operationId: op.operationId,
        parameters: resolveRefs(mergeParameters(item.parameters, op.parameters), doc),
        requestBody: resolveRefs(op.requestBody ?? null, doc),
        responses: resolveRefs(op.responses ?? {}, doc),
      });
    },
  );

  // Conectar el transporte stdio
  await server.connect(new StdioServerTransport());
  console.error(`[openapi-mcp] Servidor listo (${endpoints.length} endpoints).`);
}

// Cualquier error de arranque se informa por stderr y termina el proceso
main().catch((err: unknown) => {
  console.error("[openapi-mcp] Error fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});