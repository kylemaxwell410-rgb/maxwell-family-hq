// Open-Meteo client (no API key, CORS allowed).
// Edit DEFAULT_LOCATION below or override at runtime via localStorage 'maxwell_location'
// stored as JSON: { latitude, longitude, timezone, label }.
const DEFAULT_LOCATION = {
  latitude: 28.0395,
  longitude: -81.9498,
  timezone: 'America/New_York',
  label: 'Lakeland, FL',
};

export function getLocation() {
  try {
    const raw = localStorage.getItem('maxwell_location');
    if (raw) return { ...DEFAULT_LOCATION, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_LOCATION;
}

export function setLocation(loc) {
  localStorage.setItem('maxwell_location', JSON.stringify(loc));
}

export async function fetchWeather() {
  const loc = getLocation();
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', loc.latitude);
  url.searchParams.set('longitude', loc.longitude);
  url.searchParams.set('current', 'temperature_2m,weather_code,is_day,wind_speed_10m');
  url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset');
  url.searchParams.set('temperature_unit', 'fahrenheit');
  url.searchParams.set('wind_speed_unit', 'mph');
  url.searchParams.set('timezone', loc.timezone);
  url.searchParams.set('forecast_days', '1');
  const res = await fetch(url);
  if (!res.ok) throw new Error('Weather fetch failed');
  const data = await res.json();
  return {
    location: loc,
    current: {
      tempF: Math.round(data.current.temperature_2m),
      code: data.current.weather_code,
      isDay: !!data.current.is_day,
      windMph: Math.round(data.current.wind_speed_10m),
    },
    today: {
      highF: Math.round(data.daily.temperature_2m_max[0]),
      lowF:  Math.round(data.daily.temperature_2m_min[0]),
      precipPct: data.daily.precipitation_probability_max?.[0] ?? null,
      code: data.daily.weather_code[0],
      sunrise: data.daily.sunrise?.[0],
      sunset:  data.daily.sunset?.[0],
    },
  };
}

// Open-Meteo WMO weather code → human label + emoji + isWet (rain/snow/storm).
const CODE_MAP = {
  0:  { label: 'Clear',           emoji: '☀️', wet: false },
  1:  { label: 'Mostly clear',    emoji: '🌤️', wet: false },
  2:  { label: 'Partly cloudy',   emoji: '⛅️', wet: false },
  3:  { label: 'Overcast',        emoji: '☁️', wet: false },
  45: { label: 'Fog',              emoji: '🌫️', wet: false },
  48: { label: 'Freezing fog',     emoji: '🌫️', wet: false },
  51: { label: 'Light drizzle',    emoji: '🌦️', wet: true  },
  53: { label: 'Drizzle',          emoji: '🌦️', wet: true  },
  55: { label: 'Heavy drizzle',    emoji: '🌧️', wet: true  },
  61: { label: 'Light rain',       emoji: '🌦️', wet: true  },
  63: { label: 'Rain',             emoji: '🌧️', wet: true  },
  65: { label: 'Heavy rain',       emoji: '🌧️', wet: true  },
  71: { label: 'Light snow',       emoji: '🌨️', wet: true  },
  73: { label: 'Snow',             emoji: '❄️', wet: true  },
  75: { label: 'Heavy snow',       emoji: '❄️', wet: true  },
  80: { label: 'Rain showers',     emoji: '🌦️', wet: true  },
  81: { label: 'Rain showers',     emoji: '🌧️', wet: true  },
  82: { label: 'Heavy showers',    emoji: '⛈️', wet: true  },
  95: { label: 'Thunderstorms',    emoji: '⛈️', wet: true  },
  96: { label: 'Thunderstorm hail',emoji: '⛈️', wet: true  },
  99: { label: 'Severe storms',    emoji: '⛈️', wet: true  },
};

export function describeCode(code) {
  return CODE_MAP[code] || { label: 'Unknown', emoji: '·', wet: false };
}

export function isWetForecast(weather) {
  if (!weather) return false;
  const c = describeCode(weather.today.code);
  if (c.wet) return true;
  if ((weather.today.precipPct ?? 0) >= 50) return true;
  return false;
}
