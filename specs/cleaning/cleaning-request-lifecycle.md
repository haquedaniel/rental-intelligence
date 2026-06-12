# Cleaning Request Lifecycle

## Purpose

A Cleaning Request represents one cleaning mission linked to a reservation.

Its purpose is to ensure every turnover is:

* assigned
* accepted
* completed
* documented
* visible to the owner

while remaining simple for the cleaner.

---

# Mission Creation

A Cleaning Request is automatically created when:

* a new reservation is received
* a reservation is modified
* a cleaning is manually created by an owner or administrator

The request contains:

* property
* reservation
* departure date/time
* next arrival date/time
* number of guests
* linen required
* laundry required
* estimated cleaning duration
* urgency level
* assigned cleaner
* compensation details

---

# Assignment Logic

Before a mission is sent, the platform must verify that the cleaner is available.

Checks include:

* recurring unavailability (e.g. every Monday)
* temporary unavailability (holidays, appointments, etc.)
* existing accepted missions

If the cleaner is unavailable, the mission is offered directly to another cleaner.

---

# Mission Offer

The mission sent to the cleaner should clearly display:

* property
* date and time
* estimated duration
* cleaning compensation
* travel compensation
* urgency bonus (if applicable)
* total compensation

Example:

Base cleaning: 50 €

Travel compensation: 12 €

Urgency bonus: 7.50 €

Total offered: 69.50 €

The cleaner should know exactly what the mission is worth before accepting.

---

# Statuses

## Created

The mission has been generated but not yet sent to a cleaner.

### Next Step

Send to preferred cleaner.

---

## Sent

The mission has been sent to a cleaner.

### Cleaner Actions

* Accept
* Refuse

### Rules

Urgent mission:

* response required within 3 hours

Normal mission:

* response required within 12 hours

### Notifications

Cleaner:

* WhatsApp notification
* email (optional)

Owner:

* status visible as "En attente de réponse"

---

## Accepted

The cleaner has accepted the mission.

### Result

* mission appears in cleaner calendar
* owner sees "Accepté"
* reassignment workflow stops

### Notifications

Owner notified.

---

## Refused

The cleaner has declined the mission.

### Rules

A refusal reason is mandatory.

Examples:

* déjà engagée ailleurs
* trop loin
* en vacances
* indisponible

### Result

Mission becomes available for reassignment.

### Notifications

Owner/admin alerted.

---

## Expired

The cleaner did not respond before the deadline.

### Result

* request removed from pending missions
* owner/admin alerted
* reassignment may occur

---

## Reassigned

The mission has been sent to another cleaner.

### Rules

* maintain history of previous cleaners contacted
* maintain acceptance/refusal history
* urgency rules continue to apply

---

## In Progress

Cleaner has started the mission.

### Trigger

* cleaner marks mission as started
  or
* cleaner opens report form

### Result

Owner sees:

"Ménage en cours"

### Optional

Record:

* start time
* estimated completion time

---

## Report Submitted

Cleaner has submitted the cleaning report.

### Required

Checklist completed.

Required photos uploaded.

Laundry information completed.

Ready-for-guest confirmation completed.

### Result

If no issue reported:

Move to Completed.

If issue reported:

Move to Problem Reported.

---

## Problem Reported

Cleaner has identified a problem.

### Examples

* damage
* missing item
* excessive dirt
* access issue
* maintenance issue
* laundry shortage
* guest departure problem

### Required

* comment
* photo if relevant

### Notifications

Owner/admin alerted immediately.

### Result

Mission remains visible until resolved.

---

## Completed

Property is ready for guests.

### Result

Owner sees:

"Prêt"

Mission becomes eligible for:

* monthly payment summary
* cleaner statistics
* quality review

### Archive

Store:

* report
* photos
* timestamps
* GPS coordinates if available
* comments

---

## Cancelled

Mission no longer required.

### Triggered By

* reservation cancelled
* owner cancellation
* duplicate mission

### Rules

If cleaner has already accepted:

Owner/admin should manually confirm cancellation.

Potential cancellation fees may be added in future versions.

---

# Urgency

A mission is considered urgent if the next guest arrival occurs within a defined period.

Default:

* urgency threshold: 36 hours
* urgency bonus: +15%

Urgent missions:

* highlighted to cleaner
* highlighted to owner
* response required within 3 hours

Normal missions:

* response required within 12 hours

---

# Alerts

## Owner/Admin Alerts

Send alert when:

* cleaner refuses mission
* cleaner does not respond
* urgent mission remains unaccepted
* report submitted late
* problem reported
* payment not marked as paid by 5th of month

---

## Cleaner Alerts

Send reminder when:

* response deadline approaching
* mission scheduled soon
* report not submitted
* payment request generated

---

# Calendar

Each cleaner has access to a calendar showing:

* accepted missions
* proposed missions awaiting response
* blocked periods
* declared holidays

Owners and administrators can view all missions across all properties.

---

# Property Access Information

Property access information may include:

* key safe codes
* alarm codes
* entry procedures
* parking instructions

Rules:

* visible only to authorised cleaners
* stored within the property profile
* not included in every mission notification
* accessible when required

Experienced cleaners should not be forced to repeatedly retrieve information they already know.

---

# Photo Metadata

Uploaded photos should store:

* timestamp
* GPS coordinates (if available)
* associated property
* associated cleaning request
* uploader

GPS collection remains optional if device permissions are declined.

---

# Cleaner Access

Cleaner adoption is more important than strict security.

Preferred workflow:

WhatsApp notification
→ single click
→ mission opens immediately

Avoid:

* app installation
* repeated logins
* password entry for routine use

The objective is to make accepting and completing a mission take less than one minute.

---

# V1 Simplifications

Included:

* preferred cleaner
* manual reassignment
* WhatsApp notifications
* checklist
* reference photos
* report photos
* payment summaries
* cleaner calendar

Not included:

* AI photo comparison
* automated quality scoring
* public cleaner marketplace
* automated payments
* native mobile application
* advanced performance ratings
