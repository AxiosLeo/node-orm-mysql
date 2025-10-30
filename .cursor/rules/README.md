# Cursor Rules for @axiosleo/orm-mysql

This directory contains development guidelines and rules for the @axiosleo/orm-mysql project. These files provide comprehensive guidance for developers working on this MySQL ORM library.

## Files Overview

### 📋 [development-guidelines.md](./development-guidelines.md)
Comprehensive development guidelines covering:
- Project architecture and core components
- Development standards and best practices
- Query builder patterns and database operations
- Testing guidelines and security considerations
- Performance optimization and error handling
- Migration best practices and CLI development

### 🎯 [coding-standards.md](./coding-standards.md)
Detailed coding standards including:
- File organization and naming conventions
- JavaScript code style guidelines
- Class design patterns and method chaining
- Documentation standards with JSDoc
- Testing structure and patterns
- Performance guidelines and security practices

### 🔧 [api-patterns.md](./api-patterns.md)
API usage patterns and examples:
- Query builder construction patterns
- CRUD operation examples
- Transaction management patterns
- Hook system implementation
- Migration patterns and best practices
- Custom driver development

### 🏗️ [project-context.md](./project-context.md)
Project context and background:
- Project overview and key features
- Technical architecture and dependencies
- Database support and SQL features
- Development workflow and principles
- Performance considerations and security features
- Testing strategy and deployment guidelines

## Quick Reference

### Core Principles

1. **Fluent Interface**: Use method chaining for readable query building
2. **Type Safety**: Leverage TypeScript definitions for better development experience
3. **Security First**: Always use parameterized queries to prevent SQL injection
4. **Performance**: Optimize queries and use appropriate connection management
5. **Testing**: Maintain high test coverage with comprehensive test suites

### Common Patterns

```javascript
// Basic query pattern
const users = await db.table('users')
  .where('status', 'active')
  .orderBy('created_at', 'desc')
  .limit(10)
  .select();

// Transaction pattern
const transaction = new TransactionHandler(conn);
await transaction.begin();
try {
  // operations...
  await transaction.commit();
} catch (error) {
  await transaction.rollback();
  throw error;
}

// Migration pattern
function up(migration) {
  migration.createTable('table_name', {
    id: { type: 'int', primaryKey: true, autoIncrement: true },
    // ... columns
  });
}
```

### Key Guidelines

- Use `'use strict';` in all JavaScript files
- Document all public APIs with JSDoc comments
- Implement proper error handling with context
- Use the built-in validation system for input validation
- Follow the established testing patterns with Mocha and Chai
- Maintain backward compatibility when possible

## Getting Started

When working on this project:

1. **Read the Guidelines**: Start with [development-guidelines.md](./development-guidelines.md)
2. **Follow Standards**: Adhere to [coding-standards.md](./coding-standards.md)
3. **Use Patterns**: Reference [api-patterns.md](./api-patterns.md) for implementation examples
4. **Understand Context**: Review [project-context.md](./project-context.md) for background

## Contributing

When contributing to the project:

1. Follow all coding standards and guidelines
2. Include comprehensive tests for new features
3. Update documentation for API changes
4. Ensure backward compatibility
5. Use the established patterns and conventions

These rules ensure consistency, maintainability, and quality across the @axiosleo/orm-mysql codebase.
