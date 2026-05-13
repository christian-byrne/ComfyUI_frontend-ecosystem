export interface BehaviorExemplar {
  pattern_id: string;
  repo: string;
  url: string;
  stars: number;
}

export interface BehaviorCategory {
  category_id: string;
  name: string;
  intent: string;
  notes?: string;
  member_pattern_ids: string[];
  usage_weight: number;
  exemplars: BehaviorExemplar[];
}

export interface BehaviorCategoriesFile {
  meta: Record<string, unknown>;
  categories: BehaviorCategory[];
}
