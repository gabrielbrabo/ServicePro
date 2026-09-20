# ServiçosPro — Backend

API em tempo real para anúncio e agendamento de serviços.
Stack: **Node.js + TypeScript + Express + MongoDB (Mongoose) + Socket.IO + JWT**

---

## Passo a passo para rodar

### 1. Pré-requisitos

- **Node.js 18+** instalado
- **MongoDB** — escolha uma opção:
  - **Local:** instale o MongoDB Community Server e deixe rodando, ou
  - **Atlas (nuvem, grátis):** crie um cluster em https://www.mongodb.com/atlas e copie a string de conexão

### 2. Instalar as dependências

Na pasta `server`:

```bash
npm install
```

### 3. Configurar o ambiente

Copie o arquivo de exemplo e ajuste os valores:

```bash
cp .env.example .env
```

Edite o `.env`:

- `MONGO_URI` — sua conexão do Mongo (local ou Atlas)
- `JWT_SECRET` — troque por uma string longa e aleatória
- `CLIENT_URL` — a URL do seu frontend (padrão Vite: `http://localhost:5173`)

Gateway de pagamento / assinatura (Asaas) — deixe vazio para rodar em modo
no-op (dev: nada bloqueia). Para ativar:

- `PAYMENTS_PROVIDER` — `asaas` (vazio = desligado)
- `ASAAS_API_KEY` — chave `$aact_...` (Sandbox: `sandbox.asaas.com` → Integrações → Chave de API)
- `ASAAS_BASE_URL` — `https://api-sandbox.asaas.com/v3` (produção: `https://api.asaas.com/v3`)
- `PAYMENTS_WEBHOOK_SECRET` — texto que você inventa e repete no webhook do Asaas

### 4. Popular categorias iniciais (opcional)

```bash
npm run seed
```

### 5. Rodar em desenvolvimento

```bash
npm run dev
```

Se aparecer:

```
✅ MongoDB conectado
🚀 Servidor rodando em http://localhost:3000
```

está tudo funcionando. Teste o healthcheck abrindo http://localhost:3000/health

### 6. Build para produção

```bash
npm run build
npm start
```

---

## Estrutura de pastas

```
server/
├── src/
│   ├── config/        env e conexão com o banco
│   ├── models/        schemas do Mongoose
│   ├── controllers/   lógica das rotas
│   ├── routes/        definição das rotas
│   ├── middleware/    autenticação e erros
│   ├── socket/        Socket.IO (tempo real)
│   ├── utils/         token JWT, seed, notify, searchText, etc.
│   ├── app.ts         montagem do Express
│   └── server.ts      ponto de entrada
├── .env
├── package.json
└── tsconfig.json
```

---

## Endpoints principais

### Autenticação
- `POST /api/auth/register` — `{ name, email, password, phone }`
- `POST /api/auth/login` — `{ email, password }` → retorna `token`
- `GET /api/auth/me` — (requer header `Authorization: Bearer <token>`)

### Categorias
- `GET /api/categories`
- `POST /api/categories` (protegido)

### Serviços (anúncios)
- `GET /api/services?category=&city=&q=` — busca pública
- `GET /api/services/:id`
- `GET /api/services/:serviceId/slots?date=YYYY-MM-DD` — horários livres
- `POST /api/services` (protegido)
- `PUT /api/services/:id` (protegido, só o dono)
- `DELETE /api/services/:id` (protegido, só o dono)

### Disponibilidade
- `PUT /api/availability` (protegido) — `{ slots: [{ dayOfWeek, startMinute, endMinute }] }`
- `GET /api/availability/:providerId`

### Agendamentos
- `POST /api/bookings` (protegido) — `{ serviceId, scheduledAt, notes, address }`
- `GET /api/bookings?role=client|provider` (protegido)
- `PATCH /api/bookings/:id/status` (protegido) — `{ status: "confirmado"|"concluido"|"cancelado" }`

### Estabelecimentos (busca)
- `GET /api/establishments/search?category=&q=&city=&service=&page=&userCity=&userState=&lat=&lng=&radiusKm=`
  — busca pública paginada. **Ordenada por nota ponderada** (ver seção 15);
  proximidade e data são desempate. `lat/lng/radiusKm` filtram por raio
  (geolocalização). `q/city/service` passam pelo `buildSearchRegex` (ver seção 16).
- `GET /api/establishments/:id` — perfil público (inclui `ratingAvg`/`ratingCount`).

### Avaliações (estrelas)
- `GET /api/reviews/public/:establishmentId` — **público**: avaliações para o
  carrossel na página do estabelecimento.
- `POST /api/reviews` (protegido) — `{ bookingId, rating (1..5), comment? }`
  cria/atualiza. **Uma avaliação por (cliente + serviço)**.
- `GET /api/reviews/booking/:bookingId` (protegido) — avaliação do cliente para
  o serviço daquele agendamento (para preencher/editar o modal).
- `GET /api/reviews/establishment/:establishmentId` (protegido, dono/equipe) —
  todas as avaliações (aba "Avaliações" do painel).

---

## Tempo real (Socket.IO)

Conecte enviando o token no handshake:

```js
import { io } from "socket.io-client";
const socket = io("http://localhost:3000", { auth: { token } });

// notificações automáticas:
socket.on("booking:new", (b) => { /* prestador: novo agendamento */ });
socket.on("booking:updated", (b) => { /* mudança de status */ });

// chat por agendamento:
socket.emit("chat:join", bookingId);
socket.emit("chat:message", { bookingId, text: "Olá!" });
socket.on("chat:message", (msg) => { /* ... */ });
```

---

## Notas

- **Datas em UTC:** todos os horários são gravados em UTC. Converta para o fuso local na exibição (frontend).
- **Pagamento:** o modelo `Booking` já tem o campo `payment` preparado. Para processar de verdade, integre **Stripe** ou **Mercado Pago** — não construa processamento de cartão do zero.
- **Conta única:** qualquer usuário pode anunciar (virar prestador) e agendar (virar cliente). Não há papéis fixos.

# ServiçosPro — Contexto do Projeto

> **Leia este arquivo antes de escrever qualquer código.**
> Ele descreve o estado atual da arquitetura, os padrões estabelecidos e as
> decisões já tomadas. Código que ignora estas convenções quebra o que já
> funciona.

---

## 1. O que é

SaaS de agendamento para salões, barbearias, estética e pequenos prestadores
de serviço no Brasil. Um estabelecimento cadastra serviços, equipe e
expediente; clientes agendam horários online.

**Modelo de negócio pretendido:** assinatura mensal (~R$39 plano de entrada),
preço fixo por estabelecimento — **sem cobrar por profissional** (diferencial
frente aos concorrentes).

---

## 2. Stack

**Backend** — `/server`
- Node.js + TypeScript + Express
- MongoDB (Mongoose) — Atlas
- JWT para autenticação (`signToken` / `verifyToken` em `utils/token`)
- Socket.IO para eventos em tempo real
- AWS S3 para imagens (via presigned URL)
- Brevo (API HTTP) para e-mail transacional
- Google OAuth (`google-auth-library`)

**Frontend** — `/client`
- React + TypeScript + Vite
- Tailwind CSS
- React Router
- Axios (instância única em `src/lib/api.ts`)
- `@react-oauth/google`

---

## 3. Regras de trabalho (não negociáveis)

1. **Sempre entregar arquivos completos**, nunca snippets soltos ou trechos
   "adicione aqui". Se o arquivo é longo, entregar mesmo assim.
2. **Nunca escrever código sem conhecer o arquivo atual.** Pedir o arquivo
   antes. Assumir estrutura leva a sobrescrever trabalho feito. **Lição cara:**
   nesta sessão várias correções falharam porque foram baseadas numa versão do
   arquivo diferente da que estava na máquina. Quando algo não bate, pedir o
   arquivo real ANTES de propor conserto — e medir (logs) em vez de adivinhar.
