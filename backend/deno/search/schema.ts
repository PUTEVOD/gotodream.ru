import { z } from "npm:zod@3.23.8";

/**
 * Схема запроса POST /api/search.
 * Повторяет ограничения frontend/src/features/search/contract.js.
 * Дублирование намеренное: клиентская валидация — это UX, серверная — контракт.
 * Данные из браузера считаются враждебными по умолчанию.
 */

export const TRIP_TYPES = ["oneWay", "roundTrip", "complex"] as const;
export const CABIN_CLASSES = ["economy", "comfort", "business"] as const;
export const SORT_TYPES = ["cheapest", "fastest", "convenient"] as const;

export const LIMITS = {
  MAX_SEGMENTS: 6,
  MAX_SEATS: 9,
  MAX_DAYS_AHEAD: 361,
};

const iataCode = z.string().trim().regex(/^[A-Z]{3}$/, "Ожидается IATA-код из трёх заглавных букв");

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ожидается дата в формате ГГГГ-ММ-ДД")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Несуществующая дата");

const timeRange = z.object({
  lower: z.number().int().min(0).max(1440),
  upper: z.number().int().min(0).max(1440),
}).refine((r) => r.lower <= r.upper, { message: "Нижняя граница больше верхней" });

const durationRange = z.object({
  lower: z.number().int().min(0).max(2880),
  upper: z.number().int().min(0).max(2880),
}).refine((r) => r.lower <= r.upper, { message: "Нижняя граница больше верхней" });

const segment = z.object({
  origin: iataCode,
  destination: iataCode,
  departureDate: isoDate,
}).refine((s) => s.origin !== s.destination, {
  message: "Пункт вылета и пункт назначения совпадают",
  path: ["destination"],
});

const passengers = z.object({
  adults: z.number().int().min(1).max(9),
  teens: z.number().int().min(0).max(9),
  children: z.number().int().min(0).max(9),
  infants: z.number().int().min(0).max(9),
});

const filters = z.object({
  departureRange: timeRange.optional(),
  arrivalRange: timeRange.optional(),
  durationRange: durationRange.optional(),
  stops: z.array(z.number().int().min(0).max(3)).max(4).optional(),
  sortType: z.enum(SORT_TYPES).default("cheapest"),
  cabinClasses: z.array(z.enum(CABIN_CLASSES)).max(3).optional(),
  airlines: z.array(z.string().min(1).max(64)).max(20).optional(),
}).default({ sortType: "cheapest" });

export const searchRequestSchema = z.object({
  tripType: z.enum(TRIP_TYPES),
  cabinClass: z.enum(CABIN_CLASSES),
  itinerary: z.array(segment).min(1).max(LIMITS.MAX_SEGMENTS + 1),
  passengers,
  currency: z.string().length(3).default("RUB"),
  locale: z.string().max(10).default("ru-RU"),
  filters,
})
  .superRefine((data, ctx) => {
    const seats = data.passengers.adults + data.passengers.teens + data.passengers.children;
    if (seats > LIMITS.MAX_SEATS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["passengers"],
        message: `Не более ${LIMITS.MAX_SEATS} пассажиров с местом`,
      });
    }
    if (data.passengers.infants > data.passengers.adults) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["passengers", "infants"],
        message: "Младенцев не может быть больше, чем взрослых",
      });
    }

    // Границы дат считаем по UTC: сервер не должен зависеть от таймзоны клиента.
    const today = new Date().toISOString().slice(0, 10);
    const maxDate = new Date(Date.now() + LIMITS.MAX_DAYS_AHEAD * 86_400_000).toISOString().slice(0, 10);

    data.itinerary.forEach((s, index) => {
      if (s.departureDate < today) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["itinerary", index, "departureDate"],
          message: "Дата в прошлом",
        });
      }
      if (s.departureDate > maxDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["itinerary", index, "departureDate"],
          message: "Дата за пределами глубины продажи",
        });
      }
      if (index > 0 && s.departureDate < data.itinerary[index - 1].departureDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["itinerary", index, "departureDate"],
          message: "Дата раньше предыдущего перелёта",
        });
      }
    });

    if (data.tripType === "oneWay" && data.itinerary.length !== 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["itinerary"], message: "Для перелёта в одну сторону нужен один сегмент" });
    }
    if (data.tripType === "roundTrip" && data.itinerary.length !== 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["itinerary"], message: "Для перелёта туда-обратно нужны два сегмента" });
    }
    if (data.tripType === "roundTrip" && data.itinerary.length === 2) {
      const [out, back] = data.itinerary;
      if (out.origin !== back.destination || out.destination !== back.origin) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["itinerary", 1], message: "Обратный сегмент не соответствует прямому" });
      }
    }
  });

export type SearchRequest = z.infer<typeof searchRequestSchema>;
