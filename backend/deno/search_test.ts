import { searchRequestSchema } from "./search/schema.ts";
import { applyFilters, generateOffers } from "./search/flights.ts";

/** Минимальные проверки без внешних зависимостей. */
function assertEquals<T>(actual: T, expected: T, message = "") {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${message}\nполучено:  ${a}\nожидалось: ${b}`);
}

function assertExists(value: unknown, message = "значение отсутствует") {
  if (value === null || value === undefined) throw new Error(message);
}

/**
 * Тесты контракта поиска. Запуск: deno task test
 *
 * Проверяется не «работает ли сервер», а то, что схема пропускает корректные
 * запросы и отвергает некорректные — это единственная защита бэкенда от
 * данных, пришедших из браузера.
 */

const dayAhead = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

const validRequest = () => ({
  tripType: "roundTrip",
  cabinClass: "economy",
  itinerary: [
    { origin: "SVO", destination: "AER", departureDate: dayAhead(10) },
    { origin: "AER", destination: "SVO", departureDate: dayAhead(20) },
  ],
  passengers: { adults: 2, teens: 0, children: 1, infants: 1 },
  currency: "RUB",
  locale: "ru-RU",
  filters: { sortType: "cheapest" },
});

Deno.test("корректный запрос проходит валидацию", () => {
  const result = searchRequestSchema.safeParse(validRequest());
  assertEquals(result.success, true);
});

Deno.test("дата в прошлом отвергается", () => {
  const request = validRequest();
  request.itinerary[0].departureDate = "2020-01-01";
  const result = searchRequestSchema.safeParse(request);
  assertEquals(result.success, false);
});

Deno.test("совпадение пунктов вылета и назначения отвергается", () => {
  const request = validRequest();
  request.itinerary[0].destination = request.itinerary[0].origin;
  const result = searchRequestSchema.safeParse(request);
  assertEquals(result.success, false);
});

Deno.test("младенцев не может быть больше, чем взрослых", () => {
  const request = validRequest();
  request.passengers = { adults: 1, teens: 0, children: 0, infants: 2 };
  const result = searchRequestSchema.safeParse(request);
  assertEquals(result.success, false);
});

Deno.test("больше девяти пассажиров с местом отвергается", () => {
  const request = validRequest();
  request.passengers = { adults: 9, teens: 1, children: 0, infants: 0 };
  const result = searchRequestSchema.safeParse(request);
  assertEquals(result.success, false);
});

Deno.test("тип roundTrip требует ровно два зеркальных сегмента", () => {
  const request = validRequest();
  request.itinerary = [request.itinerary[0]];
  assertEquals(searchRequestSchema.safeParse(request).success, false);
});

Deno.test("город вместо IATA-кода отвергается", () => {
  const request = validRequest();
  // deno-lint-ignore no-explicit-any
  (request.itinerary[0] as any).origin = "Москва";
  assertEquals(searchRequestSchema.safeParse(request).success, false);
});

Deno.test("выдача детерминирована: одинаковый запрос — одинаковый результат", () => {
  const parsed = searchRequestSchema.parse(validRequest());
  const first = generateOffers(parsed);
  const second = generateOffers(parsed);
  assertEquals(first.map((o) => o.id), second.map((o) => o.id));
  assertExists(first[0].price);
});

Deno.test("фильтр по пересадкам не пропускает лишнее", () => {
  const parsed = searchRequestSchema.parse({ ...validRequest(), filters: { sortType: "cheapest", stops: [0] } });
  const offers = applyFilters(generateOffers(parsed), parsed);
  assertEquals(offers.every((o) => o.stops === 0), true);
});

Deno.test("сортировка по цене возрастает", () => {
  const parsed = searchRequestSchema.parse(validRequest());
  const offers = applyFilters(generateOffers(parsed), parsed);
  const prices = offers.map((o) => o.price);
  assertEquals(prices, [...prices].sort((a, b) => a - b));
});
