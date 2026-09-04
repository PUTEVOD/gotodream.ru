import { assert, assertAlmostEquals, assertEquals, assertThrows } from "../../../testing/assert.ts";
import { searchRequestSchema } from "../../schema.ts";
import { buildAirShoppingRQ, buildPassengerTypes, escapeXml } from "./request.ts";
import { mapCabinClass, parseAirShoppingRS } from "./parse.ts";
import { isoDurationToMinutes } from "./xml.ts";
import { basicAuth } from "./transport.ts";
import { ProviderError } from "../types.ts";
import { buildItinReshopRQ } from "./reprice.ts";
import { parseItinReshopRS } from "./parseReprice.ts";

/**
 * Тесты слоя S7 на сохранённых ответах стенда.
 *
 * Сети здесь нет и быть не должно. Проверяются две вещи, которые ломаются
 * чаще всего: собранный конверт (его отвергает схема шлюза) и разбор ответа
 * (он молча отдаёт пустую выдачу). Фикстуры в fixtures/ — настоящие ответы
 * тестового окружения S7, а не выдумка: на выдуманных данных парсер проходит
 * тесты и падает на первом же живом запросе.
 */

const fixture = (name: string) => Deno.readTextFileSync(new URL(`./fixtures/${name}`, import.meta.url));

const credentials = {
  pseudoCity: "S7AGN8224",
  agentUserID: "go_to_dream",
  senderName: "S7-AIDL",
  userRole: "AS",
  posType: "1",
  requestorType: "U",
};

/** Дата в пределах глубины продажи: схема отвергает и прошлое, и «через сто лет». */
const dayAhead = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

const DEPARTURE = dayAhead(30);
const RETURN = dayAhead(40);

const searchRequest = (overrides: Record<string, unknown> = {}) =>
  searchRequestSchema.parse({
    tripType: "oneWay",
    cabinClass: "economy",
    currency: "RUB",
    itinerary: [{ origin: "DME", destination: "IKT", departureDate: DEPARTURE }],
    passengers: { adults: 1, teens: 0, children: 0, infants: 0 },
    filters: { sortType: "cheapest" },
    ...overrides,
  });

// --------------------------------------------------------------- запрос ---

Deno.test("конверт повторяет структуру рабочего примера S7", () => {
  const xml = buildAirShoppingRQ(searchRequest(), { credentials });

  assert(xml.includes('<AirShoppingRQ xmlns="http://www.iata.org/IATA/EDIST" Version="1.0">'));
  assert(xml.includes("<PseudoCity>S7AGN8224</PseudoCity>"));
  assert(xml.includes("<AgentUserID>go_to_dream</AgentUserID>"));
  assert(xml.includes('<PTC Quantity="1">ADT</PTC>'));
  assert(xml.includes("<AirportCode>DME</AirportCode>"));
  assert(xml.includes("<CurrCode>RUB</CurrCode>"));

  // Порядок блоков — это xsd:sequence, а не украшение: переставленные
  // местами Parameters и Travelers шлюз отвергает.
  const order = ["<Document/>", "<Party>", "<Parameters>", "<Travelers>", "<CoreQuery>"]
    .map((token) => xml.indexOf(token));
  assertEquals(order, [...order].sort((a, b) => a - b));
  assert(order.every((index) => index > 0));
});

Deno.test("туда-обратно даёт два OriginDestination в порядке маршрута", () => {
  const xml = buildAirShoppingRQ(
    searchRequest({
      tripType: "roundTrip",
      itinerary: [
        { origin: "DME", destination: "LED", departureDate: DEPARTURE },
        { origin: "LED", destination: "DME", departureDate: RETURN },
      ],
    }),
    { credentials },
  );

  assertEquals(xml.match(/<OriginDestination>/g)?.length, 2);
  assert(xml.indexOf(DEPARTURE) < xml.indexOf(RETURN));
});

Deno.test("класс обслуживания не уходит в запрос, пока это явно не включено", () => {
  const request = searchRequest({ cabinClass: "business" });
  assert(!buildAirShoppingRQ(request, { credentials }).includes("CabinPreferences"));

  const withPreference = buildAirShoppingRQ(request, { credentials, sendCabinPreference: true });
  assert(withPreference.includes("<CabinPreferences><CabinType><Code>2</Code>"));
  // Preferences идут после CoreQuery — снова требование xsd:sequence.
  assert(withPreference.indexOf("<CoreQuery>") < withPreference.indexOf("<Preferences>"));
});

