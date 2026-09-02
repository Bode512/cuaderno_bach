# Cuaderno de Bachillerato

Aplicación web de escritorio para estudiantes de 2.º de Bachillerato. Organiza horarios, tareas, exámenes, calificaciones, fórmulas, flashcards y más en una única interfaz con diseño glassmorphism y modo oscuro.

> **Aviso:** Este proyecto es de **uso exclusivamente personal**. No se concede permiso para uso comercial, redistribución, modificación ni creación de obras derivadas. Consulta la [licencia](LICENSE) para más detalles.

---

## Funcionalidades

### Organizar
- **Horario** semanal con grid interactivo (Lun–Vie, 8:00–19:00).
- **Tareas** con checklist, prioridad, fecha límite y filtrado por asignatura.
- **Exámenes** con countdown y alertas visuales por proximidad.
- **Calendario** de eventos (entregas, trabajos, exámenes) con vista mensual.
- **Registro de horas** de estudio por asignatura con barras de progreso.

### Notas
- **Calculadora EBAU** — fórmula de acceso: 0,6 × NMB + 0,4 × Calificación EBAU.
- **Simulador de notas** — calcula la nota necesaria en un examen para alcanzar un objetivo.
- **Registro de calificaciones** — almacena notas por asignatura y evaluación.
- **Conversor de escalas** — convierte entre 0–10, 0–100 y calificación numerica.

### Fichas (Flashcards)
- **Creador de fichas** — pregunta/respuesta con asignatura y nivel de dominio.
- **Repaso espaciado** — algoritmo Leitner (5 cajas) con sesiones de revisión.
- **Test interactivo** — generación aleatoria de preguntas de opción múltiple.
- **Ruleta** — selección aleatoria de fichas para repaso rápido.

### Fórmulas
- **Chuletario** con 28 fórmulas predefinidas renderizadas con KaTeX (Matemáticas, Física, Química).
- **Buscador** por nombre o expresión.
- **Filtro por asignatura**.
- **Agregado de fórmulas personalizadas** con sintaxis LaTeX.

### Extras
- **Pomodoro** — temporizador de 25/5 con ciclos y conteo de sesiones.
- **Conversor de unidades** — longitud, masa, temperatura, velocidad, tiempo.
- **Bloque de notas** — notas rápidas por asignatura con autoguardado.
- **Ruleta de asignaturas** — selección aleatoria para decisiones rápidas.

