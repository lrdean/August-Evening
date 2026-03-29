import React, { useEffect, useMemo, useState } from "react";
import TransactionRow, {
  type Transaction,
} from "./transactions/TransactionRow";

import { useLocalStorageList } from "./expenses/useLocalStorageList";
import { useDebug } from "../contexts/DebugContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

const DiscretionaryExpense: React.FC = () => {
  const { isDebugVisible } = useDebug();
  const [categories, setCategories] = useLocalStorageList(
    "bb_expense_categories",
    [
      "Housing",
      "Utilities",
      "Transportation",
      "Food & Dining",
      "Healthcare",
      "Insurance",
      "Debt Payments",
      "Entertainment",
      "Shopping",
      "Education",
      "Gifts & Donations",
      "Personal Care",
      "Subscriptions",
      "Other",
    ]
  );
  const [accounts, setAccounts] = useLocalStorageList("bb_accounts", [
    "Checking",
    "Savings",
    "Credit Card",
    "Investment Account",
    "Emergency Fund",
    "Business Account",
  ]);

  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [pendingRowForCategory, setPendingRowForCategory] = useState<
    string | null
  >(null);

  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newAccount, setNewAccount] = useState("");
  const [pendingRowForAccount, setPendingRowForAccount] = useState<
    string | null
  >(null);

  // Per-account starting balances (shared key across app)
  const [accountBalances, setAccountBalances] = useState<
    Record<string, number>
  >({});
  const [selectedBalanceAccount, setSelectedBalanceAccount] =
    useState<string>("Checking");
  const [balanceInput, setBalanceInput] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      const stored = localStorage.getItem("bb_account_balances");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === "object") {
          console.log(
            "DiscretionaryExpenses - Loaded stored account balances:",
            parsed
          );
          setAccountBalances(parsed);
        }
      } else {
        console.log(
          "DiscretionaryExpenses - No stored account balances found, starting with empty balances"
        );
        setAccountBalances({});
      }
    } catch (error) {
      console.error(
        "DiscretionaryExpenses - Error loading account balances:",
        error
      );
      setAccountBalances({});
    }

    const updateAccountBalancesFromTransactions = () => {
      try {
        // Get all income transactions
        const incomeTransactions = JSON.parse(
          localStorage.getItem("bb_tx_income") || "[]"
        );

        // Get all expense transactions (fixed and discretionary)
        const fixedExpenses = JSON.parse(
          localStorage.getItem("bb_tx_fixed") || "[]"
        );
        const discretionaryExpenses = JSON.parse(
          localStorage.getItem("bb_tx_discretionary") || "[]"
        );
        const allExpenses = [...fixedExpenses, ...discretionaryExpenses];

        console.log("Recalculating account balances from all transactions");
        console.log("Income transactions:", incomeTransactions);
        console.log("Expense transactions:", allExpenses);

        // Get current balances to preserve goal accounts and other special accounts
        const currentBalances = { ...accountBalances };

        // Calculate net balance for each account from transactions
        const newBalances: Record<string, number> = {};

        // Add all income
        incomeTransactions.forEach((income: any) => {
          if (income.account && income.amount) {
            const account = income.account;
            const amount = Number(income.amount) || 0;
            newBalances[account] = (newBalances[account] || 0) + amount;
          }
        });

        // Subtract all expenses
        allExpenses.forEach((expense: any) => {
          if (expense.account && expense.amount) {
            const account = expense.account;
            const amount = Number(expense.amount) || 0;
            newBalances[account] = (newBalances[account] || 0) - amount;
          }
        });

        // Preserve goal accounts and other special accounts that don't come from transactions
        Object.keys(currentBalances).forEach(account => {
          if (!newBalances.hasOwnProperty(account)) {
            // This account is not affected by income/expense transactions (e.g., goal accounts)
            newBalances[account] = currentBalances[account];
          }
        });

        console.log("Updated account balances:", newBalances);
        setAccountBalances(newBalances);
      } catch (error) {
        console.error("Error updating account balances from transactions:", error);
      }
    };

    // Update balances when income or expenses change
    const onIncome = () => updateAccountBalancesFromTransactions();
    const onExpenses = () => updateAccountBalancesFromTransactions();

    window.addEventListener("bb:income-updated", onIncome);
    window.addEventListener("bb:transactions-updated", onExpenses);

    // Listen for account balance updates from other components
    const onAccountBalancesUpdated = (event: CustomEvent) => {
      console.log(
        "DiscretionaryExpenses - Received account balance update from other component:",
        event.detail
      );
      setAccountBalances(event.detail);
    };
    window.addEventListener(
      "bb:account-balances-updated",
      onAccountBalancesUpdated as EventListener
    );

    // Initial update
    updateAccountBalancesFromTransactions();

    return () => {
      window.removeEventListener("bb:income-updated", onIncome);
      window.removeEventListener("bb:transactions-updated", onExpenses);
      window.removeEventListener(
        "bb:account-balances-updated",
        onAccountBalancesUpdated as EventListener
      );
    };
  }, []); // Remove accountBalances dependency to prevent infinite loops

  useEffect(() => {
    try {
      localStorage.setItem(
        "bb_account_balances",
        JSON.stringify(accountBalances)
      );
    } catch {}

    // Notify other components that account balances have changed
    try {
      window.dispatchEvent(
        new CustomEvent("bb:account-balances-updated", {
          detail: accountBalances,
        })
      );
    } catch {}
  }, [accountBalances]);

  useEffect(() => {
    if (!selectedBalanceAccount || !accounts.includes(selectedBalanceAccount)) {
      setSelectedBalanceAccount(
        accounts.includes("Checking") ? "Checking" : accounts[0] ?? ""
      );
    }
  }, [accounts, selectedBalanceAccount]);

  useEffect(() => {
    const balanceValue = String(accountBalances[selectedBalanceAccount] ?? "");
    console.log(
      `DiscretionaryExpenses - Syncing balance input for ${selectedBalanceAccount}:`,
      balanceValue,
      "from accountBalances:",
      accountBalances
    );
    setBalanceInput((prev) => ({
      ...prev,
      [selectedBalanceAccount]: balanceValue,
    }));
  }, [selectedBalanceAccount, accountBalances]);

  const [rows, setRows] = useState<Transaction[]>([]);

  // Initialize rows when categories and accounts are available, and load from localStorage
  useEffect(() => {
    if (categories.length > 0 && accounts.length > 0) {
      try {
        const stored = localStorage.getItem("bb_tx_discretionary");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Ensure each row has a valid date and account
            const rowsWithDates = parsed.map((row) => ({
              ...row,
              date: row.date || new Date().toISOString().split("T")[0],
              account: row.account || accounts[0] || "Checking",
            }));
            setRows(rowsWithDates);
          } else {
            // No stored rows, create initial row
            setRows([
              {
                id: "dx-1",
                date: new Date().toISOString().split("T")[0],
                account: accounts[0] || "Checking", // Use first available account
                category: categories[0], // Use first category
                payee: "",
                amount: 0,
              },
            ]);
          }
        } else {
          // No stored data, create initial row
          setRows([
            {
              id: "dx-1",
              date: new Date().toISOString().split("T")[0],
              account: accounts[0] || "Checking", // Use first available account
              category: categories[0], // Use first category
              payee: "",
              amount: 0,
            },
          ]);
        }
      } catch {
        // Error loading from localStorage, create initial row
        setRows([
          {
            id: "dx-1",
            date: new Date().toISOString().split("T")[0],
            account: accounts[0] || "Checking", // Use first available account
            category: categories[0], // Use first category
            payee: "",
            amount: 0,
          },
        ]);
      }
    }
  }, [categories, accounts]);

  // persist rows and notify listeners
  useEffect(() => {
    try {
      localStorage.setItem("bb_tx_discretionary", JSON.stringify(rows));
    } catch {}
    try {
      window.dispatchEvent(new Event("bb:transactions-updated"));
    } catch {}
  }, [rows]);

  const payeeSuggestions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.payee?.trim()) set.add(r.payee.trim());
    });
    return Array.from(set).slice(-25);
  }, [rows]);

  const runningBalances = useMemo(() => {
    const map = new Map<string, number>();
    accounts.forEach((a) => map.set(a, Number(accountBalances[a] ?? 0)));
    return rows.map((r) => {
      const prev = map.get(r.account) ?? 0;
      const next = prev - (Number(r.amount) || 0);
      map.set(r.account, next);
      return next;
    });
  }, [rows, accounts, accountBalances]);

  const addNewCategory = () => {
    const c = newCategory.trim();
    if (!c || categories.includes(c)) return;
    setCategories([...categories, c]);
    if (pendingRowForCategory) {
      setRows((prev) =>
        prev.map((r) =>
          r.id === pendingRowForCategory ? { ...r, category: c } : r
        )
      );
      setPendingRowForCategory(null);
    }
    setNewCategory("");
    setShowAddCategory(false);
  };

  const addNewAccount = () => {
    const a = newAccount.trim();
    if (!a || accounts.includes(a)) return;
    setAccounts([...accounts, a]);
    setAccountBalances((prev) => ({ ...prev, [a]: prev[a] ?? 0 }));
    if (pendingRowForAccount) {
      setRows((prev) =>
        prev.map((r) =>
          r.id === pendingRowForAccount ? { ...r, account: a } : r
        )
      );
      setPendingRowForAccount(null);
    }
    setNewAccount("");
    setShowAddAccount(false);
  };

  const removeCategory = (name: string) => {
    if (!name) return;
    if (categories.length <= 1) return;
    if (rows.some((r) => r.category === name)) return;
    setCategories(categories.filter((c) => c !== name));
  };

  const removeAccount = (name: string) => {
    if (!name) return;
    if (accounts.length <= 1) return;
    if (rows.some((r) => r.account === name)) return;
    setAccounts(accounts.filter((a) => a !== name));
    setAccountBalances((prev) => {
      const { [name]: _, ...rest } = prev;
      return rest;
    });
  };

  const handleChange = (id: string, patch: Partial<Transaction>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const handleAdd = (afterId?: string) => {
    if (afterId) {
      const row = rows.find((r) => r.id === afterId);
      if (row && row.account) {
        setAccountBalances((prev) => ({
          ...prev,
          [row.account]:
            Number(prev[row.account] ?? 0) - (Number(row.amount) || 0),
        }));
      }
    }
    setRows((prev) => [
      ...prev,
      {
        id: `dx-${Date.now()}`,
        date: new Date().toISOString().split("T")[0],
        account: accounts[0] || "Checking", // Use first available account
        category: categories[0] || "Housing", // Use first category or fallback to Housing
        payee: "",
        amount: 0,
      },
    ]);
  };

  const handleRemove = (id: string) => {
    setRows((prev) =>
      prev.length > 1 ? prev.filter((r) => r.id !== id) : prev
    );
  };

  const [isExpanded, setIsExpanded] = useState(true);

  // Debug logging
  console.log(
    "DiscretionaryExpenses render - rows:",
    rows,
    "isExpanded:",
    isExpanded,
    "categories:",
    categories,
    "accounts:",
    accounts
  );
  console.log(
    "DiscretionaryExpenses - Current account balances:",
    accountBalances
  );
  console.log(
    "DiscretionaryExpenses - Selected balance account:",
    selectedBalanceAccount
  );

  return (
    <Card
      className="p-6 space-y-6 bg-slate-900 text-slate-100"
      style={{
        boxShadow: "0 10px 25px #00bcd4, 0 4px 10px #00bcd4",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h2
          className="m-0 text-xl"
          style={{ color: "rgb(0, 188, 212)", fontWeight: 600 }}
        >
          Discretionary Expenses
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsExpanded((v) => !v)}
          className="border-teal-500 hover:bg-teal-600 hover:text-purple-100"
          style={{ color: "rgb(0, 188, 212)", fontWeight: 600 }}
        >
          {isExpanded ? "Hide" : "Show"} Transactions
        </Button>
      </div>

      {/* Account balance editor */}
      {accounts.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <strong className="text-slate-200">Account Balance:</strong>

          <Select
            value={selectedBalanceAccount || ""}
            onValueChange={(val) => setSelectedBalanceAccount(val)}
          >
            <SelectTrigger
              className="w-48 bg-slate-800 border-slate-600 text-slate-500"
              style={{ color: "#f1f5f9 !important" }}
            >
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700">
              {accounts.map((a) => (
                <SelectItem key={a} value={a} className="text-slate-100">
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="text"
            value={balanceInput[selectedBalanceAccount] ?? ""}
            onChange={(e) => {
              const raw = e.target.value;
              const valid = /^-?\d*(\.\d*)?$/.test(raw);
              if (!valid && raw !== "") return;
              let cleaned = raw;
              cleaned = cleaned.replace(/^(\d)(?=\d)/, "$1");
              if (/^-?0+\d/.test(cleaned)) {
                cleaned = cleaned.replace(/^(-?)0+(?=\d)/, "$1");
              }
              setBalanceInput((prev) => ({
                ...prev,
                [selectedBalanceAccount]: cleaned,
              }));
            }}
            onBlur={() => {
              const raw = balanceInput[selectedBalanceAccount] ?? "";
              const num =
                raw === "" || raw === "-" || raw === "." || raw === "-."
                  ? 0
                  : parseFloat(raw);
              setAccountBalances((prev) => ({
                ...prev,
                [selectedBalanceAccount]: isNaN(num) ? 0 : num,
              }));
              setBalanceInput((prev) => ({
                ...prev,
                [selectedBalanceAccount]: String(isNaN(num) ? 0 : num),
              }));
            }}
            className="w-36 bg-slate-800 border-slate-600 text-slate-100"
          />

          {/* Debug info */}
          {isDebugVisible && (
            <div className="ml-5 text-xs text-slate-400 space-y-1">
              <div>
                Income in localStorage:{" "}
                {(() => {
                  try {
                    const income = JSON.parse(
                      localStorage.getItem("bb_tx_income") || "[]"
                    );
                    return income.length > 0
                      ? `${income.length} transactions`
                      : "None";
                  } catch {
                    return "Error reading";
                  }
                })()}
              </div>
              <div>Current balances: {JSON.stringify(accountBalances)}</div>
              <div>
                Raw income data:{" "}
                {(() => {
                  try {
                    const income = JSON.parse(
                      localStorage.getItem("bb_tx_income") || "[]"
                    );
                    return JSON.stringify(income.slice(0, 3));
                  } catch {
                    return "Error reading";
                  }
                })()}
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  className="bg-sky-500 hover:bg-sky-600 text-white"
                  onClick={() => {
                    try {
                      const incomeTransactions = JSON.parse(
                        localStorage.getItem("bb_tx_income") || "[]"
                      );
                      setAccountBalances((prevBalances) => {
                        const newBalances = { ...prevBalances };
                        incomeTransactions.forEach((income: any) => {
                          if (income.account && income.amount) {
                            const account = income.account;
                            const amount = Number(income.amount) || 0;
                            newBalances[account] =
                              (newBalances[account] || 0) + amount;
                          }
                        });
                        return newBalances;
                      });
                    } catch (error) {
                      console.error(
                        "DiscretionaryExpenses - Manual refresh - Error updating account balances from income:",
                        error
                      );
                    }
                  }}
                >
                  Refresh Balances
                </Button>

                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    setAccountBalances({});
                    localStorage.removeItem("bb_account_balances");
                    console.log(
                      "DiscretionaryExpenses - Reset all account balances to 0"
                    );
                  }}
                >
                  Reset Balances
                </Button>

                <Button
                  size="sm"
                  className="bg-amber-500 hover:bg-amber-600 text-white"
                  onClick={() => {
                    try {
                      window.dispatchEvent(
                        new CustomEvent("bb:account-balances-updated", {
                          detail: accountBalances,
                        })
                      );
                      console.log(
                        "DiscretionaryExpenses - Forced sync with other components"
                      );
                    } catch {}
                  }}
                >
                  Force Sync
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {(showAddCategory || showAddAccount) && isExpanded && (
        <div className="flex flex-wrap gap-3 mb-4">
          {showAddCategory && (
            <Card className="flex items-center gap-2 p-3 bg-slate-800 border-slate-700 rounded-xl">
              <span className="font-semibold text-slate-200">
                New category:
              </span>
              <Input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Category name"
                onKeyDown={(e) => {
                  if (e.key === "Enter") addNewCategory();
                  if (e.key === "Escape") setShowAddCategory(false);
                }}
                className="w-48 bg-slate-900 border-slate-700 text-slate-100"
              />
              <Button
                onClick={addNewCategory}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                Add
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddCategory(false);
                  setPendingRowForCategory(null);
                }}
                className="border-slate-600 text-slate-200 hover:bg-blue-600/20"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => removeCategory(newCategory.trim())}
                disabled={
                  !newCategory.trim() ||
                  rows.some((r) => r.category === newCategory.trim()) ||
                  categories.length <= 1
                }
              >
                Remove
              </Button>
            </Card>
          )}

          {showAddAccount && (
            <Card className="flex items-center gap-2 p-3 bg-slate-800 border-slate-700 rounded-xl">
              <span className="font-semibold text-slate-200">New account:</span>
              <Input
                type="text"
                value={newAccount}
                onChange={(e) => setNewAccount(e.target.value)}
                placeholder="Account name"
                onKeyDown={(e) => {
                  if (e.key === "Enter") addNewAccount();
                  if (e.key === "Escape") setShowAddAccount(false);
                }}
                className="w-48 bg-slate-900 border-slate-700 text-slate-100"
              />
              <Button
                onClick={addNewAccount}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                Add
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddAccount(false);
                  setPendingRowForAccount(null);
                }}
                className="border-slate-600 text-slate-200 hover:bg-blue-600/20"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => removeAccount(newAccount.trim())}
                disabled={
                  !newAccount.trim() ||
                  rows.some((r) => r.account === newAccount.trim()) ||
                  accounts.length <= 1
                }
              >
                Remove
              </Button>
            </Card>
          )}
        </div>
      )}

      {/* Transactions */}
      {isExpanded && (
        <div className="grid gap-2">
          {rows.map((row, idx) => (
            <TransactionRow
              key={row.id}
              value={row}
              categories={categories}
              accounts={accounts}
              payeeSuggestions={payeeSuggestions}
              onChange={handleChange}
              onAdd={handleAdd}
              onRemove={handleRemove}
              onNewCategoryRequested={(id) => {
                setPendingRowForCategory(id);
                setShowAddCategory(true);
              }}
              onNewAccountRequested={(id) => {
                setPendingRowForAccount(id);
                setShowAddAccount(true);
              }}
              lineBalance={runningBalances[idx] ?? 0}
            />
          ))}
        </div>
      )}
    </Card>
  );
};

export default DiscretionaryExpense;
