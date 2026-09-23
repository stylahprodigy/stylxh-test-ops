import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from './src/styles/theme';
import TimesheetScreen from './src/components/TimesheetScreen';
import HeroOpsScreen from './src/components/HeroOpsScreen';
import WarehouseSwapScreen from './src/components/WarehouseSwapScreen';
import PhotoReferenceScreen from './src/components/PhotoReferenceScreen';

export default function App() {
  const [currentTab, setCurrentTab] = useState('warehouse'); // 'warehouse' | 'hero_ops' | 'timesheet' | 'guides'
  
  // Central Shift & Job Session (Single source of truth across Warehouse, Hero Ops, and Timesheet)
  const [shiftSession, setShiftSession] = useState({
    status: 'idle', // 'idle' | 'on_job' | 'completed'
    departureTime: '',
    returnTime: '',
    dateStr: new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' }),
    completedJobs: [],
  });

  const [sharedJobData, setSharedJobData] = useState(null);

  // Clear / Reset entire session
  const handleResetSession = () => {
    setShiftSession({
      status: 'idle',
      departureTime: '',
      returnTime: '',
      dateStr: new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' }),
      completedJobs: [],
    });
    setSharedJobData(null);
  };

  // Warehouse: Departure event (Leaves warehouse for job)
  const handleDeparture = (departureTime) => {
    setShiftSession((prev) => ({
      ...prev,
      status: 'on_job',
      departureTime: departureTime || prev.departureTime,
    }));
    setCurrentTab('hero_ops');
  };

  // Warehouse: Return event (Returned to HQ)
  const handleReturn = (returnTime) => {
    setShiftSession((prev) => ({
      ...prev,
      status: 'completed',
      returnTime: returnTime || prev.returnTime,
    }));
  };

  // Hero Ops: Complete Job event
  const handleCompleteJob = (jobSession) => {
    setShiftSession((prev) => ({
      ...prev,
      completedJobs: [...prev.completedJobs.filter((j) => j.id !== jobSession.id), jobSession],
    }));
    setSharedJobData(jobSession);
  };

  const handleSyncToTimesheet = (jobInfo) => {
    handleCompleteJob(jobInfo);
    setCurrentTab('timesheet');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.colors.bg} />

      {/* Global Top Branding Bar */}
      <View style={styles.topBar}>
        <View style={styles.brandGroup}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>SX</Text>
          </View>
          <View>
            <Text style={styles.brandTitle}>STYLXH TEST OPS</Text>
            <Text style={styles.brandSub}>FIELD COMPANION</Text>
          </View>
        </View>

        <View style={styles.topRightBadge}>
          <Text style={styles.badgeText}>v5.0 PAYROLL</Text>
        </View>
      </View>

      {/* Screen Body */}
      <View style={styles.screenContainer}>
        {currentTab === 'warehouse' && (
          <WarehouseSwapScreen
            shiftSession={shiftSession}
            onStartDeparture={handleDeparture}
            onFinishReturn={handleReturn}
            onNavigateToHeroOps={() => setCurrentTab('hero_ops')}
            onSendToTimesheet={handleSyncToTimesheet}
          />
        )}
        {currentTab === 'hero_ops' && (
          <HeroOpsScreen
            shiftSession={shiftSession}
            onCompleteJob={handleCompleteJob}
            onSendToTimesheet={handleSyncToTimesheet}
            onNavigateToWarehouse={() => setCurrentTab('warehouse')}
          />
        )}
        {currentTab === 'timesheet' && (
          <TimesheetScreen
            shiftSession={shiftSession}
            initialJobData={sharedJobData}
            onResetSession={handleResetSession}
            onNavigateToHeroOps={() => setCurrentTab('hero_ops')}
          />
        )}
        {currentTab === 'guides' && <PhotoReferenceScreen />}
      </View>

      {/* Bottom Tab Bar */}
      <View style={styles.tabBar}>
        {/* Tab 1: Warehouse Access */}
        <TouchableOpacity
          style={[styles.tabItem, currentTab === 'warehouse' && styles.tabItemActive]}
          onPress={() => setCurrentTab('warehouse')}
          activeOpacity={0.8}
        >
          <Ionicons
            name={currentTab === 'warehouse' ? 'business' : 'business-outline'}
            size={21}
            color={currentTab === 'warehouse' ? THEME.colors.primary : THEME.colors.textMuted}
          />
          <Text
            style={[
              styles.tabLabel,
              currentTab === 'warehouse' && styles.tabLabelActive,
            ]}
          >
            WAREHOUSE
          </Text>
        </TouchableOpacity>

        {/* Tab 2: Hero Ops Wizard */}
        <TouchableOpacity
          style={[styles.tabItem, currentTab === 'hero_ops' && styles.tabItemActive]}
          onPress={() => setCurrentTab('hero_ops')}
          activeOpacity={0.8}
        >
          <Ionicons
            name={currentTab === 'hero_ops' ? 'flash' : 'flash-outline'}
            size={21}
            color={currentTab === 'hero_ops' ? THEME.colors.primary : THEME.colors.textMuted}
          />
          <Text
            style={[
              styles.tabLabel,
              currentTab === 'hero_ops' && styles.tabLabelActive,
            ]}
          >
            HERO OPS
          </Text>
        </TouchableOpacity>

        {/* Tab 3: Timesheet */}
        <TouchableOpacity
          style={[styles.tabItem, currentTab === 'timesheet' && styles.tabItemActive]}
          onPress={() => setCurrentTab('timesheet')}
          activeOpacity={0.8}
        >
          <Ionicons
            name={currentTab === 'timesheet' ? 'time' : 'time-outline'}
            size={21}
            color={currentTab === 'timesheet' ? THEME.colors.primary : THEME.colors.textMuted}
          />
          <Text
            style={[
              styles.tabLabel,
              currentTab === 'timesheet' && styles.tabLabelActive,
            ]}
          >
            TIMESHEET
          </Text>
        </TouchableOpacity>

        {/* Tab 4: How-To Guides */}
        <TouchableOpacity
          style={[styles.tabItem, currentTab === 'guides' && styles.tabItemActive]}
          onPress={() => setCurrentTab('guides')}
          activeOpacity={0.8}
        >
          <Ionicons
            name={currentTab === 'guides' ? 'book' : 'book-outline'}
            size={21}
            color={currentTab === 'guides' ? THEME.colors.primary : THEME.colors.textMuted}
          />
          <Text
            style={[
              styles.tabLabel,
              currentTab === 'guides' && styles.tabLabelActive,
            ]}
          >
            HOW-TO
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.colors.bg,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 10,
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoBox: {
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 8,
  },
  logoText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  brandTitle: {
    color: THEME.colors.text,
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  brandSub: {
    color: THEME.colors.textDim,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  topRightBadge: {
    backgroundColor: '#1c2438',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  badgeText: {
    color: THEME.colors.primary,
    fontSize: 10,
    fontWeight: '800',
  },
  screenContainer: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.surface,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    paddingVertical: 8,
    paddingBottom: 10,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItemActive: {
    transform: [{ scale: 1.05 }],
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    marginTop: 3,
    letterSpacing: 0.5,
  },
  tabLabelActive: {
    color: THEME.colors.primary,
    fontWeight: '900',
  },
});
