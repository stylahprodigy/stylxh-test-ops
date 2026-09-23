import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../styles/theme';

export default function WarehouseSwapScreen({
  shiftSession,
  onStartDeparture,
  onFinishReturn,
  onNavigateToHeroOps,
  onSendToTimesheet,
}) {
  // Gate PIN state
  const [gateCode, setGateCode] = useState('#59582560');
  const [isEditingCode, setIsEditingCode] = useState(false);
  const [tempCode, setTempCode] = useState('#59582560');

  // Warehouse entry & lock state (User requested: Entered the Warehouse button unlocks start of day)
  const [hasEnteredWarehouse, setHasEnteredWarehouse] = useState(false);
  const [warehouseNotice, setWarehouseNotice] = useState(null);

  // Door toggles (Pressing 🚪 reveals Start of Day or End of Day checks)
  const [showStartOfDay, setShowStartOfDay] = useState(false);
  const [showEndOfDay, setShowEndOfDay] = useState(false);
  const [jobStatus, setJobStatus] = useState(shiftSession?.status || 'idle'); // 'idle' | 'on_job' | 'completed'

  const handleEnteredWarehouse = () => {
    setHasEnteredWarehouse(true);
    setShowStartOfDay(true);
    setShowEndOfDay(false);

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true });

    setWarehouseNotice(`🔔 Checked in at Warehouse HQ (${timeStr})! Start of Day checklist unlocked. Complete vehicle checks before heading out.`);
    setTimeout(() => setWarehouseNotice(null), 5000);

    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        try {
          new Notification('IT Hero Ops — Warehouse Check-In', {
            body: `You entered the warehouse at ${timeStr}. Start of Day checklist is unlocked!`,
          });
        } catch (e) {}
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then((perm) => {
          if (perm === 'granted') {
            try {
              new Notification('IT Hero Ops — Warehouse Check-In', {
                body: `You entered the warehouse at ${timeStr}. Start of Day checklist is unlocked!`,
              });
            } catch (e) {}
          }
        });
      }
    }

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }
  };

  const handleResetWarehouseCheckin = () => {
    setHasEnteredWarehouse(false);
    setShowStartOfDay(false);
    setWarehouseNotice(null);
  };

  // Start of Day Checks (Before Leaving Warehouse)
  const [startOfDay, setStartOfDay] = useState({
    toolboxVerified: false,
    replacementPartVerified: false,
  });

  // End of Day Checks (Upon Return to Warehouse)
  const [endOfDay, setEndOfDay] = useState({
    companyKeysInLock: false,
    personalKeysInPossession: false,
    toolsInPlace: false,
    returnItemsInPlace: false,
  });

  // Clipboard feedback
  const [copiedKey, setCopiedKey] = useState(null);

  const triggerCopy = (text, key) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const toggleStartCheck = (key) => {
    setStartOfDay((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleEndCheck = (key) => {
    setEndOfDay((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const saveGateCode = () => {
    setGateCode(tempCode.trim() || '#59582560');
    setIsEditingCode(false);
  };

  const readyToLeaveForJob = startOfDay.toolboxVerified && startOfDay.replacementPartVerified;
  const readyToCloseShift =
    endOfDay.companyKeysInLock &&
    endOfDay.personalKeysInPossession &&
    endOfDay.toolsInPlace &&
    endOfDay.returnItemsInPlace;

  const handleStartJob = () => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const departureTime = `${hh}:${mm}`;

    setJobStatus('on_job');
    if (onStartDeparture) {
      onStartDeparture(departureTime);
    } else if (onNavigateToHeroOps) {
      onNavigateToHeroOps();
    }
  };

  const handleArrivedAtWarehouse = () => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const returnTime = `${hh}:${mm}`;

    setJobStatus('completed');
    if (onFinishReturn) {
      onFinishReturn(returnTime);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Live Warehouse Notification Banner */}
      {warehouseNotice && (
        <View style={styles.warehouseNotificationBanner}>
          <Ionicons name="notifications" size={18} color="#000" style={{ marginRight: 8 }} />
          <Text style={styles.warehouseNotificationBannerText}>{warehouseNotice}</Text>
        </View>
      )}

      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={styles.headerIconBox}>
            <Ionicons name="business" size={24} color="#000" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>WAREHOUSE & DC</Text>
            <Text style={styles.headerSubtitle}>Start of Day • Key Access & Gate PIN</Text>
          </View>
          <View
            style={[
              styles.badgeRooty,
              jobStatus === 'on_job' && { borderColor: THEME.colors.warning },
              jobStatus === 'completed' && { borderColor: THEME.colors.success },
            ]}
          >
            <Text
              style={[
                styles.badgeRootyText,
                jobStatus === 'on_job' && { color: THEME.colors.warning },
                jobStatus === 'completed' && { color: THEME.colors.success },
              ]}
            >
              {jobStatus === 'on_job'
                ? 'ON THE JOB'
                : jobStatus === 'completed'
                ? 'AT WAREHOUSE'
                : 'DEPOT HQ'}
            </Text>
          </View>
        </View>

        {/* Access Code & Gate Entry Box */}
        <View style={styles.gateCard}>
          <View style={styles.gateCardTop}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="key" size={18} color={THEME.colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.gateCardLabel}>WAREHOUSE ENTRY / GATE CODE</Text>
            </View>
            <TouchableOpacity
              style={styles.editCodeBtn}
              onPress={() => {
                if (isEditingCode) {
                  saveGateCode();
                } else {
                  setTempCode(gateCode);
                  setIsEditingCode(true);
                }
              }}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isEditingCode ? 'checkmark-circle' : 'pencil'}
                size={14}
                color={THEME.colors.primary}
                style={{ marginRight: 4 }}
              />
              <Text style={styles.editCodeBtnText}>{isEditingCode ? 'SAVE' : 'EDIT'}</Text>
            </TouchableOpacity>
          </View>

          {isEditingCode ? (
            <View style={styles.editCodeRow}>
              <TextInput
                style={styles.editCodeInput}
                value={tempCode}
                onChangeText={setTempCode}
                placeholder="Enter Gate Code..."
                placeholderTextColor={THEME.colors.textDim}
                autoFocus
              />
              <TouchableOpacity style={styles.saveCodeBtn} onPress={saveGateCode}>
                <Text style={styles.saveCodeBtnText}>CONFIRM</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.gateCodeDisplayRow}>
              <View style={styles.gateCodeBox}>
                <Text style={styles.gateCodeText}>{gateCode}</Text>
              </View>
              <TouchableOpacity
                style={[styles.copyBtn, copiedKey === 'gateCode' && styles.copyBtnDone]}
                onPress={() => triggerCopy(gateCode, 'gateCode')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={copiedKey === 'gateCode' ? 'checkmark' : 'copy-outline'}
                  size={16}
                  color={copiedKey === 'gateCode' ? '#fff' : '#000'}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.copyBtnText, copiedKey === 'gateCode' && { color: '#fff' }]}>
                  {copiedKey === 'gateCode' ? 'COPIED!' : 'COPY CODE'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.gateTip}>
            Enter this code on the security keypad, lockbox, or boom gate for access.
          </Text>
        </View>

        {/* ENTERED THE WAREHOUSE CHECK-IN BUTTON (UNLOCKS START OF DAY) */}
        {!hasEnteredWarehouse ? (
          <View style={styles.enterWarehouseCard}>
            <View style={styles.enterWarehouseHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="location" size={18} color={THEME.colors.primary} style={{ marginRight: 6 }} />
                <Text style={styles.enterWarehouseTitle}>DEPOT ARRIVAL CHECK-IN</Text>
              </View>
              <View style={styles.lockedPill}>
                <Ionicons name="lock-closed" size={11} color={THEME.colors.warning} style={{ marginRight: 4 }} />
                <Text style={styles.lockedPillText}>START OF DAY LOCKED</Text>
              </View>
            </View>
            <Text style={styles.enterWarehouseSub}>
              Tap when you arrive inside the warehouse to trigger your notification and unlock the morning vehicle checks.
            </Text>
            <TouchableOpacity
              style={styles.enteredWarehouseBtn}
              onPress={handleEnteredWarehouse}
              activeOpacity={0.8}
            >
              <Ionicons name="enter-outline" size={20} color="#000" style={{ marginRight: 8 }} />
              <Text style={styles.enteredWarehouseBtnText}>ENTERED THE WAREHOUSE</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.enterWarehouseConfirmedCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Ionicons name="checkmark-circle" size={22} color={THEME.colors.success} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.enterWarehouseConfirmedTitle}>ENTERED THE WAREHOUSE</Text>
                <Text style={styles.enterWarehouseConfirmedSub}>
                  Checked in • Start of Day checklist unlocked
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.resetCheckinBtn}
              onPress={handleResetWarehouseCheckin}
              activeOpacity={0.7}
            >
              <Text style={styles.resetCheckinBtnText}>Reset</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* DOOR EMOJI CONTROLS (ONLY DOOR EMOJIS DISPLAYED BY DEFAULT) */}
        <View style={styles.doorEmojiContainer}>
          <View style={styles.doorEmojiRow}>
            {/* 🚪 START OF DAY DOOR */}
            <TouchableOpacity
              style={[
                styles.doorEmojiBtn,
                showStartOfDay && styles.doorEmojiBtnActive,
              ]}
              onPress={() => {
                if (!hasEnteredWarehouse) {
                  setWarehouseNotice('🔒 START OF DAY LOCKED: Tap "ENTERED THE WAREHOUSE" above first to check in and unlock!');
                  setTimeout(() => setWarehouseNotice(null), 4000);
                  return;
                }
                setShowStartOfDay((prev) => !prev);
                setShowEndOfDay(false);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.doorEmojiIcon}>🚪</Text>
              <Text style={[styles.doorEmojiLabel, showStartOfDay && styles.doorEmojiLabelActive]}>
                START OF DAY
              </Text>
              <View style={[styles.doorLockBadge, hasEnteredWarehouse ? styles.doorLockBadgeUnlocked : styles.doorLockBadgeLocked]}>
                <Ionicons
                  name={hasEnteredWarehouse ? 'lock-open-outline' : 'lock-closed-outline'}
                  size={10}
                  color={hasEnteredWarehouse ? THEME.colors.success : THEME.colors.warning}
                  style={{ marginRight: 3 }}
                />
                <Text style={[styles.doorLockBadgeText, hasEnteredWarehouse && { color: THEME.colors.success }]}>
                  {hasEnteredWarehouse ? 'UNLOCKED' : 'LOCKED'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* 🚪 END OF DAY DOOR */}
            <TouchableOpacity
              style={[
                styles.doorEmojiBtn,
                showEndOfDay && styles.doorEmojiBtnActive,
              ]}
              onPress={() => {
                setShowEndOfDay((prev) => !prev);
                setShowStartOfDay(false);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.doorEmojiIcon}>🚪</Text>
              <Text style={[styles.doorEmojiLabel, showEndOfDay && styles.doorEmojiLabelActive]}>
                END OF DAY
              </Text>
              <View style={[styles.doorLockBadge, styles.doorLockBadgeUnlocked]}>
                <Ionicons
                  name="key-outline"
                  size={10}
                  color={THEME.colors.primary}
                  style={{ marginRight: 3 }}
                />
                <Text style={[styles.doorLockBadgeText, { color: THEME.colors.primary }]}>
                  RETURN
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ========================================================================= */}
      {/* 1. START OF DAY CHECK (TOOLBOX & REPLACEMENT PART) */}
      {/* ========================================================================= */}
      {showStartOfDay && (
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="sunny" size={20} color={THEME.colors.primary} style={{ marginRight: 6 }} />
            <Text style={styles.sectionTitle}>START OF DAY CHECK</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Double check everything in your vehicle before departing for the job:
          </Text>

          <View style={styles.card}>
            {/* Check 1: Toolbox */}
            <TouchableOpacity
              style={[styles.checkRow, startOfDay.toolboxVerified && styles.checkRowDone]}
              onPress={() => toggleStartCheck('toolboxVerified')}
              activeOpacity={0.8}
            >
              <Ionicons
                name={startOfDay.toolboxVerified ? 'checkmark-circle' : 'ellipse-outline'}
                size={24}
                color={startOfDay.toolboxVerified ? THEME.colors.success : THEME.colors.primary}
                style={{ marginRight: 12 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.checkLabel, startOfDay.toolboxVerified && styles.checkLabelDone]}>
                  Toolbox verified in vehicle
                </Text>
                <Text style={styles.checkDesc}>
                  Ensure standard tool kit, screwdrivers, Allen keys, flush side cutters, and zip ties are loaded.
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Check 2: Replacement part matching assigned WO# */}
            <TouchableOpacity
              style={[styles.checkRow, startOfDay.replacementPartVerified && styles.checkRowDone]}
              onPress={() => toggleStartCheck('replacementPartVerified')}
              activeOpacity={0.8}
            >
              <Ionicons
                name={startOfDay.replacementPartVerified ? 'checkmark-circle' : 'ellipse-outline'}
                size={24}
                color={startOfDay.replacementPartVerified ? THEME.colors.success : THEME.colors.primary}
                style={{ marginRight: 12 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.checkLabel, startOfDay.replacementPartVerified && styles.checkLabelDone]}>
                  Replacement part / package matching assigned WO#
                </Text>
                <Text style={styles.checkDesc}>
                  Physically check package consignment label against ServiceM8 work order before turning vehicle ignition.
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Action: Leave warehouse for the job */}
          <TouchableOpacity
            style={[
              styles.primaryActionBtn,
              !readyToLeaveForJob && styles.primaryActionBtnDisabled,
            ]}
            onPress={() => {
              handleStartJob();
              setShowStartOfDay(false);
            }}
            disabled={!readyToLeaveForJob}
            activeOpacity={0.85}
          >
            <Ionicons name="car" size={20} color="#000" style={{ marginRight: 8 }} />
            <Text style={styles.primaryActionBtnText}>
              {readyToLeaveForJob ? '[ 🚗 LEAVE WAREHOUSE FOR THE JOB ➔ ]' : 'CHECK BOTH ITEMS TO DEPART'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ========================================================================= */}
      {/* 2. ON THE JOB IN THE FIELD */}
      {/* ========================================================================= */}
      {jobStatus === 'on_job' && (
        <View style={styles.sectionBlock}>
          <View style={styles.onJobCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <Ionicons name="navigate-circle" size={24} color={THEME.colors.warning} style={{ marginRight: 8 }} />
              <Text style={styles.onJobTitle}>CURRENTLY ON THE JOB IN THE FIELD</Text>
            </View>
            <Text style={styles.onJobDesc}>
              Complete your field work and execution in the Hero Ops tab. When you have packed up and arrived back at the warehouse depot, tap below:
            </Text>

            <View style={{ gap: 10, marginTop: 12 }}>
              <TouchableOpacity
                style={styles.heroOpsSubBtn}
                onPress={onNavigateToHeroOps}
                activeOpacity={0.85}
              >
                <Ionicons name="flash" size={18} color={THEME.colors.primary} style={{ marginRight: 6 }} />
                <Text style={styles.heroOpsSubBtnText}>OPEN HERO OPS EXECUTION</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.arrivedWarehouseBtn}
                onPress={handleArrivedAtWarehouse}
                activeOpacity={0.85}
              >
                <Ionicons name="business" size={20} color="#000" style={{ marginRight: 8 }} />
                <Text style={styles.arrivedWarehouseBtnText}>[ 🏢 ARRIVED BACK AT THE WAREHOUSE ]</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* 3. END OF DAY WAREHOUSE CHECKLIST (UPON RETURN) */}
      {/* ========================================================================= */}
      {showEndOfDay && (
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="moon" size={20} color={THEME.colors.success} style={{ marginRight: 6 }} />
            <Text style={[styles.sectionTitle, { color: THEME.colors.success }]}>
              END OF DAY WAREHOUSE CHECKLIST
            </Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Complete close-out before leaving the depot:
          </Text>

          <View style={styles.card}>
            {/* Item 1: Company keys back in lock */}
            <TouchableOpacity
              style={[styles.checkRow, endOfDay.companyKeysInLock && styles.checkRowDone]}
              onPress={() => toggleEndCheck('companyKeysInLock')}
              activeOpacity={0.8}
            >
              <Ionicons
                name={endOfDay.companyKeysInLock ? 'checkmark-circle' : 'ellipse-outline'}
                size={24}
                color={endOfDay.companyKeysInLock ? THEME.colors.success : THEME.colors.primary}
                style={{ marginRight: 12 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.checkLabel, endOfDay.companyKeysInLock && styles.checkLabelDone]}>
                  Company keys back in lock / lockbox
                </Text>
                <Text style={styles.checkDesc}>Facility master keys returned and locked in safe.</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Item 2: My key and phone in possession */}
            <TouchableOpacity
              style={[styles.checkRow, endOfDay.personalKeysInPossession && styles.checkRowDone]}
              onPress={() => toggleEndCheck('personalKeysInPossession')}
              activeOpacity={0.8}
            >
              <Ionicons
                name={endOfDay.personalKeysInPossession ? 'checkmark-circle' : 'ellipse-outline'}
                size={24}
                color={endOfDay.personalKeysInPossession ? THEME.colors.success : THEME.colors.primary}
                style={{ marginRight: 12 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.checkLabel, endOfDay.personalKeysInPossession && styles.checkLabelDone]}>
                  My personal keys and phone in my possession
                </Text>
                <Text style={styles.checkDesc}>Car keys, personal mobile phone, and wallet on person.</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Item 3: Tools put back in place */}
            <TouchableOpacity
              style={[styles.checkRow, endOfDay.toolsInPlace && styles.checkRowDone]}
              onPress={() => toggleEndCheck('toolsInPlace')}
              activeOpacity={0.8}
            >
              <Ionicons
                name={endOfDay.toolsInPlace ? 'checkmark-circle' : 'ellipse-outline'}
                size={24}
                color={endOfDay.toolsInPlace ? THEME.colors.success : THEME.colors.primary}
                style={{ marginRight: 12 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.checkLabel, endOfDay.toolsInPlace && styles.checkLabelDone]}>
                  Tools put back in place
                </Text>
                <Text style={styles.checkDesc}>All vehicle tools organized and warehouse equipment stowed.</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Item 4: Return items and replaced parts put in place */}
            <TouchableOpacity
              style={[styles.checkRow, endOfDay.returnItemsInPlace && styles.checkRowDone]}
              onPress={() => toggleEndCheck('returnItemsInPlace')}
              activeOpacity={0.8}
            >
              <Ionicons
                name={endOfDay.returnItemsInPlace ? 'checkmark-circle' : 'ellipse-outline'}
                size={24}
                color={endOfDay.returnItemsInPlace ? THEME.colors.success : THEME.colors.primary}
                style={{ marginRight: 12 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.checkLabel, endOfDay.returnItemsInPlace && styles.checkLabelDone]}>
                  Return items & replaced parts put in return place
                </Text>
                <Text style={styles.checkDesc}>Faulty players, old routers, and cables placed in designated return bay.</Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={{ marginTop: 14, gap: 10 }}>
            {onSendToTimesheet && (
              <TouchableOpacity
                style={[
                  styles.primaryActionBtn,
                  { backgroundColor: readyToCloseShift ? THEME.colors.success : THEME.colors.primary },
                ]}
                onPress={() => onSendToTimesheet({ client: 'Shift Complete', status: 'completed' })}
                activeOpacity={0.85}
              >
                <Ionicons name="time" size={18} color="#000" style={{ marginRight: 8 }} />
                <Text style={styles.primaryActionBtnText}>[ 📊 SYNC TO TIMESHEET & CLOSE SHIFT ]</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.primaryActionBtn, { backgroundColor: '#334155' }]}
              onPress={() => {
                setJobStatus('idle');
                setShowStartOfDay(false);
                setShowEndOfDay(false);
                setStartOfDay({ toolboxVerified: false, replacementPartVerified: false });
                setEndOfDay({ companyKeysInLock: false, personalKeysInPossession: false, toolsInPlace: false, returnItemsInPlace: false });
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="refresh" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={[styles.primaryActionBtnText, { color: '#fff' }]}>RESET FOR NEXT SHIFT</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
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
  warehouseNotificationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: THEME.borderRadius.md,
    marginBottom: THEME.spacing.md,
    borderWidth: 1,
    borderColor: '#000',
  },
  warehouseNotificationBannerText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '800',
    flex: 1,
    lineHeight: 17,
  },
  enterWarehouseCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.md,
    borderWidth: 1.5,
    borderColor: THEME.colors.primary,
    marginTop: THEME.spacing.sm,
  },
  enterWarehouseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  enterWarehouseTitle: {
    color: THEME.colors.text,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  lockedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    borderColor: THEME.colors.warning,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: THEME.borderRadius.full,
  },
  lockedPillText: {
    color: THEME.colors.warning,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  enterWarehouseSub: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 12,
  },
  enteredWarehouseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: THEME.borderRadius.md,
  },
  enteredWarehouseBtnText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  enterWarehouseConfirmedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderColor: THEME.colors.success,
    borderWidth: 1.5,
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.md,
    marginTop: THEME.spacing.sm,
  },
  enterWarehouseConfirmedTitle: {
    color: THEME.colors.success,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  enterWarehouseConfirmedSub: {
    color: THEME.colors.textDim,
    fontSize: 11,
    marginTop: 2,
  },
  resetCheckinBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  resetCheckinBtnText: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    textDecorationLine: 'underline',
  },
  doorEmojiBtnLocked: {
    borderColor: 'rgba(234, 179, 8, 0.4)',
  },
  doorLockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  doorLockBadgeLocked: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
  },
  doorLockBadgeUnlocked: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
  doorLockBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.colors.warning,
    letterSpacing: 0.5,
  },
  header: {
    marginBottom: THEME.spacing.md,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: THEME.spacing.sm,
  },
  headerIconBox: {
    width: 42,
    height: 42,
    borderRadius: THEME.borderRadius.md,
    backgroundColor: THEME.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: THEME.spacing.sm,
  },
  headerTitle: {
    color: THEME.colors.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    color: THEME.colors.textMuted,
    fontSize: 12,
  },
  badgeRooty: {
    backgroundColor: THEME.colors.card,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: THEME.borderRadius.full,
    borderWidth: 1,
    borderColor: THEME.colors.primary,
  },
  badgeRootyText: {
    color: THEME.colors.primary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  gateCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.primary,
    marginTop: THEME.spacing.sm,
  },
  gateCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: THEME.spacing.sm,
  },
  gateCardLabel: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  editCodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.borderRadius.sm,
    backgroundColor: THEME.colors.surface,
  },
  editCodeBtnText: {
    color: THEME.colors.primary,
    fontSize: 10,
    fontWeight: '700',
  },
  editCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: THEME.spacing.sm,
  },
  editCodeInput: {
    flex: 1,
    backgroundColor: THEME.colors.inputBg,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: THEME.colors.primary,
    color: THEME.colors.text,
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: THEME.spacing.sm,
  },
  saveCodeBtn: {
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: THEME.borderRadius.md,
  },
  saveCodeBtnText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 12,
  },
  gateCodeDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: THEME.spacing.sm,
  },
  gateCodeBox: {
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  gateCodeText: {
    color: THEME.colors.primary,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2,
    fontFamily: 'monospace',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: THEME.borderRadius.md,
  },
  copyBtnDone: {
    backgroundColor: THEME.colors.success,
  },
  copyBtnText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '800',
  },
  gateTip: {
    color: THEME.colors.textDim,
    fontSize: 11,
    fontStyle: 'italic',
  },
  doorEmojiContainer: {
    marginTop: 14,
    marginBottom: 6,
  },
  doorEmojiRow: {
    flexDirection: 'row',
    gap: 12,
  },
  doorEmojiBtn: {
    flex: 1,
    backgroundColor: THEME.colors.card,
    borderColor: THEME.colors.border,
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doorEmojiBtnActive: {
    borderColor: THEME.colors.primary,
    backgroundColor: '#0c242e',
  },
  doorEmojiIcon: {
    fontSize: 36,
    marginBottom: 6,
  },
  doorEmojiLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  doorEmojiLabelActive: {
    color: THEME.colors.primary,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: THEME.spacing.xs,
    marginTop: THEME.spacing.sm,
  },
  sectionTitle: {
    color: THEME.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  card: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    marginBottom: THEME.spacing.md,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
  },
  checkRowDone: {
    opacity: 0.85,
  },
  checkRowLocked: {
    opacity: 0.5,
  },
  checkLabel: {
    color: THEME.colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  checkLabelDone: {
    textDecorationLine: 'line-through',
    color: THEME.colors.textMuted,
  },
  lockedBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  lockedBadgeText: {
    color: '#f87171',
    fontSize: 9,
    fontWeight: '900',
  },
  checkDesc: {
    color: THEME.colors.textDim,
    fontSize: 12,
    lineHeight: 16,
  },
  divider: {
    height: 1,
    backgroundColor: THEME.colors.border,
    marginVertical: 4,
  },
  actionCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    alignItems: 'center',
  },
  actionCardTitle: {
    color: THEME.colors.text,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    flexShrink: 1,
    textAlign: 'center',
  },
  actionCardDesc: {
    color: THEME.colors.textDim,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: THEME.spacing.md,
    lineHeight: 17,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: THEME.borderRadius.md,
    width: '100%',
  },
  primaryActionBtnDisabled: {
    backgroundColor: '#374151',
    opacity: 0.6,
  },
  primaryActionBtnText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
    flexShrink: 1,
    textAlign: 'center',
  },
  dualBtnRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 8,
  },
  heroOpsSubBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.card,
    borderWidth: 1,
    borderColor: THEME.colors.primary,
    paddingVertical: 13,
    paddingHorizontal: 6,
    borderRadius: THEME.borderRadius.md,
  },
  heroOpsSubBtnText: {
    color: THEME.colors.primary,
    fontSize: 11,
    fontWeight: '800',
    flexShrink: 1,
    textAlign: 'center',
  },
  finishJobBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.success,
    paddingVertical: 13,
    paddingHorizontal: 6,
    borderRadius: THEME.borderRadius.md,
  },
  finishJobBtnText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '900',
    flexShrink: 1,
    textAlign: 'center',
  },
});
