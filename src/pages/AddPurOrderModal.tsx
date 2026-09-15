import { useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, InputNumber, Modal, Select, Space, Table, message } from 'antd';
import dayjs from 'dayjs';
import {
  accountCompanyList, checkPurNoRepeated, editPurOrder, queryMatrlSelectList, searchStoresByName, storeReceiveInfo, supplierList, type MatrlOpt,
} from '../api/receipt';
import { useSession } from '../store/useSession';

interface Line { key: number; matrlId?: string; matrl?: MatrlOpt; purPrice?: number; deliverNum?: number; supplierPrice?: number }
const EXPRESS_COMPANIES = ['顺丰', '圆通', '中通', '申通', '韵达', '京东', '极兔', 'EMS', '邮政', '德邦'];
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div style={{ border: '1px solid #f0f0f0', borderRadius: 4, marginBottom: 12 }}>
    <div style={{ padding: '8px 14px', fontWeight: 600, borderBottom: '1px solid #f0f0f0' }}>{title}</div>
    <div style={{ padding: 14 }}>{children}</div>
  </div>
);

/** 新增-采购订单（原页面弹窗 1:1；提交 = 老 addOrUptPurMatrlApplyItem 无 id 分支，明细 status=2 直接发货） */
export function AddPurOrderModal({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
  const pcUser = useSession((s) => s.pcUser());
  const [f] = Form.useForm();
  const [applyNo] = useState(() => `SQ${dayjs().format('YYYYMMDDHHmmss')}`);
  const [applyTime] = useState(() => dayjs().format('YYYY-MM-DD HH:mm:ss'));
  const [stores, setStores] = useState<{ storeId: string; storeName: string }[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [companies, setCompanies] = useState<{ accountCompanyId: string; accountCompanyName: string }[]>([]);
  const [matrls, setMatrls] = useState<MatrlOpt[]>([]);
  const [lines, setLines] = useState<Line[]>([{ key: 1 }]);
  const [region, setRegion] = useState<{ city?: string; area?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const supplierId = Form.useWatch('supplierId', f);
  const receiveType = Form.useWatch('receiveType', f);

  useEffect(() => { supplierList().then(setSuppliers).catch(() => {}); accountCompanyList().then(setCompanies).catch(() => {}); }, []);
  useEffect(() => {
    if (!supplierId) { setMatrls([]); return; }
    queryMatrlSelectList({ supplierList: [String(supplierId)] }).then(setMatrls).catch(() => setMatrls([]));
    setLines([{ key: Date.now() }]);
  }, [supplierId]);

  const onStore = async (storeId: string) => {
    const info = await storeReceiveInfo(storeId).catch(() => undefined);
    setRegion({ city: info?.cityName, area: info?.districtName });
    f.setFieldsValue({ recipients: info?.recipient, receiveMobile: info?.mobile, receiveAddr: info?.addr });
  };
  const setLine = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const pickMatrl = (key: number, id: string) => {
    const m = matrls.find((x) => String(x.id) === String(id));
    setLine(key, { matrlId: id, matrl: m, purPrice: m?.purPrice != null ? Number(m.purPrice) : undefined, supplierPrice: m?.supplierPrice != null ? Number(m.supplierPrice) : undefined });
  };
  const totalNum = useMemo(() => lines.reduce((a, l) => a + Number(l.deliverNum || 0), 0), [lines]);
  const totalMoney = useMemo(() => lines.reduce((a, l) => a + Number(l.deliverNum || 0) * Number(l.purPrice || 0), 0), [lines]);

  const submit = async () => {
    const v = await f.validateFields();
    const valid = lines.filter((l) => l.matrlId);
    if (!valid.length) return message.warning('请至少选择一个物料');
    if (valid.some((l) => !l.deliverNum || l.purPrice == null)) return message.warning('物料行需填写发货数量和采购单价');
    setSubmitting(true);
    try {
      const chk = await checkPurNoRepeated({ storeId: v.storeId, supplierId: v.supplierId, purNo: v.purNo }).catch(() => undefined);
      if (chk && chk.success === false) { message.error(chk.retMsg || '采购单号已使用'); return; }
      const sup = suppliers.find((s) => String(s.id) === String(v.supplierId));
      const body = {
        applyNo, applyTime, storeIds: [v.storeId], userId: pcUser?.uid, isNewMatrl: 0,
        recipients: v.recipients, receiveMobile: v.receiveMobile, receiveAddr: v.receiveAddr,
        expressCompany: v.receiveType === 0 ? v.expressCompany : '', expressNo: v.receiveType === 0 ? v.expressNo : '',
        accountCompanyId: v.accountCompanyId, expressFee: 0,
        matralList: valid.map((l) => ({
          materielId: l.matrlId, materielName: l.matrl?.materielName, materielPriUnit: l.matrl?.unitPrimary, purchaseUnitDesc: l.matrl?.purchaseUnitDesc,
          supplierId: v.supplierId, supplierName: sup?.name, purNo: v.purNo, status: 2, receiveType: v.receiveType, remark: v.remark,
          purPrice: l.purPrice, supplierPrice: l.supplierPrice ?? 0, deliverNum: l.deliverNum, purchaseDeliverNum: l.deliverNum,
          applyNum: l.deliverNum, checkNum: l.deliverNum, purchaseApplyNum: l.deliverNum, purchaseCheckNum: l.deliverNum,
        })),
      };
      const r = await editPurOrder(body);
      if (r?.success === false) return;
      message.success('已发货'); onDone();
    } finally { setSubmitting(false); }
  };

  return (
    <Modal open title="新增-采购订单" width={1100} onCancel={onCancel} style={{ top: 30 }} styles={{ body: { maxHeight: '72vh', overflow: 'auto' } }}
      footer={<Space><Button onClick={onCancel}>取消</Button><Button type="primary" loading={submitting} onClick={submit} data-testid="pc.addSubmit">发货</Button></Space>}>
      <Form form={f} size="small" labelCol={{ flex: '90px' }} initialValues={{ receiveType: 0 }}>
        <Section title="申请信息">
          <Form.Item label="门店" name="storeId" rules={[{ required: true, message: '请选择门店' }]}>
            <Select showSearch placeholder="请选择" filterOption={false} onSearch={(k) => { if (k) searchStoresByName(k).then(setStores).catch(() => {}); }}
              options={stores.map((s) => ({ value: s.storeId, label: s.storeName }))} onChange={onStore} data-testid="pc.addStore" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
            <Form.Item label="申请单号"><span>{applyNo}</span></Form.Item>
            <Form.Item label="申请时间"><span>{applyTime}</span></Form.Item>
            <Form.Item label="供应商" name="supplierId" rules={[{ required: true, message: '请选择供应商' }]}>
              <Select placeholder="请选择" showSearch optionFilterProp="label" options={suppliers.map((s) => ({ value: s.id, label: s.name }))} data-testid="pc.addSupplier" />
            </Form.Item>
            <Form.Item label="采购订单号" name="purNo" rules={[{ required: true, message: '请输入订单号' }]}><Input placeholder="请输入订单号" data-testid="pc.addPurNo" /></Form.Item>
            <Form.Item label="城市"><span>{region.city}</span></Form.Item>
            <Form.Item label="区域"><span>{region.area}</span></Form.Item>
          </div>
        </Section>

        <Section title="发货信息">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', marginBottom: 8 }}>
            <span>发货数量　<b>{totalNum}</b></span><span>采购总金额　<b>{totalMoney.toFixed(2)}</b> 元</span>
          </div>
          <Table size="small" pagination={false} rowKey="key" dataSource={lines} data-testid="pc.addLines" scroll={{ x: 1000 }} columns={[
            { title: '物料名称', width: 260, render: (_, l) => <Select showSearch optionFilterProp="label" placeholder={supplierId ? '请选择' : '先选供应商'} style={{ width: 240 }} value={l.matrlId}
              options={matrls.map((m) => ({ value: String(m.id), label: m.materielName }))} onChange={(v) => pickMatrl(l.key, v)} /> },
            { title: '采购单位', width: 140, render: (_, l) => l.matrl?.purchaseUnitDesc || l.matrl?.unitPrimary },
            { title: '采购单价', width: 110, render: (_, l) => <InputNumber min={0} value={l.purPrice} onChange={(v) => setLine(l.key, { purPrice: v == null ? undefined : Number(v) })} /> },
            { title: '发货数量', width: 110, render: (_, l) => <InputNumber min={0} value={l.deliverNum} onChange={(v) => setLine(l.key, { deliverNum: v == null ? undefined : Number(v) })} /> },
            { title: '采购总金额', width: 100, render: (_, l) => `${(Number(l.deliverNum || 0) * Number(l.purPrice || 0)).toFixed(2)} 元` },
            { title: '应收加盟商单价', width: 120, render: (_, l) => <InputNumber min={0} value={l.supplierPrice} onChange={(v) => setLine(l.key, { supplierPrice: v == null ? undefined : Number(v) })} /> },
            { title: '加盟商总价', width: 100, render: (_, l) => `${(Number(l.deliverNum || 0) * Number(l.supplierPrice || 0)).toFixed(2)} 元` },
            { title: '操作', width: 60, render: (_, l) => <a onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : ls))}>移除</a> },
          ]} />
          <Button type="dashed" block style={{ marginTop: 8 }} onClick={() => setLines((ls) => [...ls, { key: Date.now() }])}>+ 添加物料</Button>
        </Section>

        <Section title="收货信息">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' }}>
            <Form.Item label="领取方式" name="receiveType"><Select options={[{ value: 0, label: '快递' }, { value: 1, label: '自取' }]} /></Form.Item>
            <Form.Item label="快递公司" name="expressCompany"><Select allowClear disabled={receiveType !== 0} placeholder="请输入快递公司" options={EXPRESS_COMPANIES.map((c) => ({ value: c, label: c }))} /></Form.Item>
            <Form.Item label="快递单号" name="expressNo"><Input disabled={receiveType !== 0} placeholder="请输入单号" /></Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item label="收货人" name="recipients"><Input placeholder="请输入收货人" /></Form.Item>
            <Form.Item label="收货人电话" name="receiveMobile"><Input placeholder="请输入收货人电话" /></Form.Item>
          </div>
          <Form.Item label="地址" name="receiveAddr"><Input placeholder="请输入地址" /></Form.Item>
          <Form.Item label="备注" name="remark"><Input.TextArea rows={3} placeholder="请输入" /></Form.Item>
          <Form.Item label="走账公司" name="accountCompanyId"><Select allowClear placeholder="请选择" style={{ width: 280 }} options={companies.map((c) => ({ value: c.accountCompanyId, label: c.accountCompanyName }))} /></Form.Item>
        </Section>

        <Section title="操作记录">
          <Table size="small" pagination={false} dataSource={[]} columns={[{ title: '操作时间' }, { title: '操作人' }, { title: '发货门店' }]} locale={{ emptyText: '新增单暂无记录' }} />
        </Section>
      </Form>
    </Modal>
  );
}
