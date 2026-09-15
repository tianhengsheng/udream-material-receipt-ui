import { useState, type ComponentType } from 'react';
import { ConfigProvider, Layout, Menu, theme } from 'antd';
import { DesktopOutlined, MobileOutlined, ToolOutlined } from '@ant-design/icons';
import zhCN from 'antd/locale/zh_CN';
import { TopBar } from './components/TopBar';
import { useSession, type ClientMode } from './store/useSession';
import { StoreDetailPhone } from './app-mobile/StoreDetailPhone';
import { ClockPage } from './pages/ClockPage';
import { ManagerPhone } from './app-mobile/ManagerPhone';
import { PcPurchaseOrderPage } from './pages/PcPurchaseOrderPage';
import { ToolsPage } from './pages/ToolsPage';
import { bindNavigate } from './nav';

/** 单数组驱动：菜单 + 端(决定发哪端 token) + 页面 */
const PAGES = [
  { key: 'storeDetail', client: 'app', label: '店长·申请单详情', icon: <MobileOutlined />, Comp: StoreDetailPhone },
  { key: 'manager', client: 'app', label: '区经·物料管控', icon: <MobileOutlined />, Comp: ManagerPhone },
  { key: 'clock', client: 'app', label: '店长·打卡联动', icon: <MobileOutlined />, Comp: ClockPage },
  { key: 'pcPurchase', client: 'pc', label: '后台·采购订单', icon: <DesktopOutlined />, Comp: PcPurchaseOrderPage },
  { key: 'tools', client: 'pc', label: '工具·轨迹/异常', icon: <ToolOutlined />, Comp: ToolsPage },
] as const satisfies ReadonlyArray<{ key: string; client: ClientMode; label: string; icon: React.ReactNode; Comp: ComponentType }>;

type PageKey = (typeof PAGES)[number]['key'];
const PAGE_STORE_KEY = 'udream-material-receipt-page';
const getPage = (key: string) => PAGES.find((p) => p.key === key) ?? PAGES[0];
const LABEL_TO_KEY = Object.fromEntries(PAGES.map((p) => [p.label, p.key]));

export default function App() {
  const [page, setPage] = useState<PageKey>(() => {
    const p = getPage(localStorage.getItem(PAGE_STORE_KEY) || '').key;
    useSession.getState().setClientMode(getPage(p).client);
    return p;
  });
  const onMenuClick = (key: PageKey) => {
    useSession.getState().setClientMode(getPage(key).client);
    setPage(key);
    localStorage.setItem(PAGE_STORE_KEY, key);
  };
  bindNavigate(onMenuClick as (key: string) => void, LABEL_TO_KEY);
  const Active = getPage(page).Comp;
  return (
    <ConfigProvider locale={zhCN} componentSize="small" theme={{ algorithm: theme.defaultAlgorithm, token: { fontSize: 12, controlHeight: 28, borderRadius: 4 },
      components: { Table: { cellPaddingBlock: 4, cellPaddingInline: 8, headerBg: '#fafafa', fontSize: 12 }, Card: { paddingLG: 12, headerFontSize: 13, headerHeight: 36, headerHeightSM: 32 }, Tag: { fontSize: 11 }, Button: { fontSize: 12 } } }}>
      <Layout style={{ minHeight: '100vh' }}>
        <Layout.Sider theme="light" width={180} style={{ borderRight: '1px solid #f0f0f0' }}>
          <div style={{ padding: '10px 16px', fontWeight: 600 }}>物料收货管控 自测 UI</div>
          <Menu mode="inline" selectedKeys={[page]} onClick={(e) => onMenuClick(e.key as PageKey)}
            items={PAGES.map((p) => ({ key: p.key, icon: p.icon, label: p.label }))} style={{ borderInlineEnd: 'none' }} />
        </Layout.Sider>
        <Layout style={{ background: '#f5f5f5' }}>
          <TopBar />
          <Active />
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}
