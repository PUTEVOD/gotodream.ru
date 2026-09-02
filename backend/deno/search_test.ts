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

Deno.test("на одном рейсе продаётся несколько классов", () => {
  const parsed = searchRequestSchema.parse(validRequest());
  const offers = generateOffers(parsed);

  const classes = new Set(offers.map((o) => o.cabinClass));
  assertEquals(classes.size > 1, true, "выдача должна содержать не один класс");
  assertEquals(new Set(offers.map((o) => o.id)).size, offers.length, "id должны быть уникальны");
});

Deno.test("запрошенный класс есть в выдаче при любом запросе", () => {
  for (const cabinClass of ["economy", "comfort", "business"] as const) {
    const parsed = searchRequestSchema.parse({ ...validRequest(), cabinClass });
    const offers = generateOffers(parsed);
    assertEquals(
      offers.some((o) => o.cabinClass === cabinClass),
      true,
      `поиск с cabinClass=${cabinClass} обязан вернуть предложения этого класса`,
    );
  }
});

Deno.test("на одном рейсе цена растёт от эконома к бизнесу", () => {
  const parsed = searchRequestSchema.parse(validRequest());
  const order = { economy: 0, comfort: 1, business: 2 };

  const offers = generateOffers(parsed);
  const byFlight = new Map<string, typeof offers>();
  for (const offer of offers) {
    const key = offer.id.replace(/-(economy|comfort|business)$/, "");
    const list = byFlight.get(key) ?? [];
    list.push(offer);
    byFlight.set(key, list);
  }

  let compared = 0;
  for (const list of byFlight.values()) {
    if (list.length < 2) continue;
    compared++;
    const sorted = [...list].sort((a, b) => order[a.cabinClass] - order[b.cabinClass]);
    for (let i = 1; i < sorted.length; i++) {
      assertEquals(sorted[i].price > sorted[i - 1].price, true, "цена старшего класса должна быть выше");
    }
  }
  assertEquals(compared > 0, true, "должен найтись хотя бы один рейс с несколькими классами");
});

Deno.test("фильтр по классу оставляет только выбранный и не обнуляет выдачу", () => {
  for (const cabinClass of ["economy", "comfort", "business"] as const) {
    const parsed = searchRequestSchema.parse({
      ...validRequest(),
      filters: { sortType: "cheapest", cabinClasses: [cabinClass] },
    });
    const offers = applyFilters(generateOffers(parsed), parsed);
    assertEquals(offers.length > 0, true, `фильтр «${cabinClass}» не должен обнулять выдачу`);
    assertEquals(offers.every((o) => o.cabinClass === cabinClass), true);
  }
});

Deno.test("фасет классов идёт в порядке контракта и покрывает всю выдачу", () => {
  const parsed = searchRequestSchema.parse(validRequest());
  const generated = generateOffers(parsed);
  const facets = buildFacets(generated, parsed);

  assertEquals(facets.cabinClasses.map((c) => c.value), ["economy", "comfort", "business"]);
  assertEquals(
    facets.cabinClasses.reduce((sum, c) => sum + c.count, 0),
    generated.length,
    "сумма счётчиков должна покрывать всю выдачу",
  );
});

Deno.test("фасет классов не схлопывается при выборе одного класса", () => {
  const parsed = searchRequestSchema.parse({
    ...validRequest(),
    filters: { sortType: "cheapest", cabinClasses: ["business"] },
  });
  assertEquals(
    buildFacets(generateOffers(parsed), parsed).cabinClasses.map((c) => c.value),
    ["economy", "comfort", "business"],
  );
});

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
