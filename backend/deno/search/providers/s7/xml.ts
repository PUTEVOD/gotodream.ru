import { XMLParser } from "npm:fast-xml-parser@4.5.0";

/**
 * Тонкая обёртка над разбором XML.
 *
 * Задача — превратить ответ шлюза в обычные объекты и дать три функции
 * доступа, которые терпят структурные сюрпризы. Сюрпризов в NDC два, и оба
 * системные:
 *
 * 1. Один элемент против списка. <OfferPrice> в единственном экземпляре
 *    становится объектом, во множественном — массивом. Код, который пишет
 *    `offer.OfferPrice.map(...)`, ломается на односегментном маршруте и
 *    работает на двухсегментном. Поэтому доступ к спискам только через arr().
 *
 * 2. Текст против текста с атрибутами. <Total Code="RUB">15553</Total> — это
 *    объект с полями "@Code" и "#text", а <AirportCode>DME</AirportCode> —
 *    просто строка. Поэтому чтение значения только через text().
 *
 * Префиксы пространств имён снимаются (removeNSPrefix): в ответе они
 * расставлены неоднородно, и опираться на них — лишний источник поломок.
 */

/**
 * Узел разобранного XML. Тип справочный: text/num/attr принимают unknown,
 * потому что pick() по построению не знает, что лежит в конце цепочки, и
 * приведение на каждом вызове только зашумляло бы разбор.
 */
export type XmlNode = Record<string, unknown> | string | number | boolean | null | undefined;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  textNodeName: "#text",
  removeNSPrefix: true,
  trimValues: true,
  // Числа не разбираем намеренно: "0910" — номер рейса, а не девятьсот десять,
  // а "2025-07-03" при агрессивном разборе местами превращается в дату.
  parseTagValue: false,
  parseAttributeValue: false,
});

export const parseXml = (xml: string): Record<string, unknown> =>
  parser.parse(xml) as Record<string, unknown>;

/** Значение узла как строка: и для голого текста, и для текста с атрибутами. */
export function text(node: unknown): string {
  if (node === null || node === undefined) return "";
  if (typeof node === "object") {
    const value = (node as Record<string, unknown>)["#text"];
    return value === undefined || value === null ? "" : String(value);
  }
  return String(node);
}

/** Значение узла как число. Нечисловое или отсутствующее — fallback. */
export function num(node: unknown, fallback = 0): number {
  const raw = text(node).replace(",", ".");
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

/** Атрибут узла. */
export function attr(node: unknown, name: string): string {
  if (node && typeof node === "object") {
    const value = (node as Record<string, unknown>)[`@${name}`];
    if (value !== undefined && value !== null) return String(value);
  }
  return "";
}

/** Любой узел как массив: отсутствующий — пустой, одиночный — из одного элемента. */
export function arr<T = Record<string, unknown>>(node: unknown): T[] {
  if (node === undefined || node === null) return [];
  return (Array.isArray(node) ? node : [node]) as T[];
}

/** Дочерний узел по цепочке имён. Обрывается на первом отсутствующем звене. */
export function pick(node: unknown, ...path: string[]): unknown {
  let current: unknown = node;
  for (const key of path) {
    if (current === null || current === undefined || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/**
 * Длительность ISO-8601 (PT4H0M, PT55M, P1DT2H) в минуты.
 * Шлюз присылает длительность перелёта именно так; считать её вычитанием
 * времён нельзя — аэропорты в разных часовых поясах, а смещения в ответе нет.
 */
export function isoDurationToMinutes(value: string): number {
  const match = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/.exec(value.trim());
  if (!match) return 0;
  const [, days, hours, minutes] = match;
  return Number(days ?? 0) * 1440 + Number(hours ?? 0) * 60 + Number(minutes ?? 0);
}
