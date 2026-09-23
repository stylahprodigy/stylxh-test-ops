import * as XLSX from 'xlsx';
import { TIMESHEET_TEMPLATE_BASE64 } from '../assets/templateBase64.js';

// Helper to decode base64 string to Uint8Array in both Web and React Native environments
function base64ToUint8Array(base64) {
  if (typeof atob === 'function') {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }
  // Node / fallback
  const buffer = Buffer.from(base64, 'base64');
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.length);
}

// Helper to encode Uint8Array to base64
export function uint8ArrayToBase64(uint8Array) {
  if (typeof btoa === 'function') {
    let binary = '';
    const len = uint8Array.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binary);
  }
  return Buffer.from(uint8Array).toString('base64');
}

/**
 * Parses time string (HH:MM 24-hr, or "h:mm AM/PM", or "HH:MM:SS") to hours as decimal (0..24)
 */
export function timeStringToDecimal(timeStr) {
  if (!timeStr) return 0;
  const str = String(timeStr).trim();
  const isPM = /pm/i.test(str);
  const isAM = /am/i.test(str);
  const cleanStr = str.replace(/[^\d:]/g, '');
  const parts = cleanStr.split(':');
  let h = parseInt(parts[0] || '0', 10);
  const m = parseInt(parts[1] || '0', 10);

  if (isPM) {
    if (h < 12) h += 12;
  } else if (isAM) {
    if (h === 12) h = 0;
  }
  return h + m / 60;
}

/**
 * Calculates net hours for a single day shift
 */
export function calculateDayStats(day) {
  if (!day.checkIn || !day.checkOut) {
    return { grossHours: 0, breakHours: 0, netHours: 0, kmTravelled: 0, mealsCount: 0 };
  }

  const inDec = timeStringToDecimal(day.checkIn);
  let outDec = timeStringToDecimal(day.checkOut);
  if (outDec < inDec) {
    outDec += 24; // Crossed midnight
  }
  const grossHours = Math.max(0, outDec - inDec);

  let breakHours = 0;
  if (day.breakHours) {
    const val = String(day.breakHours).trim().toLowerCase();
    if (val === 'no break' || val === 'none' || val === '0' || val === '0m' || val === '0 min') {
      breakHours = 0;
    } else if (val.includes('15 min') || val === '15' || val === '15m' || val === '0.25') {
      breakHours = 0.25;
    } else if (val.includes('30 min') || val === '30' || val === '30m' || val === '0.5' || val.includes('0 hour 30')) {
      breakHours = 0.5;
    } else if (val.includes('45 min') || val === '45' || val === '45m' || val === '0.75' || val.includes('0 hour 45')) {
      breakHours = 0.75;
    } else if (val.includes('1 hour 15') || val.includes('1h 15') || val === '1.25' || val === '75') {
      breakHours = 1.25;
    } else if (val.includes('1 hour 30') || val.includes('1h 30') || val === '1.5' || val === '90') {
      breakHours = 1.5;
    } else if (val.includes('1 hour 45') || val.includes('1h 45') || val === '1.75' || val === '105') {
      breakHours = 1.75;
    } else if (val.includes('2 hour') || val.includes('2h') || val === '2' || val === '120') {
      breakHours = 2.0;
    } else if (val.includes('1 hour') || val.includes('1h') || val === '1' || val === '60' || val === '1.0') {
      breakHours = 1.0;
    } else {
      const num = parseFloat(val);
      if (!isNaN(num)) {
        breakHours = num > 5 ? num / 60 : num;
      }
    }
  }

  const nonBillable = parseFloat(day.nonBillable || 0) || 0;
  const netHours = Math.max(0, grossHours - breakHours - nonBillable);

  const kmStart = parseFloat(day.kmStart || 0) || 0;
  const kmFinish = parseFloat(day.kmFinish || 0) || 0;
  const kmTravelled = kmFinish > kmStart ? kmFinish - kmStart : 0;

  let mealsCount = 0;
  if (day.breakfast) mealsCount++;
  if (day.lunch) mealsCount++;
  if (day.dinner) mealsCount++;

  return { grossHours, breakHours, netHours, kmTravelled, mealsCount };
}

/**
 * Converts break string/shorthand to the exact template VLOOKUP string
 */
