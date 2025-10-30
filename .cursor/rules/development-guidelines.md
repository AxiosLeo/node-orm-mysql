# @axiosleo/orm-mysql Development Guidelines

## Project Overview

This is a MySQL ORM (Object-Relational Mapping) library for Node.js that provides a fluent query builder, transaction support, migration system, and database management utilities. The library is designed to simplify MySQL database operations while maintaining flexibility and performance.

## Architecture

### Core Components

1. **Query System** (`src/query.js`, `src/operator.js`)
   - `Query`: Base query builder with fluent interface
   - `QueryCondition`: Handles WHERE conditions and logical operators
   - `QueryOperator`: Executes queries against database connections
   - `QueryHandler`: Main entry point for database operations

2. **SQL Builder** (`src/builder.js`)
   - `Builder`: Converts query objects to SQL statements
   - `ManageSQLBuilder`: Specialized builder for DDL operations (migrations)

3. **Connection Management** (`src/client.js`)
   - Multiple connection types: single connection, connection pool, promise-based
   - Connection pooling and lifecycle management

4. **Transaction Support** (`src/transaction.js`)
   - `TransactionHandler`: Manages database transactions
   - `TransactionOperator`: Query operations within transactions
   - Support for different isolation levels

5. **Migration System** (`src/migration.js`)
   - Database schema versioning and migration management
   - DDL operations: CREATE/DROP tables, columns, indexes, foreign keys
   - Migration tracking and rollback support

6. **Hook System** (`src/hook.js`)
   - Pre and post-operation hooks for extensibility
   - Event-driven architecture for custom logic

## Development Standards

### Code Style

1. **Use strict mode** - All files must start with `'use strict';`

2. **JSDoc Documentation** - All public methods and classes must have JSDoc comments:
   ```javascript
   /**
    * @param {Connection} conn - Database connection
    * @param {QueryOperatorOptions} options - Query options
    * @returns {Promise<QueryResult>}
    */
   ```

3. **Error Handling** - Always use proper error handling:
   ```javascript
   try {
     const result = await query.exec();
     return result;
   } catch (error) {
     // Log error with context
     throw new Error(`Query failed: ${error.message}`);
   }
   ```

4. **Validation** - Use the built-in validation system for input validation:
   ```javascript
   const { _validate } = require('./utils');
   _validate(options, {
     name: 'required|string',
     type: 'required|string'
   });
   ```

### Query Builder Patterns

1. **Fluent Interface** - Chain methods for readability:
   ```javascript
   const result = await db.table('users')
     .where('status', 'active')
     .where('age', '>', 18)
     .orderBy('created_at', 'desc')
     .limit(10)
     .select();
   ```

2. **Method Naming** - Use descriptive method names:
   - `where()` for conditions
   - `orderBy()` for sorting
   - `limit()` and `offset()` for pagination
   - `select()`, `find()`, `insert()`, `update()`, `delete()` for operations

3. **Condition Building** - Support multiple condition formats:
   ```javascript
   // Object format
   query.where({ name: 'John', age: 25 });
   
   // Key-value format
   query.where('name', 'John');
   
   // Key-operator-value format
   query.where('age', '>', 18);
   ```

### Database Operations

1. **Connection Management**:
   ```javascript
   // Use connection pools for production
   const pool = createPool(connectionOptions);
   
   // Use single connections for simple operations
   const conn = createClient(connectionOptions);
   
   // Use promise connections for transactions
   const promiseConn = createPromiseClient(connectionOptions);
   ```

2. **Transaction Patterns**:
   ```javascript
   const transaction = new TransactionHandler(conn);
   await transaction.begin();
   
   try {
     await transaction.table('users').insert(userData);
     await transaction.table('profiles').insert(profileData);
     await transaction.commit();
   } catch (error) {
     await transaction.rollback();
     throw error;
   }
   ```

3. **Migration Structure**:
   ```javascript
   function up(migration) {
     migration.createTable('table_name', {
       id: {
         type: 'int',
         allowNull: false,
         primaryKey: true,
         autoIncrement: true
       },
       // ... other columns
     });
   }
   
   function down(migration) {
     migration.dropTable('table_name');
   }
   ```