3. **Uma feature completa por vez**, backend + frontend coordenados.
4. Comentários em português, sem acentos (padrão do código existente).
5. Antes de propor mudança em algo que já existe, verificar se a
   funcionalidade já está implementada — várias já estavam.

---

## 4. Convenções de código

### Backend
- Controllers em `src/controllers/*.ts`, um por domínio
- Rotas em `src/routes/*.ts`, registradas em `src/app.ts` via `createApp()`
- Models em `src/models/*.ts`
- Config centralizada em `src/config/env.ts` (objeto `env`)
- Middleware de auth: `protect` injeta `req.userId` (tipo `AuthRequest`)
- Respostas de erro: `res.status(N).json({ message: "..." })`

### Frontend
- Clientes de API em `src/api/*.ts`, importando `api` de `../lib/api`
- Componentes em `src/components/`, páginas em `src/pages/`
- Contextos em `src/context/`
- Paleta Tailwind: `teal-500` (primária), `amber-400` (destaque),
  `ink` (texto), `sand` (fundo), `font-display` (títulos)
- Cantos arredondados: `rounded-xl` / `rounded-2xl`

---

## 5. Modelo de dados — pontos críticos

### Establishment
Dois conceitos **distintos** que costumam ser confundidos:

- **`professionals[]`** — subdocumentos. Profissionais **agendáveis**
  (barbeiro, manicure). Têm `_id` próprio, `name`, `photo`, `specialties`,
  `active`, e **`linkedUser`** (aponta para um `User` quando o profissional
  ganha acesso ao sistema; `null` se não tem login).
- **`members[]`** — quem tem **acesso ao painel**. Cada item tem
  `professional` (ref a `User`), `role: "owner" | "professional"`, `active`.

O elo entre os dois é `professionals[].linkedUser`. Um profissional só vira
"funcionário com login" quando aceita um convite, que preenche `linkedUser` e
adiciona o user em `members[]` com `role: "professional"`.

Também tem: `photo` (foto de perfil/logo) e `coverPhotos[]` (até 6, carrossel).

Campos adicionais:
- **`location`** — GeoJSON Point `[lng, lat]`, com índice `2dsphere` (busca por raio).
- **`ratingAvg` / `ratingCount`** — nota agregada (sistema de avaliação),
  recalculados no `reviewController` a cada avaliação. Ficam no doc para
  cards/busca/perfil lerem a nota sem consultar a coleção de reviews.

### User
- `password` é **opcional** (contas Google não têm senha)
- `authProvider: "local" | "google"`, `googleId`
- `emailVerified`, `emailTokenHash`, `emailTokenExpiry`
- Não existe campo `role` — o papel é derivado do vínculo com o
  estabelecimento, não gravado no user

### Booking
- `professional` guarda o **`_id` do subdocumento** em
  `Establishment.professionals` — **não** é uma ref a uma collection, então
  `populate` normal **não funciona**. O nome é anexado manualmente (ver
  `listBookings`).
- **`clientNotifiedAt`** e **`clientSeenAt`** — usados pelo badge do cliente.
  O estabelecimento agindo (confirmar/cancelar/reagendar) grava
  `clientNotifiedAt`; o cliente abrindo a lista grava `clientSeenAt`. O badge
  conta onde `clientNotifiedAt > clientSeenAt`. **Concluir NÃO gera badge** (o
  cliente esteve presente, já sabe).
- **`reviewed`** — marca que o cliente já foi convidado/avaliou aquele
  atendimento (parte do sistema de avaliação; não pede avaliação de novo).

### Review (sistema de avaliação)
- Campos: `client`, `establishment`, `service`, `booking`, `professional?`,
  `rating` (1..5), `comment?`.
- **Índice único `(client, service)`** — uma avaliação por cliente por serviço.
  Reavaliar sobrescreve a nota daquele serviço.
- Ao criar/atualizar, o `reviewController` recalcula `ratingAvg`/`ratingCount`
  do estabelecimento e notifica o dono/funcionário (`review_received`).

---

## 6. Padrões de permissão

Três padrões distintos, usados conforme a natureza da ação:

| Helper | Quem passa | Onde é usado |
|---|---|---|
| `loadOwnedEstablishment` | só o dono | gerenciar equipe, convites, fotos do estabelecimento |
| `canManage` | dono **ou** membro | galeria, produtos, estoque, disponibilidade |
| `canOperate` | dono **ou** membro ativo | caixa (todos os 6 endpoints) |

Regra geral: **gestão** (equipe, serviços, config) é do dono; **operação**
(agendamentos, caixa, produtos) é do dono ou do funcionário.

### Papel do usuário no frontend
`GET /establishments/mine` retorna, além do estabelecimento:
- `myRole: "owner" | "professional"`
- `myProfessionalId: string | null` — o `_id` do subdoc do funcionário

O `EstablishmentPanel` usa isso para adaptar as abas (funcionário não vê
"Equipe"; em Serviços vê só os que presta, sem criar; em Expediente edita só o
dele).

---

## 7. Upload de imagens (S3)

**Fluxo (presigned URL — o arquivo nunca passa pelo backend):**

1. Front chama `POST /api/uploads/presign` com `{ folder, contentType, size }`
2. Backend devolve `{ uploadUrl, publicUrl, key }`
3. Front faz `PUT` direto no S3 usando `uploadUrl`
4. Front salva a **`publicUrl` completa** no campo do documento

**Importante:** o banco guarda a **URL completa**, não a key.

Pastas permitidas (`ALLOWED_FOLDERS`): `profissionais`, `servicos`,
`estabelecimentos`, `galeria`, `produtos`.

**Componente padrão:** `<ImageUpload value onChange folder label hint />`
(usa `uploadImage(file, folder)` de `src/api/upload.ts`)

### Limpeza de S3 ao remover
Helper `deleteS3ByUrl(url)` / `deleteS3ByUrls(urls)` em `src/config/s3.ts` —
falha silenciosa de propósito (apagar do S3 nunca deve derrubar a operação
principal).

Onde já limpa:
- Galeria: hard delete → apaga `beforeUrl` + `afterUrl`
- Produto: troca de foto → apaga a antiga (soft delete **não** apaga, pois o
  produto pode ser reativado)
- Profissional: troca de foto → apaga a antiga (soft delete não apaga)
- Estabelecimento: perfil e capas → apaga via frontend (`deleteUploadByUrl`)

---

## 8. E-mail (Brevo)

- Enviado via **API HTTP** (`https://api.brevo.com/v3/smtp/email`), **não** SMTP
  e **não** pelo SDK (o SDK deu problemas de tipagem)
- Tudo isolado em `src/config/email.ts` → `sendEmail({ to, subject, html })`
- Nunca lança exceção: falha de e-mail não derruba a operação
- Templates: `inviteEmailHtml`, `verifyEmailHtml`

**Variáveis:** `BREVO_API_KEY`, `EMAIL_FROM_NAME`, `EMAIL_FROM_ADDRESS`

⚠️ **Pendência:** sem domínio verificado no Brevo, o e-mail só chega no
endereço da própria conta Brevo. Em produção é obrigatório verificar um
domínio. Isso agora é crítico: cadastro (verificação) e, em breve, e-mails de
agendamento dependem de e-mail sair de verdade.

⚠️ O Brevo bloqueia IPs não autorizados (painel → Security → Authorized IPs).
IP residencial muda; em produção, autorizar o IP do servidor.

---

## 9. Autenticação

