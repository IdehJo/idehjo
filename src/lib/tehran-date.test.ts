import { expect, test } from 'bun:test';
import {
  dateInProductHunt,
  dateInTehran,
  startOfProductHuntDayUtc,
  startOfTehranDayUtc,
} from './tehran-date';

test('Tehran calendar date is stable for a known 2026 instant', () => {
  const now = new Date('2026-09-04T12:00:00.000Z');
  expect(dateInTehran(now)).toBe('2026-09-04');
});

test('Tehran midnight maps to the correct UTC instant', () => {
  const now = new Date('2026-09-04T12:00:00.000Z');
  expect(startOfTehranDayUtc(now).toISOString()).toBe('2026-09-03T20:30:00.000Z');
  expect(startOfTehranDayUtc(now, 1).toISOString()).toBe('2026-09-02T20:30:00.000Z');
});

test('Product Hunt discovery follows America/Los_Angeles day boundaries', () => {
  const tehranMorning = new Date('2026-09-04T06:12:00.000Z');
  expect(dateInTehran(tehranMorning)).toBe('2026-09-04');
  expect(dateInProductHunt(tehranMorning)).toBe('2026-09-03');
  expect(startOfProductHuntDayUtc(tehranMorning).toISOString()).toBe('2026-09-03T07:00:00.000Z');
  expect(startOfProductHuntDayUtc(tehranMorning, 1).toISOString()).toBe('2026-09-02T07:00:00.000Z');
});
