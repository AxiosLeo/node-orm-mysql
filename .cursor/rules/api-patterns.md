# API Patterns for @axiosleo/orm-mysql

## Query Builder Patterns

### Basic Query Construction

1. **Table Selection**
   ```javascript
   // Single table
   const query = db.table('users');
   
   // Table with alias
   const query = db.table('users', 'u');
   
   // Multiple tables
   const query = db.tables(
     { table: 'users', alias: 'u' },
     { table: 'profiles', alias: 'p' }
   );
   ```

2. **Attribute Selection**
   ```javascript
   // Select all columns
   const users = await db.table('users').select();
   
   // Select specific columns
   const users = await db.table('users').select('id', 'name', 'email');
   
   // Using attr() method
   const users = await db.table('users')
     .attr('id', 'name', 'email')
     .select();
   
   // Subquery as attribute
   const usersWithPostCount = await db.table('users', 'u')
     .attr('u.id', 'u.name', () => {
       return new Query('select')
         .table('posts')
         .where('user_id', '`u.id`')
         .attr('COUNT(*)')
         .alias('post_count');
     })
     .select();
   ```

### Condition Building

1. **Basic WHERE Conditions**
   ```javascript
   // Equality
   query.where('status', 'active');
   query.where('id', '=', 1);
   
   // Comparison operators
   query.where('age', '>', 18);
   query.where('created_at', '<=', new Date());
   
   // Multiple conditions (AND by default)
   query.where('status', 'active')
        .where('age', '>', 18);
   ```

2. **Logical Operators**
   ```javascript
   // OR conditions
   query.where('status', 'active')
        .whereOr()
        .where('role', 'admin');
   
   // Complex grouping
   query.where('status', 'active')
        .whereAnd()
        .groupWhere(
          ['age', '>', 18],
          'OR',
          ['role', 'admin']
        );
   ```

3. **Advanced Conditions**
   ```javascript
   // IN conditions
   query.whereIn('id', [1, 2, 3, 4]);
   query.whereNotIn('status', ['deleted', 'banned']);
   
   // BETWEEN conditions
   query.whereBetween('age', [18, 65]);
   query.whereNotBetween('created_at', [startDate, endDate]);
   
   // LIKE conditions
   query.whereLike('name', '%john%');
   query.whereNotLike('email', '%spam%');
   
   // NULL conditions
   query.where('deleted_at', null);
   query.where('deleted_at', '!=', null);
   
   // JSON conditions (MySQL 5.7+)
   query.where('metadata->name', 'John');
   query.whereContain('tags->hobbies', 'reading');
   query.whereOverlaps('permissions->roles', ['admin', 'user']);
   ```

4. **Subquery Conditions**
   ```javascript
   // Subquery in WHERE
   const subQuery = new Query('select')
     .table('orders')
     .where('status', 'completed')
     .attr('user_id');
   
   const users = await db.table('users')
     .where('id', subQuery, 'IN')
     .select();
   ```

### Joins

1. **Basic Joins**
   ```javascript
   // Inner join
   query.innerJoin('profiles', 'users.id = profiles.user_id');
   
   // Left join
   query.leftJoin('profiles', 'users.id = profiles.user_id', { alias: 'p' });
   
   // Right join
   query.rightJoin('orders', 'users.id = orders.user_id');
   ```

2. **Advanced Join Options**
   ```javascript
   // Join with subquery
   const subQuery = new Query('select')
     .table('order_items')
     .attr('order_id', 'SUM(price) as total')
     .groupBy('order_id');
   
   query.join({
     table: subQuery,
     alias: 'order_totals',
     self_column: 'orders.id',
     foreign_column: 'order_totals.order_id',
     join_type: 'left'
   });
   ```

### Sorting and Pagination

1. **Ordering**
   ```javascript
   // Single column
   query.orderBy('created_at', 'desc');
   
   // Multiple columns
   query.orderBy('status', 'asc')
        .orderBy('created_at', 'desc');
   ```

2. **Pagination**
   ```javascript
   // Using limit and offset
   query.limit(10).offset(20);
   
   // Using page method
   query.page(10, 2); // limit 10, page 2 (offset 10)
   ```

3. **Grouping and Having**
   ```javascript
   // Group by
   query.groupBy('status', 'department');
   
   // Having conditions
   query.groupBy('department')
        .having('COUNT(*)', '>', 5);
   ```

## CRUD Operations

### Create (Insert)

1. **Single Record**
   ```javascript
   // Basic insert
   const result = await db.table('users').insert({
     name: 'John Doe',
     email: 'john@example.com',
     status: 'active'
   });
   
   console.log(result.insertId); // Auto-generated ID
   ```

2. **Upsert (Insert or Update)**
   ```javascript
   // Insert with duplicate key handling
   const result = await db.table('users')
     .keys('email') // Unique key
     .insert({
       email: 'john@example.com',
       name: 'John Doe',
       status: 'active'
     });
   ```

3. **Batch Insert**
   ```javascript
   const users = [
     { name: 'John', email: 'john@example.com' },
     { name: 'Jane', email: 'jane@example.com' },
     { name: 'Bob', email: 'bob@example.com' }
   ];
   
   const results = await db.table('users').insertAll(users);
   ```

