
import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";



import { useState, useEffect } from "react";
import axios from "axios";
import debounce from "lodash.debounce";
import AnimatedWeatherIcon from "react-animated-weather";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
} from "recharts";
import "./index.css";
import { useCallback } from "react";

const weatherApiKey = import.meta.env.VITE_WEATHER_API_KEY;
const NEWS_API_KEY = import.meta.env.VITE_NEWS_API_KEY;

const App = () => {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [hourly, setHourly] = useState([]);
  const [airQuality, setAirQuality] = useState(null);
  const [unit, setUnit] = useState("metric");
  const [windData, setWindData] = useState([]);
  const [uvData, setUvData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeChart, setActiveChart] = useState("windSpeed")
  const tabs = [
     { key: "hourlyForecast", label: "Hourly Forecast" },
  { key: "windSpeed", label: "Wind Speed" },
  { key: "windGusts", label: "Gusts" },
  { key: "windDir", label: "Direction" },
  { key: "uv", label: "UV Index" },
  { key: "precip", label: "Precipitation" },
  { key: "visibility", label: "Visibility" },
  { key: "pressure", label: "Pressure" },
  { key: "clouds", label: "Clouds" },
  { key: "temp", label: "Temp Min/Max" },
   
];


const [summary, setSummary] = useState("");
const [newsArticles, setNewsArticles] = useState([]);

const [pmData, setPmData] = useState([]);
const [mapLayer, setMapLayer] = useState("clouds_new");






useEffect(() => {
  const timeoutId = setTimeout(() => {
    console.warn("Geolocation took too long. Falling back to default.");
    fetchWeatherByCoords(51.5074, -0.1278); // fallback
  }, 16000);

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timeoutId);
        fetchWeatherByCoords(position.coords.latitude, position.coords.longitude);
      },
      (error) => {
        clearTimeout(timeoutId);
        console.error("Geolocation error:", error.message);
        fetchWeatherByCoords(51.5074, -0.1278); // fallback
      },
      {
        timeout: 15000,
        enableHighAccuracy: true,
        maximumAge: 0
      }
    );
  } else {
    console.error("Geolocation not supported.");
    clearTimeout(timeoutId);
    fetchWeatherByCoords(51.5074, -0.1278);
  }
}, []);




useEffect(() => {
  if (weather) {
    fetchForecast(weather.coord.lat, weather.coord.lon);
    fetchAirQuality(weather.coord.lat, weather.coord.lon);
  }
}, [unit]);

useEffect(() => {
  if (forecast.length > 0) {
    const today = forecast[0];

    const temp = Math.round(today.main.temp);
    const condition = today.weather[0].description;
    const wind = Math.round(today.wind.speed);
    const gust = Math.round(today.wind.gust || 0);
    const pop = Math.round((today.pop || 0) * 100);

    let s = `Today will be ${condition} with a temperature of around ${temp}${tempSymbol}. `;

    if (wind >= 15) {
      s += `Winds at ${wind} km/h`;
      if (gust > wind) s += `, gusting to ${gust} km/h`;
      s += `. `;
    } else {
      s += `Light winds around ${wind} km/h. `;
    }

    if (pop > 40) {
      s += `Chance of rain is ${pop}%.`;
    }

    setSummary(s);
  }
}, [forecast]);


useEffect(() => {
  const fetchNews = async () => {
    try {
      const res = await fetch(
        `https://newsapi.org/v2/everything?q=weather&language=en&pageSize=5&sortBy=publishedAt&apiKey=${import.meta.env.VITE_NEWS_API_KEY}`
      );
      const data = await res.json();
      if (data.articles) setNewsArticles(data.articles);
    } catch (err) {
      console.error("Failed to fetch weather news:", err);
    }
  };

  fetchNews();
}, []);




