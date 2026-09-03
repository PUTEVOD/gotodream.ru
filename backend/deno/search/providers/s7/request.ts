import type { SearchRequest } from "../../schema.ts";
import type { CabinClass } from "../../offer.ts";

/**
 * Сборка конверта AirShoppingRQ из данных формы.
 *
 * Образец — рабочие запросы из тестового окружения S7
 * (scenarios/…/searchFlightsJourney.xml). Порядок элементов повторяет
 * xsd:sequence схемы AirShoppingRQ: Document, Party, Parameters, Travelers,
 * CoreQuery, Qualifiers, Preferences. В XSD это последовательность, а не
 * набор: переставленные местами блоки шлюз отвергнет, даже если все они
 * допустимы по отдельности.
 */

export interface S7Credentials {
  pseudoCity: string;
  agentUserID: string;
  senderName: string;
  userRole: string;
  posType: string;
  requestorType: string;
}

export interface BuildOptions {
  credentials: S7Credentials;
  /** Отправлять ли CabinPreferences. По умолчанию выключено, см. config.s7. */
  sendCabinPreference?: boolean;
  /** PTC для подростков 12–18. В большинстве систем это взрослый тариф. */
  teenPTC?: string;
  /** grouped: <PTC Quantity="2">ADT</PTC>. individual: два отдельных Traveler. */
  travelersStyle?: "grouped" | "individual";
}

/**
 * Соответствие классов контракта кодам кабины PADIS 9873.
 *
 * ВНИМАНИЕ: на живом стенде не проверено. Используется, только если явно
 * включён sendCabinPreference. По умолчанию класс не запрашивается, а
 * отбирается по ответу — см. mapCabinClass в parse.ts.
 */
export const CABIN_CODE: Record<CabinClass, string> = {
  economy: "3",
  comfort: "4",
  business: "2",
};

const ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

/**
 * Экранирование значений, попадающих в XML.
 *
 * Обязательно, даже если сейчас в запрос уходят только коды аэропортов и
 * даты, прошедшие проверку схемой. Значение из формы, вставленное в разметку
 * без экранирования, — это тот же класс дефекта, что SQL-инъекция: сегодня
 * поле ограничено регуляркой, завтра в запрос добавят фамилию пассажира.
 */
export const escapeXml = (value: string) => value.replace(/[&<>"']/g, (c) => ESCAPE[c]);

const tag = (name: string, value: string) => `<${name}>${escapeXml(value)}</${name}>`;

/** Пассажиры формы -> список PTC в порядке, принятом в NDC: ADT, CHD, INF. */
export function buildPassengerTypes(
  passengers: SearchRequest["passengers"],
  teenPTC = "ADT",
): Array<{ ptc: string; quantity: number }> {
  const counts = new Map<string, number>();
  const add = (ptc: string, quantity: number) => {
    if (quantity > 0) counts.set(ptc, (counts.get(ptc) ?? 0) + quantity);
  };

  add("ADT", passengers.adults);
  add(teenPTC, passengers.teens);
  add("CHD", passengers.children);
  add("INF", passengers.infants);

  const order = ["ADT", "YTH", "CHD", "INF"];
  return [...counts.entries()]
    .map(([ptc, quantity]) => ({ ptc, quantity }))
    .sort((a, b) => {
      const ia = order.indexOf(a.ptc);
      const ib = order.indexOf(b.ptc);
      return (ia < 0 ? order.length : ia) - (ib < 0 ? order.length : ib);
    });
}

export function buildAirShoppingRQ(request: SearchRequest, options: BuildOptions): string {
  const {
    credentials: c,
    sendCabinPreference = false,
    teenPTC = "ADT",
    travelersStyle = "grouped",
  } = options;

  const travelers = buildPassengerTypes(request.passengers, teenPTC)
    .flatMap(({ ptc, quantity }) => {
      const one = (q: number) =>
        `<Traveler><AnonymousTraveler><PTC Quantity="${q}">${escapeXml(ptc)}</PTC>` +
        `</AnonymousTraveler></Traveler>`;
      return travelersStyle === "grouped" ? [one(quantity)] : Array.from({ length: quantity }, () => one(1));
    })
    .join("");

  const originDestinations = request.itinerary
    .map((s) =>
      `<OriginDestination>` +
      `<Departure>${tag("AirportCode", s.origin)}${tag("Date", s.departureDate)}</Departure>` +
      `<Arrival>${tag("AirportCode", s.destination)}</Arrival>` +
      `</OriginDestination>`
    )
    .join("");

  const preferences = sendCabinPreference
    ? `<Preferences><Preference><CabinPreferences><CabinType>` +
      tag("Code", CABIN_CODE[request.cabinClass]) +
      `</CabinType></CabinPreferences></Preference></Preferences>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Envelope xmlns="http://schemas.xmlsoap.org/soap/envelope/">` +
    `<Header/>` +
    `<Body>` +
    `<AirShoppingRQ xmlns="http://www.iata.org/IATA/EDIST" Version="1.0">` +
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
    `<Parameters><CurrCodes>${tag("CurrCode", request.currency)}</CurrCodes></Parameters>` +
    `<Travelers>${travelers}</Travelers>` +
    `<CoreQuery><OriginDestinations>${originDestinations}</OriginDestinations></CoreQuery>` +
    preferences +
    `</AirShoppingRQ>` +
    `</Body>` +
    `</Envelope>`;
}
