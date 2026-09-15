import { useEffect, useState } from 'react';
import { Button, Card, Space, Switch, message } from 'antd';
import dayjs from 'dayjs';
import { PhoneFrame } from '../components/PhoneFrame';
import { AppSimLayout } from '../components/AppSimLayout';
import { managerOverdueStores, managerStoreStats, managerSummary, managerUrge, packages } from '../api/receipt';
import type { ManagerSummary, OverdueStore, ReceiptPackage, ReceiptPackages, StoreStats } from '../types/receipt';

const TABS = ['盘点', '申请', '收货', '报损'];
const PALETTE = [
  { bg: '#e6f0ff', c: '#2f6bff' }, { bg: '#e8f8f0', c: '#2ea56b' }, { bg: '#fff1e6', c: '#e8791c' },
  { bg: '#f3e8ff', c: '#8b4de6' }, { bg: '#ffe8e8', c: '#e0404a' }, { bg: '#fff8dc', c: '#b08900' },
];
const palette = (s?: string) => PALETTE[[...(s || '')].reduce((a, ch) => a + ch.charCodeAt(0), 0) % PALETTE.length];
const mmdd = (d?: string) => (d ? d.slice(5) : '');
/** 近 12 个月 */
const MONTHS = Array.from({ length: 12 }, (_, i) => dayjs().subtract(i, 'month')).map((d) => ({ v: d.format('YYYY-MM'), l: d.format('YYYY年M月') }));

