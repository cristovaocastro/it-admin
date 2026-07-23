// Cria o primeiro usuário administrador do painel, caso ainda não exista nenhum.
// Uso: npm run db:seed
// Pode ser customizado via variáveis de ambiente SEED_ADMIN_NAME / SEED_ADMIN_EMAIL / SEED_ADMIN_USERNAME.

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as argon2 from "argon2";
import { randomBytes } from "crypto";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

function generateTempPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const raw = randomBytes(24).toString("base64url");
  let out = "";
  for (let i = 0; i < 16; i++) out += alphabet[raw.charCodeAt(i % raw.length) % alphabet.length];
  return out;
}

async function main() {
  const existingAdmin = await db.user.findFirst({ where: { role: "ADMIN" } });
  if (existingAdmin) {
    console.log(`Já existe um administrador (@${existingAdmin.username}). Nada a fazer.`);
    return;
  }

  const name = process.env.SEED_ADMIN_NAME || "Administrador";
  const email = process.env.SEED_ADMIN_EMAIL || "admin@example.com";
  const username = process.env.SEED_ADMIN_USERNAME || "admin";
  const tempPassword = generateTempPassword();
  const passwordHash = await argon2.hash(tempPassword, { type: argon2.argon2id });

  const user = await db.user.create({
    data: { name, email, username, role: "ADMIN", passwordHash, mustChangePassword: true },
  });

  console.log("\n=== Administrador inicial criado ===");
  console.log(`Usuário:  ${user.username}`);
  console.log(`E-mail:   ${user.email}`);
  console.log(`Senha temporária: ${tempPassword}`);
  console.log("\nGuarde essa senha agora — ela não será exibida novamente.");
  console.log("No primeiro login será necessário trocar a senha e configurar o MFA.\n");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
