import Link from "next/link";
import { HandAnalyzer } from "@/components/HandAnalyzer";
import { EXTRAS, PATTERNS } from "@/lib/fans";

export const metadata = { title: "算番器 · 川麻记分" };

export default function Calc() {
  return (
    <div className="wrap">
      <Link href="/">← 首页</Link>
      <h1>算番器</h1>
      <p className="muted">拍照或手动输入一手牌：14 张看胡没胡、几番；13 张看听什么、每张能胡几番。</p>
      <HandAnalyzer />
      <h2>番型表</h2>
      <div className="card">
        <table className="lines">
          <tbody>
            {PATTERNS.map((p) => (
              <tr key={p.key}><td>{p.name} <span className="muted">· {p.desc}</span></td><td>{p.fan} 番</td></tr>
            ))}
            <tr><td>清一色 <span className="muted">· 全是一种花色（可叠加）</span></td><td>+2 番</td></tr>
            <tr><td>根 <span className="muted">· 每有 4 张一样的牌（杠或手里 4 张）</span></td><td>+1 番</td></tr>
            {EXTRAS.map((e) => (
              <tr key={e.key}><td>{e.name} <span className="muted">· {e.desc}</span></td><td>+{e.fan} 番</td></tr>
            ))}
          </tbody>
        </table>
        <p className="muted">每家付 = 底分 × 2<sup>番数</sup>（不超过封顶）。例：清对 3 番、清七对 4 番、清龙七对 5 番、十八罗汉 = 金钩钓 + 4 根。</p>
      </div>
    </div>
  );
}
