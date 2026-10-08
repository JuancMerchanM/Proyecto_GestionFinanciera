import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { env } from './env.mjs';

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'API Finanzas del Hogar',
      version: '1.0.0',
      description:
        'API REST de la aplicación de finanzas del hogar: autenticación, hogares, cuentas, ' +
        'categorías, transacciones, presupuestos y reportes. Los montos se envían y devuelven ' +
        'siempre como **enteros en la unidad mínima** de la moneda del hogar ' +
        '(ej: 50000 con currency COP = $50.000 COP; 1050 con currency USD = US$10.50).',
    },
    servers: [
      { url: `http://localhost:${env.port}`, description: 'Servidor local' },
      { url: `https://proyecto-gestion-financiera-eta.vercel.app`, description: 'Servidor desplegado en vercel' }
    ],
    tags: [
      { name: 'Sistema', description: 'Salud del servicio' },
      { name: 'Autenticación', description: 'Registro, login, perfil y logout' },
      { name: 'Hogares', description: 'Hogares y miembros' },
      { name: 'Invitaciones', description: 'Códigos de invitación manuales' },
      { name: 'Categorías', description: 'CRUD de categorías con color/tipo' },
      { name: 'Cuentas', description: 'CRUD de cuentas con saldo calculado' },
      { name: 'Transacciones', description: 'Movimientos con filtros y paginación' },
      { name: 'Presupuestos', description: 'Presupuesto mensual por categoría y consumo' },
      { name: 'Reportes', description: 'Resumen del dashboard y gastos por categoría' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Header `Authorization: Bearer <token>`',
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'token',
          description: 'Cookie `httpOnly` emitida en el login (usada por las vistas EJS)',
        },
      },
      parameters: {
        homeId: {
          in: 'path',
          name: 'homeId',
          required: true,
          schema: { type: 'string' },
          description: 'ID del hogar; debe pertenecer a user.homeIds (aislamiento)',
        },
        inviteCode: {
          in: 'path',
          name: 'code',
          required: true,
          schema: { type: 'string', example: 'AB3K9ZQ2' },
          description: 'Código de invitación',
        },
        categoryId: {
          in: 'path',
          name: 'categoryId',
          required: true,
          schema: { type: 'string' },
          description: 'ID de la categoría (debe pertenecer al hogar)',
        },
        accountId: {
          in: 'path',
          name: 'accountId',
          required: true,
          schema: { type: 'string' },
          description: 'ID de la cuenta (debe pertenecer al hogar)',
        },
        transactionId: {
          in: 'path',
          name: 'transactionId',
          required: true,
          schema: { type: 'string' },
          description: 'ID de la transacción (debe pertenecer al hogar)',
        },
        budgetId: {
          in: 'path',
          name: 'budgetId',
          required: true,
          schema: { type: 'string' },
          description: 'ID del presupuesto (debe pertenecer al hogar)',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '652f1c2e9a1b2c3d4e5f6a7b' },
            name: { type: 'string', example: 'Ana Pérez' },
            email: { type: 'string', format: 'email', example: 'ana@ejemplo.com' },
          },
        },
        Home: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '652f1c2e9a1b2c3d4e5f6a7c' },
            name: { type: 'string', example: 'Hogar Pérez' },
            currency: { type: 'string', enum: ['COP', 'USD'], example: 'COP' },
            role: { type: 'string', enum: ['admin', 'member'], nullable: true, example: 'admin' },
            membersCount: { type: 'integer', example: 2 },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Member: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
            name: { type: 'string', example: 'Ana Pérez' },
            email: { type: 'string', format: 'email' },
            role: { type: 'string', enum: ['admin', 'member'] },
            joinedAt: { type: 'string', format: 'date-time' },
          },
        },
        Invite: {
          type: 'object',
          properties: {
            code: { type: 'string', example: 'AB3K9ZQ2' },
            role: { type: 'string', enum: ['admin', 'member'], example: 'member' },
            email: { type: 'string', format: 'email', nullable: true },
            status: { type: 'string', enum: ['pending', 'accepted', 'rejected'] },
            expiresAt: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        InvitePreview: {
          type: 'object',
          properties: {
            code: { type: 'string', example: 'AB3K9ZQ2' },
            status: { type: 'string', enum: ['pending', 'accepted', 'rejected'] },
            expiresAt: { type: 'string', format: 'date-time' },
            role: { type: 'string', enum: ['admin', 'member'] },
            email: { type: 'string', nullable: true },
            home: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, currency: { type: 'string' } } },
            invitedBy: { type: 'string', example: 'Ana Pérez' },
          },
        },
        Category: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string', example: 'Alimentación' },
            color: { type: 'string', example: '#e74c3c' },
            type: { type: 'string', enum: ['income', 'expense'] },
            isDefault: { type: 'boolean', example: true },
            archived: { type: 'boolean', example: false },
          },
        },
        CategoryInput: {
          type: 'object',
          required: ['name', 'type'],
          properties: {
            name: { type: 'string', minLength: 2, maxLength: 40, example: 'Mascotas' },
            color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$', example: '#ff8a3d', nullable: true },
            type: { type: 'string', enum: ['income', 'expense'], example: 'expense' },
          },
        },
        Account: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string', example: 'Efectivo' },
            type: { type: 'string', enum: ['cash', 'bank', 'card', 'savings'], example: 'cash' },
            typeLabel: { type: 'string', example: 'Efectivo' },
            currency: { type: 'string', enum: ['COP', 'USD'] },
            openingBalanceMinor: { type: 'integer', example: 100000 },
            balanceMinor: {
              type: 'integer',
              nullable: true,
              example: 120000,
              description: 'Saldo actual = inicial + ingresos − gastos (entero en unidad mínima)',
            },
            archived: { type: 'boolean', example: false },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        AccountInput: {
          type: 'object',
          required: ['name', 'type'],
          properties: {
            name: { type: 'string', minLength: 2, maxLength: 40, example: 'Davivienda' },
            type: { type: 'string', enum: ['cash', 'bank', 'card', 'savings'], example: 'bank' },
            openingBalanceMinor: {
              type: 'integer',
              default: 0,
              example: 100000,
              description: 'Entero en unidad mínima de la moneda del hogar (COP sin decimales: 100000 = $100.000)',
            },
            currency: { type: 'string', enum: ['COP', 'USD'], nullable: true, description: 'Opcional; debe coincidir con la moneda del hogar' },
          },
        },
        Transaction: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            type: { type: 'string', enum: ['income', 'expense'] },
            amountMinor: { type: 'integer', example: 50000, description: 'Entero en unidad mínima (COP: 50000 = $50.000)' },
            currency: { type: 'string', enum: ['COP', 'USD'] },
            date: { type: 'string', format: 'date', example: '2026-10-06' },
            note: { type: 'string', maxLength: 200 },
            accountId: { type: 'string' },
            account: { type: 'object', nullable: true, properties: { id: { type: 'string' }, name: { type: 'string' }, type: { type: 'string' } } },
            categoryId: { type: 'string' },
            category: { type: 'object', nullable: true, properties: { id: { type: 'string' }, name: { type: 'string' }, color: { type: 'string' } } },
            userId: { type: 'string', nullable: true, description: 'Autor del movimiento' },
            user: { type: 'object', nullable: true, properties: { id: { type: 'string' }, name: { type: 'string' } } },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        TransactionInput: {
          type: 'object',
          required: ['type', 'amountMinor', 'date', 'accountId', 'categoryId'],
          properties: {
            type: { type: 'string', enum: ['income', 'expense'], example: 'expense' },
            amountMinor: { type: 'integer', minimum: 1, example: 50000 },
            date: { type: 'string', format: 'date', example: '2026-10-06' },
            accountId: { type: 'string', description: 'Cuenta del mismo hogar' },
            categoryId: { type: 'string', description: 'Categoría del mismo hogar y mismo tipo' },
            note: { type: 'string', maxLength: 200, nullable: true },
          },
        },
        Budget: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            homeId: { type: 'string' },
            categoryId: { type: 'string' },
            category: {
              type: 'object',
              nullable: true,
              properties: {
                id: { type: 'string' },
                name: { type: 'string', example: 'Alimentación' },
                color: { type: 'string', example: '#e74c3c' },
                type: { type: 'string', enum: ['income', 'expense'] },
              },
            },
            month: { type: 'string', pattern: '^\d{4}-(0[1-9]|1[0-2])$', example: '2026-11' },
            limitMinor: { type: 'integer', minimum: 1, example: 300000 },
            currency: { type: 'string', enum: ['COP', 'USD'] },
            spentMinor: { type: 'integer', example: 350000, description: 'Gastos de la categoría en ese mes' },
            percent: { type: 'integer', example: 116, description: 'floor(spent*100/limit)' },
            exceeded: { type: 'boolean', example: true, description: 'spent > limit' },
            overMinor: { type: 'integer', example: 50000, description: 'Cuánto excede el límite (0 si no)' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        BudgetInput: {
          type: 'object',
          required: ['categoryId', 'month', 'limitMinor'],
          properties: {
            categoryId: { type: 'string', description: 'Categoría de gasto (expense) del hogar' },
            month: { type: 'string', pattern: '^\d{4}-(0[1-9]|1[0-2])$', example: '2026-11' },
            limitMinor: {
              type: 'integer',
              minimum: 1,
              example: 300000,
              description: 'Entero en unidad mínima (COP: 300000 = $300.000)',
            },
          },
        },
        ReportSummary: {
          type: 'object',
          properties: {
            currency: { type: 'string', enum: ['COP', 'USD'] },
            range: {
              type: 'object',
              properties: {
                from: { type: 'string', format: 'date', example: '2026-12-01' },
                to: { type: 'string', format: 'date', example: '2026-12-31' },
                days: { type: 'integer', example: 31 },
              },
            },
            previous: {
              type: 'object',
              description: 'Periodo anterior de igual duración (mes anterior si el rango es un mes)',
              properties: {
                from: { type: 'string', format: 'date' },
                to: { type: 'string', format: 'date' },
                incomeMinor: { type: 'integer', example: 400000 },
                expenseMinor: { type: 'integer', example: 100000 },
                netMinor: { type: 'integer', example: 300000 },
              },
            },
            balanceMinor: { type: 'integer', example: 150000, description: 'Balance total de cuentas activas (todos los tiempos)' },
            incomeMinor: { type: 'integer', example: 300000, description: 'Ingresos del rango' },
            expenseMinor: { type: 'integer', example: 200000, description: 'Gastos del rango' },
            netMinor: { type: 'integer', example: 100000, description: 'ingresos − gastos del rango' },
            expensesByCategory: {
              type: 'array',
              description: 'Gastos por categoría del rango, de mayor a menor (datos del donut)',
              items: {
                type: 'object',
                properties: {
                  categoryId: { type: 'string', nullable: true },
                  category: { type: 'object', nullable: true, properties: { id: { type: 'string' }, name: { type: 'string' }, color: { type: 'string' } } },
                  label: { type: 'string', example: 'Alimentación' },
                  amountMinor: { type: 'integer', example: 100000 },
                  percent: { type: 'integer', example: 50, description: 'floor(parte*100/total gastos del rango)' },
                },
              },
            },
          },
        },
        PaginationMeta: {
          type: 'object',
          properties: {
            page: { type: 'integer', example: 1 },
            limit: { type: 'integer', example: 20 },
            total: { type: 'integer', example: 57 },
            totalPages: { type: 'integer', example: 3 },
            hasNext: { type: 'boolean' },
            hasPrev: { type: 'boolean' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Mensaje de error' },
            details: { type: 'object', nullable: true },
          },
        },
      },
      responses: {
        Validation: {
          description: 'Datos inválidos (validación de servidor)',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        Unauthorized: {
          description: 'JWT faltante, inválido o expirado',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        Forbidden: {
          description: 'Sin permiso sobre el hogar solicitado (aislamiento)',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
      },
    },
    security: [{ bearerAuth: [] }, { cookieAuth: [] }],
  },
  apis: ['./src/routes/api/*.mjs', './src/routes/health.mjs', './src/controllers/api/*.mjs'],
};

export const swaggerSpec = swaggerJsdoc(options);

const SWAGGER_UI_CDN = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.33.1';

const swaggerHtmlTemplate = `
<!-- HTML for static distribution bundle build -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <% robotsMetaString %>
  <title><% title %></title>
  <link rel="stylesheet" type="text/css" href="${SWAGGER_UI_CDN}/swagger-ui.css" >
  <% favIconString %>
  <style>
    html
    {
      box-sizing: border-box;
      overflow: -moz-scrollbars-vertical;
      overflow-y: scroll;
    }
    *,
    *:before,
    *:after
    {
      box-sizing: inherit;
    }

    body {
      margin:0;
      background: #fafafa;
    }
  </style>
</head>

<body>

<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" style="position:absolute;width:0;height:0">
  <defs>
    <symbol viewBox="0 0 20 20" id="unlocked">
      <path d="M15.8 8H14V5.6C14 2.703 12.665 1 10 1 7.334 1 6 2.703 6 5.6V6h2v-.801C8 3.754 8.797 3 10 3c1.203 0 2 .754 2 2.199V8H4c-.553 0-1 .646-1 1.199V17c0 .549.428 1.139.951 1.307l1.197.387C5.672 18.861 6.55 19 7.1 19h5.8c.549 0 1.428-.139 1.951-.307l1.196-.387c.524-.167.953-.757.953-1.306V9.199C17 8.646 16.352 8 15.8 8z"></path>
    </symbol>

    <symbol viewBox="0 0 20 20" id="locked">
      <path d="M15.8 8H14V5.6C14 2.703 12.665 1 10 1 7.334 1 6 2.703 6 5.6V8H4c-.553 0-1 .646-1 1.199V17c0 .549.428 1.139.951 1.307l1.197.387C5.672 18.861 6.55 19 7.1 19h5.8c.549 0 1.428-.139 1.951-.307l1.196-.387c.524-.167.953-.757.953-1.306V9.199C17 8.646 16.352 8 15.8 8zM12 8H8V5.199C8 3.754 8.797 3 10 3c1.203 0 2 .754 2 2.199V8z"/>
    </symbol>

    <symbol viewBox="0 0 20 20" id="close">
      <path d="M14.348 14.849c-.469.469-1.229.469-1.697 0L10 11.819l-2.651 3.029c-.469.469-1.229.469-1.697 0-.469-.469-.469-1.229 0-1.697l2.758-3.15-2.759-3.152c-.469-.469-.469-1.228 0-1.697.469-.469 1.228-.469 1.697 0L10 8.183l2.651-3.031c.469-.469 1.228-.469 1.697 0 .469.469.469 1.229 0 1.697l-2.758 3.152 2.758 3.15c.469.469.469 1.229 0 1.698z"/>
    </symbol>

    <symbol viewBox="0 0 20 20" id="large-arrow">
      <path d="M13.25 10L6.109 2.58c-.268-.27-.268-.707 0-.979.268-.27.701-.27.969 0l7.83 7.908c.268.271.268.709 0 .979l-7.83 7.908c-.268.271-.701.27-.969 0-.268-.269-.268-.707 0-.979L13.25 10z"/>
    </symbol>

    <symbol viewBox="0 0 20 20" id="large-arrow-down">
      <path d="M17.418 6.109c.272-.268.709-.268.979 0s.271.701 0 .969l-7.908 7.83c-.27.268-.707.268-.979 0l-7.908-7.83c-.27-.268-.27-.701 0-.969.271-.268.709-.268.979 0L10 13.25l7.418-7.141z"/>
    </symbol>


    <symbol viewBox="0 0 24 24" id="jump-to">
      <path d="M19 7v4H5.83l3.58-3.59L8 6l-6 6 6 6 1.41-1.41L5.83 13H21V7z"/>
    </symbol>

    <symbol viewBox="0 0 24 24" id="expand">
      <path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"/>
    </symbol>

  </defs>
</svg>

<div id="swagger-ui"></div>

<script src="${SWAGGER_UI_CDN}/swagger-ui-bundle.js"> </script>
<script src="${SWAGGER_UI_CDN}/swagger-ui-standalone-preset.js"> </script>
<script src="/api-docs/swagger-ui-init.js"> </script>
<% customJs %>
<% customJsStr %>
<% customCssUrl %>
<style>
  <% customCss %>
</style>
</body>

</html>
`;

export const swaggerHtml = swaggerUi.generateHTML(
  swaggerSpec,
  { explorer: false, customfavIcon: `${SWAGGER_UI_CDN}/favicon-32x32.png` },
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  swaggerHtmlTemplate
);
