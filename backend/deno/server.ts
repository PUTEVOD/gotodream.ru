// import { Application, Router } from "https://deno.land/x/oak/mod.ts";
// import { createClient } from "https://deno.land/x/mysql2/mod.ts";
// import * as bcrypt from "https://deno.land/x/bcrypt/mod.ts";
//
// const app = new Application();
// const router = new Router();
//
// // Подключение к базе данных
// const db = await createClient({
//     hostname: "localhost",
//     username: "root", // замените на вашего пользователя
//     db: "travel_agency", // имя базы данных
//     password: "password", // замените на ваш пароль
//     port: 3306,
// });
//
// // Регистрация пользователя
// router.post("/register", async (context) => {
//     try {
//         const { username, email, password } = await context.request.body({ type: "json" }).value;
//
//         // Проверка на существование пользователя
//         const [existingUser] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
//         if (existingUser) {
//             context.response.status = 409;
//             context.response.body = { error: "Пользователь уже существует." };
//             return;
//         }
//
//         // Хеширование пароля
//         const passwordHash = await bcrypt.hash(password);
//
//         // Вставка пользователя в базу данных
//         await db.execute("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)", [
//             username,
//             email,
//             passwordHash,
//         ]);
//
//         context.response.status = 201;
//         context.response.body = { message: "Регистрация успешна!" };
//     } catch (error) {
//         console.error(error);
//         context.response.status = 500;
//         context.response.body = { error: "Ошибка сервера." };
//     }
// });
//
// // Авторизация пользователя
// router.post("/login", async (context) => {
//     try {
//         const { email, password } = await context.request.body({ type: "json" }).value;
//
//         // Поиск пользователя
//         const [user] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
//         if (!user) {
//             context.response.status = 401;
//             context.response.body = { error: "Неверный email или пароль." };
//             return;
//         }
//
//         // Проверка пароля
//         const validPassword = await bcrypt.compare(password, user.password_hash);
//         if (!validPassword) {
//             context.response.status = 401;
//             context.response.body = { error: "Неверный email или пароль." };
//             return;
//         }
//
//         // Успешный вход
//         context.response.status = 200;
//         context.response.body = { message: "Авторизация успешна!" };
//     } catch (error) {
//         console.error(error);
//         context.response.status = 500;
//         context.response.body = { error: "Ошибка сервера." };
//     }
// });
//
// // Подключение маршрутов
// app.use(router.routes());
// app.use(router.allowedMethods());
//
// console.log("Сервер запущен на http://localhost:8000");
// await app.listen({ port: 8000 });
