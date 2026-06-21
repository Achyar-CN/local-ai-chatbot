/** Client-safe shared types (no server imports). */
export interface Source {
  n: number;
  kind: "doc" | "web";
  /** Document name (doc) or page title (web). */
  docName: string;
  text: string;
  score: number;
  // doc-only
  docId?: string;
  page?: number;
  ext?: string;
  // web-only
  url?: string;
}

export interface DocumentMeta {
  id: string;
  name: string;
  size: number;
  chunks: number;
  createdAt: string;
  ext?: string;
  mime?: string;
}

export interface ConversationMeta {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}
