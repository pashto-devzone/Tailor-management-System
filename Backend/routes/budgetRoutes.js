const express = require("express");
const router = express.Router();
const budgetController = require("../controllers/budgetController");

router.get("/employees", budgetController.getEmployees);
router.post("/employees", budgetController.addEmployee);
router.put("/employees/:id", budgetController.updateEmployee);
router.delete("/employees/:id", budgetController.deleteEmployee);

router.get("/expenses", budgetController.getExpenses);
router.post("/expenses", budgetController.addExpense);
router.delete("/expenses/:id", budgetController.deleteExpense);

router.get("/income", budgetController.getIncome);
router.post("/income", budgetController.addIncome);
router.delete("/income/:id", budgetController.deleteIncome);

router.get("/salaries", budgetController.getSalaries);
router.post("/salaries", budgetController.addSalary);
router.put("/salaries/:id", budgetController.updateSalary);

module.exports = router;
