import type { SearchRequest } from "../schema.ts";
import type { FlightProvider, ProviderResult, RepriceInput, RepriceResult, SearchOptions } from "./types.ts";

/**
 * Кэш выдачи поставщика + объединение одинаковых параллельных запросов.
 *
 * ЗАЧЕМ ЭТО ОБЯЗАТЕЛЬНО ПРИ РАБОТЕ С ВНЕШНИМ ШЛЮЗОМ.
 *
 * Страница поиска перезапрашивает выдачу при каждом изменении фильтров
 * (useFlightSearch: смена filters -> новый POST /api/search). Ползунок времени
 * за одно движение даёт несколько запросов даже с debounce. Пока источником был
 * генератор, это стоило миллисекунды. Обращение к NDC-шлюзу стоит секунд,
 * квоты и денег, а результат при этом не меняется: фильтры применяются на
 * нашей стороне и на запрос к поставщику не влияют.
 *
 * Поэтому ключ кэша строится ТОЛЬКО из полей, которые меняют ответ поставщика:
 * маршрут, пассажиры, класс, валюта. Фильтры и сортировка в ключ не входят
 * — иначе кэш не попадал бы ни разу и смысла не имел.
 *
 * Второй механизм — «одинокий полёт» (single-flight): если два человека
 * одновременно ищут один и тот же маршрут, наружу уходит один запрос, а ответ
 * получают оба. Без этого всплеск посетителей превращается во всплеск
 * обращений к шлюзу.
 *
 * Хранилище — в памяти процесса. Для одного инстанса этого достаточно; при
 * нескольких инстансах то же место занимает Redis, а интерфейс остаётся тем же.
 */

export interface CacheOptions {
  enabled: boolean;
  ttlMs: number;
  maxEntries: number;
}

interface Entry {
  value: ProviderResult;
  expiresAt: number;
}

/** Ключ, отражающий смысл запроса к поставщику: без фильтров и без порядка полей. */
export function cacheKey(provider: string, request: SearchRequest): string {
  const route = request.itinerary
    .map((s) => `${s.origin}>${s.destination}@${s.departureDate}`)
    .join("|");
  const p = request.passengers;
  return [
    provider,
    request.tripType,
    request.cabinClass,
    request.currency,
    `${p.adults}-${p.teens}-${p.children}-${p.infants}`,
    route,
  ].join("/");
}

export function withCache(provider: FlightProvider, options: CacheOptions): FlightProvider {
  if (!options.enabled) return provider;

  const entries = new Map<string, Entry>();
  const inFlight = new Map<string, Promise<ProviderResult>>();

  const evictExpired = (now: number) => {
    for (const [key, entry] of entries) {
      if (entry.expiresAt <= now) entries.delete(key);
    }
  };

  return {
    name: provider.name,

    search(request: SearchRequest, searchOptions?: SearchOptions): Promise<ProviderResult> {
      const key = cacheKey(provider.name, request);
      const now = Date.now();

      const cached = entries.get(key);
      if (cached && cached.expiresAt > now) return Promise.resolve(cached.value);

      const pending = inFlight.get(key);
      if (pending) return pending;

      // Сигнал отмены НЕ передаётся в общий запрос намеренно: уход одного
      // клиента не должен обрывать ответ, которого ждут остальные.
      const promise = provider.search(request, { signal: searchOptions?.signal })
        .then((result) => {
          evictExpired(Date.now());
          // Грубое ограничение размера: при переполнении вытесняется самая
          // старая запись. Точный LRU здесь не нужен — записей десятки.
          if (entries.size >= options.maxEntries) {
            const oldest = entries.keys().next().value;
            if (oldest) entries.delete(oldest);
          }
          entries.set(key, { value: result, expiresAt: Date.now() + options.ttlMs });
          return result;
        })
        .finally(() => inFlight.delete(key));

      inFlight.set(key, promise);
      return promise;
    },

    /* Пересчёт цены не кэшируется и объединению не подлежит: его смысл в том,
       чтобы получить цену на сейчас. Отдать сохранённый ответ значило бы
       подтвердить цену, которой, возможно, уже нет.

       Метод пробрасывается, только если он есть у источника: иначе обёртка
       объявила бы умение, которого нет, и вызов падал бы уже внутри. */
    reprice: provider.reprice
      ? (input: RepriceInput, searchOptions?: SearchOptions): Promise<RepriceResult> =>
        provider.reprice!(input, searchOptions)
      : undefined,
  };
}
