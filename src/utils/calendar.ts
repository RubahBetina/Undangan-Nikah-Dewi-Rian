import type { WeddingSettings } from '../types/wedding.ts';

function formatIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

export function downloadWeddingIcs(settings: WeddingSettings): void {
  const start = new Date(settings.weddingDateIso);
  if (Number.isNaN(start.getTime())) return;
  const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Atelier Fleur//Wedding Invitation//ID',
    'BEGIN:VEVENT',
    `UID:wedding-${start.getTime()}@atelierfleur.id`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(start)}`,
    `DTEND:${formatIcsDate(end)}`,
    `SUMMARY:Pernikahan ${settings.coupleHeadline}`,
    `LOCATION:${settings.akadVenue}, ${settings.akadAddress}`,
    `DESCRIPTION:${settings.akadTitle} (${settings.akadTime}) & ${settings.resepsiTitle} (${settings.resepsiTime})`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([lines], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Pernikahan-${settings.coupleHeadline.replace(/\s+/g, '-')}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
