import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Input, Select, Space, Switch, message } from 'antd';
import { PhoneFrame } from '../components/PhoneFrame';
import { StoreApplyListPhone } from './StoreApplyListPhone';
import { AppSimLayout } from '../components/AppSimLayout';
import { addExceptionReport, confirmReceipt, currentApplies, packages } from '../api/receipt';
import type { ApplyCard, ReceiptItem, ReceiptPackage, ReceiptPackages } from '../types/receipt';

const LS_KEY = 'mr-store-applyId';
/** 类型色块：按类型名稳定取色 */
const PALETTE = [
  { bg: '#e6f0ff', c: '#2f6bff' }, { bg: '#e8f8f0', c: '#2ea56b' }, { bg: '#fff1e6', c: '#e8791c' },
  { bg: '#f3e8ff', c: '#8b4de6' }, { bg: '#ffe8e8', c: '#e0404a' }, { bg: '#fff8dc', c: '#b08900' },
];
const palette = (s?: string) => PALETTE[[...(s || '')].reduce((a, ch) => a + ch.charCodeAt(0), 0) % PALETTE.length];
const mmdd = (d?: string) => (d ? d.slice(5).replace('-', '-') : '');
const REPORT_TYPES = ['破损', '少货', '与申请不符', '未收到'];

/** 店长侧·物料申请单详情（1:1 原型，真机框） */
export function StoreDetailPhone() {
  const [applyId, setApplyId] = useState(localStorage.getItem(LS_KEY) || '');
  const [view, setView] = useState<'list' | 'detail'>(localStorage.getItem(LS_KEY) ? 'detail' : 'list');
  const [cards, setCards] = useState<ApplyCard[]>([]);
  const [data, setData] = useState<ReceiptPackages>();
  const [tab, setTab] = useState(0);
  const [kw, setKw] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<string[] | null>(null);
  const [report, setReport] = useState<ReceiptItem | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadList = () => currentApplies().then((r) => setCards(r.rows)).catch(() => setCards([]));
  /** 只拉列表：切 Tab / 搜索 / 收货、上报后 */
  const loadPackages = async (id = applyId, t = tab, k = kw) => {
    if (!id) return;
    setLoading(true);
    try {
      setData(await packages(id, t, k || undefined));
      setSelected(new Set());
    } finally {
      setLoading(false);
    }
  };
  /** 进单：头部随 packages 一并返回 */
  const load = async (id = applyId, t = tab, k = kw) => {
    if (!id) return;
    localStorage.setItem(LS_KEY, id);
    await loadPackages(id, t, k);
  };
  const header = data;
  useEffect(() => { loadList(); if (applyId) load(); }, []);

  const receivable = useMemo(() => (data?.packages || []).flatMap((p) => p.items).filter((i) => i.canReceive).map((i) => i.applyItemId), [data]);
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allOn = receivable.length > 0 && receivable.every((id) => selected.has(id));

  const doReceive = async () => {
    if (!confirm?.length) return;
    await confirmReceipt(applyId, confirm.join(','), 'https://self-test/receive.jpg');
    message.success('已确认收货');
    setConfirm(null);
    loadPackages();
  };

  const body = (
    <div className="mr-page" data-testid="store.phone">
      {header?.tag === 1 && <div className="mr-cost"><span style={{ background: '#e0404a', color: '#fff', borderRadius: '50%', width: 16, height: 16, fontSize: 11, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>!</span>当月申请成本过高 (标准 {header.highestStandard ?? 0} 元，约超出 {header.excessAmount ?? 0} 元)</div>}
      {data?.fixedTip && <div className="mr-tip"><span className="ic">·</span><span>{data.fixedTip}</span></div>}
      {header && (
        <div className="mr-head">
          <div className="t">物料申请<a>对物料有疑问?</a></div>
          <div className="kv">提交时间<b>{(header.applyTime || '').replace(/-/g, '/').slice(0, 16)}</b>申请门店<b>{header.storeName}</b></div>
          <div className="kv">物料申请单号<b>{header.applyNo}</b></div>
        </div>
      )}
      <div className="mr-search">🔍<input data-testid="store.keyword" placeholder="搜索物料名称" value={kw} onChange={(e) => setKw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && loadPackages(applyId, tab, kw)} /></div>
      {data && (
        <div className="mr-tabs">
          {data.tabs.map((t) => (
            <div key={t.code} data-testid={`store.tab-${t.code}`} className={`tab${tab === t.code ? ' on' : ''}`} onClick={() => { setTab(t.code); loadPackages(applyId, t.code, kw); }}>
              {t.desc}<span className="n">{t.count}</span>
            </div>
          ))}
        </div>
      )}
      {data?.packages.map((pkg) => <PackageCard key={pkg.groupKey} pkg={pkg} selected={selected} onToggle={toggle}
        onReceive={(ids) => setConfirm(ids)} onReport={setReport} />)}
      {data && !data.packages.length && <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>暂无物料</div>}
    </div>
  );

  const bottom = data ? (
    <div className="mr-bottom">
      <span className={`ck${allOn ? ' on' : ''}`} data-testid="store.selectAll" onClick={() => setSelected(allOn ? new Set() : new Set(receivable))} /><span>全选</span>
      <span className="cnt">已选 <b>{selected.size}</b> 项</span>
      <span className={`go${selected.size ? ' on' : ''}`} data-testid="store.batchReceive" onClick={() => selected.size && setConfirm([...selected])}>批量确认收货</span>
    </div>
  ) : null;

  const overlay = (
    <>
      {bottom}
      {confirm && (
        <div className="mr-mask" data-testid="store.confirmModal">
          <div className="mr-modal">
            <h4>确认收货</h4>
            <p>确认收到<span style={{ color: '#e0404a' }}>{confirm.length}样物料</span>请仔细核对物料和数量，确认后拍照上传，<span style={{ color: '#e0404a' }}>一经上传不可修改。</span></p>
            <div className="bt"><span className="c" onClick={() => setConfirm(null)}>取消</span><span className="k" data-testid="store.confirmOk" onClick={doReceive}>拍照收货</span></div>
          </div>
        </div>
      )}
      {report && <ReportSheet item={report} storeId={header?.storeId} onClose={() => setReport(null)} onDone={() => { setReport(null); loadPackages(); }} />}
    </>
  );

  const controls = (
    <Card size="small" title="申请单">
      <Space direction="vertical" style={{ width: '100%' }}>
        <Select data-testid="store.applySelect" style={{ width: '100%' }} placeholder="当前申请（老列表接口）" value={applyId || undefined} showSearch optionFilterProp="label"
          onChange={(v) => { setApplyId(v); setTab(0); setView('detail'); load(v, 0, kw); }}
          options={cards.map((c) => ({ value: c.applyId, label: `${c.applyNo || c.applyId} · ${c.storeName || ''} · 状态${c.status}${c.isNotReceived ? ' · 超时未收货' : ''}` }))} />
        <Space><Input data-testid="store.applyId" style={{ width: 220 }} placeholder="或直接输入 applyId" value={applyId} onChange={(e) => setApplyId(e.target.value)} onPressEnter={() => load()} />
          <Button type="primary" loading={loading} onClick={() => { setView('detail'); load(); }}>加载</Button><Button onClick={loadList}>刷新列表</Button><Button onClick={() => setView('list')}>回列表页</Button></Space>
        <Space><Switch size="small" checked={showRaw} onChange={setShowRaw} /> 显示 packages 原始 JSON</Space>
        {showRaw && data && <pre data-testid="store.raw" style={{ maxHeight: 520, overflow: 'auto', fontSize: 11, background: '#fafafa', padding: 8 }}>{JSON.stringify(data, null, 1)}</pre>}
      </Space>
    </Card>
  );

  const openDetail = (id: string) => { setApplyId(id); setTab(0); setKw(''); setView('detail'); load(id, 0, ''); };

  return (
    <AppSimLayout controls={controls}>
      {view === 'list'
        ? <PhoneFrame title="物料申请" onBack={() => {}}><StoreApplyListPhone onOpen={openDetail} /></PhoneFrame>
        : <PhoneFrame title="物料申请单详情" onBack={() => setView('list')} overlay={overlay}>{body}</PhoneFrame>}
    </AppSimLayout>
  );
}

function PackageCard({ pkg, selected, onToggle, onReceive, onReport }: {
  pkg: ReceiptPackage; selected: Set<string>; onToggle: (id: string) => void; onReceive: (ids: string[]) => void; onReport: (it: ReceiptItem) => void;
}) {
  const fs = pkg.frontStatus;
  const showRowShip = !pkg.hasExpress && fs === 2;
  return (
    <div className={`mr-pkg${pkg.overdue ? ' overdue' : ''}`} data-testid={`store.pkg-${pkg.groupKey}`}>
      <div className="ph">
        <div className="r1">
          <span className={`mr-st s${fs}`}>{pkg.frontStatusDesc}</span>
          <span className="no">{pkg.cardTitle}</span>
          {pkg.expressNo && <span className="cp" onClick={() => { navigator.clipboard?.writeText(pkg.expressNo!); message.success('已复制'); }}>复制</span>}
        </div>
        {pkg.latestTrack && <div className="track">● {mmdd(pkg.latestTrack.time)} {pkg.latestTrack.context}</div>}
        {pkg.hasExpress && pkg.shipDate && <div className={`ship${pkg.overdue ? ' red' : ''}`}>发货：{mmdd(pkg.shipDate)} · {pkg.overdue ? `已超时 ${pkg.overdueDays} 天未处理` : `已${pkg.shipDays}天`}</div>}
        {pkg.cardSubTitle && <div className={`sub${fs === 2 ? ' warn' : ''}`}>{fs === 2 ? '⊙ ' : ''}{pkg.cardSubTitle}</div>}
      </div>
      {pkg.items.map((it) => {
        const p = palette(it.typeTag);
        const act = fs === 2;
        return (
          <div key={it.applyItemId} data-testid={`store.item-${it.applyItemId}`}>
            <div className="mr-item">
              {act ? <span className={`ck${selected.has(it.applyItemId) ? ' on' : ''}`} onClick={() => onToggle(it.applyItemId)} /> : <span style={{ width: 0 }} />}
              <span className="tag" style={{ background: p.bg, color: p.c }}>{(it.typeTag || '').slice(0, 2)}</span>
              <div className="mid">
                <div className="nm">{it.matrlName}</div>
                <div className="pl">摆放：{it.displayCategoryDesc || '其他'}</div>
                {showRowShip && it.shipDate && <div className={`ship${it.overdue ? ' red' : ''}`}>发货：{mmdd(it.shipDate)} · {it.overdue ? `已超时 ${it.overdueDays} 天` : `已${it.shipDays}天`}</div>}
              </div>
              <div className="rt">
                <div>规格：{it.specDesc}</div>
                <div>
                  申请 {it.applyNum}{it.unitName}
                  {fs === 5 && <>　<b className="in">已入库 {it.receivedNum}{it.unitName}</b></>}
                  {fs === 2 && <>　发货 <b>{it.deliverNum}{it.unitName}</b></>}
                </div>
              </div>
            </div>
            {(act || it.tipType) ? (
              <div className="mr-act">
                <span className={`tip${it.tipType === 2 ? ' red' : it.tipType ? ' org' : ''}`} data-testid={`store.tip-${it.applyItemId}`}>
                  {it.tipText}{it.tipType === 1 || it.tipType === 3 ? ' ›' : ''}
                </span>
                {act && <span className="mr-btn o" data-testid={`store.report-${it.applyItemId}`} onClick={() => onReport(it)}>上报异常</span>}
                {act && <span className="mr-btn p" data-testid={`store.receive-${it.applyItemId}`} onClick={() => onReceive([it.applyItemId])}>确认收货</span>}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** 异常上报页（原型 店长-06） */
function ReportSheet({ item, storeId, onClose, onDone }: { item: ReceiptItem; storeId?: string; onClose: () => void; onDone: () => void }) {
  const [type, setType] = useState<number>(-1);
  const [remark, setRemark] = useState('');
  const submit = async () => {
    if (type < 0) return message.warning('请选择异常类型');
    await addExceptionReport({ matrlApplyItemId: item.applyItemId, matrlId: item.matrlId, storeId, type, remark });
    message.success('已上报');
    onDone();
  };
  return (
    <div className="mr-report" data-testid="store.reportSheet">
      <div className="bar"><span className="back" onClick={onClose}>‹</span>异常上报</div>
      <div className="card">
        <h5>选择异常类型</h5>
        <div className="radios">{REPORT_TYPES.map((t, i) => <span key={t} className={type === i ? 'on' : ''} data-testid={`store.reportType-${i}`} onClick={() => setType(i)}><i />{t}</span>)}</div>
        <textarea data-testid="store.reportRemark" placeholder="请填写异常具体情况" maxLength={100} value={remark} onChange={(e) => setRemark(e.target.value)} />
        <div style={{ textAlign: 'right', color: '#999', fontSize: 11 }}>{remark.length} / 100</div>
        <div className="add">+</div>
      </div>
      <div className="submit" data-testid="store.reportSubmit" onClick={submit}>确认上报</div>
    </div>
  );
}
