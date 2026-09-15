import { http } from './client';
import { useSession } from '../store/useSession';
import { bigIntSafeParse, pick } from './common';
import type { PageResp, Resp } from '../types';
import type {
  ApplyCard, ApplyHeader, ManagerSummary, OverdueKinds, OverdueStore, ReceiptPackages, StoreStats, TrackResult, UrgeResult,
} from '../types/receipt';

const BIG = { transformResponse: [bigIntSafeParse] };

// ---------- 店长侧（App token） ----------

/** 老列表：当前申请（filterStatus=1 超时未收货） */
export async function currentApplies(filterStatus?: number): Promise<{ rows: ApplyCard[]; total: number }> {
  const r = await http.post<PageResp<ApplyCard>>('/mgt/pur/apply/queryCurrentApplys', { pageNum: 1, pageSize: 50, counted: true, filterStatus }, BIG);
  const rows = (pick(r.data) as ApplyCard[] | undefined) ?? r.data?.records ?? [];
  return { rows, total: r.data?.page?.total ?? r.data?.total ?? rows.length };
}
/** 老列表：申请历史 */
export async function historyApplies(): Promise<{ rows: ApplyCard[]; total: number }> {
  const r = await http.post<PageResp<ApplyCard>>('/mgt/pur/apply/queryHistoryApplys', { pageNum: 1, pageSize: 50, counted: true }, BIG);
  const rows = (pick(r.data) as ApplyCard[] | undefined) ?? r.data?.records ?? [];
  return { rows, total: r.data?.page?.total ?? r.data?.total ?? rows.length };
}

/** 老详情头部（沿用；applyItemVos 忽略） */
export async function applyHeader(applyId: string): Promise<ApplyHeader | undefined> {
  const r = await http.post<Resp<ApplyHeader>>('/mgt/pur/apply/getMatrlApplyDetail', null, { params: { applyId }, ...BIG });
  return pick(r.data);
}

export async function packages(applyId: string, tab?: number, keyword?: string): Promise<ReceiptPackages | undefined> {
  const r = await http.get<Resp<ReceiptPackages>>('/franchise/apiCraftsman/receipt/packages', { params: { applyId, tab, keyword }, ...BIG });
  return pick(r.data);
}

export async function overdueKinds(storeId?: string): Promise<OverdueKinds | undefined> {
  const r = await http.get<Resp<OverdueKinds>>('/franchise/apiCraftsman/receipt/overdueKinds', { params: { storeId }, ...BIG });
  return pick(r.data);
}

/** 老上班弹窗接口（保持 Boolean） */
export async function isNotReceivedLegacy(): Promise<boolean | undefined> {
  const r = await http.post<Resp<boolean>>('/mgt/pur/apply/queryMatrlApplyIsNotReceived', {});
  return pick(r.data);
}

/** 沿用：确认收货（GET 写操作，存量） */
export async function confirmReceipt(applyId: string, applyItemIds: string, receivePic: string, receivedNum?: number) {
  const r = await http.get<Resp<void>>('/mgt/pur/apply/confirmReceipt', { params: { applyId, applyItemIds, receivePic, type: 0, receivedNum } });
  return r.data;
}

/** 沿用：上报异常 type 0破损/1少货/2与申请不符/3未收到 */
export async function addExceptionReport(p: { matrlApplyItemId: string; matrlId?: string; storeId?: string; type: number; remark?: string; picUrl?: string }) {
  const r = await http.post<Resp<void>>('/mgt/pur/apply/addExceptionReport', { ...p, status: 0, sourceType: 0, picUrl: p.picUrl || '' });
  return r.data;
}

/** craftsman 下班前置校验（硬拦截入口） */
export async function precheckDuty(p: { craftsmanUid: string; storeId: string; roleType: number; isReport?: number; isLeadStores?: number; testStatus?: number }) {
  const r = await http.post<Resp<unknown>>('/craftsman/apiCraftsman/attendanceProduceService/precheckCraftsmanDuty', null,
    { params: { isReport: 0, ...p }, _silent: true });
  return r.data;
}

// ---------- 区经侧（App token） ----------

export async function managerSummary(): Promise<ManagerSummary | undefined> {
  const r = await http.get<Resp<ManagerSummary>>('/franchise/apiCraftsman/receipt/manager/overdueSummary');
  return pick(r.data);
}
export async function managerStoreStats(month?: string): Promise<StoreStats | undefined> {
  const r = await http.get<Resp<StoreStats>>('/franchise/apiCraftsman/receipt/manager/storeStats', { params: { month }, ...BIG });
  return pick(r.data);
}
export async function managerOverdueStores(): Promise<OverdueStore[]> {
  const r = await http.get<Resp<OverdueStore[]>>('/franchise/apiCraftsman/receipt/manager/overdueStores', BIG);
  return pick(r.data) ?? [];
}
export async function managerUrge(): Promise<UrgeResult | undefined> {
  const r = await http.post<Resp<UrgeResult>>('/franchise/apiCraftsman/receipt/manager/urge');
  return pick(r.data);
}

// ---------- 后台（PC token） ----------

/** 采购订单列表（老接口，queryFlag=1） */
export async function purOrderList(q: { status?: number; storeName?: string; applyNo?: string; purApplyId?: string; pageNum?: number; pageSize?: number }) {
  const r = await http.get<PageResp<Record<string, unknown>>>('/mgt/pur/matrlApply/queryStoreMaterialApply',
    { params: { queryFlag: 1, pageNum: 1, pageSize: 20, counted: true, ...q }, ...BIG });
  return { rows: (pick(r.data) as Record<string, unknown>[] | undefined) ?? r.data?.records ?? [], total: r.data?.page?.total ?? r.data?.total };
}

export const expressTemplateUrl = (env: string) => `/env/${env}/franchise/apiUnified/receipt/expressTemplate${env === 'local' ? `?_lp=${useSession.getState().localPort || 20000}` : ''}`;

export async function expressImport(file: File) {
  const fd = new FormData();
  fd.append('file', file);
  const r = await http.post<Resp<unknown>>('/franchise/apiUnified/receipt/expressImport', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  return r.data;
}

export async function mockTrack(expressNo: string, result: TrackResult) {
  const r = await http.post<Resp<void>>('/franchise/apiUnified/receipt/mockTrack', { expressNo, result });
  return r.data;
}

/** 后台异常处理列表/处理（老接口） */
export async function exceptionList(q: { storeName?: string; status?: number; pageNum?: number; pageSize?: number }) {
  const r = await http.post<PageResp<Record<string, unknown>>>('/mgt/pur/matrlApply/queryExceptionReportList',
    { pageNum: 1, pageSize: 20, counted: true, ...q }, BIG);
  return (pick(r.data) as Record<string, unknown>[] | undefined) ?? r.data?.records ?? [];
}
export async function handleException(id: string, pcRemark: string) {
  const r = await http.post<Resp<void>>('/mgt/pur/matrlApply/updateExceptionReport', { id, status: 1, pcRemark });
  return r.data;
}

/** 后台：单条采购订单编辑（取消发货 = deliverNum 0），入参照 PurOrderDto 最小集 */
export async function editPurOrder(body: Record<string, unknown>) {
  const r = await http.post<Resp<void>>('/mgt/pur/matrlApply/addOrUptPurMatrlApplyItem', body, BIG);
  return r.data;
}
