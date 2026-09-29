/**
 * Hide local credential controls while configuration is unresolved, but
 * preserve access when the optional OIDC-config request itself fails. The
 * backend remains authoritative and rejects local auth in OIDC-only mode.
 */
export function resolveLocalAuthEnabled(config, configFailed) {
    return config?.local_auth_enabled ?? configFailed;
}