### Local
`POST /api/auth/register` e `/login` → `{ token, user }`.
O front guarda o token em `localStorage` e o `AuthContext` carrega o user via
`GET /api/auth/me`. O `login` e o `googleAuth` também devolvem
**`hasEstablishments: boolean`** — usado para mandar dono/funcionário direto ao
painel após o login. O `login` do AuthContext **retorna o user** para o
chamador decidir o redirect.

### Google OAuth
`POST /api/auth/google` com `{ credential }` (ID token do front).
O backend valida com `google-auth-library`, e:
- Se o e-mail já existe → **vincula** (`googleId`) e marca `emailVerified: true`
- Se não existe → cria conta com `authProvider: "google"`, sem senha, já
  verificada

**Variáveis:** `GOOGLE_CLIENT_ID` (backend, sem prefixo) e
`VITE_GOOGLE_CLIENT_ID` (frontend, com prefixo — regra do Vite). Mesmo valor
nos dois, sem ponto no final.

⚠️ Em produção, adicionar o domínio real nas "Authorized JavaScript origins"
do Google Cloud Console.

### Verificação de e-mail
Cadastro envia link com token (hash SHA-256 no banco, nunca o token cru).
Rota pública `POST /api/auth/verify-email/:token`.
Sem verificar, **nada é bloqueado** — só aparece o `EmailVerifyBanner` com
opção de reenviar. Contas Google já vêm verificadas.

### Convite de funcionário
1. Dono chama `POST /establishments/:id/professionals/:profId/invite` com `{ email }`
2. Backend cria `Invite` (token hasheado, expira em 7 dias), envia e-mail e
   **sempre devolve `inviteUrl`** (para o botão "copiar link" / WhatsApp)
3. Funcionário abre `/convite/:token`, cria senha (ou só vincula se já tem conta)
4. Ao aceitar: preenche `linkedUser`, adiciona em `members[]`, e devolve token
   JWT (entra logado direto)

---

## 10. Acesso público (sem login)

Rotas públicas: `/buscar`, `/estabelecimento/:id`, `/e/:id`,
`/convite/:token`, `/verificar-email/:token`.

O login só é exigido ao **agendar** — nesse momento abre o `AuthModal`
(login/cadastro/Google no próprio lugar, sem sair da página). Depois de
autenticar, a ação pendente é retomada automaticamente.

⚠️ **Detalhe técnico importante:** o `AuthModal` não pode chamar a ação
diretamente no `onSuccess` — o `user` ainda não atualizou nesse render. Usa-se
um `pendingAction` + `useEffect` que dispara quando o `user` chega.

⚠️ **Ordem de rotas:** rotas específicas (ex: `/verificar-email/:token`) devem
vir ANTES do catch-all `<Route path="*">` no `App.tsx`, senão o catch-all
captura tudo antes.

---

## 11. Notificações e tempo real

### Arquitetura (decisão central)
**O banco é a fonte da verdade; o socket é bônus para quem está online.**
Notificações são gravadas na coleção `notifications`. O `emit` do socket só
atualiza a tela na hora para quem está com o app aberto. Quem estava offline
vê o sininho/badge ao logar depois (via consulta ao banco). Ninguém perde nada
por estar offline.

### Model `Notification`
`user, type, title, body, booking, establishment, read, createdAt`.
Tipos: `booking_created`, `booking_confirmed`, `booking_cancelled`,
`booking_rescheduled`, `booking_completed`, **`review_request`** (cliente é
convidado a avaliar, ao concluir), **`review_received`** (estabelecimento
recebeu uma avaliação).

### Helper `utils/notify.ts` (pensado para escala)
- `notifyMany(users[], payload)` — usa **`insertMany`** (uma ida ao banco para
  N destinatários), dedup por `Set`, `ordered:false`
- `notifyManyAsync(users[], payload)` — **fire-and-forget**: não bloqueia a
  resposta HTTP (o usuário não espera a notificação para receber a confirmação)
- `establishmentRecipients(estId, profId)` → `[dono, funcionário vinculado]`
  (busca `linkedUser` do subdoc profissional)

### Emits de socket no bookingController — ATENÇÃO
Os `emit` devem ir para **TODOS os envolvidos**, não só o dono. O padrão certo:

```ts
const recipients = await establishmentRecipients(service.establishment, prof);
const io = getIO();
for (const uid of recipients) {
  io.to(`user:${uid}`).emit("booking:new", booking);
}
```

Para updated/rescheduled, incluir também o cliente:
`new Set([booking.client.toString(), ...estSide])`.

**Bug já corrigido** em `createBooking`, `updateBookingStatus`,
`rescheduleBooking` (emitiam só para o dono → funcionário não atualizava em
tempo real). **AINDA CONFERIR:** `createRecurringBookings`, `cancelSeries`,
`acceptReservation`, `declineReservation` podem ter o mesmo defeito.

### Socket no frontend (`src/lib/socket.ts`)
- `connectSocket()` reconecta se a instância existir mas estiver desconectada
  (chama `socket.connect()`, não devolve socket morto)
- `ensureSocket()` cria a conexão se não existir — usar este, não `getSocket()`,
  em componentes que montam cedo
- Componentes que montam dentro de abas (ex: `BookingList` no painel) devem
  registrar listeners via `ensureSocket()` com re-tentativa, senão perdem a
  janela de conexão

### Endpoints de notificação
- `GET /api/notifications` → `{ items, unread }`
- `PATCH /api/notifications/read` → marca todas como lidas
- `GET /api/notifications/badges` → `{ clientPending, byEstablishment }`
- `PATCH /api/notifications/bookings-seen` → zera o badge do cliente

### Componentes
- `NotificationBell` (sininho na NavBar): dropdown, clicar marca como lido;
  clicar numa notificação de estabelecimento que é seu → vai ao painel
  selecionando aquele estabelecimento na aba "recebidos"; senão → `/agendamentos`.
  **Avaliação:** clicar em `review_request` abre o `ReviewModal` (cliente avalia);
  clicar em `review_received` abre o `EstablishmentReviewsModal` (dono/funcionário
  vê a lista de avaliações).
- Badge em "Agendamentos recebidos" = conta status `pendente` (some ao
  confirmar/cancelar/concluir sem campo de "visto")
- Badge do cliente no link "Agendamentos" = `getBadges.clientPending`

---

## 12. Contextos do frontend

### AuthContext
`user`, `loading`, `login` (retorna User), `register`, `loginWithGoogle`,
`logout`.

### EstablishmentContext
`establishments`, `selected`, `status`, `creating`, **`tab`, `setTab`**,
`select(e, tab?)`, `refresh`, `addLocal`, `startCreating`, `stopCreating`.
- A **aba do painel** vive aqui (`tab`/`setTab`) para que o clique numa
  notificação consiga forçar a troca de aba de fora do `EstablishmentPanel`.
  O tipo `PanelTab` inclui `"avaliacoes"` (aba de avaliações do painel).
- Persiste o último estabelecimento em `localStorage`
  (`servicepro:lastEstablishmentId`) — sobrevive ao reload.
- ⚠️ **Regra crítica:** observa `user?.id` e **recarrega ao trocar de usuário /
  limpa ao deslogar**. Sem isso, a lista de um usuário vaza para o próximo
  login no mesmo navegador (bug real que já aconteceu).

### NotificationContext
`items`, `unread`, `badges`, **`bookingsVersion`**, `refresh`, `markAllRead`,
`markBookingsSeen`.
- `bookingsVersion` é um carimbo que incrementa a cada evento de agendamento
  recebido via socket; o `BookingList` observa esse número e recarrega — cobre
  o caso do socket local não ter registrado o listener a tempo.
- Recarrega ao logar, limpa ao deslogar.

### Seletor de estabelecimento (NavBar)
Dropdown no desktop (topo, com "+ Novo negócio" no fim da lista); no mobile,
lista expandida DENTRO do menu hambúrguer. O switcher só aparece no `/painel`.

---

