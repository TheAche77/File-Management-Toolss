export interface ServerEnv {
  port: number;
  databaseUrl: string;
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
  };
}
