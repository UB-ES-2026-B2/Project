# Presupuesto mensual de la cuenta. Las alertas se activan rellenando budget_alert_emails.

resource "aws_budgets_budget" "monthly" {
  name              = "es-b2-mensual"
  budget_type       = "COST"
  limit_amount      = var.budget_limit_usd
  limit_unit        = "USD"
  time_unit         = "MONTHLY"
  time_period_start = "2026-10-01_00:00"

  dynamic "notification" {
    for_each = length(var.budget_alert_emails) > 0 ? {
      actual_80      = { type = "ACTUAL", threshold = 80 }
      forecasted_100 = { type = "FORECASTED", threshold = 100 }
    } : {}

    content {
      comparison_operator        = "GREATER_THAN"
      notification_type          = notification.value.type
      threshold                  = notification.value.threshold
      threshold_type             = "PERCENTAGE"
      subscriber_email_addresses = var.budget_alert_emails
    }
  }
}
