export const DEFAULT_PROFILE = {
  employeeName: 'Tapuosi Latunipulu',
  supervisorName: 'Rajeev Prasad',
  organization: 'IT Hero PTY LTD',
  signature: 'T.L',
  vehicleRego: 'DLZ 78X',
  defaultEmail: 'tapz.latunipulu@gmail.com',
};

export const DAYS_ORDER = [
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
];

export const BREAK_OPTIONS = [
  'No Break',
  '0 Hour 15 Minutes',
  '0 Hour 30 Minutes',
  '0 Hour 45 Minutes',
  '1 Hour 0 Minutes',
  '1 Hour 15 Minutes',
  '1 Hour 30 Minutes',
  '1 Hour 45 Minutes',
  '2 Hour 0 Minutes',
];

export const COMMON_CLIENTS = [
  { label: 'TM004 - IGA Local Grocer', code: 'TM004', desc: 'IGA Local Grocer proactive maintenance' },
  { label: 'Cartology Woolworths Sydney', code: 'WW01', desc: 'Media player and router swap' },
  { label: 'Kiama NSW 2533', code: '2533', desc: 'Media player swap and install' },
  { label: 'Nowra NSW 2541', code: '2541', desc: 'Media player swap and install' },
  { label: 'Erina 2137 / 2155', code: '2155', desc: 'Media player swap and install' },
  { label: 'QIC Centre Mall', code: 'QIC02', desc: 'Proactive clean & screen inspection' },
];

export const QUICK_PRESETS = [
  {
    name: 'Day Shift (8:30 - 16:00)',
    checkIn: '08:30',
    checkOut: '16:00',
    breakHours: '0 Hour 30 Minutes',
  },
  {
    name: 'Night Run (16:45 - 23:00)',
    checkIn: '16:45',
    checkOut: '23:00',
    breakHours: 'No Break',
  },
  {
    name: 'Long Shift (09:00 - 01:00)',
    checkIn: '09:00',
    checkOut: '01:00',
    breakHours: '0 Hour 45 Minutes',
  },
  {
    name: 'Proactive AM (08:00 - 13:00)',
    checkIn: '08:00',
    checkOut: '13:00',
    breakHours: '0 Hour 30 Minutes',
  },
];
