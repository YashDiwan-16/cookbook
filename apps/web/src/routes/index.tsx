import type { CookingDayPlan, MealKey } from "@cookbook/api/planner";
import { Button } from "@cookbook/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@cookbook/ui/components/card";
import { Input } from "@cookbook/ui/components/input";
import { Label } from "@cookbook/ui/components/label";
import { Textarea } from "@cookbook/ui/components/textarea";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  ChefHat,
  Clock3,
  ListChecks,
  Loader2,
  RefreshCcw,
  ShoppingBasket,
  Sparkles,
  Utensils,
  WalletCards,
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

type CookingSkillLevel = "beginner" | "intermediate" | "advanced";
type EnergyLevel = "low" | "medium" | "high";

type PlannerFormState = {
  servings: number;
  dailyFoodBudget: number;
  currency: string;
  cookingSkillLevel: CookingSkillLevel;
  mealsWanted: MealKey[];
  morningMinutes: number;
  middayMinutes: number;
  eveningMinutes: number;
  pantryItems: string;
  dietaryRestrictions: string;
  allergies: string;
  cuisinePreferences: string;
  appliancesAvailable: string;
  energyLevel: EnergyLevel;
  groceryTripAllowed: boolean;
  leftoversAllowed: boolean;
};

const DEFAULT_FORM: PlannerFormState = {
  servings: 2,
  dailyFoodBudget: 35,
  currency: "USD",
  cookingSkillLevel: "beginner",
  mealsWanted: ["breakfast", "lunch", "dinner"],
  morningMinutes: 20,
  middayMinutes: 25,
  eveningMinutes: 35,
  pantryItems: "oats, rice, eggs, onion, tomato, lentils",
  dietaryRestrictions: "",
  allergies: "",
  cuisinePreferences: "simple, weeknight, Indian-inspired",
  appliancesAvailable: "stove, microwave, skillet, saucepan",
  energyLevel: "medium",
  groceryTripAllowed: true,
  leftoversAllowed: true,
};

const MEAL_OPTIONS: Array<{ value: MealKey; label: string }> = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
];

const WINDOW_LABELS = {
  morning: "Morning",
  midday: "Midday",
  evening: "Evening",
  anytime: "Anytime",
};

