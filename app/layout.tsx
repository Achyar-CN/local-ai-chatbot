import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Local AI Chatbot · RAG",
  description: "Asisten AI lokal dengan RAG — berjalan 100% di laptop Anda via Ollama.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className={`${inter.variable} ${mono.variable} h-full`}>
      <body className="app-bg min-h-full antialiased">{children}</body>
    </html>
  );
}
