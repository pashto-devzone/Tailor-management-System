const db = require("../config/db");

exports.createEmployee = async ({ name, role, salary, salaryStatus = "Remaining", storeId = 1 }) =>
  db.prepare("INSERT INTO employees (store_id, name, role, salary, salary_status) VALUES (?, ?, ?, ?, ?) RETURNING id")
    .run(storeId, name, role, salary, salaryStatus);
exports.getEmployees = async (storeId = 1) => db.prepare(
  'SELECT id, name, role, salary, salary_status AS "salaryStatus" FROM employees WHERE store_id = ? ORDER BY id DESC',
).all(storeId);
exports.updateEmployee = async ({ id, salaryStatus, storeId = 1 }) =>
  db.prepare("UPDATE employees SET salary_status = ? WHERE id = ? AND store_id = ?").run(salaryStatus, id, storeId);
exports.deleteEmployee = async (id, storeId = 1) => db.prepare("DELETE FROM employees WHERE id = ? AND store_id = ?").run(id, storeId);

exports.createExpense = async ({ title, amount, date, storeId = 1 }) =>
  db.prepare("INSERT INTO expenses (store_id, title, amount, date) VALUES (?, ?, ?, ?) RETURNING id").run(storeId, title, amount, date);
exports.getExpenses = async (storeId = 1) => db.prepare("SELECT * FROM expenses WHERE store_id = ? ORDER BY date DESC, id DESC").all(storeId);
exports.deleteExpense = async (id, storeId = 1) => db.prepare("DELETE FROM expenses WHERE id = ? AND store_id = ?").run(id, storeId);

exports.createIncome = async ({ source, amount, date, linked_order_id = null, payment_type = null, storeId = 1 }) =>
  db.prepare("INSERT INTO income (store_id, source, amount, date, linked_order_id, payment_type) VALUES (?, ?, ?, ?, ?, ?) RETURNING id")
    .run(storeId, source, amount, date, linked_order_id, payment_type);
exports.findOrderPaymentIncome = async ({ linked_order_id, payment_type, storeId = 1 }) =>
  db.prepare("SELECT id, amount, date FROM income WHERE linked_order_id = ? AND payment_type = ? AND store_id = ? LIMIT 1")
    .get(linked_order_id, payment_type, storeId);
exports.upsertOrderPaymentIncome = async (data) => {
  const existing = await exports.findOrderPaymentIncome(data);
  if (existing?.id) {
    return db.prepare("UPDATE income SET source = ?, amount = ?, date = ? WHERE id = ?").run(data.source, data.amount, data.date, existing.id);
  }
  return exports.createIncome(data);
};
exports.deleteIncomeByOrderId = async (linked_order_id, storeId = 1) => db.prepare("DELETE FROM income WHERE linked_order_id = ? AND store_id = ?").run(linked_order_id, storeId);
exports.getIncome = async (storeId = 1) => db.prepare("SELECT * FROM income WHERE store_id = ? ORDER BY date DESC, id DESC").all(storeId);
exports.deleteIncome = async (id, storeId = 1) => db.prepare("DELETE FROM income WHERE id = ? AND store_id = ?").run(id, storeId);

exports.createSalary = async ({ employee_id, amount, month, status, storeId = 1 }) =>
  db.prepare("INSERT INTO salaries (store_id, employee_id, amount, month, status) VALUES (?, ?, ?, ?, ?) RETURNING id").run(storeId, employee_id, amount, month, status);
exports.getSalaries = async (storeId = 1) => db.prepare(
  `SELECT s.*, e.name AS employee_name, e.role AS employee_role FROM salaries s
   LEFT JOIN employees e ON s.employee_id = e.id WHERE s.store_id = ? ORDER BY s.month DESC, s.id DESC`,
).all(storeId);
exports.getSalaryById = async (id, storeId = 1) => db.prepare("SELECT * FROM salaries WHERE id = ? AND store_id = ?").get(id, storeId);
exports.updateSalary = async ({ id, status, storeId = 1 }) => db.prepare("UPDATE salaries SET status = ? WHERE id = ? AND store_id = ?").run(status, id, storeId);
