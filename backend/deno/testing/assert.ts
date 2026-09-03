/**
 * Утверждения для тестов.
 *
 * Своя реализация вместо `jsr:@std/assert` намеренно: тестам бэкенда не нужен
 * ни один внешний модуль, поэтому `deno task test` проходит на машине без
 * доступа к сети и в сборочном контуре с закрытым реестром. Набор ровно тот,
 * что используется в тестах; расширять по мере надобности.
 */

const show = (value: unknown) => {
  if (typeof value === "string") return JSON.stringify(value);
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
};

export function assert(condition: unknown, message = "условие не выполнено"): asserts condition {
  if (!condition) throw new Error(message);
}

/** Сравнение по значению: объекты и массивы сравниваются структурно. */
export function assertEquals<T>(actual: T, expected: T, message = "значения не совпали") {
  const a = show(actual);
  const b = show(expected);
  if (a !== b) throw new Error(`${message}\nполучено:  ${a}\nожидалось: ${b}`);
}

export function assertExists(value: unknown, message = "значение отсутствует") {
  if (value === null || value === undefined) throw new Error(message);
}

/** Сравнение чисел с допуском: для сумм после сложения долей. */
export function assertAlmostEquals(actual: number, expected: number, tolerance = 1e-7, message = "") {
  if (!(Math.abs(actual - expected) <= tolerance)) {
    throw new Error(`${message}\nполучено:  ${actual}\nожидалось: ${expected} ± ${tolerance}`);
  }
}

/**
 * Проверяет, что вызов бросил исключение нужного класса, и возвращает его —
 * чтобы дальше проверить код ошибки, а не только сам факт отказа.
 */
export function assertThrows<E extends Error>(
  fn: () => unknown,
  ErrorClass?: new (...args: never[]) => E,
  message = "ожидалось исключение",
): E {
  try {
    fn();
  } catch (error) {
    if (ErrorClass && !(error instanceof ErrorClass)) {
      throw new Error(
        `${message}: получен ${(error as Error)?.constructor?.name}, ожидался ${ErrorClass.name}`,
      );
    }
    return error as E;
  }
  throw new Error(`${message}, но вызов завершился без ошибки`);
}
