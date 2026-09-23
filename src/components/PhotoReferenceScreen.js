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

// Comprehensive field knowledge base categories matching the exact blueprint
const QUICK_GUIDE_CATEGORIES = [
  { id: 'network', label: 'Network / IP' },
  { id: 'media_players', label: 'Media Players' },
  { id: 'mounts', label: 'Displays & Mounts' },
  { id: 'cables', label: 'Cables' },
  { id: 'woolworths', label: 'Woolworths' },
  { id: 'fresh_food', label: 'Fresh Food' },
  { id: 'routers', label: 'Routers' },
  { id: 'safety', label: 'Safety' },
];

const FIELD_KNOWLEDGE_BASE = [
  // Network / IP
  {
    id: 'net-1',
    category: 'network',
    title: 'Ethernet Link Pulse vs NIC Detection (ncpa.cpl)',
    rule: 'Run Win+R → ncpa.cpl. If Ethernet adapter is visible and connected, physical cable and switch port are functional. If missing, reseat Cat6 on both ends.',
    tag: 'ETHERNET',
    warning: 'If IP starts with 169.254.x.x, DHCP has failed. Assign static IP or contact Slack.',
    steps: [
      '1. Win+R → ncpa.cpl → Enter.',
      '2. Check if Ethernet icon is enabled.',
      '3. Right-click Properties → IPv4 → enter site subnet (e.g. 10.240.x.x).',
    ],
  },
  {
    id: 'net-2',
    category: 'network',
    title: 'Broadsign Escape Loop (Caps Lock Spam)',
    rule: 'Connect external USB keyboard. Spam CAPS LOCK repeatedly to force Windows out of the full-screen Boarding Control Player kiosk overlay into the desktop.',
    tag: 'CAPS LOCK',
    warning: 'Do not power cycle immediately. If Caps Lock fails, press Win+D or Ctrl+Shift+Esc.',
    steps: [
      '1. Connect USB keyboard to player front/rear port.',
      '2. Rapidly press CAPS LOCK 10–15 times.',
      '3. Open Task Manager or CMD to check IP.',
    ],
  },

  // Media Players
  {
    id: 'mp-1',
    category: 'media_players',
    title: 'Swing Door Rule (No Dismount)',
    rule: 'You do NOT need to unbolt the display or dismantle brackets! Swing the door open approximately 15–20 cm and slide the player/cables out.',
    tag: 'SWING DOOR',
    warning: 'Confirm serial number with photo before pulling power plug.',
    steps: [
      '1. Photograph old player and serial sticker.',
      '2. Swing housing door open 15–20 cm.',
      '3. Disconnect HDMI, power, and Cat6.',
      '4. Slide in replacement player and reconnect.',
    ],
  },
  {
    id: 'mp-2',
    category: 'media_players',
    title: 'Blue App Content Stream Verification',
    rule: 'After Windows boots, open the blue status app to confirm streaming media cache is receiving scheduled retail assets from TechMedia.',
    tag: 'BLUE APP',
    warning: 'Ensure stream connects and content begins rolling before requesting clearance.',
    steps: [
      '1. Wait 2 minutes after boot.',
      '2. Check player displays target promotional loop.',
      '3. Upload verification photo to Slack.',
    ],
  },

  // Displays & Mounts
  {
    id: 'mnt-1',
    category: 'mounts',
    title: 'High Suspended Display Bracket Rule',
    rule: 'Undo bottom screw FIRST, then loosen top screw JUST A TAD. Leaves unit safely hooked on bracket while you unplug cables before lifting down.',
    tag: 'HIGH DISPLAY',
    warning: 'NEVER undo the top screw first! The display can swing violently or dislodge.',
    steps: [
      '1. Position platform ladder squarely under display.',
      '2. Remove bottom locking screw completely.',
      '3. Loosen top hanger screw 2–3 turns (do not remove).',
      '4. Unplug cables, then lift display off hooks.',
    ],
  },
  {
    id: 'mnt-2',
    category: 'mounts',
    title: 'Front of Store Cartology Kiosk Pod',
    rule: 'Access requires unlocking bottom compartment and swinging display forward. Hold display firmly with one hand while unbolting lower bracket.',
    tag: 'CARTOLOGY',
    warning: 'Heavy internal PCU power bricks must be re-secured with heavy-duty zip ties.',
    steps: [
      '1. Unlock key cylinder on side.',
      '2. Swing screen open gently.',
      '3. Replace unit and dress cables away from door hinges.',
    ],
  },

  // Cables
  {
    id: 'cbl-1',
    category: 'cables',
    title: 'Cat6 & HDMI Cable Dressing Standards',
    rule: 'Always plug Cat6 into LAN1 and HDMI into Display IN 1. Secure all cables to chassis bracket with 1–2 zip ties to eliminate strain on jacks.',
    tag: 'DRESSING',
    warning: 'Snagged cables in hinges will cause intermittent signal dropouts and black screens.',
    steps: [
      '1. Connect Cat6 firmly into port 1 until latch clicks.',
      '2. Tighten thumbscrews or anchor HDMI with tie.',
      '3. Flush-cut zip tie tails so no sharp edges remain.',
    ],
  },

  // Woolworths
  {
    id: 'ww-1',
    category: 'woolworths',
    title: 'Woolworths / Cartology Site Protocol',
    rule: 'Always sign site contractor register at customer service desk. Report to Duty Manager before entering trading floor or fresh departments.',
    tag: 'WOOLWORTHS',
    warning: 'Zero contractor equipment or tools to be placed on customer checkout belts.',
    steps: [
      '1. Sign in on store contractor book.',
      '2. Post sign-in arrival message to Slack channel.',
      '3. Complete work, request Slack clearance, sign out.',
    ],
  },

  // Fresh Food
  {
    id: 'ff-1',
    category: 'fresh_food',
    title: 'Deli, Seafood & Bakery Food Hygiene Protocols',
    rule: 'Mandatory hair net and beard net required before entering prep zones. Absolutely ZERO cut zip-tie ends, wire snippets, or screws allowed on counters.',
    tag: 'FOOD HYGIENE',
    warning: 'Health inspector violation if loose wire bits or screws fall into food displays.',
    steps: [
      '1. Ask Deli Lead or Manager for hair/beard nets.',
      '2. Wear nets covering all head and facial hair.',
      '3. Keep all tools and old parts inside your carry tool bag.',
      '4. Clean and inspect counter thoroughly before leaving.',
    ],
  },

  // Routers
  {
    id: 'rtr-1',
    category: 'routers',
    title: 'Comms Rack 4G Router Fault-Finding',
    rule: 'Locate 4G industrial router in BOH comms rack. Check LED lights: Solid Blue/Green = 4G Connected. Blinking Amber = SIM fault or low cellular signal.',
    tag: '4G ROUTER',
    warning: 'Do not press Factory Reset button on router! It erases store APN and VPN credentials.',
    steps: [
      '1. Reseat power adapter barrel plug.',
      '2. Reseat SIM card in primary slot.',
      '3. Verify magnetic booster antenna is positioned outside metal cabinet.',
      '4. Confirm 4G link status with TechMedia on Slack.',
    ],
  },

  // Safety
  {
    id: 'sft-1',
    category: 'safety',
    title: 'Platform Ladder & Working at Heights Protocol',
    rule: 'Only use site-approved industrial platform ladders with valid safety test tags. Maintain 3 points of contact when ascending and descending.',
    tag: 'LADDER SAFETY',
    warning: 'Never stand on top rung or lean beyond side rails.',
    steps: [
      '1. Inspect ladder feet for rubber grip integrity.',
      '2. Erect ladder on flat, level surface away from customer traffic.',
      '3. Erect caution cones if working in retail aisle.',
    ],
  },
];