const fetchForecast = async (lat, lon) => {
  try {
    const res = await axios.get(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${weatherApiKey}&units=${unit}`
    );
    const daily = res.data.list.filter((item) =>
      item.dt_txt.includes("12:00:00")
    ).slice(0, 6);
    setForecast(daily);
    const hourlyData = res.data.list.slice(0, 8);
    setHourly(hourlyData);

    // Map to wind chart data (next 12 hours)
    const windPoints = res.data.list.slice(0, 12).map((hour) => ({
      time: new Date(hour.dt_txt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      speed: hour.wind.speed,
    }));
    setWindData(windPoints);

  } catch (err) {
    console.error("Forecast error:", err);
  }
};


const getAQIDescription = (index) => {
  switch (index) {
    case 1:
      return { label: "Good", color: "bg-green-500" };
    case 2:
      return { label: "Fair", color: "bg-yellow-400" };
    case 3:
      return { label: "Moderate", color: "bg-orange-400" };
    case 4:
      return { label: "Poor", color: "bg-red-500" };
    case 5:
      return { label: "Very Poor", color: "bg-purple-700" };
    default:
      return { label: "Unknown", color: "bg-gray-500" };
  }
};


const fetchAirQuality = async (lat, lon) => {
  try {
    const res = await axios.get(
      `https://api.openweathermap.org/data/2.5/air_pollution/forecast?lat=${lat}&lon=${lon}&appid=${weatherApiKey}`
    );
    const currentData = res.data.list.slice(0, 12).map((entry) => ({
      time: new Date(entry.dt * 1000).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      uvi: entry.main.aqi * 2, // approximate UV index scale (since UVI is not directly provided)
    }));
    setUvData(currentData);
    const aqiRaw = res.data.list[0];
setAirQuality({
  index: aqiRaw.main.aqi,
  components: aqiRaw.components,
  time: aqiRaw.dt,
});
const pmSeries = res.data.list.slice(0, 12).map((entry) => ({
  time: new Date(entry.dt * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  }),
  pm25: entry.components.pm2_5,
  pm10: entry.components.pm10,
}));
setPmData(pmSeries);


  } catch (err) {
    console.error("Air quality error:", err);
  }
};

const fetchWeatherByCoords = async (lat, lon) => {
  try {
    setLoading(true);
    const res = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${weatherApiKey}&units=${unit}`
    );
    setWeather(res.data);
    fetchForecast(lat, lon);
    fetchAirQuality(lat, lon);
  } catch (err) {
    console.error("Weather error:", err);
  } finally {
    setLoading(false);
  }
};

const handleInputChange = useCallback(
  debounce(async (val) => {
  if (val.length < 2) return setSuggestions([]);
  try {
    const res = await axios.get(
      `https://api.openweathermap.org/geo/1.0/direct?q=${val}&limit=5&appid=${weatherApiKey}`
    );
    setSuggestions(res.data);
  } catch (err) {
    console.error("Suggestion error:", err);
  }
}, 500),
  []
);
useEffect(() => {
  return () => {
    handleInputChange.cancel();
  };
}, [handleInputChange]);  
const handleSelectCity = (city) => {
  setQuery(`${city.name}, ${city.country}`);
  setSuggestions([]);
  fetchWeatherByCoords(city.lat, city.lon);
};


  const getBackgroundClass = (condition) => {
    switch (condition) {
      case "Rain":
      case "Drizzle":
        return "from-[#3a3d40] via-[#181719] to-[#0f0f0f]";
      case "Thunderstorm":
        return "from-[#1f1c2c] via-[#928dab] to-[#1f1c2c]";
      case "Snow":
        return "from-[#dfe9f3] via-[#e2ebf0] to-[#cfd9df]";
      case "Clear":
        return "from-[#2980b9] via-[#6dd5fa] to-[#d0eaff]";
      case "Clouds":
        return "from-[#757f9a] via-[#909da7] to-[#b3b9c5]";
      case "Mist":
      case "Haze":
      case "Fog":
        return "from-[#434343] via-[#5b5b5b] to-[#2b5876]";
      default:
        return "from-[#0f2027] via-[#203a43] to-[#2c5364]";
    }
  };

const formatTime = (timestamp, offset) => {
  const localTime = new Date((timestamp + offset) * 1000);
  return localTime.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
};










