const CN = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];
const SN: Record<string, string> = { m: "万", s: "条", p: "筒" };

export function Tile({
  t, small, dim, back, onClick, title,
}: { t: string; small?: boolean; dim?: boolean; back?: boolean; onClick?: () => void; title?: string }) {
  const cls = `tile ${t[1]}${small ? " sm" : ""}${dim ? " dim" : ""}${back ? " back" : ""}`;
  const face = !back && (
    <>
      <span className="n">{t[1] === "m" ? CN[Number(t[0]) - 1] : t[0]}</span>
      <span className="s">{SN[t[1]]}</span>
    </>
  );
  if (!onClick) return <span className={cls} title={title} style={{ cursor: "default" }}>{face}</span>;
  return (
    <button type="button" className={cls} onClick={onClick} title={title}>
      {face}
    </button>
  );
}
