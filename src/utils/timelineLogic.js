import { differenceInMinutes, startOfDay, endOfDay, parseISO } from 'date-fns';

export const PX_PER_MIN = 0.6;
export const THRESHOLD_SHORT_EVENT = 29; // Minutes en dessous desquelles c'est un rond

export const processTimeline = (events, currentDate) => {
  const timelineItems = [];
  const dayStart = startOfDay(currentDate);
  const dayEnd = endOfDay(currentDate);
  let lastTime = dayStart;

  // --- CORRECTION ICI ---
  // Si pas d'événements, on génère un seul grand GAP de 00:00 à 23:59
  if (!events || events.length === 0) {
    const totalDuration = differenceInMinutes(dayEnd, dayStart);
    return [{
      type: 'gap',
      start: dayStart,
      end: dayEnd,
      duration: totalDuration,
      height: totalDuration * PX_PER_MIN
    }];
  }
  
  // Si on a des événements, on déroule la logique habituelle
  events.forEach((event) => {
    if (!event.start.dateTime) return;

    const start = parseISO(event.start.dateTime);
    const end = parseISO(event.end.dateTime);

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

    const eventDuration = differenceInMinutes(end, start);
    timelineItems.push({
      type: 'event',
      data: event,
      duration: eventDuration,
      height: eventDuration * PX_PER_MIN
    });

    lastTime = end;
  });

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