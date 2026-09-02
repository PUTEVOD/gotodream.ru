import { CABIN_CLASSES, type SearchRequest } from "./schema.ts";

/**
 * Генератор тестовой выдачи.
 * Заменяется на обращение к GDS / агрегатору; наружу должен остаться тот же тип Offer.
 *
 * МОДЕЛЬ ДАННЫХ: ОДИН РЕЙС — НЕСКОЛЬКО ПРЕДЛОЖЕНИЙ.
 *
 * Раньше генератор проставлял всем предложениям класс из запроса
 * (`cabinClass: request.cabinClass`). Из-за этого фильтр «Класс
 * обслуживания» в интерфейсе не мог работать: отметка запрошенного класса
 * ничего не меняла, отметка любого другого обнуляла выдачу. Замер на
 * маршруте Москва — Сочи: без фильтра 17 карточек, «Эконом» 17, «Бизнес» 0.
 *
 * Теперь так, как это устроено у перевозчика: на одном и том же рейсе
 * продаётся несколько классов, и каждый из них — отдельное предложение со
 * своей ценой. Один рейс даёт от одного до трёх Offer, отличающихся полями
 * id, cabinClass и price; всё остальное (номер, времена, пересадки) у них
 * общее.
 *
 * Класс из запроса (`request.cabinClass`) перестал быть жёстким значением и
 * стал пожеланием: он гарантированно есть в продаже на каждом найденном
 * рейсе, но не мешает показать соседние классы. Поиск бизнеса всегда вернёт
 * бизнес, поиск эконома — эконом; в обоих случаях в выдаче будет что
 * фильтровать.
 */

/** "economy" | "comfort" | "business" — порядок берётся из контракта. */
export type CabinClass = typeof CABIN_CLASSES[number];

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
}

export interface Offer extends Leg {
  id: string;
  cabinClass: CabinClass;
  price: number;
  currency: string;
  seatsLeft: number;
  duration: string;
  legs: Leg[];
}

const AIRLINES = ["S7 Airlines", "Аэрофлот", "Уральские авиалинии"];

const AIRPORT_NAMES: Record<string, { city: string; airport: string }> = {
  MOW: { city: "Москва", airport: "Москва" },
  SVO: { city: "Москва", airport: "Шереметьево" },
  DME: { city: "Москва", airport: "Домодедово" },
  VKO: { city: "Москва", airport: "Внуково" },
  LED: { city: "Санкт-Петербург", airport: "Пулково" },
  AER: { city: "Сочи", airport: "Сочи" },
  KZN: { city: "Казань", airport: "Казань" },
  SVX: { city: "Екатеринбург", airport: "Кольцово" },
  OVB: { city: "Новосибирск", airport: "Толмачёво" },
  KJA: { city: "Красноярск", airport: "Емельяново" },
  VVO: { city: "Владивосток", airport: "Кневичи" },
  KGD: { city: "Калининград", airport: "Храброво" },
  MRV: { city: "Минеральные Воды", airport: "Минеральные Воды" },
  UFA: { city: "Уфа", airport: "Уфа" },
  GOJ: { city: "Нижний Новгород", airport: "Стригино" },
  TSE: { city: "Астана", airport: "Нурсултан Назарбаев" },
  ALA: { city: "Алматы", airport: "Алматы" },
  TAS: { city: "Ташкент", airport: "Ислам Каримов" },
  EVN: { city: "Ереван", airport: "Звартноц" },
  IST: { city: "Стамбул", airport: "Стамбул" },
  DXB: { city: "Дубай", airport: "Дубай" },
};

const CLASS_MULTIPLIER: Record<CabinClass, number> = { economy: 1, comfort: 1.6, business: 2.8 };

/**
 * Какие классы продаются на конкретном рейсе.
 *
 * Эконом есть всегда, запрошенный класс — тоже (иначе поиск бизнеса мог бы
 * вернуть выдачу без единого бизнес-предложения). Комфорт и бизнес
 * добавляются с вероятностью: далеко не каждый рейс их продаёт, и
 * одинаковый набор классов у всех рейсов выглядел бы ненастоящим.
 *
 * Оба random() вызываются безусловно: число обращений к генератору не
 * должно зависеть от того, что попало в набор, иначе одинаковые запросы
 * с разным запрошенным классом разъедут всю последовательность.
 */
