import { CandidateProfile } from './profile';
import { CreateApplicationPayload } from './application';

export type ExtensionMessageType =
  | 'GET_PROFILE'
  | 'PROFILE_DATA'
  | 'GENERATE_AI_ANSWER'
  | 'AI_ANSWER_RESULT'
  | 'FETCH_RESUME_PDF'
  | 'RESUME_PDF_RESULT'
  | 'LOG_KANBAN'
  | 'LOG_KANBAN_RESULT'
  | 'SET_AUTH_TOKEN'
  | 'GET_AUTH_STATUS'
  | 'AUTH_STATUS_RESULT'
  | 'OPEN_SIDE_PANEL';

export interface ExtensionMessage<T = unknown> {
  type: ExtensionMessageType;
  payload?: T;
}

export interface GenerateAiAnswerPayload {
  question: string;
  jobTitle: string;
  jobDescriptionSnippet?: string;
  format?: 'STAR_METHOD' | 'CONCISE_PARAGRAPH' | 'BULLET_POINTS';
  wordLimit?: number;
}

export interface FetchResumePdfPayload {
  resumeId: string;
}

export interface ExtensionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
