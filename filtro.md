# 📄 Filtro Lateral de Quartos (Sidebar Filters)

## 🎯 Objetivo

Implementar um componente de **filtro lateral fixo (sidebar)** para refinar a busca de quartos de hotel.

- Clean e moderno (estilo Airbnb)
- Mobile-first
- Acessível
- Integrado com listagem

---

## 🧱 Estrutura Geral

- Largura: 280px–320px (desktop)
- Mobile: Drawer lateral
- Altura: 100%
- Scroll interno

```tsx
<aside className="filters-sidebar">
  <header />
  <section />
  <footer />
</aside>
```

---

## 🎨 Estilo

- Background: #F9FAFB
- Border-right: 1px solid #E5E7EB
- Padding: 24px
- Espaçamento entre seções: 24px

---

## 🧩 FilterSection (Accordion)

```tsx
type FilterSectionProps = {
  title: string
  children: ReactNode
  defaultOpen?: boolean
}
```

- Clique abre/fecha
- Ícone rotaciona
- Transition: 200ms ease

---

## 📦 Filtros

### 💰 Faixa de Preço

- Slider duplo (min/max)
- Min: 0 | Max: 2000 | Step: 50

```ts
priceRange: { min: number; max: number }
```

---

### 👥 Hóspedes

- Min e Max (select ou stepper)
- Range: 1–10

```ts
guests: { min: number; max: number }
```

---

### ❄️ Ar Condicionado

```ts
hasAirConditioning: boolean
```

---

### 🛏️ Camas

```ts
beds: number[]
```

---

### 🛌 Tipo de Cama

```ts
bedType: { double: boolean; single: boolean }
```

---

### 🧼 Comodidades

```ts
amenities: {
  breakfast: boolean
  cleaning: boolean
  wifi: boolean
  parking: boolean
  oceanView: boolean
  pool: boolean
}
```

---

## 🎛️ Header

```tsx
<div className="flex justify-between items-center">
  <h2>Filtros</h2>
  <button>Limpar filtros</button>
</div>
```

---

## 🔄 Reset

- Botão limpa todos os filtros

---

## 📱 Responsividade

- Desktop: sidebar fixa
- Mobile: Drawer

```tsx
<Drawer side="left">
  <Filters />
</Drawer>
```

---

## 🧠 Estado

```ts
type FiltersState = {
  priceRange: { min: number; max: number }
  guests: { min: number; max: number }
  hasAirConditioning: boolean
  beds: number[]
  bedType: { double: boolean; single: boolean }
  amenities: Record<string, boolean>
}
```

---

## 🔄 Integração

```ts
useEffect(() => {
  fetchRooms(filters)
}, [filters])
```

---

## 🧪 Acessibilidade

- Labels em todos inputs
- Navegação por teclado
- ARIA roles

---

## ✨ UX

- Hover suave
- Focus visível
- Transition 150ms

---

## 🧼 Boas práticas

- Debounce no slider
- Componentes reutilizáveis
- Evitar re-render

---

## 🎯 Resultado

Sidebar moderna, acessível e integrada à busca.
