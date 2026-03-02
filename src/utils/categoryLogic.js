import { Icon } from '@iconify/react';

const CATEGORIES = {
  TRAVAIL: { 
    icon: 'solar:case-minimalistic-bold', 
    color: '#007AFF', // Bleu classique
    keywords: ['thales', 'travail', 'réunion', 'bureau'] 
  },
  TRANSPORT: { 
    icon: 'boxicons:car-filled', 
    color: '#8D6E63', // Marron
    keywords: ['trajet', 'voiture', 'route', 'conduite', 'aller'] 
  },
  EQUITATION: { 
    icon: 'solar:horse-bold', 
    color: '#D2691E', // Orange cuivré / Terre
    keywords: ['equitation', 'équitation', 'cheval', 'poney'] 
  },
  REPAS: { 
    icon: 'fa6-solid:utensils', 
    color: '#636366', // Gris
    keywords: ['manger', 'resto', 'diner', 'repas', 'déjeuner', 'lunch', 'midi', 'dîner'] 
  },
  MENAGE: { 
    icon: 'mingcute:broom-line', 
    color: '#AF52DE', // Violet
    keywords: ['menage', 'rangement', 'propre', 'aspirateur', 'nettoyage'] 
  },
  PROJET: { 
    icon: 'solar:laptop-minimalistic-bold', 
    color: '#34C759', // Vert pomme
    keywords: ['projet', 'code', 'ordi', 'ordinateur', 'dev'] 
  },
  CHEVEUX: { 
    icon: 'solar:scissors-square-bold', 
    color: '#FF8AE2', // Rose bonbon clair
    keywords: ['cheveux', 'coiffeur', 'coupe', 'barbier'] 
  },
  SIESTE: { 
    icon: 'solar:sleeping-bold', 
    color: '#5AC8FA', // Bleu ciel / Cyan clair
    keywords: ['sieste', 'repos', 'break'] 
  },
  RENDEZVOUS: { 
    icon: 'solar:calendar-date-bold', 
    color: '#00C7BE', // Bleu canard / Menthe
    keywords: ['rendez vous', 'rdv', 'rendez-vous', 'docteur', 'dentiste'] 
  },
  PERSO: { 
    icon: 'solar:heart-bold', 
    color: '#FF375F', // Rouge bordeaux / Framboise
    keywords: ['temps perso', 'perso', 'méditation', 'bien être', 'sport'] 
  },
  ECRITURE: { 
    icon: 'mdi:pen', 
    color: '#A2845E', // Marron kraft / Sable
    keywords: ['ecriture'] 
  },
  CINEMA: { 
    icon: 'solar:videocamera-record-bold', 
    color: '#FF3B30', // Rouge vif
    keywords: ['cinéma', 'cinema', 'film', 'netflix', 'série'] 
  },
  CONCERT: { 
    icon: 'solar:music-notes-bold', 
    color: '#BF5AF2', // Violet néon / Magenta clair
    keywords: ['concert', 'musique', 'festival', 'spectacle','fridge'] 
  },
  BAR: { 
    icon: 'solar:wineglass-triangle-bold', 
    color: '#FF9F0A', // Orange ambré foncé
    keywords: ['bar', 'biere', 'bière', 'verre', 'apéro', 'apero', 'cocktail'] 
  },
  SORTIE: { 
    icon: 'solar:ticket-bold', 
    color: '#E586C6', // Mauve
    keywords: ['espace 360', 'sortie'] 
  },
  SOMMEIL: { 
    icon: 'solar:moon-bold', 
    color: '#1C1C1E', // Noir / Gris très foncé
    keywords: ['dormir', 'dodo', 'nuit', 'coucher'] 
  },
  REVEIL: { 
    icon: 'solar:alarm-bold', 
    color: '#FFCC00', // Jaune soleil
    keywords: ['reveil', 'réveil'] 
  },
  SKI: { 
    icon: 'mdi:ski', 
    color: '#A7B5D9', // Bleu des neiges / Gris bleuté
    keywords: ['ski', 'neige'] 
  },
  DEFAUT: { 
    icon: 'solar:notes-bold', 
    color: '#8E8E93', // Gris standard
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