export default function PhotoReferenceScreen() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCardId, setExpandedCardId] = useState(null);

  const filteredGuides = FIELD_KNOWLEDGE_BASE.filter((g) => {
    const matchesCategory = selectedCategory === 'all' || g.category === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      g.title.toLowerCase().includes(q) ||
      g.rule.toLowerCase().includes(q) ||
      g.tag.toLowerCase().includes(q) ||
      g.category.toLowerCase().includes(q);
    return matchesCategory && matchesQuery;
  });

  const handleCategoryPress = (catId) => {
    if (selectedCategory === catId) {
      setSelectedCategory('all');
    } else {
      setSelectedCategory(catId);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Blueprint Header */}
      <View style={styles.headerBox}>
        <Text style={styles.headerTitle}>HOW-TO</Text>
        <Text style={styles.headerSub}>FIELD KNOWLEDGE BASE & QUICK GUIDES</Text>
      </View>

      {/* Search Field Guide Input */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={THEME.colors.primary} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="🔎 Search field guide..."
          placeholderTextColor={THEME.colors.textDim}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={THEME.colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* QUICK GUIDES SUBHEADING */}
      <View style={styles.quickGuidesSection}>
        <Text style={styles.quickGuidesHeading}>QUICK GUIDES</Text>

        <View style={styles.quickGuidesGrid}>
          {QUICK_GUIDE_CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.quickGuidePill, isActive && styles.quickGuidePillActive]}
                onPress={() => handleCategoryPress(cat.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.quickGuidePillText, isActive && styles.quickGuidePillTextActive]}>
                  [ {cat.label} ]
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* MATCHING GUIDES LIST */}
      <View style={styles.guidesList}>
        {filteredGuides.map((guide) => {
          const isExpanded = expandedCardId === guide.id;
          return (
            <TouchableOpacity
              key={guide.id}
              style={[styles.guideCard, isExpanded && styles.guideCardExpanded]}
              activeOpacity={0.85}
              onPress={() => setExpandedCardId(isExpanded ? null : guide.id)}
            >
              <View style={styles.guideCardHeader}>
                <View style={styles.tagBadge}>
                  <Text style={styles.tagBadgeText}>{guide.tag}</Text>
                </View>
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={THEME.colors.primary}
                />
              </View>

              <Text style={styles.guideCardTitle}>{guide.title}</Text>
              <Text style={styles.guideCardRule}>{guide.rule}</Text>

              {guide.warning && (
                <View style={styles.warningBox}>
                  <Ionicons name="alert-circle" size={15} color="#fbbf24" style={{ marginRight: 6 }} />
                  <Text style={styles.warningText}>{guide.warning}</Text>
                </View>
              )}

              {isExpanded && guide.steps && (
                <View style={styles.expandedSection}>
                  <Text style={styles.expandedStepsTitle}>EXECUTION STEPS:</Text>
                  {guide.steps.map((step, sIdx) => (
                    <Text key={sIdx} style={styles.expandedStepText}>
                      {step}
                    </Text>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.bg,
  },
  content: {
    padding: 16,
    paddingBottom: 50,
  },
  headerBox: {
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    marginBottom: 16,
  },
  headerTitle: {
    color: THEME.colors.primary,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 4,
  },
  headerSub: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  quickGuidesSection: {
    marginBottom: 18,
  },
  quickGuidesHeading: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 10,
  },
  quickGuidesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickGuidePill: {
    backgroundColor: THEME.colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
  },
  quickGuidePillActive: {
    backgroundColor: '#0c242e',
    borderColor: THEME.colors.primary,
  },
  quickGuidePillText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '800',
  },
  quickGuidePillTextActive: {
    color: THEME.colors.primary,
  },
  guidesList: {
    gap: 12,
  },
  guideCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
    padding: 14,
  },
  guideCardExpanded: {
    borderColor: THEME.colors.primary,
  },
  guideCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tagBadge: {
    backgroundColor: '#0c242e',
    borderColor: THEME.colors.primary,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  tagBadgeText: {
    color: THEME.colors.primary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  guideCardTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 6,
    lineHeight: 20,
  },
  guideCardRule: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#261905',
    borderColor: '#f59e0b',
    borderWidth: 1,
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
  },
  warningText: {
    color: '#fef08a',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  expandedSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    gap: 4,
  },
  expandedStepsTitle: {
    color: THEME.colors.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  expandedStepText: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
});
