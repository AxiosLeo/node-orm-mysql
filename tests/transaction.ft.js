/* eslint-disable no-console */
'use strict';

const mysql = require('mysql2');
const { QueryHandler } = require('../src/operator');

// 配置 - 使用环境变量（CI 友好）
const config = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASS || '3AQqZTfmww=Ftj',
  database: process.env.MYSQL_DB || 'feature_tests',
  connectionLimit: 10
};

// 颜色输出辅助函数
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = '') {
  console.log(`${color}${message}${colors.reset}`);
}

function success(message) {
  log(`✓ ${message}`, colors.green);
}

function error(message) {
  log(`✗ ${message}`, colors.red);
}

function info(message) {
  log(`ℹ ${message}`, colors.cyan);
}

function section(message) {
  log(`\n${'='.repeat(60)}`, colors.bright);
  log(`${message}`, colors.bright);
  log(`${'='.repeat(60)}`, colors.bright);
}

// 测试场景 1: 连接池事务基本操作
async function test1_basicPoolTransaction() {
  section('测试场景 1: 连接池事务基本操作');

  const pool = mysql.createPool(config);
  const queryHandler = new QueryHandler(pool);

  try {
    info('创建连接池...');
    success('连接池创建成功');

    info('开始事务...');
    const transaction = await queryHandler.beginTransaction({ level: 'RC' });
    success('事务已开始（隔离级别: READ COMMITTED）');

    info('插入测试用户...');
    const result = await transaction.table('users').insert({
      name: 'Test User 1',
      email: `test1_${Date.now()}@example.com`,
      balance: 100.00
    });
    success(`用户插入成功，ID: ${result.insertId}`);

    info('提交事务...');
    await transaction.commit();
    success('事务提交成功，连接已自动释放回池');

    // 验证数据
    info('验证插入的数据...');
    const user = await queryHandler.table('users')
      .where('id', result.insertId)
      .find();
    
    if (user && user.name === 'Test User 1') {
      success('数据验证成功');
    } else {
      error('数据验证失败');
    }

    success('✓ 测试场景 1 完成\n');
  } catch (err) {
    error(`测试失败: ${err.message}`);
    throw err;
  } finally {
    await pool.end();
  }
}

// 测试场景 2: 并发事务不阻塞
async function test2_concurrentTransactions() {
  section('测试场景 2: 并发事务不阻塞');

  const pool = mysql.createPool(config);
  const queryHandler = new QueryHandler(pool);

  try {
    info('创建连接池（连接数限制: 10）...');
    success('连接池创建成功');

    info('同时启动 3 个并发事务...');
    const startTime = Date.now();

    const transactions = await Promise.all([
      // 事务 1
      (async () => {
        const tx = await queryHandler.beginTransaction({ level: 'RC' });
        try {
          await tx.table('users').insert({
            name: 'Concurrent User 1',
            email: `concurrent1_${Date.now()}@example.com`,
            balance: 200.00
          });
          // 模拟耗时操作
          await new Promise(resolve => setTimeout(resolve, 100));
          await tx.commit();
          return '事务 1 完成';
        } catch (err) {
          await tx.rollback();
          throw err;
        }
      })(),

      // 事务 2
      (async () => {
        const tx = await queryHandler.beginTransaction({ level: 'RC' });
        try {
          await tx.table('users').insert({
            name: 'Concurrent User 2',
            email: `concurrent2_${Date.now()}@example.com`,
            balance: 300.00
          });
          await new Promise(resolve => setTimeout(resolve, 100));
          await tx.commit();
          return '事务 2 完成';
        } catch (err) {
          await tx.rollback();
          throw err;
        }
      })(),

      // 事务 3
      (async () => {
        const tx = await queryHandler.beginTransaction({ level: 'RC' });
        try {
          await tx.table('users').insert({
            name: 'Concurrent User 3',
            email: `concurrent3_${Date.now()}@example.com`,
            balance: 400.00
          });
          await new Promise(resolve => setTimeout(resolve, 100));
          await tx.commit();
          return '事务 3 完成';
        } catch (err) {
          await tx.rollback();
          throw err;
        }
      })()
    ]);

    const endTime = Date.now();
    const duration = endTime - startTime;

    transactions.forEach(result => success(result));
    success(`所有事务完成，总耗时: ${duration}ms`);
    
    if (duration < 300) {
      success('✓ 事务并发执行成功（未阻塞）');
    } else {
      error('✗ 事务可能串行执行（存在阻塞）');
    }

    success('✓ 测试场景 2 完成\n');
  } catch (err) {
    error(`测试失败: ${err.message}`);
    throw err;
  } finally {
    await pool.end();
  }
}

