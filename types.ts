// Author: Gemini
// OS support: Web/Node
// Description: Type definitions for laboratory testing schedule application with sync diagnostic reports, notification support, guest roles, and cloud settings

export enum MachineType {
  AIR_CONDITIONER = 'Điều hòa không khí',
  REFRIGERATOR = 'Tủ lạnh',
  WASHING_MACHINE = 'Máy giặt',
  TV = 'Tivi',
  LIGHT_BULB = 'Bóng đèn',
  FAN = 'Quạt điện',
  WATER_HEATER = 'Bình đun nóng lạnh',
  RICE_COOKER = 'Nồi cơm điện',
  OTHER = 'Khác'
}

export enum RequestStatus {
  PENDING = 'Pending',
  APPROVED = 'Đã chấp nhận',
  SAMPLES_RECEIVED = 'Đã nhận mẫu',
  SCHEDULED = 'Đã xếp lịch',
  TESTING = 'Đang thử nghiệm',
  RESULTS_SUBMITTED = 'Chờ duyệt KQTN',
  RESULTS_APPROVED = 'Đã duyệt KQ',
  COMPLETED = 'Hoàn thành',
  CANCELLED = 'Đã hủy',
  REQ_SUPPLEMENT = 'Cần bổ sung',
}

export enum SampleStatus {
  WAITING = 'Chờ nhận mẫu',
  IN_LAB = 'Mẫu trong kho',
  RETURNED = 'Đã trả khách',
}

export enum PriorityLevel {
  NORMAL = 1,
  HIGH = 2,
  VIP = 3,
  URGENT = 4,
}

export enum HandoverType {
  RECEIVE = 'Nhận mẫu',
  RETURN = 'Trả mẫu',
}

export interface AppSettings {
  workOnSaturday: boolean;
  workOnSunday: boolean;
  defaultTesters?: string[];
  defaultTestersAtd?: string[];
  defaultTestersEmc?: string[];
  defaultTestersChamber1?: string[];
  defaultTestersChamber2?: string[];
  cloudSyncEnabled?: boolean;
  geminiModel?: string;
  lastBackupDate?: string;
  updatedAt?: string;
}

export interface DayConfig {
  date: string;
  isPeakDay: boolean;
  isHoliday?: boolean;
  note?: string;
}

export interface HandoverDoc {
  id: string;
  docNumber: string;
  type: HandoverType;
  date: string;
  customerName: string;
  customerAddress?: string;
  customerPhone?: string;
  representative: string;
  customerPosition?: string;
  driverName?: string;
  vehicleInfo?: string;
  labName: string;
  labAddress: string;
  labRepresentative: string;
  labRepPosition: string;
  labRepPhone: string;
  sampleIds: string[];
  status: 'Draft' | 'Signed';
  createdAt?: string;
  updatedAt?: string;
  isSynced?: boolean;
}

export interface TestResult {
  ecnCode?: string;
  testDate?: string;
  serialNumber?: string;
  manufactureYear?: string;
  country?: string;
  coolingCapacity?: number;
  powerInput?: number;
  current?: number;
  measuredCapacity?: number;
  measuredPower?: number;
  cspf?: number;
  energyLevel?: number;
}

export enum TestCategory {
  ATD = 'An toàn điện',
  EMC = 'Tương thích điện từ',
  BOTH = 'Cả An toàn điện và EMC'
}

export interface Sample {
  id: string;
  pycNo: string;
  sampleCode?: string;
  sampleName: string;
  model: string;
  brand?: string;
  quantity: number;
  status: SampleStatus;
  receivedDate?: string;
  testDate?: string;
  tester?: string;
  testCategory?: TestCategory;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  isSynced?: boolean;
}

export interface TestRequest {
  id: string;
  requestCode: string;
  status: RequestStatus;
  sampleStatus: SampleStatus;
  customerName: string;
  address?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  taxId?: string;
  invoiceCompanyName?: string;
  invoiceAddress?: string;
  invoiceTaxId?: string;
  invoiceEmail?: string;
  invoiceReceiverName?: string;
  otherCustomerInfo?: string;
  labAddress?: string;
  resultCopyCount?: number;
  modelName: string;
  brand?: string;
  type: string;
  testCategory?: TestCategory;
  quantity: number;
  unit?: string;
  sampleCondition?: string;
  postTestHandling?: string;
  atdEncodeNumber?: string;
  emcEncodeNumber?: string;
  itdEncodeNumber?: string;
  encodeNumber?: string;
  specifications?: string;
  standard?: string;
  testTimeEMC?: number;
  testTimeATD?: number;
  priority: PriorityLevel;
  requestDate: string;
  receivedDate?: string;
  scheduledDate: string | null;
  endDate?: string | null;
  duration: number;
  testerName?: string;
  ecnCode?: string;
  returnDate?: string;
  returnRecipient?: string;
  returnDocNo?: string;
  note?: string;
  customsDeadline?: string;
  retryCount?: number;
  lastFailReason?: string;
  result?: TestResult;
  senderUnit?: string;
  sampleLocation?: string;
  price?: string | number;
  testCriteria?: string;
  managerComment?: string;
  totalLotDays?: number;
  deadlineDate?: string;
  order?: number;
  createdAt?: string;
  updatedAt?: string;
  isSynced?: boolean;
  chamberId?: 'Chamber 1' | 'Chamber 2';
  sealStamp?: string;
  mtt?: string;
  printStatus?: string;
  isPycPrinted?: boolean;
  pycPrintStatus?: string;
  isNewSampleNoPYC?: boolean;
}

