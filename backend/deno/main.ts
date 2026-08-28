import { config } from "./search/config.ts";
import { searchRoutes } from "./search/handler.ts";

/**
 * gotodream.ru — единственная точка входа бэкенда.
 *
 * Запуск:
 *   deno task dev     — с автоперезапуском при правке файлов
 *   deno task start   — без автоперезапуска
 *   deno task test    — прогон тестов
 *
 * Новые разделы API добавляются здесь по образцу searchRoutes: модуль
 * экспортирует функцию (Request) => Promise<Response | null>, возвращает null,
 * если запрос не его, и подключается одной строкой в список ниже.
 */

const routers = [
  searchRoutes,
];

const notFound = (request: Request) =>
  new Response(
    JSON.stringify({
      error: {
        code: "NOT_FOUND",
        message: `Маршрут ${new URL(request.url).pathname} не найден`,
        details: [],
      },
    }),
    { status: 404, headers: { "Content-Type": "application/json; charset=utf-8" } },
  );

Deno.serve({ port: config.port }, async (request) => {
  for (const route of routers) {
    const response = await route(request);
    if (response) return response;
  }
  return notFound(request);
});

console.info(`API запущен: http://localhost:${config.port}`);
console.info(`CORS разрешён для: ${config.allowedOrigins.join(", ")}`);