/** 区经侧·物料管控（收货 Tab，1:1 原型，真机框） */
export function ManagerPhone() {
  const [summary, setSummary] = useState<ManagerSummary>();
  const [month, setMonth] = useState(MONTHS[0].v);
  const [stats, setStats] = useState<StoreStats>();
  const [sheet, setSheet] = useState(false);
  const [stores, setStores] = useState<OverdueStore[]>([]);
  const [expanded, setExpanded] = useState<Record<string, ReceiptPackages | null>>({});
  const [showRaw, setShowRaw] = useState(false);

  const loadTop = () => managerSummary().then(setSummary).catch(() => setSummary(undefined));
  const loadStats = (m = month) => managerStoreStats(m).then(setStats).catch(() => setStats(undefined));
  useEffect(() => { loadTop(); loadStats(); }, []);

  const openSheet = async () => { setStores(await managerOverdueStores()); setExpanded({}); setSheet(true); };
  const toggle = async (applyId: string) => {
    if (applyId in expanded) { setExpanded((s) => { const n = { ...s }; delete n[applyId]; return n; }); return; }
    setExpanded((s) => ({ ...s, [applyId]: null }));
    const p = await packages(applyId, 1);
    setExpanded((s) => ({ ...s, [applyId]: p ?? null }));
  };
  const urge = async () => {
    const r = await managerUrge();
    message.success(`已催办 ${r?.storeCount} 家门店 / ${r?.userCount} 人${r?.skippedStoreCount ? `，跳过 ${r.skippedStoreCount} 家无店长` : ''}`);
    loadTop();
  };

  const body = (
    <div className="mg-page" data-testid="mgr.page">
      <div className="mg-tabs">
        {TABS.map((t, i) => (
          <div key={t} className={`t${i === 2 ? ' on' : ''}`} data-testid={`mgr.tab-${i}`} onClick={() => i !== 2 && message.info('本期只做收货 Tab')}>
            {t}{i === 2 && summary?.hasOverdue && <i className="dot" />}
          </div>
        ))}
      </div>
      {summary?.hasOverdue ? (
        <div className="mg-card red" data-testid="mgr.card" onClick={openSheet}>
          <span className="lab">重点<br />跟进</span>
          <div className="mid"><div className="t">门店超时未处理</div><div className="s">{summary.tipText || '今日需处理完，请勿超时！'}</div></div>
          <span className="n"><b>{summary.storeCount}</b>家</span>
          <span className="arr">›</span>
        </div>
      ) : (
        <div className="mg-card ok" data-testid="mgr.card"><span className="ic">✓</span>当前不存在需跟进收货的门店</div>
      )}
      <div className="mg-filter">
        <select className="mg-month" data-testid="mgr.month" value={month} onChange={(e) => { setMonth(e.target.value); loadStats(e.target.value); }}>
          {MONTHS.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
        </select>
        <span className="cnt">{stats?.storeTotal ?? 0} 家门店</span>
      </div>
      <div className="mg-table" data-testid="mgr.statTable">
        <div className="tr th"><span className="c0">门店</span><span>申请<br />发货单数</span><span>待收货<br />单数</span><span>发货-收货时效<br />（平均天）</span><span>超时<br />次数</span></div>
        {(stats?.rows || []).map((r) => (
          <div className="tr" key={r.storeId} data-testid={`mgr.row-${r.storeId}`}>
            <span className="c0">{r.storeName}</span>
            <span>{r.shipApplyCount}</span>
            <span>{r.waitReceiveApplyCount}</span>
            <span className={r.avgReceiveDays != null && r.avgReceiveDays >= 5 ? 'org' : ''}>{r.avgReceiveDays == null ? '-' : r.avgReceiveDays.toFixed(1)}</span>
            <span className={r.overdueCount > 0 ? 'red' : 'grey'}>{r.overdueCount}</span>
          </div>
        ))}
        {!stats?.rows?.length && <div className="empty">暂无数据</div>}
      </div>
    </div>
  );

  const overlay = sheet ? (
    <div className="mg-mask" onClick={() => setSheet(false)}>
      <div className="mg-sheet" data-testid="mgr.sheet" onClick={(e) => e.stopPropagation()}>
        <div className="hd">
          <span className="t">超时未处理（共 {stores.length} 家门店）</span>
          <span className="urge" data-testid="mgr.urge" onClick={urge}>一键催办</span>
          <span className="x" data-testid="mgr.close" onClick={() => setSheet(false)}>×</span>
        </div>
        <div className="tip">{summary?.tipText || '今日需处理完，请勿超时！'}</div>
        <div className="bd">
          {stores.map((s) => (
            <div className="mg-store" key={s.storeId} data-testid={`mgr.store-${s.storeId}`}>
              <div className="r1">
                <span className="nm">{s.storeName}</span>
                <span className="mg">{s.managerRoleDesc} {s.managerName}</span>
                {s.managerMobile && <a className="tel" href={`tel:${s.managerMobile}`} title={s.managerMobile}>📞</a>}
              </div>
              {s.applies.map((a) => {
                const open = a.applyId in expanded;
                const data = expanded[a.applyId];
                return (
                  <div key={a.applyId} className="ap">
                    <div className="no">申请单号 {a.applyNo}</div>
                    <div className="k">共 <b>{a.overdueKinds}</b> 种物料超时未处理 <span className="lk" data-testid={`mgr.expand-${a.applyId}`} onClick={() => toggle(a.applyId)}>{open ? '收起' : '展开'}</span></div>
                    {open && (data === null ? <div className="ld">加载中…</div> : data?.packages.map((p) => <ReadonlyPackage key={p.groupKey} pkg={p} />))}
                    {open && data && <div className="fold" onClick={() => toggle(a.applyId)}>收起</div>}
                  </div>
                );
              })}
            </div>
          ))}
          {!stores.length && <div className="empty">暂无超时门店</div>}
        </div>
      </div>
    </div>
  ) : null;

  const controls = (
    <Card size="small" title="区经·收货">
      <Space direction="vertical" style={{ width: '100%' }}>
        <Space><Button onClick={() => { loadTop(); loadStats(); }}>刷新</Button><Button onClick={openSheet} disabled={!summary?.hasOverdue}>打开弹层</Button></Space>
        <Space><Switch checked={showRaw} onChange={setShowRaw} /> 显示原始 JSON</Space>
        {showRaw && <pre style={{ fontSize: 11, maxHeight: 400, overflow: 'auto', background: '#fafafa', padding: 8 }}>{JSON.stringify({ summary, stats, stores }, null, 2)}</pre>}
      </Space>
    </Card>
  );

  return (
    <AppSimLayout controls={controls}>
      <PhoneFrame title="物料管控" onBack={() => {}} overlay={overlay}>{body}</PhoneFrame>
    </AppSimLayout>
  );
}

/** 弹层内只读包裹卡（结构同店长侧，无勾选/按钮） */
function ReadonlyPackage({ pkg }: { pkg: ReceiptPackage }) {
  const fs = pkg.frontStatus;
  return (
    <div className={`mr-pkg${pkg.overdue ? ' overdue' : ''}`} data-testid={`mgr.pkg-${pkg.groupKey}`}>
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
        return (
          <div className="mr-item" key={it.applyItemId}>
            <span className="tag" style={{ background: p.bg, color: p.c }}>{(it.typeTag || '').slice(0, 2)}</span>
            <div className="mid">
              <div className="nm">{it.matrlName}</div>
              <div className="pl">申请 {it.applyNum}{it.unitName}　发货 <b style={{ color: '#1c1c1e' }}>{it.deliverNum}{it.unitName}</b></div>
            </div>
            {!pkg.hasExpress && it.shipDate && (
              <div className="rt"><div>发货 {mmdd(it.shipDate)}</div>{it.overdue && <div className="red">已超时 {it.overdueDays} 天</div>}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
