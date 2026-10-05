const budgetModel = require("../models/budgetModel");

exports.getEmployees = async (req, res) => {
  const storeId = req.storeId;
  res.json(await budgetModel.getEmployees(storeId));
};

exports.addEmployee = async (req, res) => {
  const { name, role, salary } = req.body;
  const storeId = req.storeId;
  if (!name || !role || salary == null) {
    return res.status(400).json({ message: "Employee name, role and salary are required" });
  }
  const parsedSalary = Number(salary);
  if (Number.isNaN(parsedSalary)) {
    return res.status(400).json({ message: "Salary must be a valid number" });
  }
  await budgetModel.createEmployee({ name, role, salary: parsedSalary, storeId });
  res.json({ message: "Employee saved successfully" });
};

exports.deleteEmployee = async (req, res) => {
  const { id } = req.params;
  const storeId = req.storeId;
  const existing = (await budgetModel.getEmployees(storeId)).find((item) => item.id === Number(id));
  if (!existing) {
    return res.status(404).json({ message: "Employee not found" });
  }
  await budgetModel.deleteEmployee(id, storeId);
  res.json({ message: "Employee deleted successfully" });
};

exports.updateEmployee = async (req, res) => {
  const { id } = req.params;
  const { salaryStatus } = req.body;
  const storeId = req.storeId;
  const normalizedStatus = salaryStatus === "Paid" ? "Paid" : "Remaining";
  const existingEmployee = (await budgetModel.getEmployees(storeId)).find((item) => item.id === Number(id));

  if (!existingEmployee) {
    return res.status(404).json({ message: "Employee not found" });
  }

  await budgetModel.updateEmployee({ id, salaryStatus: normalizedStatus, storeId });
  res.json({ message: "Employee salary status updated successfully" });
};

exports.getExpenses = async (req, res) => {
  const storeId = req.storeId;
  res.json(await budgetModel.getExpenses(storeId));
};

exports.addExpense = async (req, res) => {
  const { title, amount, date } = req.body;
  const storeId = req.storeId;
  if (!title || amount == null || !date) {
    return res.status(400).json({ message: "Expense title, amount and date are required" });
  }
  const parsedAmount = Number(amount);
  if (Number.isNaN(parsedAmount)) {
    return res.status(400).json({ message: "Amount must be a valid number" });
  }
  await budgetModel.createExpense({ title, amount: parsedAmount, date, storeId });
  res.json({ message: "Expense saved successfully" });
};

exports.deleteExpense = async (req, res) => {
  const { id } = req.params;
  const storeId = req.storeId;
  const existing = (await budgetModel.getExpenses(storeId)).find((item) => item.id === Number(id));
  if (!existing) {
    return res.status(404).json({ message: "Expense not found" });
  }
  await budgetModel.deleteExpense(id, storeId);
  res.json({ message: "Expense deleted successfully" });
};

exports.getIncome = async (req, res) => {
  const storeId = req.storeId;
  res.json(await budgetModel.getIncome(storeId));
};

exports.addIncome = async (req, res) => {
  const { source, amount, date, linked_order_id, payment_type } = req.body;
  const storeId = req.storeId;
  if (!source || amount == null || !date) {
    return res.status(400).json({ message: "Income source, amount and date are required" });
  }
  const parsedAmount = Number(amount);
  if (Number.isNaN(parsedAmount)) {
    return res.status(400).json({ message: "Amount must be a valid number" });
  }

  if (linked_order_id != null) {
    const orderModel = require("../models/orderModel");
    const order = await orderModel.getOrderById(Number(linked_order_id), storeId);
    if (!order) {
      return res.status(404).json({ message: "Linked order not found in this store" });
    }
  }

  const incomeData = {
    source,
    amount: parsedAmount,
    date,
    storeId,
  };
  if (linked_order_id != null) {
    incomeData.linked_order_id = linked_order_id;
  }
  if (payment_type != null) {
    incomeData.payment_type = payment_type;
  }
  await budgetModel.createIncome(incomeData);
  res.json({ message: "Income saved successfully" });
};

exports.deleteIncome = async (req, res) => {
  const { id } = req.params;
  const storeId = req.storeId;
  const existing = (await budgetModel.getIncome(storeId)).find((item) => item.id === Number(id));
  if (!existing) {
    return res.status(404).json({ message: "Income not found" });
  }
  await budgetModel.deleteIncome(id, storeId);
  res.json({ message: "Income deleted successfully" });
};

exports.getSalaries = async (req, res) => {
  const storeId = req.storeId;
  res.json(await budgetModel.getSalaries(storeId));
};

exports.addSalary = async (req, res) => {
  const { employee_id, amount, month, status } = req.body;
  const storeId = req.storeId;
  if (!employee_id || amount == null || !month) {
    return res.status(400).json({ message: "Employee, amount and month are required" });
  }
  const parsedAmount = Number(amount);
  if (Number.isNaN(parsedAmount)) {
    return res.status(400).json({ message: "Amount must be a valid number" });
  }
  const normalizedStatus = status === "paid" ? "paid" : "unpaid";
  await budgetModel.createSalary({ employee_id, amount: parsedAmount, month, status: normalizedStatus, storeId });
  res.json({ message: "Salary record save ho gaya" });
};

exports.updateSalary = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const storeId = req.storeId;
  if (!status || !["paid", "unpaid"].includes(status)) {
    return res.status(400).json({ message: "Status paid ya unpaid hona chahiye" });
  }
  const existingSalary = await budgetModel.getSalaryById(id, storeId);
  if (!existingSalary) {
    return res.status(404).json({ message: "Salary record nahi mila" });
  }
  await budgetModel.updateSalary({ id, status, storeId });
  res.json({ message: "Salary status update ho gaya" });
};
