import "dotenv/config";
import { loadAdConnectionConfig } from "@/lib/ad/connection";
import { searchAdUsers, updateAdUser } from "@/lib/ad/users";

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`TIMEOUT após ${ms}ms: ${label}`)), ms)),
  ]);
}

async function main() {
  const config = await loadAdConnectionConfig("e6910cfe-fb3a-449a-980c-01d75937f238");

  console.log("Buscando usuário jlrodovalho...");
  const users = await withTimeout(searchAdUsers(config, { query: "jlrodovalho", limit: 5 }), 20000, "search");
  const target = users.find((u) => u.sAMAccountName === "jlrodovalho") ?? users[0];
  if (!target) {
    console.log("Usuário não encontrado, abortando.");
    return;
  }
  console.log("DN alvo:", target.dn);
  console.log("Campos atuais:", {
    displayName: target.displayName,
    givenName: target.givenName,
    sn: target.sn,
    mail: target.mail,
  });

  console.log("\nChamando updateAdUser exatamente como o dialog faria (campos extras em branco)...");
  const start = Date.now();
  try {
    await withTimeout(
      updateAdUser(config, target.dn, {
        displayName: target.displayName,
        givenName: target.givenName,
        sn: target.sn,
        mail: target.mail,
        telephoneNumber: "",
        department: "",
        title: "",
        description: "",
      }),
      20000,
      "updateAdUser"
    );
    console.log(`OK em ${Date.now() - start}ms`);
  } catch (err) {
    console.log(`FALHOU/TIMEOUT em ${Date.now() - start}ms:`, err);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("ERRO GERAL:", err);
    process.exit(1);
  });
