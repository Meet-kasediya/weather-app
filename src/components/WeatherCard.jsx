function WeatherCard({ city, temperature, condition, icon }) {
  return (
    <div className="backdrop-blur-md bg-white/10 rounded-2xl p-6 shadow-lg border border-white/20 text-white w-72">
      <div className="text-lg font-semibold">{city}</div>
      <img src={icon} alt={condition} className="w-20 h-20 mx-auto my-4" />
      <div className="text-4xl font-bold">{temperature}°C</div>
      <div className="capitalize mt-2">{condition}</div>
    </div>
  );
}

export default WeatherCard;
