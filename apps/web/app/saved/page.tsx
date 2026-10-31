import { ComingNext } from "@/components/ComingNext";

export const metadata = { title: "Saved" };

export default function Saved() {
  return <ComingNext current="/saved" title="Saved looks" body="Looks you save will collect here. Saving already works on Discover, and this page arrives in the next slice." />;
}
