import { protectedProcedure, publicProcedure, router } from "../index";
import { generateCookingDayPlan, plannerInputSchema } from "../planner";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  generateCookingDayPlan: publicProcedure.input(plannerInputSchema).mutation(({ input }) => {
    return generateCookingDayPlan(input);
  }),
  privateData: protectedProcedure.query(({ ctx }) => {
    return {
      message: "This is private",
      user: ctx.session.user,
    };
  }),
});
export type AppRouter = typeof appRouter;
