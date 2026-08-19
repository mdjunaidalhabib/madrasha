export interface ScanCardRequestDto {
  card_uid: string;
}

export interface ScanFingerprintRequestDto {
  fingerprint_id: string;
}

export interface CreateKioskDeviceRequestDto {
  name: string;
}

/** Trimmed student payload returned to the kiosk after a successful scan -
 * intentionally excludes anything beyond what a gate display needs. */
export interface KioskScanStudentDto {
  id: number;
  name_bn: string;
  roll: number;
  class_id: number;
  image: string | null;
}

export interface KioskScanResultDto {
  alreadyMarked: boolean;
  student: KioskScanStudentDto;
}

/** Kiosk device row shown to admins - never includes apiKeyHash. */
export interface KioskDeviceDto {
  id: number;
  name: string;
  isActive: boolean;
  lastSeenAt: Date | null;
  createdAt: Date;
}

export interface CreateKioskDeviceResultDto {
  id: number;
  name: string;
  rawKey: string;
}
