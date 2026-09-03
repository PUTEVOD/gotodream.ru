import { config } from "../config.ts";
import type { FlightProvider } from "./types.ts";
import { mockProvider } from "./mock.ts";
import { s7Provider } from "./s7/provider.ts";
import { withCache } from "./cache.ts";

/**
 * Выбор поставщика по конфигурации.
 *
 * Провайдер создаётся один раз и переиспользуется: внутри него живёт кэш,
 * а кэш, создаваемый на каждый запрос, — это отсутствие кэша.
 */

const providers: Record<string, FlightProvider> = {
  mock: mockProvider,
  s7: s7Provider,
};

let active: FlightProvider | null = null;

export function getProvider(): FlightProvider {
  if (!active) {
    const base = providers[config.provider];
    if (!base) throw new Error(`Неизвестный провайдер: ${config.provider}`);
    // Кэш поверх генератора бесполезен, но и не вреден; включать/выключать
    // его лучше одной настройкой, чем условием по имени провайдера.
    active = withCache(base, config.cache);
  }
  return active;
}

/** Только для тестов: сбросить выбранный провайдер вместе с его кэшем. */
export function resetProvider(): void {
  active = null;
}