Deno.test("пассажиры группируются по типам в порядке ADT, CHD, INF", () => {
  assertEquals(
    buildPassengerTypes({ adults: 2, teens: 1, children: 1, infants: 1 }),
    [{ ptc: "ADT", quantity: 3 }, { ptc: "CHD", quantity: 1 }, { ptc: "INF", quantity: 1 }],
  );

  // Подростки 12–18 летят по взрослому тарифу — отсюда ADT 3, а не 2.
  // Если S7 подтвердит отдельный код (YTH), он задаётся параметром.
  assertEquals(
    buildPassengerTypes({ adults: 1, teens: 1, children: 0, infants: 0 }, "YTH"),
    [{ ptc: "ADT", quantity: 1 }, { ptc: "YTH", quantity: 1 }],
  );
});

Deno.test("значения экранируются перед вставкой в XML", () => {
  assertEquals(escapeXml(`<a href="x">&'`), "&lt;a href=&quot;x&quot;&gt;&amp;&apos;");
});

Deno.test("Basic-auth кодируется по RFC 7617", () => {
  assertEquals(basicAuth("Aladdin", "open sesame"), "Basic QWxhZGRpbjpvcGVuIHNlc2FtZQ==");
});

Deno.test("длительность ISO-8601 переводится в минуты", () => {
  assertEquals(isoDurationToMinutes("PT4H0M"), 240);
  assertEquals(isoDurationToMinutes("PT55M"), 55);
  assertEquals(isoDurationToMinutes("P1DT2H30M"), 1590);
  assertEquals(isoDurationToMinutes("мусор"), 0);
});

// ---------------------------------------------------------------- ответ ---

Deno.test("ответ «в одну сторону, 1 взрослый» разбирается полностью", () => {
  const { offers, warnings } = parseAirShoppingRS(fixture("airshopping-rs-ow-adt.xml"));

  assertEquals(warnings, []);
  assertEquals(offers.length, 36); // столько AirlineOffer в файле

  const first = offers[0];
  assertEquals(first.offerId, "OF1");
  assertEquals(first.currency, "RUB");
  assertEquals(first.price, 15553);
  assertEquals(first.cabinClass, "economy");
  assertEquals(first.fareBrand, "BASIC ECONOMY");
  assertEquals(first.bookingClass, "Q");
  assertEquals(first.legs.length, 1); // одно направление
  assertEquals(first.stops, 1); // DME -> OVB -> IKT
  assertEquals(first.segments?.length, 2);
  assertEquals(first.departureTime, "21:10");
  assertEquals(first.flightNumber, "S7-2511");
  assertEquals(first.airline, "S7 Airlines");
  assertEquals(first.from, "Москва");
  assertEquals(first.to, "Иркутск");

  // Тариф + сборы = итог. Расхождение означает, что разбор цены поехал.
  assertAlmostEquals(
    (first.priceBreakdown?.base ?? 0) + (first.priceBreakdown?.taxes ?? 0),
    first.price,
    0.01,
  );

  // Базовый эконом S7 продаётся без багажа, с ручной кладью 10 кг.
  assertEquals(first.baggage?.checkedIncluded, false);
  assertEquals(first.baggage?.carryOn, "10KG");
});

Deno.test("длительность считается по перелётам и стыковке, а не вычитанием времён", () => {
  const { offers } = parseAirShoppingRS(fixture("airshopping-rs-ow-adt.xml"));
  const withStop = offers.find((offer) => offer.stops === 1)!;
  const segments = withStop.segments!;

  const flying = segments.reduce((sum, s) => sum + s.durationMinutes, 0);
  assert(withStop.durationMinutes > flying, "стыковка должна попасть в общую длительность");
  assert(withStop.durationMinutes < flying + 24 * 60, "стыковка не может быть больше суток");
});

Deno.test("бизнес отличается от эконома по коду кабины, а не по названию тарифа", () => {
  const { offers } = parseAirShoppingRS(fixture("airshopping-rs-ow-adt.xml"));
  const classes = new Set(offers.map((offer) => offer.cabinClass));

  assert(classes.has("economy"));
  assert(classes.has("business"));
  // PLUS ECONOMY — это бренд тарифа внутри эконома, а не отдельная кабина.
  for (const offer of offers.filter((o) => o.fareBrand === "PLUS ECONOMY")) {
    assertEquals(offer.cabinClass, "economy");
  }
});

