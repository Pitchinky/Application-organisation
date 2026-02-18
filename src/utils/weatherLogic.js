// src/utils/weatherLogic.js
import { format, isSameDay } from 'date-fns';

/**
 * Récupère le résumé météo pour un jour donné à partir des prévisions
 * @param {Date} date - Le jour ciblé
 * @param {Array} forecastList - La liste 'list' venant de l'API OpenWeather
 */
export const getDailySummary = (date, forecastList) => {
    console.log("Données reçues pour la météo :", forecastList);
    if (!forecastList || forecastList.length === 0) return null;

    // 1. On filtre tous les créneaux de 3h qui appartiennent à ce jour
    const daySlots = forecastList.filter(slot => 
        isSameDay(new Date(slot.dt * 1000), date)
    );

    if (daySlots.length === 0) return null;

    // 2. On cherche la probabilité de pluie max (pop entre 0 et 1)
    const maxPop = Math.max(...daySlots.map(slot => slot.pop || 0));

    // 3. On cherche la météo la plus "marquante" (ex: orage > pluie > nuage)
    // On prend le slot le plus proche de midi (milieu de liste) pour la température
    const midIndex = Math.floor(daySlots.length / 2);
    const mainSlot = daySlots[midIndex];

    return {
        pop: maxPop, // Probabilité de précipitation
        temp: mainSlot.main.temp,
        weather: mainSlot.weather // Contient l'ID pour l'icône
    };
    };