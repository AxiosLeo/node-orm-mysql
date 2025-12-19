/* eslint-disable no-console */
'use strict';

/**
 * 事务使用示例
 * 
 * 这个示例展示了如何正确使用事务，避免连接阻塞问题
 */

const mysql = require('mysql2/promise');
const { QueryHandler } = require('../src/operator');

/**
 * 示例 1: 使用连接池（推荐）
 * 优点：自动从池中获取新连接，不会阻塞其他操作
 */
async function exampleWithPool() {
  const pool = mysql.createPool({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'password',
    database: 'test_db',
    connectionLimit: 10
  });

  const queryHandler = new QueryHandler(pool);

  try {
    // 方式 1: 使用 QueryHandler.beginTransaction()（推荐）
    // 这会自动从连接池获取一个新连接用于事务
    const transaction = await queryHandler.beginTransaction({ level: 'RC' });
    
    try {
      // 执行事务操作
      await transaction.table('users').insert({ name: 'John', age: 30 });
      await transaction.table('orders').insert({ user_id: 1, total: 100 });
      
      // 提交事务（会自动释放连接回池）
      await transaction.commit();
      console.log('Transaction committed successfully');
    } catch (err) {
      // 回滚事务（会自动释放连接回池）
      await transaction.rollback();
      console.error('Transaction rolled back:', err.message);
      throw err;
    }

    // 同时，其他操作不会被阻塞
    const users = await queryHandler.table('users').select();
    console.log('Users:', users);

  } finally {
    await pool.end();
  }
}

/**
 * 示例 2: 使用单一连接（不推荐用于生产环境）
 * 注意：事务执行期间会阻塞该连接的其他操作
 */
async function exampleWithSingleConnection() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'password',
    database: 'test_db'
  });

  const queryHandler = new QueryHandler(connection);

  try {
    // 使用单一连接创建事务
    const transaction = await queryHandler.beginTransaction({ level: 'RR' });
    
    try {
      await transaction.table('users').insert({ name: 'Jane', age: 25 });
      await transaction.commit();
      console.log('Transaction committed');
    } catch (err) {
      await transaction.rollback();
      console.error('Transaction rolled back:', err);
      throw err;
    }

  } finally {
    await connection.end();
  }
}

/**
 * 示例 3: 直接使用 TransactionHandler
 * 适用于需要更多控制的场景
 */
async function exampleWithTransactionHandler() {
  const { TransactionHandler } = require('../src/transaction');
  
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'password',
    database: 'test_db'
  });

  const transaction = new TransactionHandler(connection, { level: 'SERIALIZABLE' });
  
  try {
    await transaction.begin();
    
    // 执行多个操作
    await transaction.table('users').insert({ name: 'Bob', age: 35 });
    await transaction.table('user_profiles').insert({ user_id: 1, bio: 'Developer' });
    
    // 使用锁
    const lockedRows = await transaction.table('products')
      .where('id', [1, 2, 3], 'IN')
      .append('FOR UPDATE')
      .select();
    
    console.log('Locked rows:', lockedRows);
    
    await transaction.commit();
    console.log('Transaction completed');
  } catch (err) {
    await transaction.rollback();
    console.error('Error:', err);
    throw err;
  } finally {
    await connection.end();
  }
}

/**
 * 示例 4: 并发事务（使用连接池）
 * 展示多个事务可以同时执行而不相互阻塞
 */
async function exampleConcurrentTransactions() {
  const pool = mysql.createPool({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'password',
    database: 'test_db',
    connectionLimit: 10
  });

  const queryHandler = new QueryHandler(pool);

  try {
    // 并发执行多个事务
    const results = await Promise.all([
      // 事务 1
      (async () => {
        const tx = await queryHandler.beginTransaction();
        try {
          await tx.table('users').insert({ name: 'User1', age: 20 });
          await tx.commit();
          return 'Transaction 1 completed';
        } catch (err) {
          await tx.rollback();
          throw err;
        }
      })(),
      
      // 事务 2
      (async () => {
        const tx = await queryHandler.beginTransaction();
        try {
          await tx.table('users').insert({ name: 'User2', age: 21 });
          await tx.commit();
          return 'Transaction 2 completed';
        } catch (err) {
          await tx.rollback();
          throw err;
        }
      })(),
      
      // 事务 3
      (async () => {
        const tx = await queryHandler.beginTransaction();
        try {
          await tx.table('users').insert({ name: 'User3', age: 22 });
          await tx.commit();
          return 'Transaction 3 completed';
        } catch (err) {
          await tx.rollback();
          throw err;
        }
      })()
    ]);

    console.log('All transactions completed:', results);
  } finally {
    await pool.end();
  }
}

/**
 * 最佳实践总结：
 * 
 * 1. 生产环境推荐使用连接池（Pool）
 * 2. 使用 QueryHandler.beginTransaction() 自动管理连接
 * 3. 始终在 try-catch-finally 中使用事务
 * 4. 确保调用 commit() 或 rollback()
 * 5. 连接池会自动释放连接，无需手动管理
 * 6. 避免在事务中执行长时间运行的操作
 * 7. 根据需要选择合适的隔离级别：
 *    - 'RU' / 'READ UNCOMMITTED': 最低隔离级别，性能最好，可能读到脏数据
 *    - 'RC' / 'READ COMMITTED': 避免脏读
 *    - 'RR' / 'REPEATABLE READ': MySQL 默认级别，避免不可重复读
 *    - 'S' / 'SERIALIZABLE': 最高隔离级别，完全串行化，性能最差
 */

// 运行示例（取消注释以运行）
// exampleWithPool().catch(console.error);
// exampleWithSingleConnection().catch(console.error);
// exampleWithTransactionHandler().catch(console.error);
// exampleConcurrentTransactions().catch(console.error);

module.exports = {
  exampleWithPool,
  exampleWithSingleConnection,
  exampleWithTransactionHandler,
  exampleConcurrentTransactions
};

