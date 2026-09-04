import {
  type Baggage,
  type CabinClass,
  formatDuration,
  type Leg,
  minutesBetween,
  type Offer,
  type PriceBreakdown,
  type Segment,
} from "../../offer.ts";
import { describeAirline, describeAirport } from "../../reference.ts";
import { arr, attr, isoDurationToMinutes, num, pick, text } from "./xml.ts";
import { readResponseRoot } from "./envelope.ts";

/**
 * Разбор AirShoppingRS в предложения контракта.
 *
 * КАК УСТРОЕН ОТВЕТ NDC. Это не список рейсов с ценами, а нормализованная
 * структура со ссылками, и понимать её надо целиком, иначе разбор
 * превращается в угадывание:
 *
 *   DataLists          — словари: рейсы (FlightSegment), варианты перелёта
 *                        (OriginDestination), багаж, штрафы, услуги.
 *                        У каждого элемента ключ: SEG1, OD1, BG1, PL1.
 *   OffersGroup        — сами предложения. Ни одного рейса внутри нет,
 *                        только ссылки на ключи из DataLists.
 *   AirlineOffer       — одно предложение целиком: цена за всех пассажиров
 *                        и за все направления.
 *   OfferPrice         — часть предложения по одному направлению («туда»,
 *                        «обратно»). Их столько, сколько направлений в запросе.
 *   Associations       — привязка «пассажир — направление — рейсы». Их
 *                        несколько: по одной на пассажира, плюс служебные.
 *                        Все пассажиры летят одними рейсами, поэтому для
 *                        построения маршрута берётся первая содержательная.
 *
 * ВАЖНО ПРО OriginDestination. В ответе searchFlightsJourney это НЕ то же
 * самое, что в запросе. В запросе OD — «Москва → Иркутск 3 июля», один на
 * направление. В ответе OD — конкретный вариант перелёта: в примере из
 * тестового окружения шесть OD, все Москва → Иркутск, отличаются набором
 * рейсов (прямой, с пересадкой в Новосибирске и так далее). Считать, что
 * OD1 в ответе соответствует первому сегменту запроса, — ошибка.
 */

/** Сопоставление кода кабины из ответа классам контракта. */
export function mapCabinClass(designator: string, marketingName: string): CabinClass {
  const code = designator.trim().toUpperCase();
  const name = marketingName.trim().toUpperCase();

  // Буква кабины надёжнее маркетингового названия: названия тарифов
  // перевозчик меняет, коды PADIS — нет.
  if (["C", "J", "D", "I", "Z", "B"].includes(code)) return "business";
  if (["F", "A", "P"].includes(code)) return "business"; // первого класса в контракте нет
  if (["W", "S", "E"].includes(code)) return "comfort";

  // Y — эконом. Внутри него у S7 три бренда: BASIC / STANDARD / PLUS.
  // Это тарифы одной кабины, а не разные кабины, поэтому все три остаются
  // «экономом», а бренд уезжает в отдельное поле fareBrand. Иначе фильтр
  // «Комфорт» показывал бы обычный эконом с багажом.
  if (name.includes("BUSINESS")) return "business";
  return "economy";
}

interface DataLists {
  segments: Map<string, Segment>;
  originDestinations: Map<string, { departureCode: string; arrivalCode: string; flightRefs: string[] }>;
  checkedBags: Map<string, { description: string; included: boolean }>;
  carryOnBags: Map<string, string>;
  penalties: Map<string, { changeFee?: number; refundFee?: number }>;
}

function parseSegment(key: string, node: Record<string, unknown>): Segment {
  const departure = pick(node, "Departure");
  const arrival = pick(node, "Arrival");
  const marketing = pick(node, "MarketingCarrier");
  const operating = pick(node, "OperatingCarrier");

  const duration = isoDurationToMinutes(
    text(pick(node, "FlightDetail", "FlightDuration", "Value")),
  );

  return {
    key,
    flightNumber: `${text(pick(marketing, "AirlineID"))}-${text(pick(marketing, "FlightNumber"))}`,
    marketingAirline: text(pick(marketing, "AirlineID")),
    operatingAirline: text(pick(operating, "AirlineID")) || text(pick(marketing, "AirlineID")),
    marketingFlightNumber: text(pick(marketing, "FlightNumber")) || undefined,
    operatingFlightNumber: text(pick(operating, "FlightNumber")) ||
      text(pick(marketing, "FlightNumber")) || undefined,
    departureAirport: text(pick(departure, "AirportCode")),
    arrivalAirport: text(pick(arrival, "AirportCode")),
    departureDate: text(pick(departure, "Date")),
    departureTime: text(pick(departure, "Time")),
    arrivalDate: text(pick(arrival, "Date")),
    arrivalTime: text(pick(arrival, "Time")),
    durationMinutes: duration,
    aircraft: text(pick(node, "Equipment", "AirlineEquipCode")) ||
      text(pick(node, "Equipment", "AircraftCode")) || undefined,
  };
}

