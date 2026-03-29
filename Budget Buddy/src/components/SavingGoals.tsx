import { useState, useEffect } from "react";
import DatePicker from "./DatePicker";
import { useDebug } from "../contexts/DebugContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Goal {
  name: string;
  target: number;
  current: number;
  date: string;
  pointsCalculation?: string;
}

const SavingGoals = () => {
  const { isDebugVisible } = useDebug();
  const [goals, setGoals] = useState<Goal[]>([]);

  // Goals section visibility state
  const [isGoalsSectionVisible, setIsGoalsSectionVisible] = useState<boolean>(
    () => {
      try {
        const stored = localStorage.getItem("bb_goals_section_visible");
        return stored ? JSON.parse(stored) : true; // Default to visible
      } catch (error) {
        console.error(
          "Failed to read goals visibility from localStorage",
          error
        );
        return true;
      }
    }
  );

  // Goal creation flow state
  const [showGoalCreationFlow, setShowGoalCreationFlow] = useState(false);
  const [creationStep, setCreationStep] = useState(1);
  const [newGoal, setNewGoal] = useState({
    name: "",
    target: 0,
    current: 0,
    date: "",
    depositFrequency: "monthly", // weekly, biweekly, monthly
    initialDeposit: "",
  });

  // Account balances and transfer state
  const [accountBalances, setAccountBalances] = useState<
    Record<string, number>
  >({});
  const [accounts, setAccounts] = useState<string[]>([]);
  const [transferAmount, setTransferAmount] = useState<string>("");
  const [selectedAccount, setSelectedAccount] = useState<string>("");

  // Save goals section visibility to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        "bb_goals_section_visible",
        JSON.stringify(isGoalsSectionVisible)
      );
    } catch (error) {
      console.error("Failed to save goals visibility to localStorage", error);
    }
  }, [isGoalsSectionVisible]);

  // Load account balances and accounts from localStorage
  useEffect(() => {
    try {
      // Load account balances
      const storedBalances = localStorage.getItem("bb_account_balances");
      if (storedBalances) {
        const parsed = JSON.parse(storedBalances);
        if (parsed && typeof parsed === "object") {
          setAccountBalances(parsed);
        }
      }

      // Load accounts
      const storedAccounts = localStorage.getItem("bb_accounts");
      if (storedAccounts) {
        const parsed = JSON.parse(storedAccounts);
        if (Array.isArray(parsed)) {
          setAccounts(parsed);
          if (parsed.length > 0) {
            setSelectedAccount(parsed[0]);
          }
        }
      }

      // Load saved goals
      const storedGoals = localStorage.getItem("bb_savings_goals");
      if (storedGoals) {
        const parsed = JSON.parse(storedGoals);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Filter out empty goals (goals with no name and zero target)
          const validGoals = parsed.filter(
            (goal: Goal) =>
              goal.name.trim() !== "" || goal.target > 0 || goal.current > 0
          );
          setGoals(validGoals);
        }
      }
    } catch (error) {
      console.error("Error loading account data:", error);
    }
  }, []);

  // Save goals to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem("bb_savings_goals", JSON.stringify(goals));
    } catch (error) {
      console.error("Error saving goals:", error);
    }
  }, [goals]);

  // Listen for account balance updates from other components
  useEffect(() => {
    const onAccountBalancesUpdated = (event: CustomEvent) => {
      console.log(
        "SavingGoals - Received account balance update:",
        event.detail
      );
      setAccountBalances(event.detail);
    };

    window.addEventListener(
      "bb:account-balances-updated",
      onAccountBalancesUpdated as EventListener
    );

    return () => {
      window.removeEventListener(
        "bb:account-balances-updated",
        onAccountBalancesUpdated as EventListener
      );
    };
  }, []);

  // Handlers for inline editing
  const handleChange = (index: number, field: keyof Goal, value: string) => {
    setGoals((goals) =>
      goals.map((goal, i) =>
        i === index
          ? {
              ...goal,
              [field]:
                field === "target" || field === "current"
                  ? Number(value)
                  : value,
            }
          : goal
      )
    );
  };

  // Handle money transfer to savings goal
  const handleTransfer = (goalIndex: number) => {
    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid transfer amount");
      return;
    }

    if (!selectedAccount) {
      alert("Please select an account to transfer from");
      return;
    }

    const currentBalance = accountBalances[selectedAccount] || 0;
    if (amount > currentBalance) {
      alert(
        `Insufficient funds in ${selectedAccount}. Available: $${currentBalance.toFixed(
          2
        )}`
      );
      return;
    }

    // Get the goal name for the goal account
    const goalName = goals[goalIndex].name || `Goal ${goalIndex + 1}`;
    const goalAccountName = `${goalName} Account`;

    // Update the goal's current amount
    setGoals((prevGoals) =>
      prevGoals.map((goal, i) =>
        i === goalIndex ? { ...goal, current: goal.current + amount } : goal
      )
    );

    // Update account balances - decrease from source account, increase goal account
    const newBalances = { ...accountBalances };
    newBalances[selectedAccount] = currentBalance - amount;

    // Create or update the goal account
    if (!newBalances[goalAccountName]) {
      newBalances[goalAccountName] = 0;
    }
    newBalances[goalAccountName] += amount;

    setAccountBalances(newBalances);

    // Save to localStorage
    try {
      localStorage.setItem("bb_account_balances", JSON.stringify(newBalances));
      // Notify other components
      window.dispatchEvent(
        new CustomEvent("bb:account-balances-updated", { detail: newBalances })
      );
    } catch (error) {
      console.error("Error saving account balances:", error);
    }

    // Clear transfer amount
    setTransferAmount("");

    console.log(
      `Transferred $${amount} from ${selectedAccount} to ${goalAccountName}`
    );
    alert(
      `Successfully transferred $${amount} to ${goalAccountName}! This money is now earmarked for your goal and unavailable for spending.`
    );
  };

  // Helper function to check if we have any real goals
  const hasRealGoals = () => {
    return goals.some(
      (goal) => goal.name.trim() !== "" || goal.target > 0 || goal.current > 0
    );
  };

  // Toggle goals section visibility
  const toggleGoalsVisibility = () => {
    setIsGoalsSectionVisible((prev) => !prev);
  };

  const addGoal = (index?: number) => {
    const newGoal = { name: "", target: 0, current: 0, date: "" };
    if (typeof index === "number") {
      setGoals((goals) => [
        ...goals.slice(0, index + 1),
        newGoal,
        ...goals.slice(index + 1),
      ]);
    } else {
      setGoals((goals) => [...goals, newGoal]);
    }
  };

  const createFirstGoal = () => {
    setShowGoalCreationFlow(true);
    setCreationStep(1);
    setNewGoal({
      name: "",
      target: 0,
      current: 0,
      date: "",
      depositFrequency: "monthly",
      initialDeposit: "",
    });
  };

  const completeGoalCreation = () => {
    // Add the goal to the list
    const goalToAdd = {
      name: newGoal.name,
      target: newGoal.target,
      current: 0,
      date: newGoal.date,
    };

    setGoals([goalToAdd]);

    // Process initial deposit if provided
    if (newGoal.initialDeposit && selectedAccount) {
      const depositAmount = parseFloat(newGoal.initialDeposit);
      if (depositAmount > 0) {
        handleInitialDeposit(depositAmount, goalToAdd.name);
      }
    }

    // Reset flow
    setShowGoalCreationFlow(false);
    setCreationStep(1);
  };

  const handleInitialDeposit = (amount: number, goalName: string) => {
    const currentBalance = accountBalances[selectedAccount] || 0;
    if (amount > currentBalance) {
      alert(
        `Insufficient funds in ${selectedAccount}. Available: $${currentBalance.toFixed(
          2
        )}`
      );
      return;
    }

    const goalAccountName = `${goalName} Account`;
    const newBalances = { ...accountBalances };
    newBalances[selectedAccount] = currentBalance - amount;

    if (!newBalances[goalAccountName]) {
      newBalances[goalAccountName] = 0;
    }
    newBalances[goalAccountName] += amount;

    setAccountBalances(newBalances);

    // Update the goal's current amount
    setGoals((prevGoals) =>
      prevGoals.map((goal) =>
        goal.name === goalName
          ? { ...goal, current: goal.current + amount }
          : goal
      )
    );

    try {
      localStorage.setItem("bb_account_balances", JSON.stringify(newBalances));
      window.dispatchEvent(
        new CustomEvent("bb:account-balances-updated", { detail: newBalances })
      );
    } catch (error) {
      console.error("Error saving account balances:", error);
    }
  };

  const removeGoal = (index: number) => {
    setGoals((goals) => goals.filter((_, i) => i !== index));
  };

  const deleteGoal = (index: number, goalName: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete the goal "${goalName}"?\n\nThis will also remove any money earmarked for this goal and return it to your available balance.`
    );

    if (!confirmed) return;

    // Get the goal account name
    const goalAccountName = `${goalName} Account`;
    const goalAccountBalance = accountBalances[goalAccountName] || 0;

    // If there's money in the goal account, we need to return it somewhere
    if (goalAccountBalance > 0) {
      const returnToAccount =
        accounts.length > 0 ? accounts[0] : "Main Account";
      const newBalances = { ...accountBalances };

      // Return the money to the first available account
      if (!newBalances[returnToAccount]) {
        newBalances[returnToAccount] = 0;
      }
      newBalances[returnToAccount] += goalAccountBalance;

      // Remove the goal account
      delete newBalances[goalAccountName];

      setAccountBalances(newBalances);

      try {
        localStorage.setItem(
          "bb_account_balances",
          JSON.stringify(newBalances)
        );
        window.dispatchEvent(
          new CustomEvent("bb:account-balances-updated", {
            detail: newBalances,
          })
        );
      } catch (error) {
        console.error("Error updating account balances:", error);
      }

      alert(
        `Goal deleted! $${goalAccountBalance.toFixed(
          2
        )} has been returned to ${returnToAccount}.`
      );
    }

    // Remove the goal
    removeGoal(index);
  };

  // Check if we should show empty state
  const showEmptyState =
    !hasRealGoals() && goals.length === 0 && !showGoalCreationFlow;

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
          Saving Goals
        </h2>
        <Button
          variant="outline"
          className="border-teal-500 hover:bg-teal-600 hover:text-purple-100"
          style={{ color: "rgb(0, 188, 212)", fontWeight: 600 }}
          onClick={toggleGoalsVisibility}
        >
          {isGoalsSectionVisible ? "Hide" : "Show"} Goals
        </Button>
      </div>

      {/* Goals Section Content - conditionally visible */}
      {isGoalsSectionVisible && (
        <div>
          {/* Empty State */}
          {showEmptyState && (
            <div
              style={{
                textAlign: "center",
                padding: "32px 20px",
                background: "rgba(240, 249, 255, 0.6)",
                borderRadius: "12px",
                border: "1px solid rgba(14, 165, 233, 0.2)",
                marginBottom: "24px",
                backdropFilter: "blur(10px)",
              }}
            >
              <div
                style={{
                  fontSize: "36px",
                  marginBottom: "12px",
                  opacity: "0.8",
                }}
              >
                🎯
              </div>
              <h3
                style={{
                  margin: "0 0 8px 0",
                  fontSize: "1.2rem",
                  color: "#334155",
                  fontWeight: "500",
                }}
              >
                Start Your Savings Journey
              </h3>
              <p
                style={{
                  margin: "0 0 20px 0",
                  color: "white",
                  fontSize: "0.9rem",
                  lineHeight: "1.4",
                  maxWidth: "350px",
                  marginLeft: "auto",
                  marginRight: "auto",
                }}
              >
                Set up your first savings goal to start building towards your
                dreams. Every goal starts with a single step!
              </p>
              <button
                onClick={createFirstGoal}
                style={{
                  background: "#0ea5e9",
                  color: "white",
                  border: "none",
                  padding: "10px 24px",
                  borderRadius: "6px",
                  fontSize: "0.95rem",
                  fontWeight: "500",
                  cursor: "pointer",
                  boxShadow: "0 2px 4px rgba(14, 165, 233, 0.2)",
                  transition: "all 0.2s ease",
                  opacity: "0.9",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = "1";
                  e.currentTarget.style.boxShadow =
                    "0 4px 8px rgba(14, 165, 233, 0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = "0.9";
                  e.currentTarget.style.boxShadow =
                    "0 2px 4px rgba(14, 165, 233, 0.2)";
                }}
              >
                Create Your First Goal
              </button>
            </div>
          )}

          {/* Step-by-Step Goal Creation Flow */}
          {showGoalCreationFlow && (
            <div
              style={{
                background: "white",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                padding: "24px",
                marginBottom: "24px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              }}
            >
              <div style={{ marginBottom: "20px" }}>
                <h3 style={{ margin: "0 0 8px 0", color: "#334155" }}>
                  Create Your Savings Goal
                </h3>
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    marginBottom: "16px",
                    fontSize: "12px",
                  }}
                >
                  {[1, 2, 3, 4, 5].map((step) => (
                    <div
                      key={step}
                      style={{
                        width: "20%",
                        height: "4px",
                        background:
                          step <= creationStep ? "#0ea5e9" : "#e2e8f0",
                        borderRadius: "2px",
                        transition: "background 0.3s",
                      }}
                    />
                  ))}
                </div>
                <p
                  style={{
                    margin: "0",
                    color: "#64748b",
                    fontSize: "14px",
                  }}
                >
                  Step {creationStep} of 5
                </p>
              </div>

              {/* Step 1: Goal Name */}
              {creationStep === 1 && (
                <div>
                  <h4 style={{ margin: "0 0 12px 0", color: "#334155" }}>
                    What's your savings goal?
                  </h4>
                  <input
                    type="text"
                    placeholder="e.g., Emergency Fund, New Car, Vacation"
                    value={newGoal.name}
                    onChange={(e) =>
                      setNewGoal((prev) => ({ ...prev, name: e.target.value }))
                    }
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      border: "2px solid #e2e8f0",
                      borderRadius: "8px",
                      fontSize: "16px",
                      marginBottom: "16px",
                      boxSizing: "border-box",
                      color: "#1f2937",
                      backgroundColor: "white",
                    }}
                  />
                  <div style={{ display: "flex", gap: "12px" }}>
                    <button
                      onClick={() => setShowGoalCreationFlow(false)}
                      style={{
                        padding: "10px 20px",
                        border: "1px solid #d1d5db",
                        background: "white",
                        borderRadius: "6px",
                        cursor: "pointer",
                        color: "#6b7280",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => setCreationStep(2)}
                      disabled={!newGoal.name.trim()}
                      style={{
                        padding: "10px 20px",
                        border: "none",
                        background: newGoal.name.trim() ? "#0ea5e9" : "#9ca3af",
                        color: "white",
                        borderRadius: "6px",
                        cursor: newGoal.name.trim() ? "pointer" : "not-allowed",
                      }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Target Amount */}
              {creationStep === 2 && (
                <div>
                  <h4 style={{ margin: "0 0 12px 0", color: "#334155" }}>
                    How much do you want to save for "{newGoal.name}"?
                  </h4>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      marginBottom: "16px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "24px",
                        marginRight: "8px",
                        color: "#6b7280",
                      }}
                    >
                      $
                    </span>
                    <input
                      type="number"
                      placeholder="1000"
                      value={newGoal.target || ""}
                      onChange={(e) =>
                        setNewGoal((prev) => ({
                          ...prev,
                          target: parseFloat(e.target.value) || 0,
                        }))
                      }
                      style={{
                        flex: 1,
                        padding: "12px 16px",
                        border: "2px solid #e2e8f0",
                        borderRadius: "8px",
                        fontSize: "16px",
                        boxSizing: "border-box",
                        color: "#1f2937",
                        backgroundColor: "white",
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: "12px" }}>
                    <button
                      onClick={() => setCreationStep(1)}
                      style={{
                        padding: "10px 20px",
                        border: "1px solid #d1d5db",
                        background: "white",
                        borderRadius: "6px",
                        cursor: "pointer",
                        color: "#6b7280",
                      }}
                    >
                      Back
                    </button>
                    <button
                      onClick={() => setCreationStep(3)}
                      disabled={!newGoal.target || newGoal.target <= 0}
                      style={{
                        padding: "10px 20px",
                        border: "none",
                        background:
                          newGoal.target && newGoal.target > 0
                            ? "#0ea5e9"
                            : "#9ca3af",
                        color: "white",
                        borderRadius: "6px",
                        cursor:
                          newGoal.target && newGoal.target > 0
                            ? "pointer"
                            : "not-allowed",
                      }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Target Date */}
              {creationStep === 3 && (
                <div>
                  <h4 style={{ margin: "0 0 12px 0", color: "#334155" }}>
                    When do you want to reach your goal?
                  </h4>
                  <DatePicker
                    label=""
                    value={newGoal.date}
                    onChange={(date) =>
                      setNewGoal((prev) => ({ ...prev, date }))
                    }
                  />
                  <div
                    style={{ display: "flex", gap: "12px", marginTop: "16px" }}
                  >
                    <button
                      onClick={() => setCreationStep(2)}
                      style={{
                        padding: "10px 20px",
                        border: "1px solid #d1d5db",
                        background: "white",
                        borderRadius: "6px",
                        cursor: "pointer",
                        color: "#6b7280",
                      }}
                    >
                      Back
                    </button>
                    <button
                      onClick={() => setCreationStep(4)}
                      disabled={!newGoal.date}
                      style={{
                        padding: "10px 20px",
                        border: "none",
                        background: newGoal.date ? "#0ea5e9" : "#9ca3af",
                        color: "white",
                        borderRadius: "6px",
                        cursor: newGoal.date ? "pointer" : "not-allowed",
                      }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              {/* Step 4: Initial Deposit */}
              {creationStep === 4 && (
                <div>
                  <h4 style={{ margin: "0 0 12px 0", color: "#334155" }}>
                    Start with an initial deposit (optional)
                  </h4>
                  <div style={{ marginBottom: "16px" }}>
                    <select
                      value={selectedAccount}
                      onChange={(e) => setSelectedAccount(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "12px 16px",
                        border: "2px solid #e2e8f0",
                        borderRadius: "8px",
                        fontSize: "16px",
                        marginBottom: "12px",
                        boxSizing: "border-box",
                        color: "#1f2937",
                        backgroundColor: "white",
                      }}
                    >
                      <option value="" style={{ color: "#1f2937" }}>
                        Select an account
                      </option>
                      {accounts.map((account) => (
                        <option
                          key={account}
                          value={account}
                          style={{ color: "#1f2937" }}
                        >
                          {account} ($
                          {(accountBalances[account] || 0).toFixed(2)}{" "}
                          available)
                        </option>
                      ))}
                    </select>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <span
                        style={{
                          fontSize: "24px",
                          marginRight: "8px",
                          color: "#6b7280",
                        }}
                      >
                        $
                      </span>
                      <input
                        type="number"
                        placeholder="0"
                        value={newGoal.initialDeposit}
                        onChange={(e) =>
                          setNewGoal((prev) => ({
                            ...prev,
                            initialDeposit: e.target.value,
                          }))
                        }
                        style={{
                          flex: 1,
                          padding: "12px 16px",
                          border: "2px solid #e2e8f0",
                          borderRadius: "8px",
                          fontSize: "16px",
                          boxSizing: "border-box",
                          color: "#1f2937",
                          backgroundColor: "white",
                        }}
                      />
                    </div>
                    {selectedAccount && (
                      <p
                        style={{
                          margin: "8px 0 0 0",
                          fontSize: "14px",
                          color: "#6b7280",
                        }}
                      >
                        Available: $
                        {(accountBalances[selectedAccount] || 0).toFixed(2)}
                      </p>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "12px" }}>
                    <button
                      onClick={() => setCreationStep(3)}
                      style={{
                        padding: "10px 20px",
                        border: "1px solid #d1d5db",
                        background: "white",
                        borderRadius: "6px",
                        cursor: "pointer",
                        color: "#6b7280",
                      }}
                    >
                      Back
                    </button>
                    <button
                      onClick={() => setCreationStep(5)}
                      style={{
                        padding: "10px 20px",
                        border: "none",
                        background: "#0ea5e9",
                        color: "white",
                        borderRadius: "6px",
                        cursor: "pointer",
                      }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              {/* Step 5: Deposit Frequency & Review */}
              {creationStep === 5 && (
                <div>
                  <h4 style={{ margin: "0 0 12px 0", color: "#334155" }}>
                    How often will you make deposits?
                  </h4>
                  <div style={{ marginBottom: "20px" }}>
                    {["weekly", "biweekly", "monthly"].map((frequency) => (
                      <label
                        key={frequency}
                        style={{
                          display: "block",
                          marginBottom: "8px",
                          cursor: "pointer",
                          padding: "8px",
                          border: "1px solid #e2e8f0",
                          borderRadius: "6px",
                          background:
                            newGoal.depositFrequency === frequency
                              ? "#f0f9ff"
                              : "white",
                          color: "#1f2937",
                          fontSize: "14px",
                        }}
                      >
                        <input
                          type="radio"
                          name="frequency"
                          value={frequency}
                          checked={newGoal.depositFrequency === frequency}
                          onChange={(e) =>
                            setNewGoal((prev) => ({
                              ...prev,
                              depositFrequency: e.target.value,
                            }))
                          }
                          style={{ marginRight: "8px" }}
                        />
                        {frequency.charAt(0).toUpperCase() + frequency.slice(1)}
                      </label>
                    ))}
                  </div>

                  <div
                    style={{
                      background: "#f8fafc",
                      padding: "16px",
                      borderRadius: "8px",
                      marginBottom: "16px",
                    }}
                  >
                    <h5 style={{ margin: "0 0 8px 0", color: "#334155" }}>
                      Goal Summary
                    </h5>
                    <p
                      style={{
                        margin: "4px 0",
                        fontSize: "14px",
                        color: "#64748b",
                      }}
                    >
                      <strong>Goal:</strong> {newGoal.name}
                    </p>
                    <p
                      style={{
                        margin: "4px 0",
                        fontSize: "14px",
                        color: "#64748b",
                      }}
                    >
                      <strong>Target:</strong> ${newGoal.target.toFixed(2)}
                    </p>
                    <p
                      style={{
                        margin: "4px 0",
                        fontSize: "14px",
                        color: "#64748b",
                      }}
                    >
                      <strong>Target Date:</strong> {newGoal.date}
                    </p>
                    <p
                      style={{
                        margin: "4px 0",
                        fontSize: "14px",
                        color: "#64748b",
                      }}
                    >
                      <strong>Initial Deposit:</strong> $
                      {newGoal.initialDeposit || "0"}
                    </p>
                    <p
                      style={{
                        margin: "4px 0",
                        fontSize: "14px",
                        color: "#64748b",
                      }}
                    >
                      <strong>Deposit Frequency:</strong>{" "}
                      {newGoal.depositFrequency}
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: "12px" }}>
                    <button
                      onClick={() => setCreationStep(4)}
                      style={{
                        padding: "10px 20px",
                        border: "1px solid #d1d5db",
                        background: "white",
                        borderRadius: "6px",
                        cursor: "pointer",
                        color: "#6b7280",
                      }}
                    >
                      Back
                    </button>
                    <button
                      onClick={completeGoalCreation}
                      style={{
                        padding: "10px 20px",
                        border: "none",
                        background: "#10b981",
                        color: "white",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontWeight: "600",
                      }}
                    >
                      Create Goal
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Main Goals Interface - only show if we have goals or are in edit mode */}
          {!showEmptyState && !showGoalCreationFlow && (
            <>
              {/* Transfer Controls */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  marginBottom: 16,
                  padding: "12px",
                  background: "#f8fafc",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div style={{ fontWeight: 600, color: "#374151" }}>
                  Transfer to Goals:
                </div>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <select
                    value={selectedAccount}
                    onChange={(e) => setSelectedAccount(e.target.value)}
                    style={{
                      padding: "6px 10px",
                      border: "1px solid #d1d5db",
                      borderRadius: "6px",
                      background: "white",
                      minWidth: "120px",
                      color: "#1f2937",
                    }}
                  >
                    {accounts.map((account) => (
                      <option
                        key={account}
                        value={account}
                        style={{ color: "#1f2937" }}
                      >
                        {account} (${(accountBalances[account] || 0).toFixed(2)}
                        )
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    placeholder="Amount"
                    value={transferAmount}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "" || /^\d*\.?\d{0,2}$/.test(val)) {
                        setTransferAmount(val);
                      }
                    }}
                    style={{
                      padding: "6px 10px",
                      border: "1px solid #d1d5db",
                      borderRadius: "6px",
                      width: "100px",
                      background: "white",
                      color: "#1f2937",
                    }}
                  />

                  <span style={{ fontSize: "14px", color: "#6b7280" }}>
                    Available: $
                    {(accountBalances[selectedAccount] || 0).toFixed(2)}
                  </span>

                  <button
                    onClick={() => {
                      if (!transferAmount || !selectedAccount) {
                        alert(
                          "Please select an account and enter an amount to transfer"
                        );
                        return;
                      }
                      const amount = parseFloat(transferAmount);
                      if (isNaN(amount) || amount <= 0) {
                        alert("Please enter a valid transfer amount");
                        return;
                      }
                      if (goals.length === 0) {
                        alert(
                          "Please create a goal first before transferring money"
                        );
                        return;
                      }
                      // Show goal selection if multiple goals exist
                      if (goals.length === 1) {
                        handleTransfer(0);
                      } else {
                        const goalNames = goals
                          .map(
                            (goal, idx) =>
                              `${idx + 1}. ${goal.name || `Goal ${idx + 1}`}`
                          )
                          .join("\n");
                        const selection = prompt(
                          `Which goal would you like to transfer to?\n\n${goalNames}\n\nEnter the goal number (1-${goals.length}):`
                        );
                        if (selection !== null) {
                          const goalIndex = parseInt(selection) - 1;
                          if (
                            !isNaN(goalIndex) &&
                            goalIndex >= 0 &&
                            goalIndex < goals.length
                          ) {
                            handleTransfer(goalIndex);
                          } else {
                            alert("Invalid goal selection");
                          }
                        }
                      }
                    }}
                    disabled={
                      !transferAmount ||
                      !selectedAccount ||
                      parseFloat(transferAmount) <= 0 ||
                      parseFloat(transferAmount) >
                        (accountBalances[selectedAccount] || 0)
                    }
                    style={{
                      padding: "8px 16px",
                      border: "none",
                      borderRadius: "6px",
                      background:
                        !transferAmount ||
                        !selectedAccount ||
                        parseFloat(transferAmount) <= 0 ||
                        parseFloat(transferAmount) >
                          (accountBalances[selectedAccount] || 0)
                          ? "#9ca3af"
                          : "#10b981",
                      color: "white",
                      cursor:
                        !transferAmount ||
                        !selectedAccount ||
                        parseFloat(transferAmount) <= 0 ||
                        parseFloat(transferAmount) >
                          (accountBalances[selectedAccount] || 0)
                          ? "not-allowed"
                          : "pointer",
                      fontWeight: "600",
                      fontSize: "14px",
                      marginLeft: "8px",
                    }}
                  >
                    Transfer Now
                  </button>
                </div>
              </div>

              {/* Goals Summary - only show if there are actual goals */}
              {hasRealGoals() && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    marginBottom: 16,
                    padding: "12px",
                    background: "#ecfdf5",
                    borderRadius: "8px",
                    border: "1px solid #d1fae5",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <div>
                      <strong>Goals</strong>
                    </div>
                    {goals.map((goal, idx) => {
                      const progress =
                        goal.target > 0
                          ? Math.min((goal.current / goal.target) * 100, 100)
                          : 0;
                      return (
                        <div
                          key={`summary-goal-${idx}`}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            padding: "6px 8px",
                            borderRadius: "5px",
                            background: "#ffffff",
                            border: "1px solid #d1fae5",
                          }}
                        >
                          <div style={{ fontWeight: 600, color: "#0c4a6e" }}>
                            {goal.name.trim() ? goal.name : `Goal ${idx + 1}`}
                          </div>
                          <div style={{ fontSize: "0.9rem", color: "#059669" }}>
                            {`$${goal.current.toFixed(2)} / $${goal.target.toFixed(2)} (${progress.toFixed(1)}%)`}
                          </div>
                        </div>
                      );
                    })}
                    <div>
                      <strong>Total Goals Progress:</strong>
                      <span style={{ marginLeft: 8, color: "#059669" }}>
                        $
                        {goals
                          .reduce((sum, goal) => sum + goal.current, 0)
                          .toFixed(2)}{" "}
                        / $
                        {goals
                          .reduce((sum, goal) => sum + goal.target, 0)
                          .toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <strong>Remaining:</strong>
                      <span style={{ marginLeft: 8, color: "#dc2626" }}>
                        $
                        {goals
                          .reduce(
                            (sum, goal) =>
                              sum + Math.max(0, goal.target - goal.current),
                            0
                          )
                          .toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Debug Info */}
              {isDebugVisible && (
                <div
                  style={{
                    marginBottom: 16,
                    padding: "12px",
                    background: "#fef3c7",
                    borderRadius: "8px",
                    border: "1px solid #f59e0b",
                    fontSize: "12px",
                  }}
                >
                  <div>
                    <strong>Debug Info:</strong>
                  </div>
                  <div>Selected Account: {selectedAccount}</div>
                  <div>Account Balances: {JSON.stringify(accountBalances)}</div>
                  <div>Available Accounts: {accounts.join(", ")}</div>
                  <button
                    onClick={() => {
                      console.log(
                        "SavingGoals - Current account balances:",
                        accountBalances
                      );
                      console.log(
                        "SavingGoals - Selected account:",
                        selectedAccount
                      );
                      console.log(
                        "SavingGoals - Available accounts:",
                        accounts
                      );

                      // Test the event system
                      try {
                        const testBalances = { ...accountBalances };
                        testBalances[selectedAccount] =
                          (testBalances[selectedAccount] || 0) + 0.01;
                        console.log(
                          "SavingGoals - Testing event system with:",
                          testBalances
                        );
                        window.dispatchEvent(
                          new CustomEvent("bb:account-balances-updated", {
                            detail: testBalances,
                          })
                        );
                      } catch (error) {
                        console.error(
                          "SavingGoals - Error testing event system:",
                          error
                        );
                      }
                    }}
                    style={{
                      fontSize: "10px",
                      padding: "2px 6px",
                      background: "#f59e0b",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      marginTop: "4px",
                    }}
                  >
                    Test Sync
                  </button>
                </div>
              )}

              {/* Goal Accounts Summary */}
              <div
                style={{
                  marginBottom: 16,
                  padding: "12px",
                  background: "#e0f2fe",
                  borderRadius: "8px",
                  border: "1px solid #0288d1",
                }}
              >
                <h3
                  style={{
                    margin: "0 0 12px 0",
                    color: "#0277bd",
                    fontSize: "1.1rem",
                  }}
                >
                  Goal Accounts (Earmarked Money)
                </h3>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: "8px",
                    maxWidth: "100%",
                  }}
                >
                  {goals.map((goal, idx) => {
                    const goalAccountName = `${
                      goal.name || `Goal ${idx + 1}`
                    } Account`;
                    const goalBalance = accountBalances[goalAccountName] || 0;
                    return (
                      <div
                        key={idx}
                        style={{
                          padding: "8px",
                          background: "white",
                          borderRadius: "6px",
                          border: "1px solid #b3e5fc",
                          fontSize: "11px",
                          wordBreak: "break-word",
                        }}
                      >
                        <div style={{ fontWeight: "600", color: "#0277bd" }}>
                          Goal: {goal.name || `Goal ${idx + 1}`}
                        </div>
                        <div style={{ color: "#01579b", fontSize: "10px" }}>
                          Account: {goalAccountName}
                        </div>
                        <div
                          style={{
                            fontSize: "13px",
                            fontWeight: "600",
                            color: goalBalance > 0 ? "#2e7d32" : "#666",
                            marginTop: "4px",
                          }}
                        >
                          Balance: ${goalBalance.toFixed(2)}
                        </div>
                        <div
                          style={{
                            fontSize: "9px",
                            color: "#666",
                            marginTop: "2px",
                          }}
                        >
                          {goalBalance > 0
                            ? "💰 Money earmarked - unavailable for spending"
                            : "No money earmarked yet"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Labels Row */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr 2fr 2fr 1fr auto",
                  gap: "8px",
                  marginBottom: 4,
                  fontSize: "12px",
                  fontWeight: "600",
                }}
              >
                <div>Name</div>
                <div>Target</div>
                <div>Current</div>
                <div>Goal Date</div>
                <div>Progress</div>
                <div>Transfer</div>
                <div style={{ width: "48px" }}></div>
              </div>
              {goals.map((goal, idx) => {
                const progress =
                  goal.target > 0
                    ? Math.min((goal.current / goal.target) * 100, 100)
                    : 0;
                return (
                  <div
                    key={idx}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "2fr 1fr 1fr 2fr 2fr 1fr auto",
                      gap: "8px",
                      marginBottom: 8,
                      alignItems: "center",
                    }}
                  >
                    <input
                      type="text"
                      placeholder="Name"
                      value={goal.name}
                      onChange={(e) =>
                        handleChange(idx, "name", e.target.value)
                      }
                      style={{
                        padding: "6px 8px",
                        border: "1px solid #d1d5db",
                        borderRadius: "4px",
                        fontSize: "12px",
                        width: "100%",
                        boxSizing: "border-box",
                      }}
                    />
                    <input
                      type="number"
                      placeholder="Target"
                      value={goal.target}
                      onChange={(e) =>
                        handleChange(idx, "target", e.target.value)
                      }
                      style={{
                        padding: "6px 8px",
                        border: "1px solid #d1d5db",
                        borderRadius: "4px",
                        fontSize: "12px",
                        width: "100%",
                        boxSizing: "border-box",
                      }}
                    />
                    <input
                      type="number"
                      placeholder="Current"
                      value={goal.current}
                      onChange={(e) =>
                        handleChange(idx, "current", e.target.value)
                      }
                      style={{
                        padding: "6px 8px",
                        border: "1px solid #d1d5db",
                        borderRadius: "4px",
                        fontSize: "12px",
                        width: "100%",
                        boxSizing: "border-box",
                      }}
                    />

                    <div style={{ width: "100%" }}>
                      <DatePicker
                        label=""
                        value={goal.date}
                        onChange={(date) => handleChange(idx, "date", date)}
                      />
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <div
                        style={{
                          background: "#eee",
                          borderRadius: 8,
                          height: 16,
                          flex: 1,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${progress}%`,
                            height: "100%",
                            background: "green",
                            transition: "width 0.5s",
                          }}
                        />
                      </div>
                      <span style={{ fontSize: "11px", minWidth: "35px" }}>
                        {progress.toFixed(1)}%
                      </span>
                    </div>

                    {/* Transfer Buttons */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                        alignItems: "center",
                      }}
                    >
                      <button
                        onClick={() => handleTransfer(idx)}
                        disabled={
                          !transferAmount ||
                          !selectedAccount ||
                          parseFloat(transferAmount) <= 0 ||
                          parseFloat(transferAmount) >
                            (accountBalances[selectedAccount] || 0)
                        }
                        title={`Transfer $${
                          transferAmount || "0"
                        } from ${selectedAccount} to ${
                          goal.name || `Goal ${idx + 1}`
                        } Account (money will be earmarked and unavailable for spending)`}
                        style={{
                          fontSize: "0.7em",
                          padding: "3px 6px",
                          background:
                            !transferAmount ||
                            !selectedAccount ||
                            parseFloat(transferAmount) <= 0 ||
                            parseFloat(transferAmount) >
                              (accountBalances[selectedAccount] || 0)
                              ? "#9ca3af"
                              : "#10b981",
                          color: "white",
                          border: "none",
                          borderRadius: "3px",
                          cursor:
                            !transferAmount ||
                            !selectedAccount ||
                            parseFloat(transferAmount) <= 0 ||
                            parseFloat(transferAmount) >
                              (accountBalances[selectedAccount] || 0)
                              ? "not-allowed"
                              : "pointer",
                          fontWeight: "600",
                          width: "100%",
                        }}
                      >
                        Transfer
                      </button>

                      {/* Quick Transfer Button */}
                      {goal.target > goal.current && (
                        <button
                          onClick={() => {
                            const remaining = goal.target - goal.current;
                            const available =
                              accountBalances[selectedAccount] || 0;
                            const transferAmount = Math.min(
                              remaining,
                              available
                            );

                            if (transferAmount > 0) {
                              setTransferAmount(transferAmount.toString());
                              setTimeout(() => handleTransfer(idx), 100);
                            }
                          }}
                          disabled={
                            !selectedAccount ||
                            (accountBalances[selectedAccount] || 0) <= 0
                          }
                          title={`Quick transfer remaining $${Math.min(
                            goal.target - goal.current,
                            accountBalances[selectedAccount] || 0
                          ).toFixed(2)} to ${
                            goal.name || `Goal ${idx + 1}`
                          } Account (money will be earmarked)`}
                          style={{
                            fontSize: "0.6em",
                            padding: "2px 4px",
                            background:
                              !selectedAccount ||
                              (accountBalances[selectedAccount] || 0) <= 0
                                ? "#9ca3af"
                                : "#3b82f6",
                            color: "white",
                            border: "none",
                            borderRadius: "3px",
                            cursor:
                              !selectedAccount ||
                              (accountBalances[selectedAccount] || 0) <= 0
                                ? "not-allowed"
                                : "pointer",
                            fontWeight: "600",
                            width: "100%",
                          }}
                        >
                          Quick
                        </button>
                      )}
                    </div>

                    {/* Add/Remove Goal Buttons */}
                    <div
                      style={{
                        display: "flex",
                        gap: "4px",
                        justifyContent: "center",
                      }}
                    >
                      <button
                        onClick={() => addGoal(idx)}
                        title="Add new goal"
                        style={{
                          fontSize: "0.7em",
                          padding: "2px 6px",
                          width: 24,
                          height: 24,
                          background: "#10b981",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                      >
                        +
                      </button>
                      <button
                        onClick={() =>
                          deleteGoal(idx, goal.name || `Goal ${idx + 1}`)
                        }
                        title="Delete this goal permanently"
                        style={{
                          fontSize: "0.7em",
                          padding: "2px 6px",
                          width: 24,
                          height: 24,
                          background: "#dc2626",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                      >
                        🗑️
                      </button>
                      {idx > 0 && (
                        <button
                          onClick={() => removeGoal(idx)}
                          title="Remove goal (old method)"
                          disabled={goals.length === 1}
                          style={{
                            fontSize: "0.7em",
                            padding: "2px 6px",
                            width: 24,
                            height: 24,
                            background:
                              goals.length === 1 ? "#9ca3af" : "#ef4444",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor:
                              goals.length === 1 ? "not-allowed" : "pointer",
                          }}
                        >
                          -
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </Card>
  );
};

export default SavingGoals;