export interface CustomerRef {
  name: string;
  address: string;
  taxId?: string;
  phone?: string;
  email?: string;
  contactPerson?: string;
  customerCode?: string;
  normalizedSearchStr?: string;
  createdAt?: string;
  updatedAt?: string;
  isSynced?: boolean;
}

export interface ProductRef {
  id?: string;
  name: string;
  testTimeEMC?: number;
  testTimeATD?: number;
  updatedAt?: string;
  createdAt?: string;
}

export interface Tester {
  name: string;
  shortName: string;
  colorClass: string;
  position?: string;
  responsibilities?: string;
  phone?: string;
}

export type NotificationEntityType = 'REQUEST' | 'HANDOVER_DOC' | 'KQTN_RECORD' | 'SCHEDULE';

export type NotificationAction = 'CREATED' | 'UPDATED' | 'DELETED' | 'STATUS_CHANGED' | 'SCHEDULED' | 'UNSCHEDULED' | 'ASSIGNED';

export type ActivityLogAction = NotificationAction | 'IMPORTED' | 'RESTORED' | 'CONFIGURED';

export type ActivityLogEntityType =
  | NotificationEntityType
  | 'USER'
  | 'CUSTOMER'
  | 'PRODUCT'
  | 'BRAND'
  | 'SYSTEM_SETTINGS'
  | 'SYSTEM';

export interface ActivityLogChange {
  field: string;
  before: unknown;
  after: unknown;
}

export interface ActivityLog {
  id: string;
  createdAt: string;
  actorUsername?: string;
  actorName: string;
  actorRole?: UserRole;
  action: ActivityLogAction;
  entityType: ActivityLogEntityType;
  entityId?: string;
  entityLabel?: string;
  requestCode?: string;
  docNumber?: string;
  reportNo?: string;
  summary: string;
  changes?: ActivityLogChange[];
  source: 'UI' | 'IMPORT' | 'RESTORE' | 'SYSTEM';
  groupId?: string;
}

export interface ActivityKpiSummary {
  actorUsername: string;
  actorName: string;
  totalActions: number;
  requestsCreated: number;
  samplesProcessed: number;
  kqtnUpdated: number;
  handoversCreated: number;
  workActions: number;
  requestActions: number;
  kqtnActions: number;
  handoverActions: number;
  scheduleActions: number;
  otherActions: number;
  lastActivityAt: string | null;
}

export type NotificationTargetRole = 'admin' | 'staff' | 'all';

export type AppNotificationType = 'NEW_REQUEST' | 'STATUS_CHANGE' | 'BUSINESS_ACTIVITY' | 'SYSTEM';

export interface AppNotification {
  id: string;
  type: AppNotificationType;
  title: string;
  message: string;
  entityType?: NotificationEntityType;
  action?: NotificationAction;
  entityId?: string;
  entityLabel?: string;
  requestCode?: string;
  docNumber?: string;
  reportNo?: string;
  customerName?: string;
  modelName?: string;
  testCategory?: TestCategory;
  previousStatus?: string;
  nextStatus?: string;
  scheduledDate?: string | null;
  createdBy?: string;
  createdAt: string;
  read: boolean;
  targetRole?: NotificationTargetRole;
  targetUsernames?: string[];
}

export const LAB_CONSTANTS = {
  CAPACITY_NORMAL: 8,
  CAPACITY_PEAK: 22,
  DAYS_PER_MONO: 2,
  DAYS_PER_INVERTER: 3,
  HOURS_PER_WORK_DAY: 8,
  PEAK_LOAD_THRESHOLD: 15,
  TURNAROUND_MONO_DAYS: 2,
  TURNAROUND_INVERTER_DAYS: 3
};

