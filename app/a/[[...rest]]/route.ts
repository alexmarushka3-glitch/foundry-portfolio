import { wrapperGone } from "@/lib/server/sharePage";

export const runtime = "nodejs";

// Anything under /a/ that is not /a/<id> or /a/<id>/app (/a, /a/, /a/x/y). Without this, Next's own 404 would answer
// without the sealed headers.

export async function GET() {
  return wrapperGone();
}
