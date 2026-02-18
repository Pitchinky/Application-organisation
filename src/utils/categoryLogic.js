import { Icon } from '@iconify/react';

const CATEGORIES = {
  TRAVAIL: { icon: 'ph:briefcase-duotone', color: '#007AFF', keywords: ['thales', 'travail', 'réunion'] }, // Bleu iOS
  TRANSPORT: { icon: 'solar:car-bold-duotone', color: '#5856D6', keywords: ['trajet', 'voiture', 'route'] }, // Indigo
  EQUITATION: { icon: 'mdi:horse-variant', color: '#FF9500', keywords: ['equitation', 'équitation', 'cheval'] }, // Orange
  REPAS: { icon: 'ph:fork-knife-duotone', color: '#FF2D55', keywords: ['manger', 'resto', 'diner', 'repas'] }, // Rose/Rouge
  MENAGE: { icon: 'ph:broom-duotone', color: '#AF52DE', keywords: ['menage', 'rangement', 'propre'] }, // Violet
  PROJET: { icon: 'ph:laptop-duotone', color: '#34C759', keywords: ['projet', 'code', 'ordi'] }, // Vert
  LOISIR: { icon: 'ph:film-slate-duotone', color: '#FFCC00', keywords: ['cinéma','cinema', 'film', 'bar', 'biere'] }, // Jaune
  SOMMEIL: { icon: 'ph:moon-duotone', color: '#1C1C1E', keywords: ['dormir', 'dodo', 'nuit'] }, // Noir/Gris foncé
  DEFAUT: { icon: 'ph:hash-duotone', color: '#8E8E93', keywords: [] } // Gris
};

export const getCategoryData = (title) => {
  if (!title) return CATEGORIES.DEFAUT;
  const t = title.toLowerCase();

  // On cherche la catégorie qui contient un mot-clé présent dans le titre
  const found = Object.values(CATEGORIES).find(cat => 
    cat.keywords.some(keyword => t.includes(keyword))
  );

  return found || CATEGORIES.DEFAUT;
};