const TEHRAN_TIME_ZONE = 'Asia/Tehran';
const PRODUCT_HUNT_TIME_ZONE = 'America/Los_Angeles';

function dateInTimeZone(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function dateInTehran(now = new Date()): string {
  return dateInTimeZone(now, TEHRAN_TIME_ZONE);
}

export function dateInProductHunt(now = new Date()): string {
  return dateInTimeZone(now, PRODUCT_HUNT_TIME_ZONE);
}

function timeZoneOffsetMinutes(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  const representedAsUtc = Date.UTC(
    value('year'),
    value('month') - 1,
    value('day'),
    value('hour'),
    value('minute'),
    value('second'),
  );
  return Math.round((representedAsUtc - at.getTime()) / 60000);
}

function startOfDayUtc(now: Date, timeZone: string, dateValue: string, offsetDays = 0): Date {
  const [year, month, day] = dateValue.split('-').map(Number);
  const localMidnightAsUtc = new Date(Date.UTC(year, month - 1, day - offsetDays, 0, 0, 0));
  const offsetMinutes = timeZoneOffsetMinutes(localMidnightAsUtc, timeZone);
  return new Date(localMidnightAsUtc.getTime() - offsetMinutes * 60_000);
}

export function startOfTehranDayUtc(now = new Date(), offsetDays = 0): Date {
  return startOfDayUtc(now, TEHRAN_TIME_ZONE, dateInTehran(now), offsetDays);
}

export function startOfProductHuntDayUtc(now = new Date(), offsetDays = 0): Date {
  return startOfDayUtc(now, PRODUCT_HUNT_TIME_ZONE, dateInProductHunt(now), offsetDays);
}
