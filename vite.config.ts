import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import http from 'node:http';
import { ENV_PRESETS } from './src/envs';

/** local 环境端口可在页面改：axios 带 x-local-port 头，<a> 直开的下载链接带 ?_lp=。
 *  Vite 内置 proxy 目标是启动时固定的，所以 /env/local 由本插件按请求转发到 localhost:{port}。 */
function localPortRouter(): Plugin {
  const local = ENV_PRESETS.find((e) => e.key === 'local')!;
  return {
    name: 'local-port-router',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.startsWith('/env/local/')) return next();
        const port = String(req.headers['x-local-port'] || /[?&]_lp=(\d+)/.exec(req.url)?.[1] || '').replace(/\D/g, '') || '20000';
        let path = req.url.replace(/^\/env\/local/, '').replace(/([?&])_lp=\d+&?/, '$1').replace(/[?&]$/, '');
        const ov = (local.serviceOverrides || []).find((o) => path.startsWith(o.prefix));
        if (ov) path = `${ov.pathPrefix}${path}`;
        const headers: Record<string, any> = { ...req.headers, host: `localhost:${port}` };
        delete headers.cookie; delete headers['x-local-port'];
        const up = http.request({ host: 'localhost', port: Number(port), method: req.method, path, headers }, (r) => {
          const h: Record<string, any> = { ...r.headers };
          const sc = h['set-cookie'];
          if (sc) {
            for (const c of Array.isArray(sc) ? sc : [sc]) { const m = /^\s*att=([^;]+)/i.exec(c); if (m?.[1]) { h['x-app-token'] = m[1]; break; } }
            delete h['set-cookie'];
          }
          res.writeHead(r.statusCode || 502, h);
          r.pipe(res);
        });
        up.on('error', (err) => { res.statusCode = 502; res.end(`[local-port-router] localhost:${port} ${err.message}`); });
        req.pipe(up);
      });
    },
  };
}

// 每个环境预设：先注册 serviceOverrides 细粒度规则（/env/{key}{prefix}，http-proxy 按 key 长度长的优先匹配），再注册 catch-all /env/{key}。
// 剥上下行 cookie（避免 localhost 域残留 cookie 污染网关鉴权 50130）。
export default defineConfig(() => {
  const proxy: Record<string, any> = {};
  const build = (e: { key: string; target: string }, pathPrefix: string) => ({
      target: e.target,
      changeOrigin: true,
      secure: false,
      rewrite: (path: string) => {
        const stripped = path.replace(new RegExp(`^/env/${e.key}`), '');
        return pathPrefix ? `${pathPrefix}${stripped}` : stripped;
      },
      configure: (p: any) => {
        p.on('proxyReq', (req: any) => req.removeHeader('cookie'));
        p.on('proxyRes', (res: any) => {
          const sc = res.headers['set-cookie'];
          if (sc) {
            const arr = Array.isArray(sc) ? sc : [sc];
            for (const c of arr) {
              const m = /^\s*att=([^;]+)/i.exec(c);
              if (m && m[1]) { res.headers['x-app-token'] = m[1]; break; }
            }
            delete res.headers['set-cookie'];
          }
        });
      },
  });
  ENV_PRESETS.forEach((e) => {
    (e.serviceOverrides || []).forEach((o) => { proxy[`/env/${e.key}${o.prefix}`] = build(e, o.pathPrefix); });
    proxy[`/env/${e.key}`] = build(e, e.pathPrefix);
  });
  // eslint-disable-next-line no-console
  console.log('[vite] /env/local → localhost:{x-local-port|_lp|20000}（插件动态转发）');
  console.log('[vite] proxy routes:'); Object.keys(proxy).forEach((k) => console.log(`  ${k.padEnd(20)} →  ${proxy[k].target}`));
  return {
    plugins: [localPortRouter(), react()],
    server: {
      host: true,
      // 与 scanbuy-ui / mqtt-ui 共用 8080 互斥；被占直接报错不漂移
      port: Number(process.env.PORT) || 8080,
      strictPort: true,
      proxy,
    },
  };
});
