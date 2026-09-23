/**
 * BONDED-LEADER — mechanical anomaly rules.
 *
 * Every rule below is a disclosed, deterministic computation over public
 * source data (ADR/ECI bond records and MCA21 company filings). Rules record
 * OBSERVED facts (date intervals, amount ratios). They never attribute intent,
 * corruption, or wrongdoing. A triggered flag is a statement of the form
 * "these two disclosed values stand in this arithmetic relationship" —
 * nothing more.
 *
 * Each rule's exact human-readable text is stored verbatim in
 * anomaly_flags.flag_rule_text and displayed in the UI next to the flag.
 * Never show a flag without its rule text.
 */

export interface AnomalyCheckResult {
  triggered: boolean;
  ruleText: string;
  /** The actual number/date that triggered the rule, or NOT_AVAILABLE. */
  computedValue: string;
}

/** Displayed whenever a required source field is missing. Never guess. */
export const NOT_AVAILABLE = "NOT AVAILABLE IN SOURCE DATA";

/**
 * AMBER — Incorporation-timing flag (12-month rule).
 * Triggered when the donor company's MCA21 incorporation date falls within
 * the 12 calendar months preceding the bond purchase date recorded in the
 * ADR/ECI dataset.
 */
export const RULE_INCORPORATION_TIMING_12M =
  "Incorporation-timing flag (12-month rule): triggered when the donor " +
  "company's MCA21 incorporation date falls within the 12 calendar months " +
  "preceding the bond purchase date recorded in the ADR/ECI dataset. " +
  "This flag records the observed date interval only; it is not an " +
  "allegation of wrongdoing.";

/**
 * AMBER — Turnover-ratio flag (50% rule).
 * Triggered when the declared bond donation amount exceeds 50% of the
 * company's most recently disclosed annual turnover, where turnover is
 * itself sourced from a public MCA21 filing.
 */
export const RULE_TURNOVER_RATIO_50 =
  "Turnover-ratio flag (50% rule): triggered when the declared bond donation " +
  "amount exceeds 50% of the company's most recently disclosed annual " +
  "turnover, where the turnover figure is itself sourced from a public " +
  "MCA21 filing. This flag records the observed amount ratio only; it is " +
  "not an allegation of wrongdoing.";

/**
 * RED — Strict combined flag (6-month + 50% rule).
 * Reserved for the strictest, most defensible combination of disclosed
 * facts: triggered ONLY when BOTH (a) the donor company's MCA21
 * incorporation date falls within the 6 calendar months preceding the bond
 * purchase date, AND (b) the donation amount exceeds 50% of the company's
 * most recently disclosed annual turnover from a public MCA21 filing.
 */
export const RULE_STRICT_COMBINED_6M =
  "Strict combined flag (6-month + 50% rule): triggered only when BOTH " +
  "(a) the donor company's MCA21 incorporation date falls within the 6 " +
  "calendar months preceding the bond purchase date recorded in the " +
  "ADR/ECI dataset, AND (b) the donation amount exceeds 50% of the " +
  "company's most recently disclosed annual turnover from a public MCA21 " +
  "filing. This flag records the observed combination of facts only; it " +
  "is not an allegation of wrongdoing.";

/** Flag types stored in anomaly_flags.flag_type. */
export const FLAG_TYPE_INCORPORATION_TIMING = "incorporation_timing";
export const FLAG_TYPE_TURNOVER_RATIO = "turnover_ratio";
export const FLAG_TYPE_STRICT_COMBINED = "strict_combined";

/**
 * Fractional months between two dates (earlier -> later), using the average
 * Gregorian month length. Pure arithmetic; no editorial content.
 */
export function monthsBetween(earlier: Date, later: Date): number {
  const ms = later.getTime() - earlier.getTime();
  return ms / (1000 * 60 * 60 * 24 * 30.436875);
}

