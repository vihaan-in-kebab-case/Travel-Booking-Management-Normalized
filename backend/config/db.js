const oracledb = require("oracledb");
const dotenv = require("dotenv");

dotenv.config();

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.autoCommit = false;

let pool;

async function getPool() {
  if (!pool) {
    pool = await oracledb.createPool({
      user: process.env.ORACLE_USER,
      password: process.env.ORACLE_PASSWORD,
      connectString: process.env.ORACLE_CONNECTION_STRING,
      poolMin: Number(process.env.ORACLE_POOL_MIN || 1),
      poolMax: Number(process.env.ORACLE_POOL_MAX || 10),
      poolIncrement: Number(process.env.ORACLE_POOL_INCREMENT || 1)
    });
  }

  return pool;
}

async function getConnection() {
  const activePool = await getPool();
  return activePool.getConnection();
}

function normalizeRow(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key.toLowerCase(), value])
  );
}

function normalizeRows(rows = []) {
  return rows.map(normalizeRow);
}

async function execute(connection, sql, binds = {}, options = {}) {
  return connection.execute(sql, binds, {
    outFormat: oracledb.OUT_FORMAT_OBJECT,
    ...options
  });
}

async function executeMany(connection, sql, binds = [], options = {}) {
  return connection.executeMany(sql, binds, {
    ...options
  });
}

async function withConnection(work) {
  const connection = await getConnection();

  try {
    return await work(connection);
  } finally {
    await connection.close();
  }
}

async function withTransaction(work) {
  return withConnection(async (connection) => {
    try {
      const result = await work(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  });
}

async function closePool() {
  if (pool) {
    await pool.close(0);
    pool = null;
  }
}

module.exports = {
  oracledb,
  getPool,
  getConnection,
  execute,
  executeMany,
  normalizeRow,
  normalizeRows,
  withConnection,
  withTransaction,
  closePool
};
