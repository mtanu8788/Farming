const express = require('express');
const axios = require('axios');

const router = express.Router();

router.get('/forecast', async (req, res) => {
  try {
    const city = String(req.query.city || 'Pune').trim();
    const apiKey = process.env.OPENWEATHER_API_KEY;

    if (!city) {
      return res.status(400).json({ error: 'City name is required' });
    }

    if (!apiKey) {
      return res.status(503).json({
        error: 'OpenWeather API key not configured',
        message: 'Add OPENWEATHER_API_KEY to backend/.env before using weather forecasts.',
      });
    }

    const params = { q: city, appid: apiKey, units: 'metric' };
    const [currentResponse, forecastResponse] = await Promise.all([
      axios.get('https://api.openweathermap.org/data/2.5/weather', { params, timeout: 10000 }),
      axios.get('https://api.openweathermap.org/data/2.5/forecast', { params, timeout: 10000 }),
    ]);

    const currentData = currentResponse.data;
    const forecastData = forecastResponse.data;

    const current = {
      temperature: Math.round(currentData.main.temp),
      humidity: currentData.main.humidity,
      description: currentData.weather?.[0]?.description || 'Unknown',
      wind_speed: currentData.wind?.speed ?? 0,
      rain_probability: currentData.rain ? 100 : 0,
    };

    const grouped = new Map();
    for (const item of forecastData.list || []) {
      const date = new Date(item.dt * 1000);
      const dateKey = date.toISOString().slice(0, 10);
      if (!grouped.has(dateKey)) grouped.set(dateKey, []);
      grouped.get(dateKey).push(item);
    }

    const dailyForecasts = Array.from(grouped.values()).slice(0, 5).map((items) => {
      const noonItem = items.reduce((best, item) => {
        const bestDistance = Math.abs(new Date(best.dt * 1000).getUTCHours() - 12);
        const distance = Math.abs(new Date(item.dt * 1000).getUTCHours() - 12);
        return distance < bestDistance ? item : best;
      }, items[0]);
      const date = new Date(noonItem.dt * 1000);

      return {
        day: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        temp_max: Math.round(Math.max(...items.map((item) => item.main.temp_max))),
        temp_min: Math.round(Math.min(...items.map((item) => item.main.temp_min))),
        humidity: Math.round(items.reduce((sum, item) => sum + item.main.humidity, 0) / items.length),
        description: noonItem.weather?.[0]?.description || 'Unknown',
        rain_probability: Math.round(
          (items.reduce((sum, item) => sum + (item.pop || 0), 0) / items.length) * 100
        ),
      };
    });

    return res.json({ city: currentData.name || city, current, forecast: dailyForecasts });
  } catch (error) {
    console.error('Weather forecast error:', error.message);

    if (error.response?.status === 401) {
      return res.status(401).json({ error: 'Invalid OpenWeather API key' });
    }

    if (error.response?.status === 404) {
      return res.status(404).json({ error: 'City not found', message: 'Please check the city name and try again.' });
    }

    if (error.code === 'ETIMEDOUT') {
      return res.status(504).json({ error: 'Weather service timed out. Please try again.' });
    }

    return res.status(502).json({
      error: 'Failed to fetch weather data',
      message: error.response?.data?.message || error.message,
    });
  }
});

module.exports = router;
