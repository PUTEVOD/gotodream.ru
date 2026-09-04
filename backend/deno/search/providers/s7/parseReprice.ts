import type { Reprice, RepricedPassenger } from "../../offer.ts";
import { ProviderError } from "../types.ts";
import { arr, attr, num, pick, text } from "./xml.ts";
import { readResponseRoot } from "./envelope.ts";

/**
 * Разбор ItinReshopRS — подтверждённой цены.
 *
 * Устройство ответа проще, чем у поиска: ссылок на DataLists здесь почти
 * нет, суммы лежат прямо в предложении.
 *
 *   Response/Passengers        — состав: ObjectKey -> PTC. Имён нет, они
 *                                появятся только при бронировании.
 *   Response/ReShopOffers      — пересчитанные предложения. Мы отправляли
 *     ReShopOffer               один маршрут, поэтому ожидаем одно.
 *       TotalPrice             — итог за всех пассажиров: тариф, сборы, платы.
 *       ReShopPricedOffer
 *         OfferPrice           — по одному на пассажира. У младенца суммы
 *                                нулевые — это норма, а не сбой разбора.
 *         FareDetail           — базис тарифа по сегментам (для брони).
 *
 * ЧТО ВАЖНО ПРО СУММЫ. Здесь они приходят с дробной частью («15478.00»),
 * тогда как в выдаче поиска — целыми («15678»). Это одна и та же величина
 * в рублях, а не рубли против копеек: 15 478.00 и есть пятнадцать тысяч
 * четыреста семьдесят восемь рублей. Ошибка в сто раз в этом месте —
 * классика интеграций с NDC, поэтому значение читается как число, а не
 * домножается ни на что.
 */

/** Сумма и валюта из блока DetailCurrencyPrice/Total и подобных. */
const amount = (node: unknown) => ({ value: num(node), currency: attr(node, "Code") });

export function parseItinReshopRS(
  xml: string,
  context: { offerId: string; previousPrice: number },
): { reprice: Reprice; warnings: string[] } {
  const root = readResponseRoot(xml, "ItinReshopRS");
  const response = pick(root, "Response");
  const warnings: string[] = [];

  const offers = arr(pick(response, "ReShopOffers", "ReShopOffer"));
  if (!offers.length) {
    throw new ProviderError("PROVIDER_BAD_RESPONSE", "Шлюз S7 не вернул пересчитанную цену", {
      internal: xml.slice(0, 800),
    });
  }
  if (offers.length > 1) {
    // Отправляли один маршрут — ждём одно предложение. Больше одного значит,
    // что запрос понят не так, как задумано: берём первое и говорим об этом.
    warnings.push(`Шлюз вернул ${offers.length} вариантов цены, взят первый`);
  }

  const offer = offers[0];
  const total = amount(pick(offer, "TotalPrice", "DetailCurrencyPrice", "Total"));

  const fareDetail = arr(pick(offer, "TotalPrice", "DetailCurrencyPrice", "Details", "Detail"))
    .find((detail) => text(pick(detail, "Application")).toLowerCase() === "fare");
  const base = num(pick(fareDetail, "SubTotal"));
  const taxes = num(pick(offer, "TotalPrice", "DetailCurrencyPrice", "Taxes", "Total"));
  const fees = num(pick(offer, "TotalPrice", "DetailCurrencyPrice", "Fees", "Total"));

  // Состав: ключ -> тип пассажира. Нужен, чтобы к суммам можно было
  // подписать «взрослый», а не «SH4».
  const ptcByKey = new Map<string, string>();
  for (const passenger of arr(pick(response, "Passengers", "Passenger"))) {
    const key = attr(passenger, "ObjectKey");
    if (key) ptcByKey.set(key, text(pick(passenger, "PTC")));
  }

  const passengers: RepricedPassenger[] = [];
  for (const offerPrice of arr(pick(offer, "ReShopPricedOffer", "OfferPrice"))) {
    const detail = pick(offerPrice, "RequestedDate", "PriceDetail");
    const references = arr(pick(offerPrice, "RequestedDate", "Associations"))
      .flatMap((association) => arr(pick(association, "AssociatedTraveler", "TravelerReferences")))
      .map((value) => text(value))
      .filter(Boolean);

    const perPassenger = {
      price: num(pick(detail, "TotalAmount", "DetailCurrencyPrice", "Total")),
      base: num(pick(detail, "BaseAmount")),
      taxes: num(pick(detail, "TotalAmount", "DetailCurrencyPrice", "Taxes", "Total")),
    };

    if (!references.length) {
      warnings.push("В пересчёте есть сумма без привязки к пассажиру");
      continue;
    }
    for (const objectKey of references) {
      passengers.push({ objectKey, ptc: ptcByKey.get(objectKey) ?? "", ...perPassenger });
    }
  }

  // Сумма по пассажирам должна сходиться с итогом. Расхождение означает, что
  // часть OfferPrice не разобрана, — молчать об этом нельзя: именно из этих
  // сумм потом складывается счёт.
  const sum = passengers.reduce((acc, p) => acc + p.price, 0);
  if (passengers.length && Math.abs(sum - total.value) > 0.01) {
    warnings.push(`Сумма по пассажирам (${sum}) не сходится с итогом (${total.value})`);
  }

  const reprice: Reprice = {
    offerId: context.offerId,
    price: total.value,
    currency: total.currency || "RUB",
    breakdown: { base, taxes, fees: fees || undefined },
    passengers,
    previousPrice: context.previousPrice,
    difference: Math.round((total.value - context.previousPrice) * 100) / 100,
  };

  return { reprice, warnings };
}
