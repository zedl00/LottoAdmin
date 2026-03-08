# LottoAdmin — Proyecto Vite + Vue 3

## Estructura del proyecto

```
lottoadmin/
├── index.html              ← Entry point HTML (Vite)
├── vite.config.js          ← Configuración de Vite
├── package.json            ← Dependencias (vue, @supabase/supabase-js)
├── src/
│   ├── main.js             ← Monta la app Vue
│   ├── App.vue             ← Componente raíz (template + script setup)
│   ├── store.js            ← Estado compartido: Supabase client, toast, config
│   ├── assets/
│   │   └── main.css        ← Todos los estilos
│   ├── composables/        ← Lógica por módulo (Vue Composition API)
│   │   ├── useUtils.js
│   │   ├── useSupabase.js
│   │   ├── useCategorias.js
│   │   ├── usePeriodos.js
│   │   ├── useGrupos.js
│   │   ├── useBancas.js
│   │   ├── useDashboard.js
│   │   ├── useResumen.js
│   │   ├── useCuadre.js
│   │   ├── useImportar.js
│   │   ├── useGastos.js
│   │   ├── usePrestamos.js
│   │   ├── useParticipacion.js
│   │   ├── useBanco.js
│   │   ├── useFlujo.js
│   │   └── useEstadoResultados.js
│   └── views/              ← Referencia HTML de cada vista (no cargados en runtime)
└── dist/                   ← Build de producción (generado con npm run build)
```

## Comandos

```bash
# Instalar dependencias (solo primera vez)
npm install

# Desarrollo local con hot-reload
npm run dev

# Build de producción
npm run build

# Preview del build
npm run preview
```

## Deploy en servidor

1. Ejecutar `npm run build`
2. Subir la carpeta `dist/` al servidor web
3. Configurar el servidor para servir `index.html` en todas las rutas (SPA routing)

### Nginx (ejemplo)
```nginx
location / {
    root /var/www/lottoadmin/dist;
    try_files $uri $uri/ /index.html;
}
```

### Apache (.htaccess en dist/)
```apache
RewriteEngine On
RewriteBase /
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

## Requisitos

- Node.js 16+ (para desarrollo/build)
- Servidor web estático para producción (solo sirve los archivos de `dist/`)