const hourlyPrecipData = hourly.map((item) => ({
  time: new Date(item.dt_txt).toLocaleTimeString([], {
    hour: "numeric",
    hour12: true,
  }),
  pop: Math.round(item.pop * 100), // convert to percentage
}));

const hourlyVisibilityData = hourly.map((item) => ({
  time: new Date(item.dt_txt).toLocaleTimeString([], {
    hour: "numeric",
    hour12: true,
  }),
  visibility: item.visibility / 1000, // convert to km
}));

const hourlyPressureData = hourly.map((item) => ({
  time: new Date(item.dt_txt).toLocaleTimeString([], {
    hour: "numeric",
    hour12: true,
  }),
  pressure: item.main.pressure,
}));

const hourlyWindGustData = hourly.map((item) => ({
  time: new Date(item.dt_txt).toLocaleTimeString([], {
    hour: "numeric",
    hour12: true,
  }),
  gust: item.wind.gust ?? item.wind.speed, // fallback to speed
}));

const hourlyCloudData = hourly.map((item) => ({
  time: new Date(item.dt_txt).toLocaleTimeString([], {
    hour: "numeric",
    hour12: true,
  }),
  clouds: item.clouds.all, // percentage
}));


// Dew Point
const hourlyDewData = hourly.map((item) => ({
  time: new Date(item.dt_txt).toLocaleTimeString([], {
    hour: "numeric",
    hour12: true,
  }),
  dew: item.main.temp - ((100 - item.main.humidity) / 5), // approximate dew point
}));



// Wind Gusts
const hourlyGustData = hourly.map((item) => ({
  time: new Date(item.dt_txt).toLocaleTimeString([], {
    hour: "numeric",
    hour12: true,
  }),
  gust: item.wind.gust || 0, // gust speed
}));

// Wind Direction
const hourlyWindDirData = hourly.map((item) => ({
  time: new Date(item.dt_txt).toLocaleTimeString([], {
    hour: "numeric",
    hour12: true,
  }),
  direction: item.wind.deg,
}));

// Min/Max Temperatures (same as temp chart, just shown as area/band)
const hourlyMinMaxData = hourly.map((item) => ({
  time: new Date(item.dt_txt).toLocaleTimeString([], {
    hour: "numeric",
    hour12: true,
  }),
  min: item.main.temp_min,
  max: item.main.temp_max,
}));




















  const mapToAnimatedIcon = (main, icon) => {
    const isDay = icon.includes("d");
    switch (main) {
      case "Clear":
        return isDay ? "CLEAR_DAY" : "CLEAR_NIGHT";
      case "Clouds":
        return isDay ? "PARTLY_CLOUDY_DAY" : "PARTLY_CLOUDY_NIGHT";
      case "Rain":
        return "RAIN";
      case "Snow":
        return "SNOW";
      case "Thunderstorm":
        return "SLEET";
      case "Drizzle":
        return "RAIN";
      case "Mist":
      case "Fog":
      case "Haze":
        return "FOG";
      default:
        return "CLOUDY";
    }
  };

  const backgroundClass = weather ? getBackgroundClass(weather.weather[0].main) : "from-[#0f2027] via-[#203a43] to-[#2c5364]";
  const tempSymbol = unit === "metric" ? "°C" : "°F";


  

const LoadingScreen = () => (
  <motion.div
    className="flex h-screen w-screen flex-col items-center justify-center bg-gradient-to-br from-[#0f2027] via-[#203a43] to-[#2c5364] text-white"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.6 }}
  >
    <AnimatedWeatherIcon
      icon="PARTLY_CLOUDY_DAY"
      color="white"
      size={96}
      animate={true}
    />
    <div className="mt-6 text-xl font-semibold animate-pulse">Fetching weather data...</div>
  </motion.div>
);
if (loading) return <LoadingScreen />;


