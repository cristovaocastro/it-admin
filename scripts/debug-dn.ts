import "dotenv/config";
import { loadAdConnectionConfig } from "@/lib/ad/connection";
import { listChildContainers } from "@/lib/ad/tree";

async function main() {
  const config = await loadAdConnectionConfig("e6910cfe-fb3a-449a-980c-01d75937f238");
  const roots = await listChildContainers(config, config.baseDN);
  const farm = roots.find((r) => r.name.startsWith("Farm"));
  if (!farm) throw new Error("not found");
  console.log("name:", farm.name);
  console.log("dn:", farm.dn);
  console.log("dn length:", farm.dn.length);
  console.log("char codes:", [...farm.dn].map((c) => c.charCodeAt(0)).join(","));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