export function formatBreakForExcel(breakInput) {
  if (!breakInput) return 'No Break';
  const val = String(breakInput).trim().toLowerCase();
  if (val === 'no break' || val === 'none' || val === '0' || val === '0m' || val === '0 min') {
    return 'No Break';
  }
  if (val === '15' || val === '15m' || val.includes('15 min') || val === '0.25') {
    return '0 Hour 15 Minutes';
  }
  if (val === '30' || val === '30m' || val.includes('30 min') || val === '0.5' || val.includes('0 hour 30')) {
    return '0 Hour 30 Minutes';
  }
  if (val === '45' || val === '45m' || val.includes('45 min') || val === '0.75' || val.includes('0 hour 45')) {
    return '0 Hour 45 Minutes';
  }
  if (val === '60' || val === '1h' || val === '1 hour' || val === '1.0' || val === '1' || val.includes('1 hour 0')) {
    return '1 Hour 0 Minutes';
  }
  if (val === '75' || val === '1.25' || val.includes('1 hour 15') || val.includes('1h 15')) {
    return '1 Hour 15 Minutes';
  }
  if (val === '90' || val === '1.5' || val.includes('1 hour 30') || val.includes('1h 30')) {
    return '1 Hour 30 Minutes';
  }
  if (val === '105' || val === '1.75' || val.includes('1 hour 45') || val.includes('1h 45')) {
    return '1 Hour 45 Minutes';
  }
  if (val === '120' || val === '2' || val === '2h' || val.includes('2 hour')) {
    return '2 Hour 0 Minutes';
  }
  return breakInput;
}

/**
 * Fills the IT Hero Excel Template with entered data while preserving all native formulas
 */
