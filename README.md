# InventarioPro
Sistema Integral de Gestión de Productos y Control de Usuarios
Guía Práctica de Laboratorio N°05 - Programación Web (Bootstrap 5 + Backend)

## Tecnologías
- Frontend: HTML5, CSS3, JavaScript, Bootstrap 5.3
- Backend: Node.js + Express (sesiones con express-session)
- Base de datos: SQLite (tablas `usuarios` y `productos`, ver `database/schema.sql`)
- Seguridad: contraseñas con hash bcrypt, validaciones en frontend y backend

## Ejecutar
```
npm install
npm start
```
Abrir http://localhost:3000

Usuario de prueba: admin@inventariopro.com / Admin123

## Estructura
```
server.js            API REST y servidor
database/schema.sql  Esquema de la base de datos
public/              Interfaz (login, registro, panel, CRUD de productos, usuarios)
```

## API
| Método | Ruta | Descripción |
|---|---|---|
| POST | /api/registro | Registrar usuario |
| POST | /api/login | Iniciar sesión |
| POST | /api/logout | Cerrar sesión |
| GET | /api/resumen | Métricas del panel |
| GET | /api/usuarios | Listar usuarios |
| GET / POST | /api/productos | Listar / crear producto |
| GET / PUT / DELETE | /api/productos/:sku | Leer / modificar / eliminar |

## GitHub Pages
GitHub Pages no ejecuta Node.js. Al publicar la carpeta `public/` funciona en **modo demo**
(los datos se guardan en el navegador con localStorage, mismas pantallas y validaciones).
Con `npm start` funciona con el backend y la base de datos reales.
