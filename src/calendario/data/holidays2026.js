// Argentina 2026 Official Holidays
// Source: Calendario de Feriados 2026

export const holidays2026 = [
  // ENERO
  { date: '2026-01-01', title: 'Año Nuevo', description: 'Feriado inamovible', color: '#dc2626' },

  // FEBRERO
  { date: '2026-02-16', title: 'Carnaval', description: 'Feriado inamovible', color: '#dc2626' },
  { date: '2026-02-17', title: 'Carnaval', description: 'Feriado inamovible', color: '#dc2626' },

  // MARZO
  { date: '2026-03-23', title: 'Día no laborable con fines turísticos', description: 'Día no laborable', color: '#f59e0b' },
  { date: '2026-03-24', title: 'Día Nacional de la Memoria por la Verdad y la Justicia', description: 'Feriado inamovible', color: '#dc2626' },

  // ABRIL
  { date: '2026-04-02', title: 'Día del Veterano y de los Caídos en la Guerra de Malvinas', description: 'Feriado inamovible', color: '#dc2626' },
  { date: '2026-04-03', title: 'Viernes Santo', description: 'Feriado inamovible', color: '#dc2626' },

  // MAYO
  { date: '2026-05-01', title: 'Día del Trabajador', description: 'Feriado inamovible', color: '#dc2626' },
  { date: '2026-05-25', title: 'Día de la Revolución de Mayo', description: 'Feriado inamovible', color: '#dc2626' },

  // JUNIO
  { date: '2026-06-15', title: 'Paso a la Inmortalidad del Gral. Martín M. de Güemes', description: 'Feriado trasladable (se conmemora el 17)', color: '#7c3aed' },
  { date: '2026-06-20', title: 'Paso a la Inmortalidad del Gral. Manuel Belgrano', description: 'Feriado inamovible', color: '#dc2626' },

  // JULIO
  { date: '2026-07-09', title: 'Día de la Independencia', description: 'Feriado inamovible', color: '#dc2626' },
  { date: '2026-07-10', title: 'Día no laborable con fines turísticos', description: 'Día no laborable', color: '#f59e0b' },

  // AGOSTO
  { date: '2026-08-17', title: 'Paso a la Inmortalidad del Gral. José de San Martín', description: 'Feriado trasladable', color: '#7c3aed' },

  // OCTUBRE
  { date: '2026-10-12', title: 'Día del Respeto a la Diversidad Cultural', description: 'Feriado trasladable', color: '#7c3aed' },

  // NOVIEMBRE
  { date: '2026-11-23', title: 'Día de la Soberanía Nacional', description: 'Feriado trasladable', color: '#7c3aed' },

  // DICIEMBRE
  { date: '2026-12-07', title: 'Día no laborable con fines turísticos', description: 'Día no laborable', color: '#f59e0b' },
  { date: '2026-12-08', title: 'Inmaculada Concepción de María', description: 'Feriado inamovible', color: '#dc2626' },
  { date: '2026-12-25', title: 'Navidad', description: 'Feriado inamovible', color: '#dc2626' },
];

// Recurring meetings extracted from the Excel
export const recurringMeetings = [
  {
    title: 'Reunión Jefatura',
    dayOfWeek: 2, // Tuesday
    startHour: 7, startMinute: 30,
    endHour: 8, endMinute: 30,
    color: '#f59e0b',
    event_type: 'meeting',
  },
  {
    title: 'Mamás de Neo — Alicia',
    dayOfWeek: 3, // Wednesday
    startHour: 10, startMinute: 30,
    endHour: 12, endMinute: 0,
    color: '#e11d48',
    event_type: 'meeting',
  },
  {
    title: 'Clases Residentes',
    dayOfWeek: 1, // Monday
    startHour: 14, startMinute: 0,
    endHour: 16, endMinute: 0,
    color: '#7c3aed',
    event_type: 'training',
  },
  {
    title: 'Clases Residentes',
    dayOfWeek: 3, // Wednesday
    startHour: 14, startMinute: 0,
    endHour: 16, endMinute: 0,
    color: '#7c3aed',
    event_type: 'training',
  },
  {
    title: 'Ateneo Traumatólogos',
    dayOfWeek: 2, // Tuesday
    startHour: 18, startMinute: 0,
    endHour: 20, endMinute: 0,
    color: '#0ea5e9',
    event_type: 'ateneo',
  },
  {
    title: 'Yoga',
    dayOfWeek: 2, // Tuesday
    startHour: 11, startMinute: 0,
    endHour: 12, endMinute: 0,
    color: '#10b981',
    event_type: 'other',
  },
  {
    title: 'Yoga',
    dayOfWeek: 4, // Thursday
    startHour: 11, startMinute: 0,
    endHour: 12, endMinute: 0,
    color: '#10b981',
    event_type: 'other',
  },
  {
    title: 'Taller EML',
    dayOfWeek: 6, // Saturday
    startHour: 9, startMinute: 0,
    endHour: 13, endMinute: 0,
    color: '#f97316',
    event_type: 'training',
  },
];
