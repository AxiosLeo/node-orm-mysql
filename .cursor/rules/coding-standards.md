# Coding Standards for @axiosleo/orm-mysql

## File Organization

### Directory Structure
```
src/
├── builder.js      # SQL query builders
├── client.js       # Database connection management
├── core.js         # Core query execution logic
├── hook.js         # Event hooks system
├── migration.js    # Database migration system
├── operator.js     # Query operators and handlers
├── query.js        # Query builder classes
├── transaction.js  # Transaction management
└── utils.js        # Utility functions

tests/              # Test files
commands/           # CLI commands
examples/           # Usage examples
```

### File Naming
- Use kebab-case for file names: `query-builder.js`
- Use PascalCase for class files when appropriate
- Test files should end with `.tests.js`
- Example files should be descriptive: `basic-usage.js`

## Code Style Guidelines

### JavaScript Standards

1. **Strict Mode**
   ```javascript
   'use strict';
   ```

2. **Variable Declarations**
   ```javascript
   // Use const for immutable values
   const connectionOptions = { host: 'localhost' };
   
   // Use let for mutable values
   let queryResult = null;
   
   // Avoid var
   ```

3. **Function Declarations**
   ```javascript
   // Prefer async/await over promises
   async function executeQuery(sql, params) {
     try {
       const result = await connection.query(sql, params);
       return result;
     } catch (error) {
       throw new Error(`Query execution failed: ${error.message}`);
     }
   }
   
   // Use arrow functions for short callbacks
   const users = results.map(row => ({ id: row.id, name: row.name }));
   ```

4. **Object and Array Destructuring**
   ```javascript
   // Object destructuring
   const { host, port, database } = connectionConfig;
   
   // Array destructuring
   const [firstResult] = await query.select();
   ```

5. **Template Literals**
   ```javascript
   // Use template literals for string interpolation
   const message = `Connected to database: ${database}`;
   
   // For SQL, use parameterized queries instead
   const sql = 'SELECT * FROM users WHERE id = ?';
   ```

### Class Design

1. **Class Structure**
   ```javascript
   class QueryBuilder {
     constructor(connection, options = {}) {
       this.connection = connection;
       this.options = { ...defaultOptions, ...options };
       this._conditions = [];
       this._tables = [];
     }
     
     // Public methods
     table(tableName, alias = null) {
       this._tables.push({ table: tableName, alias });
       return this;
     }
     
     // Private methods (prefix with _)
     _buildConditions() {
       return this._conditions.map(condition => this._formatCondition(condition));
     }
     
     _formatCondition(condition) {
       // Implementation
     }
   }
   ```

2. **Method Chaining**
   ```javascript
   // Enable fluent interface by returning 'this'
   where(field, operator, value) {
     this._conditions.push({ field, operator, value });
     return this;
   }
   
   // Usage
   const result = await query
     .table('users')
     .where('status', '=', 'active')
     .where('age', '>', 18)
     .select();
   ```

### Error Handling

1. **Custom Error Classes**
   ```javascript
   class QueryError extends Error {
     constructor(message, sql, params) {
       super(message);
       this.name = 'QueryError';
       this.sql = sql;
       this.params = params;
     }
   }
   ```

2. **Error Context**
   ```javascript
   try {
     const result = await this._executeQuery(sql, params);
     return result;
   } catch (error) {
     throw new QueryError(
       `Failed to execute query: ${error.message}`,
       sql,
       params
     );
   }
   ```

3. **Input Validation**
   ```javascript
   validateTableName(tableName) {
     if (!tableName || typeof tableName !== 'string') {
       throw new Error('Table name must be a non-empty string');
     }
     if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
       throw new Error('Invalid table name format');
     }
   }
   ```

## Documentation Standards

### JSDoc Comments

1. **Class Documentation**
   ```javascript
   /**
    * Query builder for MySQL operations
    * @class QueryBuilder
    * @example
    * const query = new QueryBuilder(connection);
    * const users = await query.table('users').where('active', true).select();
    */
   class QueryBuilder {
   ```

