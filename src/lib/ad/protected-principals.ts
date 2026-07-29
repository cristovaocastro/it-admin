// Sem "server-only": é lógica pura (comparação de string), usada tanto nas mutações do servidor
// (a garantia de segurança de verdade) quanto na UI (pra esconder/desabilitar ações sem precisar
// de round-trip — só UX, a checagem que importa é sempre a do lado do servidor).
//
// Contas e grupos embutidos do Active Directory com privilégio elevado. Este painel nunca pode
// alterar, mover, desativar/excluir esses objetos, nem mudar a lista de membros desses grupos —
// senão um operador (ou uma sessão comprometida) poderia se autopromover a admin de domínio, ou
// travar/trocar a senha da conta Administrator/krbtgt, direto por aqui.
//
// Comparação por nome (sAMAccountName do usuário / cn do grupo), case-insensitive — são os nomes
// padrão de fábrica do AD. Se o domínio renomeou algum desses objetos como prática de hardening,
// ajuste as listas abaixo para os nomes reais.
const PROTECTED_USER_NAMES = new Set(["administrator", "krbtgt"]);

const PROTECTED_GROUP_NAMES = new Set([
  "administrators",
  "domain admins",
  "enterprise admins",
  "schema admins",
  "account operators",
  "backup operators",
  "server operators",
  "print operators",
]);

export function isProtectedAdUserName(sAMAccountName: string | undefined | null): boolean {
  return !!sAMAccountName && PROTECTED_USER_NAMES.has(sAMAccountName.trim().toLowerCase());
}

export function isProtectedAdGroupName(name: string | undefined | null): boolean {
  return !!name && PROTECTED_GROUP_NAMES.has(name.trim().toLowerCase());
}