export const LAB_METADATA = {
  name: 'Trung tâm Thử nghiệm - Kiểm định Công nghiệp',
  addresses: [
    'Số 3 ngõ 76 đường Trung Văn, Phường Đại Mỗ, Thành phố Hà Nội',
    'Số 565 đường Nguyễn Trãi, Phường Thanh Liệt, Thành phố Hà Nội'
  ],
  staff: [
    { name: 'Vũ Việt Anh', position: 'Phó trưởng phòng' },
    { name: 'Lương Xuân Hùng', position: 'Phó trưởng phòng' },
    { name: 'Vũ Ngọc Linh', position: 'Thử nghiệm EMC' },
    { name: 'Nguyễn Mạnh Trọng', position: 'Thử nghiệm EMC' },
    { name: 'Tống Đăng Quý', position: 'Thử nghiệm dây cáp điện' },
    { name: 'Lã Trung Sơn', position: 'Thử nghiệm ATĐ' },
    { name: 'Vũ Nam Thái', position: 'Thử nghiệm ATĐ' },
    { name: 'Lại Minh Quang', position: 'Thử nghiệm ATĐ (cáp)' }
  ]
};

export const INITIAL_TESTERS: Tester[] = [
  { name: 'Vũ Việt Anh', shortName: 'Việt Anh', colorClass: 'bg-tester-1 text-tester-1-fg border-tester-1-fg/20', position: 'Phó trưởng phòng' },
  { name: 'Lương Xuân Hùng', shortName: 'Hùng', colorClass: 'bg-tester-2 text-tester-2-fg border-tester-2-fg/20', position: 'Phó trưởng phòng' },
  { name: 'Vũ Ngọc Linh', shortName: 'Linh', colorClass: 'bg-tester-3 text-tester-3-fg border-tester-3-fg/20', position: 'Thử nghiệm EMC' },
  { name: 'Nguyễn Mạnh Trọng', shortName: 'Trọng', colorClass: 'bg-tester-4 text-tester-4-fg border-tester-4-fg/20', position: 'Thử nghiệm EMC' },
  { name: 'Tống Đăng Quý', shortName: 'Quý', colorClass: 'bg-tester-5 text-tester-5-fg border-tester-5-fg/20', position: 'Thử nghiệm dây cáp điện' },
  { name: 'Lã Trung Sơn', shortName: 'Sơn', colorClass: 'bg-tester-6 text-tester-6-fg border-tester-6-fg/20', position: 'Thử nghiệm ATĐ' },
  { name: 'Vũ Nam Thái', shortName: 'Thái', colorClass: 'bg-tester-7 text-tester-7-fg border-tester-7-fg/20', position: 'Thử nghiệm ATĐ' },
  { name: 'Lại Minh Quang', shortName: 'Quang', colorClass: 'bg-tester-8 text-tester-8-fg border-tester-8-fg/20', position: 'Thử nghiệm ATĐ (cáp)' },
  { name: 'Khác', shortName: 'Khác', colorClass: 'bg-tester-other text-tester-other-fg border-tester-other-fg/20', position: '' },
];

export const DEFAULT_TESTER = INITIAL_TESTERS[0].name;

export type UserRole = 'admin' | 'tester' | 'viewer' | 'guest';

export interface UserAccount {
  username: string;
  name: string;
  role: UserRole;
  position?: string;
}

export interface UserPreferences {
  customPassword?: string;
  geminiApiKey?: string;
  geminiModel?: string;
  avatarUrl?: string;
}

export const PRESET_ACCOUNTS: UserAccount[] = [
  { username: 'luongxuanhung', name: 'Lương Xuân Hùng', role: 'admin', position: 'Phó trưởng phòng' },
  { username: 'vuvietanh', name: 'Vũ Việt Anh', role: 'admin', position: 'Phó trưởng phòng' },
  { username: 'tongdangquy', name: 'Tống Đăng Quý', role: 'tester', position: 'Nhân viên' },
  { username: 'latrungson', name: 'Lã Trung Sơn', role: 'tester', position: 'Nhân viên' },
  { username: 'vunamthai', name: 'Vũ Nam Thái', role: 'tester', position: 'Nhân viên' },
  { username: 'nguyenmanhtrong', name: 'Nguyễn Mạnh Trọng', role: 'tester', position: 'Nhân viên' },
  { username: 'vutienlinh', name: 'Vũ Ngọc Linh', role: 'tester', position: 'Nhân viên' },
  { username: 'laiminhquang', name: 'Lại Minh Quang', role: 'tester', position: 'Nhân viên' },
  { username: 'tranhoangphuong', name: 'Trần Hoàng Phương', role: 'guest', position: 'Khách' },
  { username: 'nguyentuanthanh', name: 'Nguyễn Tuấn Thành', role: 'guest', position: 'Khách' },
  { username: 'vuthitham', name: 'Vũ Thị Thắm', role: 'guest', position: 'Khách' },
  { username: 'dangducbinh', name: 'Đặng Đức Bình', role: 'guest', position: 'Khách' },
  { username: 'nguyenquocviet', name: 'Nguyễn Quốc Việt', role: 'guest', position: 'Khách' },
  { username: 'buithivananh', name: 'Bui Thị Vân Anh', role: 'guest', position: 'Khách' },
  { username: 'nguyenthivananh', name: 'Bui Thị Vân Anh ', role: 'guest', position: 'Khách' }
];

