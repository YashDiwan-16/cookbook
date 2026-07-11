import { google } from "@ai-sdk/google";
import { env } from "@cookbook/env/server";
import { TRPCError } from "@trpc/server";
import { generateText, Output } from "ai";
import { z } from "zod";

const mealSchema = z.enum(["breakfast", "lunch", "dinner"]);
const todoMealSchema = z.enum(["breakfast", "lunch", "dinner", "shared"]);
const windowSchema = z.enum(["morning", "midday", "evening", "anytime"]);
const prioritySchema = z.enum(["must-do", "nice-to-do"]);

export const plannerInputSchema = z.object({
  servings: z.number().int().min(1).max(12),
  dailyFoodBudget: z.number().min(0).max(10000),
  currency: z.string().min(1).max(8),
  cookingSkillLevel: z.enum(["beginner", "intermediate", "advanced"]),
  mealsWanted: z.array(mealSchema).min(1),
  cookingWindows: z.object({
    morningMinutes: z.number().int().min(0).max(360),
    middayMinutes: z.number().int().min(0).max(360),
    eveningMinutes: z.number().int().min(0).max(360),
  }),
  pantryItems: z.array(z.string().min(1)).max(80),
  dietaryRestrictions: z.array(z.string().min(1)).max(30),
  allergies: z.array(z.string().min(1)).max(30),
  cuisinePreferences: z.array(z.string().min(1)).max(30),
  appliancesAvailable: z.array(z.string().min(1)).max(30),
  energyLevel: z.enum(["low", "medium", "high"]),
  groceryTripAllowed: z.boolean(),
  leftoversAllowed: z.boolean(),
});

const ingredientSchema = z.object({
  name: z.string(),
  quantity: z.string(),
  unit: z.string(),
  pantryItem: z.boolean(),
  estimatedCost: z.number().nullable(),
});

const mealPlanSchema = z.object({
  name: z.string(),
  reason: z.string(),
  servings: z.number().int(),
  prepMinutes: z.number().int().min(0),
  cookMinutes: z.number().int().min(0),
  ingredients: z.array(ingredientSchema),
  steps: z.array(z.string()),
  nutritionIntent: z.string(),
});

const groceryItemSchema = z.object({
  name: z.string(),
  quantity: z.string(),
  unit: z.string(),
  category: z.string(),
  estimatedCost: z.number(),
  requiredFor: z.array(mealSchema),
  alreadyOwned: z.boolean(),
});

const cookingTodoSchema = z.object({
  id: z.string(),
  title: z.string(),
  meal: todoMealSchema,
  startWindow: windowSchema,
  durationMinutes: z.number().int().min(1),
  dependsOn: z.array(z.string()),
  priority: prioritySchema,
});

const substitutionSchema = z.object({
  original: z.string(),
  substitute: z.string(),
  reason: z.string(),
  costImpact: z.enum(["cheaper", "same", "more-expensive"]),
  dietaryImpact: z.string(),
});

const budgetAdjustmentSchema = z.object({
  title: z.string(),
  description: z.string(),
  estimatedSavings: z.number(),
});

export const cookingDayPlanSchema = z.object({
  summary: z.object({
    totalEstimatedCost: z.number(),
    budget: z.number(),
    currency: z.string(),
    isBudgetFeasible: z.boolean(),
    feasibilityReason: z.string(),
    totalCookingMinutes: z.number().int().min(0),
  }),
  meals: z.object({
    breakfast: mealPlanSchema.nullable(),
    lunch: mealPlanSchema.nullable(),
    dinner: mealPlanSchema.nullable(),
  }),
  groceryList: z.array(groceryItemSchema),
  cookingTodos: z.array(cookingTodoSchema),
  substitutions: z.array(substitutionSchema),
  budgetAdjustments: z.array(budgetAdjustmentSchema),
});

export type PlannerInput = z.infer<typeof plannerInputSchema>;
export type CookingDayPlan = z.infer<typeof cookingDayPlanSchema>;
export type MealKey = z.infer<typeof mealSchema>;

