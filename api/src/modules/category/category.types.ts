import { CategoryTypeValue } from "./category.constants";

export interface CreateCategoryInput {
  name: string;
  type: CategoryTypeValue;
  description?: string;
  color?: string;
  icon?: string;
}

export type UpdateCategoryBody = {
  name?: string;
  type?: CategoryTypeValue;
  description?: string;
  color?: string;
  icon?: string;
};

export interface FilterCategoryInput {
  type?: CategoryTypeValue;
  includeSystem?: boolean;
  search?: string;
  page: number;
  limit: number;
}
