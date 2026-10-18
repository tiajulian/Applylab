/** Days after an application is sent, or an interview happens, before "Follow up with ..." shows. */
export const FOLLOWUP_REMINDER_DAYS = 7;

/** A follow-up after an interview only makes sense within about this long; after that it's dropped
 * rather than suggested weeks late ("Your interview was 50 days ago"). */
export const INTERVIEW_FOLLOWUP_MAX_DAYS = 10;

/** Same idea for an application with no reply yet. */
export const APPLIED_FOLLOWUP_MAX_DAYS = 30;

/** After "Went well", the follow-up reminder comes sooner than the default. */
export const GOOD_INTERVIEW_FOLLOWUP_DAYS = 3;

/** After "Not sure yet", the "How did it go?" check-in comes back after this many days. */
export const OUTCOME_RECHECK_DAYS = 3;
