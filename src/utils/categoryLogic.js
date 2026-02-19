import { Icon } from '@iconify/react';

const CATEGORIES = {
  TRAVAIL: { 
    icon: 'solar:case-minimalistic-bold', 
    color: '#007AFF', 
    keywords: ['thales', 'travail', 'réunion', 'bureau'] 
  },
  TRANSPORT: { 
    icon: 'solar:car-bold', 
    color: '#5856D6', 
    keywords: ['trajet', 'voiture', 'route', 'conduite', 'aller'] 
  },
  EQUITATION: { 
    icon: 'solar:horse-bold', 
    color: '#FF9500', 
    keywords: ['equitation', 'équitation', 'cheval', 'poney'] 
  },
  // MODIFIÉ : Manger avec des couverts bien visibles
  REPAS: { 
    icon: 'fa6-solid:utensils', 
    color: '#FF2D55', 
    keywords: ['manger', 'resto', 'diner', 'repas', 'déjeuner', 'lunch', 'midi', 'dîner'] 
  },
  MENAGE: { 
    icon: 'mingcute:broom-line', 
    color: '#AF52DE', 
    keywords: ['menage', 'rangement', 'propre', 'aspirateur', 'nettoyage'] 
  },
  PROJET: { 
    icon: 'solar:laptop-minimalistic-bold', 
    color: '#34C759', 
    keywords: ['projet', 'code', 'ordi', 'ordinateur', 'dev'] 
  },
  CHEVEUX: { 
    icon: 'solar:scissors-square-bold', 
    color: '#FF2D55', 
    keywords: ['cheveux', 'coiffeur', 'coupe', 'barbier'] 
  },
  SIESTE: { 
    icon: 'solar:sleeping-bold', 
    color: '#5856D6', 
    keywords: ['sieste', 'repos', 'break'] 
  },
  RENDEZVOUS: { 
    icon: 'solar:calendar-date-bold', 
    color: '#007AFF', 
    keywords: ['rendez vous', 'rdv', 'rendez-vous', 'docteur', 'dentiste'] 
  },
  PERSO: { 
    icon: 'solar:heart-bold', 
    color: '#FF2D55', 
    keywords: ['temps perso', 'perso', 'méditation', 'bien être', 'sport'] 
  },
  CINEMA: { 
    icon: 'solar:videocamera-record-bold', 
    color: '#FF3B30', 
    keywords: ['cinéma', 'cinema', 'film', 'netflix', 'série'] 
  },
  // NOUVEAU : Concert
  CONCERT: { 
    icon: 'solar:music-notes-bold', 
    color: '#AF52DE', 
    keywords: ['concert', 'musique', 'festival', 'spectacle','fridge'] 
  },
  SORTIE: { 
    icon: 'solar:wineglass-triangle-bold', 
    color: '#FF9500', 
    keywords: ['bar', 'biere', 'bière', 'verre', 'apéro', 'apero', 'cocktail'] 
  },
  SOMMEIL: { 
    icon: 'solar:moon-bold', 
    color: '#1C1C1E', 
    keywords: ['dormir', 'dodo', 'nuit', 'coucher'] 
  },
  REVEIL: { 
    icon: 'solar:alarm-bold', 
    color: '#FFCC00', 
    keywords: ['reveil', 'réveil'] 
  },
  SKI: { 
    icon: 'mdi:ski', 
    color: '#A7B5D9', 
    keywords: ['ski', 'neige'] 
  },
  DEFAUT: { 
    icon: 'solar:notes-bold', 
    color: '#8E8E93', 
    keywords: [] 
  }
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

