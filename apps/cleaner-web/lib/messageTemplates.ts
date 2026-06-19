import templates from "../config/message_templates/cleaning_sms.fr.json";

type TemplateKey = keyof typeof templates;

type Vars = Record<string, string | number | null | undefined>;

function renderTemplate(key: TemplateKey, vars: Vars = {}, isTest = false): string {
  const lines = templates[key] as string[];

  const rendered = lines
    .map((line) =>
      line.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, name: string) => {
        const value = vars[name];
        return value === null || value === undefined ? "" : String(value);
      }),
    )
    .map((line) => line.trim())
    .filter(Boolean);

  if (isTest && rendered.length > 0) {
    rendered[0] = `TEST · ${rendered[0]}`;
  }

  return rendered.join("\n");
}

export function missionOfferCleanerMessage(args: {
  propertyName: string;
  missionUrl: string;
  isTest?: boolean;
}) {
  return renderTemplate(
    "mission_offer_cleaner",
    {
      property_name: args.propertyName,
      mission_url: args.missionUrl,
    },
    args.isTest,
  );
}

export function missionAcceptedCleanerMessage(args: {
  propertyName: string;
  readyByLabel: string;
  reportUrl: string;
  isTest?: boolean;
}) {
  return renderTemplate(
    "mission_accepted_cleaner",
    {
      property_name: args.propertyName,
      ready_by_label: args.readyByLabel,
      report_url: args.reportUrl,
    },
    args.isTest,
  );
}

export function missionAcceptedOwnerMessage(args: {
  propertyName: string;
  cleanerName: string;
  readyByLabel: string;
  isTest?: boolean;
}) {
  return renderTemplate(
    "mission_accepted_owner",
    {
      property_name: args.propertyName,
      cleaner_name: args.cleanerName,
      ready_by_label: args.readyByLabel,
    },
    args.isTest,
  );
}

export function missionRefusedCleanerMessage(args: {
  propertyName: string;
  refusalReason: string;
  isTest?: boolean;
}) {
  return renderTemplate(
    "mission_refused_cleaner",
    {
      property_name: args.propertyName,
      refusal_reason: args.refusalReason,
    },
    args.isTest,
  );
}

export function missionRefusedOwnerWithBackupMessage(args: {
  propertyName: string;
  primaryCleanerName: string;
  backupCleanerName: string;
  refusalReason: string;
  isTest?: boolean;
}) {
  return renderTemplate(
    "mission_refused_owner_backup",
    {
      property_name: args.propertyName,
      primary_cleaner_name: args.primaryCleanerName,
      backup_cleaner_name: args.backupCleanerName,
      refusal_reason: args.refusalReason,
    },
    args.isTest,
  );
}

export function missionRefusedOwnerNoBackupMessage(args: {
  propertyName: string;
  primaryCleanerName: string;
  refusalReason: string;
  isTest?: boolean;
}) {
  return renderTemplate(
    "mission_refused_owner_no_backup",
    {
      property_name: args.propertyName,
      primary_cleaner_name: args.primaryCleanerName,
      refusal_reason: args.refusalReason,
    },
    args.isTest,
  );
}

export function backupMissionOfferMessage(args: {
  propertyName: string;
  missionUrl: string;
  isTest?: boolean;
}) {
  return renderTemplate(
    "backup_mission_offer",
    {
      property_name: args.propertyName,
      mission_url: args.missionUrl,
    },
    args.isTest,
  );
}

export function planningChangedCleanerMessage(args: {
  propertyName: string;
  isTest?: boolean;
}) {
  return renderTemplate(
    "planning_changed_cleaner",
    {
      property_name: args.propertyName,
    },
    args.isTest,
  );
}

export function planningChangedOwnerMessage(args: {
  propertyName: string;
  isTest?: boolean;
}) {
  return renderTemplate(
    "planning_changed_owner",
    {
      property_name: args.propertyName,
    },
    args.isTest,
  );
}

export function paymentRequestOwnerMessage(args: {
  cleanerName: string;
  periodLabel: string;
  amountEur: string;
  dueDays: number;
  paymentUrl: string;
  isTest?: boolean;
}) {
  return renderTemplate(
    "payment_request_owner",
    {
      cleaner_name: args.cleanerName,
      period_label: args.periodLabel,
      amount_eur: args.amountEur,
      due_days: args.dueDays,
      payment_url: args.paymentUrl,
    },
    args.isTest,
  );
}
