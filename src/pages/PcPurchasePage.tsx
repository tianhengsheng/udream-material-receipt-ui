import { useEffect, useState } from 'react';
import { Button, Card, Input, InputNumber, Modal, Select, Space, Table, Upload, message } from 'antd';
import { editPurOrder, expressImport, expressTemplateUrl, purOrderList } from '../api/receipt';
import { useSession } from '../store/useSession';

const STATUS_OPTS = [
  { value: 1, label: '待发货' }, { value: 2, label: '已发货' }, { value: 3, label: '已收货' }, { value: -2, label: '取消发货' }, { value: -1, label: '复核不通过' },
];

/** 后台：采购订单（列表/状态筛选/取消发货/快递单号维护/模板/导入） */
export function PcPurchasePage() {
  const env = useSession((s) => s.currentEnv);
  const [status, setStatus] = useState<number>();
  const [storeName, setStoreName] = useState('');
  const [applyNo, setApplyNo] = useState('');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState<number>();
  const [loading, setLoading] = useState(false);
  const [importResp, setImportResp] = useState<unknown>();

  const load = async () => {
    setLoading(true);
    try {
      const r = await purOrderList({ status, storeName: storeName || undefined, applyNo: applyNo || undefined });
      setRows(r.rows); setTotal(r.total as number | undefined);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  /** 编辑：改发货数量 / 快递单号。PurOrderDto 最小集：id(申请单) + matralList[单条明细] */
  const edit = (row: Record<string, unknown>, patch: { deliverNum?: number; expressNo?: string; expressCompany?: string }) => {
    const item: Record<string, unknown> = { id: row.id, purApplyId: row.purApplyId, materielId: row.materielId, status: row.matrlStatus,
      supplierId: row.supplierId, supplierName: row.supplierName, materielName: row.materielName, purNo: row.purNo };
    if (patch.deliverNum != null) { item.deliverNum = patch.deliverNum; item.purchaseDeliverNum = patch.deliverNum; }
    const body: Record<string, unknown> = { id: row.purApplyId, applyTime: row.applyTimeStr || row.applyTime, storeIds: [row.storeId],
      recipients: row.recipients, receiveMobile: row.receiveMobile, receiveAddr: row.receiveAddr,
      expressCompany: patch.expressCompany ?? row.expressCompany, expressNo: patch.expressNo ?? row.expressNo, matralList: [item],
      deliverNumDiff: patch.deliverNum != null ? Number(patch.deliverNum) - Number(row.deliverNum || 0) : 0 };
    return editPurOrder(body).then(() => { message.success('已提交'); load(); });
  };
  const cancelShip = (row: Record<string, unknown>) => Modal.confirm({ title: '是否将发货数量修改为 0？', content: '将变为取消发货（终态）', onOk: () => edit(row, { deliverNum: 0 }) });
  const setExpress = (row: Record<string, unknown>) => {
    let no = String(row.expressNo || ''); let co = String(row.expressCompany || '顺丰');
    Modal.confirm({ title: '维护快递单号', content: <Space direction="vertical"><Input defaultValue={co} placeholder="快递公司" onChange={(e) => { co = e.target.value; }} /><Input defaultValue={no} placeholder="快递单号" onChange={(e) => { no = e.target.value; }} /></Space>,
      onOk: () => edit(row, { expressNo: no, expressCompany: co }) });
  };

  return (
    <div style={{ padding: 12 }}>
      <Card size="small" title="采购订单" extra={<Space>
        <a href={expressTemplateUrl(env)} target="_blank" rel="noreferrer" data-testid="pc.template">模板下载</a>
        <Upload accept=".xls,.xlsx" showUploadList={false} beforeUpload={(f) => { expressImport(f).then((r) => { setImportResp(r); message.success('已提交任务中心'); }); return false; }}>
          <Button size="small" data-testid="pc.import">导入快递单号</Button>
        </Upload>
      </Space>}>
        <Space wrap style={{ marginBottom: 8 }}>
          <Select allowClear placeholder="状态" style={{ width: 140 }} value={status} onChange={setStatus} options={STATUS_OPTS} data-testid="pc.status" />
          <Input placeholder="门店" style={{ width: 160 }} value={storeName} onChange={(e) => setStoreName(e.target.value)} />
          <Input placeholder="申请单号" style={{ width: 200 }} value={applyNo} onChange={(e) => setApplyNo(e.target.value)} />
          <Button type="primary" onClick={load} loading={loading} data-testid="pc.query">查询</Button>
          <span style={{ color: '#888' }}>共 {total ?? rows.length}</span>
        </Space>
        {importResp != null && <pre data-testid="pc.importResp" style={{ background: '#fafafa', padding: 6 }}>{JSON.stringify(importResp)}</pre>}
        <Table size="small" rowKey={(r) => String(r.id)} dataSource={rows} pagination={false} scroll={{ x: 1400 }} data-testid="pc.table"
          columns={[
            { title: '采购id', dataIndex: 'id', width: 170, render: (v) => String(v) },
            { title: '申请时间', dataIndex: 'applyTimeStr', width: 140 },
            { title: '门店', dataIndex: 'storeName', width: 140 },
            { title: '物料', dataIndex: 'materielName', width: 140 },
            { title: '发货数量', dataIndex: 'deliverNum', width: 80 },
            { title: '状态', dataIndex: 'matrlStatusStr', width: 90 },
            { title: '发货时间', dataIndex: 'deliveryTimeStr', width: 140 },
            { title: '快递公司', dataIndex: 'expressCompany', width: 90 },
            { title: '快递单号', dataIndex: 'expressNo', width: 160 },
            { title: '采购单号', dataIndex: 'purNo', width: 140 },
            { title: '操作', fixed: 'right', width: 200, render: (_, r) => <Space>
              <Button size="small" onClick={() => setExpress(r)}>快递单号</Button>
              <Button size="small" danger disabled={r.matrlStatus === -2} onClick={() => cancelShip(r)}>取消发货</Button>
            </Space> },
          ]} />
      </Card>
    </div>
  );
}
