"use server";

import { randomUUID } from "crypto";
import { Buffer } from "node:buffer";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const PHOTO_BUCKET = "intervention-report-photos";

function textValue(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function numberValue(formData: FormData, key: string, fallback = 0): number {
  const raw = textValue(formData, key).replace(",", ".");
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function safeFilename(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

async function uploadFile(file: File, prefix: string) {
  const supabase = getSupabaseAdmin();
  const filename = `${Date.now()}-${randomUUID()}-${safeFilename(file.name || "photo.jpg")}`;
  const path = `${prefix}/${filename}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, bytes, {
      contentType: file.type || "image/jpeg",
      upsert: true,
    });

  if (error) {
    throw new Error(`Impossible d’envoyer une photo : ${error.message}`);
  }

  return { bucket: PHOTO_BUCKET, path };
}

export async function submitInterventionReport(formData: FormData) {
  const token = textValue(formData, "token");

  if (!token) throw new Error("Lien mission manquant.");

  const supabase = getSupabaseAdmin();

  const { data: request, error } = await supabase
    .from("cleaning_requests")
    .select("*")
    .eq("public_token", token)
    .eq("mission_type", "intervention")
    .maybeSingle();

  if (error || !request) {
    throw new Error(`Mission introuvable : ${error?.message ?? ""}`);
  }

  const actualHours = numberValue(formData, "actual_hours", Number(request.estimated_hours ?? 0));
  const workSummary = textValue(formData, "work_summary");
  const issueNotes = textValue(formData, "issue_notes");
  const status = textValue(formData, "status") || "completed";

  const proofFiles = formData
    .getAll("proof_photos")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (request.proof_photo_requirement === "required" && proofFiles.length === 0) {
    throw new Error("Une photo est obligatoire pour cette intervention.");
  }

  if (!workSummary) {
    throw new Error("Merci de décrire ce qui a été fait.");
  }

  const now = new Date().toISOString();

  const { data: report, error: reportError } = await supabase
    .from("intervention_reports")
    .upsert({
      cleaning_request_id: request.id,
      status,
      work_summary: workSummary,
      issue_notes: issueNotes || null,
      actual_hours: actualHours,
      updated_at: now,
    }, {
      onConflict: "cleaning_request_id",
    })
    .select("id")
    .single();

  if (reportError) {
    throw new Error(`Impossible d’enregistrer le rapport : ${reportError.message}`);
  }

  for (const file of proofFiles) {
    const uploaded = await uploadFile(file, `${request.id}/proof`);

    const { error: photoError } = await supabase
      .from("intervention_report_photos")
      .insert({
        report_id: report.id,
        cleaning_request_id: request.id,
        bucket: uploaded.bucket,
        path: uploaded.path,
        kind: "proof",
      });

    if (photoError) {
      throw new Error(`Photo envoyée, mais non enregistrée : ${photoError.message}`);
    }
  }

  let materialTotal = 0;

  for (let i = 1; i <= 5; i += 1) {
    const label = textValue(formData, `expense_label_${i}`);
    const amount = numberValue(formData, `expense_amount_${i}`, 0);

    if (!label || amount <= 0) continue;

    materialTotal += amount;

    const { error: expenseError } = await supabase
      .from("intervention_expenses")
      .insert({
        cleaning_request_id: request.id,
        report_id: report.id,
        label,
        amount_eur: amount,
      });

    if (expenseError) {
      throw new Error(`Impossible d’enregistrer les frais : ${expenseError.message}`);
    }
  }

  const hourlyRate = Number(request.hourly_rate_eur_snapshot ?? 0);
  const labourTotal = Math.round(actualHours * hourlyRate * 100) / 100;
  const totalCost = Math.round((labourTotal + materialTotal) * 100) / 100;

  const finalStatus = status === "problem" ? "problem_reported" : "report_submitted";

  const { error: updateError } = await supabase
    .from("cleaning_requests")
    .update({
      status: finalStatus,
      actual_hours: actualHours,
      material_expenses_total_eur: materialTotal,
      total_cost_eur: totalCost,
      updated_at: now,
    })
    .eq("id", request.id);

  if (updateError) {
    throw new Error(`Rapport enregistré, mais mission non mise à jour : ${updateError.message}`);
  }

  redirect(`/mission/${token}/intervention?reported=1`);
}
