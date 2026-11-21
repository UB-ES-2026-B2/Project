# Presupuesto mensual de la cuenta.
#
# Los avisos por correo (50/80/100 % real y 100 % previsto) se configuraron a mano el
# 2026-11-01 y Terraform no los toca: así el correo de quien los recibe no queda en un
# repo público. Para cambiarlos: Billing -> Budgets -> es-b2-mensual -> Alerts.

resource "aws_budgets_budget" "monthly" {
  name              = "es-b2-mensual"
  budget_type       = "COST"
  limit_amount      = var.budget_limit_usd
  limit_unit        = "USD"
  time_unit         = "MONTHLY"
  time_period_start = "2026-10-01_00:00"

  lifecycle {
    ignore_changes = [notification]
  }
}
