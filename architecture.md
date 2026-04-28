# 🏗️ PROMPT COMPLETO — Next.js + DDD + Clean Architecture (SEM AUTENTICAÇÃO)

Crie um projeto **Next.js (App Router) com TypeScript** utilizando **DDD (Domain-Driven Design)** e **Clean Architecture**, seguindo rigorosamente as regras abaixo.

---

# 🎯 OBJETIVO

Gerar uma aplicação **moderna, escalável e organizada**, com:

* Separação clara de responsabilidades
* Código altamente testável
* Independência de frameworks no domínio
* Arquitetura preparada para crescimento

⚠️ IMPORTANTE:

* NÃO implementar autenticação
* NÃO usar session, cookies ou tokens
* NÃO usar localStorage
* NÃO criar fluxo de login

---

# 🧱 ARQUITETURA

A aplicação deve seguir **4 camadas**:

```
Presentation → Application → Domain ← Infrastructure
```

---

# 📁 ESTRUTURA DE PASTAS

Crie exatamente essa estrutura:

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│
├── domain/
│   ├── entities/
│   ├── value-objects/
│   ├── repositories/
│   ├── services/
│
├── application/
│   ├── use-cases/
│   ├── dtos/
│   ├── ports/
│
├── infrastructure/
│   ├── http/
│   ├── repositories/
│   ├── services/
│
├── presentation/
│   ├── features/
│   ├── shared/
│
├── di/
│   ├── container.ts
│   ├── types.ts
│
├── lib/
│   ├── safe-action.ts
│   ├── react-query-provider.tsx
│   ├── env.ts
│   ├── logger.ts
│
└── styles/
```

---

# 🧠 DOMAIN LAYER (REGRAS)

* ❌ NÃO importar nada de React, Next.js ou libs externas
* ❌ NÃO acessar API, banco ou qualquer IO
* ✅ Apenas regras de negócio puras

Implementar:

### Entities

* Classe com identidade
* Métodos de comportamento

### Value Objects

* Imutáveis
* Validação interna

### Repositories (interfaces)

* Apenas contratos (sem implementação)

---

# 🟢 APPLICATION LAYER

Responsável por orquestrar a lógica.

### Regras:

* Pode depender do Domain
* NÃO pode depender de Next.js
* NÃO pode ter código de UI

### Implementar:

#### Use Cases

* Um arquivo por caso de uso
* Ex: `get-users.ts`

#### DTOs

* Estruturas de entrada/saída

#### Ports

* Interfaces para serviços externos

Exemplo:

```
http-service.ts
```

⚠️ NÃO criar:

* auth-service
* session provider
* qualquer coisa relacionada a usuário logado

---

# 🟡 INFRASTRUCTURE LAYER

Implementações concretas.

### Pode usar:

* Axios
* APIs externas

### Implementar:

#### HTTP Service

* Axios simples
* SEM interceptors de autenticação

#### Repositories

* Implementam interfaces do domain

---

# 🔴 PRESENTATION LAYER

Interface com usuário.

### Contém:

* React Components
* Hooks
* Server Actions

### Organização:

```
features/
  users/
    actions/
    components/
    hooks/
```

---

# ⚡ SERVER ACTIONS

Usar `next-safe-action`

### Regra importante:

* NÃO usar session
* NÃO usar cookies
* NÃO usar headers customizados

Exemplo:

```ts
export const getUsersAction = action.action(async () => {
  return useCase.execute();
});
```

---

# 🔌 DEPENDENCY INJECTION

Usar **Inversify**

### Criar:

* `types.ts` (tokens)
* `container.ts`

### Regras:

* Singleton para services
* Bind explícito de tudo

⚠️ NÃO registrar:

* AuthService
* SessionTokenProvider

---

# 🌐 HTTP SERVICE

Criar implementação com Axios:

* Sem interceptors
* Sem headers dinâmicos
* Sem tokens

---

# 📦 STATE MANAGEMENT

Usar:

* React Query → dados do servidor
* Zustand → estado local

---

# 🎨 UI

* Tailwind CSS
* Layout moderno
* Responsivo

---

# 🧪 TESTES

Usar Bun test:

* Testar Use Cases
* Testar Repositories

---

# ⚙️ CONFIGURAÇÕES

### tsconfig:

* strict true
* decorators enabled

---

# 🚀 SETUP

Instalar:

```
bun add inversify reflect-metadata next-safe-action zod @tanstack/react-query zustand axios
```

---

# ❌ PROIBIDO

NÃO implementar nada relacionado a:

* autenticação
* login
* usuário logado
* JWT
* cookies
* session
* localStorage
* refresh token

---

# ✅ ENTREGÁVEL

Gerar:

1. Estrutura completa de pastas
2. Código base funcional
3. Um exemplo completo de feature (users):

   * entity
   * repository
   * use case
   * action
   * hook
   * component

---

# 💡 FOCO

O código deve ser:

* Limpo
* Tipado
* Escalável
* Fácil de manter

---
