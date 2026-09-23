import React, { useState, useMemo, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../styles/theme';
import {
  DEFAULT_PROFILE,
  DAYS_ORDER,
  BREAK_OPTIONS,
  COMMON_CLIENTS,
} from '../config/defaultProfile';
import {
  calculateDayStats,
  generateFilledTimesheetWorkbook,
} from '../services/timesheetService';
import { exportAndSendTimesheet } from '../services/exportService';
import { parseServiceM8Job } from '../services/serviceM8Parser';

export default function TimesheetScreen({
  shiftSession,
  initialJobData = null,
  initialComments = '',
  onResetSession,
  onNavigateToHeroOps,
}) {
  // Profile state
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);

  // Week Ending state - defaults to next Wednesday or today
  const [weekEnding, setWeekEnding] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = (3 - day + 7) % 7;
    d.setDate(d.getDate() + (diff === 0 ? 0 : diff));
    return d.toISOString().split('T')[0];
  });

  // Comments
  const [comments, setComments] = useState(
    initialComments || 'Standard maintenance and media player swaps completed. Site cleared and tested.'
  );

  // Target Email
  const [targetEmail, setTargetEmail] = useState(DEFAULT_PROFILE.defaultEmail);

  // TOGGLES for optional fields (User requested: remove km start/finish & living away unless toggled on)
  const [enableKmTracking, setEnableKmTracking] = useState(false);
  const [enableLivingAway, setEnableLivingAway] = useState(false);

  // Days state
  const [days, setDays] = useState(() => {
    return DAYS_ORDER.map((name) => ({
      dayName: name,
      client: '',
      projectCode: '',
      workDetails: '',
      checkIn: '',
      checkOut: '',
      breakHours: '0 Hour 30 Minutes',
      nonBillable: '',
      kmStart: '',
      kmFinish: '',
      breakfast: false,
      lunch: false,
      dinner: false,
      expanded: false,
    }));
  });

  const [loading, setLoading] = useState(false);
  const [exportNotice, setExportNotice] = useState(null);

  // ServiceM8 Paste Modal state
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteTargetDayIndex, setPasteTargetDayIndex] = useState(0);
  const [serviceM8InputText, setServiceM8InputText] = useState('');
  const [parsedPreview, setParsedPreview] = useState(null);

  // 12-Hour Dropdown Time Picker Modal State
  const [showTimePickerModal, setShowTimePickerModal] = useState(false);
  const [timePickerTargetDayIndex, setTimePickerTargetDayIndex] = useState(0);
  const [timePickerTargetField, setTimePickerTargetField] = useState('checkIn'); // 'checkIn' | 'checkOut'
  const [selectedAmPm, setSelectedAmPm] = useState('AM'); // 'AM' | 'PM' (defaults AM first)
  const [selectedHour12, setSelectedHour12] = useState('08'); // '01'..'12'
  const [selectedMinute, setSelectedMinute] = useState('00'); // '00','15','30','45' etc.

  // Helper: Convert stored 24h (HH:MM) to 12h display string (e.g. "08:30" -> "8:30 AM", "16:00" -> "4:00 PM")
  const format24To12Display = (time24) => {
    if (!time24 || !time24.includes(':')) return '';
    const parts = time24.trim().split(':');
    let h = parseInt(parts[0], 10);
    const m = parts[1] ? parts[1].padStart(2, '0') : '00';
    if (isNaN(h)) return '';
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${m} ${ampm}`;
  };

  // Helper: Convert 12h inputs (hour12, minute, ampm) back to exact 24h string (HH:MM) to preserve Excel formulas
  const convert12To24 = (hour12Str, minStr, ampmStr) => {
    let h = parseInt(hour12Str, 10);
    if (isNaN(h)) h = 8;
    if (ampmStr === 'AM') {
      if (h === 12) h = 0;
    } else {
      if (h < 12) h += 12;
    }
    const h24 = String(h).padStart(2, '0');
    const m24 = String(minStr || '00').padStart(2, '0');
    return `${h24}:${m24}`;
  };

  // Helper: Short display for break times to prevent nocliping outside compact inputs
  const formatBreakDisplay = (val) => {
    if (!val || val === 'No Break') return 'No Break';
    if (val === '0 Hour 30 Minutes' || val === '30m' || val === '30 min') return '30 min';
    if (val === '0 Hour 45 Minutes' || val === '45m' || val === '45 min') return '45 min';
    if (val === '1 Hour 0 Minutes' || val === '1h' || val === '1 hr') return '1 hr';
    return val;
  };

  // Open the Time Picker Modal
  const openTimePicker = (dayIndex, field, currentVal24) => {
    setTimePickerTargetDayIndex(dayIndex);
    setTimePickerTargetField(field);

    if (currentVal24 && currentVal24.includes(':')) {
      const parts = currentVal24.trim().split(':');
      let h = parseInt(parts[0], 10);
      const m = parts[1] || '00';
      const ampm = h >= 12 ? 'PM' : 'AM';
      let h12 = h % 12;
      if (h12 === 0) h12 = 12;
      setSelectedAmPm(ampm);
      setSelectedHour12(String(h12).padStart(2, '0'));
      setSelectedMinute(m);
    } else {
      // Default: CheckIn defaults to 08:00 AM, CheckOut defaults to 04:30 PM
      if (field === 'checkIn') {
        setSelectedAmPm('AM');
        setSelectedHour12('08');
        setSelectedMinute('30');
      } else {
        setSelectedAmPm('PM');
        setSelectedHour12('04');
        setSelectedMinute('30');
      }
    }
    setShowTimePickerModal(true);
  };

  // Save selected time into state as 24h (HH:MM)
  const saveSelectedTime = () => {
    const time24 = convert12To24(selectedHour12, selectedMinute, selectedAmPm);
    updateDay(timePickerTargetDayIndex, timePickerTargetField, time24);
    setShowTimePickerModal(false);
  };

  // Clear selected time
  const clearSelectedTime = () => {
    updateDay(timePickerTargetDayIndex, timePickerTargetField, '');
    setShowTimePickerModal(false);
  };

  // Sync initialJobData from Hero Ops if passed
  useEffect(() => {
    if (initialJobData) {
      // Find the first empty day or default to Thursday (index 0)
      const targetIdx = days.findIndex((d) => !d.checkIn) !== -1
        ? days.findIndex((d) => !d.checkIn)
        : 0;

      setDays((prev) => {
        const copy = [...prev];
        copy[targetIdx] = {
          ...copy[targetIdx],
          client: initialJobData.client || copy[targetIdx].client,
          projectCode: initialJobData.storeCode || copy[targetIdx].projectCode,
          workDetails: initialJobData.workDetails || copy[targetIdx].workDetails,
          expanded: true,
        };
        return copy;
      });

      if (initialJobData.notes) {
        setComments((prev) => (prev ? `${prev}\n${initialJobData.notes}` : initialJobData.notes));
      }
    }
  }, [initialJobData]);

  // Update a single day's property
  const updateDay = (index, field, value) => {
    setDays((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Clear day
  const clearDay = (index) => {
    setDays((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        client: '',
        projectCode: '',
        workDetails: '',
        checkIn: '',
        checkOut: '',
        breakHours: '0 Hour 30 Minutes',
        nonBillable: '',
        kmStart: '',
        kmFinish: '',
        breakfast: false,
        lunch: false,
        dinner: false,
      };
      return copy;
    });
  };

  // When user pastes text into the ServiceM8 modal
  const handleServiceM8TextChange = (text) => {
    setServiceM8InputText(text);
    if (text.trim().length > 10) {
      const parsed = parseServiceM8Job(text);
      setParsedPreview(parsed);
    } else {
      setParsedPreview(null);
    }
  };

  // Apply parsed ServiceM8 job to selected day
  const handleApplyServiceM8ToDay = () => {
    if (!parsedPreview) {
      const parsed = parseServiceM8Job(serviceM8InputText);
      if (!parsed) {
        setExportNotice('Error: Could not parse job details. Ensure text contains affected asset or work order.');
        setTimeout(() => setExportNotice(null), 3000);
        return;
      }
      setParsedPreview(parsed);
    }

    const data = parsedPreview || parseServiceM8Job(serviceM8InputText);
    if (data) {
      setDays((prev) => {
        const copy = [...prev];
        copy[pasteTargetDayIndex] = {
          ...copy[pasteTargetDayIndex],
          client: data.timesheet.client || copy[pasteTargetDayIndex].client,
          projectCode: data.timesheet.locationCode || copy[pasteTargetDayIndex].projectCode, // location code only!
          workDetails: data.timesheet.workDetails || copy[pasteTargetDayIndex].workDetails,
          checkIn: copy[pasteTargetDayIndex].checkIn || '08:00',
          checkOut: copy[pasteTargetDayIndex].checkOut || '16:30',
          expanded: true,
        };
        return copy;
      });

      setShowPasteModal(false);
      setServiceM8InputText('');
      setParsedPreview(null);
      setExportNotice(`✓ Updated ${DAYS_ORDER[pasteTargetDayIndex]}: ${data.timesheet.workDetails}`);
      setTimeout(() => setExportNotice(null), 3500);
    }
  };

  // Calculate totals
  const totals = useMemo(() => {
    let totalNetHours = 0;
    let totalKm = 0;
    let totalMeals = 0;
    let activeDays = 0;

    days.forEach((d) => {
      const stats = calculateDayStats(d);
      if (stats.netHours > 0) activeDays++;
      totalNetHours += stats.netHours;
      totalKm += stats.kmTravelled;
      totalMeals += stats.mealsCount;
    });

    return { totalNetHours, totalKm, totalMeals, activeDays };
  }, [days]);

  // Active day with times or data for blueprint card
  const activeDay = useMemo(() => {
    return days.find((d) => d.checkIn && d.checkOut) || days.find((d) => d.client || d.workDetails);
  }, [days]);

  // Shift Session & Recorded Jobs summary for blueprint card
  const departureTime = shiftSession?.departureTime || activeDay?.checkIn || '';
  const returnTime = shiftSession?.returnTime || activeDay?.checkOut || '';

  const { calcTotalStr, calcBillableStr } = useMemo(() => {
    if (!departureTime || !returnTime) {
      return { calcTotalStr: '0h 00m', calcBillableStr: '0h 00m' };
    }
    try {
      const [depH, depM] = departureTime.split(':').map(Number);
      const [retH, retM] = returnTime.split(':').map(Number);
      let diffMinutes = (retH * 60 + (retM || 0)) - (depH * 60 + (depM || 0));
      if (diffMinutes < 0) diffMinutes += 24 * 60;
      const totalH = Math.floor(diffMinutes / 60);
      const totalM = diffMinutes % 60;
      const billableMinutes = Math.max(0, diffMinutes - 30);
      const billH = Math.floor(billableMinutes / 60);
      const billM = billableMinutes % 60;
      return {
        calcTotalStr: `${totalH}h ${totalM > 0 ? `${totalM}m` : '00m'}`,
        calcBillableStr: `${billH}h ${billM > 0 ? `${billM}m` : '00m'}`,
      };
    } catch (e) {
      return { calcTotalStr: '0h 00m', calcBillableStr: '0h 00m' };
    }
  }, [departureTime, returnTime]);

  const summaryJobs = useMemo(() => {
    const list = [];
    if (shiftSession?.completedJobs && shiftSession.completedJobs.length > 0) {
      list.push(...shiftSession.completedJobs);
    }
    // Also include any day that has a client or workDetails logged in the timesheet!
    days.forEach((d) => {
      if (d.client || d.workDetails) {
        const alreadyIn = list.some(
          (item) =>
            (item.title === d.workDetails || item.jobTypeTitle === d.workDetails) &&
            item.client === d.client
        );
        if (!alreadyIn) {
          list.push({
            id: `day-${d.dayName}`,
            timeRange: d.checkIn && d.checkOut
              ? `${format24To12Display(d.checkIn)} → ${format24To12Display(d.checkOut)}`
              : (d.checkIn ? format24To12Display(d.checkIn) : d.dayName.toUpperCase()),
            title: d.workDetails || 'Media Player Swap',
            sub: `${d.client} ${d.projectCode ? `(${d.projectCode})` : ''}`.trim(),
            dayName: d.dayName,
          });
        }
      }
    });
    return list;
  }, [shiftSession?.completedJobs, days]);

  // Export & send handler
  const handleExportAndSend = async () => {
    setLoading(true);
    setExportNotice(null);
    try {
      const bytes = await generateFilledTimesheetWorkbook({
        profile,
        weekEnding,
        days,
        comments,
        signatureDate: weekEnding,
      });

      const res = await exportAndSendTimesheet({
        bytes,
        weekEnding,
        profile,
        recipientEmail: targetEmail,
      });

      setExportNotice(res.message || 'Timesheet generated successfully!');
      if (Alert && Alert.alert) {
        Alert.alert('Success', res.message);
      }
    } catch (err) {
      console.error('Failed to export timesheet:', err);
      const msg = err.message || 'Could not export timesheet.';
      setExportNotice(`Error: ${msg}`);
      if (Alert && Alert.alert) {
        Alert.alert('Export Failed', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // Clear All Timesheet Entries: Open Modal
  const handleClearAllTimesheet = () => {
    setShowClearConfirmModal(true);
  };

  // Perform the actual timesheet reset
  const executeClearAll = () => {
    setDays(
      DAYS_ORDER.map((name) => ({
        dayName: name,
        client: '',
        projectCode: '',
        workDetails: '',
        checkIn: '',
        checkOut: '',
        breakHours: '0 Hour 30 Minutes',
        nonBillable: '',
        kmStart: '',
        kmFinish: '',
        breakfast: false,
        lunch: false,
        dinner: false,
        expanded: false,
      }))
    );
    setComments('');
    setServiceM8InputText('');
    setParsedPreview(null);
    if (onResetSession) {
      onResetSession();
    }
    setShowClearConfirmModal(false);
    setExportNotice('Timesheet cleared.');
    setTimeout(() => setExportNotice(null), 3000);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header Bar */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.appTitle}>AUTO TIMESHEET FILLER</Text>
          <Text style={styles.appSubtitle}>Template (09/09/2026 v5.0) • Ready for Payroll</Text>
        </View>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={styles.clearAllBtn}
            onPress={handleClearAllTimesheet}
            activeOpacity={0.7}
            accessibilityLabel="Clear all timesheet entries"
          >
            <Ionicons name="trash-outline" size={13} color="#ef4444" style={{ marginRight: 4 }} />
            <Text style={styles.clearAllBtnText}>CLEAR ALL</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.profileBadge}
            onPress={() => setShowProfileModal(!showProfileModal)}
          >
            <Ionicons name="person-circle-outline" size={18} color={THEME.colors.primary} />
            <Text style={styles.profileBadgeText}>{profile.signature}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ========================================================================= */}
      {/* RECORDED SHIFT & JOBS SUMMARY CARD (BLUEPRINT SPEC) */}
      {/* ========================================================================= */}
      <View style={styles.blueprintTimesheetCard}>
        <View style={styles.blueprintCardHeader}>
          <Text style={styles.blueprintCardTitle}>TIMESHEET</Text>
          <Text style={styles.blueprintCardDate}>
            {activeDay
              ? `${activeDay.dayName.toUpperCase()} SHIFT`
              : (shiftSession?.dateStr ? shiftSession.dateStr.toUpperCase() : 'TODAY')}
          </Text>
        </View>

        {/* SHIFT BLOCK */}
        <View style={styles.blueprintSectionBlock}>
          <Text style={styles.blueprintSectionLabel}>SHIFT</Text>
          <Text style={styles.blueprintShiftValue}>
            {departureTime && returnTime
              ? `${format24To12Display(departureTime)} → ${format24To12Display(returnTime)}`
              : 'No active shift times recorded'}
          </Text>
        </View>

        {/* JOBS BLOCK */}
        <View style={styles.blueprintSectionBlock}>
          <Text style={styles.blueprintSectionLabel}>JOBS</Text>
          {summaryJobs.length > 0 ? (
            summaryJobs.map((j, idx) => (
              <View key={j.id || idx} style={styles.blueprintJobRow}>
                <Text style={styles.blueprintJobTime}>
                  {j.timeRange || `${format24To12Display(j.startTime)} → ${format24To12Display(j.endTime)}`}
                </Text>
                <Text style={styles.blueprintJobTitle}>
                  {j.title || j.jobTypeTitle || 'Media Player Swap'}
                </Text>
                <Text style={styles.blueprintJobSub}>
                  {j.sub || `${j.departmentLabel || j.department || ''} • ${j.client || ''}`}
                </Text>
              </View>
            ))
          ) : (
            <Text style={{ color: THEME.colors.textMuted, fontSize: 12, fontStyle: 'italic', paddingVertical: 4 }}>
              No jobs recorded yet.
            </Text>
          )}
        </View>

        {/* BREAK BLOCK */}
        <View style={styles.blueprintSectionBlock}>
          <Text style={styles.blueprintSectionLabel}>BREAK</Text>
          <Text style={styles.blueprintBreakValue}>
            {departureTime && returnTime ? '12:10 → 12:40' : 'No break recorded'}
          </Text>
        </View>

        <View style={styles.blueprintDivider} />

        {/* TOTAL & BILLABLE */}
        <View style={styles.blueprintTotalsRow}>
          <Text style={styles.blueprintTotalText}>TOTAL: {calcTotalStr}</Text>
          <Text style={styles.blueprintBillableText}>BILLABLE: {calcBillableStr}</Text>
        </View>

        {/* ACTIONS: EDIT, EXPORT EXCEL, EMAIL */}
        <View style={styles.blueprintActionsRow}>
          <TouchableOpacity
            style={styles.blueprintActionBtn}
            onPress={() => {
              setDays((prev) => {
                const copy = [...prev];
                copy[0] = { ...copy[0], expanded: true };
                return copy;
              });
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.blueprintActionBtnText}>[ EDIT ]</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.blueprintActionBtn, styles.blueprintActionBtnGreen]}
            onPress={handleExportAndSend}
            activeOpacity={0.8}
          >
            <Text style={[styles.blueprintActionBtnText, styles.blueprintActionBtnTextGreen]}>
              [ EXPORT EXCEL ]
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.blueprintActionBtn}
            onPress={() => {
              Alert.alert(
                'Email Timesheet',
                `Send recorded shift & timesheet to ${targetEmail}?`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Send', onPress: handleExportAndSend },
                ]
              );
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.blueprintActionBtnText}>[ EMAIL ]</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* QUICK ACTIONS BAR: PASTE SERVICEM8 BUTTON */}
      <View style={styles.quickBar}>
        <TouchableOpacity
          style={styles.pasteM8Button}
          onPress={() => {
            setPasteTargetDayIndex(0);
            setShowPasteModal(true);
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="clipboard" size={18} color="#000" style={{ marginRight: 6 }} />
          <Text style={styles.pasteM8ButtonText}>PASTE SERVICEM8 JOB</Text>
        </TouchableOpacity>
      </View>

      {/* Profile Details (Collapsible) */}
      {showProfileModal && (
        <View style={styles.profileCard}>
          <Text style={styles.sectionHeading}>TECHNICIAN DETAILS</Text>
          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Name:</Text>
            <TextInput
              style={styles.textInput}
              value={profile.employeeName}
              onChangeText={(t) => setProfile({ ...profile, employeeName: t })}
            />
          </View>
          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Supervisor:</Text>
            <TextInput
              style={styles.textInput}
              value={profile.supervisorName}
              onChangeText={(t) => setProfile({ ...profile, supervisorName: t })}
            />
          </View>
          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Signature:</Text>
            <TextInput
              style={styles.textInput}
              value={profile.signature}
              onChangeText={(t) => setProfile({ ...profile, signature: t })}
            />
          </View>
          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Rego:</Text>
            <TextInput
              style={styles.textInput}
              value={profile.vehicleRego}
              onChangeText={(t) => setProfile({ ...profile, vehicleRego: t })}
            />
          </View>
          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Send Email To:</Text>
            <TextInput
              style={styles.textInput}
              value={targetEmail}
              onChangeText={setTargetEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        </View>
      )}

      {/* Week Ending & Quick Email Bar */}
      <View style={styles.weekEndingCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.miniLabel}>WEEK ENDING (WEDNESDAY):</Text>
          <TextInput
            style={styles.dateInput}
            value={weekEnding}
            onChangeText={setWeekEnding}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={THEME.colors.textDim}
          />
        </View>
        <View style={{ flex: 1.2, marginLeft: 10 }}>
          <Text style={styles.miniLabel}>SEND TO EMAIL:</Text>
          <TextInput
            style={styles.dateInput}
            value={targetEmail}
            onChangeText={setTargetEmail}
            placeholder="your-email@ithero.com.au"
            placeholderTextColor={THEME.colors.textDim}
          />
        </View>
      </View>

      {/* TOGGLES: KM & LIVING AWAY (HIDDEN BY DEFAULT AS REQUESTED) */}
      <View style={styles.toggleBar}>
        <TouchableOpacity
          style={[styles.togglePill, enableKmTracking && styles.togglePillActive]}
          onPress={() => setEnableKmTracking(!enableKmTracking)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={enableKmTracking ? 'checkbox' : 'square-outline'}
            size={16}
            color={enableKmTracking ? '#000' : THEME.colors.textMuted}
            style={{ marginRight: 5 }}
          />
          <Text style={[styles.togglePillText, enableKmTracking && styles.togglePillTextActive]}>
            Track Vehicle KM
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.togglePill, enableLivingAway && styles.togglePillActive]}
          onPress={() => setEnableLivingAway(!enableLivingAway)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={enableLivingAway ? 'checkbox' : 'square-outline'}
            size={16}
            color={enableLivingAway ? '#000' : THEME.colors.textMuted}
            style={{ marginRight: 5 }}
          />
          <Text style={[styles.togglePillText, enableLivingAway && styles.togglePillTextActive]}>
            Living Away (Meals)
          </Text>
        </TouchableOpacity>
      </View>

      {/* Live Totals Banner */}
      <View style={styles.totalsBanner}>
        <View style={styles.totalStat}>
          <Text style={styles.totalStatValue}>{totals.totalNetHours.toFixed(2)}h</Text>
          <Text style={styles.totalStatLabel}>TOTAL HOURS</Text>
        </View>

        {enableKmTracking && (
          <>
            <View style={styles.totalDivider} />
            <View style={styles.totalStat}>
              <Text style={styles.totalStatValue}>{totals.totalKm.toFixed(0)} km</Text>
              <Text style={styles.totalStatLabel}>KM TRAVEL</Text>
            </View>
          </>
        )}

        {enableLivingAway && (
          <>
            <View style={styles.totalDivider} />
            <View style={styles.totalStat}>
              <Text style={styles.totalStatValue}>{totals.totalMeals}</Text>
              <Text style={styles.totalStatLabel}>MEAL CLAIMS</Text>
            </View>
          </>
        )}
      </View>

      {/* Days List */}
      <Text style={styles.sectionTitle}>WEEKLY SHIFT LOGS (THU - WED)</Text>
      {days.map((day, index) => {
        const stats = calculateDayStats(day);
        const hasData = day.checkIn && day.checkOut;

        return (
          <View
            key={day.dayName}
            style={[
              styles.dayCard,
              hasData ? styles.dayCardActive : styles.dayCardInactive,
            ]}
          >
            {/* Day Header Row */}
            <View style={styles.dayHeader}>
              <View style={styles.dayNameGroup}>
                <Text style={styles.dayName}>{day.dayName.toUpperCase()}</Text>
                {day.client ? (
                  <Text style={styles.dayClientPreview} numberOfLines={1}>
                    {day.client} {day.projectCode ? `(${day.projectCode})` : ''}
                  </Text>
                ) : (
                  <Text style={styles.dayOffText}>
                    {hasData ? `${stats.netHours.toFixed(2)} hrs logged` : 'Off / No Log'}
                  </Text>
                )}
              </View>

              <View style={styles.dayStatsGroup}>
                {hasData && (
                  <View style={styles.hoursBadge}>
                    <Text style={styles.hoursBadgeText}>{stats.netHours.toFixed(2)} hrs</Text>
                  </View>
                )}

                {/* Direct quick paste button for this specific day */}
                <TouchableOpacity
                  style={styles.dayPasteBtn}
                  onPress={() => {
                    setPasteTargetDayIndex(index);
                    setShowPasteModal(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="clipboard-outline" size={13} color={THEME.colors.primary} />
                  <Text style={styles.dayPasteBtnText}>Paste</Text>
                </TouchableOpacity>

                {hasData && (
                  <TouchableOpacity
                    style={styles.clearMiniBtn}
                    onPress={() => clearDay(index)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.clearMiniBtnText}>Clear</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.detailsToggleBtn}
                  onPress={() => updateDay(index, 'expanded', !day.expanded)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.detailsToggleText}>{day.expanded ? 'Less' : 'More'}</Text>
                  <Ionicons
                    name={day.expanded ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color={THEME.colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Direct Inputs: Start Time (12h selector -> 24h store), Finished Time, Break Time */}
            <View style={styles.timeInputsRow}>
              {/* Start Time Picker Button */}
              <View style={styles.timeInputCol}>
                <Text style={styles.timeInputLabel}>START TIME</Text>
                <TouchableOpacity
                  style={styles.timePickerBtn}
                  onPress={() => openTimePicker(index, 'checkIn', day.checkIn)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="time-outline" size={13} color={THEME.colors.primary} style={{ marginRight: 4, flexShrink: 0 }} />
                  <Text style={[styles.timePickerBtnText, !day.checkIn && styles.timePickerBtnTextPlaceholder]} numberOfLines={1}>
                    {format24To12Display(day.checkIn) || 'Set Start'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Finished Time Picker Button */}
              <View style={styles.timeInputCol}>
                <Text style={styles.timeInputLabel}>FINISHED TIME</Text>
                <TouchableOpacity
                  style={styles.timePickerBtn}
                  onPress={() => openTimePicker(index, 'checkOut', day.checkOut)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="time-outline" size={13} color={THEME.colors.primary} style={{ marginRight: 4, flexShrink: 0 }} />
                  <Text style={[styles.timePickerBtnText, !day.checkOut && styles.timePickerBtnTextPlaceholder]} numberOfLines={1}>
                    {format24To12Display(day.checkOut) || 'Set Finish'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Break Time */}
              <View style={styles.timeInputCol}>
                <Text style={styles.timeInputLabel}>BREAK TIME</Text>
                <TouchableOpacity
                  style={styles.timePickerBtn}
                  onPress={() => {
                    const breaks = ['No Break', '0 Hour 30 Minutes', '0 Hour 45 Minutes', '1 Hour 0 Minutes'];
                    const currentIdx = breaks.indexOf(day.breakHours);
                    const nextVal = currentIdx === -1 || currentIdx === breaks.length - 1 ? breaks[0] : breaks[currentIdx + 1];
                    updateDay(index, 'breakHours', nextVal);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="cafe-outline" size={13} color={THEME.colors.accentCyan} style={{ marginRight: 4, flexShrink: 0 }} />
                  <Text style={styles.timePickerBtnText} numberOfLines={1}>
                    {formatBreakDisplay(day.breakHours)}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Break Quick Select Pills */}
            <View style={styles.breakPillsRow}>
              {['No Break', '0 Hour 30 Minutes', '0 Hour 45 Minutes', '1 Hour 0 Minutes'].map((opt) => {
                const isSelected = day.breakHours === opt;
                const label =
                  opt === 'No Break'
                    ? 'No Break'
                    : opt === '0 Hour 30 Minutes'
                    ? '30 min'
                    : opt === '0 Hour 45 Minutes'
                    ? '45 min'
                    : '1 hr';

                return (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.breakPill, isSelected && styles.breakPillActive]}
                    onPress={() => updateDay(index, 'breakHours', opt)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.breakPillText, isSelected && styles.breakPillTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Expanded Day Details (Client, Location Code, Work Details, and optional KM/Living Away) */}
            {day.expanded && (
              <View style={styles.dayBody}>
                {/* Client & Code (Location code only) */}
                <View style={styles.formRow}>
                  <View style={{ flex: 2, marginRight: 8 }}>
                    <Text style={styles.fieldLabel}>Client / Store Location:</Text>
                    <TextInput
                      style={styles.formInput}
                      value={day.client}
                      onChangeText={(t) => updateDay(index, 'client', t)}
                      placeholder="e.g. Woolworths Eastern Creek"
                      placeholderTextColor={THEME.colors.textDim}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Store Code Only:</Text>
                    <TextInput
                      style={styles.formInput}
                      value={day.projectCode}
                      onChangeText={(t) => updateDay(index, 'projectCode', t)}
                      placeholder="1003"
                      placeholderTextColor={THEME.colors.textDim}
                    />
                  </View>
                </View>

                {/* Common Client Picker Chips */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.clientChipsScroll}>
                  {COMMON_CLIENTS.map((c) => (
                    <TouchableOpacity
                      key={c.code}
                      style={styles.clientPickerChip}
                      onPress={() => {
                        updateDay(index, 'client', c.label);
                        updateDay(index, 'projectCode', c.code);
                        updateDay(index, 'workDetails', c.desc);
                      }}
                    >
                      <Text style={styles.clientPickerChipText}>{c.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Work Details */}
                <View style={{ marginTop: 8 }}>
                  <Text style={styles.fieldLabel}>Work Details:</Text>
                  <TextInput
                    style={styles.formInput}
                    value={day.workDetails}
                    onChangeText={(t) => updateDay(index, 'workDetails', t)}
                    placeholder="e.g. Swap out media player - Seafood (WO: 0443161)"
                    placeholderTextColor={THEME.colors.textDim}
                  />
                </View>

                {/* KM Start & KM Finish (ONLY SHOWN IF enableKmTracking IS CHECKED) */}
                {enableKmTracking && (
                  <View style={[styles.formRow, { marginTop: 10 }]}>
                    <View style={{ flex: 1, marginRight: 6 }}>
                      <Text style={styles.fieldLabel}>KM Start:</Text>
                      <TextInput
                        style={styles.formInput}
                        value={day.kmStart ? String(day.kmStart) : ''}
                        onChangeText={(t) => updateDay(index, 'kmStart', t)}
                        keyboardType="numeric"
                        placeholder="120400"
                        placeholderTextColor={THEME.colors.textDim}
                      />
                    </View>
                    <View style={{ flex: 1, marginRight: 6 }}>
                      <Text style={styles.fieldLabel}>KM Finish:</Text>
                      <TextInput
                        style={styles.formInput}
                        value={day.kmFinish ? String(day.kmFinish) : ''}
                        onChangeText={(t) => updateDay(index, 'kmFinish', t)}
                        keyboardType="numeric"
                        placeholder="120520"
                        placeholderTextColor={THEME.colors.textDim}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>Non-Billable:</Text>
                      <TextInput
                        style={styles.formInput}
                        value={day.nonBillable ? String(day.nonBillable) : ''}
                        onChangeText={(t) => updateDay(index, 'nonBillable', t)}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={THEME.colors.textDim}
                      />
                    </View>
                  </View>
                )}

                {/* Living Away From Home Meals (ONLY SHOWN IF enableLivingAway IS CHECKED) */}
                {enableLivingAway && (
                  <View style={styles.mealsGroup}>
                    <Text style={styles.fieldLabel}>Living Away Allowance (Meals):</Text>
                    <View style={styles.mealTogglesRow}>
                      <TouchableOpacity
                        style={[styles.mealToggle, day.breakfast && styles.mealToggleActive]}
                        onPress={() => updateDay(index, 'breakfast', !day.breakfast)}
                      >
                        <Text style={[styles.mealToggleText, day.breakfast && styles.mealToggleTextActive]}>
                          Breakfast {day.breakfast ? '✓' : ''}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.mealToggle, day.lunch && styles.mealToggleActive]}
                        onPress={() => updateDay(index, 'lunch', !day.lunch)}
                      >
                        <Text style={[styles.mealToggleText, day.lunch && styles.mealToggleTextActive]}>
                          Lunch {day.lunch ? '✓' : ''}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.mealToggle, day.dinner && styles.mealToggleActive]}
                        onPress={() => updateDay(index, 'dinner', !day.dinner)}
                      >
                        <Text style={[styles.mealToggleText, day.dinner && styles.mealToggleTextActive]}>
                          Dinner {day.dinner ? '✓' : ''}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
        );
      })}

      {/* Comments Section */}
      <View style={styles.commentsCard}>
        <View style={styles.commentsHeader}>
          <Text style={styles.sectionHeading}>TIMESHEET COMMENTS / NOTES</Text>
        </View>
        <TextInput
          style={styles.commentsInput}
          value={comments}
          onChangeText={setComments}
          multiline
          numberOfLines={3}
          placeholder="e.g. Media player didn't come with bracket so used heavy duty zip ties."
          placeholderTextColor={THEME.colors.textDim}
        />
      </View>

      {/* Status Notice */}
      {exportNotice && (
        <View style={styles.noticeCard}>
          <Ionicons name="checkmark-circle" size={20} color={THEME.colors.success} />
          <Text style={styles.noticeText}>{exportNotice}</Text>
        </View>
      )}

      {/* Primary Action Buttons */}
      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleExportAndSend}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <>
              <Ionicons name="mail" size={20} color="#000" style={{ marginRight: 8 }} />
              <Text style={styles.primaryButtonText}>AUTO-FILL & EMAIL TIMESHEET</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleExportAndSend}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Ionicons name="cloud-download-outline" size={18} color={THEME.colors.primary} style={{ marginRight: 6 }} />
          <Text style={styles.secondaryButtonText}>DOWNLOAD .XLSX FILE</Text>
        </TouchableOpacity>
      </View>

      {/* ========================================================================= */}
      {/* SERVICE M8 TICKET PASTE MODAL */}
      {/* ========================================================================= */}
      <Modal visible={showPasteModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="clipboard" size={20} color={THEME.colors.primary} style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>PASTE SERVICEM8 TICKET</Text>
              </View>
              <TouchableOpacity onPress={() => setShowPasteModal(false)}>
                <Ionicons name="close-circle" size={24} color={THEME.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSub}>
              Paste your ticket text below. Store location, code, and work details will automatically fill:
            </Text>

            {/* Target Day Picker */}
            <Text style={styles.modalDayLabel}>SELECT SHIFT DAY TO AUTO-FILL:</Text>
            <View style={styles.dayPickerRow}>
              {DAYS_ORDER.map((dName, idx) => (
                <TouchableOpacity
                  key={dName}
                  style={[
                    styles.dayPickerChip,
                    pasteTargetDayIndex === idx && styles.dayPickerChipActive,
                  ]}
                  onPress={() => setPasteTargetDayIndex(idx)}
                >
                  <Text
                    style={[
                      styles.dayPickerChipText,
                      pasteTargetDayIndex === idx && styles.dayPickerChipTextActive,
                    ]}
                  >
                    {dName.slice(0, 3)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.modalInput}
              value={serviceM8InputText}
              onChangeText={handleServiceM8TextChange}
              multiline
              numberOfLines={6}
              placeholder="Paste ticket text here (e.g. Work Order Number: 0443161, Affected Asset: 1003-NSW-EasternCreek-Seafood...)"
              placeholderTextColor={THEME.colors.textDim}
            />

            {/* Live Parsed Preview */}
            {parsedPreview && (
              <View style={styles.previewBox}>
                <Text style={styles.previewHeading}>EXTRACTED DETAILS:</Text>
                <Text style={styles.previewItem}>
                  • <Text style={{ fontWeight: 'bold' }}>Client / Store:</Text> {parsedPreview.timesheet.client}
                </Text>
                <Text style={styles.previewItem}>
                  • <Text style={{ fontWeight: 'bold' }}>Store Code Only:</Text> {parsedPreview.timesheet.locationCode}
                </Text>
                <Text style={styles.previewItem}>
                  • <Text style={{ fontWeight: 'bold' }}>Work Details:</Text> {parsedPreview.timesheet.workDetails}
                </Text>
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setShowPasteModal(false);
                  setServiceM8InputText('');
                  setParsedPreview(null);
                }}
              >
                <Text style={styles.modalCancelBtnText}>CANCEL</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleApplyServiceM8ToDay}
              >
                <Text style={styles.modalSubmitBtnText}>AUTO-FILL TO {DAYS_ORDER[pasteTargetDayIndex].toUpperCase()}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* 12-Hour AM/PM Time Selector Modal */}
      <Modal
        visible={showTimePickerModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowTimePickerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.timePickerModalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="time" size={20} color={THEME.colors.primary} style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>
                  SELECT {timePickerTargetField === 'checkIn' ? 'START' : 'FINISHED'} TIME
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowTimePickerModal(false)}>
                <Ionicons name="close" size={22} color={THEME.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.timePickerSubheading}>
              Setting time for {DAYS_ORDER[timePickerTargetDayIndex]} • Stored as standard 24-hr in Excel
            </Text>

            {/* AM / PM Segment Selector (User requested: AM first then PM) */}
            <Text style={styles.timePickerSectionLabel}>1. PERIOD (AM / PM):</Text>
            <View style={styles.amPmSelectorRow}>
              <TouchableOpacity
                style={[
                  styles.amPmBtn,
                  selectedAmPm === 'AM' && styles.amPmBtnActive,
                ]}
                onPress={() => setSelectedAmPm('AM')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="sunny"
                  size={18}
                  color={selectedAmPm === 'AM' ? '#000' : THEME.colors.primary}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.amPmBtnText, selectedAmPm === 'AM' && styles.amPmBtnTextActive]}>
                  AM (Morning)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.amPmBtn,
                  selectedAmPm === 'PM' && styles.amPmBtnActive,
                ]}
                onPress={() => setSelectedAmPm('PM')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="moon"
                  size={18}
                  color={selectedAmPm === 'PM' ? '#000' : THEME.colors.primary}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.amPmBtnText, selectedAmPm === 'PM' && styles.amPmBtnTextActive]} numberOfLines={1}>
                  PM (Evening)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Hour Selector (1..12) */}
            <Text style={styles.timePickerSectionLabel}>2. HOUR (1 - 12):</Text>
            <View style={styles.gridSelector}>
              {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((h) => {
                const isSel = selectedHour12 === h;
                return (
                  <TouchableOpacity
                    key={h}
                    style={[styles.gridCell, isSel && styles.gridCellActive]}
                    onPress={() => setSelectedHour12(h)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.gridCellText, isSel && styles.gridCellTextActive]}>
                      {parseInt(h, 10)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Minute Selector */}
            <Text style={styles.timePickerSectionLabel}>3. MINUTE:</Text>
            <View style={styles.gridSelector}>
              {['00', '15', '30', '45'].map((m) => {
                const isSel = selectedMinute === m;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[styles.gridCellQuarter, isSel && styles.gridCellActive]}
                    onPress={() => setSelectedMinute(m)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.gridCellText, isSel && styles.gridCellTextActive]}>
                      :{m}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Custom Minute Input row */}
            <View style={styles.customMinRow}>
              <Text style={styles.customMinLabel}>Or exact minute:</Text>
              <TextInput
                style={styles.customMinInput}
                value={selectedMinute}
                onChangeText={(t) => {
                  const cleaned = t.replace(/[^0-9]/g, '').slice(0, 2);
                  setSelectedMinute(cleaned);
                }}
                keyboardType="numeric"
                maxLength={2}
                placeholder="00"
                placeholderTextColor={THEME.colors.textDim}
              />
            </View>

            {/* Live Preview Box */}
            <View style={styles.timePreviewCard}>
              <View>
                <Text style={styles.timePreviewMicro}>SELECTED 12-HOUR TIME:</Text>
                <Text style={styles.timePreviewDisplay}>
                  {parseInt(selectedHour12, 10)}:{selectedMinute || '00'} {selectedAmPm}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.timePreviewMicro}>EXCEL (24-HR):</Text>
                <Text style={styles.timePreview24}>
                  {convert12To24(selectedHour12, selectedMinute, selectedAmPm)}
                </Text>
              </View>
            </View>

            {/* Modal Action Buttons */}
            <View style={styles.timePickerActionsRow}>
              <TouchableOpacity
                style={styles.timePickerClearBtn}
                onPress={clearSelectedTime}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={15} color="#ef4444" style={{ marginRight: 4 }} />
                <Text style={styles.timePickerClearBtnText}>CLEAR</Text>
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowTimePickerModal(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalCancelBtnText}>CANCEL</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.timePickerConfirmBtn}
                  onPress={saveSelectedTime}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark" size={16} color="#000" style={{ marginRight: 4 }} />
                  <Text style={styles.timePickerConfirmBtnText}>CONFIRM TIME</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* CLEAR ALL CONFIRMATION MODAL (100% RELIABLE CROSS-PLATFORM) */}
      {/* ========================================================================= */}
      <Modal visible={showClearConfirmModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxWidth: 440, borderColor: '#ef4444', borderWidth: 1.5, alignSelf: 'center', width: '92%' }]}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: '#ef4444',
                }}
              >
                <Ionicons name="trash" size={26} color="#ef4444" />
              </View>
              <Text style={[styles.modalTitle, { color: '#ef4444', textAlign: 'center', fontSize: 16 }]}>
                CLEAR ALL TIMESHEET ENTRIES?
              </Text>
              <Text
                style={{
                  color: THEME.colors.textDim,
                  fontSize: 13,
                  lineHeight: 19,
                  textAlign: 'center',
                  marginTop: 8,
                }}
              >
                Are you sure you want to clear all entered shifts, jobs, hours, and notes? This will wipe the timesheet so you can restart fresh.
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <TouchableOpacity
                style={[
                  styles.modalCancelBtn,
                  { flex: 1, backgroundColor: THEME.colors.surface, borderColor: THEME.colors.border, borderWidth: 1 },
                ]}
                onPress={() => setShowClearConfirmModal(false)}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalCancelBtnText, { color: THEME.colors.text }]}>CANCEL</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.timePickerConfirmBtn,
                  { flex: 1, backgroundColor: '#ef4444' },
                ]}
                onPress={executeClearAll}
                activeOpacity={0.8}
              >
                <Ionicons name="trash" size={16} color="#ffffff" style={{ marginRight: 4 }} />
                <Text style={[styles.timePickerConfirmBtnText, { color: '#ffffff' }]}>YES, CLEAR ALL</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.bg,
  },
  content: {
    padding: THEME.spacing.md,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 4,
  },
  appTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: THEME.colors.text,
    letterSpacing: 0.5,
  },
  appSubtitle: {
    fontSize: 11,
    color: THEME.colors.textDim,
    marginTop: 2,
    fontWeight: '600',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clearAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: '#ef4444',
    borderWidth: 1,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 7,
  },
  clearAllBtnText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  profileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  profileBadgeText: {
    color: THEME.colors.text,
    fontWeight: '800',
    fontSize: 12,
    marginLeft: 4,
  },
  quickBar: {
    marginBottom: 12,
  },
  pasteM8Button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.primary,
    paddingVertical: 10,
    borderRadius: 8,
  },
  pasteM8ButtonText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  profileCard: {
    backgroundColor: THEME.colors.surface,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 12,
  },
  sectionHeading: {
    color: THEME.colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputLabel: {
    width: 90,
    color: THEME.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  textInput: {
    flex: 1,
    backgroundColor: THEME.colors.card,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    paddingHorizontal: 8,
    paddingVertical: 4,
    color: THEME.colors.text,
    fontSize: 12,
  },
  weekEndingCard: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.surface,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 10,
  },
  miniLabel: {
    color: THEME.colors.textDim,
    fontSize: 9,
    fontWeight: '800',
    marginBottom: 3,
  },
  dateInput: {
    backgroundColor: THEME.colors.card,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    paddingHorizontal: 8,
    paddingVertical: 5,
    color: THEME.colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  // TOGGLE BAR FOR KM & LIVING AWAY
  toggleBar: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  togglePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.surface,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginRight: 6,
  },
  togglePillActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  togglePillText: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  togglePillTextActive: {
    color: '#000',
    fontWeight: '900',
  },
  totalsBanner: {
    flexDirection: 'row',
    backgroundColor: '#0c1524',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 16,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  totalStat: {
    alignItems: 'center',
  },
  totalStatValue: {
    color: THEME.colors.primary,
    fontSize: 16,
    fontWeight: '900',
  },
  totalStatLabel: {
    color: THEME.colors.textDim,
    fontSize: 9,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  totalDivider: {
    width: 1,
    height: 24,
    backgroundColor: THEME.colors.border,
  },
  sectionTitle: {
    color: THEME.colors.text,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  dayCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 10,
    padding: 10,
  },
  dayCardActive: {
    borderLeftWidth: 3.5,
    borderLeftColor: THEME.colors.primary,
  },
  dayCardInactive: {
    borderLeftWidth: 3.5,
    borderLeftColor: THEME.colors.cardBorder,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dayNameGroup: {
    flex: 1,
    marginRight: 8,
  },
  dayName: {
    color: THEME.colors.text,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  dayClientPreview: {
    color: THEME.colors.primary,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  dayOffText: {
    color: THEME.colors.textDim,
    fontSize: 10,
    marginTop: 2,
  },
  dayStatsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  hoursBadge: {
    backgroundColor: '#0c2423',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: THEME.colors.primary,
    marginRight: 6,
  },
  hoursBadgeText: {
    color: THEME.colors.primary,
    fontSize: 10,
    fontWeight: '800',
  },
  dayPasteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121e33',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginRight: 6,
  },
  dayPasteBtnText: {
    color: THEME.colors.primary,
    fontSize: 10,
    fontWeight: '800',
    marginLeft: 3,
  },
  clearMiniBtn: {
    backgroundColor: '#261214',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ef4444',
    marginRight: 6,
  },
  clearMiniBtnText: {
    color: '#ef4444',
    fontSize: 10,
    fontWeight: '800',
  },
  detailsToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.card,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  detailsToggleText: {
    color: THEME.colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    marginRight: 2,
  },
  timeInputsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  timeInputCol: {
    flex: 1,
    marginHorizontal: 2,
  },
  timeInputLabel: {
    color: THEME.colors.textDim,
    fontSize: 8,
    fontWeight: '800',
    marginBottom: 2,
  },
  timeTextInput: {
    backgroundColor: THEME.colors.card,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    paddingHorizontal: 6,
    paddingVertical: 5,
    color: THEME.colors.text,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  breakPillsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  breakPill: {
    flex: 1,
    backgroundColor: THEME.colors.card,
    borderRadius: 4,
    paddingVertical: 4,
    marginHorizontal: 2,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  breakPillActive: {
    backgroundColor: '#122338',
    borderColor: THEME.colors.primary,
  },
  breakPillText: {
    color: THEME.colors.textDim,
    fontSize: 9,
    fontWeight: '700',
  },
  breakPillTextActive: {
    color: THEME.colors.primary,
    fontWeight: '900',
  },
  dayBody: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  formRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  fieldLabel: {
    color: THEME.colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 2,
  },
  formInput: {
    backgroundColor: THEME.colors.card,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    paddingHorizontal: 8,
    paddingVertical: 5,
    color: THEME.colors.text,
    fontSize: 11,
  },
  clientChipsScroll: {
    marginVertical: 4,
  },
  clientPickerChip: {
    backgroundColor: '#141d2e',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 6,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  clientPickerChipText: {
    color: THEME.colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
  },
  mealsGroup: {
    marginTop: 8,
  },
  mealTogglesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 3,
  },
  mealToggle: {
    flex: 1,
    backgroundColor: THEME.colors.card,
    borderRadius: 6,
    paddingVertical: 6,
    alignItems: 'center',
    marginHorizontal: 2,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  mealToggleActive: {
    backgroundColor: '#122e23',
    borderColor: THEME.colors.success,
  },
  mealToggleText: {
    color: THEME.colors.textDim,
    fontSize: 10,
    fontWeight: '700',
  },
  mealToggleTextActive: {
    color: THEME.colors.success,
    fontWeight: '900',
  },
  commentsCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 12,
  },
  commentsHeader: {
    marginBottom: 6,
  },
  commentsInput: {
    backgroundColor: THEME.colors.card,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    padding: 8,
    color: THEME.colors.text,
    fontSize: 11,
    textAlignVertical: 'top',
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0c2423',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: THEME.colors.primary,
    marginBottom: 12,
  },
  noticeText: {
    color: THEME.colors.text,
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 8,
    flex: 1,
  },
  actionButtonsContainer: {
    marginBottom: 20,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  primaryButtonText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.surface,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.primary,
  },
  secondaryButtonText: {
    color: THEME.colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  // MODAL STYLES
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: THEME.colors.primary,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    color: THEME.colors.text,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  modalSub: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 10,
  },
  modalDayLabel: {
    color: THEME.colors.primary,
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  dayPickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  dayPickerChip: {
    backgroundColor: THEME.colors.card,
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  dayPickerChipActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  dayPickerChipText: {
    color: THEME.colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  dayPickerChipTextActive: {
    color: '#000',
    fontWeight: '900',
  },
  modalInput: {
    backgroundColor: '#05070d',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    padding: 10,
    color: THEME.colors.text,
    fontSize: 11,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  previewBox: {
    backgroundColor: '#0a1626',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1e3a8a',
    marginBottom: 12,
  },
  previewHeading: {
    color: '#60a5fa',
    fontSize: 10,
    fontWeight: '900',
    marginBottom: 4,
  },
  previewItem: {
    color: '#e2e8f0',
    fontSize: 10,
    lineHeight: 15,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    marginRight: 8,
  },
  modalCancelBtnText: {
    color: THEME.colors.textMuted,
    fontWeight: '700',
    fontSize: 12,
  },
  modalSubmitBtn: {
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  modalSubmitBtnText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 12,
  },
  // 12-HOUR TIME PICKER STYLES
  timePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.inputBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.primary,
    paddingHorizontal: 4,
    paddingVertical: 8,
    minHeight: 38,
  },
  timePickerBtnText: {
    color: THEME.colors.text,
    fontSize: 11,
    fontWeight: '800',
    flexShrink: 1,
    textAlign: 'center',
  },
  timePickerBtnTextPlaceholder: {
    color: THEME.colors.textDim,
    fontWeight: '600',
  },
  timePickerModalContent: {
    backgroundColor: THEME.colors.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    borderColor: THEME.colors.primary,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  timePickerSubheading: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    marginBottom: 12,
  },
  timePickerSectionLabel: {
    color: THEME.colors.primary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
    marginBottom: 6,
    marginTop: 4,
  },
  amPmSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  amPmBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  amPmBtnActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  amPmBtnText: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    flexShrink: 1,
    textAlign: 'center',
  },
  amPmBtnTextActive: {
    color: '#000',
    fontWeight: '900',
  },
  gridSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  gridCell: {
    width: '23%',
    backgroundColor: THEME.colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridCellQuarter: {
    width: '23%',
    backgroundColor: THEME.colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridCellActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  gridCellText: {
    color: THEME.colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  gridCellTextActive: {
    color: '#000',
    fontWeight: '900',
  },
  customMinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  customMinLabel: {
    color: THEME.colors.textDim,
    fontSize: 11,
    marginRight: 8,
  },
  customMinInput: {
    backgroundColor: THEME.colors.inputBg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: 6,
    color: THEME.colors.text,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    width: 44,
    textAlign: 'center',
  },
  timePreviewCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: THEME.colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    padding: 12,
    marginBottom: 14,
  },
  timePreviewMicro: {
    color: THEME.colors.textDim,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  timePreviewDisplay: {
    color: THEME.colors.primary,
    fontSize: 18,
    fontWeight: '900',
  },
  timePreview24: {
    color: '#60a5fa',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  timePickerActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timePickerClearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  timePickerClearBtnText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '800',
  },
  timePickerConfirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
  },
  timePickerConfirmBtnText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '900',
  },

  // BLUEPRINT TIMESHEET RECORDED SHIFT CARD
  blueprintTimesheetCard: {
    backgroundColor: '#0c1622',
    borderWidth: 1.5,
    borderColor: THEME.colors.primary,
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
  },
  blueprintCardHeader: {
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(56, 189, 248, 0.25)',
    paddingBottom: 10,
  },
  blueprintCardTitle: {
    color: THEME.colors.primary,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 4,
  },
  blueprintCardDate: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1,
  },
  blueprintSectionBlock: {
    marginBottom: 14,
  },
  blueprintSectionLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 4,
  },
  blueprintShiftValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  blueprintJobRow: {
    backgroundColor: '#070d14',
    borderLeftWidth: 3,
    borderLeftColor: THEME.colors.primary,
    padding: 10,
    borderRadius: 6,
    marginBottom: 8,
  },
  blueprintJobTime: {
    color: THEME.colors.primary,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  blueprintJobTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
  blueprintJobSub: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  blueprintBreakValue: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  blueprintDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginVertical: 12,
  },
  blueprintTotalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  blueprintTotalText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  blueprintBillableText: {
    color: '#34d399',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  blueprintActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  blueprintActionBtn: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderWidth: 1.5,
    borderColor: '#475569',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  blueprintActionBtnGreen: {
    backgroundColor: '#064e3b',
    borderColor: '#10b981',
  },
  blueprintActionBtnText: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  blueprintActionBtnTextGreen: {
    color: '#34d399',
  },
});
