import type { SearchRequest } from "./schema.ts";
import type { Offer } from "./offer.ts";

/**
 * Выдача последних поисков, разложенная по searchId.
 *
 * ЗАЧЕМ. Пересчёт цены должен знать, какое именно предложение выбрано, и все
 * его подробности: рейсы, ключи сегментов, базисы тарифов. Способов передать
 * это два.
 *
 *   1. Фронт присылает предложение целиком обратно.
 *   2. Фронт присылает searchId и offerId, а подробности сервер берёт у себя.
 *
 * Выбран второй. Первый означает, что параметры запроса к шлюзу приходят из
 * браузера: их можно подменить, а мы это не проверим — цена, маршрут и
 * тариф в запросе к S7 стали бы тем, что прислал клиент. Второй способ
 * оставляет наружу два коротких идентификатора, а данные — там, где они
 * появились.
 *
 * Плата за это — состояние: выдача живёт ограниченное время, и после
 * истечения человек получает внятное «результаты устарели, повторите поиск»
 * вместо тихо неверной цены.
 *
 * Хранилище — в памяти процесса, как и кэш выдачи. При нескольких инстансах
 * его место занимает Redis; интерфейс останется тем же.
 */

export interface StoredSearch {
  request: SearchRequest;
  offers: Offer[];
  expiresAt: number;
}

export interface ResultsStoreOptions {
  ttlMs: number;
  maxEntries: number;
}

export class ResultsStore {
  readonly #entries = new Map<string, StoredSearch>();
  readonly #ttlMs: number;
  readonly #maxEntries: number;

  constructor(options: ResultsStoreOptions) {
    this.#ttlMs = options.ttlMs;
    this.#maxEntries = options.maxEntries;
  }

  save(searchId: string, request: SearchRequest, offers: Offer[]): void {
    this.#evictExpired();
    // Грубое ограничение размера: при переполнении вытесняется самая старая
    // запись. Map хранит порядок вставки, поэтому первый ключ — он и есть.
    if (this.#entries.size >= this.#maxEntries) {
      const oldest = this.#entries.keys().next().value;
      if (oldest) this.#entries.delete(oldest);
    }
    this.#entries.set(searchId, { request, offers, expiresAt: Date.now() + this.#ttlMs });
  }

  /** Предложение по паре идентификаторов. undefined — выдача устарела или id чужой. */
  find(searchId: string, offerId: string): { request: SearchRequest; offer: Offer } | undefined {
    const entry = this.#entries.get(searchId);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.#entries.delete(searchId);
      return undefined;
    }
    const offer = entry.offers.find((item) => item.id === offerId);
    return offer ? { request: entry.request, offer } : undefined;
  }

  #evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.#entries) {
      if (entry.expiresAt <= now) this.#entries.delete(key);
    }
  }
}