### Testing Guidelines

1. **Test Structure** - Use Mocha with Chai for testing:
   ```javascript
   describe('Feature Name', () => {
     before(async function() {
       // Setup
     });
     
     it('should perform expected behavior', async () => {
       // Test implementation
       expect(result).to.equal(expectedValue);
     });
     
     after(async function() {
       // Cleanup
     });
   });
   ```

2. **Database Testing** - Use test databases and cleanup after tests

3. **Coverage** - Maintain high test coverage using nyc

### Security Considerations

1. **SQL Injection Prevention** - Always use parameterized queries:
   ```javascript
   // Good - parameterized
   query.where('id', userId);
   
   // Bad - string concatenation
   query.where(`id = ${userId}`);
   ```

2. **Input Validation** - Validate all inputs before processing

3. **Connection Security** - Use secure connection options and credentials management

### Performance Guidelines

1. **Query Optimization**:
   - Use appropriate indexes
   - Limit result sets with `limit()` and `offset()`
   - Use `find()` instead of `select()` for single records

2. **Connection Pooling**:
   - Use connection pools for high-traffic applications
   - Configure appropriate pool sizes

3. **Transaction Scope**:
   - Keep transactions as short as possible
   - Avoid long-running transactions

### Error Handling Patterns

1. **Consistent Error Messages** - Provide clear, actionable error messages

2. **Error Context** - Include relevant context in error messages:
   ```javascript
   throw new Error(`Table '${tableName}' does not exist in database '${database}'`);
   ```

3. **Error Logging** - Use the built-in printer for consistent logging:
   ```javascript
   const { printer } = require('@axiosleo/cli-tool');
   printer.error('Operation failed').println();
   ```

### Migration Best Practices

1. **Incremental Changes** - Make small, incremental schema changes

2. **Rollback Support** - Always implement `down()` functions for rollbacks

3. **Data Migration** - Handle data migration carefully:
   ```javascript
   // Use insertData for data migrations
   migration.insertData('table_name', [
     { column1: 'value1', column2: 'value2' }
   ]);
   ```

4. **Index Management** - Create indexes for frequently queried columns

### CLI Development

1. **Command Structure** - Follow the established pattern in `commands/` directory

2. **Help Documentation** - Provide comprehensive help text for all commands

3. **Validation** - Validate command arguments and options

### TypeScript Support

1. **Type Definitions** - Maintain accurate TypeScript definitions in `index.d.ts`

2. **Generic Support** - Use generics for type-safe query results:
   ```typescript
   const users = await query.select<User>();
   ```

### Debugging and Development

1. **Debug Mode** - Use debug flags for verbose output:
   ```javascript
   const { debug } = require('@axiosleo/cli-tool');
   if (options.debug) {
     debug.log('SQL:', builder.sql);
   }
   ```

2. **SQL Logging** - Enable SQL logging for development

3. **Explain Queries** - Use `explain()` method for query analysis

## Common Patterns

### Repository Pattern
```javascript
class UserRepository {
  constructor(db) {
    this.db = db;
  }
  
  async findById(id) {
    return await this.db.table('users').where('id', id).find();
  }
  
  async create(userData) {
    return await this.db.table('users').insert(userData);
  }
}
```

### Service Layer
```javascript
class UserService {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }
  
  async createUser(userData) {
    // Business logic
    const user = await this.userRepository.create(userData);
    // Additional processing
    return user;
  }
}
```

## Contribution Guidelines

1. **Code Review** - All changes require code review
2. **Testing** - New features must include tests
3. **Documentation** - Update documentation for API changes
4. **Backward Compatibility** - Maintain backward compatibility when possible
5. **Performance** - Consider performance impact of changes

## Troubleshooting

### Common Issues

1. **Connection Timeouts** - Check connection pool configuration
2. **Migration Failures** - Verify migration syntax and database permissions
3. **Query Performance** - Use `explain()` to analyze query execution plans
4. **Transaction Deadlocks** - Implement retry logic for deadlock scenarios

### Debugging Steps

1. Enable debug mode
2. Check SQL output
3. Verify database connectivity
4. Review error logs
5. Test with minimal reproduction case
