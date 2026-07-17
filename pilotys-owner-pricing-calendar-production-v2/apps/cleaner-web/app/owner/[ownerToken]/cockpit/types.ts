export type Tone = "navy" | "blue" | "orange" | "mustard" | "green";
export type MetricId = "realised" | "gross" | "net";
export type OwnerScope = string;

export type OwnerCockpitOwner = {
  id: string;
  token: string;
  displayName: string;
  profilePhotoUrl?: string | null;
};

export type OwnerCockpitListing = {
  id: string;
  name: string;
  short: string;
  image?: string | null;
  tone: Tone;
  dot: string;
  status: string;
  revenue: number;
  occupancy: number;
};

export type MonthlyRevenuePoint = {
  month: string;
  realised: number;
  future: number;
  target?: number;
  live?: boolean;
};

export type ExpenseBreakdownItem = {
  label: string;
  amount: number;
  count: number;
};

export type FinancialSummary = {
  realisedRevenue: number;
  realisedAtStartOfToday: number;
  activeDailyRevenue: number;
  grossAnnualRevenue: number;
  afterVariables: number;
  variableCosts: number;
  expenseBreakdownItems: ExpenseBreakdownItem[];
  grossDeltaPct?: number | null;
  afterVariablesDeltaPct?: number | null;
};

export type PlanningDay = {
  key: string;
  month: string;
  label: string;
  tension: number;
};

export type PlanningMonthSpan = {
  month: string;
  start: number;
  span: number;
};

export type PlanningReservation = {
  id: string;
  listingId: string;
  guest: string;
  start: number;
  span: number;
  price: number;
  nightly: number;
  href: string;
  cleaningState: "none" | "planned" | "accepted";
  cleaningDay?: number | null;
};

export type PlanningMarker = {
  id: string;
  listingId: string;
  day: number;
  icon: string;
  tone: Tone;
  label: string;
  href: string;
  statusLabel: string;
  avatarUrl?: string | null;
  avatarInitials: string;
};

export type DailyPrice = {
  listingId: string;
  day: number;
  price: number;
};

export type TimelineKind = "arrival" | "departure" | "cleaning" | "intervention";

export type TimelineEvent = {
  id: string;
  kind: TimelineKind;
  side: "past" | "future";
  time: string;
  eventAt: string;
  listingId: string;
  title: string;
  detail: string;
  status?: string;
  tone: Tone;
  href?: string;
  avatarUrl?: string | null;
  avatarInitials?: string;
};

export type Opportunity = {
  id: string;
  title: string;
  listing: string;
  period: string;
  potential: number;
  action: string;
  tone: Tone;
};


export type PricingCalendarDay = {
  listingId: string;
  date: string;
  finalPrice: number;
  marketSignalPct: number;
  sourceSeasonId?: string | null;
  explanationSteps: Record<string, any>[];
};

export type PricingSeason = {
  id: string;
  listingId: string;
  name: string;
  startDate: string;
  endDate: string;
};

export type PricingReservation = {
  id: string;
  listingId: string;
  guest: string;
  start: string;
  end: string;
  total: number;
};

export type JournalHeadline = {
  id: string;
  headline: string;
  detail?: string | null;
  occurredAt: string;
};

export type OwnerCockpitData = {
  owner: OwnerCockpitOwner;
  listings: OwnerCockpitListing[];
  selectedListingIds: string[];
  financial: FinancialSummary;
  monthlyRevenue: MonthlyRevenuePoint[];
  today: string;
  planningDays: PlanningDay[];
  monthSpans: PlanningMonthSpan[];
  planningReservations: PlanningReservation[];
  planningMarkers: PlanningMarker[];
  dailyPrices: DailyPrice[];
  timelineEvents: TimelineEvent[];
  opportunities: Opportunity[];
  pricingCalendar: PricingCalendarDay[];
  pricingSeasons: PricingSeason[];
  pricingReservations: PricingReservation[];
  journalHeadlines: JournalHeadline[];
};