export const getProductDefaultTime = (name: string): { testTimeEMC: number; testTimeATD: number } => {
  const norm = (name || '').toLowerCase().trim();
  if (
    norm === 'bếp điện từ đôi' ||
    norm === 'bếp điện từ đôi âm' ||
    norm === 'bếp điện từ đôi hồng ngoại' ||
    norm.includes('bếp điện từ đôi') ||
    norm.includes('bếp từ đôi')
  ) {
    return { testTimeEMC: 530, testTimeATD: 60 };
  }
  return { testTimeEMC: 480, testTimeATD: 60 };
};

export interface KQTNVersionHistory {
  version: number;
  updatedAt: string;
  updatedBy: string;
  changeNote: string;
  summaryChanges?: string;
  snapshotData?: {
    reportMeta?: any;
    testResults?: any;
    emcData?: any;
    dayCapDienData?: any;
  };
}

export interface KqtnPdfMetadata {
  assetId: string;
  bucketName: string;
  objectPath: string;
  originalName: string;
  mimeType: 'application/pdf';
  byteSize: number;
  sha256: string;
  uploadedAt: string;
  uploadedBy?: string;
}

export interface KQTNRecord {
  id: string;
  requestId?: string;
  requestCode?: string;
  sampleCode: string;
  sampleKey?: string;
  reportNo: string;
  sealStamp?: string;
  sampleName: string;
  model: string;
  brand?: string;
  senderUnit?: string;
  standardId: string;
  standardTitle: string;
  criteriaType?: 'full' | 'reduced';
  subOptionTitle?: string;
  testDate?: string;
  reportDate?: string;
  testerName?: string;
  testResultsData?: Record<string, any>;
  emcData?: any;
  dayCapDienData?: any;
  productPhoto1?: string;
  productPhoto2?: string;
  nameplatePhoto1?: string;
  nameplatePhoto2?: string;
  nameplatePhotos?: string[];
  resultPdf?: KqtnPdfMetadata;
  version: number;
  versionHistory: KQTNVersionHistory[];
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  isSynced?: boolean;
}

export interface LotDiagnosisResult {
  targetQuery: string;
  foundInPostgresServer: boolean;
  foundInPostgresCache: boolean;
  foundInLocal: boolean;
  isDeleted: boolean;
  isHiddenByFilter: boolean;
  hiddenReason?: string;
  matchedRecord?: {
    id: string;
    requestCode?: string;
    encodeNumber?: string;
    sampleCode?: string;
    sampleName?: string;
    customerName?: string;
    requestDate?: string;
    createdAt?: string;
    updatedAt?: string;
    sampleStatus?: string;
    source: 'postgres-server' | 'postgres-cache' | 'local';
  };
  diagnosis: string;
  suggestedAction: string;
}

export interface SyncDiagnosticReport {
  timestamp: string;
  durationMs: number;
  postgres: {
    status: 'success' | 'warning' | 'error';
    fromCache: boolean;
    error?: string;
    collections: {
      requests: number;
      handoverDocs: number;
      customers: number;
      products: number;
      brands: number;
      systemUsers: number;
      systemConfig: number;
      kqtnRecords: number;
      notifications: number;
    };
  };
  comparison: {
    localTotalRequests: number;
    cloudTotalRequests: number;
    localLatestRequest?: {
      id: string;
      requestCode: string;
      encodeNumber?: string;
      sampleName?: string;
      createdAt?: string;
      updatedAt?: string;
      requestDate?: string;
    } | null;
    cloudLatestRequest?: {
      id: string;
      requestCode: string;
      encodeNumber?: string;
      sampleName?: string;
      createdAt?: string;
      updatedAt?: string;
      requestDate?: string;
    } | null;
    timeDifferenceSeconds?: number;
    recentCloudRequests: Array<{
      id: string;
      requestCode: string;
      encodeNumber?: string;
      sampleName?: string;
      customerName?: string;
      createdAt?: string;
      updatedAt?: string;
    }>;
  };
  lotDiagnosis?: LotDiagnosisResult;
}

// --- End of types.ts ---