## 13. Armadilhas conhecidas (React)

- **Estado que não acompanha a prop:** componentes que guardam dados do
  estabelecimento em `useState` precisam de `key={establishment._id}` para
  serem recriados na troca. Sem isso, fotos/dados de um estabelecimento
  aparecem em outro.
- **Capa full-bleed:** o `EstablishmentProfileHeader` usa
  `relative left-1/2 right-1/2 -mx-[50vw] w-screen -mt-8` para furar o
  `max-w-5xl px-4 py-8` do `PageContainer`. **Nada pode vir antes dela** na
  página, senão a capa desce e o efeito quebra. (Por isso o seletor de negócio
  foi para a NavBar, não para cima da capa.)
- `w-screen` pode causar scroll horizontal por causa da scrollbar —
  `html { overflow-x: hidden }` resolve.
- **Modais em portal:** `ReviewModal`, `EstablishmentReviewsModal` e
  `LocationRadiusModal` usam `createPortal(..., document.body)`. Sem isso, o
  `backdrop-blur`/`transform` da NavBar "prende" o `position: fixed` e o modal
  aparece cortado no topo da página (aconteceu de verdade).

---

## 14. Estado atual das features

**Pronto:**
- Estabelecimentos (CRUD, busca paginada com prioridade geográfica, geocoding)
- Serviços, profissionais, expediente (por profissional), bloqueios de horário
- Agendamentos: avulsos, recorrentes, reagendamento, lista de espera com
  reserva automática
- Caixa: abertura/fechamento com relatório congelado, movimentos, venda de
  produto com baixa de estoque, registro de quem abriu/fechou
- Produtos e estoque (com autoria das movimentações)
- Galeria antes/depois
- Fotos: perfil + carrossel de até 6 capas
- Convite de funcionário e painel adaptado por papel
- Acesso público sem login (agendar exige login via AuthModal)
- Verificação de e-mail (banner, sem bloquear)
- Login com Google (Login, Cadastro e AuthModal)
- **Etapa A — Notificações in-app:** sininho com contador, badges nas abas
  (recebidos e agendamentos do cliente), tempo real via socket, clique navega
  ao lugar certo, redirect pós-login por papel, persistência do estabelecimento
  selecionado
- **Etapa B — E-mails de agendamento:** dono/funcionário recebem e-mail ao
  criar; cliente recebe ao confirmar/cancelar/reagendar (helpers em
  `utils/bookingEmails.ts`, fire-and-forget).
- **Carrossel de serviços** na página do estabelecimento (2 linhas, colunas de
  2). Clicar num serviço abre o `BookingModal` já naquele serviço
  (`initialServiceId`) e mostra só os profissionais que o prestam.
- **Busca por raio (geolocalização):** ícone 📍 no campo de cidade →
  `LocationRadiusModal` → `navigator.geolocation` → `lat/lng/radiusKm`.
  Backend filtra com `$geoWithin/$centerSphere` (índice 2dsphere). Exige HTTPS.
- **Busca textual tolerante:** `utils/searchText.ts` (`buildSearchRegex`) —
  trim, colapsa espaços, ignora acentos e escapa/remove metacaracteres de regex
  (^ ~ * ( ) etc). Aplicado em `q`, `city` e `service`.
- **Sistema de avaliações (estrelas):** ver seção 17.
- **Módulos próprios por categoria (Saúde/Beleza/Automotivo), controle de retorno na agenda, plano anual no cadastro e consentimento por procedimento:** ver seção 30.
- **Ordenação da busca por nota ponderada:** ver seção 15.

**Etapa C (depois) — Lembretes agendados:** cliente escolhe antecedência,
recebe e-mail + notificação antes do horário. Requer campo de preferência no
`User` e um job/cron (já existe o job de expiração de reservas como modelo).

**Limpeza pendente (fazer logo):** remover `console.log` de debug em
`bookingController.ts` (`[createBooking]`) e `BookingList.tsx` (`MONTOU`,
`socket.connected`, `listeners registrados`, `evento recebido`).

**Pendências gerais (não urgentes):**
- Verificar domínio no Brevo (bloqueia e-mail em produção)
- Adicionar domínio de produção no Google Cloud Console
- Índice duplicado no Mongoose: em `models/CashSession.ts`, remover a 1ª
  `cashSessionSchema.index({ establishment: 1, status: 1 })`, deixando só a
  versão `unique` com `partialFilterExpression` (cosmético, gera warning)
- Node 20 → 22 (AWS SDK exigirá a partir de 2027)
- **Avaliação:** botão "Avaliar" na lista de agendamentos do cliente (hoje só
  pela notificação `review_request`).
- **Avaliação/índice:** a unicidade mudou de `booking` para `(client, service)`.
  Se um índice antigo `booking_1` sobrar no Mongo e atrapalhar, apagar a coleção
  `reviews` (estava vazia) e reiniciar recria os índices certos.

---

## 15. Ordenação da busca (nota ponderada)

A busca (`searchEstablishments`) ordena por uma **nota ponderada pela
quantidade de avaliações** (shrinkage), calculada no `$addFields` do aggregate:

```
score = (ratingCount / (ratingCount + 5)) * ratingAvg
```

Mais avaliações + média alta ⇒ topo. Poucas avaliações pesam menos; sem
avaliação o score é 0 (vai pro fim). O `5` é a "confiança mínima" (quanto maior,
mais avaliações são precisas para o score se aproximar da média real). O `$sort`
é `{ ratingScore: -1, priority: 1, createdAt: -1 }` — ou seja, a avaliação manda
na posição; proximidade (cidade/estado) e data são só desempate.

---

## 16. Busca textual tolerante (`utils/searchText.ts`)

`buildSearchRegex(raw)` recebe o texto cru do cliente e devolve um padrão de
regex seguro (ou `null` se não sobrar termo útil):
1. tira acentos (NFD), 2. remove símbolos indesejados (^ ~ * ( ) [ ] etc)
trocando por espaço, 3. trim + colapsa espaços internos, 4. escapa
metacaracteres, 5. cada letra base casa suas variantes acentuadas e cada espaço
vira `\s+`. Usado em `q`, `city` e `service` (search e list) com `$options:"i"`.
Evita quebra de busca e ReDoS.

---

## 17. Sistema de avaliações (estrelas)

**Fluxo.** Ao concluir o atendimento, o cliente recebe a notificação
`review_request` ("Avalie o <Nome do estabelecimento>"). **Uma avaliação por
serviço por cliente** — se já avaliou aquele serviço, o `bookingController` não
pede de novo (checa `Review` por `client+service`).

**Avaliar.** O `ReviewModal` (portal no body) tem estrelas 1–5 + comentário
opcional e faz prefill da avaliação existente (permite editar). Ao enviar,
`POST /api/reviews`: upsert por `(client, service)`, recalcula
`ratingAvg`/`ratingCount`, marca `booking.reviewed` e notifica o estabelecimento
(`review_received`).

**Estabelecimento vê.** `review_received` no sino → `EstablishmentReviewsModal`;
ou a **aba "Avaliações"** do painel (`ReviewsManager`) — ambos via
`GET /api/reviews/establishment/:id` (dono/equipe), com foto do cliente, serviço,
estrelas, comentário e data.

**Exibição da nota.** Componente `Stars` (preenchimento proporcional da média)
em `EstablishmentCard`, busca, perfil (`EstablishmentProfileHeader`) e no
**carrossel público** `ReviewsCarousel` (2 linhas), alimentado por
`GET /api/reviews/public/:id`.

**Arquivos.** Backend: `models/Review.ts`, `controllers/reviewController.ts`,
`routes/reviewRoutes.ts` (registrado no `app.ts`). Frontend: `api/review.ts`,
`components/Stars.tsx`, `ReviewModal.tsx`, `EstablishmentReviewsModal.tsx`,
`ReviewsManager.tsx`, `ReviewsCarousel.tsx`.

