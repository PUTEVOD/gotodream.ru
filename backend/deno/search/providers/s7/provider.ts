import { config } from "../../config.ts";
import type { SearchRequest } from "../../schema.ts";
import {
  type FlightProvider,
  ProviderError,
  type ProviderResult,
  type RepriceInput,
  type RepriceResult,
  type SearchOptions,
} from "../types.ts";
import { buildAirShoppingRQ, type S7Credentials } from "./request.ts";
import { buildItinReshopRQ, offerSegments } from "./reprice.ts";
import { callSoap } from "./transport.ts";
import { parseAirShoppingRS } from "./parse.ts";
import { parseItinReshopRS } from "./parseReprice.ts";

/**
 * Провайдер «s7»: поиск через NDC-шлюз S7 (agent-api/gaia).
 *
 * Собирает три независимых слоя в один вызов: request.ts делает XML,
 * transport.ts везёт его по сети, parse.ts разбирает ответ. Каждый слой
 * проверяется отдельно — построитель и парсер тестируются на файлах, без сети.
 */

/** SOAPAction для операции: http://api.s7.ru/SearchFlightsJourney. */
const soapAction = (base: string, operation: string) =>
  `${base.replace(/\/$/, "")}/${operation.charAt(0).toUpperCase()}${operation.slice(1)}`;

/**
 * Проверка настроек до первого сетевого вызова.
 *
 * Отдельным шагом и с внятным текстом намеренно: без этого пустой
 * S7_PSEUDO_CITY превращается в ответ шлюза «внутренняя ошибка», и полдня
 * уходит на поиск причины не в том месте. Режим фикстур реквизиты не требует.
 */
function assertConfigured(): void {
  if (config.s7.fixture) return;

  const missing = [
    ["S7_LOGIN", config.s7.login],
    ["S7_PASSWORD", config.s7.password],
    ["S7_PSEUDO_CITY", config.s7.pseudoCity],
    ["S7_AGENT_USER_ID", config.s7.agentUserID],
  ].filter(([, value]) => !value).map(([name]) => name);

  if (missing.length) {
    throw new ProviderError(
      "PROVIDER_MISCONFIGURED",
      "Провайдер S7 не настроен",
      { internal: `не заданы переменные окружения: ${missing.join(", ")}` },
    );
  }
}

/** Реквизиты агента для конверта. Одни и те же во всех операциях шлюза. */
const credentials = (): S7Credentials => ({
  pseudoCity: config.s7.pseudoCity,
  agentUserID: config.s7.agentUserID,
  senderName: config.s7.senderName,
  userRole: config.s7.userRole,
  posType: config.s7.posType,
  requestorType: config.s7.requestorType,
});

export const s7Provider: FlightProvider = {
  name: "s7",

  async search(request: SearchRequest, options: SearchOptions = {}): Promise<ProviderResult> {
    assertConfigured();

    const xml = buildAirShoppingRQ(request, {
      credentials: credentials(),
      sendCabinPreference: config.s7.sendCabinPreference,
    });

    const response = await callSoap(xml, {
      endpoint: config.s7.endpoint,
      login: config.s7.login,
      password: config.s7.password,
      soapAction: soapAction(config.s7.soapActionBase, config.s7.operation),
      apiVersion: config.s7.apiVersion,
      timeoutMs: config.s7.timeoutMs,
      retries: config.s7.retries,
      dumpDir: config.s7.dumpDir,
      fixture: config.s7.fixture,
      signal: options.signal,
    });

    const { offers, warnings } = parseAirShoppingRS(response.xml);

    console.info(
      `s7: ${config.s7.operation} ${
        request.itinerary.map((s) => `${s.origin}-${s.destination}`).join(", ")
      } ` +
        `-> ${offers.length} предложений за ${response.elapsedMs} мс${
          response.fromFixture ? " (фикстура)" : ""
        }`,
    );

    // Класс обслуживания из формы шлюзу не передаётся (см. config.s7
    // sendCabinPreference), поэтому в выдаче его может не оказаться вовсе.
    // Молчать об этом нельзя: человек выбрал бизнес и должен понимать,
    // почему видит эконом.
    if (offers.length && !offers.some((offer) => offer.cabinClass === request.cabinClass)) {
      warnings.push(`Предложений класса «${request.cabinClass}» на этом маршруте не найдено`);
    }

    return { offers, source: "s7", warnings };
  },

  async reprice(input: RepriceInput, options: SearchOptions = {}): Promise<RepriceResult> {
    assertConfigured();

    /* Без ключей сегментов и базисов тарифа собрать ItinReshopRQ нельзя:
       запрос перечисляет рейсы поимённо. Проверяем это до обращения к шлюзу
       — отказ «предложение неполное» понятнее, чем ответ стенда об
       отсутствующем FareBasisCode. */
    const segments = offerSegments(input.offer);
    if (!segments.length) {
      throw new ProviderError("PROVIDER_BAD_RESPONSE", "В предложении нет рейсов для пересчёта", {
        internal: `offer ${input.offer.id}`,
      });
    }
    const incomplete = segments.filter((s) => !s.key || !s.fareBasis || !s.bookingClass);
    if (incomplete.length) {
      throw new ProviderError("PROVIDER_BAD_RESPONSE", "В предложении не хватает данных о тарифе", {
        internal: `offer ${input.offer.id}: сегменты без тарифа — ${
          incomplete.map((s) => s.key || s.flightNumber).join(", ")
        }`,
      });
    }

    const { xml } = buildItinReshopRQ(input.offer, input.search, { credentials: credentials() });

    const response = await callSoap(xml, {
      endpoint: config.s7.endpoint,
      login: config.s7.login,
      password: config.s7.password,
      soapAction: soapAction(config.s7.soapActionBase, config.s7.repriceOperation),
      apiVersion: config.s7.apiVersion,
      timeoutMs: config.s7.timeoutMs,
      // Пересчёт не повторяем: он не идемпотентен по смыслу (шлюз может
      // придержать места), и второй ответ всё равно нельзя считать «тем же».
      retries: 0,
      dumpDir: config.s7.dumpDir,
      fixture: config.s7.repriceFixture,
      signal: options.signal,
    });

    const { reprice, warnings } = parseItinReshopRS(response.xml, {
      offerId: input.offer.id,
      previousPrice: input.offer.price,
    });

    console.info(
      `s7: ${config.s7.repriceOperation} ${input.offer.id} -> ${reprice.price} ${reprice.currency}` +
        ` (было ${reprice.previousPrice}) за ${response.elapsedMs} мс${
          response.fromFixture ? " (фикстура)" : ""
        }`,
    );

    return { reprice, source: "s7", warnings };
  },
};
