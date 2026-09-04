import { CABIN_CLASSES, type SearchRequest } from "../schema.ts";
import {
  type CabinClass,
  formatDuration,
  type Leg,
  minutesToTime,
  type Offer,
  type RepricedPassenger,
} from "../offer.ts";
import type { FlightProvider, ProviderResult, RepriceInput, RepriceResult } from "./types.ts";

/**
 * Провайдер «mock»: генератор тестовой выдачи.
 *
 * Остаётся в проекте после подключения S7 намеренно: на нём разрабатывают
 * интерфейс, когда стенд перевозчика недоступен, и на нём же гоняются тесты
 * фильтров — детерминированный PRNG даёт одинаковую выдачу на одинаковый
 * запрос, а живой шлюз — нет.
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
    flightNumber: `${airline === "S7 Airlines" ? "S7" : airline === "Аэрофлот" ? "SU" : "U6"}-${
      1000 + Math.floor(random() * 8999)
    }`,
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

/**
 * Пересчёт цены у генератора.
 *
 * Смысл шага в том, что цена МОЖЕТ отличаться от той, что была в выдаче.
 * Поэтому генератор её и меняет: примерно у трети предложений сумма уходит
 * на несколько процентов вверх или вниз. Возвращать ровно ту же цену было бы
 * удобнее для разработки и бесполезно для дела — интерфейс, который никогда
 * не видел изменившейся цены, не готов её показать.
 *
 * Изменение детерминировано идентификатором предложения: один и тот же рейс
 * пересчитывается одинаково, и поведение страницы воспроизводится.
 */
export function repriceOffer(input: RepriceInput): RepriceResult {
  const { offer, search } = input;
  const random = mulberry32(hash(`reprice:${offer.id}`));

  const roll = random();
  const factor = roll < 0.66 ? 1 : 1 + (random() - 0.5) * 0.12;
  const price = Math.round(offer.price * factor / 10) * 10;

  // Сборы считаем долей от итога: у генератора нет тарифных правил, а
  // показывать «тариф 0 + сборы всё» было бы просто неверно.
  const taxes = Math.round(price * 0.12);
  const base = price - taxes;

  /* Раскладка по пассажирам. Вес взят из того, как это устроено у
     перевозчика: ребёнок дешевле взрослого, младенец без места почти
     ничего не стоит. Точные коэффициенты здесь не важны — важно, что сумма
     по пассажирам сходится с итогом, потому что именно это проверяет
     интерфейс. */
  const weights: Array<{ ptc: string; weight: number }> = [
    ...Array.from({ length: search.passengers.adults }, () => ({ ptc: "ADT", weight: 1 })),
    ...Array.from({ length: search.passengers.teens }, () => ({ ptc: "ADT", weight: 1 })),
    ...Array.from({ length: search.passengers.children }, () => ({ ptc: "CHD", weight: 0.5 })),
    ...Array.from({ length: search.passengers.infants }, () => ({ ptc: "INF", weight: 0.05 })),
  ];
  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0) || 1;

  const passengers: RepricedPassenger[] = [];
  let distributed = 0;
  weights.forEach((entry, index) => {
    // Последнему достаётся остаток: иначе округление каждой доли по
    // отдельности разошлось бы с итогом на несколько рублей.
    const share = index === weights.length - 1
      ? price - distributed
      : Math.round(price * entry.weight / totalWeight);
    distributed += share;
    const passengerTaxes = Math.round(share * 0.12);
    passengers.push({
      objectKey: `P${index + 1}`,
      ptc: entry.ptc,
      price: share,
      base: share - passengerTaxes,
      taxes: passengerTaxes,
    });
  });

  return {
    reprice: {
      offerId: offer.id,
      price,
      currency: offer.currency,
      breakdown: { base, taxes },
      passengers,
      previousPrice: offer.price,
      difference: price - offer.price,
    },
    source: "mock",
    warnings: [],
  };
}

export const mockProvider: FlightProvider = {
  name: "mock",
  // deno-lint-ignore require-await
  search: async (request: SearchRequest): Promise<ProviderResult> => ({
    offers: generateOffers(request),
    source: "mock",
    warnings: [],
  }),
  // deno-lint-ignore require-await
  reprice: async (input: RepriceInput): Promise<RepriceResult> => repriceOffer(input),
};
