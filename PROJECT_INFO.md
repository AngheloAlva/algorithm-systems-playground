# Algorithm & Systems Playground

Plataforma web interactiva que reúne varios módulos de visualización de algoritmos, simulaciones y datos bajo una misma interfaz. Proyecto de portafolio orientado a demostrar capacidades de **frontend** y **lógica/algoritmos** ante empresas.

---

## 1. Visión del proyecto

Una sola aplicación con navegación entre módulos independientes que comparten diseño, componentes y patrones de estado. El objetivo no es la cantidad de módulos sino la **calidad y coherencia**: arquitectura limpia, separación entre lógica y UI, animaciones fluidas y una experiencia pulida.

### Qué demuestra a una empresa
- **Frontend:** diseño consistente, componentes reutilizables, manejo de estado complejo, animación en tiempo real, accesibilidad y responsividad.
- **Algoritmos:** estructuras de datos y algoritmos implementados desde cero (no solo librerías).
- **Arquitectura:** separación lógica/UI, módulos escalables, código tipado y testeable.

---

## 2. Módulos

### Módulo A — Visualizador de algoritmos
- **Pathfinding** sobre una grilla: A*, Dijkstra, BFS, DFS. El usuario dibuja muros, mueve inicio/fin, y observa la animación paso a paso con control de velocidad.
- **Ordenamiento** (segunda pestaña): bubble, quick, merge, heap sort visualizados como barras animadas.
- Aporta: diagramático + algoritmos.

### Módulo B — Simulador de sistemas
- Modelo **SIR** de epidemias (o **boids/flocking** como alternativa visualmente atractiva).
- Sliders de parámetros (tasa de contagio, recuperación, población) con gráficas en vivo que reaccionan a los cambios.
- Aporta: simulación + numérico.

### Módulo C — Editor de grafos
- El usuario crea nodos y aristas con el mouse, y ejecuta algoritmos sobre su propio grafo: recorridos (BFS/DFS), árbol de expansión mínima (Prim/Kruskal), detección de ciclos.
- Aporta: diagramático + frontend + algoritmos.

### Módulo D — Dashboard de datos
- Dataset real (terremotos USGS, criptomonedas, o datos públicos chilenos) con filtros y visualizaciones dinámicas (series temporales, mapas).
- Aporta: numérico + gráfico + manejo de datos asíncronos.

---

## 3. Stack tecnológico

| Capa | Tecnología | Razón |
|------|-----------|-------|
| Framework | Next.js (App Router) + TypeScript | SSR/routing, tipado fuerte |
| Estilos | Tailwind CSS | Velocidad y consistencia |
| Render gráfico | Canvas / SVG | Grillas, grafos, partículas |
| Gráficas | Recharts (o D3 si se quiere control fino) | Series y dashboards |
| Estado | Zustand (o Context para casos simples) | Estado por módulo, simple y escalable |
| Animación | requestAnimationFrame | Loops de simulación a 60fps |
| Tests | Vitest + Testing Library | Validar la lógica de algoritmos |

---

## 4. Fases de construcción

### Fase 0 — Fundaciones
- Inicializar Next.js + TypeScript + Tailwind.
- Definir layout base: barra lateral de navegación, header, área de contenido.
- Crear el sistema de diseño mínimo: tokens de color, tipografía, modo claro/oscuro.
- Componentes compartidos base: `ControlPanel`, `Slider`, `Button`, `Tabs`, `Toolbar`.
- **Entregable:** app navegable con páginas placeholder por módulo.

### Fase 1 — Módulo A (Visualizador de algoritmos)
- Implementar lógica de grilla y algoritmos de pathfinding como funciones puras (sin React).
- Construir el renderizado en canvas/grid y la interacción (dibujar muros, mover nodos).
- Sistema de animación paso a paso con control play/pausa/velocidad.
- Añadir pestaña de ordenamiento.
- **Entregable:** primer módulo completamente funcional. Es el más vistoso, buen ancla del portafolio.

### Fase 2 — Módulo C (Editor de grafos)
- Reutilizar el motor de canvas y patrones de la Fase 1.
- Editor interactivo de nodos/aristas.
- Algoritmos de grafos sobre la estructura creada por el usuario.
- **Entregable:** segundo módulo; demuestra reutilización de componentes.

### Fase 3 — Módulo B (Simulador de sistemas)
- Loop de simulación con requestAnimationFrame.
- Panel de parámetros conectado en vivo.
- Gráficas reactivas con Recharts.
- **Entregable:** módulo de simulación numérica.

### Fase 4 — Módulo D (Dashboard de datos)
- Fetch de dataset real, manejo de loading/error.
- Filtros y visualizaciones dinámicas.
- **Entregable:** módulo de datos; demuestra trabajo con APIs y estados asíncronos.

### Fase 5 — Pulido
- Animaciones de transición, estados vacíos, responsividad móvil.
- Tests de la lógica de algoritmos.
- README con capturas/GIFs, descripción técnica y deploy en Vercel.
- **Entregable:** proyecto listo para mostrar.

> Sugerencia: cada fase es un proyecto demostrable por sí mismo. Si en algún punto quieres parar, ya tienes algo presentable. Construir A → C primero maximiza el impacto visual temprano.

---

## 5. Estructura de carpetas

```
algorithm-systems-playground/
├── app/                          # Rutas (App Router)
│   ├── layout.tsx                # Layout global: sidebar + header
│   ├── page.tsx                  # Landing / índice de módulos
│   ├── pathfinding/page.tsx
│   ├── graphs/page.tsx
│   ├── simulation/page.tsx
│   └── dashboard/page.tsx
│
├── components/                   # UI compartida (presentacional)
│   ├── layout/                   # Sidebar, Header, ThemeToggle
│   ├── controls/                 # ControlPanel, Slider, Button, Tabs
│   └── canvas/                   # Wrappers reutilizables de canvas
│
├── lib/                          # LÓGICA PURA, sin React
│   ├── algorithms/
│   │   ├── pathfinding/          # astar.ts, dijkstra.ts, bfs.ts
│   │   ├── sorting/              # quicksort.ts, mergesort.ts...
│   │   └── graph/                # traversal.ts, mst.ts, cycles.ts
│   ├── simulation/               # sir.ts, boids.ts
│   └── data/                     # fetchers y transformadores del dashboard
│
├── hooks/                        # useAnimationLoop, useGrid, useGraph...
│
├── store/                        # Estado por módulo (Zustand)
│
├── types/                        # Tipos compartidos
│
└── __tests__/                    # Tests de lib/algorithms
```

**Principio clave:** todo lo que va en `lib/` son funciones puras y testeables que no saben que existe React. La UI consume esa lógica. Esta separación es lo que más valoran los revisores técnicos.

---

## 6. Detalles que elevan la percepción de calidad

- **Pseudocódigo o explicación** junto a cada algoritmo mientras se ejecuta (muestra que entiendes lo que implementas).
- **Métricas en vivo:** nodos visitados, comparaciones, tiempo — refuerza el lado numérico.
- **Estado compartible por URL** (parámetros en query string) para enlazar una configuración concreta.
- **Tests visibles** en el README.
- **Deploy en Vercel** con dominio limpio y README con GIFs.

---

## 7. Próximos pasos sugeridos

1. Decidir el orden definitivo de módulos (recomendado: A → C → B → D).
2. Montar la Fase 0 (esqueleto + sistema de diseño).
3. Implementar la lógica pura del primer algoritmo de pathfinding antes de tocar la UI.
