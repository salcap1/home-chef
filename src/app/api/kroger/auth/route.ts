import { NextResponse } from "next/server";

import {
  assertHarrisTeeterAllowed,
  isHarrisTeeterDeniedError,
} from "@/lib/kroger/access";
import {
  buildKrogerAuthorizeRedirect,
  validateKrogerOAuthState,
} from "@/lib/kroger/connection";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");

  if (!state) {
    return NextResponse.json({ error: "Missing state" }, { status: 400 });
  }

  const pending = await validateKrogerOAuthState(state);
  if (!pending) {
    return new NextResponse(
      "<html><body><h1>Link expired</h1><p>Go back to Groceries and link Harris Teeter again.</p></body></html>",
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  try {
    await assertHarrisTeeterAllowed(pending.householdId);
  } catch (error) {
    if (isHarrisTeeterDeniedError(error)) {
      return new NextResponse(
        "<html><body><h1>Shop unavailable</h1><p>Harris Teeter Shop is not available on demo kitchens.</p></body></html>",
        {
          status: 403,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        },
      );
    }
    throw error;
  }

  return NextResponse.redirect(buildKrogerAuthorizeRedirect(state));
}