function parseDataLists(root: unknown): DataLists {
  const lists = pick(root, "DataLists");

  const segments = new Map<string, Segment>();
  for (const node of arr(pick(lists, "FlightSegmentList", "FlightSegment"))) {
    const key = attr(node, "SegmentKey");
    if (key) segments.set(key, parseSegment(key, node));
  }

  const originDestinations = new Map<string, {
    departureCode: string;
    arrivalCode: string;
    flightRefs: string[];
  }>();
  for (const node of arr(pick(lists, "OriginDestinationList", "OriginDestination"))) {
    const key = attr(node, "OriginDestinationKey");
    if (!key) continue;
    originDestinations.set(key, {
      departureCode: text(pick(node, "DepartureCode")),
      arrivalCode: text(pick(node, "ArrivalCode")),
      flightRefs: text(pick(node, "FlightReferences")).split(/\s+/).filter(Boolean),
    });
  }

  const checkedBags = new Map<string, { description: string; included: boolean }>();
  for (const node of arr(pick(lists, "CheckedBagAllowanceList", "CheckedBagAllowance"))) {
    const key = attr(node, "ListKey");
    if (!key) continue;

    // Норму задаёт ApplicableBag: "NO" — багажа нет, "1PC" — одно место.
    // Descriptions при этом содержит не норму, а перечень того, что этим
    // местом можно провезти («Golf Equipment», «Bicycle», …) вперемешку с
    // ограничениями по весу и габаритам. Выкладывать этот перечень в карточку
    // бессмысленно: человеку нужны «1 место до 23 кг», а не список из
    // одиннадцати пунктов, одинаковый у всех тарифов.
    const applicable = text(pick(node, "AllowanceDescription", "ApplicableBag")).toUpperCase();
    const descriptions = arr(pick(node, "AllowanceDescription", "Descriptions", "Description"))
      .map((d) => text(pick(d, "Text")).trim())
      .filter(Boolean);
    const weight = descriptions.find((d) => /^\d+\s*(KG|LB)$/i.test(d));

    const included = applicable !== "" && applicable !== "NO";
    checkedBags.set(key, {
      description: included ? [applicable, weight].filter(Boolean).join(", ") : "",
      included,
    });
  }

  const carryOnBags = new Map<string, string>();
  for (const node of arr(pick(lists, "CarryOnAllowanceList", "CarryOnAllowance"))) {
    const key = attr(node, "ListKey");
    if (!key) continue;
    carryOnBags.set(
      key,
      arr(pick(node, "AllowanceDescription", "Descriptions", "Description"))
        .map((d) => text(pick(d, "Text")))
        .filter(Boolean)
        .join(", "),
    );
  }

  const penalties = new Map<string, { changeFee?: number; refundFee?: number }>();
  for (const node of arr(pick(lists, "PenaltyList", "Penalty"))) {
    const key = attr(node, "ObjectKey");
    if (!key) continue;
    const entry: { changeFee?: number; refundFee?: number } = {};
    for (const detail of arr(pick(node, "Details", "Detail"))) {
      const code = text(pick(detail, "Application", "Code"));
      // Из пары «минимальный/максимальный штраф» берём максимум: показать
      // человеку сумму меньше той, что он реально заплатит, хуже, чем наоборот.
      const amounts = arr(pick(detail, "Amounts", "Amount"))
        .map((a) => num(pick(a, "CurrencyAmountValue")));
      const value = amounts.length ? Math.max(...amounts) : undefined;
      if (value === undefined) continue;
      if (code === "changePenalty") entry.changeFee = value;
      if (code === "cancellationAndRefundPenalty") entry.refundFee = value;
    }
    penalties.set(key, entry);
  }

  return { segments, originDestinations, checkedBags, carryOnBags, penalties };
}

/** Тариф и класс бронирования одного рейса внутри конкретного предложения. */
interface SegmentFare {
  bookingClass?: string;
  fareBasis?: string;
  seatsLeft?: number;
}

