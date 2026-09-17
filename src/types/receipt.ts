// 收货管控 VO（字段对齐后端 MatrlReceiptVO / MatrlReceiptManagerVO；19 位 id 一律 string）

export interface ReceiptTab { code: number; desc: string; count: number }

export interface ReceiptTrack { time?: string; context?: string }

export interface ReceiptItem {
  applyItemId: string;
  matrlId: string;
  matrlName: string;
  typeTag?: string;
  picUrl?: string;
  specDesc?: string;
  displayCategoryDesc?: string;
  unitName?: string;
  applyNum?: number;
  deliverNum?: number;
  receivedNum?: number;
  matrlStatus?: number;
  matrlTypeCode?: string;
  overdue?: boolean;
  overdueDays?: number;
  shipDate?: string;
  shipDays?: number;
  tipType?: number;
  tipText?: string;
  reportCount?: number;
  reportStatusDesc?: string;
  canReport?: boolean;
  canReceive?: boolean;
  repeatCount?: number;
  isRepeat?: number;
  receivePic?: string;
}

export interface ReceiptPackage {
  groupKey: string;
  frontStatus: number;
  frontStatusDesc: string;
  cardTitle?: string;
  cardSubTitle?: string | null;
  expressNo?: string;
  expressCompany?: string;
  hasExpress?: boolean;
  latestTrack?: ReceiptTrack | null;
  shipDate?: string;
  shipDays?: number;
  overdue?: boolean;
  overdueDays?: number;
  overdueReported?: boolean;
  items: ReceiptItem[];
}

export interface ReceiptPackages {
  /** 申请单头部（后端并入 packages，2026-09-16） */
  applyId?: string;
  applyNo?: string;
  applyTime?: string;
  storeId?: string;
  storeName?: string;
  status?: number;
  tag?: number;
  turnover?: number;
  highestStandard?: number;
  requestedAmount?: number;
  excessAmount?: number;
  errorReason?: string;
  errorReasonUserName?: string;
  errorReasonTime?: string;
  fixedTip?: string;
  overdueBanner?: string | null;
  tabs: ReceiptTab[];
  packages: ReceiptPackage[];
}

export interface OverdueKinds { kinds: number; applyIds: string[] }

export interface ManagerSummary { hasOverdue: boolean; storeCount: number; tipText?: string }

export interface StoreStatRow {
  storeId: string; storeName: string; shipApplyCount: number; waitReceiveApplyCount: number;
  avgReceiveDays?: number | null; overdueCount: number;
}
export interface StoreStats { month: string; storeTotal: number; rows: StoreStatRow[] }

export interface OverdueApply { applyId: string; applyNo: string; overdueKinds: number }
export interface OverdueStore {
  storeId: string; storeName: string; managerId?: string | null; managerName?: string;
  managerRoleDesc?: string; managerMobile?: string | null; overdueKinds: number; applies: OverdueApply[];
}
export interface UrgeResult { storeCount: number; userCount: number; skippedStoreCount: number }

/** 老 App 列表卡片（AppMatrlApplyVo） */
export interface ApplyNode { name: string; content?: string; status: number; current?: boolean; remark?: string }
export interface ApplyCard {
  applyId: string; title?: string; applyNo?: string; storeName?: string; applyTime?: string; status?: number;
  nodes?: ApplyNode[]; matrlPics?: string; num?: number; tag?: number; highestStandard?: number; expressNo?: string; isNotReceived?: number;
}

export interface TrackNode { time: string; context: string; area?: string; statusDesc?: string }
/** state = 内部 TrackState 名：NONE/COLLECTED/IN_TRANSIT/SIGNED/PROBLEM */
export interface TrackResult { state: string; nodes: TrackNode[]; rawJson?: string }