---

## ⚠️ PENDÊNCIA — WhatsApp (Meta Cloud API)

**Status:** o código está PRONTO e aplicado no projeto. Falta apenas a
configuração da conta na Meta (fora do código) para começar a enviar.

### O que já está feito (código)
- Integração via **Meta Cloud API**, número único do ServiçosPro.
- `utils/whatsapp.ts` (cliente Cloud API, envio de template, fire-and-forget),
  `utils/bookingWhatsapp.ts` (disparos por evento).
- Gatilhos ligados nos MESMOS pontos do e-mail: **confirmação** e
  **cancelamento/remarcação** (`bookingController.ts`) e **lembrete** antes do
  horário (`utils/bookingReminders.ts`).
- Opt-out do cliente: `User.whatsappOptIn` (default true) + checkbox no perfil
  (`ProfilePage`). Só envia se o cliente tem telefone e não deu opt-out.
- Enquanto as variáveis do `.env` estiverem vazias, NADA é enviado (no-op) —
  não quebra nada.

### O que falta (conta Meta — do lado do dono)
1. Conta Meta + app de desenvolvedor (developers.facebook.com) já criados.
2. **Bloqueio encontrado:** a Meta NÃO ofereceu o "número de teste" grátis para
   este app ("Nenhum número de telefone disponível para este app" / botão
   "Reivindicar número de teste" não gera nada). Isso é limitação atual da Meta,
   não é bug do sistema.
3. **Caminho que resta (Etapa 2 — Configuração da produção):** registrar um
   **número real dedicado** (um chip/número que NÃO esteja em uso no WhatsApp
   comum — não usar o número pessoal, senão perde o WhatsApp dele). Funciona já
   antes da verificação completa, com limite de destinatários para teste.
4. Fazer a **verificação da empresa** (CNPJ) para produção sem limites + adicionar
   forma de pagamento.
5. Criar e aprovar **4 templates** (categoria Utility, pt_BR, 3 variáveis:
   {{1}} estabelecimento, {{2}} serviço, {{3}} data/hora):
   `agendamento_confirmado`, `agendamento_cancelado`, `agendamento_remarcado`,
   `lembrete_agendamento`.
6. Pegar o **token permanente** (Business Settings → System Users) e o
   **Phone Number ID**, e preencher o `.env`:

```
WHATSAPP_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_API_VERSION=v21.0
WHATSAPP_TEMPLATE_LANG=pt_BR
WHATSAPP_TEMPLATE_CONFIRMED=agendamento_confirmado
WHATSAPP_TEMPLATE_CANCELLED=agendamento_cancelado
WHATSAPP_TEMPLATE_RESCHEDULED=agendamento_remarcado
WHATSAPP_TEMPLATE_REMINDER=lembrete_agendamento
```

Depois de preencher, reiniciar o server. Guia visual do passo a passo foi gerado
à parte (checklist "Ligar o WhatsApp").

---

## 28. Recursos clínicos (frontend — área Saúde)

O painel esconde/mostra abas por **módulo da área** via `hasModule(segment, mod,
categorySlug)` (`lib/segments.ts`, espelho do backend). **Veterinária removida.**

### Prontuário (`components/ProntuarioManager.tsx`)
Lista pacientes → ficha do paciente com sub-abas (só as liberadas):
**Prontuário** (anamnese), **Evolução**, **Linha do tempo**, **Plano de
tratamento**, **Documentos**, **Odontograma**, **Periograma**, **Fisioterapia**.

- **Evolução SOAP + CID-10** (`components/Evolutions.tsx`, `api/evolution.ts`):
  formulário S/O/A/P + data + vínculo opcional a atendimento; seção **CID-10**
  com autocomplete de `lib/cid10.ts` (base reduzida + entrada livre); notas
  antigas (formato livre) exibidas só leitura.
- **Documentos** (`components/PatientDocuments.tsx`, `api/emittedDocument.ts`):
  atestado, declaração, **receita estruturada** (tipo comum/controle especial/
  B/A + medicamentos com posologia) e **pedido de exame**. Botões **"Baixar PDF"**
  (gera no servidor), **"Imprimir"** e **"Assinar digitalmente"** (ver seção 29).
- **Fisioterapia** (`components/PhysioPanel.tsx`, `api/physio.ts`): abas
  **Pacotes de sessões** (barra de saldo, registrar/estornar sessão) e
  **Avaliações** (EVA 0-10 colorido, ADM, força, objetivos). Gated pela categoria
  fisioterapia.
- **Periograma** (`components/Periograma.tsx`, `api/periogram.ts`): mapa FDI
  colorido pela maior PS + editor por dente (6 sítios: PS/REC/NIC/sangramento,
  mobilidade, furca) + resumo (sítios PS≥4, BOP%). Categoria odontologia.
- **Odontograma → plano** (`components/Odontograma.tsx`): botão "Adicionar ao
  plano de tratamento" (usa `api/treatmentPlan.ts`, cria/usa plano aberto).

### Galeria (todas as áreas)
`GalleryManager`/`GallerySection`: além de **antes/depois**, agora aceita
**foto normal**; os dois tipos aparecem misturados no mesmo carrossel público.

### Aviso "sem serviço cadastrado"
`lib/coverage.ts` (`useCoverageAlerts` expõe `noServices`) + `EstablishmentPanel`:
selo "!" âmbar na aba **Serviços** quando o estabelecimento ainda não tem nenhum
serviço (igual ao aviso do Expediente).

---

## 29. Assinatura digital ICP-Brasil (frontend)

Em **Documentos**, o botão **"Assinar digitalmente"** envia o documento para
assinatura (Clicksign) — há um campo **"E-mail de quem vai assinar"** (editável,
validado). No histórico, o documento mostra o selo de status:
- **Aguardando assinatura** — o app consulta o status sozinho (`refreshSignature`,
  1 doc por vez a cada 6s, para não estourar o limite do Clicksign) até virar
  assinado; há também o botão "Atualizar status".
- **✓ Assinado** — botão **"ver PDF assinado"** que busca um **link fresco na
  hora** (`documentApi.signedPdf`, o link do Clicksign expira em ~5 min) e abre o
  PDF assinado (com a página de assinaturas/manifesto).

`api/emittedDocument.ts` expõe `pdf`, `sign`, `refreshSignature`, `signedPdf`.
Configuração e detalhes do provedor: ver o README do backend (seção 29).


---

## 30. Módulos por categoria + retorno na agenda + cadastro (atualizações recentes)

Cada **módulo extra** é liberado por **categoria** em
`CATEGORY_EXTRA_MODULES` (`config/segments.ts`, espelhado em
`client/src/lib/segments.ts`) e vira uma aba no painel via
`hasModule(segment, mod, categorySlug)`. Padrão de cada módulo:
`models/<X>Profile.ts` + modelo(s) datado(s) → `controllers/<x>Controller.ts`
→ `routes/<x>Routes.ts` (com `requireModule("<key>")`) → `api/<x>.ts` →
`components/<X>Manager.tsx` (lista de pacientes/clientes via
`recordApi.clients` → painel com abas). Só cria ficha para cliente que já tem
booking no estabelecimento (`clientHasBooking`).

### Saúde — novos módulos próprios
- **Nutrição** (`nutricao`) — rota `/api/nutrition`. Antropometria
  (peso/altura, **IMC + classificação OMS**, %gordura, **RCQ**, massa gorda/magra,
  circunferências) com **evolução (gráfico SVG)** e comparação; **plano alimentar
  por refeição** (kcal/macros, subtotais e total do dia, vs. meta) + **metas** +
  **PDF do plano**. Arquivos: `NutritionProfile`, `NutritionAssessment`,
  `NutritionPlan`, `nutritionController`, `utils/nutritionPlanPdf`, `api/nutrition.ts`,
  `NutricaoManager.tsx`.