2. **Method Documentation**
   ```javascript
   /**
    * Add a WHERE condition to the query
    * @param {string} field - The field name
    * @param {string|*} operator - The operator or value if operator is '='
    * @param {*} [value] - The value to compare against
    * @returns {QueryBuilder} Returns this for method chaining
    * @throws {Error} When field name is invalid
    * @example
    * query.where('name', 'John')
    * query.where('age', '>', 18)
    */
   where(field, operator, value) {
   ```

3. **Type Definitions**
   ```javascript
   /**
    * @typedef {Object} ConnectionOptions
    * @property {string} host - Database host
    * @property {number} port - Database port
    * @property {string} user - Database user
    * @property {string} password - Database password
    * @property {string} database - Database name
    */
   ```

### README and Examples

1. **Clear Examples**
   ```javascript
   // Basic usage
   const { createClient, QueryHandler } = require('@axiosleo/orm-mysql');
   
   const client = createClient({
     host: 'localhost',
     user: 'root',
     password: 'password',
     database: 'myapp'
   });
   
   const db = new QueryHandler(client);
   
   // Simple query
   const users = await db.table('users')
     .where('status', 'active')
     .select();
   ```

2. **Migration Examples**
   ```javascript
   // Migration file: 20231201_create_users_table.js
   function up(migration) {
     migration.createTable('users', {
       id: {
         type: 'int',
         allowNull: false,
         primaryKey: true,
         autoIncrement: true
       },
       email: {
         type: 'varchar',
         length: 255,
         allowNull: false,
         uniqIndex: true
       },
       created_at: {
         type: 'timestamp',
         allowNull: false,
         default: 'CURRENT_TIMESTAMP'
       }
     });
   }
   
   function down(migration) {
     migration.dropTable('users');
   }
   
   module.exports = { up, down };
   ```

## Testing Standards

### Test Structure

1. **Test Organization**
   ```javascript
   'use strict';
   
   const { expect } = require('chai');
   const { QueryBuilder } = require('../src/query-builder');
   
   describe('QueryBuilder', () => {
     let queryBuilder;
     
     beforeEach(() => {
       queryBuilder = new QueryBuilder(mockConnection);
     });
     
     describe('#where()', () => {
       it('should add simple where condition', () => {
         queryBuilder.where('name', 'John');
         expect(queryBuilder._conditions).to.have.length(1);
       });
       
       it('should handle operator and value', () => {
         queryBuilder.where('age', '>', 18);
         const condition = queryBuilder._conditions[0];
         expect(condition.operator).to.equal('>');
         expect(condition.value).to.equal(18);
       });
     });
   });
   ```

2. **Mock Objects**
   ```javascript
   const mockConnection = {
     query: sinon.stub().resolves([{ id: 1, name: 'John' }]),
     execute: sinon.stub().resolves([{ insertId: 1 }])
   };
   ```

3. **Integration Tests**
   ```javascript
   describe('Database Integration', () => {
     let connection;
     
     before(async () => {
       connection = await createTestConnection();
       await setupTestTables(connection);
     });
     
     after(async () => {
       await cleanupTestTables(connection);
       await connection.end();
     });
     
     it('should perform CRUD operations', async () => {
       const db = new QueryHandler(connection);
       
       // Create
       const result = await db.table('test_users')
         .insert({ name: 'Test User', email: 'test@example.com' });
       
       expect(result.insertId).to.be.a('number');
       
       // Read
       const user = await db.table('test_users')
         .where('id', result.insertId)
         .find();
       
       expect(user.name).to.equal('Test User');
     });
   });
   ```

## Performance Guidelines

### Query Optimization

1. **Use Appropriate Methods**
   ```javascript
   // Use find() for single records
   const user = await db.table('users').where('id', 1).find();
   
   // Use select() for multiple records
   const users = await db.table('users').where('active', true).select();
   
   // Use count() for counting
   const userCount = await db.table('users').where('active', true).count();
   ```

2. **Limit Result Sets**
   ```javascript
   // Always use limit for large datasets
   const recentUsers = await db.table('users')
     .orderBy('created_at', 'desc')
     .limit(100)
     .select();
   ```

3. **Index Usage**
   ```javascript
   // Create indexes for frequently queried columns
   migration.createIndex('users', ['email'], { unique: true });
   migration.createIndex('users', ['status', 'created_at']);
   ```

### Connection Management