### Read (Select)

1. **Single Record**
   ```javascript
   // Find by ID
   const user = await db.table('users').where('id', 1).find();
   
   // Find with conditions
   const user = await db.table('users')
     .where('email', 'john@example.com')
     .where('status', 'active')
     .find();
   ```

2. **Multiple Records**
   ```javascript
   // All records
   const users = await db.table('users').select();
   
   // With conditions
   const activeUsers = await db.table('users')
     .where('status', 'active')
     .orderBy('created_at', 'desc')
     .select();
   
   // With pagination
   const users = await db.table('users')
     .where('status', 'active')
     .limit(10)
     .offset(0)
     .select();
   ```

3. **Counting**
   ```javascript
   // Total count
   const totalUsers = await db.table('users').count();
   
   // Conditional count
   const activeUsers = await db.table('users')
     .where('status', 'active')
     .count();
   ```

### Update

1. **Basic Update**
   ```javascript
   // Update with conditions
   const result = await db.table('users')
     .where('id', 1)
     .update({
       name: 'John Smith',
       updated_at: new Date()
     });
   
   console.log(result.affectedRows); // Number of updated rows
   ```

2. **Increment/Decrement**
   ```javascript
   // Increment by 1
   await db.table('users').where('id', 1).incrBy('login_count');
   
   // Increment by specific amount
   await db.table('users').where('id', 1).incrBy('points', 10);
   
   // Conditional increment
   await db.table('users').where('id', 1).incrBy('error_count', (current) => {
     return current > 5 ? 0 : 1; // Reset if too high
   });
   ```

3. **Upsert Pattern**
   ```javascript
   // Update or insert
   const result = await db.table('user_settings')
     .upsertRow(
       { user_id: 1, theme: 'dark', language: 'en' },
       { user_id: 1 } // Condition for existing record
     );
   ```

### Delete

1. **Conditional Delete**
   ```javascript
   // Delete with conditions
   const result = await db.table('users')
     .where('status', 'inactive')
     .where('last_login', '<', oldDate)
     .delete();
   ```

2. **Delete by ID**
   ```javascript
   // Delete single record by ID
   const result = await db.table('users').delete(1);
   
   // Delete by custom key
   const result = await db.table('users').delete('john@example.com', 'email');
   ```

## Transaction Patterns

### Basic Transactions

1. **Simple Transaction**
   ```javascript
   const conn = await createPromiseClient(connectionOptions);
   const transaction = new TransactionHandler(conn);
   
   await transaction.begin();
   
   try {
     // Multiple operations
     const user = await transaction.table('users').insert({
       name: 'John Doe',
       email: 'john@example.com'
     });
     
     await transaction.table('profiles').insert({
       user_id: user.insertId,
       bio: 'Software developer'
     });
     
     await transaction.commit();
   } catch (error) {
     await transaction.rollback();
     throw error;
   }
   ```

2. **Transaction with Isolation Levels**
   ```javascript
   const transaction = new TransactionHandler(conn, {
     level: 'SERIALIZABLE' // or 'READ COMMITTED', 'REPEATABLE READ', etc.
   });
   ```

3. **Transaction with Locking**
   ```javascript
   // Select with lock
   const user = await transaction.table('users')
     .where('id', 1)
     .append('FOR UPDATE')
     .find();
   
   // Shared lock
   const user = await transaction.table('users')
     .where('id', 1)
     .append('LOCK IN SHARE MODE')
     .find();
   ```

### Advanced Transaction Patterns

1. **Nested Operations**
   ```javascript
   async function createUserWithProfile(userData, profileData) {
     const transaction = new TransactionHandler(conn);
     await transaction.begin();
     
     try {
       // Create user
       const userResult = await transaction.table('users').insert(userData);
       const userId = userResult.insertId;
       
       // Create profile
       profileData.user_id = userId;
       await transaction.table('profiles').insert(profileData);
       
       // Create default settings
       await transaction.table('user_settings').insert({
         user_id: userId,
         theme: 'light',
         notifications: true
       });
       
       await transaction.commit();
       return userId;
     } catch (error) {
       await transaction.rollback();
       throw error;
     }
   }
   ```

2. **Batch Operations in Transaction**
   ```javascript
   async function batchUpdateUsers(updates) {
     const transaction = new TransactionHandler(conn);
     await transaction.begin();
     
     try {
       for (const update of updates) {
         await transaction.table('users')
           .where('id', update.id)
           .update(update.data);
       }
       
       await transaction.commit();
     } catch (error) {
       await transaction.rollback();
       throw error;
     }
   }
   ```

## Hook System Patterns

### Pre and Post Hooks

1. **Operation Hooks**
   ```javascript
   const { Hook } = require('@axiosleo/orm-mysql');
   
   // Pre-insert hook
   Hook.pre(async (options, conn) => {
     if (options.data && options.data.password) {
       options.data.password = await hashPassword(options.data.password);
     }
   }, { table: 'users', opt: 'insert' });
   
   // Post-select hook
   Hook.post(async (options, result, conn) => {
     if (Array.isArray(result)) {
       result.forEach(row => {
         delete row.password; // Remove sensitive data
       });
     }
   }, { table: 'users', opt: 'select' });
   ```

