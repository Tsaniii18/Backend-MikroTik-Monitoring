import { Sequelize } from "sequelize";

export const createSequelize = (env) => {
  const sequelize = new Sequelize(env.DB_NAME, env.DB_USER, env.DB_PASS, {
    host: env.DB_HOST,
    dialect: "mysql",
    logging: false,
    timezone: "+07:00",
    dialectOptions: { timezone: "+07:00" }
  });

  return sequelize;
};