return (

    <div className={`min-h-screen relative bg-gradient-to-br ${backgroundClass} text-white flex flex-col items-center p-6`}>
      <div className="absolute inset-0 bg-stars z-0" />
      <div className="w-full max-w-2xl z-10">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            handleInputChange(e.target.value);
          }}
          placeholder="Search city..."
          className="w-full p-4 text-lg rounded-xl bg-white/10 backdrop-blur-md text-white placeholder-gray-300 outline-none border border-white/20"
        />
        {!weather && (
  <div className="text-center text-gray-300 mt-8">
    Please search a city or allow location access to see weather data.
  </div>
)}

        {suggestions.length > 0 && (
          <div className="bg-white/10 mt-2 rounded-xl backdrop-blur-md shadow-md">
{suggestions.map((city) => (
  <div
    key={`${city.name}-${city.lat}-${city.lon}-${city.country}`}
    className="p-2 hover:bg-white/20 hover:text-white text-gray-200 cursor-pointer"
    onClick={() => handleSelectCity(city)}
  >
    {city.name}, {city.country}
  </div>
))}

          </div>
        )}

        <div className="flex gap-4 justify-center mt-4">
          <button onClick={() => setUnit("metric")} className={`px-4 py-2 rounded-xl ${unit === "metric" ? "bg-white/20 font-semibold" : "bg-white/10"}`}>°C</button>
          <button onClick={() => setUnit("imperial")} className={`px-4 py-2 rounded-xl ${unit === "imperial" ? "bg-white/20 font-semibold" : "bg-white/10"}`}>°F</button>
        </div>

        <AnimatePresence mode="wait">
          {weather && (
            <motion.div
              key={weather.name + unit}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5 }}
              className="mt-8 glassmorphism p-6 rounded-2xl w-full max-w-2xl text-center shadow-lg"
            >
              <h2 className="text-2xl font-semibold">{weather.name}</h2>
              <div className="flex justify-center">
              <AnimatedWeatherIcon
                icon={mapToAnimatedIcon(weather.weather[0].main, weather.weather[0].icon)}
                color="white"
                size={64}
                animate={true}
              />
            </div>
              <p className="text-4xl font-bold">
  {weather?.main?.temp ? `${Math.round(weather.main.temp)}${tempSymbol}` : "--"}
