import { useState } from 'react';
import { Button, Card, Input, InputNumber, Space, Switch, Tag } from 'antd';
import dayjs from 'dayjs';
import { PhoneFrame } from '../components/PhoneFrame';
import { AppSimLayout } from '../components/AppSimLayout';
import { isNotReceivedLegacy, overdueKinds, precheckDuty } from '../api/receipt';
import { useSession } from '../store/useSession';
import { navigateTo } from '../nav';
import type { OverdueKinds } from '../types/receipt';

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
/** 下班拦截：物料超时未收货（craftsman UpdateWorkStatusRespCodes.MATRL_OVERDUE） */
const MATRL_OVERDUE = '2001018';

interface Popup { text: string; jump?: boolean; code?: string }

/** 店长侧·上下班打卡（原型 店长-16：温馨提示弹窗复用；上班后弹窗 R1.19 + 下班硬拦截 R1.20） */
export function ClockPhone() {
  const acc = useSession((s) => s.appUser());
  const [storeId, setStoreId] = useState(acc?.currentStoreId || acc?.defaultStoreId || '');
  const [roleType, setRoleType] = useState(acc?.storeRoleType ?? 1);
  const [onDuty, setOnDuty] = useState(false);
  const [records, setRecords] = useState<{ t: string; s: string }[]>([]);
  const [popup, setPopup] = useState<Popup | null>(null);
  const [kinds, setKinds] = useState<OverdueKinds>();
  const [legacy, setLegacy] = useState<boolean>();
  const [duty, setDuty] = useState<unknown>();
  const [showRaw, setShowRaw] = useState(false);
  const now = dayjs();
  const storeName = acc?.defaultStoreName || '';

  /** 上班：打卡成功后查超时种数（新 overdueKinds；老 Boolean 接口并行看口径） */
  const checkIn = async () => {
    const [k, l] = await Promise.all([overdueKinds(storeId || undefined).catch(() => undefined), isNotReceivedLegacy().catch(() => undefined)]);
    setKinds(k); setLegacy(l);
    setOnDuty(true);
    setRecords((r) => [...r, { t: dayjs().format('HH:mm:ss'), s: `上班（${storeName}）` }]);
    if (k && k.kinds > 0) setPopup({ text: `您还有${k.kinds}种物料超时未收货，请及时处理，请勿超时。`, jump: true });
  };
  /** 下班：craftsman 前置校验，2001018 硬拦截；其它码照原样弹（考试/任务/门店事务等排在前面） */
  const checkOut = async () => {
    if (!acc?.uid || !storeId) return setPopup({ text: '需 App 账号与门店 id' });
    let r: any;
    // client 拦截器对业务失败 reject 的是 Resp 体本身；网络错误才是 AxiosError
    try { r = await precheckDuty({ craftsmanUid: acc.uid, storeId, roleType }); } catch (e: any) { r = e?.retCode ? e : e?.response?.data ?? { retCode: 'ERR', retMsg: String(e?.message || e) }; }
    setDuty(r);
    const code = String(r?.retCode ?? '');
    if (r?.success && code === '000000') {
      setOnDuty(false);
      setRecords((x) => [...x, { t: dayjs().format('HH:mm:ss'), s: `下班（${storeName}）` }]);
      return;
    }
    const d = r?.result ?? r?.data;
    const jump = code === MATRL_OVERDUE || (d && typeof d === 'object' && d.jump === '220');
    setPopup({ text: String(r?.retMsg || '下班校验未通过').replace(/<[^>]+>/g, ''), jump, code });
  };
  const go = () => { setPopup(null); navigateTo('storeDetail'); };

  const body = (
    <div className="ck-page" data-testid="clock.page">
      <div className="ck-exc"><span className="ic">!</span><span>你有一个异常待处理</span><span className="sp" /><span>查看 ▸</span></div>
      <div className="ck-card">
        <div className="r1"><span className="d">{now.format('YYYY.MM.DD')} {WEEK[now.day()]}</span><span className={`st${onDuty ? '' : ' off'}`} data-testid="clock.state">{onDuty ? '上班中' : '未上班'}</span></div>
        <div className="shift">今日早班： 10:00-22:00</div>
      </div>
      <div className="ck-line" data-testid="clock.records">
        {records.map((r, i) => <div className="it" key={i}><span className="dot" /><span>{r.t}</span><span>{r.s}</span></div>)}
        {!records.length && <div className="empty">今日暂无打卡记录</div>}
      </div>
      <div className="ck-btns">
        {!onDuty
          ? <span className="b" data-testid="clock.checkIn" onClick={checkIn}>上班打卡</span>
          : <span className="b off" data-testid="clock.checkOut" onClick={checkOut}>下班打卡</span>}
      </div>
      <div className="ck-tips">温馨提示：<br />1.打卡显示时间是手机系统时间，可能与服务器存在差异，<span className="red">上下班勿踩点打卡</span><br />2.已在打卡范围内<br />3.打卡后不可再调整当天班次，<span className="red">请确认好排班后再打卡！</span></div>
      <div className="ck-btns"><span className="b plain">查看排班</span></div>
      <div className="ck-tabs">
        {[['🕒', '上下班打卡', true], ['◔', '统计', false], ['▤', '申请', false], ['👤', '审批', false]].map(([i, t, on]) => <div key={String(t)} className={`t${on ? ' on' : ''}`}><span className="i">{i}</span>{t}</div>)}
      </div>
    </div>
  );

  const overlay = popup ? (
    <div className="mr-mask" data-testid="clock.popup">
      <div className="ck-modal">
        <h4>温馨提示</h4>
        <p data-testid="clock.popupText">{popup.text}</p>
        {popup.jump ? <span className="go" data-testid="clock.popupGo" onClick={go}>去完成</span> : <span className="go" onClick={() => setPopup(null)}>知道了</span>}
        {popup.jump && <span className="close" data-testid="clock.popupDismiss" onClick={() => setPopup(null)}>（自测：关闭不跳转）</span>}
        {popup.code && <span className="close">retCode {popup.code}{popup.jump ? ' · jump 220 → 物料申请列表' : ''}</span>}
      </div>
    </div>
  ) : null;

  const controls = (
    <Card size="small" title="打卡参数">
      <Space direction="vertical" style={{ width: '100%' }}>
        <Space wrap>
          <Input data-testid="clock.storeId" style={{ width: 200 }} placeholder="storeId（空=当前人全部门店）" value={storeId} onChange={(e) => setStoreId(e.target.value)} />
          <span>roleType</span><InputNumber value={roleType} onChange={(v) => setRoleType(v ?? 1)} style={{ width: 70 }} />
          <Button onClick={() => { setOnDuty(false); setRecords([]); setPopup(null); setDuty(undefined); setKinds(undefined); }}>重置状态</Button>
        </Space>
        <div style={{ color: '#888', fontSize: 12 }}>uid {acc?.uid || '-'} · {storeName || '-'} · 门店角色 {acc?.storeRoleType ?? '-'}</div>
        {kinds && <div>上班查询 overdueKinds：<Tag color={kinds.kinds > 0 ? 'red' : 'green'}>{kinds.kinds} 种</Tag>{legacy !== undefined && <span style={{ color: '#888' }}>老接口 Boolean = {String(legacy)}</span>}</div>}
        <div style={{ color: '#888', fontSize: 12 }}>下班链路：考试 → 任务 → 门店事务 → <b>物料超时 2001018（jump 220）</b> → 周边盘点。被前面的码拦住不代表本功能失败。</div>
        <Space><Switch checked={showRaw} onChange={setShowRaw} /> 显示原始返回</Space>
        {showRaw && <pre data-testid="clock.dutyResp" style={{ fontSize: 11, maxHeight: 300, overflow: 'auto', background: '#fafafa', padding: 8 }}>{JSON.stringify({ kinds, duty }, null, 2)}</pre>}
      </Space>
    </Card>
  );

  return (
    <AppSimLayout controls={controls}>
      <PhoneFrame title="上下班打卡" onBack={() => {}} overlay={overlay}>{body}</PhoneFrame>
    </AppSimLayout>
  );
}
