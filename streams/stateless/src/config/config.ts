const convict = require('convict');

export const config = convict({
  tableName: {
    doc: 'The database table for film streaming',
    format: String,
    default: 'tableName',
    env: 'TABLE_NAME',
  },
}).validate({ allowed: 'strict' });
