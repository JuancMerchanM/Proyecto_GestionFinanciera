# Migración a TypeScript — Gestion-Financiera

Documento del proceso de migración de **JavaScript ESM (`.mjs`) a TypeScript estricto**,
del backend `src/` y del frontend `public/js`, con POO (interfaces, clases y enums)
en el modelo de datos. **Sin cambios funcionales**: mismas rutas, mismos códigos
HTTP, mismos textos de respuesta.

---

## 1. Resumen ejecutivo

| Aspecto | Detalle |
|---|---|
| Alcance | Backend `src/**` (53 archivos) + frontend `public/js/**` (2 fuentes) |
| Estrategia | `tsc --noEmit` como verificación (typecheck sin build); `tsx` en runtime |
| Frontend | Fuentes TS en `src/frontend/` → bundle con `esbuild` → `public/js/*.js` commiteados |
| POO | 7 modelos con `interface` de documento + `interface` de contrato de modelo + `class` + enums |
| Errores TS | Baseline 686 → **0** (`npm run typecheck`) |
| Regresión funcional | **204/204 checks en verde** (setup + i4 + i5 + i6 + i7smoke) |
| Comportamiento | Idéntico: casts `as` (nunca coerciones), mismas rutas de error |

## 2. Preparación

1. **Snapshots**: copias de los 8 archivos más representativos en
   `snapshots-migracion/antes/` (carpeta en `.gitignore`, es material de apoyo).
   Al finalizar, `snapshots-migracion/despues/` con las rutas actuales (`.ts`).
   Índice y guía de comparación en `snapshots-migracion/INDICE.md`.
2. **Dependencias**: `tsx` (dep, runtime), `typescript` + `esbuild` (dev),
   `@types/*` para todas las dependencias con tipos propios faltantes
   (node, express, cookie-parser, ejs, jsonwebtoken, bcrypt, swagger-jsdoc,
   swagger-ui-express, express-ejs-layouts).

## 3. `tsconfig.json`

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"], // DOM por src/frontend
    "types": ["node"],
    "strict": true,               // chequeo completo
    "noEmit": true,               // typecheck puro; tsx no necesita build
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true, // obliga `import type` para tipos
    "isolatedModules": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

Puntos clave:

- **`nodenext` + `allowImportingTsExtensions`**: los imports internos llevan
  extensión explícita (`.ts`), estilo ESM moderno, compatible con `tsx`.
- **`verbatimModuleSyntax`**: todo import de solo-tipos debe ser `import type`
  (sintaxis verificable en cada archivo migrado).
- **Un solo config** para backend y frontend: `lib` incluye DOM porque
  `src/frontend` vive bajo `src/` y se valida en el mismo `typecheck`.

## 4. Renombres mecánicos (fase 1)

1. `git mv` de 53 archivos `src/**/*.mjs` → `src/**/*.ts` (historia preservada).
2. Sustitución de 106 specifiers de import: `'./x.mjs'` → `'./x.ts'` (y
   relativos equivalentes) en todo `src/`.
3. Rutas globales de swagger-jsdoc: los patterns `./src/**/*.mjs` → `./src/**/*.ts`
   (si no, el JSDoc de `@openapi` deja de alimentar el spec).
4. Verificación: `find src -name '*.mjs'` → vacío; `grep -rn "\.mjs" src` → vacío.

## 5. POO en los modelos (el hallazgo importante)

### 5.1 El problema: `Model` de mongoose 9 **no es una clase**

En mongoose 9, `Model` se declara como **`interface`**, no como `class`:

```ts
// node_modules/mongoose/types/models.d.ts
export interface Model<TRawDocType, ...> { find(...); findOne(...); ... }
```

Un enfoque ingenuo `class UserModel extends Model<IUser> {}` **colapsa todos los
miembros heredados a `any`** (verificado empíricamente en TS 5.9 y TS 7 con el
test `0 extends 1 & T ? 'ANY' : ...`): la herencia de una interfaz no aporta
implementación ni tipos de miembros. El resultado compila, pero `User.find(...)`
devuelve `any` y el chequeo queda anulado.

### 5.2 El patrón aplicado (7 modelos)