Deno.test("ответ «туда-обратно, ADT+CHD+INF» даёт два направления в одном предложении", () => {
  const { offers, warnings } = parseAirShoppingRS(fixture("airshopping-rs-rt-adt-chd-inf.xml"));

  assertEquals(warnings, []);
  assertEquals(offers.length, 12);

  const first = offers[0];
  assertEquals(first.legs.length, 2);
  assertEquals(first.legs[0].from, "Москва");
  assertEquals(first.legs[0].to, "Санкт-Петербург");
  assertEquals(first.legs[1].from, "Санкт-Петербург");
  assertEquals(first.legs[1].to, "Москва");
  assert(first.legs[0].date < first.legs[1].date, "обратный вылет позже прямого");

  // Цена предложения — за всех пассажиров и оба направления сразу.
  assertEquals(first.price, 15678);
});

Deno.test("идентификаторы предложений уникальны: React не должен терять строки", () => {
  for (const name of ["airshopping-rs-ow-adt.xml", "airshopping-rs-rt-adt-chd-inf.xml"]) {
    const { offers } = parseAirShoppingRS(fixture(name));
    assertEquals(new Set(offers.map((o) => o.id)).size, offers.length, name);
  }
});

Deno.test("класс кабины определяется по коду", () => {
  assertEquals(mapCabinClass("Y", "BASIC ECONOMY"), "economy");
  assertEquals(mapCabinClass("Y", "PLUS ECONOMY"), "economy");
  assertEquals(mapCabinClass("B", "BASIC BUSINESS"), "business");
  assertEquals(mapCabinClass("C", ""), "business");
  assertEquals(mapCabinClass("", "STANDARD BUSINESS"), "business");
  assertEquals(mapCabinClass("", ""), "economy");
});

// -------------------------------------------------------------- ошибки ---

Deno.test("SOAP Fault превращается в отказ поставщика, а не в пустую выдачу", () => {
  const xml = `<Envelope xmlns="http://schemas.xmlsoap.org/soap/envelope/"><Body><Fault>` +
    `<faultcode>soap:Server</faultcode><faultstring>Internal Error</faultstring>` +
    `</Fault></Body></Envelope>`;

  const error = assertThrows(() => parseAirShoppingRS(xml), ProviderError) as ProviderError;
  assertEquals(error.code, "PROVIDER_UNAVAILABLE");
});

Deno.test("блок Errors внутри успешного ответа — это отказ", () => {
  const xml = `<Envelope xmlns="http://schemas.xmlsoap.org/soap/envelope/"><Body>` +
    `<AirShoppingRS xmlns="http://www.iata.org/IATA/EDIST"><Errors>` +
    `<Error Code="ERR-101">Invalid airport code</Error>` +
    `</Errors></AirShoppingRS></Body></Envelope>`;

  const error = assertThrows(() => parseAirShoppingRS(xml), ProviderError) as ProviderError;
  assertEquals(error.code, "PROVIDER_REJECTED");
  assertEquals(error.details[0], { path: "ERR-101", message: "Invalid airport code" });
});

Deno.test("мусор вместо XML не роняет процесс", () => {
  const error = assertThrows(() => parseAirShoppingRS("<<<не xml"), ProviderError) as ProviderError;
  assertEquals(error.code, "PROVIDER_BAD_RESPONSE");
});

// ------------------------------------------------- пересчёт цены ---

const offerFrom = (name: string, index = 0) => parseAirShoppingRS(fixture(name)).offers[index];

Deno.test("в предложении есть тариф и класс бронирования по каждому рейсу", () => {
  const offer = offerFrom("airshopping-rs-ow-adt.xml");
  const segments = offer.legs.flatMap((leg) => leg.segments ?? []);

  assertEquals(segments.length, 2); // DME -> OVB -> IKT
  assertEquals(segments.map((s) => s.key), ["SEG1", "SEG2"]);
  for (const segment of segments) {
    assertEquals(segment.bookingClass, "Q");
    assertEquals(segment.fareBasis, "QBSOVB");
    assert(segment.marketingFlightNumber, "номер рейса нужен отдельно от кода компании");
  }
});

