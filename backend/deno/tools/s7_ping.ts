import { searchRequestSchema } from "../search/schema.ts";
import { config } from "../search/config.ts";
import { buildAirShoppingRQ } from "../search/providers/s7/request.ts";
import { buildItinReshopRQ } from "../search/providers/s7/reprice.ts";
import { s7Provider } from "../search/providers/s7/provider.ts";
import { ProviderError } from "../search/providers/types.ts";
import type { Offer } from "../search/offer.ts";

/**
 * Пробный запрос к шлюзу S7 из командной строки.
 *
 * Зачем отдельный инструмент, если есть сервер: когда поиск на сайте отвечает
 * «шлюз недоступен», надо понять, где именно порвалось — в браузере, в
 * маршрутизации, в конверте или на стороне S7. Этот скрипт проходит ровно тот
 * же путь, что и сервер, но без браузера и без HTTP-обвязки, и печатает всё,
 * что происходит по дороге.
 *
 * Примеры:
 *   deno task s7:ping
 *   deno task s7:ping -- --from LED --to AER --date 2026-03-15 --adults 2
 *   deno task s7:ping -- --from DME --to LED --date 2026-03-10 --return 2026-03-20
 *   deno task s7:ping -- --reprice 1
 *   deno task s7:ping -- --show-request --raw
 *   deno task s7:ping -- --fixture search/providers/s7/fixtures/airshopping-rs-ow-adt.xml
 */

const HELP = `
Пробный запрос AirShoppingRQ к шлюзу S7.

  --from CODE        аэропорт вылета (по умолчанию DME)
  --to CODE          аэропорт назначения (по умолчанию LED)
  --date YYYY-MM-DD  дата вылета (по умолчанию сегодня + 30 дней)
  --return YYYY-MM-DD  дата обратно; включает поиск «туда-обратно»
  --adults N         взрослых (1)
  --teens N          подростков 12–18 (0)
  --children N       детей 2–12 (0)
  --infants N        младенцев (0)
  --cabin CLASS      economy | comfort | business (economy)
  --currency CODE    валюта (RUB)
  --limit N          сколько предложений печатать (10)

  --reprice N        подтвердить цену предложения №N из списка (ItinReshopRQ)
  --show-request     напечатать отправляемый XML
  --json             напечатать разобранные предложения как JSON
  --fixture PATH     не ходить в сеть, разобрать готовый ответ из файла
                     (задаётся вместе с переменной S7_FIXTURE=<путь>)
  --help             эта справка

Сырой XML запроса и ответа пишется в каталог из переменной S7_DUMP_DIR.
`.trim();

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const name = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      args[name] = true;
    } else {
      args[name] = next;
      i++;
    }
  }
  return args;
}

const args = parseArgs(Deno.args);

if (args.help) {
  console.log(HELP);
  Deno.exit(0);
}

const str = (name: string, fallback: string) => {
  const value = args[name];
  return typeof value === "string" ? value : fallback;
};
const int = (name: string, fallback: number) => {
  const value = args[name];
  return typeof value === "string" && Number.isFinite(Number(value)) ? Number(value) : fallback;
};

const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

const from = str("from", "DME").toUpperCase();
const to = str("to", "LED").toUpperCase();
const departureDate = str("date", inDays(30));
const returnDate = typeof args.return === "string" ? args.return : null;

// Режим фикстуры задаётся переменной окружения: провайдер читает конфигурацию
// один раз при импорте, поэтому подменять её после старта поздно.
if (typeof args.fixture === "string" && !config.s7.fixture) {
  console.error(
    "Флаг --fixture требует переменной окружения: S7_FIXTURE=<путь> deno task s7:ping",
  );
  Deno.exit(2);
}