```ts
// 1) Interfaz del documento (shape del schema)
export interface IUser {
  _id: Types.ObjectId;
  name: string;
  // ...
}

// 2) Contrato del modelo: API completa de mongoose + estáticos propios (POO)
export interface IUserModel extends Model<IUser> {
  findByEmail(email: string): Promise<IUser | null>;
  findLeanById(userId: Types.ObjectId | string): Promise<IUser | null>;
}

// 3) Schema tipado
const userSchema = new mongoose.Schema<IUser>({ /* ... */ }, { timestamps: true });

// 4) Clase implementadora de los estáticos (se copian con loadClass)
class UserModel extends Model<IUser> {
  static findByEmail(this: IUserModel, email: string) {
    return this.findOne({ email: email.trim().toLowerCase() }).lean();
  }
}

// 5) Copia de estáticos al modelo + registro con tipos
userSchema.loadClass(UserModel);
export const User = mongoose.model<IUser, IUserModel>('User', userSchema);
```

- `interface IXModel extends Model<IX>` **sí** da tipos reales en
  `find/findOne/...` (los genéricos resuelven), porque es una interfaz que
  reutiliza las firmas declaradas de `Model`.
- Los estáticos usan `this: IXModel` para que `this.findOne(...)` dentro de la
  clase tenga el contrato completo (incluidos los propios estáticos).
- `schema.loadClass(X)` copia los estáticos al modelo compilado en runtime
  (validado empíricamente: corta en `$isMongooseModelPrototype` y no rompe el
  registro del modelo).
- `mongoose.model<IX, IXModel>(...)` exporta el modelo con tipos de contrato.

**No usar** `class extends Model<T>` para tipado: colapsa a `any`.

### 5.3 Enums

Strings literales agrupados en `enum` (valores idénticos a los del JSON/BD,
cero cambio de comportamiento):

| Enum | Archivo | Valores |
|---|---|---|
| `Role` | `models/home.ts` | `admin`, `member` |
| `Currency` | `models/home.ts` | `COP`, `USD` |
| `AccountType` | `models/account.ts` | `cash`, `bank`, `card`, `savings` |
| `MovementType` | `models/category.ts` | `income`, `expense` |
| `InviteStatus` | `models/invite.ts` | `pending`, `accepted`, `rejected` |

En schemas: `enum: Object.values(Role)` (misma lista de validación que antes).
En validadores de servicios: `const ROLE_VALUES: string[] = Object.values(Role)`
para comparar entradas crudas sin perder el chequeo.

### 5.4 Estáticos de modelo (lógica de dominio en la entidad)

Cada modelo expone sus consultas reutilizables como métodos estáticos tipados:

`User.findByEmail / findLeanById` · `Home.getMembership / findForUser` ·
`Account.existsName / findByIdForHome` · `Category.existsName / findByIdForHome` ·
`Transaction.findByIdForHome` · `Budget.findByIdForHome / findForMonth` ·
`Invite.findByCode / listPending`.

Los servicios consumen estos estáticos en lugar de armar filters a mano.

## 6. Tipado por capas (orden de ejecución)

Se migró de abajo hacia arriba, con `tsc --noEmit` en verde por capa antes de
seguir (baseline inicial: 686 errores esperados):

1. **`config/`** (`env`, `currencies`, `db`, `swagger`) · **`utils/money`** ·
   **`driver/mongodb`** — firmas explícitas, `CurrencyInfo`, guards de moneda.
2. **`middlewares/`** (`error`, `auth`, `home`, `role`) — `RequestHandler` /
   `ErrorRequestHandler`, `HttpError`, type guard `isHttpError`.
3. **`models/`** — patrón POO de la sección 5.
4. **`services/`** (8 archivos) — DTOs de entrada tipados como
   `interface XInput { campo?: unknown }` (llegan crudos de `req.body`),
   salidas tipadas, `QueryFilter<T>` de mongoose (no existe `FilterQuery` en v9),
   casts `as string` en `ObjectId.isValid(...)`.