// 测试场景 3: 事务回滚
async function test3_rollback() {
  section('测试场景 3: 事务回滚');

  const pool = mysql.createPool(config);
  const queryHandler = new QueryHandler(pool);

  try {
    info('开始事务...');
    const transaction = await queryHandler.beginTransaction({ level: 'RC' });
    const testEmail = `rollback_test_${Date.now()}@example.com`;

    try {
      info('插入测试数据...');
      await transaction.table('users').insert({
        name: 'Rollback Test User',
        email: testEmail,
        balance: 500.00
      });
      success('数据插入成功（未提交）');

      info('故意抛出错误以触发回滚...');
      throw new Error('故意的错误');
    } catch (err) {
      info(`捕获错误: ${err.message}`);
      info('执行回滚...');
      await transaction.rollback();
      success('事务已回滚，连接已释放');
    }

    // 验证数据未插入
    info('验证数据是否已回滚...');
    const user = await queryHandler.table('users')
      .where('email', testEmail)
      .find();

    if (!user) {
      success('✓ 数据已成功回滚（未插入到数据库）');
    } else {
      error('✗ 回滚失败，数据仍然存在');
    }

    success('✓ 测试场景 3 完成\n');
  } catch (err) {
    error(`测试失败: ${err.message}`);
    throw err;
  } finally {
    await pool.end();
  }
}

// 测试场景 4: 库存扣减场景（行锁）
async function test4_stockDeduction() {
  section('测试场景 4: 库存扣减场景（使用行锁）');

  const pool = mysql.createPool(config);
  const queryHandler = new QueryHandler(pool);

  try {
    info('开始事务...');
    const transaction = await queryHandler.beginTransaction({ level: 'RC' });

    try {
      const productSku = 'LAPTOP-001';
      
      info(`查询产品 ${productSku} 并锁定行（FOR UPDATE）...`);
      const product = await transaction.table('products')
        .where('sku', productSku)
        .append('FOR UPDATE')
        .find();

      if (!product) {
        throw new Error('产品不存在');
      }

      success(`产品: ${product.name}, 当前库存: ${product.stock}`);

      if (product.stock < 2) {
        throw new Error('库存不足');
      }

      info('扣减库存...');
      await transaction.table('products')
        .where('sku', productSku)
        .update({ stock: product.stock - 2 });
      success('库存扣减成功（-2）');

      info('创建订单...');
      const orderResult = await transaction.table('orders').insert({
        user_id: 1,
        product_id: product.id,
        quantity: 2,
        total: product.price * 2,
        status: 'completed'
      });
      success(`订单创建成功，订单ID: ${orderResult.insertId}`);

      info('提交事务...');
      await transaction.commit();
      success('事务提交成功');

      // 验证库存
      info('验证库存更新...');
      const updatedProduct = await queryHandler.table('products')
        .where('sku', productSku)
        .find();
      success(`当前库存: ${updatedProduct.stock} (应为 ${product.stock - 2})`);

      if (updatedProduct.stock === product.stock - 2) {
        success('✓ 库存扣减验证成功');
      } else {
        error('✗ 库存扣减验证失败');
      }

      success('✓ 测试场景 4 完成\n');
    } catch (err) {
      await transaction.rollback();
      error(`事务回滚: ${err.message}`);
      throw err;
    }
  } catch (err) {
    error(`测试失败: ${err.message}`);
    throw err;
  } finally {
    await pool.end();
  }
}