const GATEWAY_GEMINI_MODEL = "google/gemini-2.5-flash";
const DIRECT_GEMINI_MODEL = "gemini-2.5-flash";
const BUDGET_TOLERANCE = 1.1;
const UNKNOWN_ITEM_ESTIMATE = 3.25;

const WINDOW_ORDER: Record<z.infer<typeof windowSchema>, number> = {
  morning: 0,
  midday: 1,
  evening: 2,
  anytime: 3,
};

const PRICE_MAP: Record<string, { cost: number; category: string }> = {
  rice: { cost: 2.2, category: "Grains" },
  oats: { cost: 2.4, category: "Grains" },
  pasta: { cost: 2.1, category: "Grains" },
  bread: { cost: 2.6, category: "Bakery" },
  tortilla: { cost: 2.8, category: "Bakery" },
  flour: { cost: 2.5, category: "Baking" },
  lentils: { cost: 2.3, category: "Pantry" },
  beans: { cost: 1.6, category: "Pantry" },
  chickpeas: { cost: 1.8, category: "Pantry" },
  tofu: { cost: 3.0, category: "Protein" },
  eggs: { cost: 3.2, category: "Dairy & Eggs" },
  milk: { cost: 2.7, category: "Dairy & Eggs" },
  yogurt: { cost: 3.3, category: "Dairy & Eggs" },
  cheese: { cost: 4.2, category: "Dairy & Eggs" },
  chicken: { cost: 6.8, category: "Protein" },
  beef: { cost: 8.5, category: "Protein" },
  fish: { cost: 7.8, category: "Protein" },
  salmon: { cost: 9.5, category: "Protein" },
  tuna: { cost: 2.4, category: "Protein" },
  onion: { cost: 1.0, category: "Produce" },
  tomato: { cost: 2.0, category: "Produce" },
  potato: { cost: 1.8, category: "Produce" },
  carrot: { cost: 1.4, category: "Produce" },
  spinach: { cost: 2.8, category: "Produce" },
  lettuce: { cost: 2.2, category: "Produce" },
  broccoli: { cost: 2.6, category: "Produce" },
  pepper: { cost: 2.4, category: "Produce" },
  mushroom: { cost: 3.2, category: "Produce" },
  avocado: { cost: 3.0, category: "Produce" },
  banana: { cost: 1.2, category: "Produce" },
  apple: { cost: 2.0, category: "Produce" },
  berries: { cost: 4.5, category: "Produce" },
  lemon: { cost: 1.0, category: "Produce" },
  garlic: { cost: 0.9, category: "Produce" },
  ginger: { cost: 1.0, category: "Produce" },
  "olive oil": { cost: 5.5, category: "Pantry" },
  oil: { cost: 3.8, category: "Pantry" },
  butter: { cost: 3.7, category: "Dairy & Eggs" },
  "soy sauce": { cost: 2.8, category: "Pantry" },
  salsa: { cost: 2.9, category: "Pantry" },
  spices: { cost: 2.5, category: "Pantry" },
  herbs: { cost: 2.0, category: "Produce" },
};

const CHEAPER_SUBSTITUTIONS: Array<{
  match: string;
  substitute: string;
  reason: string;
  savings: number;
}> = [
  {
    match: "salmon",
    substitute: "canned tuna or lentils",
    reason: "Keeps protein in the meal while avoiding a premium fish purchase.",
    savings: 4.5,
  },
  {
    match: "beef",
    substitute: "beans, lentils, or eggs",
    reason: "A lower-cost protein that still works in bowls, tacos, and skillet meals.",
    savings: 4,
  },
  {
    match: "chicken breast",
    substitute: "chicken thighs",
    reason: "Usually cheaper and forgiving for weeknight cooking.",
    savings: 2,
  },
  {
    match: "quinoa",
    substitute: "rice",
    reason: "Rice is broadly available and cheaper per serving.",
    savings: 2.5,
  },
  {
    match: "berries",
    substitute: "banana or apple",
    reason: "Fresh berries are often one of the highest-cost breakfast add-ins.",
    savings: 2,
  },
  {
    match: "avocado",
    substitute: "yogurt sauce or beans",
    reason: "Keeps creaminess or substance while reducing produce spend.",
    savings: 1.5,
  },
  {
    match: "cheese",
    substitute: "smaller cheese portion plus yogurt or beans",
    reason: "Preserves richness without making dairy the main cost driver.",
    savings: 1.5,
  },
];

