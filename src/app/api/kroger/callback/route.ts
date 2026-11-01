import { NextResponse } from "next/server";

import { completeKrogerOAuth } from "@/lib/kroger/connection";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return new NextResponse(
      `<html><body style="font-family: system-ui; max-width: 32rem; margin: 3rem auto; line-height: 1.5;">
        <h1>Authorization cancelled</h1>
        <p>${error}</p>
        <p><a href="/panel/groceries">Back to grocery list</a></p>
      </body></html>`,
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  if (!code || !state) {
    return NextResponse.json(
      { error: "Missing code or state" },
      { status: 400 },
    );
  }

  try {
    const result = await completeKrogerOAuth({ code, stateToken: state });
    return new NextResponse(
      `<html><body style="font-family: system-ui; max-width: 32rem; margin: 3rem auto; line-height: 1.5;">
        <h1>Harris Teeter linked</h1>
        <p>Ready to shop at <strong>${result.locationName}</strong>.</p>
        <p><a href="/panel/groceries">Back to grocery list</a> — use Shop on each Grocery item to add to cart.</p>
      </body></html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to link Harris Teeter.";
    return new NextResponse(
      `<html><body style="font-family: system-ui; max-width: 32rem; margin: 3rem auto; line-height: 1.5;">
        <h1>Link failed</h1>
        <p>${message}</p>
        <p><a href="/panel/groceries">Back to grocery list</a></p>
      </body></html>`,
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }
}
