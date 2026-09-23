import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../styles/theme';
import { parseServiceM8Job } from '../services/serviceM8Parser';

export default function HeroOpsScreen({
  shiftSession,
  onCompleteJob,
  onSendToTimesheet,
  onNavigateToWarehouse,
}) {
  // Current active frame in the wizard:
  // 1: Store / Client (Stores first!)
  // 2: Job Type (What are you doing?)
  // 3: Screen / Mount / Location (Where is the device?)
  // 4: Department / Store Area (Where in the store?)
  // 5: Execution Protocol
  const [currentFrame, setCurrentFrame] = useState(1);

  // Selections - Nothing pre-selected automatically!
  const [jobsite, setJobsite] = useState(null);
  const [customJobsite, setCustomJobsite] = useState('');
  const [jobType, setJobType] = useState(null);
  const [mountType, setMountType] = useState(null);
  const [department, setDepartment] = useState(null);

  // Store metadata
  const [storeName, setStoreName] = useState('');
  const [storeCode, setStoreCode] = useState('');
  const [workOrder, setWorkOrder] = useState('');

  // Frame 5: Checklist State (13 items)
  const [checkedChecklist, setCheckedChecklist] = useState({});

  // Frame 5: Troubleshooting State
  const [activeTroubleCategory, setActiveTroubleCategory] = useState(null); // 'blank' | 'network' | 'frozen' | 'power'
  const [netStep1Checked, setNetStep1Checked] = useState(false);
  const [netEthernetStatus, setNetEthernetStatus] = useState(null); // 'connected' | 'unplugged' | 'no_adapter'
  const [netIpAction, setNetIpAction] = useState(null); // 'enter_ip' | 'reboot' | 'dhcp'
  const [customIp, setCustomIp] = useState('10.240.18.45');
  const [customSubnet, setCustomSubnet] = useState('255.255.255.0');
  const [customGateway, setCustomGateway] = useState('10.240.18.1');

  // Frame 5: Exit Clearance State
  const [slackClearanceReceived, setSlackClearanceReceived] = useState(false);
  const [signedOutOfWoolworths, setSignedOutOfWoolworths] = useState(false);

  // Router Swap Specific State
  const [routerLocation, setRouterLocation] = useState(null);
  const [affectedScreens, setAffectedScreens] = useState([]);
  const [verifiedScreens, setVerifiedScreens] = useState({});

  const toggleAffectedScreen = (id) => {
    setAffectedScreens((prev) =>
      prev.includes(id)
        ? (prev.length > 1 ? prev.filter((item) => item !== id) : prev)
        : [...prev, id]
    );
  };

  const toggleVerifiedScreen = (id) => {
    setVerifiedScreens((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Copied toast state
  const [copiedToast, setCopiedToast] = useState(null);

  // ServiceM8 Paste Modal
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pastedText, setPastedText] = useState('');

  const copyToClipboard = (text, label) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopiedToast(label);
    setTimeout(() => setCopiedToast(null), 2500);
  };

  const toggleChecklistItem = (id) => {
    setCheckedChecklist((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Human-readable labels
  const jobTypeTitle = {
    media_swap: 'MEDIA PLAYER SWAP',
    pcu_swap: 'PCU SWAP',
    router_swap: 'ROUTER SWAP',
    proactive: 'PROACTIVE CLEAN',
  }[jobType] || (jobType ? jobType.toUpperCase() : 'JOB TYPE');

  const mountLabel = {
    standard: 'STANDARD WALL MOUNT',
    high_suspended: 'HIGH SUSPENDED WALL DISPLAY',
    kiosk: 'FRONT OF STORE KIOSK',
    fresh_food_droppers: 'FRESH FOOD DROPPERS',
    comms_cabinet: 'COMMS CABINET',
    warehouse_dc: 'WAREHOUSE / DC',
  }[mountType] || (mountType ? mountType.toUpperCase() : 'MOUNT TYPE');

  const departmentLabel = {
    deli: 'DELI / SMALLGOODS',
    seafood: 'SEAFOOD / FISH',
    bakery: 'BAKERY',
    meat: 'MEAT',
    produce: 'PRODUCE / FRESH FOOD',
    front_store: 'FRONT OF STORE',
    pickup: 'OUTSIDE PICKUP / DIRECT TO BOOT',
    general_retail: 'GENERAL RETAIL',
  }[department] || (department ? department.toUpperCase() : 'DEPARTMENT');

  const ROUTER_LOCATION_OPTIONS = [
    { id: 'comms_room', title: 'COMMS ROOM' },
    { id: 'front_box_top', title: 'BOX NEAR THE FRONT AT THE TOP' },
  ];

  const AFFECTED_SCREEN_OPTIONS = [
    { id: 'deli', title: 'DELI / FRESH FOOD SCREENS' },
    { id: 'fos_kiosk', title: 'FRONT OF STORE KIOSK' },
    { id: 'seafood_bakery', title: 'SEAFOOD / BAKERY SCREENS' },
    { id: 'produce_meat', title: 'PRODUCE / MEAT SCREENS' },
    { id: 'community', title: 'COMMUNITY SCREENS' },
    { id: 'all_screens', title: 'ALL IN-STORE DISPLAYS' },
  ];

  const routerLocationLabel = {
    comms_room: 'COMMS ROOM',
    front_box_top: 'BOX NEAR THE FRONT AT THE TOP',
  }[routerLocation] || (routerLocation ? routerLocation.toUpperCase() : 'ROUTER LOCATION');

  const jobsiteLabel = jobsite === 'other' && customJobsite ? customJobsite.toUpperCase() : {
    woolworths: 'WOOLWORTHS',
    coles: 'COLES',
    iga: 'IGA / FOODLAND',
    dan_murphys: "DAN MURPHY'S / BWS",
    other: 'OTHER / INDEPENDENT',
  }[jobsite] || (jobsite ? jobsite.toUpperCase() : 'STORE');

  const isFoodDepartment = department ? ['deli', 'seafood', 'bakery', 'meat', 'produce'].includes(department) : false;
  const isWoolworths =
    jobsite === 'woolworths' ||
    (storeName && storeName.toLowerCase().includes('woolworths')) ||
    (customJobsite && customJobsite.toLowerCase().includes('woolworths'));

  // Dynamic Tools calculation
  const getRequiredTools = () => {
    if (jobType === 'media_swap') {
      if (mountType === 'standard' && department === 'deli') {
        return [
          { name: '1 × Phillips #2 Screwdriver', icon: 'construct-outline' },
          { name: '1–2 × Standard Zip Ties', icon: 'git-commit-outline' },
        ];
      }
      if (mountType === 'high_suspended') {
        return [
          { name: '1 × Platform Ladder (Safety Tagged)', icon: 'arrow-up-circle-outline' },
          { name: '1 × Phillips #2 Screwdriver', icon: 'construct-outline' },
          { name: '2–3 × Standard Zip Ties', icon: 'git-commit-outline' },
        ];
      }
      return [
        { name: '1 × Phillips #2 Screwdriver', icon: 'construct-outline' },
        { name: '1–2 × Standard Zip Ties', icon: 'git-commit-outline' },
      ];
    }
    if (jobType === 'pcu_swap') {
      return [
        { name: '4–6 × Heavy-Duty Nylon Zip Ties (Power Brick)', icon: 'flash-outline' },
        { name: '1 × Flush Side Cutters', icon: 'cut-outline' },
        { name: '1 × Phillips #2 Screwdriver', icon: 'construct-outline' },
      ];
    }
    if (jobType === 'router_swap') {
      return [
        { name: '1 × Flathead / Terminal Screwdriver', icon: 'construct-outline' },
        { name: '1 × Cat6 Patch Lead (Spare)', icon: 'git-network-outline' },
        { name: '1 × Booster Antenna Base', icon: 'wifi-outline' },
      ];
    }
    return [
      { name: '2 × Microfiber Cloths', icon: 'sparkles-outline' },
      { name: '1 × Soft Brush / Air Duster', icon: 'color-wand-outline' },
      { name: '1 × Phillips #2 Screwdriver', icon: 'construct-outline' },
    ];
  };

  // Dynamic checklist items matching exact field workflows with inline Slack triggers
  const getChecklistItems = () => {
    let items = [];
    if (jobType === 'router_swap') {
      items = [
        { id: 'r1', text: 'Check in with Store Manager / Duty Manager' },
        { id: 'r_arr', text: 'Send arrival message to Slack', slackAction: 'arrival', slackBtnText: 'COPY ARRIVAL MESSAGE' },
        { id: 'r2', text: 'Locate router: Comms Room or the Box near the front at the top (opening side panel may help)', slackAction: 'routerPhoto', slackBtnText: 'COPY ROUTER PHOTO' },
        { id: 'r3', text: 'Plug and play — put all the wires back the way you found it' },
        { id: 'r4', text: 'Place and position booster antenna high on metal rack' },
        { id: 'r5', text: 'Put panel back securely if opened' },
        { id: 'r6', text: 'Ask Slack to confirm router is online with TechMedia NOC', slackAction: 'swapComplete', slackBtnText: 'COPY SWAP COMPLETE' },
        { id: 'r7', text: 'Check displays that were faulty before (confirm online & streaming)' },
        { id: 'r8', text: 'Site clearance: Ask Store Manager: "Is there anything you guys want us to check while we\'re here?"' },
        { id: 'r9', text: 'Zero debris cleanup & pack tools' },
      ];
    } else if (jobType === 'pcu_swap') {
      items = [
        { id: 'p1', text: 'Check in with Store Manager & put on PPE' },
        { id: 'p_arr', text: 'Send arrival message to Slack', slackAction: 'arrival', slackBtnText: 'COPY ARRIVAL MESSAGE' },
        { id: 'p2', text: 'Open kiosk panel & photograph old PCU', slackAction: 'oldPlayer', slackBtnText: 'COPY OLD PCU PHOTO' },
        { id: 'p3', text: 'Open up the power box for the replacements & connect new wires' },
        { id: 'p4', text: 'Firmly strap down heavy power bricks with zip ties' },
        { id: 'p5', text: 'Power up kiosk & verify display telemetry', slackAction: 'swapComplete', slackBtnText: 'COPY SWAP COMPLETE' },
        { id: 'p6', text: 'Site clearance: Ask Store Manager: "Is there anything you guys want us to check while we\'re here?"' },
        { id: 'p7', text: 'Zero debris cleanup & pack tools' },
      ];
    } else if (jobType === 'proactive') {
      items = [
        { id: 'pr1', text: 'Check in with Store Manager' },
        { id: 'pr_arr', text: 'Send arrival message to Slack', slackAction: 'arrival', slackBtnText: 'COPY ARRIVAL MESSAGE' },
        { id: 'pr2', text: 'Inspect kiosk housing, hinges, glass & vents' },
        { id: 'pr3', text: 'Clean screen with microfiber cloths & vacuum dust' },
        { id: 'pr4', text: 'Check and tidy interior cable harness' },
        { id: 'pr5', text: 'Verify display color, brightness & streaming content', slackAction: 'screenPhoto', slackBtnText: 'COPY PHOTO MSG' },
        { id: 'pr6', text: 'Site clearance: Ask Store Manager: "Is there anything you guys want us to check while we\'re here?"' },
        { id: 'pr7', text: 'Zero debris cleanup & pack tools' },
      ];
    } else {
      // Default: media_swap
      items = [
        { id: 'c1', text: 'Check in with Store Manager & put on PPE' },
        { id: 'c_arr', text: 'Send arrival message to Slack', slackAction: 'arrival', slackBtnText: 'COPY ARRIVAL MESSAGE' },
        { id: 'c2', text: 'Photograph screen & old player', slackAction: 'screenPhoto', slackBtnText: 'COPY SCREEN PHOTO' },
        { id: 'c3', text: 'Open up the power box for the replacements & connect new wires' },
        { id: 'c4', text: 'Connect Cat6 → LAN1 & HDMI → Display IN 1, dress cables' },
        { id: 'c5', text: 'Confirm player boots & send swap complete to Slack', slackAction: 'swapComplete', slackBtnText: 'COPY SWAP COMPLETE' },
        { id: 'c6', text: 'Site clearance: Ask Store Manager: "Is there anything you guys want us to check while we\'re here?"' },
        { id: 'c7', text: 'Zero debris cleanup & pack tools' },
      ];
    }

    if (isWoolworths) {
      items.push({
        id: 'ww_signout',
        text: '🔴 MANDATORY: Sign out of Woolworths 1-Touch / Visitor Kiosk & notify Manager',
      });
    } else {
      items.push({
        id: 'site_signout',
        text: 'Sign out of site register / contractor kiosk & notify Manager',
      });
    }

    items.push({
      id: 'slack_clearance_item',
      text: 'Confirm Slack clearance / site report received before leaving site',
      slackAction: 'clearance',
      slackBtnText: 'COPY CLEARANCE MSG',
    });

    return items;
  };

  // Slack Action Messages
  const getSlackMessage = (type) => {
    const site = storeName || jobsiteLabel;
    if (jobType === 'router_swap') {
      switch (type) {
        case 'arrival':
          return `Signing in on site at ${site} for Router Swap in ${routerLocationLabel}. Entering premises now.`;
        case 'routerPhoto':
          return `Initial photo of router in ${routerLocationLabel} at ${site} captured before swap.`;
        case 'swapComplete':
          return `Router swap complete at ${site} (${routerLocationLabel}). Booster antenna positioned. Checking affected screens now.`;
        case 'clearance':
          return `Job complete at ${site}. Router online with TechMedia NOC, all ${affectedScreens.length} affected screens verified streaming. May I have clearance to pack up and sign out?`;
        default:
          return '';
      }
    }
    switch (type) {
      case 'arrival':
        return `Signing in on site at ${site} for ${jobTypeTitle} (${departmentLabel}). Entering premises now with PPE.`;
      case 'screenPhoto':
        return `Screen photo captured at ${site} (${departmentLabel}). Initial screen state documented.`;
      case 'oldPlayer':
        return `Old player photographed at ${site} (${departmentLabel}). Serial & cabling recorded before swap.`;
      case 'replacement':
        return `Replacement player serial tag photographed for ${site} (${departmentLabel}). Commencing installation.`;
      case 'swapComplete':
        return `Swap complete at ${site} (${departmentLabel}). New unit booted and connected to LAN1/Display IN 1. Ready for stream verification.`;
      case 'clearance':
        return `Job complete at ${site} (${departmentLabel}). Screen verified streaming online. Zero debris on site. May I have clearance to sign out?`;
      default:
        return '';
    }
  };

  // Complete Job handler
  const handleCompleteJob = () => {
    if (isWoolworths && !signedOutOfWoolworths) {
      Alert.alert(
        '⚠️ SIGN OUT OF WOOLWORTHS',
        'NO MATTER WHAT: Make sure you physically sign out of the Woolworths 1-Touch / Contractor Kiosk and inform the Duty Manager before leaving site!\n\nHave you signed out of Woolworths?',
        [
          { text: 'NOT YET (GO SIGN OUT)', style: 'cancel' },
          {
            text: 'YES, I SIGNED OUT',
            onPress: () => {
              setSignedOutOfWoolworths(true);
              finishJobExecution();
            },
          },
        ]
      );
      return;
    }
    finishJobExecution();
  };

  const finishJobExecution = () => {
    const now = new Date();
    const endTimeStr = now.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false });
    
    const newSession = {
      id: `job-${Date.now()}`,
      client: jobsiteLabel,
      jobType,
      jobTypeTitle,
      mountType: jobType === 'router_swap' ? routerLocation : mountType,
      mountLabel: jobType === 'router_swap' ? routerLocationLabel : mountLabel,
      department: jobType === 'router_swap' ? 'affected_screens' : department,
      departmentLabel:
        jobType === 'router_swap'
          ? `${affectedScreens.length} SCREENS CHECKED`
          : departmentLabel,
      startTime: '09:20',
      endTime: endTimeStr,
      status: 'completed',
    };

    if (onCompleteJob) {
      onCompleteJob(newSession);
    }
    if (onSendToTimesheet) {
      onSendToTimesheet(newSession);
    }

    Alert.alert(
      'Job Completed! ⚡',
      `${jobTypeTitle} at ${jobsiteLabel} (${jobType === 'router_swap' ? routerLocationLabel : departmentLabel}) has been recorded into today's Timesheet.`,
      [
        {
          text: 'Go to Timesheet',
          onPress: () => {
            if (onSendToTimesheet) onSendToTimesheet(newSession);
          },
        },
        {
          text: 'Start Another Job',
          onPress: () => {
            setCheckedChecklist({});
            setSlackClearanceReceived(false);
            setSignedOutOfWoolworths(false);
            setActiveTroubleCategory(null);
            setVerifiedScreens({});
            setJobsite(null);
            setCustomJobsite('');
            setStoreName('');
            setStoreCode('');
            setWorkOrder('');
            setJobType(null);
            setMountType(null);
            setDepartment(null);
            setRouterLocation(null);
            setAffectedScreens([]);
            setCurrentFrame(1);
          },
        },
      ]
    );
  };

  // Apply parsed ServiceM8
  const handleApplyServiceM8 = () => {
    const parsed = parseServiceM8Job(pastedText);
    if (parsed) {
      if (parsed.jobType) setJobType(parsed.jobType);
      if (parsed.mountType) setMountType(parsed.mountType);
      if (parsed.storeCode) setStoreCode(parsed.storeCode);
      if (parsed.workOrder) setWorkOrder(parsed.workOrder);
      if (parsed.storeLocation) {
        setStoreName(`${parsed.jobsite} ${parsed.storeLocation}`);
      }
      if (parsed.department) {
        const depLower = parsed.department.toLowerCase();
        if (depLower.includes('pickup') || depLower.includes('outside') || depLower.includes('boot') || depLower.includes('drive')) setDepartment('pickup');
        else if (depLower.includes('seafood') || depLower.includes('fish')) setDepartment('seafood');
        else if (depLower.includes('deli')) setDepartment('deli');
        else if (depLower.includes('bakery')) setDepartment('bakery');
        else if (depLower.includes('meat')) setDepartment('meat');
        else if (depLower.includes('produce')) setDepartment('produce');
        else if (depLower.includes('front') || depLower.includes('register')) setDepartment('front_store');
        else setDepartment('general_retail');
      }
      if (parsed.jobsite) {
        const siteLower = parsed.jobsite.toLowerCase();
        if (siteLower.includes('iga')) setJobsite('iga');
        else if (siteLower.includes('coles')) setJobsite('coles');
        else if (siteLower.includes('dan murphy') || siteLower.includes('bws')) setJobsite('dan_murphys');
        else setJobsite('woolworths');
      }
      setShowPasteModal(false);
      setPastedText('');
      setCurrentFrame(5); // Jump straight to protocol!
    }
  };

  return (
    <View style={styles.outerContainer}>
      {/* Toast Notification */}
      {copiedToast && (
        <View style={styles.toastBanner}>
          <Ionicons name="checkmark-circle" size={16} color="#000" style={{ marginRight: 6 }} />
          <Text style={styles.toastText}>COPIED TO CLIPBOARD: {copiedToast.toUpperCase()}</Text>
        </View>
      )}

      {/* Top Breadcrumb Bar */}
      <View style={styles.topNavBar}>
        {currentFrame > 1 ? (
          <TouchableOpacity
            style={styles.navBackBtn}
            onPress={() => setCurrentFrame((prev) => Math.max(1, prev - 1))}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={THEME.colors.primary} />
            <Text style={styles.navBackText}>← HERO OPS</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.navBrandBlock}>
            <Text style={styles.navBrandTitle}>HERO OPS</Text>
            <Text style={styles.navBrandSubtitle}>FIELD WORK ENGINE</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.navPasteBtn}
          onPress={() => setShowPasteModal(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="clipboard-outline" size={14} color="#000" style={{ marginRight: 4 }} />
          <Text style={styles.navPasteBtnText}>PASTE TICKET</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.content}>
        {/* ========================================================================= */}
        {/* FRAME 1: STORE / CLIENT (STORES FIRST!) */}
        {/* ========================================================================= */}
        {currentFrame === 1 && (
          <View style={styles.frameContainer}>
            <View style={styles.blueprintHeaderBox}>
              <Text style={styles.blueprintTitle}>HERO OPS</Text>
              <Text style={styles.blueprintQuestion}>WHICH STORE / CLIENT?</Text>
            </View>

            <View style={styles.choicePillsList}>
              {[
                { id: 'woolworths', title: 'WOOLWORTHS' },
                { id: 'coles', title: 'COLES' },
                { id: 'iga', title: 'IGA / FOODLAND' },
                { id: 'dan_murphys', title: "DAN MURPHY'S / BWS" },
                { id: 'other', title: 'OTHER / INDEPENDENT' },
              ].map((site) => (
                <TouchableOpacity
                  key={site.id}
                  style={[styles.bracketChoiceButton, jobsite === site.id && styles.bracketChoiceSelected]}
                  onPress={() => {
                    setJobsite(site.id);
                    if (site.id !== 'other') {
                      setCurrentFrame(2); // Proceed to Frame 2: What are you doing?
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.bracketChoiceText, jobsite === site.id && styles.bracketChoiceTextSelected]}>
                    [ {site.title} ]
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {jobsite === 'other' && (
              <View style={styles.customJobsiteBox}>
                <Text style={styles.customJobsitePrompt}>ENTER STORE / CLIENT NAME:</Text>
                <TextInput
                  style={styles.customJobsiteInput}
                  value={customJobsite}
                  onChangeText={setCustomJobsite}
                  placeholder="e.g. ALDI / Harris Farm / Distribution Centre..."
                  placeholderTextColor={THEME.colors.textDim}
                />
                <TouchableOpacity
                  style={styles.customJobsiteBtn}
                  onPress={() => setCurrentFrame(2)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.customJobsiteBtnText}>[ CONTINUE TO WHAT ARE YOU DOING ]</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* ========================================================================= */}
        {/* FRAME 2: WHAT ARE YOU DOING? (4 CLEAN CARDS) */}
        {/* ========================================================================= */}
        {currentFrame === 2 && (
          <View style={styles.frameContainer}>
            <View style={styles.blueprintHeaderBox}>
              <Text style={styles.blueprintSubHeading}>{jobsiteLabel}</Text>
              <Text style={styles.blueprintQuestion}>WHAT ARE YOU DOING?</Text>
            </View>

            <View style={styles.fourCleanCardsList}>
              {/* Card 1: Media Player Swap */}
              <TouchableOpacity
                style={[styles.cleanMenuCard, jobType === 'media_swap' && styles.bracketChoiceSelected]}
                onPress={() => {
                  setJobType('media_swap');
                  setCurrentFrame(3); // Proceed to Frame 3: Screen / Mount
                }}
                activeOpacity={0.8}
              >
                <View style={styles.cleanMenuLeft}>
                  <Text style={styles.cleanMenuEmoji}>🖥</Text>
                  <Text style={styles.cleanMenuTitle}>MEDIA PLAYER SWAP</Text>
                </View>
                <Ionicons name="chevron-forward" size={22} color={THEME.colors.primary} />
              </TouchableOpacity>

              {/* Card 2: PCU Swap */}
              <TouchableOpacity
                style={[styles.cleanMenuCard, jobType === 'pcu_swap' && styles.bracketChoiceSelected]}
                onPress={() => {
                  setJobType('pcu_swap');
                  setCurrentFrame(3); // Proceed to Frame 3: Screen / Mount
                }}
                activeOpacity={0.8}
              >
                <View style={styles.cleanMenuLeft}>
                  <Text style={styles.cleanMenuEmoji}>💻</Text>
                  <Text style={styles.cleanMenuTitle}>PCU SWAP</Text>
                </View>
                <Ionicons name="chevron-forward" size={22} color={THEME.colors.primary} />
              </TouchableOpacity>

              {/* Card 3: Router Swap */}
              <TouchableOpacity
                style={[styles.cleanMenuCard, jobType === 'router_swap' && styles.bracketChoiceSelected]}
                onPress={() => {
                  setJobType('router_swap');
                  setCurrentFrame(3); // Proceed to Frame 3: Router location
                }}
                activeOpacity={0.8}
              >
                <View style={styles.cleanMenuLeft}>
                  <Text style={styles.cleanMenuEmoji}>📡</Text>
                  <Text style={styles.cleanMenuTitle}>ROUTER SWAP</Text>
                </View>
                <Ionicons name="chevron-forward" size={22} color={THEME.colors.primary} />
              </TouchableOpacity>

              {/* Card 4: Proactive Clean */}
              <TouchableOpacity
                style={[styles.cleanMenuCard, jobType === 'proactive' && styles.bracketChoiceSelected]}
                onPress={() => {
                  setJobType('proactive');
                  setCurrentFrame(3); // Proceed to Frame 3: Screen / Mount
                }}
                activeOpacity={0.8}
              >
                <View style={styles.cleanMenuLeft}>
                  <Text style={styles.cleanMenuEmoji}>🧹</Text>
                  <Text style={styles.cleanMenuTitle}>PROACTIVE CLEAN</Text>
                </View>
                <Ionicons name="chevron-forward" size={22} color={THEME.colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* FRAME 3: WHAT TYPE OF SCREEN / MOUNT / LOCATION */}
        {/* ========================================================================= */}
        {currentFrame === 3 && (
          <View style={styles.frameContainer}>
            {jobType === 'router_swap' ? (
              <>
                <View style={styles.blueprintHeaderBox}>
                  <Text style={styles.blueprintSubHeading}>ROUTER SWAP • {jobsiteLabel}</Text>
                  <Text style={styles.blueprintQuestion}>WHERE IS THE ROUTER LOCATED?</Text>
                </View>

                {/* PRO-TIP BOX */}
                <View style={styles.routerLocationTipBox}>
                  <Ionicons name="bulb" size={20} color="#60a5fa" style={{ marginRight: 8 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.routerLocationTipTitle}>FIELD RULE: ONLY 2 POSSIBLE LOCATIONS</Text>
                    <Text style={styles.routerLocationTipText}>
                      The router is always in the <Text style={{ color: '#fff', fontWeight: 'bold' }}>Comms Room</Text> or the <Text style={{ color: '#fff', fontWeight: 'bold' }}>Box near the front at the top</Text>. If not visible inside the box, <Text style={{ color: '#60a5fa', fontWeight: 'bold' }}>opening the side panel may help</Text>!
                    </Text>
                  </View>
                </View>

                <View style={styles.choicePillsList}>
                  {ROUTER_LOCATION_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.id}
                      style={[styles.bracketChoiceButton, routerLocation === opt.id && styles.bracketChoiceSelected]}
                      onPress={() => {
                        setRouterLocation(opt.id);
                        setCurrentFrame(4); // Proceed to Frame 4: Affected screens
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.bracketChoiceText, routerLocation === opt.id && styles.bracketChoiceTextSelected]}>
                        [ {opt.title} ]
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : (
              <>
                <View style={styles.blueprintHeaderBox}>
                  <Text style={styles.blueprintSubHeading}>{jobTypeTitle} • {jobsiteLabel}</Text>
                  <Text style={styles.blueprintQuestion}>WHAT TYPE OF SCREEN / MOUNT?</Text>
                </View>

                <View style={styles.choicePillsList}>
                  {[
                    { id: 'standard', title: 'STANDARD WALL MOUNT' },
                    { id: 'high_suspended', title: 'HIGH SUSPENDED WALL DISPLAY' },
                    { id: 'kiosk', title: 'FRONT OF STORE KIOSK' },
                    { id: 'fresh_food_droppers', title: 'FRESH FOOD DROPPERS' },
                    { id: 'comms_cabinet', title: 'COMMS CABINET' },
                    { id: 'warehouse_dc', title: 'WAREHOUSE / DC' },
                  ].map((opt) => (
                    <TouchableOpacity
                      key={opt.id}
                      style={[styles.bracketChoiceButton, mountType === opt.id && styles.bracketChoiceSelected]}
                      onPress={() => {
                        setMountType(opt.id);
                        setCurrentFrame(4); // Proceed to Frame 4: Department
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.bracketChoiceText, mountType === opt.id && styles.bracketChoiceTextSelected]}>
                        [ {opt.title} ]
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </View>
        )}

        {/* ========================================================================= */}
        {/* FRAME 4: STORE AREA / DEPARTMENT (OR AFFECTED SCREENS FOR ROUTER) */}
        {/* ========================================================================= */}
        {currentFrame === 4 && (
          <View style={styles.frameContainer}>
            {jobType === 'router_swap' ? (
              <>
                <View style={styles.blueprintHeaderBox}>
                  <Text style={styles.blueprintSubHeading}>ROUTER SWAP • {jobsiteLabel}</Text>
                  <Text style={styles.blueprintQuestion}>WHICH SCREENS ARE AFFECTED?</Text>
                  <Text style={styles.blueprintInstruction}>
                    Select all displays reported offline so you can physically verify them after plug & play:
                  </Text>
                </View>

                <View style={styles.choicePillsList}>
                  {AFFECTED_SCREEN_OPTIONS.map((opt) => {
                    const isSelected = affectedScreens.includes(opt.id);
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        style={[styles.bracketChoiceButton, isSelected && styles.bracketChoiceSelected]}
                        onPress={() => toggleAffectedScreen(opt.id)}
                        activeOpacity={0.8}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons
                            name={isSelected ? 'checkbox' : 'square-outline'}
                            size={20}
                            color={isSelected ? THEME.colors.primary : THEME.colors.textMuted}
                            style={{ marginRight: 8 }}
                          />
                          <Text style={[styles.bracketChoiceText, isSelected && styles.bracketChoiceTextSelected]}>
                            [ {opt.title} ]
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  style={styles.proceedFrameBtn}
                  onPress={() => setCurrentFrame(5)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.proceedFrameBtnText}>
                    [ PROCEED TO EXECUTION ➔ ({affectedScreens.length} SCREENS SELECTED) ]
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.blueprintHeaderBox}>
                  <Text style={styles.blueprintTitle}>{jobsiteLabel}</Text>
                  <Text style={styles.blueprintQuestion}>SELECT STORE AREA</Text>
                </View>

                <View style={styles.choicePillsList}>
                  {[
                    { id: 'deli', title: 'DELI / SMALLGOODS' },
                    { id: 'seafood', title: 'SEAFOOD / FISH' },
                    { id: 'bakery', title: 'BAKERY' },
                    { id: 'meat', title: 'MEAT' },
                    { id: 'produce', title: 'PRODUCE / FRESH FOOD' },
                    { id: 'front_store', title: 'FRONT OF STORE' },
                    { id: 'pickup', title: 'OUTSIDE PICKUP / DIRECT TO BOOT' },
                    { id: 'general_retail', title: 'GENERAL RETAIL' },
                  ].map((dep) => (
                    <TouchableOpacity
                      key={dep.id}
                      style={[styles.bracketChoiceButton, department === dep.id && styles.bracketChoiceSelected]}
                      onPress={() => {
                        setDepartment(dep.id);
                        setCurrentFrame(5); // Proceed to Frame 5: Execution Protocol!
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.bracketChoiceText, department === dep.id && styles.bracketChoiceTextSelected]}>
                        [ {dep.title} ]
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </View>
        )}

        {/* ========================================================================= */}
        {/* FRAME 5: EXECUTION (THE FIELD-WORK ENGINE) */}
        {/* ========================================================================= */}
        {currentFrame === 5 && (
          <View style={styles.frameContainer}>
            {/* Top Workflow Path Header */}
            <View style={styles.executionPathBox}>
              <Text style={styles.executionPathJob}>{jobTypeTitle}</Text>
              <Text style={styles.executionPathDetails}>
                {jobType === 'router_swap'
                  ? `${routerLocationLabel} • ${affectedScreens.length} AFFECTED SCREENS`
                  : `${mountLabel} • ${departmentLabel}`}
              </Text>
              <Text style={styles.executionPathClient}>{jobsiteLabel}</Text>
            </View>

            {/* ⚠️ HIGH DISPLAY WARNING AT TOP OF EXECUTION */}
            {mountType === 'high_suspended' && (
              <View style={styles.highDisplayTopWarningCard}>
                <View style={styles.goldenRuleHeaderRow}>
                  <Ionicons name="arrow-up-circle" size={24} color="#fbbf24" style={{ marginRight: 8 }} />
                  <Text style={styles.goldenRuleHeaderTitle}>⚠️ HIGH DISPLAY WARNING</Text>
                </View>
                <Text style={styles.goldenRuleBold}>1. REMOVE BOTTOM SCREW FIRST</Text>
                <Text style={styles.goldenRuleBold}>2. THEN LOOSEN TOP SCREW SLIGHTLY</Text>
                <Text style={styles.goldenRuleBody}>
                  Leaves unit safely hooked on bracket while you unplug cables before lifting down. DO NOT remove top screw first!
                </Text>
              </View>
            )}

            {/* CARD 1: ⚠️ MANDATORY (HAIR/BEARD NET & ZERO DEBRIS) - NOT FOR ROUTER SWAP */}
            {isFoodDepartment && jobType !== 'router_swap' && (
              <View style={styles.mandatoryCard}>
                <View style={styles.mandatoryHeaderRow}>
                  <Ionicons name="warning" size={22} color="#f59e0b" style={{ marginRight: 8 }} />
                  <Text style={styles.mandatoryHeaderTitle}>⚠️ MANDATORY</Text>
                </View>
                <View style={styles.mandatoryContent}>
                  <Text style={styles.mandatoryItem}>HAIR / BEARD NET</Text>
                  <Text style={styles.mandatoryItem}>ZERO DEBRIS</Text>
                </View>
                <Text style={styles.mandatoryNote}>
                  Ask Duty Manager / Deli Lead for nets before entering prep floor. Never leave cut zip ties or screws on counters!
                </Text>
              </View>
            )}

            {/* CARD 2: 🔧 REQUIRED TOOLS & CONSUMABLES */}
            <View style={styles.requiredToolsCard}>
              <View style={styles.requiredToolsHeaderRow}>
                <Ionicons name="construct" size={20} color={THEME.colors.primary} style={{ marginRight: 8 }} />
                <Text style={styles.requiredToolsHeaderTitle}>🔧 REQUIRED</Text>
              </View>
              <View style={styles.requiredToolsList}>
                {getRequiredTools().map((t, idx) => (
                  <View key={idx} style={styles.requiredToolRow}>
                    <Ionicons name={t.icon} size={16} color={THEME.colors.primary} style={{ marginRight: 8 }} />
                    <Text style={styles.requiredToolName}>{t.name}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* ROUTER SWAP FIELD EXECUTION CARD (VERIFIED FIELD RULES) */}
            {jobType === 'router_swap' && (
              <View style={styles.routerFieldCard}>
                <View style={styles.routerFieldHeader}>
                  <Ionicons name="wifi" size={22} color="#60a5fa" style={{ marginRight: 8 }} />
                  <Text style={styles.routerFieldTitle}>📡 ROUTER PLUG & PLAY EXECUTION</Text>
                </View>
                <Text style={styles.routerFieldTip}>
                  • <Text style={{ fontWeight: '900', color: '#fff' }}>1. Locate Router:</Text> In {routerLocationLabel}. If not visible from the front, <Text style={{ color: '#60a5fa', fontWeight: 'bold' }}>opening the side panel may help</Text>!
                </Text>
                <Text style={styles.routerFieldTip}>
                  • <Text style={{ fontWeight: '900', color: '#fff' }}>2. Plug & Play:</Text> Put all the wires back the exact way you found it (1-to-1 swap for Power, Antennas, and LAN/WAN patch leads).
                </Text>
                <Text style={styles.routerFieldTip}>
                  • <Text style={{ fontWeight: '900', color: '#fff' }}>3. Booster Antenna:</Text> Place and position magnetic antenna high on outer metal rack surface for optimum 4G LTE reception.
                </Text>
                <Text style={styles.routerFieldTip}>
                  • <Text style={{ fontWeight: '900', color: '#fff' }}>4. Side Panel:</Text> Put side panel back securely if opened.
                </Text>
                <Text style={styles.routerFieldTip}>
                  • <Text style={{ fontWeight: '900', color: '#fff' }}>5. Slack Confirmation:</Text> Ask Slack / TechMedia NOC to confirm router is online and streaming.
                </Text>
              </View>
            )}

            {/* CARD: VERIFY AFFECTED SCREENS (ROUTER SWAP SPECIFIC) */}
            {jobType === 'router_swap' && (
              <View style={styles.affectedScreensCard}>
                <View style={styles.affectedScreensHeader}>
                  <Ionicons name="tv" size={20} color={THEME.colors.primary} style={{ marginRight: 8 }} />
                  <Text style={styles.affectedScreensTitle}>📺 CHECK AFFECTED SCREENS</Text>
                  <Text style={styles.affectedScreensCount}>
                    {Object.values(verifiedScreens).filter(Boolean).length} / {affectedScreens.length}
                  </Text>
                </View>
                <Text style={styles.affectedScreensSubtitle}>
                  Walk the store and confirm that previously faulty displays are now online & streaming:
                </Text>

                <View style={styles.affectedScreensList}>
                  {affectedScreens.map((screenId) => {
                    const screenOpt =
                      AFFECTED_SCREEN_OPTIONS.find((s) => s.id === screenId) || {
                        title: screenId.toUpperCase(),
                      };
                    const isVerified = !!verifiedScreens[screenId];
                    return (
                      <TouchableOpacity
                        key={screenId}
                        style={[
                          styles.affectedScreenCheckRow,
                          isVerified && styles.affectedScreenCheckRowDone,
                        ]}
                        onPress={() => toggleVerifiedScreen(screenId)}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name={isVerified ? 'checkmark-circle' : 'ellipse-outline'}
                          size={22}
                          color={isVerified ? THEME.colors.success : THEME.colors.primary}
                          style={{ marginRight: 10 }}
                        />
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.affectedScreenCheckTitle,
                              isVerified && styles.affectedScreenCheckTitleDone,
                            ]}
                          >
                            {screenOpt.title}
                          </Text>
                          <Text style={styles.affectedScreenCheckDesc}>
                            {isVerified
                              ? '✓ Physically verified streaming online'
                              : 'Tap to confirm screen is active on floor'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* CARD 3: EXECUTION CHECKLIST WITH INLINE SLACK ACTIONS */}
            <View style={styles.checklistCard}>
              <View style={styles.checklistHeaderRow}>
                <Text style={styles.checklistHeaderTitle}>EXECUTION CHECKLIST</Text>
                <Text style={styles.checklistCounterText}>
                  {Object.values(checkedChecklist).filter(Boolean).length} / {getChecklistItems().length}
                </Text>
              </View>

              <View style={styles.checklistItemsList}>
                {getChecklistItems().map((item) => {
                  const isChecked = !!checkedChecklist[item.id];
                  return (
                    <View
                      key={item.id}
                      style={[styles.checkItemCard, isChecked && styles.checkItemCardDone]}
                    >
                      <TouchableOpacity
                        style={styles.checkItemRow}
                        onPress={() => toggleChecklistItem(item.id)}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name={isChecked ? 'checkmark-circle' : 'ellipse-outline'}
                          size={22}
                          color={isChecked ? THEME.colors.success : THEME.colors.primary}
                          style={{ marginRight: 10 }}
                        />
                        <Text style={[styles.checkItemText, isChecked && styles.checkItemTextDone]}>
                          {item.text}
                        </Text>
                      </TouchableOpacity>

                      {item.slackAction && (
                        <View style={styles.checkItemSlackRow}>
                          <TouchableOpacity
                            style={styles.inlineSlackBtn}
                            onPress={() => copyToClipboard(getSlackMessage(item.slackAction), item.slackAction)}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="copy-outline" size={13} color="#000" style={{ marginRight: 5 }} />
                            <Text style={styles.inlineSlackBtnText}>[ {item.slackBtnText || 'COPY TO SLACK'} ]</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>

            {/* GOLDEN RULE: SWING DOOR RULE (STRICTLY WAREHOUSE / DC ONLY) */}
            {jobType === 'media_swap' && mountType === 'warehouse_dc' && (
              <View style={styles.goldenRuleCard}>
                <View style={styles.goldenRuleHeaderRow}>
                  <Ionicons name="warning" size={22} color="#fbbf24" style={{ marginRight: 8 }} />
                  <Text style={styles.goldenRuleHeaderTitle}>⚠️ GOLDEN SWING DOOR RULE (DC ONLY)</Text>
                </View>
                <Text style={styles.goldenRuleBold}>DO NOT UNBOLT THE MOUNT.</Text>
                <Text style={styles.goldenRuleBody}>
                  Swing the door open approximately <Text style={{ color: '#fff', fontWeight: '900' }}>15–20 cm</Text> and slide the player/cables out.
                </Text>
              </View>
            )}

            {/* TROUBLESHOOTING: DON'T DUMP ENTIRE MANUAL - MODULAR 4 BUTTONS (NOT FOR ROUTER SWAP) */}
            {jobType !== 'router_swap' && (
              <View style={styles.troubleCard}>
                <Text style={styles.troubleMainTitle}>SOMETHING WRONG?</Text>
                
                <View style={styles.troublePillsGrid}>
                  <TouchableOpacity
                    style={[styles.troubleButtonPill, activeTroubleCategory === 'blank' && styles.troubleButtonPillActive]}
                    onPress={() => setActiveTroubleCategory(activeTroubleCategory === 'blank' ? null : 'blank')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.troubleButtonPillText}>[ 🖥 BLANK / BLACK SCREEN ]</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.troubleButtonPill, activeTroubleCategory === 'network' && styles.troubleButtonPillActive]}
                    onPress={() => setActiveTroubleCategory(activeTroubleCategory === 'network' ? null : 'network')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.troubleButtonPillText}>[ 🌐 NO NETWORK ]</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.troubleButtonPill, activeTroubleCategory === 'frozen' && styles.troubleButtonPillActive]}
                    onPress={() => setActiveTroubleCategory(activeTroubleCategory === 'frozen' ? null : 'frozen')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.troubleButtonPillText}>[ ❄ PLAYER FROZEN ]</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.troubleButtonPill, activeTroubleCategory === 'power' && styles.troubleButtonPillActive]}
                    onPress={() => setActiveTroubleCategory(activeTroubleCategory === 'power' ? null : 'power')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.troubleButtonPillText}>[ ⚡ NO POWER ]</Text>
                  </TouchableOpacity>
                </View>

              {/* TARGETED DIAGNOSTIC: NO NETWORK */}
              {activeTroubleCategory === 'network' && (
                <View style={styles.diagnosticPathBox}>
                  <Text style={styles.diagHeader}>🌐 NO NETWORK: CMD IPCONFIG & IPV4 SETTINGS</Text>

                  {/* STEP 1: OPEN CMD & RUN IPCONFIG */}
                  <View style={styles.diagStepCard}>
                    <Text style={styles.diagStepLabel}>STEP 1: OPEN CMD & RUN IPCONFIG</Text>
                    <Text style={styles.diagPrompt}>
                      On player: Press <Text style={{ color: '#fff', fontWeight: 'bold' }}>Win + R</Text>, type <Text style={{ color: THEME.colors.primary, fontWeight: 'bold' }}>cmd</Text>, press Enter, then run:
                    </Text>

                    <View style={styles.cmdSnippetBox}>
                      <Text style={styles.cmdSnippetText}>ipconfig /all</Text>
                      <TouchableOpacity
                        style={styles.copySmallBtn}
                        onPress={() => copyToClipboard('ipconfig /all', 'ipconfig')}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="copy-outline" size={13} color="#000" style={{ marginRight: 4 }} />
                        <Text style={styles.copySmallBtnText}>COPY</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.diagDivider} />

                  {/* STEP 2: KNOWING WHAT TO LOOK FOR */}
                  <View style={styles.diagStepCard}>
                    <Text style={styles.diagStepLabel}>STEP 2: KNOWING WHAT TO LOOK FOR</Text>
                    <View style={styles.ipLookForCard}>
                      <View style={styles.ipLookRow}>
                        <Text style={styles.ipLookLabel}>⚠️ 169.254.x.x</Text>
                        <Text style={styles.ipLookDesc}>= DHCP FAILURE (No IP assigned from router)</Text>
                      </View>
                      <View style={styles.ipLookRow}>
                        <Text style={styles.ipLookLabel}>✅ Normal Store IP</Text>
                        <Text style={styles.ipLookDesc}>= Usually 10.240.x.x or 192.168.x.x</Text>
                      </View>
                      <View style={styles.ipLookRow}>
                        <Text style={styles.ipLookLabel}>Subnet Mask</Text>
                        <Text style={styles.ipLookDesc}>= Usually 255.255.255.0</Text>
                      </View>
                      <View style={styles.ipLookRow}>
                        <Text style={styles.ipLookLabel}>Default Gateway</Text>
                        <Text style={styles.ipLookDesc}>= Usually 10.240.x.1 (Store Router)</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.diagDivider} />

                  {/* STEP 3: PUT INTO IPV4 SETTINGS ETHERNET */}
                  <View style={styles.diagStepCard}>
                    <Text style={styles.diagStepLabel}>STEP 3: ENTER INTO IPV4 ETHERNET SETTINGS</Text>
                    <Text style={styles.diagPrompt}>
                      1. Open Network Connections (<Text style={{ color: THEME.colors.primary, fontWeight: 'bold' }}>ncpa.cpl</Text>)
                    </Text>
                    <Text style={styles.diagPrompt}>
                      2. Right-click <Text style={{ color: '#fff', fontWeight: 'bold' }}>Ethernet</Text> → <Text style={{ color: '#fff', fontWeight: 'bold' }}>Properties</Text>
                    </Text>
                    <Text style={styles.diagPrompt}>
                      3. Double-click <Text style={{ color: '#fff', fontWeight: 'bold' }}>Internet Protocol Version 4 (TCP/IPv4)</Text>
                    </Text>
                    <Text style={styles.diagPrompt}>
                      4. Select <Text style={{ color: THEME.colors.primary, fontWeight: 'bold' }}>"Use the following IP address"</Text> and enter values:
                    </Text>

                    <TouchableOpacity
                      style={styles.diagActionBtn}
                      onPress={() => copyToClipboard('ncpa.cpl', 'ncpa.cpl')}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="settings-outline" size={14} color={THEME.colors.primary} style={{ marginRight: 6 }} />
                      <Text style={styles.diagActionBtnText}>[ OPEN ncpa.cpl (Win+R) ]</Text>
                    </TouchableOpacity>

                    <View style={styles.ipInputCard}>
                      <Text style={styles.ipInputHeading}>STATIC IP CONFIGURATION HELPER:</Text>
                      <View style={styles.ipInputRow}>
                        <TextInput
                          style={[styles.ipTextInput, { flex: 1 }]}
                          value={customIp}
                          onChangeText={setCustomIp}
                          placeholder="IP: 10.240.18.45"
                          placeholderTextColor={THEME.colors.textDim}
                        />
                        <TouchableOpacity
                          style={styles.copySmallBtn}
                          onPress={() => copyToClipboard(customIp, 'ip_address')}
                        >
                          <Text style={styles.copySmallBtnText}>COPY</Text>
                        </TouchableOpacity>
                      </View>

                      <View style={styles.ipInputRow}>
                        <TextInput
                          style={[styles.ipTextInput, { flex: 1 }]}
                          value={customSubnet}
                          onChangeText={setCustomSubnet}
                          placeholder="Subnet: 255.255.255.0"
                          placeholderTextColor={THEME.colors.textDim}
                        />
                        <TouchableOpacity
                          style={styles.copySmallBtn}
                          onPress={() => copyToClipboard(customSubnet, 'subnet')}
                        >
                          <Text style={styles.copySmallBtnText}>COPY</Text>
                        </TouchableOpacity>
                      </View>

                      <View style={styles.ipInputRow}>
                        <TextInput
                          style={[styles.ipTextInput, { flex: 1 }]}
                          value={customGateway}
                          onChangeText={setCustomGateway}
                          placeholder="Gateway: 10.240.18.1"
                          placeholderTextColor={THEME.colors.textDim}
                        />
                        <TouchableOpacity
                          style={styles.copySmallBtn}
                          onPress={() => copyToClipboard(customGateway, 'gateway')}
                        >
                          <Text style={styles.copySmallBtnText}>COPY</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {/* TARGETED DIAGNOSTIC: BLANK SCREEN */}
              {activeTroubleCategory === 'blank' && (
                <View style={styles.diagnosticPathBox}>
                  <Text style={styles.diagHeader}>BLANK / BLACK SCREEN</Text>
                  <Text style={styles.diagBodyText}>1. Verify TV display is turned ON with physical remote or bezel button.</Text>
                  <Text style={styles.diagBodyText}>2. Confirm HDMI cable is plugged into <Text style={{ color: '#fff', fontWeight: '900' }}>HDMI 1 / Display IN 1</Text>.</Text>
                  <Text style={styles.diagBodyText}>3. Re-seat HDMI firmly on both player and display ends.</Text>
                </View>
              )}

              {/* TARGETED DIAGNOSTIC: PLAYER FROZEN */}
              {activeTroubleCategory === 'frozen' && (
                <View style={styles.diagnosticPathBox}>
                  <Text style={styles.diagHeader}>PLAYER FROZEN / BROADSIGN LOOP</Text>
                  <Text style={styles.diagBodyText}>1. Connect USB keyboard to player port.</Text>
                  <Text style={styles.diagBodyText}>2. <Text style={{ color: THEME.colors.primary, fontWeight: '900' }}>SPAM CAPS LOCK</Text> repeatedly to break out of Boarding Control Player.</Text>
                  <Text style={styles.diagBodyText}>3. If still frozen, press <Text style={{ color: '#fff', fontWeight: '900' }}>Ctrl + Shift + Esc</Text> or hard power cycle.</Text>
                </View>
              )}

              {/* TARGETED DIAGNOSTIC: NO POWER */}
              {activeTroubleCategory === 'power' && (
                <View style={styles.diagnosticPathBox}>
                  <Text style={styles.diagHeader}>NO POWER / DEAD UNIT</Text>
                  <Text style={styles.diagBodyText}>1. Check power brick blue/green LED is glowing solid.</Text>
                  <Text style={styles.diagBodyText}>2. Confirm 240V power cord is firmly seated into power strip or wall socket.</Text>
                  <Text style={styles.diagBodyText}>3. If power brick LED is dark, replace IEC lead or switch to alternate GPO socket.</Text>
                </View>
              )}
            </View>
          )}



            {/* EXIT CLEARANCE: HARD VISUAL HOLD POINT */}
            <View style={styles.exitClearanceHoldCard}>
              <View style={styles.exitHoldHeader}>
                <Ionicons name="hand-left" size={26} color="#ef4444" style={{ marginRight: 8 }} />
                <Text style={styles.exitHoldTitle}>🛑 DO NOT LEAVE YET</Text>
              </View>

              <Text style={styles.exitHoldSub}>SLACK CLEARANCE REQUIRED</Text>
              <Text style={styles.exitHoldDesc}>
                You cannot complete this job until clearance has been received from Dispatch / TechMedia.
              </Text>

              {/* Clearance Checkbox */}
              <TouchableOpacity
                style={[styles.clearanceCheckButton, slackClearanceReceived && styles.clearanceCheckButtonActive]}
                onPress={() => setSlackClearanceReceived(!slackClearanceReceived)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={slackClearanceReceived ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={slackClearanceReceived ? THEME.colors.success : '#fff'}
                  style={{ marginRight: 10 }}
                />
                <Text style={[styles.clearanceCheckText, slackClearanceReceived && styles.clearanceCheckTextActive]}>
                  [ ✓ SLACK CLEARANCE RECEIVED ]
                </Text>
              </TouchableOpacity>

              {/* MANDATORY WOOLWORTHS SIGN-OUT CARD */}
              {isWoolworths && (
                <View style={styles.woolworthsSignOutCard}>
                  <View style={styles.woolworthsSignOutHeader}>
                    <Ionicons name="alert-circle" size={22} color="#ef4444" style={{ marginRight: 8 }} />
                    <Text style={styles.woolworthsSignOutTitle}>🔴 MANDATORY: SIGN OUT OF WOOLWORTHS</Text>
                  </View>
                  <Text style={styles.woolworthsSignOutAlertText}>
                    NO MATTER WHAT: Before leaving the store, you MUST physically sign out at the Woolworths 1-Touch / Site360 Contractor Kiosk and inform the Duty Manager!
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.woolworthsSignOutButton,
                      signedOutOfWoolworths && styles.woolworthsSignOutButtonActive,
                    ]}
                    onPress={() => setSignedOutOfWoolworths(!signedOutOfWoolworths)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={signedOutOfWoolworths ? 'checkbox' : 'square-outline'}
                      size={24}
                      color={signedOutOfWoolworths ? THEME.colors.success : '#ef4444'}
                      style={{ marginRight: 10 }}
                    />
                    <Text
                      style={[
                        styles.woolworthsSignOutButtonText,
                        signedOutOfWoolworths && styles.woolworthsSignOutButtonTextActive,
                      ]}
                    >
                      {signedOutOfWoolworths
                        ? '[ ✓ SIGNED OUT OF WOOLWORTHS KIOSK ]'
                        : '[ ⚠️ TAP TO CONFIRM WOOLWORTHS SIGN-OUT ]'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* COMPLETE JOB BUTTON (UNLOCKED ONLY WHEN CLEARANCE RECEIVED + WOOLWORTHS SIGN-OUT VERIFIED) */}
              {slackClearanceReceived && (!isWoolworths || signedOutOfWoolworths) ? (
                <View style={styles.completeJobWrapper}>
                  <View style={styles.clearanceReceivedPill}>
                    <Ionicons name="checkmark-done-circle" size={18} color={THEME.colors.success} style={{ marginRight: 6 }} />
                    <Text style={styles.clearanceReceivedText}>
                      ✓ {isWoolworths ? 'Slack clearance & Woolworths sign-out verified' : 'Slack clearance received'}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.completeJobButton}
                    onPress={handleCompleteJob}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="flash" size={20} color="#000" style={{ marginRight: 8 }} />
                    <Text style={styles.completeJobButtonText}>[ COMPLETE JOB ]</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.lockedCompleteJobPill}>
                  <Ionicons name="lock-closed" size={16} color={THEME.colors.textMuted} style={{ marginRight: 6 }} />
                  <Text style={styles.lockedCompleteJobText}>
                    {!slackClearanceReceived
                      ? 'Awaiting Slack clearance confirmation above...'
                      : isWoolworths && !signedOutOfWoolworths
                      ? 'Awaiting mandatory Woolworths kiosk sign-out...'
                      : 'Awaiting departure confirmation...'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* ========================================================================= */}
      {/* SERVICE M8 PASTE MODAL */}
      {/* ========================================================================= */}
      <Modal visible={showPasteModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="document-text" size={20} color={THEME.colors.primary} style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>PASTE SERVICEM8 JOB</Text>
              </View>
              <TouchableOpacity onPress={() => setShowPasteModal(false)}>
                <Ionicons name="close-circle" size={24} color={THEME.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSub}>
              Paste ticket text below. Work order, client, department, and mount location will auto-populate:
            </Text>

            <TextInput
              style={styles.modalInput}
              value={pastedText}
              onChangeText={setPastedText}
              multiline
              numberOfLines={7}
              placeholder="Paste job details here (e.g. WO# 0443161, Woolworths 1003 Deli Standard Wall Mount...)"
              placeholderTextColor={THEME.colors.textDim}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowPasteModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>CANCEL</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleApplyServiceM8}
              >
                <Text style={styles.modalSubmitBtnText}>AUTO-FILL & RUN</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: THEME.colors.bg,
  },
  scrollContainer: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 50,
  },
  toastBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  toastText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  topNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  navBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingRight: 8,
  },
  navBackText: {
    color: THEME.colors.primary,
    fontWeight: '800',
    fontSize: 14,
    marginLeft: 4,
  },
  navBrandBlock: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navBrandTitle: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 14,
    marginRight: 6,
  },
  navBrandSubtitle: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  navPasteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  navPasteBtnText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '900',
  },

  // BLUEPRINT HEADER
  blueprintHeaderBox: {
    alignItems: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    marginBottom: 20,
  },
  blueprintTitle: {
    color: THEME.colors.primary,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  blueprintSubHeading: {
    color: THEME.colors.primary,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  blueprintQuestion: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  // FRAME 1: 4 CLEAN MENU CARDS
  fourCleanCardsList: {
    gap: 12,
  },
  cleanMenuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.colors.surface,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
  },
  cleanMenuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cleanMenuEmoji: {
    fontSize: 24,
    marginRight: 14,
  },
  cleanMenuTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // FRAMES 2, 3, 4: CHOICE BUTTONS
  choicePillsList: {
    gap: 12,
  },
  bracketChoiceButton: {
    backgroundColor: THEME.colors.surface,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
    alignItems: 'center',
  },
  bracketChoiceSelected: {
    borderColor: THEME.colors.primary,
    backgroundColor: '#0c242e',
  },
  bracketChoiceText: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  bracketChoiceTextSelected: {
    color: THEME.colors.primary,
  },
  customJobsiteBox: {
    marginTop: 18,
    backgroundColor: THEME.colors.surface,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  customJobsitePrompt: {
    color: THEME.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
  },
  customJobsiteInput: {
    backgroundColor: THEME.colors.bg,
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 12,
  },
  customJobsiteBtn: {
    backgroundColor: THEME.colors.primary,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  customJobsiteBtnText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '900',
  },

  // FRAME 5: EXECUTION PROTOCOL
  executionPathBox: {
    backgroundColor: '#0a1622',
    padding: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: THEME.colors.primary,
    marginBottom: 16,
    alignItems: 'center',
  },
  executionPathJob: {
    color: THEME.colors.primary,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 4,
  },
  executionPathDetails: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  executionPathClient: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
  },

  // MANDATORY PPE CARD
  mandatoryCard: {
    backgroundColor: '#261905',
    borderColor: '#f59e0b',
    borderWidth: 1.5,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  mandatoryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  mandatoryHeaderTitle: {
    color: '#f59e0b',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  mandatoryContent: {
    marginVertical: 4,
  },
  mandatoryItem: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  mandatoryNote: {
    color: '#fde68a',
    fontSize: 12,
    marginTop: 6,
    lineHeight: 17,
  },

  // WAREHOUSE ALERT BOX (FRAME 1)
  warehouseAlertBox: {
    backgroundColor: '#271b05',
    borderColor: '#fbbf24',
    borderWidth: 1.5,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  warehouseAlertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  warehouseAlertTitle: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  warehouseAlertText: {
    color: '#fef08a',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },

  // ROUTER FIELD CARD (FRAME 5)
  routerFieldCard: {
    backgroundColor: '#0a1a33',
    borderColor: '#3b82f6',
    borderWidth: 2,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  routerFieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  routerFieldTitle: {
    color: '#60a5fa',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  routerFieldTip: {
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 4,
  },

  // REQUIRED TOOLS CARD
  requiredToolsCard: {
    backgroundColor: THEME.colors.surface,
    borderColor: THEME.colors.border,
    borderWidth: 1.5,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  requiredToolsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  requiredToolsHeaderTitle: {
    color: THEME.colors.primary,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  requiredToolsList: {
    gap: 6,
  },
  requiredToolRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  requiredToolName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  // HIGH DISPLAY TOP WARNING
  highDisplayTopWarningCard: {
    backgroundColor: '#261905',
    borderColor: '#eab308',
    borderWidth: 2,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },

  // CHECKLIST CARD
  checklistCard: {
    backgroundColor: THEME.colors.surface,
    borderColor: THEME.colors.border,
    borderWidth: 1.5,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  checklistHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    paddingBottom: 8,
  },
  checklistHeaderTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
  checklistCounterText: {
    color: THEME.colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  checklistItemsList: {
    gap: 10,
  },
  checkItemCard: {
    backgroundColor: THEME.colors.bg,
    borderColor: THEME.colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  checkItemCardDone: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  checkItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkItemRowDone: {
    opacity: 0.7,
  },
  checkItemText: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  checkItemTextDone: {
    textDecorationLine: 'line-through',
    color: '#94a3b8',
  },
  checkItemSlackRow: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  inlineSlackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.primary,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  inlineSlackBtnText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // GOLDEN RULE CARDS
  goldenRuleCard: {
    backgroundColor: '#1e1b06',
    borderColor: '#eab308',
    borderWidth: 2,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  goldenRuleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  goldenRuleHeaderTitle: {
    color: '#fbbf24',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  goldenRuleBold: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 4,
  },
  goldenRuleBody: {
    color: '#fef08a',
    fontSize: 13,
    lineHeight: 18,
  },

  // TROUBLESHOOTING
  troubleCard: {
    backgroundColor: THEME.colors.surface,
    borderColor: THEME.colors.border,
    borderWidth: 1.5,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  troubleMainTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 12,
    textAlign: 'center',
  },
  troublePillsGrid: {
    gap: 8,
  },
  troubleButtonPill: {
    backgroundColor: '#0f172a',
    borderColor: '#334155',
    borderWidth: 1.5,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  troubleButtonPillActive: {
    borderColor: THEME.colors.primary,
    backgroundColor: '#0c242e',
  },
  troubleButtonPillText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // DIAGNOSTIC FLOW
  diagnosticPathBox: {
    marginTop: 16,
    backgroundColor: '#081018',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: THEME.colors.primary,
  },
  diagHeader: {
    color: THEME.colors.primary,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 10,
    textAlign: 'center',
  },
  diagStepCard: {
    paddingVertical: 6,
  },
  diagStepLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 4,
  },
  diagCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  diagStepTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  diagActionBtn: {
    backgroundColor: '#1e293b',
    borderColor: THEME.colors.primary,
    borderWidth: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
  },
  diagActionBtnText: {
    color: THEME.colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  diagDivider: {
    height: 1,
    backgroundColor: THEME.colors.border,
    marginVertical: 10,
  },
  diagPrompt: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
  },
  diagFailCallout: {
    color: '#f87171',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 8,
  },
  diagOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  diagOptionPill: {
    backgroundColor: '#1e293b',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#475569',
  },
  diagOptionPillActiveGreen: {
    backgroundColor: '#064e3b',
    borderColor: '#10b981',
  },
  diagOptionPillActiveAmber: {
    backgroundColor: '#78350f',
    borderColor: '#f59e0b',
  },
  diagOptionPillActiveRed: {
    backgroundColor: '#7f1d1d',
    borderColor: '#ef4444',
  },
  diagOptionPillActiveCyan: {
    backgroundColor: '#0c4a6e',
    borderColor: '#38bdf8',
  },
  diagOptionPillText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
  },
  diagResultGreen: {
    backgroundColor: '#022c22',
    padding: 8,
    borderRadius: 6,
    marginTop: 4,
  },
  diagResultGreenText: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: '700',
  },
  diagResultAmber: {
    backgroundColor: '#451a03',
    padding: 8,
    borderRadius: 6,
    marginTop: 4,
  },
  diagResultAmberText: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '700',
  },
  diagResultRed: {
    backgroundColor: '#450a0a',
    padding: 8,
    borderRadius: 6,
    marginTop: 4,
  },
  diagResultRedText: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '700',
  },
  cmdSnippetBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#020617',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  cmdSnippetText: {
    color: '#38bdf8',
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '800',
  },
  copySmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.primary,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  copySmallBtnText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '900',
  },
  ipLookForCard: {
    backgroundColor: '#0f172a',
    borderRadius: 6,
    padding: 12,
    gap: 8,
    marginTop: 6,
  },
  ipLookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  ipLookLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
    marginRight: 6,
  },
  ipLookDesc: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  ipInputCard: {
    backgroundColor: '#0f172a',
    padding: 10,
    borderRadius: 6,
    marginTop: 10,
    gap: 8,
  },
  ipInputHeading: {
    color: THEME.colors.primary,
    fontSize: 11,
    fontWeight: '900',
  },
  ipInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ipTextInput: {
    backgroundColor: '#020617',
    color: '#fff',
    fontSize: 13,
    padding: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  diagBodyText: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6,
  },

  // SLACK ACTIONS
  slackActionsCard: {
    backgroundColor: THEME.colors.surface,
    borderColor: THEME.colors.border,
    borderWidth: 1.5,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    gap: 8,
  },
  slackActionsTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 4,
    textAlign: 'center',
  },
  slackCopyButton: {
    backgroundColor: '#0f172a',
    borderColor: '#334155',
    borderWidth: 1.5,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  slackCopyButtonText: {
    color: THEME.colors.primary,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // EXIT CLEARANCE HOLD POINT
  exitClearanceHoldCard: {
    backgroundColor: '#1c0c0c',
    borderColor: '#ef4444',
    borderWidth: 2,
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  exitHoldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  exitHoldTitle: {
    color: '#ef4444',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 1,
  },
  exitHoldSub: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 6,
    letterSpacing: 0.8,
  },
  exitHoldDesc: {
    color: '#fca5a5',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  clearanceCheckButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2b1010',
    borderColor: '#ef4444',
    borderWidth: 1.5,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 14,
  },
  clearanceCheckButtonActive: {
    backgroundColor: '#064e3b',
    borderColor: THEME.colors.success,
  },
  clearanceCheckText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  clearanceCheckTextActive: {
    color: '#6ee7b7',
  },
  completeJobWrapper: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
  },
  clearanceReceivedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  clearanceReceivedText: {
    color: THEME.colors.success,
    fontSize: 13,
    fontWeight: '800',
  },
  completeJobButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.success,
    paddingVertical: 16,
    borderRadius: 8,
    width: '100%',
  },
  completeJobButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
  lockedCompleteJobPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  lockedCompleteJobText: {
    color: THEME.colors.textMuted,
    fontSize: 12,
    fontStyle: 'italic',
  },

  // Woolworths Mandatory Sign-Out
  woolworthsSignOutCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: '#ef4444',
    borderWidth: 1.5,
    borderRadius: 8,
    padding: 14,
    marginVertical: 14,
  },
  woolworthsSignOutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  woolworthsSignOutTitle: {
    color: '#ef4444',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  woolworthsSignOutAlertText: {
    color: '#fca5a5',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
    fontWeight: '600',
  },
  woolworthsSignOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f1315',
    borderColor: '#ef4444',
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  woolworthsSignOutButtonActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: THEME.colors.success,
  },
  woolworthsSignOutButtonText: {
    color: '#ef4444',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.5,
    flex: 1,
  },
  woolworthsSignOutButtonTextActive: {
    color: THEME.colors.success,
  },

  // Router Swap Location Tip & Affected Screens
  routerLocationTipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(96, 165, 250, 0.12)',
    borderColor: '#60a5fa',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  routerLocationTipTitle: {
    color: '#60a5fa',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 2,
  },
  routerLocationTipText: {
    color: '#93c5fd',
    fontSize: 12,
    lineHeight: 17,
  },
  blueprintInstruction: {
    color: THEME.colors.textMuted,
    fontSize: 12,
    marginTop: 6,
    lineHeight: 17,
  },
  proceedFrameBtn: {
    backgroundColor: THEME.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  proceedFrameBtnText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  affectedScreensCard: {
    backgroundColor: THEME.colors.surface,
    borderColor: '#3b82f6',
    borderWidth: 1.5,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  affectedScreensHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  affectedScreensTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
    flex: 1,
  },
  affectedScreensCount: {
    color: '#60a5fa',
    fontWeight: '900',
    fontSize: 13,
  },
  affectedScreensSubtitle: {
    color: THEME.colors.textMuted,
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 16,
  },
  affectedScreensList: {
    gap: 8,
  },
  affectedScreenCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.bg,
    borderColor: THEME.colors.border,
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  affectedScreenCheckRowDone: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: THEME.colors.success,
  },
  affectedScreenCheckTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  affectedScreenCheckTitleDone: {
    color: THEME.colors.success,
  },
  affectedScreenCheckDesc: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },

  // MODAL
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: THEME.colors.surface,
    borderColor: THEME.colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 18,
    width: '100%',
    maxWidth: 500,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  modalSub: {
    color: THEME.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  modalInput: {
    backgroundColor: THEME.colors.bg,
    color: '#fff',
    fontSize: 13,
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#334155',
  },
  modalCancelBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
  },
  modalSubmitBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: THEME.colors.primary,
  },
  modalSubmitBtnText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 12,
  },
});
