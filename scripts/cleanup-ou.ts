import "dotenv/config";
import { loadAdConnectionConfig } from "@/lib/ad/connection";
import { deleteOrganizationalUnit } from "@/lib/ad/ou";

async function main() {
  const config = await loadAdConnectionConfig("e6910cfe-fb3a-449a-980c-01d75937f238");
  const dn = `OU=ZZZ-TESTE-ITADMIN-RENOMEADA,${config.baseDN}`;
  console.log("Excluindo", dn);
  await deleteOrganizationalUnit(config, dn);
  console.log("OK, excluída.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("ERRO:", err);
    process.exit(1);
  });
