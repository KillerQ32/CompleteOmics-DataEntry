import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../lib/supabase/admin";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

type SessionProfile = {
  role: "admin" | "clinic_admin" | "customer";
  company_id: string | null;
};

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export const dynamic = "force-dynamic";

function textResponse(message: string, status: number) {
  return new NextResponse(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

export async function GET(request: NextRequest, context: RouteContext) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return textResponse("You must be signed in to view this document.", 401);
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return textResponse(profileError?.message ?? "Your user profile could not be loaded.", 403);
  }

  const { id } = await context.params;
  const admin = createSupabaseAdminClient();
  const { data: document, error: documentError } = await admin
    .from("patient_documents")
    .select("id, company_id, storage_bucket, storage_path, original_filename")
    .eq("id", id)
    .single();

  if (documentError || !document) {
    return textResponse(documentError?.message ?? "Document could not be found.", 404);
  }

  const typedProfile = profile as SessionProfile;
  if (typedProfile.role !== "admin" && typedProfile.company_id !== document.company_id) {
    return textResponse("You do not have access to this document.", 403);
  }

  const shouldDownload = request.nextUrl.searchParams.get("download") === "1";
  const { data: signedUrlData, error: signedUrlError } = await admin.storage
    .from(document.storage_bucket)
    .createSignedUrl(
      document.storage_path,
      60,
      shouldDownload ? { download: document.original_filename } : undefined,
    );

  if (signedUrlError || !signedUrlData?.signedUrl) {
    return textResponse(signedUrlError?.message ?? "Document URL could not be created.", 500);
  }

  return NextResponse.redirect(signedUrlData.signedUrl);
}
