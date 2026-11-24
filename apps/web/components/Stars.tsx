export function Stars({ n }: { n: number }) {
  return <span className="stars" role="img" aria-label={`${n} out of 5 stars`}>{"★★★★★".slice(0, n)}<span className="stars-off">{"★★★★★".slice(n)}</span></span>;
}
