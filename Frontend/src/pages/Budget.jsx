import { useEffect, useMemo, useState } from "react";
import { FaDollarSign, FaFileInvoiceDollar, FaUsers, FaChartLine, FaDownload } from "react-icons/fa";
import jsPDF from "jspdf";
import { useShop } from "../contexts/ShopContext";
import {
  getEmployees,
  addEmployee,
  deleteEmployee,
  updateEmployee,
  getExpenses,
  addExpense,
  deleteExpense,
  getIncome,
  addIncome,
  deleteIncome,
} from "../services/api";

export default function Budget() {
  const { shop } = useShop();
  const [employees, setEmployees] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [income, setIncome] = useState([]);
  const [loading, setLoading] = useState(false);

  const [employeeForm, setEmployeeForm] = useState({ name: "", role: "", salary: "" });
  const [expenseForm, setExpenseForm] = useState({ title: "", amount: "", date: "" });
  const [incomeForm, setIncomeForm] = useState({ source: "", amount: "", date: "" });

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [filter, setFilter] = useState("all"); // "all", "thisMonth", "prevMonth"
  const formatAmount = (value) => Number(value || 0).toFixed(2);

  const getFilteredData = (data) => {
    if (filter === "all") return data;
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    return data.filter((item) => {
      const itemDate = new Date(item.date);
      if (filter === "thisMonth") {
        return itemDate.getMonth() === currentMonth && itemDate.getFullYear() === currentYear;
      } else if (filter === "prevMonth") {
        const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        return itemDate.getMonth() === prevMonth && itemDate.getFullYear() === prevYear;
      }
      return true;
    });
  };

  const filteredExpenses = useMemo(() => getFilteredData(expenses), [expenses, filter]);
  const filteredIncome = useMemo(() => getFilteredData(income), [income, filter]);

  const totalIncome = useMemo(
    () => filteredIncome.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [filteredIncome]
  );

  const totalExpenses = useMemo(
    () => filteredExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [filteredExpenses]
  );

  const profit = totalIncome - totalExpenses;

  const loadBudgetData = async () => {
    setLoading(true);
    setError("");
    try {
      const [employeesRes, expensesRes, incomeRes] = await Promise.all([
        getEmployees(),
        getExpenses(),
        getIncome(),
      ]);
      setEmployees(Array.isArray(employeesRes.data) ? employeesRes.data : []);
      setExpenses(Array.isArray(expensesRes.data) ? expensesRes.data : []);
      setIncome(Array.isArray(incomeRes.data) ? incomeRes.data : []);
    } catch (err) {
      setError(err.response?.data?.message || "Budget data load failed.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBudgetData();
  }, []);

  const handleAddEmployee = async (event) => {
    event.preventDefault();
    if (!employeeForm.name || !employeeForm.role || !employeeForm.salary) {
      setError("Please complete all employee fields.");
      setMessage("");
      return;
    }
    setError("");
    try {
      await addEmployee({
        name: employeeForm.name,
        role: employeeForm.role,
        salary: Number(employeeForm.salary),
        salaryStatus: "Remaining",
      });
      setEmployeeForm({ name: "", role: "", salary: "" });
      setMessage("Employee added successfully.");
      await loadBudgetData();
    } catch (err) {
      setError(err.response?.data?.message || "Employee add failed.");
    }
  };

  const handleToggleSalaryStatus = async (id) => {
    const employee = employees.find((item) => item.id === id);
    if (!employee) return;

    const nextStatus = employee.salaryStatus === "Paid" ? "Remaining" : "Paid";
    setError("");
    try {
      await updateEmployee(id, { salaryStatus: nextStatus });
      setMessage("Salary status updated.");
      await loadBudgetData();
    } catch (err) {
      setError(err.response?.data?.message || "Salary update failed.");
    }
  };

  const handleAddExpense = async (event) => {
    event.preventDefault();
    if (!expenseForm.title || !expenseForm.amount || !expenseForm.date) {
      setError("Please complete all expense fields.");
      setMessage("");
      return;
    }
    setError("");
    try {
      await addExpense({
        title: expenseForm.title,
        amount: Number(expenseForm.amount),
        date: expenseForm.date,
      });
      setExpenseForm({ title: "", amount: "", date: "" });
      setMessage("Expense added successfully.");
      await loadBudgetData();
    } catch (err) {
      setError(err.response?.data?.message || "Expense add failed.");
    }
  };

  const handleAddIncome = async (event) => {
    event.preventDefault();
    if (!incomeForm.source || !incomeForm.amount || !incomeForm.date) {
      setError("Please complete all income fields.");
      setMessage("");
      return;
    }
    setError("");
    try {
      await addIncome({
        source: incomeForm.source,
        amount: Number(incomeForm.amount),
        date: incomeForm.date,
      });
      setIncomeForm({ source: "", amount: "", date: "" });
      setMessage("Income added successfully.");
      await loadBudgetData();
    } catch (err) {
      setError(err.response?.data?.message || "Income add failed.");
    }
  };

  const handleDelete = async (type, id) => {
    setError("");
    setMessage("");
    try {
      if (type === "employee") {
        await deleteEmployee(id);
      } else if (type === "expense") {
        await deleteExpense(id);
      } else if (type === "income") {
        await deleteIncome(id);
      }
      setMessage("Record removed.");
      await loadBudgetData();
    } catch (err) {
      setError(err.response?.data?.message || "Delete failed.");
    }
  };

  const downloadReportPdf = () => {
    const doc = new jsPDF();
    const shopName = shop?.name || "Tailor Shop";
    const filterText = filter === "all" ? "All Time" : filter === "thisMonth" ? "This Month" : "Previous Month";

    doc.setFontSize(20);
    doc.text(shopName, 20, 20);
    doc.setFontSize(16);
    doc.text(`Budget Report - ${filterText}`, 20, 35);

    doc.setFontSize(12);
    doc.text(`Total Income: Rs ${totalIncome.toFixed(2)}`, 20, 50);
    doc.text(`Total Expenses: Rs ${totalExpenses.toFixed(2)}`, 20, 60);
    doc.text(`Net Profit: Rs ${profit.toFixed(2)}`, 20, 70);

    let y = 85;
    doc.text("Income Transactions:", 20, y);
    y += 10;
    filteredIncome.forEach((item) => {
      doc.text(`${item.date}: ${item.source} - Rs ${item.amount}`, 20, y);
      y += 10;
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    });

    y += 10;
    doc.text("Expense Transactions:", 20, y);
    y += 10;
    filteredExpenses.forEach((item) => {
      doc.text(`${item.date}: ${item.title} - Rs ${item.amount}`, 20, y);
      y += 10;
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    });

    doc.save(`budget-report-${filter}.pdf`);
  };

  return (
    <div className="page-budget">
      <div className="section-header">
        <div>
          <h2>Budget Management</h2>
          <p>Manage employees, income, and expenses with a clean dashboard.</p>
        </div>
        <div className="header-actions">
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="form-select">
            <option value="all">All Time</option>
            <option value="thisMonth">This Month</option>
            <option value="prevMonth">Previous Month</option>
          </select>
          <button onClick={downloadReportPdf} className="btn btn-primary">
            <FaDownload /> Download Report PDF
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card card card-primary">
          <div className="stat-icon bg-primary-soft">
            <FaDollarSign />
          </div>
          <div>
            <p>Total Income</p>
            <h3>Rs {totalIncome.toFixed(2)}</h3>
          </div>
        </div>
        <div className="stat-card card card-warning">
          <div className="stat-icon bg-warning-soft">
            <FaFileInvoiceDollar />
          </div>
          <div>
            <p>Total Expenses</p>
            <h3>Rs {totalExpenses.toFixed(2)}</h3>
          </div>
        </div>
        <div className="stat-card card card-success">
          <div className="stat-icon bg-success-soft">
            <FaChartLine />
          </div>
          <div>
            <p>Profit</p>
            <h3>Rs {profit.toFixed(2)}</h3>
          </div>
        </div>
        <div className="stat-card card card-primary">
          <div className="stat-icon bg-primary-soft">
            <FaUsers />
          </div>
          <div>
            <p>Employees</p>
            <h3>{employees.length}</h3>
          </div>
        </div>
      </div>

      <div className="message-row">
        {message && <p className="message success">{message}</p>}
        {error && <p className="message error">{error}</p>}
      </div>

      <div className="page-grid budget-grid">
        <section className="card">
          <div className="section-title">
            <h3>Employees</h3>
          </div>
          <form className="budget-form" onSubmit={handleAddEmployee}>
            <div className="grid-two">
              <label>
                Name
                <input
                  value={employeeForm.name}
                  onChange={(e) => setEmployeeForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Employee name"
                />
              </label>
              <label>
                Role
                <input
                  value={employeeForm.role}
                  onChange={(e) => setEmployeeForm((prev) => ({ ...prev, role: e.target.value }))}
                  placeholder="tailor, helper"
                />
              </label>
              <label>
                Salary
                <input
                  type="number"
                  min="0"
                  value={employeeForm.salary}
                  onChange={(e) => setEmployeeForm((prev) => ({ ...prev, salary: e.target.value }))}
                  placeholder="Monthly salary"
                />
              </label>
              <div>
                <button type="submit" className="button primary">
                  Add Employee
                </button>
              </div>
            </div>
          </form>

          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Salary</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <tr key={employee.id}>
                    <td>{employee.name}</td>
                    <td>{employee.role}</td>
                    <td>Rs {formatAmount(employee.salary)}</td>
                    <td>
                      <span className={`status-badge ${employee.salaryStatus === "Paid" ? "paid" : "remaining"}`}>
                        {employee.salaryStatus}
                      </span>
                    </td>
                    <td className="button-row">
                      <button
                        type="button"
                        className={`button ${employee.salaryStatus === "Paid" ? "secondary" : "primary"} small`}
                        onClick={() => handleToggleSalaryStatus(employee.id)}
                      >
                        {employee.salaryStatus === "Paid" ? "Mark Remaining" : "Mark Paid"}
                      </button>
                      <button className="button danger small" onClick={() => handleDelete("employee", employee.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="section-title">
            <h3>Expenses</h3>
          </div>
          <form className="budget-form" onSubmit={handleAddExpense}>
            <div className="grid-two">
              <label>
                Title
                <input
                  value={expenseForm.title}
                  onChange={(e) => setExpenseForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Fabric, electricity bill"
                />
              </label>
              <label>
                Amount
                <input
                  type="number"
                  min="0"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm((prev) => ({ ...prev, amount: e.target.value }))}
                  placeholder="Amount"
                />
              </label>
              <label>
                Date
                <input
                  type="date"
                  value={expenseForm.date}
                  onChange={(e) => setExpenseForm((prev) => ({ ...prev, date: e.target.value }))}
                />
              </label>
              <div>
                <button type="submit" className="button primary">
                  Add Expense
                </button>
              </div>
            </div>
          </form>

          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id}>
                    <td>{expense.title}</td>
                    <td>Rs {formatAmount(expense.amount)}</td>
                    <td>{new Date(expense.date).toLocaleDateString()}</td>
                    <td>
                      <button className="button danger small" onClick={() => handleDelete("expense", expense.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="section-title">
            <h3>Income</h3>
          </div>
          <form className="budget-form" onSubmit={handleAddIncome}>
            <div className="grid-two">
              <label>
                Source
                <input
                  value={incomeForm.source}
                  onChange={(e) => setIncomeForm((prev) => ({ ...prev, source: e.target.value }))}
                  placeholder="Order payment, other"
                />
              </label>
              <label>
                Amount
                <input
                  type="number"
                  min="0"
                  value={incomeForm.amount}
                  onChange={(e) => setIncomeForm((prev) => ({ ...prev, amount: e.target.value }))}
                  placeholder="Amount"
                />
              </label>
              <label>
                Date
                <input
                  type="date"
                  value={incomeForm.date}
                  onChange={(e) => setIncomeForm((prev) => ({ ...prev, date: e.target.value }))}
                />
              </label>
              <div>
                <button type="submit" className="button primary">
                  Add Income
                </button>
              </div>
            </div>
          </form>

          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {income.map((item) => (
                  <tr key={item.id}>
                    <td>{item.source}</td>
                    <td>Rs {formatAmount(item.amount)}</td>
                    <td>{new Date(item.date).toLocaleDateString()}</td>
                    <td>
                      <button className="button danger small" onClick={() => handleDelete("income", item.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
