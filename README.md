# IT Admin

Painel administrativo para o dia a dia de quem cuida do ambiente de TI: cadastro de usuários do
próprio painel com MFA obrigatório, trilha de auditoria completa e gestão de Active Directory
externo (usuários, grupos, senhas).

Stack: **Next.js 16 (App Router, TypeScript) + PostgreSQL (via Prisma 7) + ldapjs**, tudo rodando
como um único processo Node — sem Docker.

## Módulos implementados

1. **Usuários do painel** — cadastro (`/usuarios`), papéis (Administrador / Operador / Auditor),
   bloqueio por tentativas de login, reset de senha e de MFA pelo admin, sessões revogáveis.
2. **MFA (TOTP)** — obrigatório para todo usuário, com QR code de configuração e 10 códigos de
   recuperação de uso único gerados no primeiro login.
3. **Auditoria** (`/auditoria`) — todo login, alteração de usuário, ação em conexão AD ou em
   usuário/grupo do AD é registrado com ator, ação, entidade afetada, IP, user-agent e resultado
   (sucesso/falha).
4. **Active Directory** (`/ad/conexoes`, `/ad/usuarios`, `/ad/grupos`) — cadastro de conexões LDAP
   externas com teste de conectividade, criação/edição/exclusão de usuários AD, reset de senha,
   habilitar/desabilitar/desbloquear conta, criação de grupos e gestão de membros.

## Pré-requisitos

- Node.js 20+ (testado com Node 22)
- PostgreSQL rodando localmente (testado com 16), com um banco e um usuário dedicados

## Configuração inicial

```bash
npm install                # instala dependências (roda `prisma generate` via postinstall)
cp .env.example .env       # preencha DATABASE_URL, SESSION_SECRET e ENCRYPTION_KEY
npm run db:migrate         # cria o schema no banco (primeira vez) — em produção use db:deploy
npm run db:seed            # cria o primeiro usuário ADMIN e imprime a senha temporária
npm run dev                # ambiente de desenvolvimento
```

Neste ambiente o banco e o usuário do Postgres já foram criados (role `itadmin`, banco `itadmin`,
autenticação por senha via TCP em `127.0.0.1:5432`) e o `.env` já está preenchido. O primeiro
administrador já foi criado pelo `db:seed` — veja a saída do comando no terminal para a senha
temporária (ela só é exibida uma vez). No primeiro login o sistema vai pedir para trocar a senha e
configurar o MFA.

### Variáveis de ambiente (`.env`)

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | string de conexão Postgres |
| `SESSION_SECRET` | reservado para uso futuro em assinaturas adicionais — gere com `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | chave AES-256-GCM (base64, 32 bytes) usada para criptografar em repouso a senha de bind do AD e o segredo TOTP dos usuários — gere com `openssl rand -base64 32`. **Perder essa chave torna irrecuperáveis os segredos já salvos** (segredo MFA e senha de bind AD); guarde uma cópia segura (ex: cofre de senhas da equipe). |
| `APP_NAME` / `APP_URL` | usados em textos e no rótulo do MFA no app autenticador |

## Rodando em produção (sem Docker)

```bash
npm run build
npm run db:deploy   # aplica migrations pendentes sem gerar novas (uso em produção)
npm run start        # sobe em produção na porta 3000 (ou $PORT)
```

Exemplo de unit do systemd (`/etc/systemd/system/it-admin.service`):

```ini
[Unit]
Description=IT Admin
After=network.target postgresql.service

[Service]
Type=simple
WorkingDirectory=/opt/it-admin
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/npm run start
Restart=on-failure
User=ubuntu

[Install]
WantedBy=multi-user.target
```

Coloque um reverse proxy (nginx/caddy) na frente para TLS. A aplicação já define cookies de sessão
`secure` automaticamente quando `NODE_ENV=production`.

## Modelo de segurança

- **Senhas**: hash Argon2id. Política mínima: 12+ caracteres, maiúscula, minúscula, número e símbolo.
- **MFA**: TOTP (RFC 6238) via `otplib`, obrigatório para todos. 10 códigos de recuperação de uso
  único (hash Argon2) são gerados na ativação.
- **Sessões**: token opaco aleatório no cookie (`httpOnly`, `secure` em produção, `sameSite=lax`);
  o banco guarda só o hash do token, nunca o valor em claro — permite revogação instantânea (visível
  em "Minha conta" e na ficha de cada usuário do painel).
- **Bloqueio de conta**: 5 tentativas de senha incorretas bloqueiam o login por 15 minutos.
- **Auditoria**: toda ação sensível (login, MFA, CRUD de usuários do painel, CRUD de conexão AD,
  toda operação em usuário/grupo do AD) é gravada em `audit_logs`, sucesso ou falha, com IP e
  user-agent. Nada é excluído automaticamente.
- **Segredos em repouso**: senha de bind das conexões AD e segredo TOTP são criptografados com
  AES-256-GCM (`ENCRYPTION_KEY`) antes de ir para o banco.

## Módulo Active Directory — observações importantes

- A biblioteca LDAP usada (`ldapjs`) é madura e amplamente usada em produção, mas está sem
  manutenção ativa oficial. Toda a integração passa por uma camada própria (`src/lib/ad/`) para
  facilitar troca futura se necessário.
- **Reset/definição de senha exige conexão criptografada** (`LDAPS` ou `StartTLS`) — o Active
  Directory recusa a operação em LDAP puro por design. Conexões `NONE` só servem para leitura/teste.
- A conta de serviço (bind DN) cadastrada na conexão precisa ter permissão delegada no AD para
  criar/alterar usuários e grupos nas OUs configuradas (`usersOU` / `groupsOU`).
- Nenhum dado de usuário/grupo do AD é replicado para o banco local — tudo é consultado ao vivo via
  LDAP a cada tela. O banco local só guarda o cadastro das conexões.

## Papéis

| Papel | Pode |
|---|---|
| **Administrador** | tudo: usuários do painel, auditoria, conexões AD, operações no AD |
| **Operador** | dashboard, usuários e grupos do AD (dia a dia) — não gerencia usuários do painel nem conexões AD |
| **Auditor** | dashboard e trilha de auditoria, somente leitura |

## Estrutura do projeto

```
prisma/schema.prisma          modelo de dados (usuários, sessões, MFA, auditoria, conexões AD)
src/lib/auth/                 login, sessão, senha, MFA
src/lib/audit.ts              gravação da trilha de auditoria
src/lib/crypto.ts             criptografia de segredos em repouso
src/lib/ad/                   cliente LDAP, usuários e grupos AD
src/lib/actions/              Server Actions (mutações), sempre auditadas
src/app/(app)/                área autenticada (dashboard, usuários, auditoria, AD)
src/app/login, /mfa, /conta   fluxo de autenticação e autoatendimento
```

## Próximos módulos sugeridos

- Provisionamento/desprovisionamento automatizado (onboarding/offboarding) cruzando painel + AD
- Inventário de ativos/equipamentos
- Integração com outros diretórios (Google Workspace, Entra ID/Azure AD)
- Notificações (e-mail) para expiração de senha e eventos críticos de auditoria
