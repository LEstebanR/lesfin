// Formats "today" in a specific IANA timezone as a date-only ISO string
// (YYYY-MM-DD), matching how date-only values are stored/compared elsewhere
// in the app (e.g. BudgetItem.date). Used by anything that needs the user's
// "today" rather than the server process's local time.
export function getTodayInTimezone(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}
