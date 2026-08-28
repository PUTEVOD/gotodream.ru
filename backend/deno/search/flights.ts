import type { SearchRequest } from "./schema.ts";

/**
 * Генератор тестовой выдачи.
 * Заменяется на обращение к GDS / агрегатору; наружу должен остаться тот же тип Offer.
 */

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
  cabinClass: string;
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

const CLASS_MULTIPLIER: Record<string, number> = { economy: 1, comfort: 1.6, business: 2.8 };

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
  const count = 12 + Math.floor(random() * 12);

  for (let i = 0; i < count; i++) {
    const legs = request.itinerary.map((s) => buildLeg(random, s.origin, s.destination, s.departureDate));
    const head = legs[0];
    const totalDuration = legs.reduce((sum, l) => sum + l.durationMinutes, 0);

    const basePrice = 3200 + totalDuration * 24 + Math.floor(random() * 6000);
    const price = Math.round(
      (basePrice * (CLASS_MULTIPLIER[request.cabinClass] ?? 1) * seats +
        request.passengers.infants * 1200) / 10,
    ) * 10;

    offers.push({
      ...head,
      id: `${head.flightNumber}-${head.date}-${i}`,
      legs,
      cabinClass: request.cabinClass,
      price,
      currency: request.currency,
      seatsLeft: 1 + Math.floor(random() * 9),
      duration: formatDuration(head.durationMinutes),
    });
  }

  return offers;
}

const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

export function applyFilters(offers: Offer[], request: SearchRequest): Offer[] {
  const f = request.filters;

  const filtered = offers.filter((offer) => {
    if (f.departureRange) {
      const dep = toMinutes(offer.departureTime);
      if (dep < f.departureRange.lower || dep > f.departureRange.upper) return false;
    }
    if (f.arrivalRange) {
      const arr = toMinutes(offer.arrivalTime);
      if (arr < f.arrivalRange.lower || arr > f.arrivalRange.upper) return false;
    }
    if (f.durationRange) {
      if (offer.durationMinutes < f.durationRange.lower || offer.durationMinutes > f.durationRange.upper) return false;
    }
    // Пустой массив stops означает «любое количество пересадок».
    if (f.stops?.length && !f.stops.includes(offer.stops)) return false;
    if (f.airlines?.length && !f.airlines.includes(offer.airline)) return false;
    if (f.cabinClasses?.length && !f.cabinClasses.includes(offer.cabinClass as typeof f.cabinClasses[number])) return false;
    return true;
  });

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
