declare module "pg-boss" {
  export type Job<T = unknown> = {
    id: string;
    name: string;
    data: T;
  };

  export type WorkHandler<T = unknown> = (job: Job<T>) => Promise<void> | void;

  export type PgBossOptions = {
    connectionString: string;
    schema?: string;
  };

  export default class PgBoss {
    constructor(options: PgBossOptions);

    start(): Promise<void>;
    stop(): Promise<void>;

    send<T = unknown>(name: string, data: T): Promise<string>;

    on(event: "error", handler: (error: unknown) => void): void;

    work<T = unknown>(name: string, handler: WorkHandler<T>): Promise<void>;

    schedule<T = unknown>(name: string, cron: string, data: T): Promise<void>;
  }
}
