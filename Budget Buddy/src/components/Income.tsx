import React, { useEffect, useMemo, useState } from "react";
import TransactionRow, {
  type Transaction,
} from "./transactions/TransactionRow";
import { useLocalStorageList } from "./expenses/useLocalStorageList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

const Income: React.FC = () => {
  const [categories, setCategories] = useLocalStorageList(
    "bb_income_categories",
    ["Salary", "Freelance", "Investment", "Business", "Other Income"]
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

  const [rows, setRows] = useState<Transaction[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);

  // Initialize rows when categories and accounts are available, and load from localStorage
  useEffect(() => {
    if (categories.length > 0 && accounts.length > 0) {
      try {
        const stored = localStorage.getItem("bb_tx_income");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Ensure each row has a valid date and account
            const rowsWithDates = parsed.map((row) => ({
              ...row,
              date: row.date || new Date().toISOString().split("T")[0],
              account: row.account || accounts[0] || "Checking",
              type: "income" as const,
            }));
            setRows(rowsWithDates);
          } else {
            // No stored rows, create initial row
            setRows([
              {
                id: "inc-1",
                date: new Date().toISOString().split("T")[0],
                account: accounts[0] || "Checking",
                category: categories[0] || "Salary",
                payee: "",
                amount: 0,
                type: "income" as const,
              },
            ]);
          }
        } else {
          // No stored data, create initial row
          setRows([
            {
              id: "inc-1",
              date: new Date().toISOString().split("T")[0],
              account: accounts[0] || "Checking",
              category: categories[0] || "Salary",
              payee: "",
              amount: 0,
              type: "income" as const,
            },
          ]);
        }
      } catch (error) {
        console.error("Error loading income from localStorage:", error);
        // Error loading from localStorage, create initial row
        setRows([
          {
            id: "inc-1",
            date: new Date().toISOString().split("T")[0],
            account: accounts[0] || "Checking",
            category: categories[0] || "Salary",
            payee: "",
            amount: 0,
            type: "income" as const,
          },
        ]);
      }
    }
  }, [categories, accounts]);

  // persist rows and notify listeners
  useEffect(() => {
    try {
      localStorage.setItem("bb_tx_income", JSON.stringify(rows));
    } catch {}
    try {
      window.dispatchEvent(new Event("bb:income-updated"));
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

  const totalIncome = useMemo(() => {
    return rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  }, [rows]);

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
  };

  const handleChange = (id: string, patch: Partial<Transaction>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const handleAdd = () => {
    setRows((prev) => [
      ...prev,
      {
        id: `inc-${Date.now()}`,
        date: new Date().toISOString().split("T")[0],
        account: accounts[0] || "Checking",
        category: categories[0] || "Salary",
        payee: "",
        amount: 0,
        type: "income" as const,
      },
    ]);
  };

  const handleRemove = (id: string) => {
    setRows((prev) =>
      prev.length > 1 ? prev.filter((r) => r.id !== id) : prev
    );
  };

  return (
    <Card
      className="p-6 space-y-6 bg-slate-900 text-slate-100"
      style={{
        boxShadow: "0 10px 25px #00bcd4, 0 4px 10px #00bcd4",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2
          className="text-2xl"
          style={{ color: "rgb(0, 188, 212)", fontWeight: 600 }}
        >
          Source Income
        </h2>
        <Button
          variant="outline"
          className="border-teal-500 hover:bg-teal-600 hover:text-purple-100"
          style={{ color: "rgb(0, 188, 212)", fontWeight: 600 }}
          onClick={() => setIsExpanded((v) => !v)}
        >
          {isExpanded ? "Hide" : "Show"} Income
        </Button>
      </div>

      {/* Add new category / account */}
      {(showAddCategory || showAddAccount) && isExpanded && (
        <div className="flex flex-wrap gap-4">
          {showAddCategory && (
            <Card className="flex items-center gap-3 p-4 border border-slate-700">
              <span className="font-semibold">New category:</span>
              <Input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Category name"
                onKeyDown={(e) => {
                  if (e.key === "Enter") addNewCategory();
                  if (e.key === "Escape") setShowAddCategory(false);
                }}
              />
              <Button onClick={addNewCategory}>Add</Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddCategory(false);
                  setPendingRowForCategory(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={
                  !newCategory.trim() ||
                  rows.some((r) => r.category === newCategory.trim()) ||
                  categories.length <= 1
                }
                onClick={() => removeCategory(newCategory.trim())}
              >
                Remove
              </Button>
            </Card>
          )}

          {showAddAccount && (
            <Card className="flex items-center gap-3 p-4 border border-slate-700">
              <span className="font-semibold">New account:</span>
              <Input
                value={newAccount}
                onChange={(e) => setNewAccount(e.target.value)}
                placeholder="Account name"
                onKeyDown={(e) => {
                  if (e.key === "Enter") addNewAccount();
                  if (e.key === "Escape") setShowAddAccount(false);
                }}
              />
              <Button onClick={addNewAccount}>Add</Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddAccount(false);
                  setPendingRowForAccount(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={
                  !newAccount.trim() ||
                  rows.some((r) => r.account === newAccount.trim()) ||
                  accounts.length <= 1
                }
                onClick={() => removeAccount(newAccount.trim())}
              >
                Remove
              </Button>
            </Card>
          )}
        </div>
      )}

      {/* Income Transactions */}
      {isExpanded && (
        <div className="space-y-3">
          {rows.length === 0 ? (
            <div className="py-8 text-center text-slate-400">
              <p>No income sources yet.</p>
              <Button
                className="mt-3 bg-sky-500 hover:bg-sky-600"
                onClick={() => {
                  const newRow = {
                    id: `inc-${Date.now()}`,
                    date: new Date().toISOString().split("T")[0],
                    account: accounts[0] || "Checking",
                    category: categories[0] || "Salary",
                    payee: "",
                    amount: 0,
                    type: "income" as const,
                  };
                  setRows([newRow]);
                }}
              >
                Create First Income Source
              </Button>
            </div>
          ) : (
            rows.map((row) => (
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
                lineBalance={0} // Income doesn't need running balance
                isIncome={true}
              />
            ))
          )}
        </div>
      )}

      {/* Total Income Display */}
      <div className="text-center">
        <div
          className="text-2xl"
          style={{ color: "rgb(0, 188, 212)", fontWeight: 600 }}
        >
          Total Income: $
          {totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </div>
      </div>
    </Card>
  );
};

export default Income;