Deno.test("конверт пересчёта перечисляет рейсы и связывает с ними тарифы", () => {
  const offer = offerFrom("airshopping-rs-rt-adt-chd-inf.xml");
  const request = searchRequest({
    tripType: "roundTrip",
    itinerary: [
      { origin: "DME", destination: "LED", departureDate: DEPARTURE },
      { origin: "LED", destination: "DME", departureDate: RETURN },
    ],
    passengers: { adults: 1, teens: 0, children: 1, infants: 1 },
  });

  const { xml, passengers } = buildItinReshopRQ(offer, request, { credentials });

  assert(xml.includes('<ItinReshopRQ Version="" xmlns="http://www.iata.org/IATA/EDIST">'));
  assert(xml.includes("<PseudoCity>S7AGN8224</PseudoCity>"));

  // Два направления — два OriginDestination, каждый со своим рейсом.
  assertEquals(xml.match(/<OriginDestination>/g)?.length, 2);
  assert(xml.includes("<SegmentKey>SEG1</SegmentKey>"));
  assert(xml.includes("<SegmentKey>SEG2</SegmentKey>"));
  assert(xml.includes("<FlightNumber>1003</FlightNumber>"));

  // Тариф привязан к сегменту через refs — иначе шлюз не поймёт, что к чему.
  assert(xml.includes('<FareComponent refs="SEG1">'));
  assert(xml.includes("<Code>SBSRT</Code>"));
  assert(xml.includes("<RBD>S</RBD>"));

  // Пассажиры перечисляются поимённо, а не количеством: OrderItem ссылается
  // на конкретные ключи.
  assertEquals(passengers.map((p) => p.ptc), ["ADT", "CHD", "INF"]);
  assertEquals(passengers.map((p) => p.objectKey), ["SH1", "SH2", "SH3i"]);
  assert(xml.includes("<PassengerReferences>SH1 SH2 SH3i</PassengerReferences>"));
});

Deno.test("подтверждённая цена разбирается вместе с раскладкой по пассажирам", () => {
  const { reprice, warnings } = parseItinReshopRS(fixture("itinreshop-rs-rt-adt-chd-inf.xml"), {
    offerId: "s7-OF1",
    previousPrice: 15678,
  });

  assertEquals(warnings, []);
  assertEquals(reprice.price, 15478);
  assertEquals(reprice.currency, "RUB");
  assertEquals(reprice.breakdown.base, 13440);
  assertEquals(reprice.breakdown.taxes, 2038);

  // Смысл шага: цена отличается от той, что была в выдаче.
  assertEquals(reprice.previousPrice, 15678);
  assertEquals(reprice.difference, -200);

  assertEquals(reprice.passengers.length, 3);
  assertEquals(reprice.passengers.map((p) => p.ptc).sort(), ["ADT", "CHD", "INF"]);
  // Младенец без места летит бесплатно — это норма, а не сбой разбора.
  assertEquals(reprice.passengers.find((p) => p.ptc === "INF")?.price, 0);
  // Суммы по пассажирам обязаны сходиться с итогом: из них складывается счёт.
  assertAlmostEquals(reprice.passengers.reduce((sum, p) => sum + p.price, 0), reprice.price, 0.01);
});

Deno.test("«цена не изменилась» — это тоже результат, а не отсутствие ответа", () => {
  const { reprice } = parseItinReshopRS(fixture("itinreshop-rs-ow-adt.xml"), {
    offerId: "s7-OF1",
    previousPrice: 83791,
  });

  assertEquals(reprice.price, 83791);
  assertEquals(reprice.difference, 0);
  assertEquals(reprice.passengers.length, 1);
});

Deno.test("отказ шлюза при пересчёте не превращается в цену", () => {
  const xml = `<Envelope xmlns="http://schemas.xmlsoap.org/soap/envelope/"><Body>` +
    `<ItinReshopRS xmlns="http://www.iata.org/IATA/EDIST"><Errors>` +
    `<Error Code="ERR-500">Offer expired</Error>` +
    `</Errors></ItinReshopRS></Body></Envelope>`;

  const error = assertThrows(
    () => parseItinReshopRS(xml, { offerId: "s7-OF1", previousPrice: 100 }),
    ProviderError,
  ) as ProviderError;
  assertEquals(error.code, "PROVIDER_REJECTED");
});