1. **Connection Pooling**
   ```javascript
   // Use connection pools for production
   const pool = createPool({
     host: 'localhost',
     user: 'root',
     password: 'password',
     database: 'myapp',
     connectionLimit: 10,
     acquireTimeout: 60000,
     timeout: 60000
   });
   ```

2. **Transaction Scope**
   ```javascript
   // Keep transactions short
   async function transferFunds(fromId, toId, amount) {
     const transaction = new TransactionHandler(connection);
     await transaction.begin();
     
     try {
       await transaction.table('accounts')
         .where('id', fromId)
         .update({ balance: db.raw('balance - ?', [amount]) });
       
       await transaction.table('accounts')
         .where('id', toId)
         .update({ balance: db.raw('balance + ?', [amount]) });
       
       await transaction.commit();
     } catch (error) {
       await transaction.rollback();
       throw error;
     }
   }
   ```

## Security Guidelines

### SQL Injection Prevention

1. **Parameterized Queries**
   ```javascript
   // Always use parameterized queries
   const users = await db.table('users')
     .where('email', userEmail)  // Safe
     .select();
   
   // Never use string concatenation
   // const sql = `SELECT * FROM users WHERE email = '${userEmail}'`; // DANGEROUS
   ```

2. **Input Validation**
   ```javascript
   function validateEmail(email) {
     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
     if (!emailRegex.test(email)) {
       throw new Error('Invalid email format');
     }
   }
   
   function validateId(id) {
     const numericId = parseInt(id, 10);
     if (!Number.isInteger(numericId) || numericId <= 0) {
       throw new Error('Invalid ID');
     }
     return numericId;
   }
   ```

### Data Sanitization

1. **Output Encoding**
   ```javascript
   function sanitizeOutput(data) {
     if (typeof data === 'string') {
       return data.replace(/[<>&"']/g, (match) => {
         const escapeMap = {
           '<': '&lt;',
           '>': '&gt;',
           '&': '&amp;',
           '"': '&quot;',
           "'": '&#x27;'
         };
         return escapeMap[match];
       });
     }
     return data;
   }
   ```

## Migration Guidelines

### Schema Changes

1. **Incremental Migrations**
   ```javascript
   // Good: Small, focused changes
   function up(migration) {
     migration.createColumn('users', 'phone', 'varchar', {
       length: 20,
       allowNull: true
     });
   }
   
   // Avoid: Large, complex changes in single migration
   ```

2. **Data Migrations**
   ```javascript
   function up(migration) {
     // Schema change first
     migration.createColumn('users', 'full_name', 'varchar', { length: 255 });
     
     // Data migration
     migration.insertData('temp_update', [
       { sql: "UPDATE users SET full_name = CONCAT(first_name, ' ', last_name)" }
     ]);
     
     // Cleanup old columns (in separate migration)
   }
   ```

3. **Rollback Support**
   ```javascript
   function up(migration) {
     migration.createTable('new_table', {
       id: { type: 'int', primaryKey: true, autoIncrement: true },
       name: { type: 'varchar', length: 255, allowNull: false }
     });
   }
   
   function down(migration) {
     migration.dropTable('new_table');
   }
   ```

## CLI Development

### Command Structure

1. **Command Files**
   ```javascript
   // commands/generate.js
   'use strict';
   
   const { Command } = require('@axiosleo/cli-tool');
   
   class GenerateCommand extends Command {
     constructor() {
       super({
         name: 'generate',
         desc: 'Generate migration file',
         alias: 'gen'
       });
     }
     
     exec(args, options, app) {
       // Command implementation
     }
   }
   
   module.exports = GenerateCommand;
   ```

2. **Help Documentation**
   ```javascript
   constructor() {
     super({
       name: 'migrate',
       desc: 'Run database migrations',
       args: [
         { name: 'action', mode: 'required', desc: 'Migration action (up|down)' },
         { name: 'dir', desc: 'Migration directory path' }
       ],
       options: [
         { name: 'debug', alias: 'd', desc: 'Enable debug mode' },
         { name: 'host', desc: 'Database host', default: 'localhost' }
       ]
     });
   }
   ```

These coding standards ensure consistency, maintainability, and reliability across the @axiosleo/orm-mysql project.
