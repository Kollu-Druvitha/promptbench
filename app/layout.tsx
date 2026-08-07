import type { Metadata } from "next";
import "./globals.css";
import SideNav from "@/components/SideNav";

export const metadata: Metadata = {
  title: "PromptBench",
  description: "Compare LLM outputs on quality, tokens, latency, and cost.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
      </head>
      <body className="bg-background text-on-background min-h-screen flex w-full overflow-x-hidden">
        <SideNav />
        <main className="ml-0 md:ml-64 flex-1 flex flex-col min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
