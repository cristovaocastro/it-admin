import "dotenv/config";
import { loadAdConnectionConfig } from "@/lib/ad/connection";

async function main() {
  const config = await loadAdConnectionConfig("e6910cfe-fb3a-449a-980c-01d75937f238");
  console.log(JSON.stringify({ host: config.host, port: config.port, bindDN: config.bindDN, bindPassword: config.bindPassword, baseDN: config.baseDN }));
}
main();
