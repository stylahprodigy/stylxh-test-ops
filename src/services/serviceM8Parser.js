/**
 * ServiceM8 & IT Hero Ticket Text Parser
 * Extracts Work Order, Affected Asset, Store Code, Location, Department, and Job Type.
 */

// Helper to convert camelCase or concatenated string like "EasternCreek" to "Eastern Creek"
function formatStoreName(rawName) {
  if (!rawName) return '';
  return rawName
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .trim();
}

export function parseServiceM8Job(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return null;
  }

  const text = rawText.trim();

  // 1. Work Order Number
  const woMatch = text.match(/Work Order Number:\s*([A-Za-z0-9-]+)/i) ||
                  text.match(/Work Order\s*#?:?\s*([A-Za-z0-9-]+)/i) ||
                  text.match(/WO\s*#?:?\s*([A-Za-z0-9-]+)/i);
  const workOrder = woMatch ? woMatch[1].trim() : '';

  // 2. Customer Reference Number (INC...)
  const refMatch = text.match(/Customer Reference Number:\s*([A-Za-z0-9-]+)/i) ||
                   text.match(/(INC\d{6,12})/i);
  const customerRef = refMatch ? refMatch[1].trim() : '';

  // 3. IT Hero Ticket ID (e.g. IT Hero 2270)
  const heroMatch = text.match(/IT Hero\s*(\d+)/i);
  const itHeroId = heroMatch ? heroMatch[1].trim() : '';

  // 4. Affected Asset block
  let affectedAsset = '';
  const assetBlockMatch = text.match(/Affected Asset\s*([\s\S]*?)(?=Scope of Works|Parts Required|Tools Required|$)/i);
  if (assetBlockMatch) {
    affectedAsset = assetBlockMatch[1]
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .join(' & ');
  }

  // Extract Store Code (e.g. 1003 from 1003-NSW-EasternCreek-Seafood)
  let storeCode = '';
  const codeMatch = text.match(/\b(\d{4,5})-(?:NSW|VIC|QLD|WA|SA|TAS|ACT|NT)-/i) ||
                    text.match(/Affected Asset\s*(\d{4,5})/i) ||
                    text.match(/\b(\d{4})\b/);
  if (codeMatch) {
    storeCode = codeMatch[1].trim();
  }

  // Extract Location Name (handles WOW-KIAMA, EasternCreek, etc.)
  let storeLocation = '';
  const locMatch = text.match(/\d+-(?:NSW|VIC|QLD|WA|SA|TAS|ACT|NT)-(?:WOW-|WOL-|COLES-|IGA-)?([A-Za-z]+)/i);
  if (locMatch) {
    storeLocation = formatStoreName(locMatch[1]);
  }

  // Extract Department / Area (Pickup, Seafood, Deli, Bakery, Meat, Community, Produce, Front of Store)
  let department = '';
  const lowerText = text.toLowerCase();
  if (lowerText.includes('pickup') || lowerText.includes('pick-up') || lowerText.includes('direct to boot') || lowerText.includes('outside') || lowerText.includes('drive thru')) {
    department = 'outside';
  } else if (lowerText.includes('seafood') || lowerText.includes('fish')) {
    department = 'seafood';
  } else if (lowerText.includes('deli')) {
    department = 'deli';
  } else if (lowerText.includes('bakery')) {
    department = 'bakery';
  } else if (lowerText.includes('meat')) {
    department = 'meat';
  } else if (lowerText.includes('produce')) {
    department = 'produce';
  } else if (lowerText.includes('front of store') || lowerText.includes('cartology')) {
    department = 'front of store';
  } else if (lowerText.includes('community')) {
    department = 'community';
  } else if (lowerText.includes('boh') || lowerText.includes('fd rack')) {
    department = 'boh';
  } else {
    department = 'outside';
  }

  // Detect Jobsite / Client
  let jobsite = 'Woolworths';
  if (lowerText.includes('iga')) {
    jobsite = 'IGA';
  } else if (lowerText.includes('coles')) {
    jobsite = 'Coles';
  } else if (lowerText.includes('dan murphy') || lowerText.includes('bws') || lowerText.includes('alh')) {
    jobsite = 'Dan Murphy\'s / BWS';
  } else if (lowerText.includes('woolworths') || lowerText.includes('cartology')) {
    jobsite = 'Woolworths';
  }

  // Detect Job Type
  let jobType = 'media_swap';
  let mountType = 'standard';
  let summaryAction = 'swap out media player';

  if (lowerText.includes('router') || lowerText.includes('booster antenna') || lowerText.includes('fd rack')) {
    jobType = 'router_swap';
    mountType = lowerText.includes('ladder') || lowerText.includes('height') ? 'fd_rack_height' : 'fd_rack';
    summaryAction = 'router swap';
  } else if (lowerText.includes('pcu') || lowerText.includes('power control')) {
    jobType = 'pcu_swap';
    mountType = 'cartology_front';
    summaryAction = 'pcu swap';
  } else if (lowerText.includes('clean') || lowerText.includes('proactive')) {
    jobType = 'proactive';
    mountType = 'front_store';
    summaryAction = 'proactive clean';
  } else {
    jobType = 'media_swap';
    if (lowerText.includes('ladder') || lowerText.includes('height') || lowerText.includes('high')) {
      mountType = 'high_suspended';
    } else if (lowerText.includes('front of store') || lowerText.includes('cartology')) {
      mountType = 'cartology_front';
    } else {
      mountType = 'standard';
    }
    summaryAction = 'swap out media player';
  }

  // Site Contact
  const contactMatch = text.match(/Site Contact:\s*([\s\S]*?)(?=Affected Asset|Scope of Works|$)/i);
  const siteContact = contactMatch
    ? contactMatch[1]
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
        .join(' - ')
    : '';

  // Working at heights / tech count
  const heights = lowerText.includes('working at heights requirement\nyes') || lowerText.includes('ladder') || lowerText.includes('height');
  const techsMatch = text.match(/Number of Techs Required\s*(\d+)/i);
  const techsRequired = techsMatch ? parseInt(techsMatch[1], 10) : (heights ? 2 : 1);

  // Formatted Client String for Timesheet
  // User asked for: "client store location code only"
  const clientStore = storeLocation
    ? `${jobsite} ${storeLocation}`
    : (storeCode ? `${jobsite} Store ${storeCode}` : jobsite);

  // Work Details summary (concise format: e.g. "swap out media player - outside")
  let workDetails = '';
  if (jobType === 'router_swap') {
    workDetails = 'router swap';
  } else if (jobType === 'pcu_swap') {
    workDetails = department ? `pcu swap - ${department}` : 'pcu swap';
  } else if (jobType === 'proactive') {
    workDetails = 'proactive clean';
  } else {
    workDetails = department ? `${summaryAction} - ${department}` : summaryAction;
  }

  return {
    rawText,
    workOrder,
    customerRef,
    itHeroId,
    affectedAsset,
    storeCode,
    storeLocation,
    department,
    jobsite,
    jobType,
    mountType,
    siteContact,
    workingAtHeights: heights,
    techsRequired,
    // Timesheet specific pre-fills
    timesheet: {
      client: clientStore,
      locationCode: storeCode, // store code only
      workDetails,
      scope: summaryAction,
    },
  };
}