/**
 * Набор рейсов одного направления -> Leg с пересадками и общей длительностью.
 *
 * Рейсы из DataLists общие для всего ответа, а тариф у каждого предложения
 * свой, поэтому сегмент копируется, а не дополняется на месте: иначе тариф
 * последнего разобранного предложения оказался бы у всех остальных.
 */
function buildLeg(refs: string[], lists: DataLists, fares?: Map<string, SegmentFare>): Leg | null {
  const segments = refs
    .map((ref) => {
      const segment = lists.segments.get(ref);
      if (!segment) return undefined;
      const fare = fares?.get(ref);
      return fare ? { ...segment, bookingClass: fare.bookingClass, fareBasis: fare.fareBasis } : segment;
    })
    .filter((s): s is Segment => Boolean(s));
  if (!segments.length) return null;

  const first = segments[0];
  const last = segments[segments.length - 1];

  // Длительность = сумма перелётов + сумма стыковок. Стыковка считается по
  // времени в одном аэропорту, поэтому часовые пояса не мешают.
  const flying = segments.reduce((sum, s) => sum + s.durationMinutes, 0);
  const connections = segments.slice(1).reduce((sum, s, index) => {
    const previous = segments[index];
    return sum + Math.max(
      0,
      minutesBetween(previous.arrivalDate, previous.arrivalTime, s.departureDate, s.departureTime),
    );
  }, 0);

  const from = describeAirport(first.departureAirport);
  const to = describeAirport(last.arrivalAirport);

  return {
    flightNumber: first.flightNumber,
    airline: describeAirline(first.marketingAirline),
    from: from.city,
    to: to.city,
    departureAirport: from.airport,
    arrivalAirport: to.airport,
    date: first.departureDate,
    departureTime: first.departureTime,
    arrivalTime: last.arrivalTime,
    durationMinutes: flying + connections,
    stops: segments.length - 1,
    segments,
  };
}

interface SliceInfo {
  /**
   * Направления этого куска предложения. Обычно одно: S7 отдаёт «туда» и
   * «обратно» отдельными OfferPrice. Массив — на случай, когда несколько
   * ApplicableFlight приходят в одном куске; терять при этом обратный рейс
   * нельзя.
   */
  legs: Leg[];
  cabinDesignator: string;
  cabinMarketingName: string;
  bookingClass: string;
  fareBasis: string;
  seatsLeft: number;
  checkedBagRefs: string[];
  carryOnRefs: string[];
  penaltyRefs: string[];
}

