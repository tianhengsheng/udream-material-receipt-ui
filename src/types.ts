// 扫码购 dev-UI 公共类型。业务 VO 按需求批次在此追加，字段名严格对齐后端 VO/Req，避免装配错。

// udream Resp 真实字段：{ success, retCode, subCode, retInfo, result }；兼容旧 { code, msg, data }
export interface Resp<T> {
  success?: boolean;
  retCode?: string;
  subCode?: string;
  retInfo?: string;
  result?: T;
  // 旧字段兼容
  code?: string | number;
  msg?: string;
  data?: T;
}

// 分页返回：result 为数组，分页信息在 page（PageInfo）。兼容旧 pageInfo/records/total。
export interface PageInfo {
  pageNum?: number;
  pageSize?: number;
  current?: number;
  pages?: number;
  total?: number;
}
export interface PageResp<T> extends Resp<T[]> {
  page?: PageInfo;
  pageInfo?: PageInfo;
  total?: number;
  records?: T[];
}

/** App 端手艺人可操作门店（useCraftsmanStore / StoreResolveBar 用）。 */
export interface CraftsmanStore {
  storeId: string;
  storeName?: string;
  city?: string;
  area?: string;
  type?: number; // 0员工/1店长 等
}

/** 城市/区域扁平树节点（basics/area/queryAreaAvailable）。 */
// id/parentId：dev/test 返回 Number，本地后端返回 String（"0"）——统一按 string|number 承接，比较时 String() 归一
export interface ConfigAreaVO {
  id: string | number;
  name: string;
  parentId?: string | number;
}

/** 门店类型（品类）选项（basics/store/queryStoreSpeciesReq）。 */
export interface StoreSpeciesOpt {
  speciesCode?: number;
  storeSpeciesName?: string;
  brandType?: number;
  brandTypeStr?: string;
  serviceType?: number;
  serviceTypeStr?: string;
}
