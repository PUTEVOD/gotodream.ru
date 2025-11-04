import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { serveDir } from "https://deno.land/std@0.192.0/http/file_server.ts";
import { fromFileUrl } from "https://deno.land/std@0.192.0/path/mod.ts";

// Корректный путь для Windows
const FRONTEND_PATH = fromFileUrl(new URL("../../frontend/build", import.meta.url));

const S7_API_URL = 'https://api.s7.ru/v0.52/shopping';
const S7_TOKEN = Deno.env.get('S7_API_TOKEN');


interface Itinerary {
  id?: string;
  origin: string;
  destination: string;
  departureDate: string;
  price?: { total: number };
  departureTime?: string;
  arrivalTime?: string;
  duration?: string;
  airline?: string;
}

serve(async (req) => {
  const url = new URL(req.url);

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  // Отдача фронтенда
  if (url.pathname.startsWith("/static") || url.pathname === "/") {
    return serveDir(req, { fsRoot: FRONTEND_PATH, urlRoot: "" });
  }

  // API /api/search
  if (url.pathname === "/api/search" && req.method === "POST") {
    try {
      const body = await req.json();
      console.log("=== Получен запрос на поиск ===");
      console.log("Маршрут:", body.itinerary);
      console.log("Пассажиры:", body.passengers);
      console.log("Класс:", body.cabinClass);
      console.log("Тип поездки:", body.tripType);
      console.log("Фильтры:", body.filters);
      // Тестовый режим

      interface ItinerarySegment {
        origin: string;
        destination: string;
        departureDate: string;
      }

      interface SearchRequest {
        itinerary: ItinerarySegment[];
        passengers: {
          adults: number;
          teens: number;
          children: number;
          infants: number;
          youth?: number;
          seniors?: number;
          largeFamily?: number;
          disabled?: number;
          disabledChild?: number;
          companion?: number;
        };
        cabinClass: string;
        tripType: string;
        filters?: {
          departureRange: { lower: number; upper: number };
          arrivalRange: { lower: number; upper: number };
          durationRange: { lower: number; upper: number };
          stops: number[];
          sortType: string;
          selectedClasses: string[];
          selectedAirlines: string[];
        };
      }

      if (!body.itinerary || !Array.isArray(body.itinerary)) {
        console.error("Invalid itinerary data:", body.itinerary);
        return new Response(JSON.stringify({ error: 'Invalid itinerary data' }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      // Форматируем тестовые данные в соответствии с ожидаемой структурой
      const searchBody = body as SearchRequest;
      const mockFlights = searchBody.itinerary.map((segment: ItinerarySegment, index: number) => ({
        id: `TEST${index + 1}`.padStart(3, '0'),
        from: segment.origin || "DME",
        to: segment.destination || "CDG",
        date: segment.departureDate || "2025-11-10",
        price: Math.floor(Math.random() * 10000) + 5000,
        departureTime: `${segment.departureDate || "2025-11-10"}T08:00:00`,
        arrivalTime: `${segment.departureDate || "2025-11-10"}T12:00:00`,
        duration: "4h 00m",
        airline: "S7 Airlines",
        stops: 0
      }));

      return new Response(JSON.stringify({
        flights: mockFlights,
        searchParams: body
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        },
      });

      // --- Реальная логика S7 (закомментирована) ---
      /*
      const s7Request = {
        itinerary: body.itinerary,
        passengers: body.passengers,
        cabinClass: body.cabinClass,
        directOnly: body.directOnly,
      };

      const s7Response = await fetch(S7_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${S7_TOKEN}`
        },
        body: JSON.stringify(s7Request)
      });

      if (!s7Response.ok) throw new Error(`S7 API error: ${s7Response.status}`);

      const s7Data: any = await s7Response.json();

      const formattedFlights = s7Data.itineraries?.map((itin: Itinerary) => ({
        id: itin.id || Math.random().toString(),
        from: itin.origin,
        to: itin.destination,
        date: itin.departureDate,
        price: itin.price?.total,
        departureTime: itin.departureTime,
        arrivalTime: itin.arrivalTime,
        duration: itin.duration,
        airline: itin.airline || 'S7 Airlines'
      })) || [];

      return new Response(JSON.stringify({ flights: formattedFlights }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        },
      });
      */
    } catch (error) {
      console.error("Ошибка обработки /api/search:", error);
      return new Response(JSON.stringify({ error: 'Search failed' }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
  }

  return new Response("Not Found", { status: 404 });
}, { port: 8000 });

console.log("Server is running on http://localhost:8000");