function parseDateISO(value: string | null | undefined): Date | null {
  if (value == null || String(value).trim() === "") return null;
  const d = new Date(String(value).trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatINR(amount: number): string {
  return `INR ${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

/**
 * 12-month incorporation-timing check.
 * Missing or unparsable dates -> not triggered, value NOT_AVAILABLE.
 */
export function checkIncorporationTiming12M(
  incorporationDateISO: string | null | undefined,
  donationDateISO: string | null | undefined
): AnomalyCheckResult {
  const incorp = parseDateISO(incorporationDateISO);
  const donation = parseDateISO(donationDateISO);
  if (!incorp || !donation) {
    return {
      triggered: false,
      ruleText: RULE_INCORPORATION_TIMING_12M,
      computedValue: `${NOT_AVAILABLE} (missing or unparsable incorporation/donation date)`,
    };
  }
  const gapMonths = monthsBetween(incorp, donation);
  const computedValue =
    `incorporation ${incorp.toISOString().slice(0, 10)}; ` +
    `donation ${donation.toISOString().slice(0, 10)}; ` +
    `gap = ${gapMonths.toFixed(1)} months`;
  return {
    triggered: gapMonths >= 0 && gapMonths <= 12,
    ruleText: RULE_INCORPORATION_TIMING_12M,
    computedValue,
  };
}

/**
 * 50% turnover-ratio check.
 * Missing turnover -> not triggered, value NOT_AVAILABLE.
 */
export function checkTurnoverRatio50(
  amountInr: number | string | null | undefined,
  annualTurnoverInr: number | string | null | undefined
): AnomalyCheckResult {
  const amount = amountInr == null || amountInr === "" ? NaN : Number(amountInr);
  const turnover =
    annualTurnoverInr == null || annualTurnoverInr === ""
      ? NaN
      : Number(annualTurnoverInr);
  if (!Number.isFinite(amount) || !Number.isFinite(turnover) || turnover <= 0) {
    return {
      triggered: false,
      ruleText: RULE_TURNOVER_RATIO_50,
      computedValue: `${NOT_AVAILABLE} (missing or invalid donation amount / disclosed turnover)`,
    };
  }
  const ratio = amount / turnover;
  const computedValue =
    `donation ${formatINR(amount)}; ` +
    `disclosed annual turnover ${formatINR(turnover)}; ` +
    `ratio = ${(ratio * 100).toFixed(1)}%`;
  return {
    triggered: ratio > 0.5,
    ruleText: RULE_TURNOVER_RATIO_50,
    computedValue,
  };
}

export interface StrictCombinedInputs {
  incorporationDateISO: string | null | undefined;
  donationDateISO: string | null | undefined;
  amountInr: number | string | null | undefined;
  annualTurnoverInr: number | string | null | undefined;
}

/**
 * Strict combined check (RED): 6-month incorporation window AND >50%
 * turnover ratio. Both sub-computations are shown in the computed value.
 */
export function checkStrictCombined6M(
  inputs: StrictCombinedInputs
): AnomalyCheckResult {
  const timing = checkIncorporationTiming12M(
    inputs.incorporationDateISO,
    inputs.donationDateISO
  );
  const ratio = checkTurnoverRatio50(inputs.amountInr, inputs.annualTurnoverInr);

  const missingTiming = timing.computedValue.startsWith(NOT_AVAILABLE);
  const missingRatio = ratio.computedValue.startsWith(NOT_AVAILABLE);
  if (missingTiming || missingRatio) {
    return {
      triggered: false,
      ruleText: RULE_STRICT_COMBINED_6M,
      computedValue: `${NOT_AVAILABLE} (missing incorporation date, donation date, amount, or disclosed turnover)`,
    };
  }

  const incorp = parseDateISO(inputs.incorporationDateISO)!;
  const donation = parseDateISO(inputs.donationDateISO)!;
  const gapMonths = monthsBetween(incorp, donation);
  const r = Number(inputs.amountInr) / Number(inputs.annualTurnoverInr);

  const computedValue =
    `gap = ${gapMonths.toFixed(1)} months (threshold: <= 6); ` +
    `donation-to-turnover ratio = ${(r * 100).toFixed(1)}% (threshold: > 50%)`;
  return {
    triggered: gapMonths >= 0 && gapMonths <= 6 && r > 0.5,
    ruleText: RULE_STRICT_COMBINED_6M,
    computedValue,
  };
}

/**
 * Run all mechanical checks for one donation and return the triggered flags
 * in the shape stored in anomaly_flags (flag_type, flag_rule_text,
 * computed_value). Non-triggered checks are omitted; missing data never
 * fabricates a flag.
 */
export function evaluateAllDonationFlags(inputs: StrictCombinedInputs): Array<{
  flag_type: string;
  flag_rule_text: string;
  computed_value: string;
}> {
  const out: Array<{
    flag_type: string;
    flag_rule_text: string;
    computed_value: string;
  }> = [];

  const t12 = checkIncorporationTiming12M(
    inputs.incorporationDateISO,
    inputs.donationDateISO
  );
  if (t12.triggered) {
    out.push({
      flag_type: FLAG_TYPE_INCORPORATION_TIMING,
      flag_rule_text: t12.ruleText,
      computed_value: t12.computedValue,
    });
  }

  const tr = checkTurnoverRatio50(inputs.amountInr, inputs.annualTurnoverInr);
  if (tr.triggered) {
    out.push({
      flag_type: FLAG_TYPE_TURNOVER_RATIO,
      flag_rule_text: tr.ruleText,
      computed_value: tr.computedValue,
    });
  }

  const strict = checkStrictCombined6M(inputs);
  if (strict.triggered) {
    out.push({
      flag_type: FLAG_TYPE_STRICT_COMBINED,
      flag_rule_text: strict.ruleText,
      computed_value: strict.computedValue,
    });
  }

  return out;
}
