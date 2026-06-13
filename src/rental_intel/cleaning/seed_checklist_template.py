from __future__ import annotations

from rental_intel.cleaning.db import get_supabase_client


CLIENT_PROPERTY_NAME = "La Peskerezh"
PROFILE_LABEL = "Ménage standard"


CHECKLIST_SECTIONS = [
    {
        "section_key": "premieres_taches",
        "title": "Premières tâches",
        "high_level_check_label": "Premières tâches effectuées",
        "order_index": 10,
        "photo_requirement": "none",
        "detail_items": [
            "Couper les radiateurs",
            "Ouvrir toutes les fenêtres pour aérer",
            "Couper et débrancher tous les appareils, y compris le petit électroménager",
            "Vider le logement des poubelles et du linge sale",
        ],
    },
    {
        "section_key": "sanitaires",
        "title": "Sanitaires",
        "high_level_check_label": "Sanitaires nettoyés et vérifiés",
        "order_index": 20,
        "photo_requirement": "optional",
        "detail_items": [
            "WC, lunette, brosse",
            "Lavabo, douche / baignoire",
            "Bondes d’évacuation vidées",
            "Surfaces vitrées propres",
        ],
    },
    {
        "section_key": "cuisine",
        "title": "Cuisine",
        "high_level_check_label": "Cuisine nettoyée et vérifiée",
        "order_index": 30,
        "photo_requirement": "optional",
        "detail_items": [
            "Frigo vidé et propre",
            "Four et micro-ondes propres",
            "Placards intérieurs / extérieurs vérifiés",
            "Plans de travail propres",
            "Poubelle nettoyée",
        ],
    },
    {
        "section_key": "poussieres_sols",
        "title": "Poussières et sols",
        "high_level_check_label": "Poussières et sols faits",
        "order_index": 40,
        "photo_requirement": "none",
        "detail_items": [
            "TV, meubles, étagères dépoussiérés",
            "Coussins du canapé secoués",
            "Grosses traces sur les vitres enlevées",
            "Aspirateur passé",
            "Serpillière passée",
        ],
    },
    {
        "section_key": "linge",
        "title": "Linge",
        "high_level_check_label": "Linge remis en place",
        "order_index": 50,
        "photo_requirement": "optional",
        "detail_items": [
            "Lits faits",
            "Serviettes de toilette en place",
            "Torchons en place",
            "Linge sale retiré du logement",
        ],
    },
    {
        "section_key": "produits_accueil",
        "title": "Produits d’accueil",
        "high_level_check_label": "Produits d’accueil réapprovisionnés",
        "order_index": 60,
        "photo_requirement": "none",
        "detail_items": [
            "Savon lave-main",
            "Produit vaisselle",
            "2 sacs poubelle",
            "2 pastilles lave-vaisselle",
            "2 pastilles machine à laver",
            "2 rouleaux de papier toilette",
            "Papier film et aluminium",
        ],
    },
    {
        "section_key": "mise_en_place",
        "title": "Mise en place",
        "high_level_check_label": "Mobilier et logement remis en ordre",
        "order_index": 70,
        "photo_requirement": "optional",
        "detail_items": [
            "Mobilier positionné avec soin",
            "Objets remis à leur place",
            "Présentation générale soignée",
        ],
    },
    {
        "section_key": "controle_final",
        "title": "Contrôle final",
        "high_level_check_label": "Logement prêt pour les voyageurs",
        "order_index": 80,
        "photo_requirement": "optional",
        "detail_items": [
            "Toutes les fenêtres fermées",
            "Chauffage coupé",
            "Lumières éteintes",
            "Logement aéré puis refermé",
            "Logement prêt pour l’arrivée des voyageurs",
        ],
    },
]


def get_single_row(result, label: str) -> dict:
    rows = result.data or []
    if not rows:
        raise RuntimeError(f"No row found for {label}")
    if len(rows) > 1:
        print(f"WARNING: multiple rows found for {label}; using first")
    return rows[0]


def main() -> None:
    supabase = get_supabase_client()

    property_row = get_single_row(
        supabase.table("properties")
        .select("id,name")
        .eq("name", CLIENT_PROPERTY_NAME)
        .execute(),
        f"property {CLIENT_PROPERTY_NAME}",
    )

    profile_row = get_single_row(
        supabase.table("property_cleaning_profiles")
        .select("id,label")
        .eq("property_id", property_row["id"])
        .eq("label", PROFILE_LABEL)
        .execute(),
        f"profile {PROFILE_LABEL}",
    )

    existing = (
        supabase.table("cleaning_checklist_templates")
        .select("id,version")
        .eq("property_id", property_row["id"])
        .eq("cleaning_profile_id", profile_row["id"])
        .eq("version", 1)
        .execute()
    )

    if existing.data:
        template = existing.data[0]
        print(f"Checklist template already exists: {template['id']}")
    else:
        template = get_single_row(
            supabase.table("cleaning_checklist_templates")
            .insert(
                {
                    "property_id": property_row["id"],
                    "cleaning_profile_id": profile_row["id"],
                    "name": "Checklist ménage standard - La Peskerezh",
                    "version": 1,
                    "estimated_minutes": 120,
                    "active": True,
                }
            )
            .execute(),
            "inserted checklist template",
        )
        print(f"Created checklist template: {template['id']}")

    for section in CHECKLIST_SECTIONS:
        existing_section = (
            supabase.table("cleaning_checklist_sections")
            .select("id")
            .eq("template_id", template["id"])
            .eq("section_key", section["section_key"])
            .execute()
        )

        payload = {
            "template_id": template["id"],
            **section,
            "required": True,
        }

        if existing_section.data:
            section_id = existing_section.data[0]["id"]
            supabase.table("cleaning_checklist_sections").update(payload).eq(
                "id", section_id
            ).execute()
            print(f"Updated section: {section['section_key']}")
        else:
            supabase.table("cleaning_checklist_sections").insert(payload).execute()
            print(f"Created section: {section['section_key']}")

    print("Checklist seed complete.")


if __name__ == "__main__":
    main()