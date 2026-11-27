// A rule of the domain refused the operation (plan limit, blocked category,
// …). The message is written for the end user, so API layers may show it
// as-is (/api/v1 maps it to 422 BUSINESS_RULE). Any other Error is treated
// as an internal failure and its message is never exposed.
export class BusinessRuleError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BusinessRuleError'
  }
}
