// js/weather.js
// Módulo para buscar e exibir a previsão do tempo.

import { $ } from "./utils.js";

const API_KEY = "b39ef98f3edca5d6de39c4fcd9b78c7c"; // Chave da API OpenWeatherMap

export const weather = {
  init: function () {
    // Pode adicionar listeners aqui se necessário no futuro
  },
  getAndDisplayDetailedWeather: async function () {
    const statusDiv = $("weather-status");
    const hourlyContainer = $("hourly-forecast-container")?.querySelector(
      ".previsao-lista"
    );
    if (!statusDiv || !hourlyContainer) return;

    statusDiv.textContent = "Buscando sua localização...";
    if (!navigator.geolocation) {
      return (statusDiv.textContent = "Geolocalização não é suportada.");
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude: lat, longitude: lon } = position.coords;
        const apiUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=pt_br`;

        statusDiv.textContent = "Carregando previsão...";
        fetch(apiUrl)
          .then((res) => res.json())
          .then((data) => {
            statusDiv.style.display = "none";
            hourlyContainer.innerHTML = "";
            data.list.slice(0, 8).forEach((item) => {
              const date = new Date(item.dt * 1000);
              const time = date.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              });
              hourlyContainer.innerHTML += this.createForecastItem(
                time,
                item.main.temp,
                item.weather[0].icon
              );
            });
          })
          .catch((err) => {
            console.error(err);
            statusDiv.textContent = "Erro ao carregar previsão.";
          });
      },
      () => {
        statusDiv.textContent = "Não foi possível obter sua localização.";
      }
    );
  },
  createForecastItem: function (label, temp, iconCode) {
    return `<div class="previsao-item"><p>${label}</p><img src="https://openweathermap.org/img/wn/${iconCode}.png" alt="Tempo"><p>${Math.round(
      temp
    )}°C</p></div>`;
  },
};