/** Одно направление предложения: маршрут, класс, места, ссылки на багаж и штрафы. */
function parseSlice(offerPrice: unknown, lists: DataLists): SliceInfo {
  const associations = arr(pick(offerPrice, "RequestedDate", "Associations"));

  // Пассажиров в предложении несколько, рейсы у них одни и те же: берём
  // первую привязку, где вообще есть рейсы.
  const withFlight = associations.find((a) => pick(a, "ApplicableFlight") !== undefined);
  const flight = pick(withFlight, "ApplicableFlight");

  const odRefs = arr<string>(pick(flight, "OriginDestinationReferences")).map((r) => text(r));
  const references = arr(pick(flight, "FlightSegmentReference"));

  // Порядок рейсов берём из OriginDestination: там он гарантированно
  // хронологический. Ссылки внутри ApplicableFlight идут парами
  // (кабина + класс бронирования) и порядок не гарантируют.
  //
  // Каждый OriginDestination — отдельное направление. Склеивать их в один
  // Leg нельзя: «туда» и «обратно» превратились бы в перелёт с пересадкой
  // длиной в неделю. В ответах стенда S7 в одном OfferPrice всегда один OD,
  // но код не должен на это опираться.
  let cabinDesignator = "";
  let cabinMarketingName = "";
  let seatsLeft = Number.POSITIVE_INFINITY;
  const checkedBagRefs: string[] = [];
  const carryOnRefs: string[] = [];

  /* Тариф собирается ПО КАЖДОМУ РЕЙСУ.
   *
   * Ссылки внутри ApplicableFlight идут не по одной на рейс, а группами:
   * у одного ref="SEG1" лежит Cabin, у следующего ref="SEG1" — ClassOfService,
   * у третьего — нормы багажа. Поэтому значения не перезаписываются, а
   * накапливаются в записи своего сегмента.
   *
   * Раньше здесь бралось первое встреченное значение и объявлялось тарифом
   * всего предложения. На стенде это незаметно: сегменты одного предложения
   * приходят с одним тарифом. Но пересчёт цены требует FareBasisCode и RBD
   * для КАЖДОГО FareComponent, и на маршруте с разной тарификацией сегментов
   * в запрос уехал бы тариф первого рейса, помеченный ключом второго. */
  const fares = new Map<string, SegmentFare>();
  const fareFor = (ref: string) => {
    const existing = fares.get(ref);
    if (existing) return existing;
    const created: SegmentFare = {};
    fares.set(ref, created);
    return created;
  };

  for (const reference of references) {
    const ref = attr(reference, "ref");

    const cabin = pick(reference, "Cabin");
    if (cabin) {
      cabinDesignator ||= text(pick(cabin, "CabinDesignator"));
      cabinMarketingName ||= text(pick(cabin, "MarketingName"));
    }

    const classOfService = pick(reference, "ClassOfService");
    if (classOfService) {
      const code = text(pick(classOfService, "Code"));
      const basis = text(pick(classOfService, "MarketingName"));
      if (ref) {
        const fare = fareFor(ref);
        fare.bookingClass ||= code;
        fare.fareBasis ||= basis;
      }
      const seats = attr(pick(classOfService, "Code"), "SeatsLeft");
      // Мест по направлению столько, сколько на самом загруженном рейсе.
      if (seats) seatsLeft = Math.min(seatsLeft, Number(seats) || 0);
    }

    const bags = pick(reference, "BagDetailAssociation");
    if (bags) {
      for (const value of arr(pick(bags, "CheckedBagReferences"))) checkedBagRefs.push(text(value));
      for (const value of arr(pick(bags, "CarryOnReferences"))) carryOnRefs.push(text(value));
    }
  }

  const legs = odRefs.length
    ? odRefs
      .map((key) => buildLeg(lists.originDestinations.get(key)?.flightRefs ?? [], lists, fares))
      .filter((leg): leg is Leg => leg !== null)
    : [buildLeg([...new Set(references.map((r) => attr(r, "ref")))].filter(Boolean), lists, fares)]
      .filter((leg): leg is Leg => leg !== null);

  // Значения для карточки: она показывает одно на предложение.
  const first = legs[0]?.segments?.[0];
  const bookingClass = first?.bookingClass ?? "";
  const fareBasis = first?.fareBasis ?? "";

  // Штрафы привязаны к тарифу через OtherAssociation: Type — базис тарифа,
  // ReferenceValue — ключ в PenaltyList.
  const penaltyRefs: string[] = [];
  for (const association of associations) {
    for (const outer of arr(pick(association, "OtherAssociation"))) {
      for (const inner of arr(pick(outer, "OtherAssociation"))) {
        const value = text(pick(inner, "ReferenceValue"));
        if (lists.penalties.has(value)) penaltyRefs.push(value);
      }
    }
  }

  return {
    legs,
    cabinDesignator,
    cabinMarketingName,
    bookingClass,
    fareBasis,
    seatsLeft: Number.isFinite(seatsLeft) ? seatsLeft : 0,
    checkedBagRefs,
    carryOnRefs,
    penaltyRefs,
  };
}

function parsePriceBreakdown(offer: unknown): PriceBreakdown | undefined {
  const price = pick(offer, "TotalPrice", "DetailCurrencyPrice");
  if (!price) return undefined;

  const total = num(pick(price, "Total"));
  const taxes = num(pick(price, "Taxes", "Total"));
  const subTotals = arr(pick(price, "Details", "Detail"))
    .map((d) => num(pick(d, "SubTotal")))
    .filter((v) => v > 0);

  const base = subTotals.length ? subTotals.reduce((a, b) => a + b, 0) : Math.max(0, total - taxes);
  return { base, taxes };
}

/** Сборы по кодам — из FareComponent всех направлений, суммарно по предложению. */
function parseTaxDetails(offer: unknown): PriceBreakdown["taxDetails"] {
  const totals = new Map<string, { amount: number; description?: string }>();

  for (const offerPrice of arr(pick(offer, "PricedOffer", "OfferPrice"))) {
    for (const component of arr(pick(offerPrice, "FareDetail", "FareComponent"))) {
      for (const tax of arr(pick(component, "PriceBreakdown", "Price", "Taxes", "Breakdown", "Tax"))) {
        const code = text(pick(tax, "TaxCode")) || "—";
        const amount = num(pick(tax, "Amount"));
        const previous = totals.get(code);
        totals.set(code, {
          amount: (previous?.amount ?? 0) + amount,
          description: previous?.description ?? (text(pick(tax, "Description")) || undefined),
        });
      }
    }
  }

  if (!totals.size) return undefined;
  return [...totals.entries()]
    .map(([code, value]) => ({ code, amount: value.amount, description: value.description }))
    .sort((a, b) => b.amount - a.amount);
}

