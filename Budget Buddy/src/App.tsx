import "./App.css";
import { useEffect, useMemo, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Header from "./components/Header";
import MonthlyOverviewBar from "./components/MonthlyOverviewBar";
import SpendingByCategoryPie from "./components/SpendingByCategoryPie";
import SavingGoals from "./components/SavingGoals";
import DiscretionaryExpense from "./components/DiscretionaryExpense";
import FixedExpenses from "./components/FixedExpenses";
import Income from "./components/Income";
import type { ExpenseCategory, CategoryTotal } from "./types";
import UserProfile from "./components/UserProfile";
import React from "react";
import { Card } from "@/components/ui/card";

import type { Transaction } from "./components/transactions/TransactionRow";
import CreditsPage from "./components/CreditsPage";
import { DebugProvider } from "./contexts/DebugContext";
import DebugToggle from "./components/DebugToggle";

// Dashboard component with all the budget functionality
function Dashboard() {
  const [txVersion, setTxVersion] = useState(0);
  const [userName, setUserName] = React.useState<string>(
    () => localStorage.getItem("budgetBuddyUserName") || ""
  );
  const [route, setRoute] = useState<"main" | "profile">("main");

  useEffect(() => {
    const onUpdated = () => setTxVersion((v) => v + 1);
    window.addEventListener("bb:transactions-updated", onUpdated);
    window.addEventListener("bb:income-updated", onUpdated);
    return () => {
      window.removeEventListener("bb:transactions-updated", onUpdated);
      window.removeEventListener("bb:income-updated", onUpdated);
    };
  }, []);

  function loadTransactions(): Transaction[] {
    try {
      const fx = JSON.parse(localStorage.getItem("bb_tx_fixed") || "[]");
      const dx = JSON.parse(
        localStorage.getItem("bb_tx_discretionary") || "[]"
      );
      const rows = ([] as Transaction[]).concat(
        Array.isArray(fx) ? fx : [],
        Array.isArray(dx) ? dx : []
      );
      return rows;
    } catch {
      return [];
    }
  }

  function aggregateByCategory(items: Transaction[]): CategoryTotal[] {
    const categoryToTotal = new Map<ExpenseCategory, number>();
    for (const item of items) {
      const raw = (item.category ?? "") as string;
      const category = (
        raw && raw.trim() ? raw.trim() : "Other"
      ) as ExpenseCategory;
      const amount = Number(item.amount) || 0;
      const existing = categoryToTotal.get(category) ?? 0;
      categoryToTotal.set(category, existing + Math.max(amount, 0));
    }
    return Array.from(categoryToTotal.entries()).map(([category, amount]) => ({
      category,
      amount,
    }));
  }

  const transactions = useMemo(() => loadTransactions(), [txVersion]);
  const totalsByCategory = useMemo(
    () => aggregateByCategory(transactions),
    [txVersion]
  );
  const totalIncome = useMemo(() => {
    try {
      const incomeTransactions = JSON.parse(
        localStorage.getItem("bb_tx_income") || "[]"
      );
      return incomeTransactions.reduce(
        (sum: number, inc: any) => sum + (Number(inc.amount) || 0),
        0
      );
    } catch {
      return 0;
    }
  }, [txVersion]);

  return (
    <div className="main-container" style={{ position: "relative" }}>
      {/* Upper right: user profile link */}
      {route === "main" && (
        <div style={{ position: "absolute", top: 24, right: 32 }}>
          <img
            src={
              localStorage.getItem("budgetBuddyProfileImage") ||
              "https://thumb.ac-illust.com/8a/8abc6308b0fdc74c612b769383d2ad7e_t.jpeg"
            }
            alt="User Profile"
            style={{
              width: 102,
              height: 102,
              cursor: "pointer",
              borderRadius: "50%",
              background: "#fff",
              boxShadow: "0 10px 25px #00bcd4, 0 4px 10px #00bcd4",
              objectFit: "cover",
            }}
            onClick={() => setRoute("profile")}
          />
        </div>
      )}
      {/* Upper left: welcome message */}
      {route === "main" && userName && (
        <div
          style={{
            position: "absolute",
            top: 24,
            left: 32,
            color: "#fff",
            fontWeight: 600,
            fontSize: "1.2em",
          }}
        >
          Welcome {userName}
        </div>
      )}
      {route === "profile" ? (
        <UserProfile
          initialName={userName}
          onSave={(name) => {
            setUserName(name);
            localStorage.setItem("budgetBuddyUserName", name);
            setRoute("main");
          }}
        />
      ) : (
        <>
          <div
            style={{ padding: "16px", maxWidth: "1400px", margin: "0 auto" }}
          >
            <Card
              className="p-6 space-y-6 bg-slate-900 text-slate-100"
              style={{
                boxShadow: "0 10px 25px #00bcd4, 0 4px 10px #00bcd4",
              }}
            >
              <Header />
            </Card>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: "20px",
              padding: "16px",
              maxWidth: "1400px",
              margin: "0 auto",
            }}
          >
            <MonthlyOverviewBar
              monthlyExpenseTotal={totalsByCategory.reduce(
                (sum, c) => sum + c.amount,
                0
              )}
              monthlyIncomeTotal={totalIncome}
            />
          </div>

          <div
            style={{ padding: "16px", maxWidth: "1400px", margin: "0 auto" }}
          >
            <Card
              className="p-6 space-y-6 bg-slate-900 text-slate-100"
              style={{
                boxShadow: "0 10px 25px #00bcd4, 0 4px 10px #00bcd4",
              }}
            >
              <SpendingByCategoryPie
                data={totalsByCategory}
                title="Spending by Category"
                denominatorTotal={totalIncome}
                centerValue={
                  totalIncome -
                  totalsByCategory.reduce((s, c) => s + c.amount, 0)
                }
              />
            </Card>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: "20px",
              padding: "16px",
              maxWidth: "1400px",
              margin: "0 auto",
            }}
          >
            <Income />
            <FixedExpenses />
            <DiscretionaryExpense />
            <SavingGoals />
          </div>
        </>
      )}
      <div
        style={{
          padding: "20px",
          textAlign: "center",
          marginBottom: "20px",
        }}
      >
        <Link
          to="/credits"
          style={{
            color: "rgb(0, 188, 212)",
            fontWeight: 600,
            textDecoration: "underline",
          }}
        >
          View Credits Page
        </Link>
      </div>
      {/* Debug Toggle - always visible */}
      <DebugToggle />
    </div>
  );
}

function App() {
  return (
    <DebugProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/credits" element={<CreditsPage />} />
        </Routes>
      </Router>
    </DebugProvider>
  );
}

export default App;
