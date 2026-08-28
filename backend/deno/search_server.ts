import { config } from "./search/config.ts";
import { searchRoutes } from "./search/handler.ts";

/**
 * Отдельный сервер поиска рейсов.
 * Запуск:  deno run --allow-net --allow-env search_server.ts
 *
 * Нужен, чтобы форма заработала, не трогая существующие main.ts / server.ts.
 * Когда решите объединить всё в один сервер — перенесите две строки
 * из обработчика ниже в свой main.ts и удалите этот файл.
 */
Deno.serve({ port: config.port }, async (request) => {
  const handled = await searchRoutes(request);
  if (handled) return handled;

  return new Response(JSON.stringify({ error: { code: "NOT_FOUND", message: "Маршрут не найден", details: [] } }), {
    status: 404,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
});

console.info(`Поиск рейсов слушает http://localhost:${config.port}`);
console.info(`CORS разрешён для: ${config.allowedOrigins.join(", ")}`);