5. **`controllers/`** (17 archivos, 76 handlers) — anotación masiva
   `export const x: RequestHandler = ...`, helpers internos con
   `Request`/`Response`, guards `isHttpError(err) && err.status === N` en catches.
6. **`app.ts`** — entry tipado, fix del bug de doble `start()` (ver §8).

### 6.1 Augmentación de Express (`src/types/express.d.ts`)

Se declaran las propiedades que los middlewares inyectan en la request:

```ts
declare global {
  namespace Express {
    interface Request {
      user?: IUser;          // authenticate/requireAuth
      home?: IHome;          // requireHomeMember
      homeId?: string;
      homeRole?: Role;       // requireRole
      accountView?: ...;     // vistas web (re-render del formulario)
      categoryView?: ...;
      budgetView?: ...;
      transactionView?: ...;
    }
    interface Locals { /* flash, currentUser, formatMoney, ... */ }
  }
}
```

Con eso, `req.home` en un controller ya es `IHome | undefined` y el compiler
exige resolverlo. Dado que los handlers usan rutas con `requireHomeMember`
(garantiza `req.home`) y `requireAuth` (garantiza `req.user`), el acceso correcto
es el non-null assertion **`req.home!` / `req.user!`** (91 + 22 usos), que no
altera el runtime.

### 6.2 `req.params` en express 5

`ParamsDictionary` es `{ [key: string]: string | string[] }`, así que cada
`req.params.x` que baja a un service tipado como `string` lleva **`as string`**
(83 usos). Cast de solo-tipo: runtime intacto.

### 6.3 Catches: `err` es `unknown`

TS 4.4+ tipa `catch (err)` como `unknown`. Se añadió al middleware de errores:

```ts
export const isHttpError = (err: unknown): err is HttpError => err instanceof HttpError;
```

y un sed transformó las 31 condiciones de status:

```ts
// antes                              // después
if (err.status === 404) {            if (isHttpError(err) && (err.status === 404)) {
```

Equivalencia runtime: los únicos errores con `.status` numérico son los
`HttpError` lanzados por services (los errores de mongoose/JS dan `undefined`
en ambas formas → misma rama). El narrowing además permite usar
`err.details` / `err.message` dentro del cuerpo con tipos.

### 6.4 Casts con criterio (comportamiento preservado)

Regla aplicada: **`as` = solo tipo, nunca transformar el valor en runtime**.

- `req.query.month as string | undefined ?? ''` — si llega un objeto anidado
  (`ParsedQs`), el service lo rechaza con 400 por `typeof !== 'string'`, igual
  que antes.
- `date - date` no compila en TS2362 → `date.getTime() - date.getTime()`
  (aritmética idéntica, verificado con test aislado).
- `verifyToken` puede devolver `string` (JWTs "alg:none" legítimos) →
  `typeof payload === 'string' ? undefined : payload.sub` en middlewares,
  evitando un bug latente (`string.sub()`).
- `homeToPublic(home, 'admin')` → `Role.Admin` (mismo valor en runtime).
- Helpers de solo-tipo (`toMinorBody`, `formData`, `detailsToMessage`, ...)
  tipados con `Record<string, unknown>` / `unknown` para aceptar `req.body`
  crudo sin cambiar validaciones.

## 7. Frontend (`src/frontend/` + esbuild)

- `src/frontend/app.ts` — validación de formularios (IIFE): `MESSAGES` con
  interfaz mezcla string/fn, `HTMLInputElement`/`HTMLFormElement` explícitos,
  `querySelector<T>()`, `namedItem()` en lugar de indexación por string
  (permitida por el DOM typings).
- `src/frontend/dashboard.ts` — donut con Chart.js global:
  `declare const Chart: ChartStatic | undefined` (contrato mínimo del constructor
  y del callback de tooltip), `DashData` para el JSON embebido.
- **Build**: `npm run build:ui` →
  `esbuild src/frontend/{app,dashboard}.ts --outdir=public/js --target=es2022 --charset=utf8`
  → **`public/js/app.js` y `public/js/dashboard.js` generados y commiteados**
  (Vercel no tiene build command; el sitio sirve `public/` tal cual).
- Las IIFE se conservan (esbuild no introduce módulos ni imports en runtime).

