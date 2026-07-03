import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, handleApiError } from "@/lib/http";
import { parseJson } from "@/lib/validation";
import {
  OWNER_COOKIE,
  checkOwnerPassword,
  createOwnerToken,
  ownerConfigured,
} from "@/lib/ownerAuth";

const schema = z.object({ password: z.string().min(1, "Password is required").max(200) });

export async function POST(req: Request) {
  try {
    if (!ownerConfigured()) {
      return apiError(503, "The owner password hasn't been set up yet.");
    }
    const parsed = await parseJson(req, schema);
    if (parsed.error) {
      return apiError(400, parsed.error.message, parsed.error.issues);
    }
    if (!checkOwnerPassword(parsed.data.password)) {
      return apiError(401, "Wrong password. Please try again.");
    }
    const res = NextResponse.json({ ok: true });
    res.cookies.set(OWNER_COOKIE, await createOwnerToken(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
    return res;
  } catch (e) {
    return handleApiError(e);
  }
}