function classesOnSale(random: () => number, requested: CabinClass): CabinClass[] {
  const hasComfort = random() < 0.6;
  const hasBusiness = random() < 0.35;

  const sold = new Set<CabinClass>(["economy", requested]);
  if (hasComfort) sold.add("comfort");
  if (hasBusiness) sold.add("business");

  // Порядок из контракта: эконом -> комфорт -> бизнес, а не порядок вставки.
  return CABIN_CLASSES.filter((value) => sold.has(value));
}

/** Детерминированный PRNG: одинаковый запрос — одинаковая выдача. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hash = (value: string) => {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const minutesToTime = (minutes: number) => {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

const formatDuration = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} ч` : `${h} ч ${m} мин`;
};

const describe = (code: string) => AIRPORT_NAMES[code] ?? { city: code, airport: code };

function buildLeg(random: () => number, origin: string, destination: string, date: string): Leg {
  const airline = AIRLINES[Math.floor(random() * AIRLINES.length)];
  const stops = random() < 0.55 ? 0 : random() < 0.85 ? 1 : 2;
  const baseDuration = 90 + Math.floor(random() * 300);
  const durationMinutes = baseDuration + stops * (60 + Math.floor(random() * 90));
  const departureMinutes = Math.floor(random() * 288) * 5;
  const from = describe(origin);
  const to = describe(destination);

  return {
    flightNumber: `${airline === "S7 Airlines" ? "S7" : airline === "Аэрофлот" ? "SU" : "U6"}-${1000 + Math.floor(random() * 8999)}`,
    airline,
    from: from.city,
    to: to.city,
    departureAirport: from.airport,
    arrivalAirport: to.airport,
    date,
    departureTime: minutesToTime(departureMinutes),
    arrivalTime: minutesToTime(departureMinutes + durationMinutes),
    durationMinutes,
    stops,
  };
}

export function generateOffers(request: SearchRequest): Offer[] {
  const seedSource = JSON.stringify(request.itinerary) + request.cabinClass;
  const random = mulberry32(hash(seedSource));
  const seats = request.passengers.adults + request.passengers.teens + request.passengers.children;

  const offers: Offer[] = [];
  /* Рейсов стало меньше, чем было (12–23): каждый теперь разворачивается в
     два-три предложения, и при прежнем количестве список вырос бы до
     полусотни карточек. При 8–14 рейсах предложений выходит примерно
     20–35 — столько же, сколько выдавала прежняя версия. */
  const count = 8 + Math.floor(random() * 7);

  for (let i = 0; i < count; i++) {
    const legs = request.itinerary.map((s) => buildLeg(random, s.origin, s.destination, s.departureDate));
    const head = legs[0];
    const totalDuration = legs.reduce((sum, l) => sum + l.durationMinutes, 0);
    const basePrice = 3200 + totalDuration * 24 + Math.floor(random() * 6000);

    for (const cabinClass of classesOnSale(random, request.cabinClass)) {
      const price = Math.round(
        (basePrice * CLASS_MULTIPLIER[cabinClass] * seats +
          request.passengers.infants * 1200) / 10,
      ) * 10;

      offers.push({
        ...head,
        // Класс входит в идентификатор: без него три предложения одного
        // рейса получили бы один id, и React потерял бы key в списке.
        id: `${head.flightNumber}-${head.date}-${i}-${cabinClass}`,
        legs,
        cabinClass,
        price,
        currency: request.currency,
        // Мест в бизнесе всегда меньше, чем в экономе.
        seatsLeft: 1 + Math.floor(random() * (cabinClass === "business" ? 4 : 9)),
        duration: formatDuration(head.durationMinutes),
      });
    }
  }

  return offers;
}

const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

/**
 * Ключи фильтров, которые можно временно исключить при проверке предложения.
 * Нужны для фасетов: список авиакомпаний считается по выдаче, отфильтрованной
 * ВСЕМ, кроме самого фильтра авиакомпаний. Иначе после выбора «Аэрофлот» в
 * списке осталась бы одна строка — «Аэрофлот», и снять выбор было бы можно,
 * а сравнить с другими компаниями нет.
 */
type FilterKey =
  | "departureRange"
  | "arrivalRange"
  | "durationRange"
  | "stops"
  | "airlines"
  | "cabinClasses";

