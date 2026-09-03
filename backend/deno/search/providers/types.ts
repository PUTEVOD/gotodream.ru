import type { SearchRequest } from "../schema.ts";
import type { Offer } from "../offer.ts";

/**
 * Контракт поставщика рейсов.
 *
 * Один метод и один тип на выходе. Всё, что специфично для источника —
 * SOAP, XML, коды тарифов, авторизация, — остаётся внутри реализации и
 * наружу не протекает. Добавить нового поставщика значит написать объект с
 * этим интерфейсом и зарегистрировать его в registry.ts; ни handler, ни
 * фильтры, ни фронтенд об этом не узнают.
 */
export interface FlightProvider {
  readonly name: string;
  search(request: SearchRequest, options?: SearchOptions): Promise<ProviderResult>;
}

export interface SearchOptions {
  /** Отмена запроса, если клиент ушёл со страницы. */
  signal?: AbortSignal;
}

export interface ProviderResult {
  offers: Offer[];
  /** Имя источника: попадает в meta ответа, видно в devtools при разборе жалоб. */
  source: string;
  /**
   * Непустой список означает: ответ получен и пригоден, но часть данных
   * пришлось пропустить (например, одно предложение из тридцати не разобралось).
   * Отдаётся в meta, роняет запрос только в тестах.
   */
  warnings: string[];
}

/**
 * Коды отказов поставщика. Каждому соответствует один HTTP-статус наружу —
 * фронт различает «мы не сможем это показать» и «попробуйте ещё раз».
 */
export const PROVIDER_ERROR_STATUS = {
  /** Не заданы логин/пароль или реквизиты агента. Ошибка развёртывания, не пользователя. */
  PROVIDER_MISCONFIGURED: 500,
  /** Шлюз не принял учётные данные: 401/403. */
  PROVIDER_AUTH: 502,
  /** Не уложились в таймаут. */
  PROVIDER_TIMEOUT: 504,
  /** Сеть, 5xx, SOAP Fault. */
  PROVIDER_UNAVAILABLE: 502,
  /** Ответ пришёл, но разобрать его не удалось. */
  PROVIDER_BAD_RESPONSE: 502,
  /** Шлюз осмысленно отказал: нет рейсов по правилам, неверные параметры запроса. */
  PROVIDER_REJECTED: 422,
} as const;

export type ProviderErrorCode = keyof typeof PROVIDER_ERROR_STATUS;

export interface ProviderErrorDetail {
  path: string;
  message: string;
}

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly status: number;
  readonly details: ProviderErrorDetail[];
  /** Техническая расшифровка для лога. Наружу не отдаётся. */
  readonly internal?: string;

  constructor(
    code: ProviderErrorCode,
    message: string,
    options: { details?: ProviderErrorDetail[]; internal?: string; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "ProviderError";
    this.code = code;
    this.status = PROVIDER_ERROR_STATUS[code];
    this.details = options.details ?? [];
    this.internal = options.internal;
  }
}
