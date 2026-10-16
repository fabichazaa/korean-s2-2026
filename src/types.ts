export type WordCategory =
  | 'family'
  | 'person'
  | 'country'
  | 'place'
  | 'food'
  | 'position'
  | 'object'
  | 'verb'
  | 'adjective'
  | 'counter'
  | 'calendar'
  | 'weather';

export interface VerbForms {
  present?: string;
  negative?: string;
  honorific?: string;
  pronunciation?: string;
}

export interface Word {
  id: string;
  korean: string;
  spanish: string;
  category: WordCategory;
  present?: string;
  verbForms?: VerbForms;
  note?: string;
}

export interface SavedProgress {
  knownIds?: string[];
  reviewCounts?: Record<string, number>;
}

export type StudyFilter = 'unlearned' | 'all' | 'learned';

