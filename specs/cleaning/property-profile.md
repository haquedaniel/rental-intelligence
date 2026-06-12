# Property Profile

## Purpose

A Property Profile contains all operational information required to prepare a property for guests.

It acts as the single source of truth for owners, cleaners and administrators.

The objective is to avoid repeated explanations, reduce errors and ensure consistent quality.

---

# Identity

## Basic Information

* Property Name
* Portfolio
* Address
* Property Type
* Number of Bedrooms
* Number of Bathrooms
* Maximum Guests

## Status

* Active
* Seasonal
* Inactive

---

# Cleaning Configuration

## Default Cleaning Profile

Default:

* Light
* Standard
* Deep

Most properties will use:

Standard

---

## Available Cleaning Profiles

Example:

Light:
2.0h

Standard:
3.0h

Deep:
5.0h

---

## Laundry Requirements

Options:

* Bed linen replacement
* Towel replacement
* Kitchen linen replacement

Additional notes:

Free text.

---

## Consumables

Items to replenish:

* Toilet paper
* Hand soap
* Dishwashing liquid
* Dishwasher tablets
* Washing machine tablets
* Bin bags

Property-specific items may be added.

---

# Access Information

## Entry Procedure

Examples:

* Key safe
* Physical key
* Smart lock

Instructions:

Free text.

---

## Parking

Free text.

---

## Alarm

Optional.

Instructions visible only to authorised cleaners.

---

## Emergency Contacts

Examples:

* Owner
* Property manager
* Maintenance contact

---

# Cleaning Checklist

Reference:

checklist-menage.md

Property may add additional items.

Examples:

* Empty dehumidifier
* Water plants
* Check hot tub

---

# Reference Photos

Reference photos show the expected state of the property.

Examples:

* Master bedroom
* Bathroom
* Kitchen
* Living room
* Exterior

Purpose:

* cleaner guidance
* quality consistency
* onboarding of new cleaners

---

# Cleaner Assignment

## Preferred Cleaner

Primary cleaner assigned to the property.

---

## Backup Cleaners

Ordered list of alternative cleaners.

Example:

1. Marie
2. Sophie
3. Julie

---

## Property Familiarity

Track which cleaners have already worked at the property.

Purpose:

* reduce onboarding effort
* reduce repeated instructions

---

# Operational Notes

Free text.

Examples:

* Difficult parking in summer
* Guests frequently arrive early
* Linen cupboard is in garage
* Spare key kept by neighbour

---

# Quality Expectations

Property-specific expectations.

Examples:

* Beds must be hotel-style
* Outdoor furniture aligned
* Welcome tray prepared

Should remain high-level.

Avoid micromanagement.

---

# Cost Visibility

Owner should always see:

* selected cleaning profile
* estimated duration
* assigned cleaner
* hourly rate
* travel compensation
* urgency bonus
* estimated total cost

before the mission is sent.

---

# Future Enhancements

Not included in V1:

* AI photo comparison
* automated quality scoring
* stock level management
* maintenance workflows
* dynamic cleaning profile recommendations


# Property Profile — Updates

## Instructions and Attachments

Property instructions may include text, images or attachments.

Examples:

* access photos
* annotated images
* floor plans
* appliance manuals
* linen cupboard photos
* parking diagrams
* owner-specific instructions
* PDF documents

Each instruction or attachment should include:

* title
* description
* file or image
* category
* sensitivity level
* visibility rules

---

# Sensitive Information

Sensitive information is not limited to alarm details.

Any instruction or attachment should be marked sensitive if it contains:

* key safe codes
* key locations
* alarm codes
* smart lock codes
* neighbour access details
* private contact details
* security-sensitive photos

Sensitive information should be:

* visible only to authorised cleaners
* excluded from WhatsApp messages
* stored in the property profile
* accessed only through the web app
* hidden by default where possible

The cleaner should receive a simple mission link by WhatsApp, but access details should not be repeatedly sent in plain text.

---

# Checklist Structure

The checklist should be modular rather than fixed.

A cleaning mission is built from:

1. Standard property checklist
2. Cleaning profile
3. Optional extra task blocks

This allows the system to support light, standard and deep cleans without duplicating the entire checklist.

---

## Light Clean

A Light Clean is a reduced-intensity version of the standard turnover.

Typical use:

* short stays
* low guest count
* property already in good condition
* owner/admin decision

Approach:

* use the standard checklist
* reduce expected duration
* optionally reduce required photos
* keep final quality expectation unchanged

Important:

A Light Clean should not mean lower quality.

It means a simpler reset because less work is expected.

---

## Standard Clean

A Standard Clean is the default turnover.

Approach:

* use the standard property checklist
* use standard reference photos
* require standard completion photos
* prepare property for next guest

---

## Deep Clean

A Deep Clean is not a single fixed checklist.

It is usually:

Standard Clean
+
one or more extra focus areas

Examples of focus areas:

* windows
* oven / kitchen
* bathroom scale removal
* cupboards
* outdoor furniture
* post-damage cleaning
* end-of-season reset

Each focus area should define:

* title
* description
* extra estimated time
* checklist items
* required photos
* owner/admin notes

Example:

Deep Clean Focus Area: Windows

* clean interior windows
* clean window frames
* remove visible salt marks
* upload photo of main window area

Extra estimated time:

1.0 hour

---

# Mission Checklist Generation

When a Cleaning Request is created, the mission checklist is generated from:

Property standard checklist
+
selected cleaning profile
+
selected extra task blocks

Example:

Property:
Appartement 5

Cleaning Profile:
Deep Clean

Extra Task Block:
Windows

Generated mission checklist:

* standard turnover checklist
* windows deep-clean checklist
* required standard photos
* required windows photo

---

# V1 Simplification

For V1:

* Light Clean = standard checklist with shorter estimated duration
* Standard Clean = default checklist
* Deep Clean = standard checklist + manually selected extra task blocks

Automatic recommendation of cleaning profile can come later.
