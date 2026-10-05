import { useEffect, useState } from "react";
import { FaTimes } from "react-icons/fa";

const defaultState = {
  employee: { name: "", role: "darzi", salary: "" },
  expense: { title: "", amount: "", date: "" },
  income: { source: "", amount: "", date: "" },
  salary: { employee_id: "", amount: "", month: "", status: "unpaid" },
};

export default function BudgetModal({ open, type, onClose, onSubmit, loading, error, employees = [], initialData = null }) {
  const [formData, setFormData] = useState(defaultState[type] || {});

  useEffect(() => {
    if (!open) return;
    setFormData(initialData || defaultState[type] || {});
  }, [type, initialData, open]);

  const handleChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit(formData);
  };

  if (!open) return null;

  const titleMap = {
    employee: "Add Employee",
    expense: "Add Expense",
    income: "Add Income",
    salary: "Record Salary Payment",
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card budget-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{titleMap[type] || "Add Record"}</h3>
          <button type="button" className="icon-button" onClick={onClose}>
            <FaTimes />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          {type === "employee" && (
            <>
              <label>
                Employee Name
                <input value={formData.name} onChange={(e) => handleChange("name", e.target.value)} required />
              </label>
              <label>
                Role
                <input value={formData.role} onChange={(e) => handleChange("role", e.target.value)} required />
              </label>
              <label>
                Monthly Salary
                <input type="number" min="0" value={formData.salary} onChange={(e) => handleChange("salary", e.target.value)} required />
              </label>
            </>
          )}

          {type === "expense" && (
            <>
              <label>
                Expense Title
                <input value={formData.title} onChange={(e) => handleChange("title", e.target.value)} required />
              </label>
              <label>
                Amount
                <input type="number" min="0" value={formData.amount} onChange={(e) => handleChange("amount", e.target.value)} required />
              </label>
              <label>
                Date
                <input type="date" value={formData.date} onChange={(e) => handleChange("date", e.target.value)} required />
              </label>
            </>
          )}

          {type === "income" && (
            <>
              <label>
                Income Source
                <input value={formData.source} onChange={(e) => handleChange("source", e.target.value)} required />
              </label>
              <label>
                Amount
                <input type="number" min="0" value={formData.amount} onChange={(e) => handleChange("amount", e.target.value)} required />
              </label>
              <label>
                Date
                <input type="date" value={formData.date} onChange={(e) => handleChange("date", e.target.value)} required />
              </label>
            </>
          )}

          {type === "salary" && (
            <>
              <label>
                Employee
                <select value={formData.employee_id} onChange={(e) => handleChange("employee_id", e.target.value)} required>
                  <option value="">Select employee</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name} ({employee.role})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Amount
                <input type="number" min="0" value={formData.amount} onChange={(e) => handleChange("amount", e.target.value)} required />
              </label>
              <label>
                Month
                <input type="month" value={formData.month} onChange={(e) => handleChange("month", e.target.value)} required />
              </label>
              <label>
                Status
                <select value={formData.status} onChange={(e) => handleChange("status", e.target.value)}>
                  <option value="unpaid">Unpaid</option>
                  <option value="paid">Paid</option>
                </select>
              </label>
            </>
          )}

          {error && <p className="message error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="button secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="button primary" disabled={loading}>
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
