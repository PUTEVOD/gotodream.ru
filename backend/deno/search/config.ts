/** Конфигурация берётся только из переменных окружения — никаких значений в коде. */
export const config = {
  port: Number(Deno.env.get("PORT") ?? 8000),

  /**
   * Список источников, которым разрешён доступ из браузера.
   * В разработке — адрес дев-сервера React, в проде — домен сайта.
   * "*" использовать нельзя: он несовместим с cookie-авторизацией и снимает защиту.
   */
  allowedOrigins: (Deno.env.get("ALLOWED_ORIGINS") ??
    "http://localhost:3000,http://localhost:5173").split(",").map((o) => o.trim()).filter(Boolean),

  /** Максимальный размер тела запроса, байт. Защита от «мусорных» POST. */
  maxBodyBytes: Number(Deno.env.get("MAX_BODY_BYTES") ?? 32_768),
};
