import type { Account } from './store/useSession';

/**
 * 默认账号（devShared 桶：local/dev 同库）。首次打开或被删后自动补回，保证别人打开就有账号可用。
 * 只带账号密码不带 token：首个请求触发静默续登（expiresAt=1 视为已过期），门店信息由登录结果回填。
 * 仅限测试库账号，不要放任何生产账号。
 */
const seed = (p: Pick<Account, 'uid' | 'name' | 'account' | 'role' | 'defaultStoreName'> & { note?: string }): Account => ({
  id: `app:${p.uid}`,
  uid: p.uid,
  name: p.name,
  type: 1,
  mode: 'app',
  account: p.account,
  password: 'udream@@0',
  token: '',
  expiresAt: 1,
  role: p.role,
  defaultStoreName: p.defaultStoreName,
  savedAt: 0,
});

export const SEED_BUCKET = 'devShared';
export const SEED_ACCOUNTS: Account[] = [
  seed({ uid: '1632933592451964929', name: '黄锟', account: '13800000001', role: 1, defaultStoreName: '光明大第工作室(测试)' }),
  seed({ uid: '1631487000955404289', name: '朱俊峰', account: '13800000002', role: 2, defaultStoreName: '晴菜测试三代店' }),
  seed({ uid: '1457645010869682177', name: '王贵森', account: '13600000001', role: 1, defaultStoreName: '流塘阳光工作室' }),
];
/** 首次打开默认激活的 App 账号（店长，造数单所在门店） */
export const SEED_DEFAULT_APP_ID = SEED_ACCOUNTS[0].id;