/** Одно предложение против набора фильтров. skip исключает один фильтр. */
function matchesFilters(
  offer: Offer,
  f: SearchRequest["filters"],
  skip?: FilterKey,
): boolean {
  if (skip !== "departureRange" && f.departureRange) {
    const dep = toMinutes(offer.departureTime);
    if (dep < f.departureRange.lower || dep > f.departureRange.upper) return false;
  }
  if (skip !== "arrivalRange" && f.arrivalRange) {
    const arr = toMinutes(offer.arrivalTime);
    if (arr < f.arrivalRange.lower || arr > f.arrivalRange.upper) return false;
  }
  if (skip !== "durationRange" && f.durationRange) {
    if (offer.durationMinutes < f.durationRange.lower || offer.durationMinutes > f.durationRange.upper) {
      return false;
    }
  }
  // Пустой массив stops означает «любое количество пересадок».
  if (skip !== "stops" && f.stops?.length && !f.stops.includes(offer.stops)) return false;
  if (skip !== "airlines" && f.airlines?.length && !f.airlines.includes(offer.airline)) return false;
  if (skip !== "cabinClasses" && f.cabinClasses?.length && !f.cabinClasses.includes(offer.cabinClass)) {
    return false;
  }
  return true;
}

export function applyFilters(offers: Offer[], request: SearchRequest): Offer[] {
  const f = request.filters;
  const filtered = offers.filter((offer) => matchesFilters(offer, f));

  const comparators: Record<string, (a: Offer, b: Offer) => number> = {
    cheapest: (a, b) => a.price - b.price,
    fastest: (a, b) => a.durationMinutes - b.durationMinutes,
    // «Удобный» = компромисс цены, длительности и числа пересадок.
    convenient: (a, b) =>
      (a.price / 1000 + a.durationMinutes / 60 + a.stops * 2) -
      (b.price / 1000 + b.durationMinutes / 60 + b.stops * 2),
  };

  return filtered.sort(comparators[f.sortType] ?? comparators.cheapest);
}

export interface FacetValue {
  value: string;
  count: number;
}

export interface Facets {
  airlines: FacetValue[];
  cabinClasses: FacetValue[];
}

/**
 * Сколько предложений придётся на каждое значение поля, если выбрать только
 * его. Считается по набору, к которому применены ВСЕ фильтры, кроме
 * собственного (аргумент skip), — иначе после выбора одного значения список
 * схлопнулся бы в одну строку и сравнить варианты стало бы не с чем.
 *
 * `selected` — значения, уже отмеченные человеком. Они остаются в списке,
 * даже если под остальные фильтры не подходит ни одного предложения: иначе
 * строка исчезает вместе с возможностью снять отметку, и остаётся пустая
 * выдача без объяснения.
 */
function countFacet(
  offers: Offer[],
  f: SearchRequest["filters"],
  skip: FilterKey,
  pick: (offer: Offer) => string,
  selected: readonly string[] = [],
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const offer of offers) {
    if (!matchesFilters(offer, f, skip)) continue;
    const key = pick(offer);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  for (const value of selected) {
    if (!counts.has(value)) counts.set(value, 0);
  }

  return counts;
}

/**
 * Значения, которые имеет смысл предлагать в фильтрах ИМЕННО ДЛЯ ЭТОЙ выдачи.
 *
 * Раньше оба списка были зашиты константами на фронте и не зависели ни от
 * направления, ни от дат: человек видел «Уральские авиалинии» на маршруте,
 * где их нет, отмечал и получал пустую выдачу. Теперь оба приходят с ответом.
 *
 * ПОРЯДОК РАЗНЫЙ, И ЭТО НАМЕРЕННО.
 *
 * Авиакомпании — по убыванию количества, при равенстве по алфавиту:
 * своего порядка у них нет, а полезнее видеть сверху тех, у кого рейсов
 * больше. Классы обслуживания — всегда в порядке контракта (эконом →
 * комфорт → бизнес): это шкала, и переставлять её ступени местами по числу
 * предложений значит ломать привычную картину.
 */
export function buildFacets(offers: Offer[], request: SearchRequest): Facets {
  const f = request.filters;

  const airlines = countFacet(offers, f, "airlines", (o) => o.airline, f.airlines);
  const cabinClasses = countFacet(offers, f, "cabinClasses", (o) => o.cabinClass, f.cabinClasses);

  return {
    airlines: [...airlines.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, "ru")),

    cabinClasses: CABIN_CLASSES
      .filter((value) => cabinClasses.has(value))
      .map((value) => ({ value, count: cabinClasses.get(value) ?? 0 })),
  };
}
