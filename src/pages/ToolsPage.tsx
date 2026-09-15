import { useState } from 'react';
import { Button, Card, DatePicker, Input, Select, Space, Table, message } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { exceptionList, handleException, mockTrack } from '../api/receipt';

/** 工具：模拟快递轨迹回调（Mock 模式）/ 后台异常处理 */
export function ToolsPage() {
  const [expressNo, setExpressNo] = useState('');
  const [firstTime, setFirstTime] = useState<Dayjs>(dayjs().subtract(1, 'day'));
  const [state, setState] = useState('0');
  const [context, setContext] = useState('【自测】快件运输中');
  const [excRows, setExcRows] = useState<Record<string, unknown>[]>([]);

  const send = async () => {
    if (!expressNo) return message.warning('快递单号必填');
    await mockTrack(expressNo, { state, nodes: [
      { time: dayjs().format('YYYY-MM-DD HH:mm:ss'), context, area: '深圳市', statusDesc: state === '3' ? '签收' : '在途' },
      { time: firstTime.format('YYYY-MM-DD HH:mm:ss'), context: '【自测】快件已揽收', area: '上海市', statusDesc: '揽收' },
    ] });
    message.success('轨迹已投递（首条 = 首条轨迹日，触发重算）');
  };
  const loadExc = () => exceptionList({ status: 0 }).then(setExcRows);

  return (
    <div style={{ padding: 12 }}>
      <Card size="small" title="模拟快递100 回调（apiUnified/receipt/mockTrack，仅 Mock 模式）">
        <Space wrap>
          <Input data-testid="tools.expressNo" style={{ width: 200 }} placeholder="快递单号" value={expressNo} onChange={(e) => setExpressNo(e.target.value)} />
          <span>首条轨迹时间</span><DatePicker showTime value={firstTime} onChange={(v) => v && setFirstTime(v)} />
          <Select style={{ width: 120 }} value={state} onChange={setState} options={[{ value: '0', label: '0 在途' }, { value: '1', label: '1 揽收' }, { value: '5', label: '5 派件' }, { value: '3', label: '3 签收' }]} />
          <Input style={{ width: 240 }} value={context} onChange={(e) => setContext(e.target.value)} />
          <Button type="primary" data-testid="tools.sendTrack" onClick={send}>投递轨迹</Button>
        </Space>
      </Card>
      <Card size="small" style={{ marginTop: 8 }} title="后台异常处理（待处理 → 已处理，写 handle_time，触发重算 +4 天）" extra={<Button size="small" data-testid="tools.loadExc" onClick={loadExc}>加载待处理</Button>}>
        <Table size="small" rowKey={(r) => String(r.id)} dataSource={excRows} pagination={false} data-testid="tools.excTable"
          columns={[
            { title: 'id', dataIndex: 'id', render: (v) => String(v) },
            { title: '门店', dataIndex: 'storeName' },
            { title: '物料', dataIndex: 'matrlName' },
            { title: '类型', dataIndex: 'typeStr' },
            { title: '说明', dataIndex: 'remark' },
            { title: '上报时间', dataIndex: 'createTimeStr' },
            { title: '操作', render: (_, r) => <Button size="small" type="primary" onClick={() => handleException(String(r.id), '自测处理完成').then(() => { message.success('已处理'); loadExc(); })}>处理完成</Button> },
          ]} />
      </Card>
    </div>
  );
}