</p>
              <p className="capitalize text-gray-300 mb-2">{weather.weather[0].description}</p>
              <div className="grid grid-cols-2 gap-4 text-sm text-gray-300 mt-4">
                <div><span className="font-semibold text-white">Feels like:</span> {Math.round(weather.main.feels_like)}{tempSymbol}</div>
                <div><span className="font-semibold text-white">Humidity:</span> {weather.main.humidity}%</div>
                <div><span className="font-semibold text-white">Wind:</span> {weather.wind.speed} {unit === "metric" ? "m/s" : "mph"}</div>
                <div><span className="font-semibold text-white">Pressure:</span> {weather.main.pressure} hPa</div>
                <div><span className="font-semibold text-white">Sunrise:</span> {formatTime(weather.sys.sunrise, weather.timezone)}</div>
                <div><span className="font-semibold text-white">Sunset:</span> {formatTime(weather.sys.sunset, weather.timezone)}</div>
              </div>

              {airQuality && (
                <div className="mt-4 text-sm text-gray-300">
<h3 className="text-white font-semibold mb-1">Air Quality Index: {airQuality.index}</h3>
<p>
  PM2.5: {airQuality.components.pm2_5} µg/m³, 
  PM10: {airQuality.components.pm10} µg/m³, 
  CO: {airQuality.components.co} µg/m³
</p>

                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>



















<h3 className="text-lg font-semibold text-white mt-8 mb-2 text-center">🕒 Upcoming Hours</h3>

        {/* Hourly Cards */}
        {hourly.length > 0 && (
          <div className="mt-6 grid grid-cols-4 gap-4 text-center text-sm text-white">
            {hourly.map((hour) => (
              <div key={hour.dt} className="glassmorphism p-4 rounded-xl text-center transform transition duration-300 hover:scale-105 hover:shadow-lg"
>
               <p>{new Date(hour.dt_txt).toLocaleTimeString("en-US", { hour: "numeric", hour12: true })}</p>

                              <div className="flex justify-center">
                <AnimatedWeatherIcon
                  icon={mapToAnimatedIcon(hour.weather[0].main, hour.weather[0].icon)}
                  color="white"
                  size={36}
                  animate={true}
                />
              </div>
                <p>{Math.round(hour.main.temp)}{tempSymbol}</p>
              </div>
            ))}
          </div>
        )}
        <h3 className="text-lg font-semibold text-white mt-10 mb-2 text-center">📅 5-Day Forecast</h3>


        {/* 5-Day Forecast */}
        {forecast.length > 0 && (
          <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4 text-center text-sm text-white">
            {forecast.map((day) => (
              <div key={day.dt} className="glassmorphism p-4 rounded-xl text-center transform transition duration-300 hover:scale-105 hover:shadow-lg"
>
                <p className="font-semibold">{new Date(day.dt_txt).toLocaleDateString(undefined, { weekday: "short" })}</p>
                              <div className="flex justify-center">
                <AnimatedWeatherIcon
                  icon={mapToAnimatedIcon(day.weather[0].main, day.weather[0].icon)}
                  color="white"
                  size={48}
                  animate={true}
                />
              </div>
                <p className="mt-2 text-lg font-bold">{Math.round(day.main.temp)}{tempSymbol}</p>
                <p className="capitalize text-gray-300">{day.weather[0].description}</p>
              </div>
            ))}
          </div>
        )}

















 {/* Chart tabs */}

<div className="pt-10 flex justify-center flex-wrap gap-2 mb-4">
  {tabs.map((tab) => (
    <button
      key={tab.key}
      onClick={() => setActiveChart(tab.key)}
      className={`px-4 py-2 mx-1 rounded-xl border border-white/20 backdrop-blur-md bg-white/10 text-white hover:bg-white/20 transition-all duration-200 ${
        activeChart === tab.key ? "border-white/40 bg-white/20 shadow-md" : ""
      }`}

    >
      {tab.label}
    </button>
  ))}
</div>





 {/* Chart Display */}
  <div className="rounded-lg pb-10">




{activeChart === "hourlyForecast" && hourly.length > 0 && (
  <div className="w-full h-64">
    <h3 className="text-lg font-semibold text-white mb-2 text-center">🌡 Hourly Forecast</h3>
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={hourly.map((item) => ({
          time: new Date(item.dt_txt).toLocaleTimeString("en-US", {
            hour: "numeric",
            hour12: true,
          }),
          temp: item.main.temp,
        }))}
        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
      >
        <XAxis dataKey="time" stroke="#ccc" />
        <YAxis stroke="#ccc" />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1f2937",
            border: "none",
            borderRadius: "8px",
            color: "white",
            fontSize: "14px",
          }}
          labelStyle={{ color: "#9ca3af" }}
          formatter={(value) => [`${Math.round(value)}${tempSymbol}`, "Temp"]}
        />
        <Line
          type="monotone"
          dataKey="temp"
          stroke="#60a5fa"
          strokeWidth={3}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  </div>
)}




{activeChart === "windSpeed" && windData.length > 0 && (
  <div className="w-full h-64"> 



        {windData.length > 0 && (
  <div className="mt-10 mb-10 w-full h-64">
    <h3 className="text-lg font-semibold text-white mb-2 text-center">💨 Wind Speed (next 12 hrs)</h3>
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={windData}
        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
      >
        <XAxis dataKey="time" stroke="#ccc" />
        <YAxis unit={unit === "metric" ? " m/s" : " mph"} stroke="#ccc" />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1f2937",
            border: "none",
            borderRadius: "8px",
            color: "white",
            fontSize: "14px",
          }}
          labelStyle={{ color: "#9ca3af" }}
          formatter={(value) => [`${value}`, "Wind"]}
        />
        <Line
          type="monotone"
          dataKey="speed"
          stroke="#34d399"
          strokeWidth={3}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  </div>
)}

        </div>
)}






