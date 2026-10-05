import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  FaUsers,
  FaClipboardList,
  FaClock,
  FaCheckCircle,
  FaDollarSign,
  FaMoneyBillWave,
  FaChartLine,
  FaFilter,
} from "react-icons/fa";
import { getCustomers, getOrders, getIncome, getExpenses } from "../services/api";

export default function Dashboard() {
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [income, setIncome] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const retryCountRef = useRef(0);

  const filterOptions = useMemo(
    () => [
      { value: "all", label: "All Time" },
      { value: "last_week", label: "Last Week" },
      { value: "last_month", label: "Last Month" },
      { value: "last_year", label: "Last Year" },
    ],
    []
  );

  const [selectedFilter, setSelectedFilter] = useState("all");

  const rangeDays = useMemo(() => {
    if (selectedFilter === "last_week") return 7;
    if (selectedFilter === "last_month") return 30;
    if (selectedFilter === "last_year") return 365;
    return null;
  }, [selectedFilter]);



  const rangeStartDate = useMemo(() => {
    if (rangeDays == null) return null;
    const d = new Date();
    d.setDate(d.getDate() - rangeDays);
    return d;
  }, [rangeDays]);


  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const range = rangeDays == null ? "all" : String(rangeDays);

      const [customersRes, ordersRes, incomeRes, expensesRes] = await Promise.all([
        getCustomers({ range }),
        getOrders({ range }),
        getIncome({ range }),
        getExpenses({ range }),
      ]);

      setCustomers(Array.isArray(customersRes.data) ? customersRes.data : []);
      setOrders(Array.isArray(ordersRes.data) ? ordersRes.data : []);
      setIncome(Array.isArray(incomeRes.data) ? incomeRes.data : []);
      setExpenses(Array.isArray(expensesRes.data) ? expensesRes.data : []);
      setLastRefresh(new Date());
      retryCountRef.current = 0;
    } catch (err) {
      const isNetworkError = !err?.response;
      const msg = err.response?.data?.message || err.message || "Failed to load dashboard data.";

      if (isNetworkError && retryCountRef.current < 5) {
        retryCountRef.current += 1;
        setError("Backend is starting... retrying");
        setTimeout(loadDashboardData, 800);
      } else {
        setError(err.response?.data?.message || "Failed to load dashboard data.");
      }
    } finally {
      setLoading(false);
    }
  }, [rangeDays]);

  useEffect(() => {
    loadDashboardData();

    // Optional: Set up auto-refresh every 30 seconds (respects selected filter)
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, [loadDashboardData]);

  // Calculate metrics
  const pendingOrders = orders.filter((order) => order.status === "pending").length;
  const readyOrders = orders.filter((order) => order.status === "ready").length;
  const completedOrders = orders.filter((order) => order.status === "delivered").length;

  const totalIncome = income.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalExpenses = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const netProfit = totalIncome - totalExpenses;


  const today = new Date().toISOString().split("T")[0];

  const totalPaidToday = income
    .filter(
      (item) =>
        (item.source === "Order Advance" || item.source === "Order Final Payment") &&
        item.date?.startsWith(today)
    )
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  // If backend doesn't implement date filtering yet, we still need dashboard behavior.
  // Keep metrics consistent by applying date filtering client-side as well.
  const isInRange = (dateValue) => {
    if (!dateValue) return false;
    if (!rangeStartDate) return true;

    const d = new Date(dateValue);
    if (Number.isNaN(d.getTime())) return false;
    // inclusive
    return d >= rangeStartDate;
  };

  const filteredCustomers = rangeStartDate
    ? customers.filter((c) => isInRange(c.created_at ?? c.date ?? c.createdAt))
    : customers;

  const filteredOrders = rangeStartDate ? orders.filter((o) => isInRange(o.created_at ?? o.createdAt)) : orders;

  const filteredIncome = rangeStartDate
    ? income.filter((i) => isInRange(i.date))
    : income;

  const filteredExpenses = rangeStartDate
    ? expenses.filter((e) => isInRange(e.date))
    : expenses;

  const filteredPendingOrders = filteredOrders.filter((order) => order.status === "pending").length;
  const filteredReadyOrders = filteredOrders.filter((order) => order.status === "ready").length;
  const filteredCompletedOrders = filteredOrders.filter((order) => order.status === "delivered").length;

  const filteredTotalIncome = filteredIncome.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const filteredTotalExpenses = filteredExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const filteredNetProfit = filteredTotalIncome - filteredTotalExpenses;

  const filteredRemainingPayments = filteredOrders.reduce(
    (sum, order) => sum + Number(order.remaining_amount ?? order.balance ?? 0),
    0
  );

  // Paid Today should not be range-filtered (requirement says Paid Today when applicable)
  // Use it directly from overall income for today's date.
  const totalPaidTodayForDisplay = totalPaidToday;


  const remainingPayments = orders.reduce(
    (sum, order) => sum + Number(order.remaining_amount ?? order.balance ?? 0),
    0
  );


  return (
    <div className="page-dashboard">
      <div className="section-header">
        <div>
          <h2>Dashboard</h2>
          <p>Quick overview of your tailoring business.</p>
        </div>

        <div className="dashboard-filter-actions" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <label className="dashboard-filter" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FaFilter />
            <span className="sr-only">Filter</span>
            <select
              value={selectedFilter}
              onChange={(e) => setSelectedFilter(e.target.value)}
              disabled={loading}
              style={{ padding: "6px 10px" }}
              title="Filter dashboard statistics"
            >
              {filterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <button
            className="button secondary small"
            onClick={loadDashboardData}
            disabled={loading}
            title="Refresh dashboard"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="dashboard-meta">
        <p className="text-muted">
          Filter: {filterOptions.find((o) => o.value === selectedFilter)?.label}
          {" • "}
          Last updated: {lastRefresh.toLocaleTimeString()}
        </p>
      </div>

      {error && (
        <div className="message-row">
          <p className="message error">{error}</p>
        </div>
      )}



      {/* Primary Metrics */}
      <div className="stats-grid">
        <div className="stat-card card card-primary">
          <div className="stat-icon bg-primary-soft">
            <FaUsers />
          </div>
          <div>
            <p>Total Customers</p>
            <h3>{rangeStartDate ? filteredCustomers.length : customers.length}</h3>

            <small className="stat-change">Active customers</small>
          </div>
        </div>

        <div className="stat-card card card-primary">
          <div className="stat-icon bg-primary-soft">
            <FaClipboardList />
          </div>
          <div>
            <p>Total Orders</p>
            <h3>{rangeStartDate ? filteredOrders.length : orders.length}</h3>

            <small className="stat-change">All time orders</small>
          </div>
        </div>

        <div className="stat-card card card-warning">
          <div className="stat-icon bg-warning-soft">
            <FaClock />
          </div>
          <div>
            <p>Pending Orders</p>
            <h3>{rangeStartDate ? filteredPendingOrders : pendingOrders}</h3>

            <small className="stat-change">Awaiting work</small>
          </div>
        </div>

        <div className="stat-card card card-success">
          <div className="stat-icon bg-success-soft">
            <FaCheckCircle />
          </div>
          <div>
            <p>Completed Orders</p>
            <h3>{rangeStartDate ? filteredCompletedOrders : completedOrders}</h3>

            <small className="stat-change">Delivered</small>
          </div>
        </div>
      </div>

      {/* Financial Metrics */}
      <div className="stats-grid">
        <div className="stat-card card card-success">
          <div className="stat-icon bg-success-soft">
            <FaMoneyBillWave />
          </div>
          <div>
            <p>Total Income</p>
            <h3>Rs {(rangeStartDate ? filteredTotalIncome : totalIncome).toLocaleString()}</h3>

            <small className="stat-change">From orders</small>
          </div>
        </div>

        <div className="stat-card card card-info">
          <div className="stat-icon bg-info-soft">
            <FaMoneyBillWave />
          </div>
          <div>
            <p>Paid Today</p>
            <h3>Rs {totalPaidTodayForDisplay.toLocaleString()}</h3>

            <small className="stat-change">Order payments received</small>
          </div>
        </div>

        <div className="stat-card card card-danger">
          <div className="stat-icon bg-danger-soft">
            <FaDollarSign />
          </div>
          <div>
            <p>Total Expenses</p>
            <h3>Rs {(rangeStartDate ? filteredTotalExpenses : totalExpenses).toLocaleString()}</h3>

            <small className="stat-change">Total costs</small>
          </div>
        </div>

        <div className="stat-card card card-warning">
          <div className="stat-icon bg-warning-soft">
            <FaDollarSign />
          </div>
          <div>
            <p>Remaining Payments</p>
            <h3>Rs {(rangeStartDate ? filteredRemainingPayments : remainingPayments).toLocaleString()}</h3>

            <small className="stat-change">Pending balances</small>
          </div>
        </div>

        <div className={`stat-card card ${(rangeStartDate ? filteredNetProfit : netProfit) >= 0 ? "card-success" : "card-danger"}`}>

          <div className={`stat-icon ${netProfit >= 0 ? "bg-success-soft" : "bg-danger-soft"}`}>
            <FaChartLine />
          </div>
          <div>
            <p>Net Profit</p>
            <h3>Rs {(rangeStartDate ? filteredNetProfit : netProfit).toLocaleString()}</h3>
            <small className="stat-change">
              {(rangeStartDate ? filteredNetProfit : netProfit) >= 0 ? "Profit" : "Loss"}
            </small>

          </div>
        </div>

        <div className="stat-card card card-info">
          <div className="stat-icon bg-info-soft">
            <FaClipboardList />
          </div>
          <div>
            <p>Ready Orders</p>
            <h3>{rangeStartDate ? filteredReadyOrders : readyOrders}</h3>

            <small className="stat-change">Ready for pickup</small>
          </div>
        </div>
      </div>

      {/* Summary Section */}
      <div className="dashboard-summary card">
        <h3>Quick Summary</h3>
        <div className="summary-grid">
          <div className="summary-item">
            <span className="label">Order Status Distribution:</span>
            <span className="value">
              {pendingOrders} Pending • {readyOrders} Ready • {completedOrders} Completed
            </span>
          </div>
          <div className="summary-item">
            <span className="label">Financial Health:</span>
            <span className={`value ${netProfit >= 0 ? "success" : "danger"}`}>
              {netProfit >= 0 ? "Profit" : "Loss"} of Rs {Math.abs(netProfit).toLocaleString()}
            </span>
          </div>
          <div className="summary-item">
            <span className="label">Customer Engagement:</span>
            <span className="value">
              {customers.length > 0 ? (orders.length / customers.length).toFixed(1) : 0} orders per customer
            </span>
          </div>
          <div className="summary-item">
            <span className="label">Average Order Value:</span>
            <span className="value">
              Rs {orders.length > 0 ? (totalIncome / orders.length).toFixed(0).toLocaleString() : 0}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
