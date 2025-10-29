import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { serveDir } from "https://deno.land/std@0.192.0/http/file_server.ts";

// Путь к статическим файлам фронтенда
const FRONTEND_PATH = "../../frontend/build"; // Убедитесь, что React-приложение собрано

// Запуск сервера
serve(/*async*/ (req) => {
  const url = new URL(req.url);
  // console.log(url.pathname);

  // Отдаем статические файлы (React-приложение)
  if (url.pathname.startsWith("/static") || url.pathname === "/") {
    return serveDir(req, { fsRoot: FRONTEND_PATH, urlRoot: "", });
  }

  // Обработка API-запросов
  if (url.pathname.startsWith("/api")) {
    return new Response(JSON.stringify({ message: "Hello from Deno!" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Если маршрут не найден
  return new Response("Not Found", { status: 404 });
}, { port: 8000 });

console.log("Server is running on http://localhost:8000");