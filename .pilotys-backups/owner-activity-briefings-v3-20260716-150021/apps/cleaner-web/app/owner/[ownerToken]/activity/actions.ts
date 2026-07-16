"use server";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
async function owner(token:string){const db=getSupabaseAdmin();const {data}=await db.from("owners").select("id").eq("public_token",decodeURIComponent(token)).eq("active",true).maybeSingle();if(!data)throw new Error("Owner not found");return {db,id:data.id};}
export async function saveBriefingPreferences(formData:FormData){
 const token=String(formData.get("owner_token")||""); const {db,id}=await owner(token);
 const propertyIds=formData.getAll("property_ids").map(String);
 const payload={owner_id:id,enabled:formData.get("enabled")==="on",frequency:String(formData.get("frequency")||"morning"),timezone:String(formData.get("timezone")||"Europe/Paris"),delivery_hour:Number(formData.get("delivery_hour")||8),weekly_day:Number(formData.get("weekly_day")||1),recipient_1_phone:String(formData.get("recipient_1_phone")||"")||null,recipient_2_phone:String(formData.get("recipient_2_phone")||"")||null,included_property_ids:propertyIds.length?propertyIds:null,include_reservations:formData.get("include_reservations")==="on",include_cleaning_completed:formData.get("include_cleaning_completed")==="on",include_cleaner_accepted:formData.get("include_cleaner_accepted")==="on",include_cleaner_refused:formData.get("include_cleaner_refused")==="on",include_cleaning_rescheduled:formData.get("include_cleaning_rescheduled")==="on",include_pricing:formData.get("include_pricing")==="on",include_min_stay:formData.get("include_min_stay")==="on",pricing_threshold_type:String(formData.get("pricing_threshold_type")||"pct"),pricing_threshold_value:Number(formData.get("pricing_threshold_value")||2),include_temporal_daily:formData.get("include_temporal_daily")==="on",updated_at:new Date().toISOString()};
 const {error}=await db.from("ops_briefing_preferences").upsert(payload,{onConflict:"owner_id"});if(error)throw error;revalidatePath(`/owner/${encodeURIComponent(token)}/activity`);
}