const candidate = {
  tripType: returnDate ? "roundTrip" : "oneWay",
  cabinClass: str("cabin", "economy"),
  currency: str("currency", "RUB"),
  locale: "ru-RU",
  itinerary: returnDate
    ? [
      { origin: from, destination: to, departureDate },
      { origin: to, destination: from, departureDate: returnDate },
    ]
    : [{ origin: from, destination: to, departureDate }],
  passengers: {
    adults: int("adults", 1),
    teens: int("teens", 0),
    children: int("children", 0),
    infants: int("infants", 0),
  },
  filters: { sortType: "cheapest" },
};

const parsed = searchRequestSchema.safeParse(candidate);
if (!parsed.success) {
  console.error("Параметры не прошли проверку схемы:");
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join(".") || "(корень)"}: ${issue.message}`);
  }
  Deno.exit(2);
}

const request = parsed.data;

console.log("Конфигурация");
console.log(`  endpoint     ${config.s7.fixture ? `(фикстура) ${config.s7.fixture}` : config.s7.endpoint}`);
console.log(`  операция     ${config.s7.operation}`);
console.log(
  `  агент        ${config.s7.agentUserID || "(не задан)"} / ${config.s7.pseudoCity || "(не задан)"}`,
);
console.log(`  таймаут      ${config.s7.timeoutMs} мс, повторов ${config.s7.retries}`);
console.log();
console.log("Запрос");
console.log(
  `  маршрут      ${
    request.itinerary.map((s) => `${s.origin}-${s.destination} ${s.departureDate}`).join("  ")
  }`,
);
console.log(
  `  пассажиры    ADT ${request.passengers.adults}, TEEN ${request.passengers.teens}, CHD ${request.passengers.children}, INF ${request.passengers.infants}`,
);
console.log(`  класс        ${request.cabinClass}, валюта ${request.currency}`);
console.log();

if (args["show-request"]) {
  const xml = buildAirShoppingRQ(request, {
    credentials: {
      pseudoCity: config.s7.pseudoCity,
      agentUserID: config.s7.agentUserID,
      senderName: config.s7.senderName,
      userRole: config.s7.userRole,
      posType: config.s7.posType,
      requestorType: config.s7.requestorType,
    },
    sendCabinPreference: config.s7.sendCabinPreference,
  });
  console.log("Отправляемый конверт");
  console.log(xml.replace(/></g, ">\n<"));
  console.log();
}

const money = (value: number, currency: string) => `${value.toLocaleString("ru-RU")} ${currency}`;

function printOffer(offer: Offer, index: number): void {
  const route = offer.legs
    .map((leg) => {
      const via = (leg.segments ?? []).slice(0, -1)
        .map((s) => s.arrivalAirport)
        .join(", ");
      const stops = leg.stops === 0 ? "прямой" : `${leg.stops} пересадка (${via})`;
      return `${leg.segments?.[0]?.departureAirport ?? "?"}→${leg.segments?.at(-1)?.arrivalAirport ?? "?"} ` +
        `${leg.date} ${leg.departureTime}–${leg.arrivalTime}, ` +
        `${Math.floor(leg.durationMinutes / 60)}ч${
          leg.durationMinutes % 60 ? ` ${leg.durationMinutes % 60}м` : ""
        }, ${stops}`;
    })
    .join("\n              ");

  const bag = offer.baggage?.checkedIncluded === false
    ? "без багажа"
    : offer.baggage?.checked || "багаж не указан";

  console.log(
    `${String(index + 1).padStart(2)}. ${money(offer.price, offer.currency).padStart(16)}  ` +
      `${(offer.fareBrand ?? offer.cabinClass).padEnd(18)} ${
        offer.bookingClass ?? "?"
      }  мест: ${offer.seatsLeft}`,
  );
  console.log(`              ${route}`);
  console.log(
    `              ${offer.flightNumber} ${offer.airline} | ручная кладь: ${
      offer.baggage?.carryOn ?? "—"
    } | ${bag}` +
      `${offer.refundable === undefined ? "" : offer.refundable ? " | возвратный" : " | невозвратный"}`,
  );
}

try {
  const started = performance.now();
  const result = await s7Provider.search(request);
  const elapsed = Math.round(performance.now() - started);

  console.log(`Ответ получен за ${elapsed} мс: предложений ${result.offers.length}`);
  for (const warning of result.warnings) console.log(`  предупреждение: ${warning}`);
  console.log();

  if (args.json) {
    console.log(JSON.stringify(result.offers, null, 2));
    Deno.exit(0);
  }

  const limit = int("limit", 10);
  const sorted = [...result.offers].sort((a, b) => a.price - b.price);
  for (const [index, offer] of sorted.slice(0, limit).entries()) printOffer(offer, index);

  if (sorted.length > limit) {
    console.log(`\n… ещё ${sorted.length - limit}. Показать все: --limit ${sorted.length}`);
  }

  if (sorted.length) {
    const cheapest = sorted[0];
    console.log();
    console.log(
      `Минимум ${money(cheapest.price, cheapest.currency)}` +
        (cheapest.priceBreakdown
          ? ` (тариф ${money(cheapest.priceBreakdown.base, cheapest.currency)} + сборы ${
            money(cheapest.priceBreakdown.taxes, cheapest.currency)
          })`
          : ""),
    );
  }

  /* Второй шаг сценария — подтверждение цены. Он здесь, а не в отдельном
     инструменте, потому что пересчёту нужно предложение из выдачи целиком:
     ключи сегментов и базисы тарифов. Запускать поиск заново ради этого
     значит проверять два разных ответа стенда вместо одного. */
  const repriceIndex = int("reprice", 0);
  if (repriceIndex > 0) {
    const offer = sorted[repriceIndex - 1];
    if (!offer) {
      console.error(`\nВ выдаче нет предложения №${repriceIndex}: всего ${sorted.length}`);
      Deno.exit(2);
    }

    console.log(`\nПересчёт цены предложения №${repriceIndex} (${offer.id})`);

    if (args["show-request"]) {
      const { xml } = buildItinReshopRQ(offer, request, {
        credentials: {
          pseudoCity: config.s7.pseudoCity,
          agentUserID: config.s7.agentUserID,
          senderName: config.s7.senderName,
          userRole: config.s7.userRole,
          posType: config.s7.posType,
          requestorType: config.s7.requestorType,
        },
      });
      console.log(xml.replace(/></g, ">\n<"));
      console.log();
    }

    const repriceStarted = performance.now();
    const { reprice, warnings } = await s7Provider.reprice!({ search: request, offer });
    console.log(`  ответ за ${Math.round(performance.now() - repriceStarted)} мс`);
    for (const warning of warnings) console.log(`  предупреждение: ${warning}`);

    const sign = reprice.difference > 0 ? "+" : "";
    console.log(
      `  было ${money(reprice.previousPrice, reprice.currency)}` +
        `  стало ${money(reprice.price, reprice.currency)}` +
        (reprice.difference === 0
          ? "  (цена не изменилась)"
          : `  (${sign}${money(reprice.difference, reprice.currency)})`),
    );
    console.log(
      `  тариф ${money(reprice.breakdown.base, reprice.currency)} + сборы ${
        money(reprice.breakdown.taxes, reprice.currency)
      }` + (reprice.breakdown.fees ? ` + платы ${money(reprice.breakdown.fees, reprice.currency)}` : ""),
    );
    for (const passenger of reprice.passengers) {
      console.log(
        `    ${passenger.objectKey.padEnd(6)} ${passenger.ptc.padEnd(4)} ${
          money(passenger.price, reprice.currency).padStart(14)
        }`,
      );
    }
  }
} catch (error) {
  if (error instanceof ProviderError) {
    console.error(`\nОтказ: ${error.code}`);
    console.error(`  ${error.message}`);
    if (error.internal) console.error(`  подробности: ${error.internal}`);
    for (const detail of error.details) console.error(`  ${detail.path}: ${detail.message}`);
    Deno.exit(1);
  }
  throw error;
}
