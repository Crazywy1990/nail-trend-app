"use server";

import { redirect } from "next/navigation";
import { recordEvent } from "./store";
import { setPostStatus, type PostStatus } from "./store/community";
import { resolveFlag } from "./store/social";

/** Approve or reject a community post from /admin/posts. Requires ADMIN_KEY. */
export async function reviewPost(form: FormData) {
  const key = process.env.ADMIN_KEY;
  const given = String(form.get("key") || "");
  if (!key || given !== key) redirect("/");
  const id = String(form.get("id") || "");
  const decision = String(form.get("decision") || "");
  const status: PostStatus | null = decision === "approve" ? "approved" : decision === "reject" ? "rejected" : null;
  if (id && status) {
    await setPostStatus(id, status);
    await recordEvent({ type: "post_review", postId: id, decision: status });
  }
  const view = String(form.get("view") || "queue");
  redirect(`/admin/posts?key=${encodeURIComponent(given)}&view=${view}#q`);
}

/** Keep or remove a reported comment or review. */
export async function reviewFlag(form: FormData) {
  const key = process.env.ADMIN_KEY;
  const given = String(form.get("key") || "");
  if (!key || given !== key) redirect("/");
  const kind = form.get("kind") === "review" ? "review" : "comment";
  await resolveFlag(kind, String(form.get("id") || ""), form.get("decision") === "keep");
  redirect(`/admin/posts?key=${encodeURIComponent(given)}&view=reported`);
}
