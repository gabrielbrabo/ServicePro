# ServicePro — Backend

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

# ServicePro — Contexto do Projeto

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