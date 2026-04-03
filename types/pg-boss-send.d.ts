declare module "pg-boss" {
  export default interface PgBoss {
    send<T = unknown>(name: string, data: T): Promise<string>;
  }
}
