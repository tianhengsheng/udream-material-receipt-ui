import { useEffect, useState } from 'react';
import { message } from 'antd';
import { currentApplies, historyApplies } from '../api/receipt';
import type { ApplyCard } from '../types/receipt';

const STATUS_DESC: Record<number, string> = { 0: '待审批', 1: '已审批', 2: '收货中', 3: '已完结', 4: '已驳回', 5: '已取消' };

/** 老「物料申请」列表页（1:1），点卡片进详情 */
export function StoreApplyListPhone({ onOpen }: { onOpen: (applyId: string) => void }) {
  const [tab, setTab] = useState<'cur' | 'his'>('cur');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [rows, setRows] = useState<ApplyCard[]>([]);
  const [total, setTotal] = useState(0);
  const [folded, setFolded] = useState<Record<string, boolean>>({});

  const load = async (t = tab, ov = overdueOnly) => {
    const r = t === 'cur' ? await currentApplies(ov ? 1 : undefined) : await historyApplies();
    setRows(r.rows);
    setTotal(r.total);
  };
  useEffect(() => { load(); }, []);

  const quickReceive = (c: ApplyCard) => {
    // 列表页「确认收货」= 老页面入口，这里直接进详情让用户按行/批量收货
    onOpen(c.applyId);
    message.info('请在详情页选择物料确认收货');
  };

  return (
    <div className="mr-page" data-testid="store.list" style={{ paddingBottom: 70 }}>
      <div className="ml-tabs">
        <div className={`t${tab === 'cur' ? ' on' : ''}`} data-testid="list.tab-cur" onClick={() => { setTab('cur'); load('cur', overdueOnly); }}>当前申请</div>
        <div className={`t${tab === 'his' ? ' on' : ''}`} data-testid="list.tab-his" onClick={() => { setTab('his'); load('his', overdueOnly); }}>申请历史</div>
      </div>
      <div className="ml-bar">
        <span>共 <b>{total}</b> 条结果</span>
        {tab === 'cur' && <span className={`f${overdueOnly ? ' on' : ''}`} data-testid="list.overdueOnly" onClick={() => { const v = !overdueOnly; setOverdueOnly(v); load('cur', v); }}>{overdueOnly ? '取消筛选' : '查看超时未收货'}</span>}
      </div>
      {rows.map((c) => {
        const pics = (c.matrlPics || '').split(',').filter(Boolean);
        const fold = folded[c.applyId];
        return (
          <div className="ml-card" key={c.applyId} data-testid={`list.card-${c.applyId}`}>
            {c.tag === 1 && <div className="cost"><span style={{ background: '#e0404a', color: '#fff', borderRadius: '50%', width: 16, height: 16, fontSize: 11, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>!</span>当月申请成本过高 (标准 {c.highestStandard ?? 0} 元)</div>}
            <div className="hd">
              <span className="sn">{c.storeName}</span>
              {c.isNotReceived === 1 && <span className="ov">超时未收货</span>}
              <span className="sp" />
              <span className={`stt${c.status === 2 ? '' : ' g'}`}>{STATUS_DESC[c.status ?? -1] ?? c.status}</span>
              {c.status === 2 && <span className="rb" data-testid={`list.receive-${c.applyId}`} onClick={() => quickReceive(c)}>确认收货</span>}
            </div>
            <div className="tm">{(c.applyTime || '').replace(/-/g, '/').slice(0, 16)}</div>
            <div className="pics" data-testid={`list.open-${c.applyId}`} onClick={() => onOpen(c.applyId)}>
              {pics.length ? <img src={pics[0]} alt="" /> : <div className="ph" />}
              <div className="more"><span>共</span><span>{c.num ?? pics.length}</span><span>件 ›</span></div>
            </div>
            {!fold && c.nodes && c.nodes.length > 0 && (
              <div className="ml-steps">
                {c.nodes.map((n, i) => (
                  <div className="s" key={i}>
                    <span className={`ic${n.status === 1 ? ' ok' : n.status === -1 ? ' no' : ''}`}>✓</span>
                    <span>{n.name}</span>
                    <span className="st">{n.content || (n.current ? STATUS_DESC[c.status ?? -1] : '')}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="fold" onClick={() => setFolded((f) => ({ ...f, [c.applyId]: !fold }))}><span>{fold ? '展开 ⌄' : '收起 ⌃'}</span></div>
          </div>
        );
      })}
      {!rows.length && <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>暂无数据</div>}
      <div className="ml-bottom"><div className="b">物料申请</div></div>
    </div>
  );
}