- **Podologia** (`podologia`) — `/api/podiatry`. **Mapa do pé** (SVG esquerdo/direito
  × dorsal/plantar) com achados por região (calo, micose, onicomicose, unha
  encravada, fissura…), **procedimentos**, **antes/depois** e **PDF do atendimento**.
- **Enfermagem** (`enfermagem`) — `/api/nursing`. **Sinais vitais** (PA/FC/FR/Temp/
  SpO₂/glicemia/dor com **faixas e destaque fora do normal** + gráfico), **curativos**,
  **medicação/vacina** (via, local, lote, validade) e aba **Retornos** (agenda).
- **Dermatologia** (`dermatologia`) — `/api/dermatology`. **Mapa do corpo** (frente/
  costas) de lesões/pintas com tipo, tamanho (mm), cor e **critérios ABCDE**;
  **acompanhamento por região**; antes/depois; **próxima visita** (agenda).
- **Quiropraxia** (`quiropraxia`) — `/api/chiropractic`. **Avaliação postural
  estruturada** (cabeça/ombros/pelve/curvaturas/escoliose) + **registro de ajustes**
  (segmento/técnica/lado) + **EVA** (gráfico) + próxima visita (agenda).
- **Acupuntura** (`acupuntura`) — `/api/acupuncture`. **Pontos aplicados por sessão**
  (ponto com autocompletar, lado, método: agulha/moxa/eletro/ventosa/auricular/laser,
  estímulo), retenção, **EVA** (gráfico) + próxima visita (agenda).
- **Personal** (`personal`) e **Prontuário** ganharam a aba **Retornos** (agenda).

### Controle de retorno integrado à agenda — `components/ReturnScheduler.tsx`
Componente **reutilizável**: escolhe serviço + profissional + data, mostra **só
horários livres** (`scheduleApi.freeSlots(serviceId, date, prof, null, admin=true)`)
e **agenda o retorno para o próprio paciente/cliente**; lista os próximos e cancela.
Backend: `createBooking` ganhou um branch — quando vem `clientId` e o requisitante é
**dono/equipe** do estabelecimento, agenda **para aquele cliente** já como
`confirmado` (`schedule.ts` `createBooking` aceita `clientId`). Nenhum modelo novo:
usa a própria agenda/`Booking`.
Presente em: podologia, dermatologia, quiropraxia, acupuntura (dentro do atendimento,
"Próxima visita"); enfermagem, personal, nutrição, **prontuário** (cobre odonto/
clínica/fisioterapia) e **Ficha do cliente da Beleza** (aba "Retornos"). As categorias
de **serviços** (veículo, obra, foto, aulas, OS…) usam o reagendamento normal da agenda.
Observação: a **ficha clínica** (psico/fono) usa nome/telefone livres (sem cliente
agendável), então mantém só "Retorno previsto" como data.

### Beleza — consentimento por procedimento
`client/src/lib/consentTemplates.ts`: **19 modelos** de termo agrupados por categoria
(estética facial/corporal, depilação, micropigmentação, cílios & sobrancelhas, tatuagem,
bronzeamento, imagem, geral). Seletor **"Modelo por procedimento"** na aba
**Consentimento** (`FichaBelezaManager`) preenche tipo/título/texto — **editável** antes
de salvar. Sem mudança de backend (o `ConsentTerm` guarda título + conteúdo). Os textos
são **modelos editáveis, não substituem orientação jurídica**.

### Automotivo — carros **e motos**
Módulo `veiculo` (oficina-mecânica, lava-rápido, estética-automotiva; chaveiro): a OS
(`ServiceOrder`) ganhou `vehicle.type` (`carro` | `moto`). No formulário há **seletor
Carro/Moto**; o **checklist padrão** troca conforme o tipo (moto: relação/corrente, freios
dianteiro/traseiro, vela, filtro de ar, garfo…), com **troca inteligente** (só substitui se
o checklist ainda estiver intacto) e botão **"Checklist padrão"**. O tipo aparece no **PDF
da OS** (`utils/serviceOrderPdf.ts`). Arquivos: `models/ServiceOrder.ts`,
`controllers/serviceOrderController.ts` (`sanitizeVehicle`), `api/serviceOrder.ts`,
`components/OrdemServicoManager.tsx`.

### Cadastro e edição do estabelecimento
- **Plano anual (2 meses grátis)** no cadastro: seletor **Mensal/Anual** em
  `EstablishmentForm`; anual = **10× a mensalidade** da área, mostra valor/ano,
  equivalente/mês e a economia. Salvo em `Establishment.billingCycle`
  (`"mensal" | "anual"`, padrão `mensal`) — pronto para o futuro sistema de cobrança.
- **Editar estabelecimento** reorganizado em seções + **troca de categoria** somente
  entre categorias da **mesma área** (validado no `updateEstablishment`; a área/segment
  não muda na edição).

> Pendência sugerida: seed/migração para gravar `segment` nas categorias antigas de
> Saúde (hoje o front cai no mapa por slug em `CATEGORY_SEGMENT` quando o campo do banco
> está vazio).

## 31. Assinatura e gateway de pagamento (Asaas)

Cada **estabelecimento** assina o ServiçosPro. O **plano é a própria área**
(não há "Essencial/Saúde"): o preço vem de `SEGMENTS[...].priceMonthly` em
`config/segments.ts` — Serviços gerais e Beleza **R$ 69/mês**, Saúde
**R$ 159/mês**; **anual = 10× a mensalidade** (2 meses grátis).

### Arquitetura (gateway-agnóstica)

Toda a parte específica do gateway fica atrás de uma interface, num único
adapter — trocar/adicionar gateway não mexe no resto:

- `services/payments/types.ts` — contrato `PaymentProvider`
- `services/payments/noop.ts` — modo dev (sem gateway configurado, tudo "active", nada bloqueia)
- `services/payments/asaas.ts` — adapter do Asaas
- `services/payments/index.ts` — fábrica (`getPaymentProvider()` escolhe por `PAYMENTS_PROVIDER`)
- `config/plans.ts` — planos derivados de `SEGMENTS` (id = segmento; preço em centavos)
- `models/Subscription.ts` — 1 assinatura por estabelecimento
- `middleware/requireActiveSubscription.ts` — guard opcional para rotas pagas
- `utils/subscriptionActive.ts` — `isEstablishmentActive(estId)` (usado no bloqueio de agendamentos)

`Subscription`: `status` (`none | trialing | active | past_due | canceled`),
`planId` (= segmento), `billingCycle`, `priceCents`, `provider*Id`,
`currentPeriodEnd`, `cancelAtPeriodEnd`, `cardLast4`/`cardBrand`, idempotência
via `lastEventId`.

### Fluxo de cobrança

- **Cadastro em 3 etapas** (`EstablishmentForm`): 1) área → 2) plano
  (mensal/anual) + método (PIX/Cartão) + CPF/CNPJ + e-mail → 3) dados do
  negócio. Ao finalizar, cria o estabelecimento **e** a assinatura.
- **Cartão**: formulário no app (número, validade, CVV, titular + CEP, nº,
  telefone — exigidos pela operadora); o Asaas cobra na hora → assinatura
  **ativa imediatamente** e o cartão fica **salvo** (tokenizado) para a
  recorrência mensal. ⚠️ os dados do cartão passam pelo backend → escopo PCI.
- **PIX**: mostra o **QR Code + copia-e-cola direto no app** (não abre a fatura,
  que às vezes exibia boleto). A tela **verifica sozinha** (auto-poll) e libera
  assim que o pagamento cai. `getSubscriptionPix` busca o QR da cobrança
  pendente para exibir no painel mesmo quando a assinatura foi criada no cadastro.
