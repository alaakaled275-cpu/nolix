import crypto from "crypto";

export function generateKeys() {
  return {
    public_key: "pk_zeno_" + crypto.randomBytes(16).toString("hex"),
    secret_key: "sk_zeno_" + crypto.randomBytes(32).toString("hex"),
  };
}
