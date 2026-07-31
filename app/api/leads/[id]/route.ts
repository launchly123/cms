import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError, handleApiError } from "@/lib/http";
import type { LeadStatus } from "@/lib/types";

const STATUSES: LeadStatus[] = ["not_contacted", "in_outreach", "closed", "skipped"];

/**
 * Update the outreach fields on a lead.
 *
 * Only status, notes, and contact name are editable here — the scraped facts
 * (rating, review count, photos, website signal) are owned by the finder's
 * ingestion pipeline, and letting them be edited would mean the next sweep
 * silently overwrites the change.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return apiError(400, "Malformed request body");

    const patch: Record<string, unknown> = {};

    if ("lead_status" in body) {
      if (!STATUSES.includes(body.lead_status as LeadStatus)) {
        return apiError(400, `lead_status must be one of: ${STATUSES.join(", ")}`);
      }
      patch.lead_status = body.lead_status;
    }
    for (const field of ["notes", "contact_name"] as const) {
      if (field in body) {
        const value = body[field];
        if (value !== null && typeof value !== "string") {
          return apiError(400, `${field} must be a string or null`);
        }
        patch[field] = value === "" ? null : value;
      }
    }

    if (Object.keys(patch).length === 0) {
      return apiError(400, "Nothing to update");
    }

    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("businesses")
      .update(patch)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return apiError(404, "Lead not found");

    return NextResponse.json({ lead: data });
  } catch (e) {
    return handleApiError(e);
  }
}
