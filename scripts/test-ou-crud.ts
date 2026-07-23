import "dotenv/config";
import { loadAdConnectionConfig } from "@/lib/ad/connection";
import {
  listOrganizationalUnits,
  createOrganizationalUnit,
  renameOrganizationalUnit,
  moveOrganizationalUnit,
  deleteOrganizationalUnit,
} from "@/lib/ad/ou";

async function main() {
  const config = await loadAdConnectionConfig("e6910cfe-fb3a-449a-980c-01d75937f238");

  console.log("1. Criando OU de teste na raiz...");
  const dn = await createOrganizationalUnit(config, config.baseDN, "ZZZ-TESTE-ITADMIN-DELETAR", "OU de teste automatizado");
  console.log("   Criada:", dn);

  console.log("2. Renomeando...");
  await renameOrganizationalUnit(config, dn, "ZZZ-TESTE-ITADMIN-RENOMEADA");
  const renamedDn = `OU=ZZZ-TESTE-ITADMIN-RENOMEADA,${config.baseDN}`;
  console.log("   Renomeada para:", renamedDn);

  const ous = await listOrganizationalUnits(config);
  const itOu = ous.find((o) => o.name === "Tecnologia da Informação");
  if (!itOu) throw new Error("OU 'Tecnologia da Informação' não encontrada para teste de mover");

  console.log("3. Movendo para dentro de", itOu.dn);
  await moveOrganizationalUnit(config, renamedDn, itOu.dn);
  const movedDn = `OU=ZZZ-TESTE-ITADMIN-RENOMEADA,${itOu.dn}`;
  console.log("   Movida para:", movedDn);

  console.log("4. Excluindo...");
  await deleteOrganizationalUnit(config, movedDn);
  console.log("   Excluída com sucesso.");

  console.log("\n✅ Ciclo completo OK, nenhum resíduo deixado no AD.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("ERRO:", err);
    process.exit(1);
  });
