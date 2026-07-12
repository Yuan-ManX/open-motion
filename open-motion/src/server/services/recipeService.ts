import {
  listRecipes as repoListRecipes,
  getRecipe as repoGetRecipe,
  searchRecipes as repoSearchRecipes,
  type MotionRecipe,
} from "../../motion/recipes.js";

export type { MotionRecipe };

export function listRecipes(category?: string): MotionRecipe[] {
  return repoListRecipes(category);
}

export function getRecipe(id: string): MotionRecipe | null {
  return repoGetRecipe(id);
}

export function searchRecipes(query: string): MotionRecipe[] {
  return repoSearchRecipes(query);
}