2. **Global Hooks**
   ```javascript
   // Hook for all operations
   Hook.pre(async (options, conn) => {
     console.log(`Executing ${options.operator} on ${options.tables[0].table}`);
   });
   
   // Hook for specific tables
   Hook.post(async (options, result, conn) => {
     // Log all operations on sensitive tables
     if (['users', 'payments', 'orders'].includes(options.tables[0].table)) {
       await logOperation(options, result);
     }
   }, { table: ['users', 'payments', 'orders'] });
   ```

3. **Custom Event Hooks**
   ```javascript
   // Register custom hook
   Hook.register(async (options) => {
     // Custom validation logic
     await validateBusinessRules(options);
   }, 'validation.before.insert');
   
   // Trigger custom hook
   Hook.trigger(['validation.before.insert'], options);
   ```

## Migration Patterns

### Schema Migrations

1. **Table Creation**
   ```javascript
   function up(migration) {
     migration.createTable('posts', {
       id: {
         type: 'int',
         allowNull: false,
         primaryKey: true,
         autoIncrement: true
       },
       title: {
         type: 'varchar',
         length: 255,
         allowNull: false
       },
       content: {
         type: 'text',
         allowNull: true
       },
       user_id: {
         type: 'int',
         allowNull: false,
         references: {
           table: 'users',
           column: 'id',
           onDelete: 'CASCADE',
           onUpdate: 'CASCADE'
         }
       },
       status: {
         type: 'enum',
         values: ['draft', 'published', 'archived'],
         default: 'draft'
       },
       created_at: {
         type: 'timestamp',
         allowNull: false,
         default: 'CURRENT_TIMESTAMP'
       },
       updated_at: {
         type: 'timestamp',
         allowNull: false,
         default: 'CURRENT_TIMESTAMP',
         onUpdate: 'CURRENT_TIMESTAMP'
       }
     });
   }
   ```

2. **Index Management**
   ```javascript
   function up(migration) {
     // Create indexes
     migration.createIndex('posts', ['user_id']);
     migration.createIndex('posts', ['status', 'created_at']);
     migration.createIndex('posts', ['title'], { 
       indexName: 'idx_posts_title',
       unique: false 
     });
     
     // Full-text index
     migration.createIndex('posts', ['title', 'content'], {
       fulltext: true
     });
   }
   ```

3. **Data Migrations**
   ```javascript
   function up(migration) {
     // Add new column
     migration.createColumn('users', 'full_name', 'varchar', {
       length: 255,
       allowNull: true
     });
     
     // Migrate existing data
     migration.insertData('users', {
       sql: "UPDATE users SET full_name = CONCAT(first_name, ' ', last_name) WHERE first_name IS NOT NULL AND last_name IS NOT NULL"
     });
   }
   ```

### Migration Best Practices

1. **Incremental Changes**
   ```javascript
   // Good: Small, focused migration
   function up(migration) {
     migration.createColumn('users', 'phone', 'varchar', {
       length: 20,
       allowNull: true
     });
   }
   
   function down(migration) {
     migration.dropColumn('users', 'phone');
   }
   ```

2. **Safe Rollbacks**
   ```javascript
   function up(migration) {
     // Always provide rollback
     migration.createTable('user_preferences', {
       id: { type: 'int', primaryKey: true, autoIncrement: true },
       user_id: { type: 'int', allowNull: false },
       key: { type: 'varchar', length: 100, allowNull: false },
       value: { type: 'text', allowNull: true }
     });
   }
   
   function down(migration) {
     migration.dropTable('user_preferences');
   }
   ```

## Custom Query Drivers

### Custom Driver Implementation

1. **Driver Registration**
   ```javascript
   const customHandler = new QueryHandler(connection, {
     driver: 'custom',
     queryHandler: (conn, options) => {
       const builder = new Builder(options);
       
       return new Promise((resolve, reject) => {
         // Custom query execution logic
         if (options.operator === 'select') {
           // Custom select implementation
           resolve(customSelectLogic(builder.sql, builder.values));
         } else {
           reject(new Error('Unsupported operation'));
         }
       });
     }
   });
   ```

2. **Driver with Caching**
   ```javascript
   const cachedQueryHandler = (conn, options) => {
     const builder = new Builder(options);
     const cacheKey = generateCacheKey(builder.sql, builder.values);
     
     return new Promise(async (resolve, reject) => {
       try {
         // Check cache first
         const cached = await cache.get(cacheKey);
         if (cached && options.operator === 'select') {
           resolve(cached);
           return;
         }
         
         // Execute query
         const result = await conn.query(builder.sql, builder.values);
         
         // Cache result for SELECT queries
         if (options.operator === 'select') {
           await cache.set(cacheKey, result, 300); // 5 minutes
         }
         
         resolve(result);
       } catch (error) {
         reject(error);
       }
     });
   };
   ```

These patterns provide a comprehensive guide for using the @axiosleo/orm-mysql library effectively across different scenarios and use cases.
