export interface ServerEnv {
  port: number;
  databaseUrl: string;
  adminApiToken: string;
}

function requireNonEmptyEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} environment variable is required but was not provided.`);
  }

  return value;
}

export function validateServerEnv(): ServerEnv {
  const rawPort = requireNonEmptyEnv("PORT");
  const port = Number(rawPort);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  return {
    port,
    databaseUrl: requireNonEmptyEnv("DATABASE_URL"),
    adminApiToken: requireNonEmptyEnv("ADMIN_API_TOKEN"),
  };
}

export function getConfiguredAdminToken(): string | null {
  const token = process.env["ADMIN_API_TOKEN"]?.trim();
  return token ? token : null;
}
