variable "region" {
  description = "Región de AWS de todo el proyecto."
  type        = string
  default     = "eu-west-1"
}

variable "github_repo" {
  description = "Repositorio de GitHub (org/nombre) en el que confían los roles de OIDC."
  type        = string
  default     = "UB-ES-2026-B2/dev"
}

variable "environments" {
  description = <<-EOT
    Entornos con frontend propio (bucket + CloudFront). La clave es el nombre del entorno.
    Para crear staging, añadir aquí la entrada "staging" (ver infra/README.md).
  EOT
  type = map(object({
    frontend_bucket = string
    comment         = string
  }))
  default = {
    prod = {
      frontend_bucket = "es-b2-frontend-891377256343"
      comment         = "es-b2 frontend + media"
    }
  }
}

variable "budget_limit_usd" {
  description = "Límite mensual del presupuesto en USD."
  type        = string
  default     = "20.0"
}

variable "budget_alert_emails" {
  description = "Emails que reciben las alertas del presupuesto (80 % real y 100 % previsto). Vacío = sin alertas."
  type        = list(string)
  default     = []
}