{activeChart === "windGusts" && hourly.length > 0 && (
  <div className="w-full h-64">
{hourly.length > 0 && (
  <div className="mt-10 mb-10 w-full h-64">
    <h3 className="text-lg font-semibold text-white mb-2 text-center">🌪 Wind Gusts ({unit === "metric" ? "m/s" : "mph"})</h3>
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={hourlyWindGustData}
        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
      >
        <XAxis dataKey="time" stroke="#ccc" />
        <YAxis stroke="#ccc" />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1f2937",
            border: "none",
            borderRadius: "8px",
            color: "white",
            fontSize: "14px",
          }}
          labelStyle={{ color: "#9ca3af" }}
          formatter={(value) => [`${value} ${unit === "metric" ? "m/s" : "mph"}`, "Wind Gust"]}
        />
        <Line
          type="monotone"
          dataKey="gust"
          stroke="#f472b6"
          strokeWidth={3}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  </div>
)}




</div>
)}




{activeChart === "windDir" && hourly.length > 0 && (
  <div className="w-full h-64">
{hourly.length > 0 && (
  <div className="mt-10 w-full h-64">
    <h3 className="text-lg font-semibold text-white mb-2 text-center">🧭 Wind Direction (°)</h3>
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={hourlyWindDirData}>
        <XAxis dataKey="time" stroke="#ccc" />
        <YAxis domain={[0, 360]} stroke="#ccc" />
        <Tooltip
          contentStyle={{ backgroundColor: "#1f2937", borderRadius: "8px", color: "white" }}
          labelStyle={{ color: "#9ca3af" }}
          formatter={(value) => [`${value}°`, "Direction"]}
        />
        <Line type="monotone" dataKey="direction" stroke="#a78bfa" strokeWidth={3} dot={{ r: 2 }} />
      </LineChart>
    </ResponsiveContainer>
  </div>
)}


</div>
)}





{activeChart === "uv" && hourly.length > 0 && (
  <div className="w-full h-64">
{uvData.length > 0 && (
  <div className="mt-10 mb-10 w-full h-64">
    <h3 className="text-lg font-semibold text-white mb-2 text-center">🌞 UV Index (est.)</h3>
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={uvData}
        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
      >
        <XAxis dataKey="time" stroke="#ccc" />
        <YAxis domain={[0, 12]} stroke="#ccc" />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1f2937",
            border: "none",
            borderRadius: "8px",
            color: "white",
            fontSize: "14px",
          }}
          labelStyle={{ color: "#9ca3af" }}
          formatter={(value) => [`${value}`, "UV Index"]}
        />
        <Line
          type="monotone"
          dataKey="uvi"
          stroke="#facc15"
          strokeWidth={3}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  </div>
)}
</div>
)}



{activeChart === "precip" && hourly.length > 0 && (
  <div className="w-full h-64">


{hourly.length > 0 && (
  <div className="mt-10 mb-10 w-full h-64">
    <h3 className="text-lg font-semibold text-white mb-2 text-center">🌧 Precipitation Chance</h3>
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={hourlyPrecipData}
        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
      >
        <XAxis dataKey="time" stroke="#ccc" />
        <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} stroke="#ccc" />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1f2937",
            border: "none",
            borderRadius: "8px",
            color: "white",
            fontSize: "14px",
          }}
          labelStyle={{ color: "#9ca3af" }}
          formatter={(value) => [`${value}%`, "Chance"]}
        />
        <Line
          type="monotone"
          dataKey="pop"
          stroke="#38bdf8"
          strokeWidth={3}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  </div>
)}
</div>
)}



{activeChart === "visibility" && hourly.length > 0 && (
  <div className="w-full h-64">

{hourly.length > 0 && (
  <div className="mt-10 mb-10 w-full h-64">
    <h3 className="text-lg font-semibold text-white mb-2 text-center">🌫 Visibility (km)</h3>
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={hourlyVisibilityData}
        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
      >
        <XAxis dataKey="time" stroke="#ccc" />
        <YAxis tickFormatter={(v) => `${v.toFixed(1)} km`} stroke="#ccc" />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1f2937",
            border: "none",
            borderRadius: "8px",
            color: "white",
            fontSize: "14px",
          }}
          labelStyle={{ color: "#9ca3af" }}
          formatter={(value) => [`${value.toFixed(1)} km`, "Visibility"]}
        />
        <Line
          type="monotone"
          dataKey="visibility"
          stroke="#a78bfa"
          strokeWidth={3}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  </div>
)}

