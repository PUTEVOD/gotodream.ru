import { ProviderError } from "../types.ts";

/**
 * Транспорт до SOAP-шлюза S7.
 *
 * Отвечает ровно за одно: довезти строку XML туда и обратно. Ничего не знает
 * ни про AirShopping, ни про предложения. Здесь же живут все решения о том,
 * что считать сбоем сети, что — отказом шлюза, и что можно повторить.
 */

export interface TransportOptions {
  endpoint: string;
  login: string;
  password: string;
  /** Значение заголовка SOAPAction, например http://api.s7.ru/SearchFlightsJourney. */
  soapAction: string;
  /**
   * Значение заголовка X-API-Version. Пустая строка — не отправлять.
   *
   * В документации стенда он присутствует (0.52), в сохранённом проекте
   * SoapUI — нет. Значит, обязательным его считать нельзя, но и выбросить
   * тоже: если шлюз откажет без внятной причины, это первое, что стоит
   * включить.
   */
  apiVersion?: string;
  timeoutMs: number;
  /** Сколько раз повторить при сбое сети или 5xx. 0 — не повторять. */
  retries: number;
  /** Каталог для дампов сырого XML. Пустая строка — не писать. */
  dumpDir?: string;
  /** Путь к сохранённому ответу. Если задан, сеть не используется. */
  fixture?: string;
  signal?: AbortSignal;
}

export interface TransportResult {
  xml: string;
  status: number;
  /** Сколько миллисекунд ждали ответа. Полезно в логах: шлюз бывает медленным. */
  elapsedMs: number;
  /** true, если ответ взят из файла, а не из сети. */
  fromFixture: boolean;
}

/** Basic-auth по RFC 7617: base64 от "логин:пароль" в UTF-8. */
export function basicAuth(login: string, password: string): string {
  const bytes = new TextEncoder().encode(`${login}:${password}`);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `Basic ${btoa(binary)}`;
}

const stamp = () => new Date().toISOString().replace(/[:.]/g, "-");

/**
 * Причина сбоя fetch целиком, вместе с цепочкой cause.
 *
 * Само по себе "fetch failed" не говорит ничего: за ним одинаково прячутся
 * «нет DNS», «отказ TLS», «соединение закрыто прокси» и «нет маршрута».
 * Настоящая причина лежит на уровень-два ниже, в error.cause, и без неё
 * разбор недоступности стенда превращается в перебор гипотез.
 */
function describeCause(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; current instanceof Error && depth < 5; depth++) {
    parts.push(current.message);
    current = current.cause;
  }
  if (!parts.length) return String(error);
  return parts.join(" <- ");
}

/**
 * Дампы — вспомогательный инструмент, а не часть работы сервиса.
 * Поэтому любая ошибка записи (нет прав, нет каталога) не должна ронять
 * запрос: она попадает в лог и на этом всё.
 */
async function dump(dir: string, name: string, content: string): Promise<void> {
  try {
    await Deno.mkdir(dir, { recursive: true });
    await Deno.writeTextFile(`${dir}/${stamp()}-${name}.xml`, content);
  } catch (error) {
    console.warn(`не удалось записать дамп ${name}:`, error instanceof Error ? error.message : error);
  }
}

const isRetryable = (status: number) => status === 0 || status === 408 || status === 429 || status >= 500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Одна попытка. Разделение на attempt/call нужно, чтобы логика повторов
 * читалась отдельно от логики запроса и не пряталась в цикле с флагами.
 */
async function attempt(xml: string, options: TransportOptions): Promise<{ body: string; status: number }> {
  const timeout = AbortSignal.timeout(options.timeoutMs);
  // Отмена клиентом и таймаут — два независимых повода прервать запрос.
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;

  let response: Response;
  try {
    response = await fetch(options.endpoint, {
      method: "POST",
      headers: {
        // SOAP 1.1: тип text/xml и обязательный заголовок SOAPAction.
        // С application/soap+xml (это SOAP 1.2) шлюз ответит 415.
        "Content-Type": "text/xml; charset=utf-8",
        // SOAP 1.1 требует, чтобы значение SOAPAction было строкой в кавычках
        // (RFC-стиль quoted-string). Именно так его отправляет SoapUI, и
        // именно так он выглядит в примерах обмена со стендом.
        SOAPAction: `"${options.soapAction}"`,
        Authorization: basicAuth(options.login, options.password),
        Accept: "text/xml",
        ...(options.apiVersion ? { "X-API-Version": options.apiVersion } : {}),
      },
      body: xml,
      signal,
    });
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === "AbortError";
    if (aborted && options.signal?.aborted) throw error; // клиент ушёл — это не сбой шлюза
    if (aborted) {
      throw new ProviderError("PROVIDER_TIMEOUT", "Шлюз S7 не ответил вовремя", {
        internal: `таймаут ${options.timeoutMs} мс`,
        cause: error,
      });
    }
    throw new ProviderError("PROVIDER_UNAVAILABLE", "Не удалось связаться со шлюзом S7", {
      internal: describeCause(error),
      cause: error,
    });
  }

  return { body: await response.text(), status: response.status };
}

export async function callSoap(xml: string, options: TransportOptions): Promise<TransportResult> {
  const started = performance.now();

  if (options.dumpDir) await dump(options.dumpDir, "request", xml);

  // Режим воспроизведения: ответ берётся из файла. Нужен, чтобы разрабатывать
  // фронт и парсер, когда стенд недоступен или квота выбрана.
  if (options.fixture) {
    const body = await Deno.readTextFile(options.fixture);
    return { xml: body, status: 200, elapsedMs: Math.round(performance.now() - started), fromFixture: true };
  }

  if (!options.login || !options.password) {
    throw new ProviderError("PROVIDER_MISCONFIGURED", "Не заданы учётные данные шлюза S7", {
      internal: "S7_LOGIN / S7_PASSWORD пусты",
    });
  }

  let last: { body: string; status: number } | null = null;

  for (let tryNo = 0; tryNo <= options.retries; tryNo++) {
    last = await attempt(xml, options);
    if (!isRetryable(last.status)) break;
    if (tryNo < options.retries) {
      // Пауза растёт: мгновенный повтор в тот же перегруженный шлюз бесполезен.
      await sleep(300 * (tryNo + 1));
    }
  }

  const { body, status } = last!;
  const elapsedMs = Math.round(performance.now() - started);

  if (options.dumpDir) await dump(options.dumpDir, `response-${status}`, body);

  if (status === 401 || status === 403) {
    throw new ProviderError("PROVIDER_AUTH", "Шлюз S7 отклонил учётные данные", {
      internal: `HTTP ${status}: ${body.slice(0, 500)}`,
    });
  }

  if (status !== 200) {
    // Тело 500-го ответа у SOAP-сервисов обычно содержит Fault с причиной —
    // читать его в разборе полезнее, чем видеть голый номер статуса.
    throw new ProviderError("PROVIDER_UNAVAILABLE", "Шлюз S7 вернул ошибку", {
      internal: `HTTP ${status}: ${body.slice(0, 2000)}`,
    });
  }

  return { xml: body, status, elapsedMs, fromFixture: false };
}