export async function generateCookingDayPlan(input: PlannerInput) {
  const model = selectGeminiModel();
  const prompt = buildPlannerPrompt(input);

  const { output } = await generateText({
    model,
    output: Output.object({
      schema: cookingDayPlanSchema,
      name: "CookingDayPlan",
      description: "A practical one-day meal execution plan for a home cook.",
    }),
    system:
      "You are a practical daily cooking planner. You think like a capable home cook, not a recipe blog. Return only data matching the schema.",
    prompt,
    temperature: 0.4,
    maxRetries: 1,
  });

  return applyBudgetLogic(output, input);
}

function selectGeminiModel() {
  if (env.AI_GATEWAY_API_KEY || env.VERCEL_OIDC_TOKEN) {
    return GATEWAY_GEMINI_MODEL;
  }

  if (env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return google(DIRECT_GEMINI_MODEL);
  }

  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message:
      "AI generation needs AI_GATEWAY_API_KEY, VERCEL_OIDC_TOKEN, or GOOGLE_GENERATIVE_AI_API_KEY on the server.",
  });
}

function buildPlannerPrompt(input: PlannerInput) {
  return `
Create a realistic one-day cooking execution plan.

Planning facts:
- Servings: ${input.servings}
- Budget: ${input.dailyFoodBudget} ${input.currency}
- Skill level: ${input.cookingSkillLevel}
- Meals wanted: ${input.mealsWanted.join(", ")}
- Cooking windows: morning ${input.cookingWindows.morningMinutes} min, midday ${input.cookingWindows.middayMinutes} min, evening ${input.cookingWindows.eveningMinutes} min
- Pantry items: ${formatList(input.pantryItems)}
- Dietary restrictions: ${formatList(input.dietaryRestrictions)}
- Allergies: ${formatList(input.allergies)}
- Cuisine preferences: ${formatList(input.cuisinePreferences)}
- Appliances: ${formatList(input.appliancesAvailable)}
- Energy level: ${input.energyLevel}
- Grocery trip allowed: ${input.groceryTripAllowed ? "yes" : "no"}
- Leftovers allowed: ${input.leftoversAllowed ? "yes" : "no"}

Rules:
- Generate meals only for the requested meal slots. Use null for unrequested meals.
- Prefer common, affordable ingredients.
- Respect allergies and dietary restrictions strictly.
- Prefer pantry items before suggesting groceries.
- If grocery shopping is not allowed, rely on pantry items and simple substitutions.
- Respect available cooking windows, appliance constraints, skill level, and energy level.
- The main value is the timed cooking checklist: include prep reuse, batching, and leftovers where allowed.
- Keep steps concise and executable.
- Include substitutions and budget-saving ideas.
- Do not invent exact grocery prices. Put 0 for estimatedCost fields; code will calculate them.
- Summary cost and budget feasibility may be rough placeholders; code will overwrite them.
`;
}

