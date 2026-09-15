import { useState } from 'react';
import { Alert, Button, Card, Descriptions, Input, InputNumber, Space, message } from 'antd';
import { isNotReceivedLegacy, overdueKinds, precheckDuty } from '../api/receipt';
import { useSession } from '../store/useSession';
import type { OverdueKinds } from '../types/receipt';

/** 店长侧：上班弹窗（overdueKinds）+ 下班硬拦截（craftsman precheckCraftsmanDuty） */
export function ClockPage() {
  const acc = useSession((s) => s.appUser());
  const [storeId, setStoreId] = useState(acc?.currentStoreId || acc?.defaultStoreId || '');
  const [roleType, setRoleType] = useState(1);
  const [kinds, setKinds] = useState<OverdueKinds>();
  const [legacy, setLegacy] = useState<boolean>();
  const [duty, setDuty] = useState<unknown>();

  const checkIn = async () => {
    const [k, l] = await Promise.all([overdueKinds(storeId || undefined), isNotReceivedLegacy().catch(() => undefined)]);
    setKinds(k); setLegacy(l);
  };
  const checkOut = async () => {
    if (!acc?.uid || !storeId) return message.warning('需 App 账号与 storeId');
    try {
      const r = await precheckDuty({ craftsmanUid: acc.uid, storeId, roleType });
      setDuty(r);
    } catch (e) {
      setDuty(e);
    }
  };

  return (
    <div style={{ padding: 12 }}>
      <Card size="small" title="参数">
        <Space wrap>
          <Input data-testid="clock.storeId" style={{ width: 220 }} placeholder="storeId（空=当前人全部门店）" value={storeId} onChange={(e) => setStoreId(e.target.value)} />
          <span>roleType</span><InputNumber value={roleType} onChange={(v) => setRoleType(v ?? 1)} />
          <span style={{ color: '#888' }}>uid={acc?.uid || '-'}</span>
        </Space>
      </Card>
      <Card size="small" style={{ marginTop: 8 }} title="上班打卡后弹窗" extra={<Button type="primary" data-testid="clock.checkIn" onClick={checkIn}>查询</Button>}>
        {kinds && (kinds.kinds > 0
          ? <Alert type="warning" showIcon data-testid="clock.checkInTip" message={`您还有${kinds.kinds}种物料超时未收货，请及时处理，请勿超时`} description={`applyIds: ${kinds.applyIds.join(',')}`} />
          : <Alert type="success" showIcon message="无超时物料，不弹窗" />)}
        {legacy !== undefined && <div style={{ marginTop: 6, color: '#888' }}>老接口 queryMatrlApplyIsNotReceived = {String(legacy)}（口径已切，形状保持 Boolean）</div>}
      </Card>
      <Card size="small" style={{ marginTop: 8 }} title="下班打卡前置校验（craftsman）" extra={<Button type="primary" danger data-testid="clock.checkOut" onClick={checkOut}>模拟下班</Button>}>
        {duty != null && (
          <Descriptions size="small" column={1}>
            <Descriptions.Item label="原始返回"><pre data-testid="clock.dutyResp" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(duty, null, 2)}</pre></Descriptions.Item>
          </Descriptions>
        )}
        <div style={{ color: '#888', marginTop: 6 }}>期望：存在超时 → retCode 2001018，result.kinds / result.jump=220；前面链路（考试、任务等）先命中会返回其它码。</div>
      </Card>
    </div>
  );
}
