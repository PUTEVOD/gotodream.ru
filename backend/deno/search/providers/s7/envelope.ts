import { ProviderError } from "../types.ts";
import { arr, attr, parseXml, pick, text } from "./xml.ts";

/**
 * Вскрытие SOAP-конверта и проверка ответа на отказ.
 *
 * Вынесено отдельно, потому что правило одно для всех операций шлюза:
 * поиск, пересчёт цены, бронирование отвечают разными корневыми элементами,
 * но ошибки сообщают одинаково.
 *
 * ГЛАВНОЕ ПРО ОШИБКИ NDC. Они приходят не HTTP-статусом, а телом ответа:
 * либо SOAP Fault, либо блок `Errors` внутри вполне успешного «200 OK».
 * Ответ с `Errors` внутри — это отказ, и молча продолжать по нему нельзя:
 * человек увидит «ничего не найдено» там, где на самом деле неверный запрос
 * или истёкшее предложение.
 */

/** Разбирает XML и возвращает корневой элемент ответа с именем rootName. */
export function readResponseRoot(xml: string, rootName: string): Record<string, unknown> {
  let envelope: Record<string, unknown>;
  try {
    envelope = parseXml(xml);
  } catch (error) {
    throw new ProviderError("PROVIDER_BAD_RESPONSE", "Ответ шлюза S7 не удалось разобрать", {
      internal: error instanceof Error ? error.message : String(error),
      cause: error,
    });
  }

  const root = pick(envelope, "Envelope", "Body", rootName) ?? pick(envelope, rootName);

  // Проверка отказа идёт ДО проверки на отсутствие корня: у SOAP Fault
  // нужного корня нет вовсе, и «в ответе нет ItinReshopRS» скрыло бы
  // настоящую причину.
  assertNoErrors(root, envelope);

  if (!root || typeof root !== "object") {
    throw new ProviderError("PROVIDER_BAD_RESPONSE", `В ответе шлюза S7 нет ${rootName}`, {
      internal: xml.slice(0, 500),
    });
  }

  return root as Record<string, unknown>;
}

export function assertNoErrors(root: unknown, envelope: unknown): void {
  const fault = pick(envelope, "Envelope", "Body", "Fault");
  if (fault) {
    throw new ProviderError("PROVIDER_UNAVAILABLE", "Шлюз S7 вернул SOAP Fault", {
      internal: `${text(pick(fault, "faultcode"))}: ${text(pick(fault, "faultstring"))}`,
    });
  }

  const errors = arr(pick(root, "Errors", "Error"));
  if (errors.length) {
    const details = errors.map((error) => ({
      path: attr(error, "Code") || "s7",
      message: text(error) || attr(error, "ShortText") || "Ошибка шлюза",
    }));
    throw new ProviderError("PROVIDER_REJECTED", "Шлюз S7 отклонил запрос", {
      details,
      internal: details.map((d) => `${d.path}: ${d.message}`).join("; "),
    });
  }
}
