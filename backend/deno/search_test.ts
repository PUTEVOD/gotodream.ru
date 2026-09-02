import { searchRequestSchema } from "./search/schema.ts";
import { applyFilters, buildFacets, generateOffers } from "./search/flights.ts";

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

/* --------------------------- фасеты фильтров --------------------------- */

Deno.test("фасет авиакомпаний перечисляет только компании из выдачи", () => {
  const parsed = searchRequestSchema.parse(validRequest());
  const generated = generateOffers(parsed);
  const facets = buildFacets(generated, parsed);

  const present = new Set(generated.map((o) => o.airline));
  assertEquals(facets.airlines.every((a) => present.has(a.value)), true);
  assertEquals(facets.airlines.length, present.size);
  assertEquals(
    facets.airlines.reduce((sum, a) => sum + a.count, 0),
    generated.length,
    "сумма счётчиков должна покрывать всю выдачу",
  );
});

Deno.test("фасет авиакомпаний не схлопывается при выборе одной компании", () => {
  const base = searchRequestSchema.parse(validRequest());
  const generated = generateOffers(base);
  const full = buildFacets(generated, base);
  assertExists(full.airlines[0]);

  const narrowed = searchRequestSchema.parse({
    ...validRequest(),
    filters: { sortType: "cheapest", airlines: [full.airlines[0].value] },
  });

  // Выдача сузилась до одной компании...
  const offers = applyFilters(generateOffers(narrowed), narrowed);
  assertEquals(offers.every((o) => o.airline === full.airlines[0].value), true);
  // ...а список в фильтре остался прежним, иначе снять выбор было бы не с чем.
  assertEquals(
    buildFacets(generateOffers(narrowed), narrowed).airlines.map((a) => a.value),
    full.airlines.map((a) => a.value),
  );
});

Deno.test("фасет учитывает остальные фильтры", () => {
  const parsed = searchRequestSchema.parse({
    ...validRequest(),
    filters: { sortType: "cheapest", stops: [0] },
  });
  const generated = generateOffers(parsed);
  const facets = buildFacets(generated, parsed);
  const direct = generated.filter((o) => o.stops === 0);

  assertEquals(
    facets.airlines.reduce((sum, a) => sum + a.count, 0),
    direct.length,
    "счётчики должны считаться по выдаче с учётом фильтра пересадок",
  );
});

Deno.test("отмеченная компания остаётся в списке даже с нулевым счётчиком", () => {
  const parsed = searchRequestSchema.parse({
    ...validRequest(),
    filters: { sortType: "cheapest", airlines: ["Авиакомпания, которой нет в выдаче"] },
  });
  const facets = buildFacets(generateOffers(parsed), parsed);
  const row = facets.airlines.find((a) => a.value === "Авиакомпания, которой нет в выдаче");
  assertExists(row, "строка отмеченной компании должна остаться");
  assertEquals(row?.count, 0);
});
