import type { SearchRequest } from "../../schema.ts";
import type { Offer, Segment } from "../../offer.ts";
import { escapeXml, type S7Credentials } from "./request.ts";

/**
 * Сборка конверта ItinReshopRQ — пересчёта цены выбранного предложения.
 *
 * ЗАЧЕМ ЭТОТ ШАГ ВООБЩЕ НУЖЕН. Цена в выдаче поиска — не обязательство.
 * Между поиском и оплатой места продаются, тарифы пересчитываются, сборы
 * меняются: в примере из тестового окружения поиск отдал 15 678 ₽, а
 * пересчёт того же маршрута — 15 478 ₽. Показать человеку цену из выдачи и
 * списать другую нельзя, поэтому перед бронированием цена подтверждается
 * отдельным запросом.
 *
 * ЧТО ОТПРАВЛЯЕТСЯ. Не идентификатор предложения — его в запросе нет вовсе.
 * `ItinReshopRQ` заново перечисляет рейсы (ключ, аэропорты, даты, времена,
 * перевозчики) и связывает с каждым тариф через `FareComponent refs`.
 * Отсюда требование к разбору выдачи: базис тарифа и класс бронирования
 * должны храниться ПО КАЖДОМУ рейсу (см. Segment в offer.ts).
 *
 * Образец — рабочие запросы из тестового окружения S7
 * (scenarios/…/reprice.xml). Порядок элементов повторяет xsd:sequence.
 */

export interface RepriceOptions {
  credentials: S7Credentials;
  /**
   * Как называть пассажиров внутри запроса.
   *
   * Ключи придумываем мы: в ответе поиска пассажиров нет, а связать
   * `OrderItem` с составом надо. В примерах S7 ключ младенца заканчивается
   * на «i» (SH6i) — повторяем эту форму, потому что она встречается во всех
   * примерах и стоить проверки может дорого. Если стенд окажется к суффиксу
   * равнодушен, параметр убирается одной правкой здесь.
   */
  infantSuffix?: string;
}

/** Один пассажир в запросе: ключ и тип. Имён на этом шаге ещё нет. */
export interface RepricePassenger {
  objectKey: string;
  ptc: string;
}

const tag = (name: string, value: string) => `<${name}>${escapeXml(value)}</${name}>`;

/**
 * Состав пассажиров -> список с ключами.
 *
 * Каждый пассажир перечисляется отдельно, даже если тип один и тот же:
 * `OrderItem` ссылается на конкретные ключи, а не на количество. Это
 * отличается от поиска, где тот же состав уходит как `<PTC Quantity="2">`.
 */
export function buildRepricePassengers(
  passengers: SearchRequest["passengers"],
  options: { teenPTC?: string; infantSuffix?: string } = {},
): RepricePassenger[] {
  const { teenPTC = "ADT", infantSuffix = "i" } = options;
  const result: RepricePassenger[] = [];
  let index = 0;

  const add = (ptc: string, count: number, suffix = "") => {
    for (let i = 0; i < count; i++) {
      index++;
      result.push({ objectKey: `SH${index}${suffix}`, ptc });
    }
  };

  add("ADT", passengers.adults);
  add(teenPTC, passengers.teens);
  add("CHD", passengers.children);
  add("INF", passengers.infants, infantSuffix);

  return result;
}

/** Рейс -> элемент Flight внутри OriginDestination. */
function buildFlight(segment: Segment): string {
  const marketingNumber = segment.marketingFlightNumber ?? "";
  const operatingNumber = segment.operatingFlightNumber ?? marketingNumber;

  return `<Flight>` +
    tag("SegmentKey", segment.key) +
    `<Departure>` +
    tag("AirportCode", segment.departureAirport) +
    tag("Date", segment.departureDate) +
    tag("Time", segment.departureTime) +
    `</Departure>` +
    `<Arrival>` +
    tag("AirportCode", segment.arrivalAirport) +
    tag("Date", segment.arrivalDate) +
    tag("Time", segment.arrivalTime) +
    `</Arrival>` +
    `<MarketingCarrier>` +
    tag("AirlineID", segment.marketingAirline) +
    tag("FlightNumber", marketingNumber) +
    `</MarketingCarrier>` +
    `<OperatingCarrier>` +
    tag("AirlineID", segment.operatingAirline || segment.marketingAirline) +
    tag("FlightNumber", operatingNumber) +
    `</OperatingCarrier>` +
    `</Flight>`;
}