function HomeComponent() {
  const [form, setForm] = useState<PlannerFormState>(DEFAULT_FORM);
  const [plan, setPlan] = useState<CookingDayPlan | null>(null);

  const generatePlan = useMutation(
    trpc.generateCookingDayPlan.mutationOptions({
      onSuccess: (data) => {
        setPlan(data);
        toast.success("Daily cooking plan ready");
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const canSubmit = form.mealsWanted.length > 0 && !generatePlan.isPending;

  return (
    <main className="min-h-0 overflow-y-auto bg-background">
      <div className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-4 lg:grid-cols-[420px_1fr]">
        <section className="min-w-0">
          <PlannerForm
            form={form}
            isPending={generatePlan.isPending}
            canSubmit={canSubmit}
            onChange={setForm}
            onReset={() => {
              setForm(DEFAULT_FORM);
              setPlan(null);
            }}
            onSubmit={() => {
              generatePlan.mutate(toPlannerInput(form));
            }}
          />
        </section>
        <section className="min-w-0">
          <PlannerResult plan={plan} isPending={generatePlan.isPending} />
        </section>
      </div>
    </main>
  );
}

function PlannerForm({
  form,
  isPending,
  canSubmit,
  onChange,
  onReset,
  onSubmit,
}: {
  form: PlannerFormState;
  isPending: boolean;
  canSubmit: boolean;
  onChange: (next: PlannerFormState) => void;
  onReset: () => void;
  onSubmit: () => void;
}) {
  return (
    <Card className="sticky top-4">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-sky-500" />
              Practical Day Plan
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              An AI meal planner that thinks like a practical home cook, not a recipe blog.
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onReset}>
            <RefreshCcw />
            <span className="sr-only">Reset form</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <div className="grid grid-cols-3 gap-3">
            <NumberField
              label="Servings"
              value={form.servings}
              min={1}
              onChange={(servings) => onChange({ ...form, servings })}
            />
            <NumberField
              label="Budget"
              value={form.dailyFoodBudget}
              min={0}
              onChange={(dailyFoodBudget) => onChange({ ...form, dailyFoodBudget })}
            />
            <SelectField
              label="Currency"
              value={form.currency}
              options={["USD", "INR", "EUR", "GBP", "CAD", "AUD"]}
              onChange={(currency) => onChange({ ...form, currency })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Skill"
              value={form.cookingSkillLevel}
              options={["beginner", "intermediate", "advanced"]}
              onChange={(cookingSkillLevel) =>
                onChange({ ...form, cookingSkillLevel: cookingSkillLevel as CookingSkillLevel })
              }
            />
            <SelectField
              label="Energy"
              value={form.energyLevel}
              options={["low", "medium", "high"]}
              onChange={(energyLevel) => onChange({ ...form, energyLevel: energyLevel as EnergyLevel })}
            />
          </div>

          <div className="grid gap-2">
            <Label>Meals wanted</Label>
            <div className="grid grid-cols-3 gap-2">
              {MEAL_OPTIONS.map((meal) => (
                <CheckPill
                  key={meal.value}
                  label={meal.label}
                  checked={form.mealsWanted.includes(meal.value)}
                  onChange={() => onChange({ ...form, mealsWanted: toggleMeal(form.mealsWanted, meal.value) })}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <NumberField
              label="Morning"
              value={form.morningMinutes}
              min={0}
              onChange={(morningMinutes) => onChange({ ...form, morningMinutes })}
            />
            <NumberField
              label="Midday"
              value={form.middayMinutes}
              min={0}
              onChange={(middayMinutes) => onChange({ ...form, middayMinutes })}
            />
            <NumberField
              label="Evening"
              value={form.eveningMinutes}
              min={0}
              onChange={(eveningMinutes) => onChange({ ...form, eveningMinutes })}
            />
          </div>

          <TextAreaField
            label="Pantry items"
            value={form.pantryItems}
            onChange={(pantryItems) => onChange({ ...form, pantryItems })}
          />
          <TextAreaField
            label="Dietary restrictions"
            value={form.dietaryRestrictions}
            onChange={(dietaryRestrictions) => onChange({ ...form, dietaryRestrictions })}
          />
          <TextAreaField
            label="Allergies"
            value={form.allergies}
            onChange={(allergies) => onChange({ ...form, allergies })}
          />
          <TextAreaField
            label="Cuisine preferences"
            value={form.cuisinePreferences}
            onChange={(cuisinePreferences) => onChange({ ...form, cuisinePreferences })}
          />
          <TextAreaField
            label="Appliances"
            value={form.appliancesAvailable}
            onChange={(appliancesAvailable) => onChange({ ...form, appliancesAvailable })}
          />

          <div className="grid grid-cols-2 gap-2">
            <CheckPill
              label="Grocery trip"
              checked={form.groceryTripAllowed}
              onChange={() => onChange({ ...form, groceryTripAllowed: !form.groceryTripAllowed })}
            />
            <CheckPill
              label="Leftovers"
              checked={form.leftoversAllowed}
              onChange={() => onChange({ ...form, leftoversAllowed: !form.leftoversAllowed })}
            />
          </div>

          <Button type="submit" disabled={!canSubmit} className="w-full">
            {isPending ? <Loader2 className="animate-spin" /> : <ChefHat />}
            {isPending ? "Generating..." : "Generate Plan"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PlannerResult({ plan, isPending }: { plan: CookingDayPlan | null; isPending: boolean }) {
  if (isPending) {
    return (
      <Card className="min-h-[520px] justify-center">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <Loader2 className="size-8 animate-spin text-emerald-500" />
          <div>
            <h2 className="text-lg font-medium">Building your cooking checklist</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Matching meals to your time windows, pantry, budget, and energy.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!plan) {
    return (
      <Card className="min-h-[520px] justify-center">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <Utensils className="size-8 text-emerald-500" />
          <div>
            <h2 className="text-lg font-medium">Your execution plan appears here</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              The output focuses on what to cook, when to prep, what to buy, and how to stay near budget.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      <SummaryStrip plan={plan} />
      <ExecutionChecklist plan={plan} />
      <MealGrid plan={plan} />
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <GroceryList plan={plan} />
        <BudgetPanel plan={plan} />
      </div>
    </div>
  );
}

function SummaryStrip({ plan }: { plan: CookingDayPlan }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <MetricCard
        icon={<WalletCards className="size-4 text-emerald-500" />}
        label="Estimated groceries"
        value={`${plan.summary.totalEstimatedCost.toFixed(2)} ${plan.summary.currency}`}
        detail={`${plan.summary.budget.toFixed(2)} ${plan.summary.currency} budget`}
      />
      <MetricCard
        icon={<Clock3 className="size-4 text-sky-500" />}
        label="Cooking time"
        value={`${plan.summary.totalCookingMinutes} min`}
        detail={plan.summary.isBudgetFeasible ? "Budget feasible" : "Needs budget edits"}
      />
      <MetricCard
        icon={<ListChecks className="size-4 text-amber-500" />}
        label="Checklist"
        value={`${plan.cookingTodos.length} tasks`}
        detail="Ordered by your day"
      />
    </div>
  );
}

function ExecutionChecklist({ plan }: { plan: CookingDayPlan }) {
  const todosByWindow = useMemo(() => {
    return plan.cookingTodos.reduce<Record<string, CookingDayPlan["cookingTodos"]>>((groups, todo) => {
      return { ...groups, [todo.startWindow]: [...(groups[todo.startWindow] ?? []), todo] };
    }, {});
  }, [plan.cookingTodos]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListChecks className="size-4 text-emerald-500" />
          Cooking Execution Checklist
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {Object.entries(WINDOW_LABELS).map(([window, label]) => {
          const todos = todosByWindow[window] ?? [];
          if (todos.length === 0) return null;

          return (
            <div key={window} className="grid gap-2">
              <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                <Clock3 className="size-3.5" />
                {label}
              </div>
              <div className="grid gap-2">
                {todos.map((todo) => (
                  <div key={todo.id} className="grid gap-1 border-l-2 border-emerald-500/70 pl-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-medium">{todo.title}</h3>
                      <span className="border px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        {todo.durationMinutes} min
                      </span>
                      <span className="border px-1.5 py-0.5 text-[11px] capitalize text-muted-foreground">
                        {todo.meal}
                      </span>
                    </div>
                    {todo.dependsOn.length > 0 ? (
                      <p className="text-xs text-muted-foreground">Depends on: {todo.dependsOn.join(", ")}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function MealGrid({ plan }: { plan: CookingDayPlan }) {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {MEAL_OPTIONS.map(({ value, label }) => {
        const meal = plan.meals[value];
        if (!meal) return null;

        return (
          <Card key={value}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Utensils className="size-4 text-sky-500" />
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div>
                <h3 className="text-base font-medium">{meal.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{meal.reason}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="border px-2 py-1">{meal.servings} servings</span>
                <span className="border px-2 py-1">{meal.prepMinutes} min prep</span>
                <span className="border px-2 py-1">{meal.cookMinutes} min cook</span>
              </div>
              <div>
                <h4 className="mb-1 text-xs font-medium uppercase text-muted-foreground">Ingredients</h4>
                <ul className="grid gap-1 text-xs">
                  {meal.ingredients.map((ingredient) => (
                    <li key={`${meal.name}-${ingredient.name}`} className="flex justify-between gap-2">
                      <span>{ingredient.name}</span>
                      <span className="text-muted-foreground">
                        {ingredient.quantity} {ingredient.unit}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="mb-1 text-xs font-medium uppercase text-muted-foreground">Steps</h4>
                <ol className="grid list-decimal gap-1 pl-4 text-xs">
                  {meal.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
              <p className="border-t pt-3 text-xs text-muted-foreground">{meal.nutritionIntent}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function GroceryList({ plan }: { plan: CookingDayPlan }) {
  const grouped = useMemo(() => {
    return plan.groceryList.reduce<Record<string, CookingDayPlan["groceryList"]>>((groups, item) => {
      return { ...groups, [item.category]: [...(groups[item.category] ?? []), item] };
    }, {});
  }, [plan.groceryList]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingBasket className="size-4 text-amber-500" />
          Grocery List
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category} className="grid gap-2">
            <h3 className="text-xs font-medium uppercase text-muted-foreground">{category}</h3>
            <div className="grid gap-2">
              {items.map((item) => (
                <div key={item.name} className="flex items-start justify-between gap-3 border-b pb-2 text-sm">
                  <div>
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.quantity} {item.unit} for {item.requiredFor.join(", ")}
                      {item.alreadyOwned ? " - already owned" : ""}
                    </div>
                  </div>
                  <div className="text-right text-xs font-medium">
                    {item.alreadyOwned
                      ? "Pantry"
                      : `${item.estimatedCost.toFixed(2)} ${plan.summary.currency}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function BudgetPanel({ plan }: { plan: CookingDayPlan }) {
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <WalletCards className="size-4 text-emerald-500" />
            Budget Feasibility
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div
            className={`border px-3 py-2 text-sm font-medium ${
              plan.summary.isBudgetFeasible
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
            }`}
          >
            {plan.summary.isBudgetFeasible ? "Feasible" : "Over budget"}
          </div>
          <p className="text-sm text-muted-foreground">{plan.summary.feasibilityReason}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Substitutions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {plan.substitutions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No substitutions needed.</p>
          ) : (
            plan.substitutions.map((substitution) => (
              <div key={`${substitution.original}-${substitution.substitute}`} className="border-b pb-2">
                <div className="text-sm font-medium">
                  {substitution.original} to {substitution.substitute}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{substitution.reason}</p>
                <p className="mt-1 text-xs capitalize text-muted-foreground">
                  Cost: {substitution.costImpact}; Diet: {substitution.dietaryImpact}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Budget-Saving Moves</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {plan.budgetAdjustments.length === 0 ? (
            <p className="text-sm text-muted-foreground">The plan is already lean.</p>
          ) : (
            plan.budgetAdjustments.map((adjustment) => (
              <div key={adjustment.title} className="border-b pb-2">
                <div className="flex justify-between gap-2 text-sm font-medium">
                  <span>{adjustment.title}</span>
                  <span>{adjustment.estimatedSavings.toFixed(2)}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{adjustment.description}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <div className="flex size-9 items-center justify-center border bg-muted">{icon}</div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-base font-semibold">{value}</div>
          <div className="truncate text-xs text-muted-foreground">{detail}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function NumberField({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <Input
        type="number"
        min={min}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <select
        className="h-8 w-full border border-input bg-background px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 dark:bg-input/30"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <Textarea value={value} rows={2} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function CheckPill({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className={`flex h-8 cursor-pointer items-center justify-center border px-2 text-xs font-medium transition-colors ${
        checked ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : ""
      }`}
    >
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
      {label}
    </label>
  );
}

function toPlannerInput(form: PlannerFormState) {
  return {
    servings: clampInteger(form.servings, 1),
    dailyFoodBudget: Math.max(0, Number(form.dailyFoodBudget) || 0),
    currency: form.currency,
    cookingSkillLevel: form.cookingSkillLevel,
    mealsWanted: form.mealsWanted,
    cookingWindows: {
      morningMinutes: clampInteger(form.morningMinutes, 0),
      middayMinutes: clampInteger(form.middayMinutes, 0),
      eveningMinutes: clampInteger(form.eveningMinutes, 0),
    },
    pantryItems: parseList(form.pantryItems),
    dietaryRestrictions: parseList(form.dietaryRestrictions),
    allergies: parseList(form.allergies),
    cuisinePreferences: parseList(form.cuisinePreferences),
    appliancesAvailable: parseList(form.appliancesAvailable),
    energyLevel: form.energyLevel,
    groceryTripAllowed: form.groceryTripAllowed,
    leftoversAllowed: form.leftoversAllowed,
  };
}

function parseList(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toggleMeal(meals: MealKey[], meal: MealKey) {
  if (meals.includes(meal)) {
    return meals.filter((item) => item !== meal);
  }
  return [...meals, meal];
}

function clampInteger(value: number, min: number) {
  return Math.max(min, Math.round(Number(value) || min));
}