### General
- **Modo oscuro** con fondo negro real (#0A0A0A) y efecto glass.
- **Navegación responsiva** — barra inferior en móvil, barra flotante centrada en escritorio.
- **Transiciones de vista** con animación slide entre secciones.
- **Persistencia local** — todos los datos se guardan en `localStorage` sin servidor.
- **Diseño glassmorphism** con `backdrop-filter`, sombras suaves y tipografía Source Serif 4 + Inter.

---

## Tecnologías

| Tecnología | Versión | Uso |
|---|---|---|
| TypeScript | ^5.8.3 | Lenguaje principal |
| Vite | ^7.3.6 | Bundler y servidor de desarrollo |
| KaTeX | ^0.18.5 | Renderizado de fórmulas LaTeX |
| HTML/CSS | — | Estructura y estilos |
| localStorage | — | Persistencia de datos en cliente |

No se utiliza ningún framework de UI (React, Vue, etc.). La aplicación está construida con TypeScript vanilla y CSS puro.

---

## Requisitos previos

- [Node.js](https://nodejs.org/) ≥ 20.x
- npm (incluido con Node.js)
- Git

---

## Instalación

```bash
# Clonar el repositorio
git clone https://github.com/Bode512/cuaderno_bach.git
cd cuaderno_bach

# Instalar dependencias
npm install
```

---

## Ejecutar

### Desarrollo

```bash
npm run dev
```

Abre en el navegador la URL que aparece en la terminal (por defecto `http://localhost:5173`).

### Build de producción

```bash
npm run build
```

Los archivos optimizados se generan en la carpeta `dist/`.

### Vista previa del build

```bash
npm run preview
```

---

## Estructura del proyecto

```
cuaderno_bach/
├── index.html              # Punto de entrada HTML
├── package.json            # Dependencias y scripts
├── tsconfig.json           # Configuración de TypeScript
├── vite.config.ts          # Configuración de Vite
├── LICENSE                 # Licencia de uso personal
├── README.md               # Este archivo
├── CONTRIBUTING.md         # Política de contribuciones
├── CHANGELOG.md            # Historial de cambios
├── .gitignore              # Archivos excluidos de Git
└── src/
    ├── main.ts             # Router de tabs, tema, scroll, inicialización
    ├── storage.ts          # Wrapper de localStorage con prefijo "bachi_"
    ├── style.css           # Estilos globales, glass, dark mode, responsive
    └── modules/
        ├── organizer.ts    # Horario, tareas, exámenes, calendario, estudio
        ├── calculator.ts   # EBAU, simulador, registro de notas, conversor
        ├── flashcards.ts   # Fichas, repaso espaciado, test, ruleta
        ├── formulas.ts     # Chuletario con KaTeX, fórmulas personalizadas
        └── extras.ts       # Pomodoro, conversor de unidades, notas, ruleta
```

---

## Asignaturas

La aplicación viene configurada con las siguientes asignaturas de 2.º de Bachillerato:

- Valenciano
- Lengua Castellana
- Física
- Química
- Historia
- Filosofía
- Matemáticas
- Tecnología
- Biología

---

## Datos y persistencia

Todos los datos se almacenan localmente en el navegador mediante `localStorage` con el prefijo `bachi_`. No se envía ninguna información a servidores externos.

Las claves utilizadas:

| Clave | Contenido |
|---|---|
| `bachi_theme` | Preferencia de tema (claro/oscuro) |
| `bachi_lastTab` | Última pestaña activa |
| `bachi_schedule` | Horario semanal |
| `bachi_tasks` | Lista de tareas |
| `bachi_exams` | Exámenes programados |
| `bachi_calendar` | Eventos del calendario |
| `bachi_studySessions` | Registro de horas de estudio |
| `bachi_grades` | Calificaciones registradas |
| `bachi_flashcards` | Fichas creadas |
| `bachi_customFormulas` | Fórmulas personalizadas por el usuario |
| `bachi_notes` | Bloques de notas |

---

## Solución de problemas

### La aplicación no carga en desarrollo

- Verifica que las dependencias estén instaladas: `npm install`
- Asegúrate de estar en la carpeta raíz del proyecto
- Comprueba que Node.js ≥ 20 esté instalado: `node --version`

### El modo oscuro no se aplica correctamente

- Borra la caché del navegador (`Ctrl+Shift+R` o `Cmd+Shift+R`)
- Verifica que `localStorage` no esté bloqueado por el navegador

### Las fórmulas no se renderizan

- Comprueba la conexión a internet (KaTeX se carga desde CDN en la primera visita)
- Revisa la consola del navegador en busca de errores de red

### Los datos no se guardan

- Verifica que `localStorage` esté habilitado en tu navegador
- Algunos navegadores en modo privado limitan el almacenamiento local

---

## Estado del proyecto

**Versión:** 1.0.0  
**Estado:** Funcional — todas las funcionalidades implementadas y operativas.

El proyecto se encuentra en uso personal activo. No se prevé un roadmap público de nuevas funcionalidades.

---

## Licencia

Este proyecto está sujeto a una [licencia de uso personal restrictiva](LICENSE). En resumen:

- **Uso permitido:** exclusivamente personal y no comercial.
- **Uso prohibido:** comercial, redistribución, modificación, creación de obras derivadas, sublicenciamiento.
- La publicación en GitHub no implica concesión de derechos adicionales.

---

## Contribuciones

Consulte [CONTRIBUTING.md](CONTRIBUTING.md) para la política completa de contribuciones.

De forma resumida:

- **Reportes de errores:** bienvenidos a través de Issues.
- **Propuestas de mejora:** bienvenidas a través de Issues.
- **Contribuciones de código:** no se aceptan de forma general. El propietario se reserva el derecho de aceptar o rechazar cualquier contribución.
- **Forks:** no se permiten para redistribución o creación de versiones derivadas.

---

## Git y GitHub

### Clonar

```bash
git clone https://github.com/Bode512/cuaderno_bach.git
cd cuaderno_bach
```

### Crear un commit

```bash
git add <archivos>
git commit -m "Descripción breve del cambio"
```

### Subir cambios

```bash
git push origin main
```

### Sincronizar con el repositorio remoto

```bash
git pull origin main
```

---

## Contacto

Repositorio oficial: [https://github.com/Bode512/cuaderno_bach](https://github.com/Bode512/cuaderno_bach)

Para reportar errores o sugerir mejoras, utilice la sección de Issues del repositorio.