function collectBaggage(slices: SliceInfo[], lists: DataLists): Baggage | undefined {
  const carryOn = new Set<string>();
  const checked = new Set<string>();
  let included: boolean | undefined;

  for (const slice of slices) {
    for (const ref of slice.carryOnRefs) {
      const value = lists.carryOnBags.get(ref);
      if (value) carryOn.add(value);
    }
    for (const ref of slice.checkedBagRefs) {
      const value = lists.checkedBags.get(ref);
      if (!value) continue;
      if (value.description) checked.add(value.description);
      // Багаж считается включённым, только если он включён на всех направлениях.
      included = included === undefined ? value.included : included && value.included;
    }
  }

  if (!carryOn.size && !checked.size && included === undefined) return undefined;
  return {
    carryOn: carryOn.size ? [...carryOn].join(" / ") : undefined,
    checked: checked.size ? [...checked].join(" / ") : undefined,
    checkedIncluded: included,
  };
}

export interface ParseResult {
  offers: Offer[];
  warnings: string[];
}

export function parseAirShoppingRS(xml: string): ParseResult {
  const root = readResponseRoot(xml, "AirShoppingRS");
  const lists = parseDataLists(root);
  const warnings: string[] = [];
  const offers: Offer[] = [];

  const airlineOffers = arr(pick(root, "OffersGroup", "AirlineOffers"))
    .flatMap((group) => arr(pick(group, "AirlineOffer")));

  for (const airlineOffer of airlineOffers) {
    const offerId = text(pick(airlineOffer, "OfferID"));
    const currency = attr(pick(airlineOffer, "TotalPrice", "DetailCurrencyPrice", "Total"), "Code");
    const price = num(pick(airlineOffer, "TotalPrice", "DetailCurrencyPrice", "Total"));

    const slices = arr(pick(airlineOffer, "PricedOffer", "OfferPrice"))
      .map((offerPrice) => parseSlice(offerPrice, lists));

    const legs = slices.flatMap((s) => s.legs);
    if (!legs.length) {
      warnings.push(`Предложение ${offerId || "без идентификатора"} пропущено: не найдены рейсы`);
      continue;
    }
    const emptySlices = slices.filter((s) => !s.legs.length).length;
    if (emptySlices) {
      warnings.push(
        `Предложение ${offerId}: ${emptySlices} из ${slices.length} частей без разобранных рейсов`,
      );
    }

    const head = legs[0];
    const lead = slices.find((s) => s.legs.length) ?? slices[0];

    const penalties = slices
      .flatMap((s) => s.penaltyRefs)
      .map((ref) => lists.penalties.get(ref))
      .filter((p): p is { changeFee?: number; refundFee?: number } => Boolean(p));

    const breakdown = parsePriceBreakdown(airlineOffer);
    const taxDetails = parseTaxDetails(airlineOffer);

    offers.push({
      ...head,
      // Идентификатор шлюза сам по себе ключом быть не может. OfferID
      // уникален только внутри своей группы AirlineOffers, а групп в ответе
      // несколько: в ответе «туда-обратно» из тестового окружения четыре
      // группы по три предложения, и OF1 встречается в каждой. Ключ строится
      // из идентификатора и полного маршрута — по нему предложения и
      // различаются на самом деле.
      id: `s7-${offerId}-${legs.map((l) => `${l.date}-${l.flightNumber}`).join("-")}`,
      offerId,
      legs,
      cabinClass: mapCabinClass(lead.cabinDesignator, lead.cabinMarketingName),
      fareBrand: lead.cabinMarketingName || undefined,
      bookingClass: lead.bookingClass || undefined,
      price,
      currency: currency || "RUB",
      // По маршруту целиком мест столько, сколько на самом дефицитном направлении.
      seatsLeft: Math.min(...slices.map((s) => s.seatsLeft).filter((n) => n > 0), 9),
      duration: formatDuration(head.durationMinutes),
      baggage: collectBaggage(slices, lists),
      priceBreakdown: breakdown ? { ...breakdown, taxDetails } : undefined,
      refundable: penalties.length ? penalties.some((p) => p.refundFee !== undefined) : undefined,
    });
  }

  return { offers, warnings };
}
