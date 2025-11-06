export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    name: process.env.DB_NAME ?? 'unitask',
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? 'super-secret',
    accessExpiresIn: process.env.JWT_ACCESS_EXP ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXP ?? '7d',
  },
  files: {
    dir: process.env.FILES_DIR ?? 'uploads',
  },
});