function applyBudgetLogic(plan: CookingDayPlan, input: PlannerInput): CookingDayPlan {
  const pantrySet = new Set(input.pantryItems.map(normalize));
  const groceryMap = new Map<string, CookingDayPlan["groceryList"][number]>();

  for (const grocery of plan.groceryList) {
    const key = normalize(grocery.name);
    const alreadyOwned = grocery.alreadyOwned || pantrySet.has(key);
    groceryMap.set(key, {
      ...grocery,
      alreadyOwned,
      estimatedCost: alreadyOwned ? 0 : estimateItemCost(grocery.name, grocery.quantity, grocery.unit),
      category: grocery.category || findPriceEntry(grocery.name)?.category || "Other",
    });
  }

  for (const meal of input.mealsWanted) {
    const mealPlan = plan.meals[meal];
    if (!mealPlan) continue;

    for (const ingredient of mealPlan.ingredients) {
      const key = normalize(ingredient.name);
      const alreadyOwned = ingredient.pantryItem || pantrySet.has(key);
      ingredient.pantryItem = alreadyOwned;
      ingredient.estimatedCost = alreadyOwned
        ? 0
        : estimateItemCost(ingredient.name, ingredient.quantity, ingredient.unit);

      if (!alreadyOwned && !groceryMap.has(key)) {
        const priceEntry = findPriceEntry(ingredient.name);
        groceryMap.set(key, {
          name: ingredient.name,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
          category: priceEntry?.category ?? "Other",
          estimatedCost: ingredient.estimatedCost,
          requiredFor: [meal],
          alreadyOwned: false,
        });
      } else if (!alreadyOwned) {
        const existing = groceryMap.get(key);
        if (existing && !existing.requiredFor.includes(meal)) {
          existing.requiredFor = [...existing.requiredFor, meal];
        }
      }
    }
  }

  const groceryList = [...groceryMap.values()]
    .map((item) => ({
      ...item,
      estimatedCost: roundMoney(item.estimatedCost),
    }))
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

  const totalEstimatedCost = roundMoney(
    groceryList.reduce((total, item) => total + (item.alreadyOwned ? 0 : item.estimatedCost), 0),
  );
  const budgetLimit = input.dailyFoodBudget * BUDGET_TOLERANCE;
  const isBudgetFeasible = totalEstimatedCost <= budgetLimit;
  const highCostItems = groceryList
    .filter((item) => !item.alreadyOwned)
    .sort((a, b) => b.estimatedCost - a.estimatedCost)
    .slice(0, 3);
  const deterministicSubstitutions = buildSubstitutions(highCostItems, plan.substitutions);
  const deterministicAdjustments = buildBudgetAdjustments(
    highCostItems,
    deterministicSubstitutions,
    plan.budgetAdjustments,
    isBudgetFeasible,
  );

  return {
    ...plan,
    summary: {
      ...plan.summary,
      totalEstimatedCost,
      budget: input.dailyFoodBudget,
      currency: input.currency,
      isBudgetFeasible,
      feasibilityReason: buildFeasibilityReason(
        totalEstimatedCost,
        input.dailyFoodBudget,
        input.currency,
        isBudgetFeasible,
        highCostItems,
      ),
      totalCookingMinutes: getTotalCookingMinutes(plan),
    },
    groceryList,
    cookingTodos: [...plan.cookingTodos].sort(
      (a, b) =>
        WINDOW_ORDER[a.startWindow] - WINDOW_ORDER[b.startWindow] ||
        priorityRank(a.priority) - priorityRank(b.priority),
    ),
    substitutions: deterministicSubstitutions,
    budgetAdjustments: deterministicAdjustments,
  };
}

function estimateItemCost(name: string, quantity: string, unit: string) {
  const entry = findPriceEntry(name);
  const baseCost = entry?.cost ?? UNKNOWN_ITEM_ESTIMATE;
  const factor = quantityFactor(quantity, unit);
  return roundMoney(baseCost * factor);
}

function findPriceEntry(name: string) {
  const normalizedName = normalize(name);
  return Object.entries(PRICE_MAP).find(([key]) => normalizedName.includes(key))?.[1];
}

function quantityFactor(quantity: string, unit: string) {
  const parsed = parseQuantity(quantity);
  const normalizedUnit = normalize(unit);

  if (parsed <= 0) return 1;
  if (["tsp", "teaspoon", "tbsp", "tablespoon", "pinch"].some((item) => normalizedUnit.includes(item))) {
    return 0.2;
  }
  if (["g", "gram", "ml"].some((item) => normalizedUnit === item || normalizedUnit === `${item}s`)) {
    return Math.min(Math.max(parsed / 500, 0.25), 2);
  }
  if (["kg", "kilogram", "lb", "pound"].some((item) => normalizedUnit.includes(item))) {
    return Math.min(Math.max(parsed, 0.75), 3);
  }
  if (["cup", "can", "bunch", "pack", "piece", "whole"].some((item) => normalizedUnit.includes(item))) {
    return Math.min(Math.max(parsed * 0.75, 0.5), 3);
  }
  return Math.min(Math.max(parsed, 0.75), 2.5);
}

