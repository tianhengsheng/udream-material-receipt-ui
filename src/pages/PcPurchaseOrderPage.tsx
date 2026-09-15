import { useEffect, useMemo, useState } from 'react';
import { Breadcrumb, Button, DatePicker, Form, Input, InputNumber, Modal, Pagination, Popover, Select, Space, Table, Tag, Tooltip, Upload, message } from 'antd';
import { CloudUploadOutlined, DownloadOutlined, EditOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import {
  batchCreatePurchase, batchSendMateriels, deletePurOrder, editPurOrder, exportPurOrderUrl, expressImport, expressTemplateUrl,
  openAreaTree, purOrderList, supplierList, type PurOrderQuery,
} from '../api/receipt';
import { useSession } from '../store/useSession';
import { AddPurOrderModal } from './AddPurOrderModal';

type Row = Record<string, any>;

/** 本期改动点统一琥珀标记 */
const NEW = { background: '#fffbe6', outline: '1px dashed #faad14', outlineOffset: 1 } as const;
const NewTag = () => <Tag color="gold" style={{ marginLeft: 4, lineHeight: '16px', padding: '0 4px' }}>新</Tag>;

const STATUS_OPTS = [
  { value: 1, label: '待发货' }, { value: 2, label: '已发货' }, { value: 3, label: '已收货' },
  { value: -2, label: <span style={{ color: '#d46b08', fontWeight: 600 }}>取消发货<NewTag /></span> },
];
const SERVICE_TYPES = [{ value: '0-0', label: '一代店' }, { value: '0-1', label: '三代店' }, { value: '1', label: 'U STAR' }];
const EXPRESS_COMPANIES = ['顺丰', '圆通', '中通', '申通', '韵达', '京东', '极兔', 'EMS', '邮政', '德邦'];
const num = (v: unknown) => (v == null || v === '' ? '' : Number(v));

/** 后台·采购管理/采购订单（1:1 原页面；改动点：状态「取消发货」、导入快递单号+模板、编辑发货数量 0=取消发货、快递单号时效） */
export function PcPurchaseOrderPage() {
  const env = useSession((s) => s.currentEnv);
  const pcUser = useSession((s) => s.pcUser());
  const [form] = Form.useForm();
  const [query, setQuery] = useState<PurOrderQuery>({});
  const [page, setPage] = useState({ pageNum: 1, pageSize: 20 });
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [areaTree, setAreaTree] = useState<{ id: string; name: string; children?: { id: string; name: string }[] }[]>([]);
  const [cityId, setCityId] = useState<string>();
  const [editing, setEditing] = useState<Row | null>(null);
  const [importResp, setImportResp] = useState<unknown>();
  const [adding, setAdding] = useState(false);

  const load = async (q = query, p = page) => {
    setLoading(true);
    try {
      const r = await purOrderList({ ...q, ...p });
      setRows(r.rows as Row[]);
      setTotal(Number(r.total ?? r.rows.length));
    } finally { setLoading(false); }
  };
  useEffect(() => {
    load();
    supplierList().then(setSuppliers).catch(() => {});
    openAreaTree().then(setAreaTree).catch(() => {});
  }, []);

  const toQuery = (): PurOrderQuery => {
    const v = form.getFieldsValue();
    const [b, e] = (v.range || []) as [Dayjs?, Dayjs?];
    return {
      beginDate: b?.format('YYYY-MM-DD'), endDate: e?.format('YYYY-MM-DD'), supplierId: v.supplierId, storeName: v.storeName || undefined,
      serviceType: v.serviceType, materielName: v.materielName || undefined, recipients: v.recipients || undefined, receiveMobile: v.receiveMobile || undefined,
      cityIds: v.cityId, areaIds: v.areaId, purNo: v.purNo || undefined, status: v.status, remark: v.remark || undefined,
    };
  };
  const search = () => { const q = toQuery(); const p = { ...page, pageNum: 1 }; setQuery(q); setPage(p); load(q, p); };
  const reset = () => { form.resetFields(); setCityId(undefined); const p = { ...page, pageNum: 1 }; setQuery({}); setPage(p); load({}, p); };

  /** 编辑（老 addOrUptPurMatrlApplyItem，PurOrderDto 最小集）；deliverNum=0 → 后端置 -2 取消发货 */
  const submitEdit = async (row: Row, patch: Partial<Row>) => {
    const item: Row = { id: row.id, purApplyId: row.purApplyId, materielId: row.materielId, status: row.matrlStatus, supplierId: row.supplierId,
      supplierName: row.supplierName, materielName: row.materielName, purNo: patch.purNo ?? row.purNo, remark: patch.remark ?? row.remark,
      purPrice: patch.purPrice ?? row.purPrice, supplierPrice: patch.supplierPrice ?? row.supplierPrice };
    const dn = patch.deliverNum ?? row.deliverNum;
    item.deliverNum = dn; item.purchaseDeliverNum = dn;
    const body: Row = { id: row.purApplyId, applyTime: row.applyTimeStr || row.applyTime, storeIds: [row.storeId], recipients: row.recipients,
      receiveMobile: row.receiveMobile, receiveAddr: row.receiveAddr, expressCompany: patch.expressCompany ?? row.expressCompany, expressNo: patch.expressNo ?? row.expressNo,
      matralList: [item], deliverNumDiff: Number(dn ?? 0) - Number(row.deliverNum ?? 0) };
    const r = await editPurOrder(body);
    if (r?.success === false) return;
    message.success('已保存'); setEditing(null); load();
  };
  const inlineEdit = (row: Row, field: 'deliverNum' | 'purPrice' | 'supplierPrice', title: string) => {
    let v = Number(row[field] ?? 0);
    Modal.confirm({
      title, icon: null,
      content: <Space direction="vertical"><InputNumber min={0} defaultValue={v} onChange={(x) => { v = Number(x ?? 0); }} style={{ width: 200 }} autoFocus />
        {field === 'deliverNum' && <span style={{ color: '#d46b08' }}>发货数量改为 0 即「取消发货」（终态，不可再改）<NewTag /></span>}</Space>,
      onOk: () => submitEdit(row, { [field]: v }),
    });
  };
  const doBatchSend = () => Modal.confirm({ title: '按当前筛选条件批量发货？', content: '沿用原逻辑：对筛选结果中待发货明细执行发货', onOk: async () => { const r = await batchSendMateriels(query); if (r?.success !== false) { message.success('已提交'); load(); } } });
  const cities = areaTree;
  const areas = useMemo(() => cities.find((c) => c.id === cityId)?.children || [], [cities, cityId]);

  const columns = [
    { title: '申请时间', dataIndex: 'applyTimeStr', width: 150 },
    { title: '供应商', dataIndex: 'supplierName', width: 110 },
    { title: '门店', dataIndex: 'storeName', width: 150 },
    { title: '服务类型', dataIndex: 'serviceTypeStr', width: 80 },
    { title: '区域经理', dataIndex: 'managerName', width: 120 },
    { title: '城市', dataIndex: 'cityName', width: 70 },
    { title: '区域', dataIndex: 'areaName', width: 70 },
    { title: '物料名称', dataIndex: 'materielName', width: 160 },
    { title: '采购单位', width: 90, render: (_: unknown, r: Row) => r.purchaseUnitDesc || r.materielPriUnit },
    { title: '发货数量', width: 100, align: 'center' as const, render: (_: unknown, r: Row) => (
      <span style={r.matrlStatus === -2 ? NEW : undefined}>{num(r.deliverNum)} {r.matrlStatus !== -2 && <EditOutlined style={{ color: '#1677ff', cursor: 'pointer' }} onClick={() => inlineEdit(r, 'deliverNum', '修改发货数量')} data-testid={`pc.deliverNum-${r.id}`} />}</span>) },
    { title: '采购单价', width: 90, align: 'center' as const, render: (_: unknown, r: Row) => <span>{num(r.purPrice)} <EditOutlined style={{ color: '#1677ff', cursor: 'pointer' }} onClick={() => inlineEdit(r, 'purPrice', '修改采购单价')} /></span> },
    { title: '采购总金额', dataIndex: 'totalMoney', width: 90, align: 'center' as const, render: num },
    { title: '应该收加盟商单价', width: 120, align: 'center' as const, render: (_: unknown, r: Row) => <span>{num(r.supplierPrice)} <EditOutlined style={{ color: '#1677ff', cursor: 'pointer' }} onClick={() => inlineEdit(r, 'supplierPrice', '修改应收加盟商单价')} /></span> },
    { title: '加盟商总价', dataIndex: 'totalSupplierPrice', width: 90, align: 'center' as const, render: num },
    { title: '采购单号', dataIndex: 'purNo', width: 130 },
    { title: <span>状态<NewTag /></span>, width: 90, render: (_: unknown, r: Row) => r.matrlStatus === -2
      ? <Tag color="orange" style={NEW} data-testid={`pc.status-${r.id}`}>取消发货</Tag> : <span data-testid={`pc.status-${r.id}`}>{r.matrlStatusStr}</span> },
    { title: '发货时间', dataIndex: 'deliveryTimeStr', width: 150 },
    { title: '快递公司', dataIndex: 'expressCompany', width: 80 },
    { title: <span>快递单号<NewTag /></span>, dataIndex: 'expressNo', width: 150, render: (v: string) => <span style={v ? NEW : undefined}>{v}</span> },
    { title: '收货人', dataIndex: 'recipients', width: 80 },
    { title: '收货人电话', dataIndex: 'receiveMobile', width: 110, ellipsis: true, render: (v: string) => (v && v.startsWith('#*UDREAM*#') ? <span style={{ color: '#aaa' }} title={v}>加密</span> : v) },
    { title: '备注', dataIndex: 'remark', width: 120, ellipsis: true },
    { title: '操作', fixed: 'right' as const, width: 70, render: (_: unknown, r: Row) => <a onClick={() => setEditing(r)} data-testid={`pc.edit-${r.id}`}>编辑</a> },
  ];

  return (
    <div style={{ padding: '8px 16px', background: '#f0f2f5', minHeight: '100%' }}>
      <Breadcrumb items={[{ title: '采购管理' }, { title: '采购管理' }, { title: '采购订单' }]} style={{ marginBottom: 8 }} />
      <div style={{ background: '#fff', padding: 16, borderRadius: 4 }}>
        <Form form={form} layout="inline" size="small" style={{ rowGap: 10 }} onFinish={search}>
          <Form.Item label="申请时间" name="range"><DatePicker.RangePicker style={{ width: 210 }} /></Form.Item>
          <Form.Item label="供应商" name="supplierId"><Select allowClear placeholder="全部" style={{ width: 150 }} showSearch optionFilterProp="label" options={suppliers.map((s) => ({ value: s.id, label: s.name }))} /></Form.Item>
          <Form.Item label="门店" name="storeName"><Input placeholder="请输入门店" style={{ width: 150 }} allowClear /></Form.Item>
          <Form.Item label="服务类型" name="serviceType"><Select allowClear placeholder="全部" style={{ width: 120 }} options={SERVICE_TYPES} /></Form.Item>
          <Form.Item label="物料名称" name="materielName"><Input placeholder="请输入物料名称" style={{ width: 150 }} allowClear /></Form.Item>
          <Form.Item label="收货人" name="recipients"><Input placeholder="请输入收货人" style={{ width: 130 }} allowClear /></Form.Item>
          <Form.Item label="收货人电话" name="receiveMobile"><Input placeholder="请输入收货人电话" style={{ width: 150 }} allowClear /></Form.Item>
          <Form.Item label="区域" name="cityId"><Select allowClear placeholder="全部" style={{ width: 120 }} showSearch optionFilterProp="label" options={cities.map((c) => ({ value: c.id, label: c.name }))} onChange={(v) => { setCityId(v); form.setFieldValue('areaId', undefined); }} /></Form.Item>
          <Form.Item name="areaId"><Select allowClear placeholder="全部" style={{ width: 120 }} showSearch optionFilterProp="label" options={areas.map((a) => ({ value: a.id, label: a.name }))} /></Form.Item>
          <Form.Item label="采购订单号" name="purNo"><Input placeholder="请输入采购订单号" style={{ width: 150 }} allowClear /></Form.Item>
          <Form.Item label="状态" name="status"><Select allowClear placeholder="全部" style={{ width: 130, ...NEW }} options={STATUS_OPTS} data-testid="pc.status" /></Form.Item>
          <Form.Item label="备注" name="remark"><Input placeholder="请输入备注" style={{ width: 150 }} allowClear /></Form.Item>
          <Form.Item style={{ marginLeft: 'auto' }}><Space><Button type="primary" htmlType="submit" loading={loading} data-testid="pc.query">查询</Button><Button onClick={reset}>重置</Button></Space></Form.Item>
        </Form>

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, margin: '14px 0 8px' }}>
          <span style={{ ...NEW, padding: '2px 6px', display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            <a href={expressTemplateUrl(env)} target="_blank" rel="noreferrer" data-testid="pc.template">模板下载</a>
            <Upload accept=".xls,.xlsx" showUploadList={false} beforeUpload={(f) => { expressImport(f).then((r) => { setImportResp(r); if (r?.success !== false) message.success('已提交任务中心，回执见任务中心'); }); return false; }}>
              <Button type="primary" data-testid="pc.import">导入快递单号</Button>
            </Upload>
            <NewTag />
          </span>
          <Button type="primary" onClick={() => setAdding(true)} data-testid="pc.add">新增</Button>
          <Tooltip title="原逻辑：批量生成采购单的导入模板（老模板，非快递单号模板）"><a>模板下载</a></Tooltip>
          <Upload accept=".xls,.xlsx" showUploadList={false} beforeUpload={(f) => { if (!pcUser?.uid) { message.warning('需 PC 账号'); return false; } batchCreatePurchase(f, pcUser.uid).then((r) => { if (r?.success !== false) { message.success('已导入'); load(); } }); return false; }}>
            <Button type="primary" icon={<CloudUploadOutlined />}>批量生成采购单</Button>
          </Upload>
          <Button disabled={!rows.length} onClick={doBatchSend} data-testid="pc.batchSend">批量发货</Button>
          <Popover content={<div style={{ maxWidth: 320 }}>批量发货：对当前筛选结果中「待发货」明细执行发货。<br /><b style={{ color: '#d46b08' }}>本期新增</b>：发货数量改 0 = 取消发货（终态）；快递单号仅已发货且 5 天内可改；导入快递单号切到新模板（23 列，首列采购id）。</div>}><QuestionCircleOutlined /></Popover>
          <Button type="primary" icon={<DownloadOutlined />} href={exportPurOrderUrl(env, query)} target="_blank" data-testid="pc.export">导出</Button>
        </div>
        {importResp != null && <pre data-testid="pc.importResp" style={{ background: '#fafafa', padding: 6, fontSize: 11 }}>{JSON.stringify(importResp)}</pre>}

        <Table size="small" rowKey={(r) => String(r.id)} dataSource={rows} loading={loading} pagination={false} scroll={{ x: 2600 }} columns={columns} data-testid="pc.table"
          rowClassName={(r) => (r.matrlStatus === -2 ? 'pc-row-canceled' : '')} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
          <Pagination size="small" showSizeChanger showTotal={(t) => `共 ${t} 条`} current={page.pageNum} pageSize={page.pageSize} total={total}
            onChange={(pn, ps) => { const p = { pageNum: pn, pageSize: ps }; setPage(p); load(query, p); }} />
        </div>
      </div>

      {adding && <AddPurOrderModal onCancel={() => setAdding(false)} onDone={() => { setAdding(false); load(); }} />}
      {editing && <EditModal row={editing} onCancel={() => setEditing(null)} onOk={(patch) => submitEdit(editing, patch)}
        onDelete={() => Modal.confirm({ title: '删除该采购订单？', onOk: async () => { const r = await deletePurOrder(String(editing.id)); if (r?.success !== false) { message.success('已删除'); setEditing(null); load(); } } })} />}
    </div>
  );
}

/** 编辑弹窗（原页面「编辑」）：本期改动 = 发货数量 0 取消发货、快递单号时效校验 */
function EditModal({ row, onCancel, onOk, onDelete }: { row: Row; onCancel: () => void; onOk: (patch: Partial<Row>) => Promise<void>; onDelete: () => void }) {
  const [f] = Form.useForm();
  const canceled = row.matrlStatus === -2;
  return (
    <Modal open title={<span>编辑采购订单 <span style={{ color: '#888', fontWeight: 400, fontSize: 12 }}>{row.storeName} · {row.materielName}</span></span>} onCancel={onCancel} width={520}
      footer={<Space><Button danger onClick={onDelete}>删除</Button><Button onClick={onCancel}>取消</Button><Button type="primary" disabled={canceled} onClick={() => f.validateFields().then(onOk)} data-testid="pc.editOk">保存</Button></Space>}>
      {canceled && <div style={{ ...NEW, padding: 6, marginBottom: 10, color: '#d46b08' }}>已取消发货（终态），后端拒绝任何修改（10110）<NewTag /></div>}
      <Form form={f} size="small" labelCol={{ span: 6 }} initialValues={{ purNo: row.purNo, deliverNum: Number(row.deliverNum ?? 0), purPrice: Number(row.purPrice ?? 0), supplierPrice: Number(row.supplierPrice ?? 0), expressCompany: row.expressCompany || undefined, expressNo: row.expressNo, remark: row.remark }}>
        <Form.Item label="采购单号" name="purNo"><Input /></Form.Item>
        <Form.Item label={<span>发货数量<NewTag /></span>} name="deliverNum" extra={<span style={{ color: '#d46b08' }}>改为 0 = 取消发货（终态）；已发货再取消会回补库存并修账单</span>}><InputNumber min={0} style={{ width: '100%', ...NEW }} data-testid="pc.editDeliverNum" /></Form.Item>
        <Form.Item label="采购单价" name="purPrice"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
        <Form.Item label="应收加盟商单价" name="supplierPrice"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
        <Form.Item label="快递公司" name="expressCompany"><Select allowClear options={EXPRESS_COMPANIES.map((c) => ({ value: c, label: c }))} /></Form.Item>
        <Form.Item label={<span>快递单号<NewTag /></span>} name="expressNo" extra={<span style={{ color: '#d46b08' }}>有变化才校验：非已发货 10111 / 超发货 5 天 10112；成功即订阅快递100</span>}><Input style={NEW} data-testid="pc.editExpressNo" /></Form.Item>
        <Form.Item label="备注" name="remark"><Input.TextArea rows={2} /></Form.Item>
      </Form>
    </Modal>
  );
}