- **Fonte da verdade** é o **webhook** (`POST /api/webhooks/payments`, validado
  pelo header `asaas-access-token` = `PAYMENTS_WEBHOOK_SECRET`, idempotente).
  O `app.ts` guarda o `rawBody` no `express.json`. Em dev/sem webhook público,
  o endpoint `refresh` (auto-poll) consulta o Asaas direto e supre o webhook.

### Cancelamento e reativação (sem desperdício)

- **Cancelar** não deleta: usa `endDate` no Asaas (para de renovar) e o cliente
  **mantém acesso até o fim do período já pago**. Pede confirmação na UI.
- **Reativar** volta a renovar **sem cobrar de novo** (novo `nextDueDate` = fim
  do período atual).
- **Anti-dupla-assinatura**: o backend recusa (409) assinar de novo se já há
  assinatura ativa; se estiver cancelada-mas-vigente, orienta usar **Reativar**.

### Quando a assinatura vence (não renova)

- **Painel bloqueado**, deixando acessível **só a aba Agendamentos** (ver os
  existentes) e **Minha assinatura** (renovar) — `EstablishmentPanel` filtra as
  abas e força `recebidos` (`ALLOWED_WHEN_BLOCKED`).
- **Notificações e e-mails de lembrete de horário continuam** (não são
  bloqueados) — o dono segue avisado dos horários.
- **Novos agendamentos bloqueados** no backend (`createBooking`,
  `createRecurringBookings`, `createStudentEnrollment` → 403 via
  `isEstablishmentActive`).
- **Link público** mostra "Indisponível para agendamento": `getEstablishment`
  retorna `bookingEnabled`; `EstablishmentPage` desabilita o botão e avisa.

### Endpoints

- `GET  /api/subscriptions/plans` — catálogo de planos (por área)
- `GET  /api/subscriptions/:est` — assinatura (dono)
- `GET  /api/subscriptions/:est/status` — status leve (dono ou membro; usado no paywall)
- `POST /api/subscriptions/:est` — assinar (planId = segmento; PIX/cartão)
- `POST /api/subscriptions/:est/cancel` — cancelar (no fim do período)
- `POST /api/subscriptions/:est/reactivate` — reativar (sem cobrar de novo)
- `POST /api/subscriptions/:est/refresh` — consulta status no gateway (fallback do webhook)
- `GET  /api/subscriptions/:est/pix` — QR/copia-e-cola do PIX da cobrança pendente
- `POST /api/webhooks/payments` — webhook do Asaas (sem auth de usuário)

### Testes no sandbox

- **Cartão aprovado**: qualquer cartão fictício válido (ex.: `4111 1111 1111 1111`),
  validade futura, CVV `123`. **Recusado**: `5184 0197 4037 3151`.
- **PIX**: no painel do Asaas (Cobranças), "Confirmar recebimento em dinheiro"
  para simular o pagamento; em produção o banco confirma sozinho.

> Pendências: configurar o **webhook do Asaas** apontando para o backend em
> produção (Render) para o PIX ficar instantâneo sem auto-poll; marcar
> "indisponível" também na **busca** (`SearchPage`, hoje só na página do
> estabelecimento); cartão parcelado/outras bandeiras; rodar `tsc --noEmit`.


## 32. Pagamentos cliente ↔ estabelecimento (sinal e serviço)

Além da assinatura (receita da plataforma), o **cliente paga o estabelecimento**
pelo app: o **sinal** de um agendamento e o **serviço** concluído. A plataforma
**não cobra %** — o dinheiro vai para o estabelecimento; ele arca com a taxa do
Asaas.

### Recebimentos (subconta Asaas por estabelecimento)

- Aba **Recebimentos** (`ReceivablesManager`): o dono cadastra a **subconta**
  (CPF/CNPJ, e-mail, celular, CEP, faturamento; PF `birthDate` / PJ `companyType`).
  Precisa **confirmar o e-mail** que o Asaas envia.
- `Establishment`: `asaasAccountId`, `asaasWalletId`, `asaasApiKey`,
  `receivablesActive`. A **chave da subconta** (`asaasApiKey`) só é devolvida
  **uma vez, na criação** — por isso é guardada nesse momento.
- **Reaproveitar conta**: um dono com vários estabelecimentos usa a mesma conta
  ("Usar a mesma conta" copia `walletId` + `apiKey`; `findSubaccount` por
  CPF/CNPJ evita "documento já em uso").

### Onde a cobrança é criada (empresa fora do fluxo)

- **PIX** → criado **direto na subconta** do estabelecimento (com a `asaasApiKey`
  dela), **sem split**. A conta da empresa **não aparece** e **não paga taxa**.
- **Cartão** → criado na **conta da empresa** (split 100% para a subconta), para
  o **cartão salvo funcionar em qualquer estabelecimento** (o token fica numa
  conta só). A empresa **fica em R$ 0** (a taxa sai do valor; o estabelecimento
  recebe o líquido).
- **Taxa de mensageria desligada** (`notificationDisabled` no cliente do Asaas):
  o app já manda as notificações/e-mails, então o Asaas não cobra a mensageria —
  era o que descontava ~R$ 0,99 da conta da empresa por cobrança.

### Sinal e serviço

- **Sinal**: serviços com sinal exigem valor mínimo (`APP_PAYMENT_MIN_CENTS`,
  padrão **R$ 20**). O cliente paga pelo app (botão **"Pagar sinal"**); ao
  confirmar, o sinal é marcado como recebido automaticamente.
- **Serviço**: o cliente pode pagar **antes ou depois** de concluir (botão
  **"Pagar serviço"**, aparece a partir de confirmado). Cobra o **saldo**
  (total − sinal já pago).
- **Concluir "pelo app"**: ao concluir, o dono pode escolher **"Cliente vai
  pagar pelo app"** — conclui sem receber na hora; o caixa entra quando o
  pagamento confirmar. Se o serviço **já foi pago**, concluir **não abre** o
  modal de forma de pagamento (evita lançar em duplicidade no caixa).
- **Confirmação**: cartão captura na hora; PIX confirma pelo **poll**
  (`/deposit-status`, `/service-status`, consulta o gateway com a chave certa) —
  o modal mostra o QR e fecha sozinho ao confirmar. **Anti-cobrança-dupla**: se
  já existe cobrança, o sistema confirma/reaproveita em vez de gerar outra.

### Caixa à prova de duplicata

- O **sinal** entra no caixa como lançamento próprio (`booking` nulo, para não
  colidir com o índice único por agendamento); a **conclusão** lança o **saldo**
  (`total − sinal já lançado`). Sinal + saldo = total, **sem duplicar**.
- `utils/cashPosting.ts`: `postDepositToCash`, `postDepositIfSessionOpen`,
  `postBookingToCash` (desconta o sinal já lançado). A varredura de abertura do
  caixa lança sinais pendentes de agendamentos ainda não concluídos.

### Cartão salvo (reutilizável em qualquer estabelecimento)

- Ao pagar no cartão a 1ª vez, o token é salvo no `User`
  (`asaasCustomerId` + `savedCard` {token, last4, brand}, ambos `select:false`).
- Nas próximas vezes o modal oferece **"pagar com o cartão salvo ····1234"** num
  toque (sem CPF nem dados). Opções **"usar outro cartão"** e **"remover"**.
- Como o cartão vive na **conta da empresa**, o cartão salvo vale em **qualquer**
  estabelecimento, mesmo um onde o cliente nunca pagou.
- Endpoints: `GET /api/auth/saved-card` (só final + bandeira; nunca o token),
  `DELETE /api/auth/saved-card`.

### Notificações e e-mails

