# Project Context for @axiosleo/orm-mysql

## Project Overview

**@axiosleo/orm-mysql** is a comprehensive MySQL ORM (Object-Relational Mapping) library for Node.js applications. It provides a fluent query builder interface, transaction management, database migrations, and connection pooling capabilities.

### Key Features

- **Fluent Query Builder**: Chainable methods for building complex SQL queries
- **Transaction Support**: Full transaction management with isolation levels
- **Migration System**: Database schema versioning and migration tools
- **Connection Management**: Support for single connections, connection pools, and promise-based connections
- **Hook System**: Pre and post-operation hooks for extensibility
- **CLI Tools**: Command-line interface for migrations and code generation
- **TypeScript Support**: Complete type definitions for type-safe development

### Target Use Cases

1. **Web Applications**: REST APIs and web services requiring database operations
2. **Microservices**: Database layer for microservice architectures
3. **Data Migration**: Tools for database schema and data migrations
4. **Enterprise Applications**: Large-scale applications requiring robust database management

## Technical Architecture

### Core Components

```
@axiosleo/orm-mysql
├── Query System
│   ├── Query Builder (fluent interface)
│   ├── Condition Builder (WHERE clauses)
│   └── SQL Builder (query compilation)
├── Connection Layer
│   ├── Single Connections
│   ├── Connection Pools
│   └── Promise-based Connections
├── Transaction Management
│   ├── Transaction Handler
│   ├── Isolation Levels
│   └── Rollback Support
├── Migration System
│   ├── Schema Migrations
│   ├── Data Migrations
│   └── Version Control
└── Extension Points
    ├── Hook System
    ├── Custom Drivers
    └── Event System
```

### Dependencies

- **mysql2**: MySQL client for Node.js (primary database driver)
- **@axiosleo/cli-tool**: CLI framework and utilities
- **validatorjs**: Input validation library

### Development Dependencies

- **mocha**: Testing framework
- **chai**: Assertion library
- **nyc**: Code coverage tool
- **eslint**: Code linting
- **typescript**: Type checking and definitions

## Database Support

### MySQL Versions

- **MySQL 5.7+**: Full feature support
- **MySQL 8.0+**: Enhanced JSON support and performance optimizations
- **MariaDB 10.2+**: Compatible with most features

### SQL Features Supported

1. **Basic Operations**: SELECT, INSERT, UPDATE, DELETE
2. **Advanced Queries**: JOINs, subqueries, CTEs (MySQL 8.0+)
3. **JSON Operations**: JSON_EXTRACT, JSON_CONTAINS, JSON_OVERLAPS
4. **Aggregations**: COUNT, SUM, AVG, GROUP BY, HAVING
5. **Indexing**: Primary keys, unique indexes, composite indexes, full-text indexes
6. **Constraints**: Foreign keys, check constraints
7. **Transactions**: All isolation levels, savepoints

## Project Structure

### Source Code Organization

```
src/
├── builder.js          # SQL query builders
├── client.js           # Database connection management
├── core.js             # Core query execution logic
├── hook.js             # Event hooks system
├── migration.js        # Database migration system
├── operator.js         # Query operators and handlers
├── query.js            # Query builder classes
├── transaction.js      # Transaction management
└── utils.js            # Utility functions
```

### Supporting Files

```
commands/               # CLI command implementations
├── generate.js         # Migration generation
└── migrate.js          # Migration execution

tests/                  # Test suites
├── builder.tests.js    # Query builder tests
├── client.tests.js     # Connection tests
├── hook.tests.js       # Hook system tests
├── operator.tests.js   # Operator tests
├── query.tests.js      # Query tests
└── utils.tests.js      # Utility tests

examples/               # Usage examples
├── base_column.js      # Column definitions
└── migration/          # Migration examples
```

## Development Workflow

### Code Organization Principles

1. **Separation of Concerns**: Each module has a specific responsibility
2. **Fluent Interface**: Chainable methods for better developer experience
3. **Error Handling**: Comprehensive error handling with context
4. **Type Safety**: TypeScript definitions for all public APIs
5. **Testing**: High test coverage with unit and integration tests

### API Design Philosophy

1. **Intuitive**: Methods should be self-explanatory
2. **Consistent**: Similar operations should have similar interfaces
3. **Flexible**: Support multiple ways to achieve the same result
4. **Safe**: Prevent SQL injection and common security issues
5. **Performant**: Optimize for common use cases

