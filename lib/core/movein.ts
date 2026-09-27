/**
 * Moving in (Blueprint v5 §7.2, stage B19): what a new Georgia owner does
 * after the closing, each item pointing at the office that runs it.
 *
 * Only what a public official page says, with the day it was read. Dates
 * that differ by county are not stated as one date: the county's tax
 * commissioner decides, and the item says so. The list changes by editing
 * this file, like the program records (lib/core/assistance.ts).
 *
 * Pure: no I/O.
 */

export interface MoveInItem {
  id: string;
  title: string;
  body: string;
  /** Who does it. */
  who: "you" | "your agent" | "your lender";
  source: { name: string; url: string } | null;
}

export const MOVE_IN_CHECKED = "2026-09-27";

export const MOVE_IN: MoveInItem[] = [
  {
    id: "homestead",
    title: "File for your homestead exemption",
    /* Read from the Department of Revenue on MOVE_IN_CHECKED: ownership on
       January 1 decides the tax year, April 1 is the historic deadline, and
       filing now runs to the end of the 45-day assessment appeal window. */
    body: "If this is your main home, a homestead exemption lowers its taxable value every year you live there. It applies to a tax year only if you owned the home on January 1 of that year, so a home bought this year counts from next year. You apply once, with your county's tax officials, by April 1, or at the latest by the end of the 45-day window to appeal that year's assessment notice.",
    who: "you",
    source: { name: "Georgia Department of Revenue, homestead exemptions", url: "https://dor.georgia.gov/property-tax-homestead-exemptions" },
  },
  {
    id: "utilities",
    title: "Put the utilities in your name",
    body: "Power, gas, water, trash and internet, from the day you take possession. Ask your agent which providers serve the address.",
    who: "you",
    source: null,
  },
  {
    id: "mail",
    title: "Change your address for mail",
    body: "A change of address with the Postal Service forwards mail from your old address while you tell everyone else.",
    who: "you",
    source: { name: "USPS, change of address", url: "https://moversguide.usps.com" },
  },
  {
    id: "license",
    title: "Update your driver's license and vehicle registration",
    body: "Georgia's Department of Driver Services updates the address on a license, and your county tag office the registration.",
    who: "you",
    source: { name: "Georgia Department of Driver Services", url: "https://dds.georgia.gov" },
  },
  {
    id: "escrow",
    title: "Check your first mortgage statement",
    body: "If your loan has an escrow account, the lender pays the property tax and insurance from it. The first statement shows whether it does and what it holds.",
    who: "your lender",
    source: null,
  },
  {
    id: "keys",
    title: "Keys, codes and manuals",
    body: "Garage and gate codes, alarm codes, appliance manuals and warranties. Anything missing, tell your agent: it is easier to get now than in six months.",
    who: "your agent",
    source: null,
  },
];