// 测试场景 5: 转账场景（多表事务）
async function test5_transfer() {
  section('测试场景 5: 转账场景（多表事务）');

  const pool = mysql.createPool(config);
  const queryHandler = new QueryHandler(pool);

  try {
    const fromAccount = 'ACC-1001';
    const toAccount = 'ACC-1002';
    const amount = 100.00;

    info('开始事务...');
    const transaction = await queryHandler.beginTransaction({ level: 'RR' });

    try {
      // 查询转出账户
      info(`查询转出账户 ${fromAccount}...`);
      const fromAcc = await transaction.table('accounts')
        .where('account_number', fromAccount)
        .append('FOR UPDATE')
        .find();

      if (!fromAcc) {
        throw new Error('转出账户不存在');
      }

      success(`转出账户余额: ${fromAcc.balance}`);

      // 查询转入账户
      info(`查询转入账户 ${toAccount}...`);
      const toAcc = await transaction.table('accounts')
        .where('account_number', toAccount)
        .append('FOR UPDATE')
        .find();

      if (!toAcc) {
        throw new Error('转入账户不存在');
      }

      success(`转入账户余额: ${toAcc.balance}`);

      // 检查余额
      if (parseFloat(fromAcc.balance) < amount) {
        throw new Error('余额不足');
      }

      const totalBefore = parseFloat(fromAcc.balance) + parseFloat(toAcc.balance);
      info(`转账前总额: ${totalBefore.toFixed(2)}`);

      // 扣款
      info(`从账户 ${fromAccount} 扣除 ${amount}...`);
      await transaction.table('accounts')
        .where('account_number', fromAccount)
        .update({ balance: parseFloat(fromAcc.balance) - amount });
      success('扣款成功');

      // 加款
      info(`向账户 ${toAccount} 增加 ${amount}...`);
      await transaction.table('accounts')
        .where('account_number', toAccount)
        .update({ balance: parseFloat(toAcc.balance) + amount });
      success('加款成功');

      info('提交事务...');
      await transaction.commit();
      success('转账事务提交成功');

      // 验证
      info('验证转账结果...');
      const verifyFrom = await queryHandler.table('accounts')
        .where('account_number', fromAccount)
        .find();
      const verifyTo = await queryHandler.table('accounts')
        .where('account_number', toAccount)
        .find();

      const totalAfter = parseFloat(verifyFrom.balance) + parseFloat(verifyTo.balance);

      success(`${fromAccount} 余额: ${verifyFrom.balance}`);
      success(`${toAccount} 余额: ${verifyTo.balance}`);
      success(`转账后总额: ${totalAfter.toFixed(2)}`);

      if (Math.abs(totalBefore - totalAfter) < 0.01) {
        success('✓ 总额验证成功（转账前后总额一致）');
      } else {
        error('✗ 总额验证失败');
      }

      success('✓ 测试场景 5 完成\n');
    } catch (err) {
      await transaction.rollback();
      error(`事务回滚: ${err.message}`);
      throw err;
    }
  } catch (err) {
    error(`测试失败: ${err.message}`);
    throw err;
  } finally {
    await pool.end();
  }
}