</div>
)}



{activeChart === "pressure" && hourly.length > 0 && (
  <div className="w-full h-64">

{hourly.length > 0 && (
  <div className="mt-10 mb-10 w-full h-64">
    <h3 className="text-lg font-semibold text-white mb-2 text-center">🔼 Pressure (hPa)</h3>
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={hourlyPressureData}
        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
      >
        <XAxis dataKey="time" stroke="#ccc" />
        <YAxis stroke="#ccc" />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1f2937",
            border: "none",
            borderRadius: "8px",
            color: "white",
            fontSize: "14px",
          }}
          labelStyle={{ color: "#9ca3af" }}
          formatter={(value) => [`${value} hPa`, "Pressure"]}
        />
        <Line
          type="monotone"
          dataKey="pressure"
          stroke="#34d399"
          strokeWidth={3}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  </div>
)}

</div>
)}


{activeChart === "clouds" && hourly.length > 0 && (
  <div className="w-full h-64">
{hourly.length > 0 && (
  <div className="mt-10 mb-10 w-full h-64">
    <h3 className="text-lg font-semibold text-white mb-2 text-center">☁️ Cloud Coverage (%)</h3>
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={hourlyCloudData}
        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
      >
        <XAxis dataKey="time" stroke="#ccc" />
        <YAxis stroke="#ccc" domain={[0, 100]} />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1f2937",
            border: "none",
            borderRadius: "8px",
            color: "white",
            fontSize: "14px",
          }}
          labelStyle={{ color: "#9ca3af" }}
          formatter={(value) => [`${value}%`, "Clouds"]}
        />
        <Line
          type="monotone"
          dataKey="clouds"
          stroke="#60a5fa"
          strokeWidth={3}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  </div>
)}


</div>
)}

{activeChart === "temp" && hourly.length > 0 && (
  <div className="w-full h-64">
{hourly.length > 0 && (
  <div className="mt-10 w-full h-64">
    <h3 className="text-lg font-semibold text-white mb-2 text-center">📉 Min / Max Temperature</h3>
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={hourlyMinMaxData}>
        <XAxis dataKey="time" stroke="#ccc" />
        <Tooltip
          contentStyle={{ backgroundColor: "#1f2937", borderRadius: "8px", color: "white" }}
          labelStyle={{ color: "#9ca3af" }}
          formatter={(value, name) => [`${Math.round(value)}${tempSymbol}`, name === "min" ? "Min" : "Max"]}
        />
        <Line type="monotone" dataKey="min" stroke="#f87171" strokeWidth={2} dot={{ r: 2 }} />
        <Line type="monotone" dataKey="max" stroke="#60a5fa" strokeWidth={2} dot={{ r: 2 }} />
      </LineChart>
    </ResponsiveContainer>
  </div>
)}


</div>
)}



</div>
{airQuality && (
  <div className="w-full max-w-2xl mt-6 p-5 rounded-xl bg-white/10 backdrop-blur text-white shadow-lg">
    <h2 className="text-xl font-bold mb-3">Air Quality Index</h2>
    
    <div className="flex items-center gap-3 mb-4">
      <div className={`w-4 h-4 rounded-full ${getAQIDescription(airQuality.index).color}`} />
      <p className="text-sm font-semibold">
        AQI: {airQuality.index} ({getAQIDescription(airQuality.index).label})
      </p>
    </div>

    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
      <div><span className="font-semibold">PM2.5:</span> {airQuality.components.pm2_5} µg/m³</div>
      <div><span className="font-semibold">PM10:</span> {airQuality.components.pm10} µg/m³</div>
      <div><span className="font-semibold">O₃:</span> {airQuality.components.o3} µg/m³</div>
      <div><span className="font-semibold">NO₂:</span> {airQuality.components.no2} µg/m³</div>
      <div><span className="font-semibold">SO₂:</span> {airQuality.components.so2} µg/m³</div>
      <div><span className="font-semibold">CO:</span> {airQuality.components.co} µg/m³</div>
    </div>
    
    <p className="text-xs mt-4 opacity-70">
      Last updated: {formatTime(airQuality.time, weather.timezone)}
    </p>
  </div>
)}

