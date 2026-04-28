import { DataTypes } from "sequelize";

export const initModels = (sequelize) => {
  const Event = sequelize.define("Event", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    routerName: { type: DataTypes.STRING, allowNull: false },
    routerIp: { type: DataTypes.STRING, allowNull: false },
    ruleId: { type: DataTypes.STRING, allowNull: false },
    type: { type: DataTypes.STRING, allowNull: false },
    status: { type: DataTypes.ENUM("active", "cooldown", "ended"), allowNull: false, defaultValue: "active" },
    evidence: { type: DataTypes.JSON, allowNull: true },
    startedAt: { type: DataTypes.DATE, allowNull: false },
    lastSeenAt: { type: DataTypes.DATE, allowNull: false },
    cooldownUntil: { type: DataTypes.DATE, allowNull: true },
    endedAt: { type: DataTypes.DATE, allowNull: true }
  }, {
    tableName: "events",
    underscored: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at"
  });

  const Indication = sequelize.define("Indication", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    source_device: { type: DataTypes.JSON, allowNull: false },
    correlationId: { type: DataTypes.STRING, allowNull: false },
    indication: { type: DataTypes.STRING, allowNull: false },
    recommended_action: { type: DataTypes.TEXT, allowNull: true },
    status: { type: DataTypes.ENUM("active", "ended"), allowNull: false, defaultValue: "active" },
    startedAt: { type: DataTypes.DATE, allowNull: false },
    endedAt: { type: DataTypes.DATE, allowNull: true }
  }, {
    tableName: "indications",
    underscored: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at"
  });

  const IndicationComponent = sequelize.define("IndicationComponent", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    indicationId: { type: DataTypes.INTEGER, allowNull: false },
    eventId: { type: DataTypes.INTEGER, allowNull: false }
  }, {
    tableName: "indication_components",
    underscored: true,
    timestamps: false
  });

  // Associations
  Indication.belongsToMany(Event, { through: IndicationComponent, foreignKey: "indicationId", otherKey: "eventId" });
  Event.belongsToMany(Indication, { through: IndicationComponent, foreignKey: "eventId", otherKey: "indicationId" });

  return { Event, Indication, IndicationComponent };
};