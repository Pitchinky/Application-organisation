import { differenceInMinutes, startOfDay, endOfDay, parseISO } from 'date-fns';

export const PX_PER_MIN = 0.6;
export const THRESHOLD_SHORT_EVENT = 50; // Minutes en dessous desquelles c'est un rond

export const processTimeline = (events, currentDate) => {
  if (!events || events.length === 0) return [];
  
  const timelineItems = [];
  const dayStart = startOfDay(currentDate);
  const dayEnd = endOfDay(currentDate);
  let lastTime = dayStart;

  events.forEach((event) => {
    if (!event.start.dateTime) return;

    const start = parseISO(event.start.dateTime);
    const end = parseISO(event.end.dateTime);

    // Calcul du trou (Gap)
    const gapDuration = differenceInMinutes(start, lastTime);
    if (gapDuration > 0) {
      timelineItems.push({
        type: 'gap',
        start: lastTime,
        end: start,
        duration: gapDuration,
        height: gapDuration * PX_PER_MIN
      });
    }

    // Calcul de l'événement
    const eventDuration = differenceInMinutes(end, start);
    timelineItems.push({
      type: 'event',
      data: event,
      duration: eventDuration,
      height: eventDuration * PX_PER_MIN
    });

    lastTime = end;
  });

  // Gap de fin de journée
  const endGap = differenceInMinutes(dayEnd, lastTime);
  if (endGap > 0) {
    timelineItems.push({
      type: 'gap',
      start: lastTime,
      end: dayEnd,
      duration: endGap,
      height: endGap * PX_PER_MIN
    });
  }

  return timelineItems;
};

export const getEventStatus = (event, now) => {
  if (!event.start.dateTime) return { status: 'future', progress: 0 };
  const start = parseISO(event.start.dateTime); 
  const end = parseISO(event.end.dateTime);
  
  if (now > end) return { status: 'past', progress: 100 };
  if (now < start) return { status: 'future', progress: 0 };
  
  const total = differenceInMinutes(end, start); 
  const elapsed = differenceInMinutes(now, start);
  return { status: 'current', progress: Math.min(100, Math.max(0, (elapsed / total) * 100)) };
};

export const formatDuration = (mins) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}min`;
  if (h > 0) return `${h}h`;
  return `${m} min`;
};