// 测试场景 6: 事务内 whereIn 条件（0.15.2 回归测试）
async function test6_whereInTransaction() {
  section('测试场景 6: 事务内 whereIn 条件（回归测试）');

  const pool = mysql.createPool(config);
  const queryHandler = new QueryHandler(pool);

  try {
    info('插入 3 个测试用户...');
    const ts = Date.now();
    const ids = [];
    for (let i = 1; i <= 3; i++) {
      const res = await queryHandler.table('users').insert({
        name: `WhereIn User ${i}`,
        email: `wherein_${ts}_${i}@example.com`,
        balance: 100.00 * i
      });
      ids.push(res.insertId);
    }
    success(`用户插入成功，IDs: ${ids.join(', ')}`);

    info('非事务 whereIn 查询（基准）...');
    const baseline = await queryHandler.table('users').whereIn('id', ids).select();
    if (baseline.length !== 3) {
      throw new Error(`非事务 whereIn 返回 ${baseline.length} 行，预期 3 行`);
    }
    success(`非事务 whereIn 返回 ${baseline.length} 行`);

    info('开始事务...');
    const tx = await queryHandler.beginTransaction({ level: 'RC' });
    try {
      info('事务内 whereIn SELECT...');
      const rows = await tx.table('users').whereIn('id', ids).select();
      if (rows.length !== 3) {
        throw new Error(`事务内 whereIn 返回 ${rows.length} 行，预期 3 行（修复前会静默返回 0 行）`);
      }
      success(`事务内 whereIn 返回 ${rows.length} 行（与非事务一致）`);

      info('事务内 whereNotIn SELECT...');
      const notRows = await tx.table('users')
        .whereIn('id', ids).whereNotIn('id', [ids[0]]).select();
      if (notRows.length !== 2) {
        throw new Error(`事务内 whereNotIn 返回 ${notRows.length} 行，预期 2 行`);
      }
      success(`事务内 whereNotIn 返回 ${notRows.length} 行`);

      info('事务内 where(field, "IN", array) SELECT...');
      const optRows = await tx.table('users').where('id', 'IN', [ids[0], ids[1]]).select();
      if (optRows.length !== 2) {
        throw new Error(`事务内 where IN 返回 ${optRows.length} 行，预期 2 行`);
      }
      success(`事务内 where(field, "IN", array) 返回 ${optRows.length} 行`);

      info('事务内基于 whereIn 的 UPDATE...');
      const updateRes = await tx.table('users')
        .whereIn('id', [ids[0], ids[1]])
        .update({ balance: 999.99 });
      if (updateRes.affectedRows !== 2) {
        throw new Error(`事务内 whereIn UPDATE 影响 ${updateRes.affectedRows} 行，预期 2 行（修复前会影响 0 行）`);
      }
      success(`事务内 whereIn UPDATE 影响 ${updateRes.affectedRows} 行`);

      info('回滚事务...');
      await tx.rollback();
      success('事务已回滚');
    } catch (err) {
      await tx.rollback();
      throw err;
    }

    info('验证回滚后数据未变...');
    const after = await queryHandler.table('users').whereIn('id', ids).select();
    const changed = after.filter((u) => parseFloat(u.balance) === 999.99);
    if (changed.length === 0) {
      success('✓ 回滚验证成功（UPDATE 未生效）');
    } else {
      error('✗ 回滚验证失败');
    }

    success('✓ 测试场景 6 完成\n');
  } catch (err) {
    error(`测试失败: ${err.message}`);
    throw err;
  } finally {
    await pool.end();
  }
}

// 主测试函数
async function runAllTests() {
  console.log('\n');
  log('╔═══════════════════════════════════════════════════════════╗', colors.bright + colors.blue);
  log('║      MySQL ORM Transaction Feature Tests                 ║', colors.bright + colors.blue);
  log('╚═══════════════════════════════════════════════════════════╝', colors.bright + colors.blue);
  console.log('\n');

  const tests = [
    { name: '测试场景 1: 连接池事务基本操作', fn: test1_basicPoolTransaction },
    { name: '测试场景 2: 并发事务不阻塞', fn: test2_concurrentTransactions },
    { name: '测试场景 3: 事务回滚', fn: test3_rollback },
    { name: '测试场景 4: 库存扣减场景（行锁）', fn: test4_stockDeduction },
    { name: '测试场景 5: 转账场景（多表事务）', fn: test5_transfer },
    { name: '测试场景 6: 事务内 whereIn 条件（回归测试）', fn: test6_whereInTransaction }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await test.fn();
      passed++;
    } catch (err) {
      failed++;
      error(`${test.name} 失败`);
      console.error(err);
    }
  }

  // 总结
  console.log('\n');
  log('╔═══════════════════════════════════════════════════════════╗', colors.bright);
  log('║                      测试总结                             ║', colors.bright);
  log('╚═══════════════════════════════════════════════════════════╝', colors.bright);
  console.log('\n');
  
  log(`总测试数: ${tests.length}`, colors.bright);
  log(`通过: ${passed}`, colors.green);
  log(`失败: ${failed}`, failed > 0 ? colors.red : colors.green);
  
  if (failed === 0) {
    console.log('\n');
    success('🎉 所有测试通过！');
    success('✓ 连接池事务功能正常');
    success('✓ 连接自动获取和释放机制正常');
    success('✓ 并发事务不会相互阻塞');
  } else {
    console.log('\n');
    error(`⚠️  有 ${failed} 个测试失败`);
  }

  console.log('\n');
  
  // 失败时退出码非零
  if (failed > 0) {
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  runAllTests().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = {
  test1_basicPoolTransaction,
  test2_concurrentTransactions,
  test3_rollback,
  test4_stockDeduction,
  test5_transfer,
  test6_whereInTransaction,
  runAllTests
};