### Extension Points

1. **Custom Drivers**: Implement custom query execution logic
2. **Hook System**: Add custom logic before/after operations
3. **Migration Extensions**: Custom migration operations
4. **Connection Middleware**: Custom connection handling

## Common Usage Patterns

### Basic CRUD Operations

```javascript
const { createClient, QueryHandler } = require('@axiosleo/orm-mysql');

// Setup
const client = createClient(connectionOptions);
const db = new QueryHandler(client);

// Create
await db.table('users').insert({ name: 'John', email: 'john@example.com' });

// Read
const users = await db.table('users').where('status', 'active').select();
const user = await db.table('users').where('id', 1).find();

// Update
await db.table('users').where('id', 1).update({ name: 'John Doe' });

// Delete
await db.table('users').where('id', 1).delete();
```

### Transaction Management

```javascript
const { TransactionHandler, createPromiseClient } = require('@axiosleo/orm-mysql');

const conn = await createPromiseClient(connectionOptions);
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

### Migration System

```javascript
// Migration file
function up(migration) {
  migration.createTable('posts', {
    id: { type: 'int', primaryKey: true, autoIncrement: true },
    title: { type: 'varchar', length: 255, allowNull: false },
    content: { type: 'text' },
    user_id: { 
      type: 'int', 
      references: { table: 'users', column: 'id' }
    }
  });
}

function down(migration) {
  migration.dropTable('posts');
}
```

## Performance Considerations

### Query Optimization

1. **Use Appropriate Methods**: `find()` for single records, `select()` for multiple
2. **Limit Result Sets**: Always use `limit()` for large datasets
3. **Index Usage**: Create indexes for frequently queried columns
4. **Join Optimization**: Use appropriate join types and conditions

### Connection Management

1. **Connection Pooling**: Use pools for high-concurrency applications
2. **Connection Lifecycle**: Properly close connections to prevent leaks
3. **Pool Configuration**: Tune pool size based on application needs

### Transaction Best Practices

1. **Short Transactions**: Keep transaction scope minimal
2. **Deadlock Handling**: Implement retry logic for deadlock scenarios
3. **Isolation Levels**: Choose appropriate isolation levels for use case

## Security Features

### SQL Injection Prevention

- **Parameterized Queries**: All user inputs are parameterized
- **Input Validation**: Built-in validation for common data types
- **Escape Mechanisms**: Proper escaping of special characters

### Data Protection

- **Connection Security**: Support for SSL/TLS connections
- **Credential Management**: Secure handling of database credentials
- **Audit Hooks**: Ability to log all database operations

## Testing Strategy

### Test Categories

1. **Unit Tests**: Individual component testing
2. **Integration Tests**: Database interaction testing
3. **Performance Tests**: Query performance benchmarks
4. **Security Tests**: SQL injection and security validation

### Test Environment

- **Test Databases**: Isolated test database instances
- **Mock Objects**: Mocked connections for unit tests
- **Coverage Reports**: Comprehensive code coverage analysis

## Deployment Considerations

### Production Setup

1. **Connection Pooling**: Configure appropriate pool sizes
2. **Error Logging**: Implement comprehensive error logging
3. **Performance Monitoring**: Monitor query performance and connection usage
4. **Migration Management**: Automated migration deployment

### Environment Configuration

1. **Environment Variables**: Use environment variables for configuration
2. **Configuration Files**: Support for multiple environment configurations
3. **Secret Management**: Secure handling of database credentials

## Community and Ecosystem

### Package Ecosystem

- **NPM Package**: Published as `@axiosleo/orm-mysql`
- **GitHub Repository**: Open source with issue tracking
- **Documentation**: Comprehensive README and examples

### Contribution Guidelines

1. **Code Standards**: Follow established coding standards
2. **Testing Requirements**: All changes must include tests
3. **Documentation**: Update documentation for API changes
4. **Backward Compatibility**: Maintain compatibility when possible

## Future Roadmap

### Planned Features

1. **Query Caching**: Built-in query result caching
2. **Read Replicas**: Support for read/write splitting
3. **Schema Validation**: Runtime schema validation
4. **Performance Analytics**: Built-in query performance analysis

### Version Strategy

- **Semantic Versioning**: Follow semver for releases
- **LTS Support**: Long-term support for major versions
- **Migration Path**: Clear upgrade paths between versions

This project context provides the foundation for understanding and contributing to the @axiosleo/orm-mysql library.
