import { CABIN_CLASSES } from "./schema.ts";

/**
 * Единая форма предложения, которую отдаёт бэкенд наружу.
 *
 * Это граница системы: всё, что приходит от поставщика (генератор, S7 NDC,
 * завтра — агрегатор), приводится к этим типам, и только они попадают в JSON
 * ответа. Пока фронт видит Offer, источник данных можно менять, ничего не
 * трогая в интерфейсе.
 *
 * Обязательные поля повторяют то, что уже рисует FlightList.jsx. Всё, что
 * умеет отдавать не каждый поставщик, объявлено необязательным: провайдер
 * заполняет, что может, интерфейс показывает, что пришло.
 */

/** "economy" | "comfort" | "business" — порядок берётся из контракта. */
export type CabinClass = typeof CABIN_CLASSES[number];

/** Один физический перелёт: борт из аэропорта A в аэропорт B без посадок. */
export interface Segment {
  /**
   * Ключ рейса в ответе поставщика (SEG1, SEG2 …).
   *
   * Нужен не для показа. Пересчёт цены и бронирование заново перечисляют
   * рейсы и связывают с каждым тариф через этот ключ (`FareComponent
   * refs="SEG1"`), поэтому он должен дожить от разбора выдачи до следующего
   * запроса. У генератора ключ синтетический — важно только, чтобы он был
   * уникален внутри предложения.
   */
  key: string;
  /**
   * Базис тарифа именно этого рейса (SBSRT, YBSOW …).
   *
   * Хранится по сегменту, а не по предложению: `ItinReshopRQ` требует
   * `FareBasisCode` и `RBD` для каждого `FareComponent`. В ответах стенда
   * все сегменты одного предложения пока приходят с одним тарифом, поэтому
   * разницы не видно — она появится на первом же маршруте, где сегменты
   * тарифицированы по-разному.
   */
  fareBasis?: string;
  /** Класс бронирования (RBD) этого рейса: Q, S, Y, U … */
  bookingClass?: string;
  /** Для показа: «S7-1003». */
  flightNumber: string;
  marketingAirline: string;
  operatingAirline: string;
  /**
   * Номер рейса без кода авиакомпании: «1003».
   *
   * Отдельно от flightNumber, потому что в запросах пересчёта и брони код и
   * номер идут разными элементами (`MarketingCarrier/AirlineID` и
   * `.../FlightNumber`). Разбирать обратно склеенную строку — способ однажды
   * ошибиться на рейсе, в номере которого есть дефис.
   */
  marketingFlightNumber?: string;
  operatingFlightNumber?: string;
  departureAirport: string;
  arrivalAirport: string;
  departureDate: string;
  departureTime: string;
  arrivalDate: string;
  arrivalTime: string;
  durationMinutes: number;
  aircraft?: string;
}

/** Одно направление маршрута («туда» или «обратно») целиком, с пересадками. */
export interface Leg {
  flightNumber: string;
  airline: string;
  from: string;
  to: string;
  departureAirport: string;
  arrivalAirport: string;
  date: string;
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  stops: number;
  /** Составляющие перелёты. У прямого рейса — один элемент. */
  segments?: Segment[];
}

export interface Baggage {
  /** Норма ручной клади, как её описал поставщик. Пример: "10KG". */
  carryOn?: string;
  /** Норма багажа. Пустая строка или "NO" у поставщика означает «без багажа». */
  checked?: string;
  /** Багаж включён в тариф. undefined — поставщик не сообщил. */
  checkedIncluded?: boolean;
}

export interface PriceBreakdown {
  base: number;
  taxes: number;
  /** Разбивка по кодам сборов: YQ, RI и прочее. */
  taxDetails?: Array<{ code: string; amount: number; description?: string }>;
}

export interface Offer extends Leg {
  id: string;
  cabinClass: CabinClass;
  /** Итоговая цена за всех пассажиров запроса, в валюте currency. */
  price: number;
  currency: string;
  seatsLeft: number;
  duration: string;
  legs: Leg[];

  /** Идентификатор предложения у поставщика. Нужен для следующего шага (reprice/book). */
  offerId?: string;
  /** Маркетинговое название тарифа: "BASIC ECONOMY", "PLUS BUSINESS". */
  fareBrand?: string;
  /** Буквенный класс бронирования: Q, B, Y. */
  bookingClass?: string;
  baggage?: Baggage;
  priceBreakdown?: PriceBreakdown;
  /** Возвратность тарифа, если поставщик её сообщил. */
  refundable?: boolean;
}

/** Сумма по одному пассажиру в подтверждённой цене. */
export interface RepricedPassenger {
  /** Ключ, под которым пассажир ушёл в запрос: SH1, SH3i … */
  objectKey: string;
  ptc: string;
  price: number;
  base: number;
  taxes: number;
}

/**
 * Подтверждённая цена выбранного предложения.
 *
 * Цена в выдаче поиска — не обязательство: между поиском и оплатой места
 * продаются и тарифы пересчитываются. Поэтому перед бронированием цена
 * подтверждается отдельным запросом, и разница показывается человеку до
 * того, как он введёт данные пассажиров, а не после списания.
 */
export interface Reprice {
  /** Идентификатор предложения из выдачи, к которому относится пересчёт. */
  offerId: string;
  price: number;
  currency: string;
  breakdown: { base: number; taxes: number; fees?: number };
  passengers: RepricedPassenger[];
  /** Цена, которая стояла в выдаче поиска. */
  previousPrice: number;
  /** price - previousPrice. Ноль — цена не изменилась. */
  difference: number;
}

export interface FacetValue {
  value: string;
  count: number;
}

export interface Facets {
  airlines: FacetValue[];
  cabinClasses: FacetValue[];
}

export const minutesToTime = (minutes: number) => {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

export const timeToMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

export const formatDuration = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} ч` : `${h} ч ${m} мин`;
};

/**
 * Разница между двумя моментами в минутах.
 * Даты и время приходят от поставщика уже в местных зонах аэропортов, поэтому
 * складывать их как UTC нельзя — длительность перелёта поставщик присылает
 * отдельно. Функция нужна только для стыковок внутри одного маршрута, где
 * зона одна и та же (аэропорт пересадки).
 */
export const minutesBetween = (
  fromDate: string,
  fromTime: string,
  toDate: string,
  toTime: string,
): number => {
  const a = Date.parse(`${fromDate}T${fromTime}:00Z`);
  const b = Date.parse(`${toDate}T${toTime}:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 60_000);
};