## 8. Runtime y scripts

| Script | Antes | Después |
|---|---|---|
| `dev` | `node --watch src/app.mjs` | `tsx watch src/app.ts` |
| `start` | `node src/app.mjs` | `tsx src/app.ts` |
| `typecheck` | — | `tsc --noEmit` |
| `build:ui` | — | esbuild → `public/js` |

- **Sin build step en el servidor**: `tsx` transpila on-the-fly (Vercel usa
  Build Command `None` + `npm start`).
- `.data/run.sh` apunta ahora a `node_modules/.bin/tsx src/app.ts`
  (antes usaba un launcher `.data/serve.mjs`, eliminado; el `pkill` busca
  `[t]sx src/app.ts`).
- **Fix en `src/app.ts`**: existía un `start();` residual (bloque comentado +
  llamada) que duplicaba el `listen` del guard `NODE_ENV !== 'test'`. Eliminado:
  ahora hay **un solo `app.listen`** por arranque.

## 9. Verificación

1. **Typecheck**: `npm run typecheck` → **0 errores** (baseline 686).
2. **Suites HTTP** (204 checks, todas en verde tras la migración):

   | Suite | Checks |
   |---|---|
   | `setup.sh` (estado base) | OK |
   | `i4test.sh` (transacciones) | 52 |
   | `i5test.sh` (presupuestos/permisos) | 62 |
   | `i6test.sh` (reportes + assets) | 49 |
   | `i7smoke.sh` (auth/API/docs) | 41 |
   | **Total** | **204/204** |

3. **Curles de regresión puntuales**: `/api-docs` (200, HTML con CDN
   `cdn.jsdelivr.net/npm/swagger-ui-dist@5.33.1/...` + `swagger-ui-init.js`
   200), `/?success=...` (flash ×1 → 200), `/js/app.js` y `/js/dashboard.js`
   estáticos (200).
4. **Sin residuos**: `find . -name '*.mjs'` solo en `snapshots-migracion/antes/`;
   `grep -rn "\.mjs" src public` → vacío.

## 10. Snapshots (material de apoyo)

- `snapshots-migracion/antes/` — 8 archivos originales `.mjs`/`app.js`
  capturados antes de tocar nada.
- `snapshots-migracion/despues/` — los mismos 8 archivos con su ruta actual
  (`.ts`, y `src/frontend/app.ts` para el frontend).
- `snapshots-migracion/INDICE.md` — tabla archivo→aspecto diferencial.
- La carpeta está en `.gitignore` (no forma parte del código ejecutable).

Comparar (con el mapeo de `INDICE.md`):

```bash
diff -u snapshots-migracion/antes/src/app.mjs snapshots-migracion/despues/src/app.ts
diff -u snapshots-migracion/antes/public/js/app.js snapshots-migracion/despues/src/frontend/app.ts
```

## 11. Decisiones y alternativas descartadas

| Decisión | Motivo |
|---|---|
| `tsx` sin build en vez de `tsc` + `node dist/` | Cero build step para Vercel; typecheck aparte con `tsc --noEmit` |
| `interface IXModel extends Model<IX>` en vez de `class extends Model` | mongoose 9 declara `Model` como interface: la herencia de clase colapsa a `any` |
| Non-null `req.home!` en vez de guard `if (!req.home)` | Los middlewares de la ruta ya garantizan la propiedad; cambiar a guard alteraría flujos de error |
| `unknown` + `isHttpError` en catch en vez de `catch (err: any)` | Chequeo real sin perder el strict del compiler |
| Frontend TS + esbuild, artefactos commiteados | Vercel sirve `public/` sin build; el diff de los `.js` generados queda en el repo |
| Enums con mismos valores string | Validación de schemas y comparaciones idénticas en runtime |

## 12. Estado final

- `npm run typecheck` → 0 errores.
- `npm run build:ui` reproducible (los `.js` de `public/js` coinciden con fuentes TS).
- Servidor arrancado con tsx: 204/204 checks + regresiones puntuales en verde.
- Commit local de la migración (push a `origin/main` solo con confirmación:
  dispara deploy en Vercel).
