/** Client-safe shared types (no server imports). */
export interface Source {
  n: number;
  docName: string;
  page: number;
  text: string;
  score: number;
}

export interface DocumentMeta {
  id: string;
  name: string;
  size: number;
  chunks: number;
  createdAt: string;
}

export interface ConversationMeta {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}
