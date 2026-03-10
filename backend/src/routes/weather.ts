import { FastifyInstance } from "fastify";
import { prisma } from "../db.js";

const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";

export async function weatherRoutes(app: FastifyInstance) {
  app.get("/api/weather", async () => {
    const citySetting = await prisma.setting.findUnique({ where: { key: "user_city" } });
    const city = citySetting?.value;
    if (!city) return { configured: false };

    try {
      // Geocode city name to coordinates
      const geoRes = await fetch(`${GEOCODE_URL}?name=${encodeURIComponent(city)}&count=1&language=en`);
      const geoData = await geoRes.json() as any;
      if (!geoData.results?.length) return { configured: true, error: "City not found" };

      const { latitude, longitude, name, country } = geoData.results[0];

      // Get current weather
      const tzSetting = await prisma.setting.findUnique({ where: { key: "user_timezone" } });
      const tz = tzSetting?.value || "auto";

      const wxRes = await fetch(
        `${WEATHER_URL}?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=${encodeURIComponent(tz)}&forecast_days=3`
      );
      const wx = await wxRes.json() as any;

      const weatherCodes: Record<number, string> = {
        0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast",
        45: "Foggy", 48: "Icy fog", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
        61: "Light rain", 63: "Rain", 65: "Heavy rain", 71: "Light snow", 73: "Snow", 75: "Heavy snow",
        80: "Rain showers", 81: "Heavy showers", 82: "Violent showers",
        95: "Thunderstorm", 96: "Hail thunderstorm",
      };

      return {
        configured: true,
        city: name,
        country,
        current: {
          temp: Math.round(wx.current?.temperature_2m),
          humidity: wx.current?.relative_humidity_2m,
          wind: Math.round(wx.current?.wind_speed_10m),
          condition: weatherCodes[wx.current?.weather_code] || "Unknown",
          unit: "°C",
        },
        forecast: wx.daily?.time?.map((d: string, i: number) => ({
          date: d,
          high: Math.round(wx.daily.temperature_2m_max[i]),
          low: Math.round(wx.daily.temperature_2m_min[i]),
          condition: weatherCodes[wx.daily.weather_code[i]] || "Unknown",
        })) || [],
      };
    } catch (e: any) {
      return { configured: true, error: e.message };
    }
  });
}
