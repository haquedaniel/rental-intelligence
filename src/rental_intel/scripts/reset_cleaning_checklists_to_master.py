from __future__ import annotations

import argparse
from datetime import datetime, timezone

from dotenv import load_dotenv

from rental_intel.cleaning.db import get_supabase_client

load_dotenv()

MASTER_SECTIONS = [
    {
        "section_key": "premieres_taches",
        "title": "Premières tâches",
        "high_level_check_label": "Premières tâches effectuées",
        "sort_order": 10,
        "photo_requirement": "none",
        "detail_items": [
            "Couper les radiateurs",
            "Ouvrir toutes les fenêtres pour aérer",
            "Couper et débrancher tous les appareils inutiles",
            "Vider le logement des poubelles et du linge sale",
        ],
        "required": True,
        "visible_to_cleaner": True,
        "active": True,
    },
    {
        "section_key": "sanitaires",
        "title": "Sanitaires",
        "high_level_check_label": "Sanitaires propres",
        "sort_order": 20,
        "photo_requirement": "none",
        "detail_items": [
            "WC, lunette et brosse propres",
            "Lavabo, douche ou baignoire propres",
            "Bondes d’évacuation vidées",
            "Surfaces vitrées propres",
        ],
        "required": True,
        "visible_to_cleaner": True,
        "active": True,
    },
    {
        "section_key": "cuisine",
        "title": "Cuisine",
        "high_level_check_label": "Cuisine propre",
        "sort_order": 30,
        "photo_requirement": "none",
        "detail_items": [
            "Frigo vidé et propre",
            "Four et micro-ondes propres",
            "Placards intérieurs et extérieurs vérifiés",
            "Plans de travail propres",
            "Poubelle nettoyée",
        ],
        "required": True,
        "visible_to_cleaner": True,
        "active": True,
    },
    {
        "section_key": "poussieres_sols",
        "title": "Poussières / sols",
        "high_level_check_label": "Sols et surfaces propres",
        "sort_order": 40,
        "photo_requirement": "none",
        "detail_items": [
            "TV, meubles et étagères dépoussiérés",
            "Coussins du canapé secoués",
            "Traces grossières sur les vitres retirées",
            "Aspirateur passé",
            "Serpillière passée",
        ],
        "required": True,
        "visible_to_cleaner": True,
        "active": True,
    },
    {
        "section_key": "preparation",
        "title": "Préparation",
        "high_level_check_label": "Logement préparé",
        "sort_order": 50,
        "photo_requirement": "none",
        "detail_items": [
            "Lits faits si linge prévu",
            "Serviettes de toilette en place",
            "Torchons en place",
            "Produits d’accueil réapprovisionnés",
            "Mobilier repositionné avec soin",
            "Fermer les fenêtres et tout éteindre",
        ],
        "required": True,
        "visible_to_cleaner": True,
        "active": True,
    },
    {
        "section_key": "controle_final",
        "title": "Contrôle final",
        "high_level_check_label": "Logement prêt",
        "sort_order": 60,
        "photo_requirement": "optional",
        "detail_items": [
            "Toutes les fenêtres fermées",
            "Chauffage coupé",
            "Lumières éteintes",
            "Logement aéré puis refermé",
            "Logement prêt pour l’arrivée des voyageurs",
        ],
        "required": True,
        "visible_to_cleaner": True,
        "active": True,
    },
]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--property-id", default=None)
    args = parser.parse_args()

    supabase = get_supabase_client()
    properties_query = supabase.table("properties").select("*").order("name")
    if args.property_id:
        properties_query = properties_query.eq("id", args.property_id)

    properties = properties_query.execute().data or []

    if not properties:
        print("No properties found.")
        return

    print(f"Properties to reset: {len(properties)}")
    for p in properties:
        print(f"- {p.get('name')} ({p.get('id')})")

    if args.dry_run:
        print("\nDRY RUN only. Nothing changed.")
        return

    property_ids = [p["id"] for p in properties]

    # Archive old checklist profiles/templates. Do not delete: safer, recoverable.
    old_profiles = (
        supabase.table("property_cleaning_profiles")
        .select("id")
        .in_("property_id", property_ids)
        .execute()
        .data
        or []
    )
    old_profile_ids = [row["id"] for row in old_profiles]

    old_templates = (
        supabase.table("cleaning_checklist_templates")
        .select("id")
        .in_("property_id", property_ids)
        .execute()
        .data
        or []
    )
    old_template_ids = [row["id"] for row in old_templates]

    if old_profile_ids:
        supabase.table("property_cleaning_profiles").update(
            {"active": False}
        ).in_("id", old_profile_ids).execute()

    if old_template_ids:
        supabase.table("cleaning_checklist_templates").update(
            {"active": False}
        ).in_("id", old_template_ids).execute()

        supabase.table("cleaning_checklist_sections").update(
            {"active": False}
        ).in_("template_id", old_template_ids).execute()

    created = 0

    for property_ in properties:
        property_id = property_["id"]

        profile_result = (
            supabase.table("property_cleaning_profiles")
            .insert(
                {
                    "property_id": property_id,
                    "label": "Ménage standard",
                    "code": "menage_standard",
                    "service_type": "standard_cleaning",
                    "estimated_hours": 2,
                    "sort_order": 10,
                    "default_linen_required": True,
                    "default_laundry_required": True,
                    "active": True,
                }
            )
            .select("*")
            .execute()
        )

        if not profile_result.data:
            raise RuntimeError(f"Profile insert returned no data for property {property_id}")

        profile = profile_result.data[0]

        template_result = (
            supabase.table("cleaning_checklist_templates")
            .insert(
                {
                    "property_id": property_id,
                    "cleaning_profile_id": profile["id"],
                    "name": "Ménage standard",
                    "estimated_minutes": 120,
                    "active": True,
                }
            )
            .select("*")
            .execute()
        )

        if not template_result.data:
            raise RuntimeError(f"Template insert returned no data for property {property_id}")

        template = template_result.data[0]

        supabase.table("cleaning_checklist_sections").insert(
            [{**section, "template_id": template["id"]} for section in MASTER_SECTIONS]
        ).execute()

        created += 1
        print(f"Created master checklist for {property_.get('name')}")

    print(f"\nDone. Created {created} clean master checklist(s).")


if __name__ == "__main__":
    main()
