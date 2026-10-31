import { BottomNav } from "./BottomNav";

export function ComingNext({ title, body, current }: { title: string; body: string; current: string }) {
  return (
    <div className="shell">
      <main className="main">
        <h1 className="h1">{title}</h1>
        <p className="why">{body}</p>
        <a className="btn btn-primary" href="/" style={{ flex: "none" }}>Back to Discover</a>
      </main>
      <BottomNav current={current} />
    </div>
  );
}
