import { z } from "npm:zod@3.23.8";
import { config } from "./config.ts";
import { searchRequestSchema } from "./schema.ts";
import { applyFilters, buildFacets } from "./filters.ts";
import { getProvider } from "./providers/registry.ts";
import { ProviderError } from "./providers/types.ts";

/**
 * Модуль поиска рейсов. Ничего не запускает сам.
 *
 * Использование:
 *   const response = await searchRoutes(request);
 *   if (response) return response;      // запрос обработан здесь
 *   ...ваша остальная маршрутизация
 *
 * Порядок обработки POST /api/search:
 *   1. проверка формата и размера тела;
 *   2. проверка параметров схемой (schema.ts) — контракт с фронтом;
 *   3. запрос к поставщику (providers/registry.ts) — генератор или S7;
 *   4. фильтры, сортировка и фасеты поверх полученного набора (filters.ts).
 *
 * Шаг 3 отделён от шага 4 сознательно: поставщика спрашивают про маршрут,
 * фильтры применяются локально. Из-за этого смена фильтров на странице
 * обслуживается из кэша и не порождает обращений к внешнему шлюзу.
 */

interface ErrorDetail {
  path: string;
  message: string;
}

/**
 * CORS — правило браузера: страница с адреса A может обращаться к серверу B
 * только если сервер B явно это разрешил. Разработка идёт с localhost:3000,
 * сервер — на localhost:8000, это разные адреса, поэтому разрешение обязательно.
 */
export function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && config.allowedOrigins.includes(origin) ? origin : config.allowedOrigins[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Accept",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

const json = (body: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(origin) },
  });

const fail = (
  status: number,
  code: string,
  message: string,
  origin: string | null,
  details: ErrorDetail[] = [],
) => json({ error: { code, message, details } }, status, origin);

/** Ошибки zod -> плоский список, который фронт раскладывает по полям формы. */
const toDetails = (error: z.ZodError): ErrorDetail[] =>
  error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));

async function handleSearch(request: Request, origin: string | null): Promise<Response> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return fail(415, "UNSUPPORTED_MEDIA_TYPE", "Ожидается Content-Type: application/json", origin);
  }

  const raw = await request.text();
  if (raw.length > config.maxBodyBytes) {
    return fail(413, "PAYLOAD_TOO_LARGE", "Слишком большое тело запроса", origin);
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return fail(400, "MALFORMED_JSON", "Тело запроса не является корректным JSON", origin);
  }

  const result = searchRequestSchema.safeParse(parsedJson);
  if (!result.success) {
    return fail(
      422,
      "VALIDATION_ERROR",
      "Параметры поиска не прошли проверку",
      origin,
      toDetails(result.error),
    );
  }

  const searchRequest = result.data;
  const started = performance.now();

  // Полный набор нужен дважды: из него получается выдача и из него же
  // считаются фасеты — значения, которые имеет смысл предлагать в фильтрах.
  const provided = await getProvider().search(searchRequest, { signal: request.signal });
  const offers = applyFilters(provided.offers, searchRequest);
  const facets = buildFacets(provided.offers, searchRequest);

  return json(
    {
      searchId: crypto.randomUUID(),
      flights: offers,
      facets,
      meta: {
        total: offers.length,
        /** Сколько предложений пришло от поставщика до применения фильтров. */
        totalBeforeFilters: provided.offers.length,
        currency: searchRequest.currency,
        tripType: searchRequest.tripType,
        cabinClass: searchRequest.cabinClass,
        source: provided.source,
        warnings: provided.warnings,
        elapsedMs: Math.round(performance.now() - started),
        generatedAt: new Date().toISOString(),
      },
    },
    200,
    origin,
  );
}

/**
 * Обрабатывает /api/health, /api/search и OPTIONS-предзапросы.
 * Возвращает null, если запрос к этому модулю не относится.
 */
export async function searchRoutes(request: Request): Promise<Response | null> {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (url.pathname === "/api/health" && request.method === "GET") {
    return json({ status: "ok", provider: config.provider, time: new Date().toISOString() }, 200, origin);
  }

  if (url.pathname === "/api/search") {
    if (request.method !== "POST") {
      return fail(405, "METHOD_NOT_ALLOWED", "Используйте POST", origin);
    }
    try {
      return await handleSearch(request, origin);
    } catch (error) {
      // Отказ поставщика — не «внутренняя ошибка сервера»: у него свой код и
      // свой статус, и фронт по ним различает «повторите» и «так не получится».
      if (error instanceof ProviderError) {
        console.error(`провайдер ${config.provider}: ${error.code} — ${error.internal ?? error.message}`);
        return fail(error.status, error.code, error.message, origin, error.details);
      }
      // Клиент закрыл вкладку — отвечать некому, но и в лог как сбой не пишем.
      if (error instanceof DOMException && error.name === "AbortError") {
        return new Response(null, { status: 499, headers: corsHeaders(origin) });
      }
      // Внутренние детали наружу не отдаём — только в лог.
      console.error("search failed:", error);
      return fail(500, "INTERNAL_ERROR", "Внутренняя ошибка сервера", origin);
    }
  }

  return null;
}