/** Тариф одного рейса: FareComponent, привязанный к ключу сегмента. */
function buildFareComponent(segment: Segment): string {
  return `<FareComponent refs="${escapeXml(segment.key)}">` +
    `<FareBasis>` +
    `<FareBasisCode>${tag("Code", segment.fareBasis ?? "")}</FareBasisCode>` +
    tag("RBD", segment.bookingClass ?? "") +
    `</FareBasis>` +
    `</FareComponent>`;
}

/** Все рейсы предложения в порядке маршрута. */
export function offerSegments(offer: Offer): Segment[] {
  return offer.legs.flatMap((leg) => leg.segments ?? []);
}

export function buildItinReshopRQ(
  offer: Offer,
  request: SearchRequest,
  options: RepriceOptions,
): { xml: string; passengers: RepricePassenger[] } {
  const { credentials: c, infantSuffix = "i" } = options;

  const passengers = buildRepricePassengers(request.passengers, { infantSuffix });
  const segments = offerSegments(offer);

  /* Одно направление — один OriginDestination, рейсы внутри него идут
     подряд.
     ВНИМАНИЕ: на стенде проверены только прямые рейсы, где направление
     состоит из одного рейса. Вариант «каждый рейс отдельным
     OriginDestination» не исключён; если шлюз отвергнет маршрут с
     пересадкой, менять надо здесь. */
  const originDestinations = offer.legs
    .map((leg) => `<OriginDestination>${(leg.segments ?? []).map(buildFlight).join("")}</OriginDestination>`)
    .join("");

  const fareDetail = `<FareDetail>${segments.map(buildFareComponent).join("")}</FareDetail>`;

  const passengerReferences = passengers.map((p) => p.objectKey).join(" ");

  const passengerList = passengers
    .map((p) =>
      `<Passenger ObjectKey="${escapeXml(p.objectKey)}">` +
      `<PTC Quantity="1">${escapeXml(p.ptc)}</PTC>` +
      `<Name><Surname/></Name>` +
      `</Passenger>`
    )
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Envelope xmlns="http://schemas.xmlsoap.org/soap/envelope/">` +
    `<Header/>` +
    `<Body>` +
    `<ItinReshopRQ Version="" xmlns="http://www.iata.org/IATA/EDIST">` +
    `<Document/>` +
    `<Party><Sender><AgentUserSender>` +
    tag("Name", c.senderName) +
    `<OtherIDs>` +
    `<OtherID Description="POS_Type">${escapeXml(c.posType)}</OtherID>` +
    `<OtherID Description="requestorType">${escapeXml(c.requestorType)}</OtherID>` +
    `</OtherIDs>` +
    tag("PseudoCity", c.pseudoCity) +
    tag("AgentUserID", c.agentUserID) +
    tag("UserRole", c.userRole) +
    `</AgentUserSender></Sender></Party>` +
    `<Query><Reshop><Actions>` +
    `<ActionType/>` +
    `<OrderItems><OrderItem>` +
    `<FlightItem>${originDestinations}${fareDetail}</FlightItem>` +
    `<Associations><Passengers>${
      tag("PassengerReferences", passengerReferences)
    }</Passengers></Associations>` +
    `</OrderItem></OrderItems>` +
    `<Passengers>${passengerList}</Passengers>` +
    `</Actions></Reshop></Query>` +
    `</ItinReshopRQ>` +
    `</Body>` +
    `</Envelope>`;

  return { xml, passengers };
}
