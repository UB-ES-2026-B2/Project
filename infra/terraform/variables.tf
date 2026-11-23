variable "region" {
  description = "Región de AWS de todo el proyecto."
  type        = string
  default     = "eu-west-1"
}

variable "github_oidc_subject_prefix" {
  description = <<-EOT
    Prefijo del claim "sub" del token OIDC de GitHub Actions, con los IDs inmutables:
    <org>@<id de la org>/<repo>@<id del repo>. El sub completo es "repo:<prefijo>:<contexto>"
    (p. ej. ":ref:refs/heads/main", ":pull_request", ":environment:production").
    Los IDs salen de la API: gh api repos/UB-ES-2026-B2/Project --jq '.owner.id, .id'.
    Si el repo se renombra o se recrea, hay que actualizarlo (docs/decisiones.md, D10).
  EOT
  type        = string
  default     = "UB-ES-2026-B2@335691788/Project@1407787603"
}

variable "environments" {
  description = <<-EOT
    Entornos con frontend propio (bucket + CloudFront). La clave es el nombre del entorno.
    Para crear staging, añadir aquí la entrada "staging" (ver infra/README.md).
  EOT
  type = map(object({
    frontend_bucket = string
    comment         = string
    # Puerto del backend del entorno en la EC2. null = la distribución no tiene /api/*.
    api_port = optional(number)
  }))
  default = {
    prod = {
      frontend_bucket = "es-b2-frontend-891377256343"
      comment         = "es-b2 frontend + media"
      api_port        = 8000
    }
  }
}

variable "api_origin_domain" {
  description = "DNS público de la EC2 del backend (IP elástica 34.248.127.190). La EC2 aún no está en Terraform."
  type        = string
  default     = "ec2-34-248-127-190.eu-west-1.compute.amazonaws.com"
}

variable "media_response_headers_policy_id" {
  description = "Response headers policy de /media/*, creada a mano el 2026-11-01 (infra/README.md, Cambios manuales)."
  type        = string
  default     = "cac05561-0e48-4d5f-8d51-6cab623f2615"
}

variable "budget_limit_usd" {
  description = "Límite mensual del presupuesto en USD."
  type        = string
  default     = "20.0"
}
