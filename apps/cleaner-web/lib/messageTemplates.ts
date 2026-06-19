type Prefixable = {
  isTest?: boolean;
};

function prefix(label: string, isTest?: boolean): string {
  return isTest ? `TEST · ${label}` : label;
}

function cleanLines(lines: Array<string | null | undefined>): string {
  return lines
    .map((line) => String(line ?? "").trim())
    .filter(Boolean)
    .join("\n");
}

export function missionOfferCleanerMessage({
  propertyName,
  missionUrl,
  isTest,
}: Prefixable & {
  propertyName: string;
  missionUrl: string;
}) {
  return cleanLines([
    prefix("Nouvelle mission", isTest),
    `${propertyName} · prêt avant 16h`,
    `Choisir le jour : ${missionUrl}`,
  ]);
}

export function missionAcceptedCleanerMessage({
  propertyName,
  readyByLabel,
  reportUrl,
  isTest,
}: Prefixable & {
  propertyName: string;
  readyByLabel: string;
  reportUrl: string;
}) {
  return cleanLines([
    prefix("Mission confirmée", isTest),
    propertyName,
    `Vous vous engagez à rendre le logement prêt avant 16h le ${readyByLabel}.`,
    `Rapport : ${reportUrl}`,
  ]);
}

export function missionAcceptedOwnerMessage({
  propertyName,
  cleanerName,
  readyByLabel,
  isTest,
}: Prefixable & {
  propertyName: string;
  cleanerName: string;
  readyByLabel: string;
}) {
  return cleanLines([
    prefix("Mission acceptée", isTest),
    `${cleanerName} a accepté la mission ${propertyName}.`,
    `Logement prévu prêt avant 16h le ${readyByLabel}.`,
  ]);
}

export function missionRefusedCleanerMessage({
  propertyName,
  refusalReason,
  isTest,
}: Prefixable & {
  propertyName: string;
  refusalReason: string;
}) {
  return cleanLines([
    prefix("Refus enregistré", isTest),
    propertyName,
    "Votre refus a bien été pris en compte.",
    `Raison : ${refusalReason}`,
  ]);
}

export function missionRefusedOwnerWithBackupMessage({
  propertyName,
  primaryCleanerName,
  backupCleanerName,
  refusalReason,
  isTest,
}: Prefixable & {
  propertyName: string;
  primaryCleanerName: string;
  backupCleanerName: string;
  refusalReason: string;
}) {
  return cleanLines([
    prefix("Mission refusée", isTest),
    `${primaryCleanerName} a refusé la mission ${propertyName}.`,
    `Raison : ${refusalReason}`,
    `La mission a été proposée à ${backupCleanerName}.`,
  ]);
}

export function missionRefusedOwnerNoBackupMessage({
  propertyName,
  primaryCleanerName,
  refusalReason,
  isTest,
}: Prefixable & {
  propertyName: string;
  primaryCleanerName: string;
  refusalReason: string;
}) {
  return cleanLines([
    prefix("Mission refusée", isTest),
    `${primaryCleanerName} a refusé la mission ${propertyName}.`,
    `Raison : ${refusalReason}`,
    "Aucun backup disponible automatiquement. Action manuelle nécessaire.",
  ]);
}

export function backupMissionOfferMessage({
  propertyName,
  missionUrl,
  isTest,
}: Prefixable & {
  propertyName: string;
  missionUrl: string;
}) {
  return cleanLines([
    prefix("Nouvelle mission", isTest),
    `${propertyName} · prêt avant 16h`,
    `Choisir le jour : ${missionUrl}`,
  ]);
}

export function planningChangedCleanerMessage({
  propertyName,
  isTest,
}: Prefixable & {
  propertyName: string;
}) {
  return cleanLines([
    prefix("Planning modifié", isTest),
    `Le planning du logement ${propertyName} a changé.`,
    "Nous vérifions l’organisation et revenons vers vous rapidement.",
  ]);
}

export function planningChangedOwnerMessage({
  propertyName,
  isTest,
}: Prefixable & {
  propertyName: string;
}) {
  return cleanLines([
    prefix("Planning modifié", isTest),
    `Une nouvelle réservation affecte la mission ${propertyName}.`,
    "Organisation à vérifier manuellement.",
  ]);
}
