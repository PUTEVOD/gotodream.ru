/** Конфигурация берётся только из переменных окружения — никаких значений в коде. */

const env = (name: string) => Deno.env.get(name)?.trim() || undefined;

const bool = (name: string, fallback = false) => {
  const raw = env(name)?.toLowerCase();
  if (raw === undefined) return fallback;
  return raw === "1" || raw === "true" || raw === "yes";
};

const num = (name: string, fallback: number) => {
  const raw = Number(env(name));
  return Number.isFinite(raw) ? raw : fallback;
};

/** Источник выдачи. mock — генератор, s7 — реальный NDC-шлюз S7. */
export const PROVIDERS = ["mock", "s7"] as const;
export type ProviderName = typeof PROVIDERS[number];

const providerName = (): ProviderName => {
  const raw = (env("FLIGHT_PROVIDER") ?? "mock") as ProviderName;
  if (!PROVIDERS.includes(raw)) {
    throw new Error(`FLIGHT_PROVIDER=${raw}: допустимые значения — ${PROVIDERS.join(", ")}`);
  }
  return raw;
};

export const config = {
  port: num("PORT", 8000),

  /**
   * Список источников, которым разрешён доступ из браузера.
   * В разработке — адрес дев-сервера React, в проде — домен сайта.
   * "*" использовать нельзя: он несовместим с cookie-авторизацией и снимает защиту.
   */
  allowedOrigins: (env("ALLOWED_ORIGINS") ??
    "http://localhost:3000,http://localhost:5173").split(",").map((o) => o.trim()).filter(Boolean),

  /** Максимальный размер тела запроса, байт. Защита от «мусорных» POST. */
  maxBodyBytes: num("MAX_BODY_BYTES", 32_768),

  /** Какой провайдер отдаёт рейсы. Считается один раз при старте: смена на лету не нужна. */
  provider: providerName(),

  /**
   * Кэш результатов поиска.
   *
   * Фронт перезапрашивает выдачу при каждой правке фильтров (см. useFlightSearch).
   * Для генератора это бесплатно, для внешнего NDC-шлюза — нет: там квоты,
   * секунды ожидания и деньги за вызов. Кэш ключуется параметрами, которые
   * реально влияют на ответ поставщика (маршрут, пассажиры, валюта), и не
   * включает фильтры — они применяются локально поверх закэшированного набора.
   */
  cache: {
    enabled: bool("SEARCH_CACHE_ENABLED", true),
    ttlMs: num("SEARCH_CACHE_TTL_MS", 5 * 60_000),
    maxEntries: num("SEARCH_CACHE_MAX_ENTRIES", 200),
  },

  /** Настройки шлюза S7 NDC (agent-api/gaia). Используются только провайдером s7. */
  s7: {
    endpoint: env("S7_ENDPOINT") ?? "https://qa-gaia.s7.ru/agent-api/gaia",

    /** Basic-auth. Пароль в репозиторий не кладём — только в .env локально и в секреты на сервере. */
    login: env("S7_LOGIN") ?? "",
    password: env("S7_PASSWORD") ?? "",

    /** Реквизиты агента внутри конверта: подставляются в Party/Sender/AgentUserSender. */
    pseudoCity: env("S7_PSEUDO_CITY") ?? "",
    agentUserID: env("S7_AGENT_USER_ID") ?? "",
    senderName: env("S7_SENDER_NAME") ?? "S7-AIDL",
    userRole: env("S7_USER_ROLE") ?? "AS",
    posType: env("S7_POS_TYPE") ?? "1",
    requestorType: env("S7_REQUESTOR_TYPE") ?? "U",

    /** Операция поиска. searchFlightsJourney отдаёт готовые варианты перелёта целиком. */
    operation: env("S7_OPERATION") ?? "searchFlightsJourney",
    soapActionBase: env("S7_SOAP_ACTION_BASE") ?? "http://api.s7.ru",

    /**
     * Заголовок X-API-Version. Пусто — не отправлять.
     * В примерах обмена со стендом встречается значение 0.52.
     */
    apiVersion: env("S7_API_VERSION") ?? "",

    timeoutMs: num("S7_TIMEOUT_MS", 25_000),
    retries: num("S7_RETRIES", 1),

    /**
     * Отправлять ли CabinPreferences в запросе.
     *
     * Выключено намеренно. Рабочие примеры из тестового окружения этот блок не
     * содержат, а соответствие «эконом/комфорт/бизнес» кодам PADIS 9873 на
     * стороне S7 не подтверждено. Пока класс отбирается по ответу
     * (Cabin/CabinDesignator), а не запрашивается. Включать только после
     * проверки на живом стенде.
     */
    sendCabinPreference: bool("S7_SEND_CABIN_PREFERENCE", false),

    /**
     * Каталог для дампов сырого XML (запрос и ответ). Пустая строка — не писать.
     * Незаменимо при разборе «почему шлюз ответил не то»: NDC-ошибки
     * читаются только в исходном XML.
     */
    dumpDir: env("S7_DUMP_DIR") ?? "",

    /**
     * Путь к файлу с сохранённым ответом. Если задан, сеть не используется
     * вообще: транспорт отдаёт содержимое файла. Режим для разработки фронта
     * и для отладки парсера без доступа к стенду.
     */
    fixture: env("S7_FIXTURE") ?? "",
  },
};
