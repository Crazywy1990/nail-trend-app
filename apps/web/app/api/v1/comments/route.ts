import { NextResponse } from "next/server";
import { sessionUid } from "@/lib/auth";
import { checkText } from "@/lib/moderation";
import { recordEvent } from "@/lib/store";
import { getPost } from "@/lib/store/community";
import { COMMENT_MAX, addComment, commentsToday, deleteComment, getUser } from "@/lib/store/social";

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

/** Add a comment (or a reply). Signed-in with a handle. AI moderation runs first; clean comments go live at once. */
export async function POST(req: Request) {
  const me = await sessionUid();
  if (!me) return bad("Sign in to comment.", 401);
  const user = await getUser(me);
  if (!user?.handle) return bad("Pick your @handle first.", 403);
  const b = (await req.json().catch(() => ({}))) as { postId?: string; body?: string; parentId?: string };
  const body = String(b.body || "").replace(/\s+\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  if (!body) return bad("Write something first.");
  if (body.length > COMMENT_MAX) return bad(`Keep it under ${COMMENT_MAX} characters.`);
  if (/(https?:\/\/|www\.)/i.test(body)) return bad("Comments can't include links.");
  const post = b.postId ? await getPost(b.postId) : null;
  if (!post || post.status !== "approved") return bad("Not found", 404);
  if ((await commentsToday(me)) >= 60) return bad("You've commented a lot today. Try again tomorrow.", 429);
  const verdict = await checkText(body);
  if (verdict === "flagged") return bad("This comment doesn't meet our community guidelines. Please keep it kind.");
  const id = await addComment({ postId: post.id, uid: me, body, parentId: b.parentId || null });
  await recordEvent({ userId: me, type: "comment", postId: post.id, commentId: id });
  return NextResponse.json({ id }, { status: 201 });
}

/** Delete a comment: its author, or the post's author. Body: { id } */
export async function DELETE(req: Request) {
  const me = await sessionUid();
  const b = (await req.json().catch(() => ({}))) as { id?: string };
  if (!me || !b.id) return bad("Sign in first.", 401);
  return (await deleteComment(b.id, me)) ? NextResponse.json({ ok: true }) : bad("Not found", 404);
}