function parseQuantity(quantity: string) {
  const trimmed = quantity.trim();
  const fraction = trimmed.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
  if (fraction?.[1] && fraction[2]) {
    return Number(fraction[1]) / Number(fraction[2]);
  }

  const mixed = trimmed.match(/(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
  if (mixed?.[1] && mixed[2] && mixed[3]) {
    return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  }

  const decimal = trimmed.match(/\d+(?:\.\d+)?/);
  return decimal ? Number(decimal[0]) : 1;
}

function buildSubstitutions(
  highCostItems: CookingDayPlan["groceryList"],
  modelSubstitutions: CookingDayPlan["substitutions"],
) {
  const substitutions = [...modelSubstitutions];

  for (const item of highCostItems) {
    const match = CHEAPER_SUBSTITUTIONS.find((candidate) => normalize(item.name).includes(candidate.match));
    if (!match) continue;
    if (substitutions.some((substitution) => normalize(substitution.original) === normalize(item.name))) {
      continue;
    }

    substitutions.push({
      original: item.name,
      substitute: match.substitute,
      reason: match.reason,
      costImpact: "cheaper",
      dietaryImpact: "Check against your stated restrictions before swapping.",
    });
  }

  return substitutions.slice(0, 8);
}

function buildBudgetAdjustments(
  highCostItems: CookingDayPlan["groceryList"],
  substitutions: CookingDayPlan["substitutions"],
  modelAdjustments: CookingDayPlan["budgetAdjustments"],
  isBudgetFeasible: boolean,
) {
  const adjustments = [...modelAdjustments];

  if (!isBudgetFeasible && highCostItems.length > 0) {
    const names = highCostItems.map((item) => item.name).join(", ");
    adjustments.unshift({
      title: "Trim the highest-cost items",
      description: `Start with ${names}. These drive the estimate more than staple pantry ingredients.`,
      estimatedSavings: roundMoney(
        highCostItems.reduce((total, item) => total + item.estimatedCost * 0.35, 0),
      ),
    });
  }

  const cheaperCount = substitutions.filter((item) => item.costImpact === "cheaper").length;
  if (cheaperCount > 0) {
    adjustments.push({
      title: "Use the cheaper swaps",
      description: "Apply the listed substitutions before changing the whole plan.",
      estimatedSavings: roundMoney(cheaperCount * 1.75),
    });
  }

  return adjustments
    .filter((adjustment, index, list) => list.findIndex((item) => item.title === adjustment.title) === index)
    .slice(0, 6);
}

function buildFeasibilityReason(
  total: number,
  budget: number,
  currency: string,
  feasible: boolean,
  highCostItems: CookingDayPlan["groceryList"],
) {
  if (feasible) {
    return `Estimated groceries are ${formatMoney(total, currency)}, within the ${formatMoney(
      budget,
      currency,
    )} budget with a 10% planning tolerance.`;
  }

  const expensiveItems = highCostItems.map((item) => item.name).join(", ");
  return `Estimated groceries are ${formatMoney(total, currency)}, above the ${formatMoney(
    budget,
    currency,
  )} budget after tolerance. Review the highest-cost items: ${expensiveItems || "unknown items"}.`;
}

function getTotalCookingMinutes(plan: CookingDayPlan) {
  const mealMinutes = Object.values(plan.meals).reduce((total, meal) => {
    if (!meal) return total;
    return total + meal.prepMinutes + meal.cookMinutes;
  }, 0);
  const todoMinutes = plan.cookingTodos.reduce((total, todo) => total + todo.durationMinutes, 0);
  return Math.max(mealMinutes, todoMinutes);
}

function priorityRank(priority: z.infer<typeof prioritySchema>) {
  return priority === "must-do" ? 0 : 1;
}

function formatList(items: string[]) {
  return items.length > 0 ? items.join(", ") : "none";
}

function normalize(value: string) {
  return value.toLowerCase().trim();
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function formatMoney(value: number, currency: string) {
  return `${roundMoney(value).toFixed(2)} ${currency}`;
}