export async function generateFilledTimesheetWorkbook({
  profile,
  weekEnding,
  days,
  comments,
  signatureDate,
}) {
  const wb = XLSX.read(TIMESHEET_TEMPLATE_BASE64, {
    type: 'base64',
    cellStyles: true,
    cellNF: true,
    cellFormula: true,
  });

  const sheet = wb.Sheets['Weekly Template'];
  if (!sheet) {
    throw new Error("Worksheet 'Weekly Template' not found in template.");
  }

  const setCell = (cellRef, val, type = 's', numFormat = null) => {
    if (val === null || val === undefined || val === '') {
      delete sheet[cellRef];
      return;
    }
    const cell = { t: type, v: val };
    if (numFormat) cell.z = numFormat;
    sheet[cellRef] = cell;
  };

  // Cleanly initialize all shift rows 14..20 to ensure no leftover template dummy data
  for (let r = 14; r <= 20; r++) {
    // Clear user data input columns
    delete sheet[`C${r}`]; // Client
    delete sheet[`D${r}`]; // Project code
    delete sheet[`E${r}`]; // Work details
    delete sheet[`F${r}`]; // Check-in time
    delete sheet[`G${r}`]; // Check-out time
    delete sheet[`H${r}`]; // Break string
    delete sheet[`L${r}`]; // Non-billable
    delete sheet[`O${r}`]; // KM Start
    delete sheet[`P${r}`]; // KM Finish
    delete sheet[`S${r}`]; // Breakfast
    delete sheet[`T${r}`]; // Lunch
    delete sheet[`U${r}`]; // Dinner

    // Reset formula values to 0 while keeping the original Excel formula strings
    if (sheet[`I${r}`]) { sheet[`I${r}`].v = 0; sheet[`I${r}`].w = '0.00'; }
    if (sheet[`J${r}`]) { sheet[`J${r}`].v = 0; sheet[`J${r}`].w = '0.00'; }
    if (sheet[`K${r}`]) { sheet[`K${r}`].v = 0; sheet[`K${r}`].w = '0.00'; }
    if (sheet[`M${r}`]) { sheet[`M${r}`].v = 0; sheet[`M${r}`].w = '0.00'; }
    if (sheet[`Q${r}`]) { sheet[`Q${r}`].v = 0; sheet[`Q${r}`].w = '0'; }
    if (sheet[`V${r}`]) { sheet[`V${r}`].v = 0; sheet[`V${r}`].w = '0'; }
  }

  // Header Details
  if (weekEnding) setCell('D4', weekEnding, 's');
  setCell('B8', profile.organization || 'IT Hero PTY LTD', 's');
  setCell('D8', profile.employeeName || 'Tapuosi Latunipulu', 's');
  setCell('F8', profile.supervisorName || 'Rajeev Prasad', 's');

  let totalCalculatedHours = 0;
  let totalCalculatedKm = 0;
  let totalCalculatedMeals = 0;

  // Map rows: 14 = Thursday, 15 = Friday, 16 = Saturday, 17 = Sunday, 18 = Monday, 19 = Tuesday, 20 = Wednesday
  const startRow = 14;
  days.forEach((day, index) => {
    const rowNum = startRow + index;
    if (rowNum > 20) return;

    // Day name (B14..B20)
    if (day.dayName) setCell(`B${rowNum}`, day.dayName, 's');

    // If day has any work logged
    const hasWork = Boolean(day.checkIn || day.client || day.workDetails);

    if (hasWork) {
      setCell(`C${rowNum}`, day.client || '', 's');
      setCell(`D${rowNum}`, day.projectCode || '', 's');
      setCell(`E${rowNum}`, day.workDetails || '', 's');

      // Check-in (F14..F20) - fraction of 24 hrs
      if (day.checkIn) {
        const inDec = timeStringToDecimal(day.checkIn);
        setCell(`F${rowNum}`, inDec / 24, 'n', '[$-409]h:mm AM/PM');
      }

      // Check-out (G14..G20) - fraction of 24 hrs
      if (day.checkOut) {
        const outDec = timeStringToDecimal(day.checkOut);
        setCell(`G${rowNum}`, outDec / 24, 'n', '[$-409]h:mm AM/PM');
      }

      // Break hours (H14..H20) - exact VLOOKUP dropdown string
      const excelBreak = formatBreakForExcel(day.breakHours);
      setCell(`H${rowNum}`, excelBreak, 's');

      // Calculate formula values for Excel viewers that don't auto-calculate on open
      const dayStats = calculateDayStats(day);
      if (sheet[`I${rowNum}`]) {
        sheet[`I${rowNum}`].v = dayStats.grossHours - dayStats.breakHours;
        sheet[`I${rowNum}`].w = (dayStats.grossHours - dayStats.breakHours).toFixed(2);
      }
      if (sheet[`M${rowNum}`]) {
        sheet[`M${rowNum}`].v = dayStats.netHours;
        sheet[`M${rowNum}`].w = dayStats.netHours.toFixed(2);
      }
      totalCalculatedHours += dayStats.netHours;

      // Non-billable hours (L14..L20)
      if (day.nonBillable && parseFloat(day.nonBillable) > 0) {
        setCell(`L${rowNum}`, parseFloat(day.nonBillable), 'n', '0.00');
      }

      // Vehicle KM Start & Finish (O14..O20, P14..P20)
      if (day.kmStart && parseFloat(day.kmStart) > 0) {
        setCell(`O${rowNum}`, parseFloat(day.kmStart), 'n', '0');
      }
      if (day.kmFinish && parseFloat(day.kmFinish) > 0) {
        setCell(`P${rowNum}`, parseFloat(day.kmFinish), 'n', '0');
      }
      if (dayStats.kmTravelled > 0 && sheet[`Q${rowNum}`]) {
        sheet[`Q${rowNum}`].v = dayStats.kmTravelled;
        sheet[`Q${rowNum}`].w = String(dayStats.kmTravelled);
        totalCalculatedKm += dayStats.kmTravelled;
      }

      // Meals: Living away from home allowance (S, T, U)
      if (day.breakfast) setCell(`S${rowNum}`, 'Yes', 's');
      if (day.lunch) setCell(`T${rowNum}`, 'Yes', 's');
      if (day.dinner) setCell(`U${rowNum}`, 'Yes', 's');
      if (dayStats.mealsCount > 0 && sheet[`V${rowNum}`]) {
        sheet[`V${rowNum}`].v = dayStats.mealsCount;
        sheet[`V${rowNum}`].w = String(dayStats.mealsCount);
        totalCalculatedMeals += dayStats.mealsCount;
      }
    }
  });

  // Pre-evaluate Totals row (Row 21)
  if (sheet['I21']) { sheet['I21'].v = totalCalculatedHours; sheet['I21'].w = totalCalculatedHours.toFixed(2); }
  if (sheet['M21']) { sheet['M21'].v = totalCalculatedHours; sheet['M21'].w = totalCalculatedHours.toFixed(2); }
  if (sheet['Q21']) { sheet['Q21'].v = totalCalculatedKm; sheet['Q21'].w = String(totalCalculatedKm); }
  if (sheet['V21']) { sheet['V21'].v = totalCalculatedMeals; sheet['V21'].w = String(totalCalculatedMeals); }

  // Comments & Notes (B26)
  setCell('B26', comments || '', 's');

  // Vehicle Rego
  if (profile.vehicleRego) {
    setCell('P25', `Vehicle Rego: ${profile.vehicleRego}`, 's');
  }

  // Signature & Date
  setCell('B30', profile.signature || 'T.L', 's');
  setCell('F30', signatureDate || weekEnding || new Date().toISOString().split('T')[0], 's');

  // Output as Uint8Array bytes
  const outBase64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  return base64ToUint8Array(outBase64);
}
