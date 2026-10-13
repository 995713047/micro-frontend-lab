import { useEffect, useState } from 'react';
import { MFE_EVENTS } from '@mfe/shared';
import { emit, navigate, notify, setGlobalState, useMfeState } from './mfe/store';

const TABS = [
  { key: 'overview', label: '概览' },
  { key: 'state', label: '全局状态' },
  { key: 'bus', label: '事件总线' },
  { key: 'host', label: '宿主能力' },
];

/**
 * CSS-in-JS 探针。
 *
 * React 生态里 CSS-in-JS（styled-components / emotion / antd v5）非常常见，
 * 而它们的运行时都是"往 document.head 里插 <style>"。
 * Shadow DOM 能隔离样式的作用域，但拦不住"往哪个 head 插"这件事 ——
 * 到底落在哪，取决于 qiankun 是否把 head 的 appendChild 也代理进了 ShadowRoot。
 *
 * 所以这里放一个探针，切到 strictStyleIsolation 后去 DevTools 里看这条样式的位置。
 */
function CssInJsProbe() {
  useEffect(() => {
    const style = document.createElement('style');
    style.setAttribute('data-probe', 'sub-react-css-in-js');

    // 用属性选择器而不是类名，避免和演示用的同名类混淆
    style.textContent = `
      [data-probe-target="css-in-js"] {
        display: inline-block;
        padding: 5px 10px;
        border-radius: 6px;
        background: #6366f1;
        color: #fff;
        font-size: 12px;
      }
    `;

    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  return <span data-probe-target="css-in-js">CSS-in-JS 运行时注入的样式</span>;
}

export default function App() {
  const mfe = useMfeState();
  const [tab, setTab] = useState('overview');
  const [draft, setDraft] = useState('来自子应用 B 的广播消息');

  const globalState = mfe.globalState || {};
  const count = Number(globalState.count ?? 0);
  const theme = globalState.theme ?? '未知';
  const progress = Math.min(100, Math.abs(count) * 10);

  function changeCount(delta) {
    setGlobalState({ count: count + delta, operator: mfe.appName });
  }

  function broadcast() {
    const text = draft.trim();
    if (!text) return;
    emit(MFE_EVENTS.BROADCAST, { text });
    setDraft('');
  }

  return (
    // data-* 属性供 scripts/verify.mjs 做端到端断言，无副作用
    <div className="sr-root" data-mfe-count={count} data-mfe-connected={String(mfe.connected)}>
      <div className="sr-head">
        <span className="sr-pill">子应用 B</span>
        <span className="sr-pill">React 18</span>
        <span className={mfe.poweredByQiankun ? 'sr-pill' : 'sr-pill sr-pill--warn'}>
          {mfe.poweredByQiankun ? 'qiankun 容器内' : '独立运行'}
        </span>
        <span className={mfe.connected ? 'sr-pill' : 'sr-pill sr-pill--warn'}>
          {mfe.connected ? '已连接主应用' : '未拿到宿主 props'}
        </span>
      </div>

      {/* 故意使用与子应用 A 完全同名的类名，用于样式污染对比 */}
      <div className="mfe-lab-card">
        <h3 className="mfe-lab-title">⚠️ 样式污染演示卡片（子应用 B）</h3>
        <p style={{ margin: '0 0 10px' }}>
          这个卡片用的是 <code>.mfe-lab-card</code>，配色和子应用 A 完全相反。
          「无隔离」模式下两个卡片会被统一成同一种颜色。
        </p>
        <button className="mfe-lab-btn" type="button" onClick={broadcast}>
          通用类名按钮
        </button>
        <button
          className="mfe-lab-btn mfe-lab-btn--ghost"
          type="button"
          style={{ marginLeft: 8 }}
        >
          次要按钮
        </button>
      </div>

      <div className="sr-tabs">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`sr-tab${tab === item.key ? ' is-active' : ''}`}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <div className="sr-kv">
            <span className="sr-kv__key">应用名</span>
            <span className="sr-kv__val">{mfe.appName}</span>
            <span className="sr-kv__key">环境</span>
            <span className="sr-kv__val">{mfe.env}</span>
            <span className="sr-kv__key">主应用版本</span>
            <span className="sr-kv__val">{mfe.mainVersion || '—'}</span>
            <span className="sr-kv__key">挂载点</span>
            <span className="sr-kv__val">#sub-react-root</span>
          </div>
          <p style={{ margin: '0 0 10px' }}>
            我是 React 应用，和 Vue 子应用跑在同一个 qiankun 容器里。
            容器只认 <code>bootstrap / mount / unmount</code> 三个函数，不关心我用什么框架。
          </p>
          <CssInJsProbe />
        </>
      )}

      {tab === 'state' && (
        <>
          <p style={{ margin: '0 0 10px' }}>
            当前全局状态里的 <code>count</code> = <strong>{count}</strong>，来自{' '}
            <code>{globalState.operator || '—'}</code> 的操作。
          </p>
          <div className="sr-row">
            <button
              className="sr-native-btn sr-native-btn--primary"
              type="button"
              onClick={() => changeCount(1)}
            >
              子应用 B count +1
            </button>
            <button className="sr-native-btn" type="button" onClick={() => changeCount(-1)}>
              子应用 B count −1
            </button>
          </div>
          <div
            style={{
              height: 8,
              borderRadius: 4,
              background: '#e0e4fd',
              overflow: 'hidden',
              marginBottom: 10,
            }}
          >
            <div style={{ width: `${progress}%`, height: '100%', background: '#6366f1' }} />
          </div>
          <div className="sr-kv">
            <span className="sr-kv__key">theme</span>
            <span className="sr-kv__val">{theme}</span>
          </div>
          <pre
            style={{
              margin: 0,
              padding: 10,
              borderRadius: 8,
              background: '#fff',
              border: '1px solid #d7dcfb',
              fontSize: 11.5,
              maxHeight: 150,
              overflow: 'auto',
            }}
          >
            {JSON.stringify(globalState, null, 2)}
          </pre>
        </>
      )}

      {tab === 'bus' && (
        <>
          <div className="sr-row">
            <input
              className="sr-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && broadcast()}
              placeholder="输入广播内容"
            />
            <button className="mfe-lab-btn" type="button" onClick={broadcast}>
              广播到三端
            </button>
          </div>
          <p style={{ margin: '0 0 6px' }}>收到的广播（{mfe.busMessages.length} 条）：</p>
          <div className="sr-log">
            {mfe.busMessages.length === 0 && (
              <div style={{ color: '#8b93d6' }}>
                还没有收到消息。可以在主应用或子应用 A 里发一条试试。
              </div>
            )}
            {mfe.busMessages.map((message) => (
              <div key={message.id} className="sr-log__row">
                <span className="sr-pill">{message.from}</span>
                <span style={{ color: '#8b93d6', margin: '0 6px' }}>{message.time}</span>
                {message.text}
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'host' && (
        <>
          <p style={{ margin: '0 0 10px' }}>
            反向调用主应用能力。React 里拿到的是普通函数，直接调即可。
          </p>
          <div className="sr-row">
            <button
              className="sr-native-btn sr-native-btn--primary"
              type="button"
              onClick={() =>
                notify('这条提示是子应用 B 通过 props.mfe.notify 让主应用弹出来的', 'success')
              }
            >
              让主应用弹一个提示
            </button>
            <button className="sr-native-btn" type="button" onClick={() => navigate('/deploy')}>
              让主应用跳到「部署方案」
            </button>
          </div>
          <span className="sr-pill">props.mfe.notify / props.mfe.navigate</span>
        </>
      )}
    </div>
  );
}