{pmData.length > 0 && (
  <div className="w-full max-w-2xl mt-8  p-4  rounded-2xl  ">
    <h3 className="text-lg font-semibold text-white mb-4 text-center">Air Quality (PM2.5 & PM10)</h3>
    <ResponsiveContainer width="100%" height={300}>
      <LineChart
  data={pmData}
  margin={{ top: 0, right: 60, left: 10, bottom: 0 }}
>
        <CartesianGrid strokeDasharray="3 3" stroke="#555" />
        <XAxis dataKey="time" stroke="#ccc" />
        <YAxis stroke="#ccc" />
        <Tooltip
          contentStyle={{ backgroundColor: "#1f2937", border: "none" }}
          labelStyle={{ color: "#fff" }}
          formatter={(value, name) => [`${value.toFixed(1)} µg/m³`, name.toUpperCase()]}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="pm25"
          stroke="#10b981" // Tailwind green-500
          strokeWidth={2}
          dot={{ r: 3 }}
          name="PM2.5"
        />
        <Line
          type="monotone"
          dataKey="pm10"
          stroke="#ef4444" // Tailwind red-500
          strokeWidth={2}
          dot={{ r: 3 }}
          name="PM10"
        />
      </LineChart>
    </ResponsiveContainer>
  </div>
)}
<div className="glassmorphism p-2 rounded-xl shadow-md w-fit mx-auto mb-6">
  <div className="flex gap-2">
    {[
      { label: "Clouds", value: "clouds_new" },
      { label: "Temp", value: "temp_new" },
      { label: "Wind", value: "wind_new" },
      { label: "Precip", value: "precipitation_new" },
      { label: "Pressure", value: "pressure_new" },
    ].map(({ label, value }) => (
      <button
        key={value}
        onClick={() => setMapLayer(value)}
        className={`px-3 py-1 rounded-lg text-sm font-medium transition backdrop-blur-md ${
          mapLayer === value
            ? "bg-white/20 text-white shadow-inner"
            : "bg-white/5 text-gray-300 hover:bg-white/10"
        }`}
      >
        {label}
      </button>
    ))}
  </div>
</div>

{weather && (
  <div className="mt-8">
    <h3 className="text-lg font-semibold text-white mb-2">Weather Map</h3>
    <div className="h-[400px] rounded-2xl overflow-hidden shadow-md">
      <MapContainer
        center={[weather.coord.lat, weather.coord.lon]}
        zoom={6}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        {/* Base OpenStreetMap Layer */}
        <TileLayer
          attribution='&copy; <a href="https://osm.org">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {/* Weather Overlay Layer */}
        <TileLayer
          url={`https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${weatherApiKey}`}
          opacity={0.5}
        />
        <TileLayer
  url={`https://tile.openweathermap.org/map/${mapLayer}/{z}/{x}/{y}.png?appid=${weatherApiKey}`}
  opacity={0.5}
/>

      </MapContainer>
    </div>
  </div>
)}


{/* 🌤️ SMART INSIGHT */}
{summary && (
  <div className="w-full max-w-2xl mt-6 p-4 rounded-xl bg-white/10 backdrop-blur text-white shadow-lg">
    <h2 className="text-xl font-bold mb-2">Weather Insight</h2>
    <p className="text-sm leading-relaxed">{summary}</p>
  </div>
)}

{/* 📰 WEATHER NEWS */}
{newsArticles.length > 0 && (
  <div className="w-full max-w-2xl mt-6 p-4 rounded-xl bg-white/10 backdrop-blur text-white shadow-lg">
    <h2 className="text-xl font-bold mb-4">Weather News</h2>
    <ul className="space-y-4">
      {newsArticles.map((article, i) => (
        <li key={i}>
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block hover:underline"
          >
            <p className="text-md font-semibold">{article.title}</p>
            <p className="text-sm opacity-80">{article.source.name}</p>
          </a>
        </li>
      ))}
    </ul>
  </div>
)}

      </div>
    </div>
  );
};

export default App;
