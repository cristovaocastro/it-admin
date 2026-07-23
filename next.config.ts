import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ldapjs usa reflection em tempo de execução (msg.constructor.name) para identificar
  // tipos de resposta LDAP. O bundler de produção do Next renomeia/minifica classes,
  // quebrando essa reflection ("Cannot read properties of undefined (reading 'toLowerCase')").
  // Mantendo o pacote fora do bundle, ele roda via require() normal do Node, sem minificação.
  serverExternalPackages: ["ldapjs"],
};

export default nextConfig;
