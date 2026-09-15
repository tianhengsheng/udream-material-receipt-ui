# CLAUDE.md

物料收货管控（material-receipt）前端自测工具（dev-only，配合后端 monorepo udream-micro-service 联调）。

## 测试工作法

做任何 UI 测试前先读后端仓库 `docs/material-receipt/test-playbook.md`，按「四步工作法」执行：
钩子 `window.__t` 组合原子操作 + 文本断言 + DB 核验，只在终态/失败时截图。

## 同步规则（强制）

新增/修改页面交互时同步：无文案交互元素加 `data-testid`（`页.动作`）；playbook 对应小节；新表/新状态补 DB 核验 SQL。

## 项目约定

- 端口 8080（后端仓库 .claude/launch.json 的 `material-receipt-ui`，与 scanbuy/mqtt/wdz 互斥）；改 envs.ts 需重启 vite。
- 一律经网关（envs.ts：默认 dev；local=本地网关，端口可在顶栏环境弹层里改，vite 插件按请求转发）；老 franchise App 接口 `/mgt/pur/**`、craftsman `/craftsman/apiCraftsman/**`、新接口 `/franchise/apiCraftsman|apiUnified/**` 均根路由。
- 账号分桶 useSession（桶键=env.group??env）；App 页发 App token，后台/工具页发 PC token（App.tsx PAGES.client）。
- 默认账号 `src/seedAccounts.ts`（devShared 桶：黄锟店长/朱俊峰区经/王贵森店长，密码 udream@@0），打开即补齐、删了会回来；只带密码不带 token，首个请求静默登录。只放测试库账号。
- 19 位雪花 id 一律字符串（bigIntSafeParse）。
- 快递100 走 Mock（express.kd100.enabled=false），轨迹用「工具」页 mockTrack 投递。