- **Pagamento pendente** (serviço concluído para pagar pelo app) e **pagamento
  recebido** (sinal/serviço) geram **notificação in-app + e-mail** para **ambas
  as partes** (tipos `payment_pending`, `payment_received`).

### Agenda (painel do estabelecimento)

- Aba renomeada de "Agendamentos" para **"Agenda"**.
- Ordenação: **novos/ativos** primeiro, depois **concluídos aguardando
  pagamento** (com selo **"Pagamento pendente"**), depois concluídos pagos e
  cancelados. Na conta do cliente, os pendentes de pagamento vão para o topo.

### Endpoints (bookings)

- `POST /api/bookings/:id/pay-deposit` — cliente paga o sinal (PIX/cartão)
- `GET  /api/bookings/:id/deposit-status` — confirma/consulta o sinal
- `POST /api/bookings/:id/pay-service` — cliente paga o serviço (saldo)
- `GET  /api/bookings/:id/service-status` — confirma/consulta o serviço

### Liquidação

- **PIX**: cai **na hora** no saldo da subconta do estabelecimento.
- **Cartão**: a venda fica **confirmada**, mas liquida em **~30 dias** (padrão
  do cartão); na liquidação o split repassa **automaticamente** o líquido para a
  subconta. Antes disso fica "a receber" (não sacável). Antecipação é opcional
  no painel do Asaas.

> Pendências: **rodar `npm run build`** (server e client) antes do deploy;
> **limpar dados de teste** do banco em produção (assinaturas/recebimentos de
> sandbox que aparecem como pagos); migrar subcontas **antigas** (sem
> `asaasApiKey`) para o modelo "empresa fora" — precisa habilitar as chaves de
> subconta no painel do Asaas (janela de 2h + whitelist de IP); opcionalmente
> configurar webhook por subconta para PIX de cliente instantâneo (hoje via poll).

## 33. Assentos de funcionário (limite de equipe)

O plano inclui **5 funcionários** (a EQUIPE; o **dono não conta**). Acima disso,
cada assento extra é pago e entra na assinatura:

- 6º, 7º e 8º funcionário: **R$ 9,99/mês** cada
- do 9º em diante: **R$ 14,99/mês** cada
- ciclo **anual = 10×** o mensal (2 meses grátis)

Cobrança do assento é feita **na conta da empresa** (receita da plataforma, sem
split, flag `platform` em `createCharge`) e, ao confirmar, sobe `extraSeats` e
**atualiza o valor recorrente** da assinatura no Asaas
(`updateSubscriptionValue`). No meio de um ciclo anual, cobra **proporcional**
aos meses restantes. A trava está no **backend** (`professionalController` bloqueia
cadastro/reativação além do limite, com `403 { needSeat }`), então não dá para
furar pela API. No painel (aba Equipe) o dono vê "X de Y" e um botão de comprar
assento (modal PIX/cartão).

- Config: `server/src/config/seats.ts` (preços/incluídos), `utils/seatLimit.ts`
  (`teamCount`, `usedSeats`, `maxTeam`).
- Modelo: `Subscription.extraSeats` + `seatPendingPaymentId`/`seatPendingExtra`.
- Endpoints: `GET/POST /subscriptions/:est/seats`; ramo `seat:` no webhook.
- Front: `SeatPurchaseModal.tsx`, `ProfessionalManager` (gating).

## 34. Galeria: dois carrosséis + limite de armazenamento

**Exibição** (`GallerySection.tsx`): no perfil do estabelecimento a galeria tem
**dois carrosséis** — "Fotos" (imagens normais) em cima e "Antes e depois"
embaixo — cada um com setas próprias e lightbox compartilhado.

**Limite = armazenamento** (nº de arquivos no S3, que é o que custa). O dono
aloca como quiser: foto normal ocupa **1 espaço**, antes/depois ocupa **2**
(são 2 arquivos).

- Incluído no plano: **40 espaços**.
- Pacote extra: **+20 espaços por R$ 6,99/mês** (recorrente, soma na assinatura,
  anual ×10, proporcional no meio do ciclo).

A trava está em `galleryController.createGalleryItem` (`403 { needSpace }`).
Dono e **funcionários** veem o indicador de uso; só o **dono** compra pacote.

- Config: `server/src/config/gallery.ts`, `utils/galleryLimit.ts`.
- Modelo: `Subscription.extraGallerySlots` + pendências.
- Endpoints: `GET/POST /subscriptions/:est/gallery`; ramo `gallery:` no webhook.
- Front: `GallerySpaceModal.tsx`, `GalleryManager` (indicador + trava).

## 35. Secretário(a) / Atendente (papel de agenda)

Papel de acesso novo: um login que **organiza a agenda de todos** (ver, criar,
remarcar, cancelar agendamentos e falar com clientes), **sem** prestar serviço,
sem financeiro/caixa, sem assinatura e sem gerenciar equipe/serviços.

- Membro do estabelecimento com `role: "secretary"` (não é um profissional
  agendável, não aparece para clientes).
- **1º(ª) é grátis**; do(a) 2º(ª) em diante cada um(a) ocupa **um assento pago**
  (entra no mesmo contador da seção 33).
- Convite por e-mail/link, igual aos profissionais (`Invite.role`).
- Permissão de agenda: helper `isEstablishmentManager` em `bookingController`
  dá poder de "estabelecimento" sobre qualquer agendamento (aplicado em
  `listBookings`, `updateBookingStatus`, `rescheduleBooking`, `cancelSeries`,
  `extendBooking`). Financeiro fica de fora de propósito.
- Painel: quando `myRole === "secretary"`, só aparecem as abas **Agenda** e
  **Clientes** (`SECRETARY_TABS` em `EstablishmentPanel`).
- Login: é o login normal do app — aceita o convite (cria senha ou vincula) e
  depois entra por e-mail+senha; o estabelecimento aparece no Painel Pro.

- Backend: `inviteController` (`inviteSecretary`/`listSecretaries`/
  `removeSecretary` + `acceptInvite` tratando o papel), rotas em
  `establishmentRoutes`, `Establishment.members[].role`, `Invite.role`.
- Front: `SecretaryManager.tsx`, `api/secretary.ts`.

## 36. Produção — domínio, e-mail, uploads, login Google, assinatura

Checklist do que o **domínio** (`servicospro.com`, front na Netlify, back no
Render) exige em cada serviço:

- **DNS**: o domínio usa **Netlify DNS** (nameservers da Netlify). Todos os
  registros (inclusive e-mail) são criados **no painel de DNS da Netlify**, não
  no Squarespace.
- **Front ↔ back**: `CLIENT_URL` (Render) = origem exata do site, sem barra
  final; `VITE_API_URL` (Netlify) = URL do back **e rebuild** (Vite "assa" no
  build).
- **E-mail (Brevo)**: domínio **autenticado** (registros DKIM 1/2, DMARC
  `p=none` e brevo-code); `EMAIL_FROM_ADDRESS` = algo **@servicospro.com**; a
  trava de **IPs autorizados de API** deve ficar **desligada** (o IP de saída do
  Render é dinâmico — senão dá 401).
- **Uploads (S3)**: adicionar as origens `https://servicospro.com` e `www` no
  **CORS do bucket** (métodos PUT/GET/HEAD), senão o upload direto quebra.
- **Login Google**: adicionar as origens do domínio em **Authorized JavaScript
  origins** (Google Cloud Console) e o domínio em Authorized domains.
- **Assinatura (ClickSign)**: por padrão fica em **sandbox** e **desligada** sem
  `CLICKSIGN_API_TOKEN` (no-op, nada quebra e sem custo). Para produção: token de
  produção, `CLICKSIGN_BASE_URL=https://app.clicksign.com`, webhook + secret, e
  `CLICKSIGN_SIGN_AUTH=email` (ICP-Brasil exige certificado do assinante).
