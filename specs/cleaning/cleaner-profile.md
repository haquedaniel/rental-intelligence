# Cleaner Profile

## Purpose

A Cleaner Profile represents a trusted cleaning professional available to perform cleaning missions.

The profile is used to:

* determine availability
* calculate mission compensation
* manage assignments
* manage payments
* maintain quality standards

---

# Identity

## Basic Information

* First name
* Last name
* Phone number
* Email address
* Postal address
* Notes

## Status

* Active
* Temporarily unavailable
* Inactive

---

# Location

## Home Location

Primary working location.

Stored as:

* address
* latitude
* longitude

Used for:

* travel calculations
* assignment recommendations
* territory management

---

# Services Offered

Cleaner may provide one or more services.

Examples:

* Standard cleaning
* Laundry
* Linen replacement
* Inventory checks
* Welcome preparation
* Minor maintenance reporting

Future services may be added.

---

# Compensation

## Standard Cleaning Rate

Preferred model:

Hourly rate.

Example:

15 €/hour

---

## Travel Compensation

Travel compensation is a core feature.

Fields:

* Included travel radius (km)
* Travel rate beyond included radius (€/km)

Example:

Included radius:
10 km

Travel compensation:
0.50 €/km

---

## Urgency Bonus

Optional.

Default:

15%

Applied automatically to urgent missions.

---

# Availability

## Recurring Availability

Used for weekly scheduling.

Example:

Monday:
Unavailable

Tuesday:
Available

Wednesday:
Available

Thursday:
Available

Friday:
Available

Saturday:
Available

Sunday:
Unavailable

---

## Temporary Unavailability

Used for holidays and exceptions.

Examples:

15/08/2026 → 31/08/2026
Holiday

12/09/2026
Medical appointment

22/10/2026 → 24/10/2026
Unavailable

The system should never propose missions during blocked periods.

---

# Preferred Working Area

Optional.

Cleaner may define:

* preferred towns
* preferred zone
* maximum travel distance

Used as a recommendation only.

Owners may still offer missions outside preferred areas.

---

# Property Familiarity

Track previous experience with each property.

Examples:

La Peskerezh
✓ Familiar

Appartement 5
✓ Familiar

Appartement 2
New property

Purpose:

* avoid repeatedly sending access instructions
* improve assignment decisions
* reduce onboarding effort

---

# Payment Information

## Payment Method

Examples:

* Bank transfer
* Payment link
* PayPal
* Revolut
* CESU

---

## Payment Details

Store information required to generate payment requests.

Examples:

* IBAN
* payment URL
* CESU information

Sensitive information must remain private.

---

# Quality Information

## Internal Rating

Visible to owners/admin only.

Used to track:

* reliability
* communication
* quality

Not visible publicly.

---

## Notes

Examples:

* Excellent laundry management
* Prefers larger properties
* Available at short notice
* Has spare linen storage

---

# Calendar

Cleaner has a personal calendar showing:

* proposed missions
* accepted missions
* completed missions
* blocked periods
* holidays

Calendar acts as the primary operational view.


# Legal / Billing Details

## Worker Type

- Individual / informal payment request
- Auto-entrepreneur
- Company
- CESU-compatible

## Billing Details

If auto-entrepreneur or company:

- legal name
- trading name
- SIRET
- business address
- email
- VAT status
- invoice note, e.g. TVA non applicable, art. 293 B du CGI
- payment terms
- IBAN or payment link

If individual / non-registered:

- do not generate invoice
- generate monthly payment request / work summary only

---

# V1 Simplifications

Included:

* location
* availability
* compensation
* travel compensation
* services
* payment method
* property familiarity
* calendar

Not Included:

* public profile
* public reviews
* ranking system
* automatic marketplace matching
* certifications
* performance scoring
