import { CABIN_CLASSES, type SearchRequest } from "./schema.ts";
import { type Facets, type Offer, timeToMinutes } from "./offer.ts";

/**
 * Фильтрация, сортировка и подсчёт фасетов.
 *
 * Работает поверх готового набора Offer и ничего не знает о том, откуда он
 * взялся: генератор это или ответ NDC-шлюза S7. Поэтому фильтры одинаково
 * ведут себя на любом провайдере, а провайдеру не нужно уметь фильтровать.
 *
 * Так же сознательно: фильтры применяются НА СТОРОНЕ БЭКЕНДА, а не в запросе к
 * поставщику. Поставщика спрашивают один раз про маршрут и пассажиров, ответ
 * кладётся в кэш, а движение ползунков перебирает уже полученный набор.
 * Иначе каждое касание ползунка времени было бы обращением к внешнему API.
 */

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
    const dep = timeToMinutes(offer.departureTime);
    if (dep < f.departureRange.lower || dep > f.departureRange.upper) return false;
  }
  if (skip !== "arrivalRange" && f.arrivalRange) {
    const arr = timeToMinutes(offer.arrivalTime);
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
